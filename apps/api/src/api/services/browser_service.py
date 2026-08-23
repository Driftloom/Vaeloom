"""
Browser Service — server-side page fetching for agent tools.

Strategy (per fetch):
1. SSRF-guard the URL (utils.url_guard)
2. Render in shared headless Chromium (best fidelity, JS-executed pages)
3. Fall back to plain httpx GET + stdlib tag-stripping when chromium is
   unavailable — degraded but functional (static postings still parse)

verify_application_link uses cheap HEAD probes (GET fallback for 405).
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


class _TextExtractor(HTMLParser):
    """Stdlib tag-stripper: collects visible text, skips script/style/nav."""

    SKIP = {"script", "style", "noscript", "svg", "head"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._skip_depth = 0
        self.title = ""

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

    _in_title = False


def strip_html_to_text(html: str) -> tuple[str, str]:
    """(visible_text, title) from raw HTML using only the stdlib."""
    extractor = _TextExtractor()
    with contextlib.suppress(Exception):  # malformed HTML still yields partial text
        extractor.feed(html)
    return extractor.get_text(), extractor.title.strip()


class BrowserService:
    async def fetch_rendered_text(self, url: str) -> dict:
        """Fetch a public https URL and return {text, title, engine}.

        Raises UrlBlockedError for policy violations. Never raises for
        engine failure — falls back to httpx, then raises RuntimeError only
        if both engines fail.
        """
        await assert_public_http_url(url)
        try:
            text, title = await playwright_manager.fetch_page_text(url)
            if text:
                return {"text": text[:40000], "title": title, "engine": "chromium"}
            logger.info(f"chromium rendered empty body for {url}; falling back to httpx")
        except (PlaywrightUnavailableError, DocumentBuilderError) as e:
            logger.info(f"chromium unavailable ({e}); using httpx fallback for {url}")
        except Exception as e:  # noqa: BLE001 - nav errors (timeout/404) → try httpx
            logger.info(f"chromium fetch failed for {url} ({e}); trying httpx fallback")

        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=FETCH_TIMEOUT_S,
                headers={"User-Agent": USER_AGENT},
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
            text, title = strip_html_to_text(resp.text)
            if not text:
                raise RuntimeError(f"No extractable text at {url}")
            return {"text": text[:40000], "title": title, "engine": "httpx"}
        except UrlBlockedError:
            raise
        except Exception as e:
            raise RuntimeError(f"Failed to fetch {url}: {e}") from e

    async def probe_status(self, url: str) -> dict:
        """HEAD (GET fallback on 405) status probe. Returns
        {reachable, status_code, final_url}."""
        await assert_public_http_url(url)
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=12.0,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            method = "HEAD"
            for _ in range(2):
                try:
                    resp = await client.request(method, url)
                except httpx.HTTPStatusError:
                    raise
                if resp.status_code == 405 and method == "HEAD":
                    method = "GET"  # some boards reject HEAD
                    continue
                break
            return {
                "reachable": resp.status_code < 400,
                "status_code": resp.status_code,
                "final_url": str(resp.url),
            }


async def assert_fetchable_url(url: str) -> str:
    """Public helper so tool handlers can pre-validate + map errors."""
    try:
        return await assert_public_http_url(url)
    except UrlBlockedError as e:
        raise ValueError(str(e)) from e


browser_service = BrowserService()

# Re-export for tests/handlers convenience
UrlBlocked = UrlBlockedError
