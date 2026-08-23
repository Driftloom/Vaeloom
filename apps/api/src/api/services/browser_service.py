"""
Browser Service — server-side page fetching for agent tools.

Strategy (per fetch):
1. SSRF-guard the URL (utils.url_guard)
2. Render in shared headless Chromium (best fidelity, JS-executed pages);
   every network request the page makes is re-validated through the same
   guard via Playwright route interception (blocks redirect-to-internal
   and malicious-subresource fetches)
3. Fall back to plain httpx GET with MANUALLY validated redirects when
   chromium is unavailable — each hop must pass the guard (max 5 hops)

verify_application_link uses cheap guarded HEAD probes (GET fallback 405).

Known limitation (documented, ADR-035): DNS-rebinding TOCTOU remains — the
guard resolves DNS for validation, the HTTP stack resolves again to connect.
Mitigating fully requires pinning connections to validated IPs; not worth
the complexity at MVP scale.
"""
import contextlib
import logging
from html.parser import HTMLParser

import httpx

from ..utils.url_guard import UrlBlockedError, assert_public_http_url
from .document_builder import (
    DocumentBuilderError,
    PlaywrightUnavailableError,
    playwright_manager,
)

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (compatible; VaeloomBot/1.0; +https://vaeloom.app/bot) "
    "AppleWebKit/537.36"
)
FETCH_TIMEOUT_S = 20.0
MAX_REDIRECT_HOPS = 5


class RedirectPolicyViolation(RuntimeError):
    """A redirect hop failed the SSRF guard."""


class _TextExtractor(HTMLParser):
    """Stdlib tag-stripper: collects visible text, skips script/style."""

    SKIP = {"script", "style", "noscript", "svg", "head"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._skip_depth = 0
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag == "head" or (tag in self.SKIP):
            self._skip_depth += 1
        if tag == "title" and not self.title:
            self._in_title = True

    def handle_endtag(self, tag):
        if self._skip_depth > 0 and tag in self.SKIP:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
            return
        if self._skip_depth == 0 and data.strip():
            self._chunks.append(data.strip())

    def get_text(self) -> str:
        return "\n".join(self._chunks)


def strip_html_to_text(html: str) -> tuple[str, str]:
    """(visible_text, title) from raw HTML using only the stdlib."""
    extractor = _TextExtractor()
    with contextlib.suppress(Exception):  # malformed HTML still yields partial text
        extractor.feed(html)
    return extractor.get_text(), extractor.title.strip()


def _client_factory() -> httpx.AsyncClient:
    """Overridable seam for tests (inject MockTransport)."""
    return httpx.AsyncClient(
        follow_redirects=False, timeout=FETCH_TIMEOUT_S,
        headers={"User-Agent": USER_AGENT},
    )


async def _guarded_fetch(url: str, method: str = "GET") -> httpx.Response:
    """Fetch with EVERY redirect hop re-validated through the SSRF guard."""
    current = url
    resp: httpx.Response | None = None
    for _hop in range(MAX_REDIRECT_HOPS + 1):
        await assert_public_http_url(current)
        async with _client_factory() as client:
            resp = await client.request(method, current)
        if resp.is_redirect:
            location = resp.headers.get("location", "")
            if not location:
                break
            current = str(httpx.URL(resp.url).join(location))
            continue
        return resp
    raise RedirectPolicyViolation(
        f"Redirect chain exceeded {MAX_REDIRECT_HOPS} hops or violated policy starting at {url}"
    )


def _chromium_route_guard():
    """Playwright route handler factory: validate every request URL."""
    async def guard(route):
        try:
            await assert_public_http_url(route.request.url)
            await route.continue_()
        except UrlBlockedError:
            await route.abort()
    return guard


class BrowserService:
    async def fetch_rendered_text(self, url: str) -> dict:
        """Fetch a public https URL and return {text, title, engine}.

        Raises UrlBlockedError for policy violations on any hop/request.
        Falls back chromium → httpx; raises RuntimeError only if both fail.
        """
        await assert_public_http_url(url)
        try:
            text, title = await self._fetch_via_chromium(url)
            if text:
                return {"text": text[:40000], "title": title, "engine": "chromium"}
            logger.info(f"chromium rendered empty body for {url}; falling back to httpx")
        except (UrlBlockedError, RedirectPolicyViolation):
            raise  # policy violations are never retried on another engine
        except (PlaywrightUnavailableError, DocumentBuilderError) as e:
            logger.info(f"chromium unavailable ({e}); using httpx fallback for {url}")
        except Exception as e:  # noqa: BLE001 - nav errors (timeout/404) → try httpx
            logger.info(f"chromium fetch failed for {url} ({e}); trying httpx fallback")

        try:
            resp = await _guarded_fetch(url, method="GET")
            resp.raise_for_status()
            html = resp.text
            if not html:
                raise RuntimeError(f"No content at {url}")
            text, title = strip_html_to_text(html)
            if not text:
                raise RuntimeError(f"No extractable text at {url}")
            return {"text": text[:40000], "title": title, "engine": "httpx"}
        except (UrlBlockedError, RedirectPolicyViolation):
            raise
        except Exception as e:
            raise RuntimeError(f"Failed to fetch {url}: {e}") from e

    async def _fetch_via_chromium(self, url: str) -> tuple[str, str]:
        """Chromium render with per-request SSRF interception.

        Separated so transport errors still allow the httpx fallback while
        policy errors propagate untouched.
        """
        return await playwright_manager.fetch_page_text_guarded(url, _chromium_route_guard())

    async def probe_status(self, url: str) -> dict:
        """HEAD (GET fallback on 405) status probe with guarded redirects.
        Returns {reachable, status_code, final_url}."""
        await assert_public_http_url(url)
        current = url
        method = "HEAD"
        for _hop in range(MAX_REDIRECT_HOPS + 1):
            await assert_public_http_url(current)
            async with _client_factory() as client:
                resp = await client.request(method, current)
            if resp.status_code == 405 and method == "HEAD":
                method = "GET"  # some boards reject HEAD; retry same URL once
                continue
            if resp.is_redirect:
                location = resp.headers.get("location", "")
                if not location:
                    break
                current = str(httpx.URL(resp.url).join(location))
                continue
            break
        return {
            "reachable": resp.status_code < 400,
            "status_code": resp.status_code,
            "final_url": str(resp.url),
        }


browser_service = BrowserService()

# Re-export for tests/handlers convenience
UrlBlocked = UrlBlockedError
