import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestIntegrations:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "int@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_create_integration(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/integrations", json={
            "name": "Test Integration", "provider": "gmail",
        }, headers=headers)
        assert res.status_code == 201
        assert res.json()["name"] == "Test Integration"

    async def test_list_integrations(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/integrations", headers=headers)
        assert res.status_code == 200

    async def test_create_then_delete(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/integrations", json={
            "name": "Del Me", "provider": "gmail",
        }, headers=headers)
        assert created.status_code == 201
        iid = created.json()["id"]
        res = await client.delete(f"/api/v1/integrations/{iid}", headers=headers)
        assert res.status_code == 204

    async def test_update_integration(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/integrations", json={
            "name": "Before", "provider": "gmail",
        }, headers=headers)
        assert created.status_code == 201
        iid = created.json()["id"]
        res = await client.put(f"/api/v1/integrations/{iid}", json={
            "name": "After",
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "After"

    async def test_sync_integration(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/integrations", json={
            "name": "Sync Test", "provider": "gmail",
        }, headers=headers)
        assert created.status_code == 201
        iid = created.json()["id"]
        res = await client.post(f"/api/v1/integrations/{iid}/sync", headers=headers)
        assert res.status_code == 200
        assert res.json()["synced"] is True

    async def test_get_user_id_returns_none(self):
        from api.routers.integrations import _get_user_id
        assert _get_user_id(None) is None
