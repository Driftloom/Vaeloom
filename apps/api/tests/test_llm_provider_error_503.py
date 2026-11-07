"""``LLMProviderError`` must surface as 503, never 500.

The bug this pins: ``services/llm_service.py`` raises ``LLMProviderError``
from ~30 sites -- missing key, connection refused, upstream 5xx, empty
embedding vector -- and with no handler registered for the class they all
landed in ``generic_exception_handler``. That reported a dependency being
down as a server defect: it charged the client's 5xx error budget for an
outage it cannot fix, and told callers the request was unrecoverable when
retrying after provider recovery is what actually works.

Two halves, because either alone is insufficient:

* ``TestProductionAppRegistration`` drives the real ``api.main`` app, so a
  handler wired only into a test app cannot pass.
* ``TestMemorySearchEndpoint`` drives ``POST /api/v1/memories/search`` --
  the endpoint that was reported -- through the shared ``client`` fixture,
  so a router-boundary ``try/except`` that special-cases this one route
  cannot pass either.

Every negative control asserts the EXACT 500. A test that accepted
``(500, 503)`` would pass with the mapping removed, which is the thing the
mapping exists to change.
"""

import sys
from datetime import datetime, timedelta, timezone

import jwt
import pytest
import pytest_asyncio
from fastapi import Request as FastAPIRequest
from httpx import ASGITransport, AsyncClient

from api.config import settings
from api.services.llm_service import LLMProviderError, LLMTransientError, llm_service

pytestmark = pytest.mark.asyncio

UNAVAILABLE_TYPE = "https://api.vaeloom.app/errors/unavailable"


@pytest.fixture(autouse=True)
def _drop_api_main():
    """Each test reimports a pristine production app; don't leak it."""
    yield
    sys.modules.pop("api.main", None)


def _prod_app():
    sys.modules.pop("api.main", None)
    import api.main as m

    return m.app


def _add_raising_route(app, path: str, exc: Exception):
    async def _raise(_req: FastAPIRequest):
        raise exc

    app.add_api_route(path, _raise, methods=["GET"])


async def _prod_get(app, path: str):
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        return await ac.get(path, headers=_bearer())


def _bearer(**claims) -> dict:
    payload = {
        "sub": "test-user",
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        **claims,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return {"Authorization": f"Bearer {token}"}


class TestProductionAppRegistration:
    """The mapping must live in api.main, not in a test-only wiring."""

    async def test_llm_provider_error_is_503(self):
        app = _prod_app()
        _add_raising_route(app, "/_provider_down", LLMProviderError("OpenAI embedding failed: 503"))

        resp = await _prod_get(app, "/_provider_down")

        assert resp.status_code == 503

    async def test_503_uses_the_problem_envelope(self):
        app = _prod_app()
        _add_raising_route(app, "/_provider_down", LLMProviderError("OpenAI embedding failed: 503"))

        resp = await _prod_get(app, "/_provider_down")
        body = resp.json()

        assert resp.status_code == 503
        assert resp.headers["content-type"].startswith("application/problem+json")
        assert body["success"] is False
        assert body["error"]["code"] == 503
        assert body["status"] == 503
        assert body["type"] == UNAVAILABLE_TYPE
        assert body["title"] == "Service Unavailable"
        assert body["instance"] == "/_provider_down"
        # Legacy key the web client parses.
        assert body["detail"] == "LLM provider unavailable"

    async def test_transient_provider_error_is_503(self):
        """LLMTransientError subclasses LLMProviderError: an upstream 429
        reaching the client is still our provider being unavailable."""
        app = _prod_app()
        _add_raising_route(
            app, "/_provider_transient", LLMTransientError("Anthropic transient error: 429", status_code=429)
        )

        resp = await _prod_get(app, "/_provider_transient")

        assert resp.status_code == 503

    async def test_missing_api_key_is_503_not_500(self):
        """The reported trigger was an unconfigured provider, which raises
        the same class as an outage."""
        app = _prod_app()
        _add_raising_route(
            app, "/_no_key", LLMProviderError("Missing OpenAI API key - configure in Settings > API Keys (BYOK)")
        )

        resp = await _prod_get(app, "/_no_key")

        assert resp.status_code == 503

    async def test_genuine_bug_is_still_500(self):
        """NEGATIVE CONTROL. A bug is not a provider outage. If the mapping
        were an over-broad ``except Exception``, this would report 503 and
        every real defect would be mislabelled as an outage."""
        app = _prod_app()
        _add_raising_route(app, "/_real_bug", RuntimeError("NoneType has no attribute 'id'"))

        resp = await _prod_get(app, "/_real_bug")

        assert resp.status_code == 500

    async def test_genuine_bug_envelope_stays_internal_error(self):
        """NEGATIVE CONTROL. The 500 must keep its own type/title, so a
        client can still tell "we broke" from "retry later"."""
        app = _prod_app()
        _add_raising_route(app, "/_real_bug", RuntimeError("boom"))

        resp = await _prod_get(app, "/_real_bug")
        body = resp.json()

        assert resp.status_code == 500
        assert body["type"] == "https://api.vaeloom.app/errors/internal-error"
        assert body["title"] == "Internal Server Error"
        assert body["error"]["code"] == 500

    async def test_httpx_timeout_is_still_500(self):
        """NEGATIVE CONTROL. llm_service retries and re-raises raw
        ``httpx.TimeoutException``/``httpx.NetworkError`` alongside
        LLMProviderError in two fallback ladders, and those are NOT
        converted -- only the LLMProviderError class is. This test pins
        the current boundary so widening it later is a deliberate change
        rather than a silent one."""
        import httpx

        app = _prod_app()
        _add_raising_route(app, "/_timeout", httpx.ConnectTimeout("connection timed out"))

        resp = await _prod_get(app, "/_timeout")

        assert resp.status_code == 500


@pytest_asyncio.fixture
async def raw_client(db_session):
    """The shared test app with ``raise_app_exceptions=False``.

    Starlette's ServerErrorMiddleware sends the 500 body and then re-raises,
    so the default transport turns an unhandled exception into a test failure
    instead of an observable status code. The 503 path does not need this --
    it is a registered handler in ExceptionMiddleware, which returns normally
    -- but the negative controls do.
    """
    from tests.conftest import _build_test_app

    transport = ASGITransport(app=_build_test_app(db_session), raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestMemorySearchEndpoint:
    """The reported surface: POST /api/v1/memories/search."""

    async def _search(self, client: AsyncClient) -> dict:
        signup = await client.post(
            "/api/v1/auth/signup",
            json={"email": "llm503@vaeloom.test", "password": "TestAuth1234!"},
        )
        assert signup.status_code == 201
        headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}
        return await client.post(
            "/api/v1/memories/search",
            json={"query": "hello"},
            headers=headers,
        )

    async def test_search_returns_503_when_provider_down(self, client: AsyncClient, monkeypatch):
        async def _boom(self, text, *args, **kwargs):
            raise LLMProviderError("OpenAI embedding failed: 503 upstream unavailable")

        monkeypatch.setattr(
            type(llm_service), "generate_embedding", _boom, raising=True
        )

        res = await self._search(client)

        assert res.status_code == 503
        assert res.json()["error"]["code"] == 503

    async def test_search_returns_500_on_a_genuine_bug(self, raw_client: AsyncClient, monkeypatch):
        """NEGATIVE CONTROL, on the same endpoint and the same seam.

        Only the exception type differs. Without this, a handler that
        swallowed every error from the embedding path would look correct.
        """
        async def _boom(self, text, *args, **kwargs):
            raise RuntimeError("genuine defect in the embedding call path")

        monkeypatch.setattr(
            type(llm_service), "generate_embedding", _boom, raising=True
        )

        res = await self._search(raw_client)

        assert res.status_code == 500

    async def test_search_still_succeeds_without_any_patch(self, client: AsyncClient):
        """Control that the 503 tests above are caused by the raised
        provider error and not by the request shape."""
        signup = await client.post(
            "/api/v1/auth/signup",
            json={"email": "llm503ok@vaeloom.test", "password": "TestAuth1234!"},
        )
        assert signup.status_code == 201
        headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}

        res = await client.post("/api/v1/memories/search", json={"query": "hello"}, headers=headers)

        assert res.status_code == 200