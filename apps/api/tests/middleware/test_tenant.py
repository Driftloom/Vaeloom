import uuid

import pytest
from fastapi import FastAPI, Depends
from httpx import AsyncClient, ASGITransport

from fastapi import Request

from api.middleware.tenant import (
    TenantContext,
    TenantMiddleware,
    get_current_tenant,
    require_workspace_access,
)

pytestmark = pytest.mark.asyncio


class TestTenantContext:
    def test_default_is_empty(self):
        assert TenantContext.get() == {}
        assert TenantContext.get_tenant_id() is None
        assert TenantContext.get_workspace_id() is None

    def test_set_and_get(self):
        TenantContext.set("tenant-1", "workspace-1")
        assert TenantContext.get_tenant_id() == "tenant-1"
        assert TenantContext.get_workspace_id() == "workspace-1"
        TenantContext.clear()
        assert TenantContext.get() == {}

    def test_clear(self):
        TenantContext.set("t-1", "w-1")
        TenantContext.clear()
        assert TenantContext.get() == {}

    def test_set_tenant_only(self):
        TenantContext.set("t-1")
        assert TenantContext.get_tenant_id() == "t-1"
        assert TenantContext.get_workspace_id() is None
        TenantContext.clear()


class TestTenantMiddleware:
    async def test_ignores_user_supplied_headers(self):
        app = FastAPI()

        @app.get("/test")
        async def test_endpoint(req: Request):
            return {
                "tenant_id": getattr(req.state, "tenant_id", None),
                "workspace_id": getattr(req.state, "workspace_id", None),
            }

        app.add_middleware(TenantMiddleware)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/test", headers={"X-Tenant-ID": "t-1", "X-Workspace-ID": "w-1"})
            assert res.status_code == 200
            data = res.json()
            assert data["tenant_id"] is None
            # Authoritative Workspace Identity (Phase A.1): Client-supplied workspace headers
            # are never authoritative by themselves. Unauthenticated requests have workspace_id=None.
            assert data["workspace_id"] is None

    async def test_missing_headers(self):
        app = FastAPI()

        @app.get("/test")
        async def test_endpoint(req: Request):
            return {
                "tenant_id": getattr(req.state, "tenant_id", None),
                "workspace_id": getattr(req.state, "workspace_id", None),
            }

        app.add_middleware(TenantMiddleware)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/test")
            assert res.status_code == 200
            data = res.json()
            assert data["tenant_id"] is None
            assert data["workspace_id"] is None

    async def test_clears_context_after_request(self):
        app = FastAPI()

        @app.get("/test")
        async def test_endpoint(req: Request):
            return {"ok": True}

        app.add_middleware(TenantMiddleware)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            await ac.get("/test", headers={"X-Tenant-ID": "t-1"})
        assert TenantContext.get() == {}


class TestGetCurrentTenant:
    async def test_missing_tenant_context_returns_400(self):
        app = FastAPI()

        @app.get("/test")
        async def test_endpoint(tenant=Depends(get_current_tenant)):
            return tenant

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/test")
            assert res.status_code == 400
            assert "Tenant context is required" in res.json()["detail"]

    async def test_no_header_no_state_returns_400(self):
        app = FastAPI()

        @app.get("/test")
        async def test_endpoint(tenant=Depends(get_current_tenant)):
            return tenant

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/test", headers={"X-Tenant-ID": "evil-tenant"})
            assert res.status_code == 400
            assert "Tenant context is required" in res.json()["detail"]


class TestDefaultSessionFactory:
    """Regression (staging gate 2026-09-07): TenantMiddleware mounted WITHOUT
    an explicit factory (production main.py) must resolve the default
    async_session_factory instead of raising NameError on workspace-scoped
    requests. Hermetic suites always injected a factory, hiding the bug."""

    async def test_workspace_request_without_factory_uses_default(self, monkeypatch):
        from starlette.middleware.base import BaseHTTPMiddleware

        used = {"factory": None}

        class _Session:
            async def __aenter__(self):
                return object()

            async def __aexit__(self, *a):
                return False

        class _Factory:
            def __call__(self):
                used["factory"] = "default"
                return _Session()

        async def _allow(session, workspace_id, user_id, tenant_id=None):
            return True

        import api.database as _db
        import api.middleware.tenant as _tenant_mod

        monkeypatch.setattr(_db, "async_session_factory", _Factory(), raising=False)
        monkeypatch.setattr(_tenant_mod, "check_user_workspace_access", _allow)

        class _FakeAuth(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                request.state.user_id = str(uuid.uuid4())
                request.state.tenant_id = str(uuid.uuid4())
                return await call_next(request)

        app = FastAPI()
        app.add_middleware(TenantMiddleware)  # NO session_factory, like production
        app.add_middleware(_FakeAuth)

        @app.get("/test")
        async def test_endpoint(req: Request):
            return {"workspace_id": getattr(req.state, "workspace_id", None)}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            wid = str(uuid.uuid4())
            res = await ac.get("/test", headers={"X-Workspace-ID": wid})
            assert res.status_code == 200, res.text[:300]
            assert res.json()["workspace_id"] == wid
        assert used["factory"] == "default"
