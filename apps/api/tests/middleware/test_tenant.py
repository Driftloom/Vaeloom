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
    async def test_sets_tenant_from_header(self):
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
            assert data["tenant_id"] == "t-1"
            assert data["workspace_id"] == "w-1"

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
    async def test_missing_header_returns_400(self):
        app = FastAPI()

        @app.get("/test")
        async def test_endpoint(tenant=Depends(get_current_tenant)):
            return tenant

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/test")
            assert res.status_code == 400
            assert "X-Tenant-ID" in res.json()["detail"]

    async def test_invalid_uuid_returns_400(self):
        app = FastAPI()
        from api.database import get_db as _get_db

        async def override_db():
            class FakeSession:
                async def execute(self, stmt):
                    class FakeResult:
                        def scalar_one_or_none(self):
                            return None
                    return FakeResult()
            yield FakeSession()

        app.dependency_overrides[_get_db] = override_db

        @app.get("/test")
        async def test_endpoint(tenant=Depends(get_current_tenant)):
            return tenant

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/test", headers={"X-Tenant-ID": "not-a-uuid"})
            assert res.status_code == 400
            assert "Invalid tenant ID format" in res.json()["detail"]
