import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestConnectors:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "conn@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_create_connector(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/connectors", json={
            "name": "Test Connector",
            "type": "rest",
            "config": {"url": "https://example.com"},
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_list_connectors(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/connectors?page=1&page_size=20",
            headers=headers,
        )
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_get_connector(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/connectors", json={
            "name": "Get Test",
            "type": "rest",
            "config": {"url": "https://example.com"},
        }, headers=headers)
        assert created.status_code == 201
        cid = created.json()["id"]
        res = await client.get(f"/api/v1/connectors/{cid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Get Test"

    async def test_get_connector_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/connectors/00000000-0000-0000-0000-000000000000",
            headers=headers,
        )
        assert res.status_code == 404

    async def test_update_connector(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/connectors", json={
            "name": "Before",
            "type": "rest",
            "config": {"url": "https://example.com"},
        }, headers=headers)
        assert created.status_code == 201
        cid = created.json()["id"]
        res = await client.put(f"/api/v1/connectors/{cid}", json={
            "name": "Updated",
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Updated"

    async def test_delete_connector(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/connectors", json={
            "name": "Delete Me",
            "type": "rest",
            "config": {"url": "https://example.com"},
        }, headers=headers)
        assert created.status_code == 201
        cid = created.json()["id"]
        res = await client.delete(f"/api/v1/connectors/{cid}", headers=headers)
        assert res.status_code == 204

    async def test_connector_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/connectors", json={
            "name": "No Auth",
            "type": "rest",
            "config": {},
        })
        assert res.status_code == 401

    async def test_sync_connector(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/connectors", json={
            "name": "Sync Test",
            "type": "rest",
            "config": {"url": "https://example.com"},
        }, headers=headers)
        assert created.status_code == 201
        cid = created.json()["id"]
        res = await client.post(f"/api/v1/connectors/{cid}/sync", headers=headers)
        assert res.status_code in (200, 401)

    async def test_get_sync_status(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/connectors", json={
            "name": "Sync Status Test",
            "type": "rest",
            "config": {"url": "https://example.com"},
        }, headers=headers)
        assert created.status_code == 201
        cid = created.json()["id"]
        res = await client.get(f"/api/v1/connectors/{cid}/sync/status", headers=headers)
        assert res.status_code == 200

    async def test_test_connection(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/connectors", json={
            "name": "Test Connection",
            "type": "rest",
            "config": {"url": "https://example.com"},
        }, headers=headers)
        assert created.status_code == 201
        cid = created.json()["id"]
        res = await client.post(f"/api/v1/connectors/{cid}/test", headers=headers)
        assert res.status_code in (200, 502, 504)

    async def test_endpoints_require_auth(self, db_session):
        from api.database import get_db
        from api.dependencies import get_current_user
        from api.routers import connectors
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        app.include_router(connectors.router, prefix="/api/v1/connectors")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        async def no_user():
            return None
        app.dependency_overrides[get_current_user] = no_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            assert (await ac.post("/api/v1/connectors", json={"name": "x", "type": "rest", "config": {"url": "https://x.com"}})).status_code == 401
            assert (await ac.get("/api/v1/connectors")).status_code == 401
            assert (await ac.get(f"/api/v1/connectors/{uuid.uuid4()}")).status_code == 401
            assert (await ac.put(f"/api/v1/connectors/{uuid.uuid4()}", json={"name": "x"})).status_code == 401
            assert (await ac.delete(f"/api/v1/connectors/{uuid.uuid4()}")).status_code == 401
            assert (await ac.post(f"/api/v1/connectors/{uuid.uuid4()}/sync")).status_code == 401
            assert (await ac.get(f"/api/v1/connectors/{uuid.uuid4()}/sync/status")).status_code == 401
            assert (await ac.post(f"/api/v1/connectors/{uuid.uuid4()}/test")).status_code == 401

    async def test_get_user_id_returns_none(self):
        from api.routers.connectors import _get_user_id
        assert _get_user_id(None) is None
