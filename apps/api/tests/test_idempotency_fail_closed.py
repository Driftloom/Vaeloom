"""Idempotency storage-failure policy: fail-open default vs fail-closed prod flag.

Uses a minimal Starlette app (no DB) so storage faults are deterministic.
"""
import pytest
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from api.middleware.idempotency import IdempotencyMiddleware


async def _ok_endpoint(request):
    return JSONResponse({"ok": True, "path": request.url.path})


def _app(session_factory=None, **kw):
    routes = [Route("/api/v1/approvals", _ok_endpoint, methods=["POST"])]
    app = Starlette(routes=routes)
    return IdempotencyMiddleware(app, session_factory=session_factory, **kw)


class _BoomSession:
    async def __aenter__(self):
        raise RuntimeError("db down")

    async def __aexit__(self, *a):
        return False


class _BoomFactory:
    def __call__(self):
        return _BoomSession()


class TestFailOpenDefault:
    def test_lookup_failure_passes_through(self, monkeypatch):
        from api.config import settings as _settings

        monkeypatch.setattr(_settings, "idempotency_fail_closed", False, raising=False)
        client = TestClient(_app(session_factory=_BoomFactory()))
        res = client.post("/api/v1/approvals", json={"a": 1}, headers={"Idempotency-Key": "k-fo-1"})
        assert res.status_code == 200
        assert res.json() == {"ok": True, "path": "/api/v1/approvals"}


class TestFailClosedFlag:
    def test_lookup_failure_returns_503(self, monkeypatch):
        from api.config import settings as _settings

        monkeypatch.setattr(_settings, "idempotency_fail_closed", True, raising=False)
        client = TestClient(_app(session_factory=_BoomFactory()))
        res = client.post("/api/v1/approvals", json={"a": 1}, headers={"Idempotency-Key": "k-fc-1"})
        assert res.status_code == 503
        assert res.headers.get("Idempotency-Lookup") == "failed"

    def test_store_failure_tags_response_not_durable(self, monkeypatch):
        import api.middleware.idempotency as mod

        async def _ok_replay(self, key, path, req_hash):
            return None

        async def _boom_store(self, key, path, req_hash, response, body_bytes=None):
            raise RuntimeError("store down")

        monkeypatch.setattr(mod.IdempotencyMiddleware, "_replay", _ok_replay)
        monkeypatch.setattr(mod.IdempotencyMiddleware, "_store", _boom_store)
        client = TestClient(_app())
        res = client.post("/api/v1/approvals", json={"a": 2}, headers={"Idempotency-Key": "k-fc-2"})
        # Real bytes preserved (not an empty/lying body), tagged non-durable.
        assert res.status_code == 200
        assert res.json() == {"ok": True, "path": "/api/v1/approvals"}
        assert res.headers.get("Idempotency-Stored") == "false"
