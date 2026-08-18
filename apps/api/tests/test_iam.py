import uuid
import jwt
import pytest
from httpx import AsyncClient, ASGITransport

from api.config import settings

pytestmark = pytest.mark.asyncio


class TestIAM:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "iam@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def _admin_headers(self) -> dict:
        """Create a JWT with admin role for IAM endpoints."""
        token = jwt.encode(
            {"sub": str(uuid.uuid4()), "email": "admin@test.com", "roles": ["admin"]},
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        return {"Authorization": f"Bearer {token}"}

    async def _client_with_tenant(self, db_session, tenant_id="test-tenant"):
        from api.database import get_db
        from api.middleware.auth import AuthMiddleware
        from api.routers import (
            health, auth, workspaces, memory, agents, events, search,
            integrations, billing, documents, resumes, applications,
            plugins, chat, notifications, connectors, scheduler,
            analytics, audit, iam, knowledge_graph, recommendations,
        )
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        from starlette.exceptions import HTTPException as StarletteHTTPException
        from api.middleware.exception_handler import unified_exception_handler, generic_exception_handler

        test_app = FastAPI()
        test_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
        test_app.add_middleware(AuthMiddleware)
        test_app.add_exception_handler(StarletteHTTPException, unified_exception_handler)
        test_app.add_exception_handler(Exception, generic_exception_handler)
        test_app.include_router(health.router, prefix="/health")
        test_app.include_router(auth.router, prefix="/api/v1/auth")
        test_app.include_router(workspaces.router, prefix="/api/v1/workspaces")
        test_app.include_router(memory.router, prefix="/api/v1/memories")
        test_app.include_router(agents.router, prefix="/api/v1/agents")
        test_app.include_router(events.router, prefix="/api/v1/events")
        test_app.include_router(search.router, prefix="/api/v1/search")
        test_app.include_router(integrations.router, prefix="/api/v1/integrations")
        test_app.include_router(billing.router, prefix="/api/v1/billing")
        test_app.include_router(documents.router, prefix="/api/v1/documents")
        test_app.include_router(resumes.router, prefix="/api/v1/resumes")
        test_app.include_router(applications.router, prefix="/api/v1/workspaces/{workspace_id}/applications")
        test_app.include_router(notifications.router, prefix="/api/v1/notifications")
        test_app.include_router(connectors.router, prefix="/api/v1/connectors")
        test_app.include_router(scheduler.router, prefix="/api/v1/scheduler")
        test_app.include_router(analytics.router, prefix="/api/v1/analytics")
        test_app.include_router(audit.router, prefix="/api/v1/audit")
        test_app.include_router(iam.router, prefix="/api/v1/iam")
        test_app.include_router(plugins.router, prefix="/api/v1/plugins")
        test_app.include_router(chat.router, prefix="/api/v1/chat")
        test_app.include_router(knowledge_graph.router, prefix="/api/v1/knowledge-graph")
        test_app.include_router(recommendations.router, prefix="/api/v1/recommendations")

        async def override_get_db():
            yield db_session
        test_app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=test_app)
        return AsyncClient(transport=transport, base_url="http://test"), test_app

    async def _create_user(self, client, headers, **overrides):
        payload = {
            "email": f"{uuid.uuid4().hex[:8]}@test.com",
            "display_name": "IAM User",
            "tenant_id": "test-tenant",
            **overrides,
        }
        res = await client.post("/api/v1/iam/users", json=payload, headers=headers)
        assert res.status_code == 201
        return res.json()

    async def _create_role(self, client, headers, name="admin"):
        res = await client.post("/api/v1/iam/roles", json={"name": name, "permissions": ["read", "write"]}, headers=headers)
        if res.status_code == 201:
            return res.json()["id"]
        return None

    async def test_list_users(self, client: AsyncClient):
        headers = self._admin_headers()
        res = await client.get("/api/v1/iam/users", headers=headers)
        assert res.status_code in (200, 400)

    async def test_list_users_with_tenant(self, db_session):
        from api.dependencies import get_current_user
        from fastapi import FastAPI
        from api.database import get_db
        from api.routers import iam

        test_app = FastAPI()
        test_app.include_router(iam.router, prefix="/api/v1/iam")

        async def override_get_db():
            yield db_session
        test_app.dependency_overrides[get_db] = override_get_db

        async def auth_admin():
            return {"sub": "test-user", "tenant_id": "test-tenant", "roles": ["admin"]}
        test_app.dependency_overrides[get_current_user] = auth_admin

        from httpx import AsyncClient, ASGITransport
        transport = ASGITransport(app=test_app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/iam/users")
            assert res.status_code == 200
            assert "items" in res.json()

    async def test_update_user_not_found(self, client: AsyncClient):
        headers = self._admin_headers()
        res = await client.put(f"/api/v1/iam/users/{uuid.uuid4()}", json={
            "display_name": "Nope",
        }, headers=headers)
        assert res.status_code == 404

    async def test_get_user(self, client: AsyncClient):
        headers = self._admin_headers()
        created = await client.post("/api/v1/iam/users", json={
            "email": "iam-existing@test.com",
            "display_name": "IAM User",
            "tenant_id": "test-tenant",
        }, headers=headers)
        assert created.status_code == 201
        uid = created.json()["id"]
        res = await client.get(f"/api/v1/iam/users/{uid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["email"] == "iam-existing@test.com"

    async def test_get_user_not_found(self, client: AsyncClient):
        headers = self._admin_headers()
        res = await client.get(f"/api/v1/iam/users/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 404

    async def test_create_user(self, client: AsyncClient):
        headers = self._admin_headers()
        user = await self._create_user(client, headers, email="create-test@test.com")
        assert "id" in user
        assert user["email"] == "create-test@test.com"
        assert user["active"] is True

    async def test_update_user(self, client: AsyncClient):
        headers = self._admin_headers()
        user = await self._create_user(client, headers)
        uid = user["id"]
        res = await client.put(f"/api/v1/iam/users/{uid}", json={
            "display_name": "Updated Name",
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["display_name"] == "Updated Name"

    async def test_deactivate_user(self, client: AsyncClient):
        headers = self._admin_headers()
        user = await self._create_user(client, headers)
        uid = user["id"]
        res = await client.delete(f"/api/v1/iam/users/{uid}", headers=headers)
        assert res.status_code == 204

    async def test_deactivate_nonexistent_user(self, client: AsyncClient):
        headers = self._admin_headers()
        res = await client.delete(f"/api/v1/iam/users/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 404

    async def test_iam_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/iam/users")
        assert res.status_code == 401

    async def test_assign_roles(self, client: AsyncClient):
        headers = self._admin_headers()
        user = await self._create_user(client, headers)
        uid = user["id"]
        role_id = "00000000-0000-0000-0000-000000000001"
        res = await client.post(f"/api/v1/iam/users/{uid}/roles", json={
            "role_ids": [role_id],
        }, headers=headers)
        assert res.status_code == 200

    async def test_assign_roles_nonexistent_user(self, client: AsyncClient):
        headers = self._admin_headers()
        res = await client.post(f"/api/v1/iam/users/{uuid.uuid4()}/roles", json={
            "role_ids": ["00000000-0000-0000-0000-000000000001"],
        }, headers=headers)
        assert res.status_code == 404

    async def test_remove_role(self, client: AsyncClient):
        headers = self._admin_headers()
        user = await self._create_user(client, headers)
        uid = user["id"]
        role_id = "00000000-0000-0000-0000-000000000001"
        await client.post(f"/api/v1/iam/users/{uid}/roles", json={"role_ids": [role_id]}, headers=headers)
        res = await client.delete(f"/api/v1/iam/users/{uid}/roles/{role_id}", headers=headers)
        assert res.status_code == 204

    async def test_remove_role_not_found(self, client: AsyncClient):
        headers = self._admin_headers()
        user = await self._create_user(client, headers)
        uid = user["id"]
        res = await client.delete(f"/api/v1/iam/users/{uid}/roles/fake-role-id", headers=headers)
        assert res.status_code == 404

    async def test_get_permissions(self, client: AsyncClient):
        headers = self._admin_headers()
        user = await self._create_user(client, headers)
        uid = user["id"]
        res = await client.get(f"/api/v1/iam/users/{uid}/permissions", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_update_user_not_found_handler(self, client: AsyncClient, monkeypatch):
        from api.services.iam_service import iam_service
        async def fake_update(user_id, dto, db=None):
            return None
        monkeypatch.setattr(iam_service, "update_user", fake_update)
        headers = self._admin_headers()
        res = await client.put(f"/api/v1/iam/users/{uuid.uuid4()}", json={
            "display_name": "Nope",
        }, headers=headers)
        assert res.status_code == 404
