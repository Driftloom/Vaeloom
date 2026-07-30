import uuid
import pytest
from httpx import AsyncClient

from backend.dependencies import get_current_user

pytestmark = pytest.mark.asyncio


PLUGIN_BODY = {
    "name": "CovPlugin", "version": "1.0.0", "author": "tester",
    "description": "cov", "license": "MIT", "min_app_version": "1.0.0",
    "tags": ["tool"], "permissions": {}, "entry_point": "main.py",
}


class TestPluginsRouterCoverage:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "plug-cov@test.com", "password": "Test1234!",
        })
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _override_user_none(self, client: AsyncClient):
        client._transport.app.dependency_overrides[get_current_user] = lambda: None

    async def _create_plugin(self, client, headers, name="CovPlugin"):
        res = await client.post("/api/v1/plugins", json={**PLUGIN_BODY, "name": name}, headers=headers)
        assert res.status_code == 201
        return res.json()["id"]

    # --- register_plugin ---

    async def test_register_plugin_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/plugins", json=PLUGIN_BODY, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_register_plugin_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/plugins", json=PLUGIN_BODY)
        assert res.status_code == 401

    async def test_register_plugin_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.post("/api/v1/plugins", json=PLUGIN_BODY, headers=headers)
        assert res.status_code == 401

    # --- list_plugins ---

    async def test_list_plugins_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/plugins", headers=headers)
        assert res.status_code == 200
        assert "plugins" in res.json()
        assert "total" in res.json()

    async def test_list_plugins_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/plugins")
        assert res.status_code == 401

    # --- get_plugin ---

    async def test_get_plugin_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        pid = await self._create_plugin(client, headers, "GetCov")
        res = await client.get(f"/api/v1/plugins/{pid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "GetCov"

    async def test_get_plugin_requires_auth(self, client: AsyncClient):
        res = await client.get(f"/api/v1/plugins/{uuid.uuid4()}")
        assert res.status_code == 401

    async def test_get_plugin_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.get(f"/api/v1/plugins/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 401

    async def test_get_plugin_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            f"/api/v1/plugins/00000000-0000-0000-0000-000000000000", headers=headers,
        )
        assert res.status_code == 404

    # --- update_plugin ---

    async def test_update_plugin_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        pid = await self._create_plugin(client, headers, "UpdCov")
        res = await client.put(f"/api/v1/plugins/{pid}", json={"version": "2.0.0"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["version"] == "2.0.0"

    async def test_update_plugin_requires_auth(self, client: AsyncClient):
        res = await client.put(f"/api/v1/plugins/{uuid.uuid4()}", json={"version": "2.0.0"})
        assert res.status_code == 401

    async def test_update_plugin_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.put(f"/api/v1/plugins/{uuid.uuid4()}", json={"version": "2.0.0"}, headers=headers)
        assert res.status_code == 401

    async def test_update_plugin_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.put(
            f"/api/v1/plugins/00000000-0000-0000-0000-000000000000",
            json={"version": "2.0.0"}, headers=headers,
        )
        assert res.status_code == 404

    # --- delete_plugin ---

    async def test_delete_plugin_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        pid = await self._create_plugin(client, headers, "DelCov")
        res = await client.delete(f"/api/v1/plugins/{pid}", headers=headers)
        assert res.status_code == 204

    async def test_delete_plugin_requires_auth(self, client: AsyncClient):
        res = await client.delete(f"/api/v1/plugins/{uuid.uuid4()}")
        assert res.status_code == 401

    async def test_delete_plugin_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.delete(f"/api/v1/plugins/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 401

    async def test_delete_plugin_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.delete(
            f"/api/v1/plugins/00000000-0000-0000-0000-000000000000", headers=headers,
        )
        assert res.status_code == 404

    # --- execute_plugin ---

    async def test_execute_plugin_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        pid = await self._create_plugin(client, headers, "ExecCov")
        res = await client.post(f"/api/v1/plugins/{pid}/execute", json={"code": "result = 42"}, headers=headers)
        assert res.status_code == 200
        assert "id" in res.json()

    async def test_execute_plugin_requires_auth(self, client: AsyncClient):
        res = await client.post(f"/api/v1/plugins/{uuid.uuid4()}/execute", json={"code": "x=1"})
        assert res.status_code == 401

    async def test_execute_plugin_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.post(
            f"/api/v1/plugins/{uuid.uuid4()}/execute", json={"code": "x=1"}, headers=headers,
        )
        assert res.status_code == 401

    async def test_execute_plugin_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post(
            f"/api/v1/plugins/00000000-0000-0000-0000-000000000000/execute",
            json={"code": "x=1"}, headers=headers,
        )
        assert res.status_code == 404

    # --- get_plugin_permissions ---

    async def test_get_permissions_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        pid = await self._create_plugin(client, headers, "PermCov")
        res = await client.get(f"/api/v1/plugins/{pid}/permissions", headers=headers)
        assert res.status_code == 200
        assert "permissions" in res.json()

    async def test_get_permissions_requires_auth(self, client: AsyncClient):
        res = await client.get(f"/api/v1/plugins/{uuid.uuid4()}/permissions")
        assert res.status_code == 401

    async def test_get_permissions_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.get(f"/api/v1/plugins/{uuid.uuid4()}/permissions", headers=headers)
        assert res.status_code == 401

    async def test_get_permissions_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            f"/api/v1/plugins/00000000-0000-0000-0000-000000000000/permissions", headers=headers,
        )
        assert res.status_code == 404

    # --- list_plugin_executions ---

    async def test_list_executions_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        pid = await self._create_plugin(client, headers, "ExecListCov")
        res = await client.get(f"/api/v1/plugins/{pid}/executions", headers=headers)
        assert res.status_code == 200
        assert "executions" in res.json()

    async def test_list_executions_requires_auth(self, client: AsyncClient):
        res = await client.get(f"/api/v1/plugins/{uuid.uuid4()}/executions")
        assert res.status_code == 401

    async def test_list_executions_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.get(f"/api/v1/plugins/{uuid.uuid4()}/executions", headers=headers)
        assert res.status_code == 401
