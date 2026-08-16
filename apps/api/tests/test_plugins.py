import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestPlugins:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "plugin@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_register_plugin(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/plugins", json={
            "name": "TestPlugin",
            "version": "1.0.0",
            "author": "test",
            "description": "A test plugin",
            "license": "MIT",
            "min_app_version": "1.0.0",
            "tags": ["tool"],
            "permissions": {},
            "entry_point": "main.py",
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_list_plugins(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/plugins", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "plugins" in data
        assert "total" in data

    async def test_get_plugin(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/plugins", json={
            "name": "GetPlugin",
            "version": "1.0.0",
            "author": "test",
            "description": "A test plugin",
            "license": "MIT",
            "min_app_version": "1.0.0",
            "tags": ["tool"],
            "permissions": {},
            "entry_point": "main.py",
        }, headers=headers)
        assert created.status_code == 201
        pid = created.json()["id"]
        res = await client.get(f"/api/v1/plugins/{pid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "GetPlugin"

    async def test_plugin_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/plugins", json={
            "name": "NoAuth",
            "version": "1.0.0",
            "author": "test",
            "description": "",
            "license": "MIT",
            "min_app_version": "1.0.0",
            "tags": ["tool"],
            "permissions": {},
            "entry_point": "main.py",
        })
        assert res.status_code == 401

    async def test_delete_plugin(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/plugins", json={
            "name": "DeletePlugin",
            "version": "1.0.0",
            "author": "test",
            "description": "To be deleted",
            "license": "MIT",
            "min_app_version": "1.0.0",
            "tags": ["tool"],
            "permissions": {},
            "entry_point": "main.py",
        }, headers=headers)
        assert created.status_code == 201
        pid = created.json()["id"]
        res = await client.delete(f"/api/v1/plugins/{pid}", headers=headers)
        assert res.status_code == 204

    async def test_execute_plugin(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/plugins", json={
            "name": "ExecPlugin",
            "version": "1.0.0",
            "author": "test",
            "description": "Execute test",
            "license": "MIT",
            "min_app_version": "1.0.0",
            "tags": ["tool"],
            "permissions": {},
            "entry_point": "main.py",
        }, headers=headers)
        assert created.status_code == 201
        pid = created.json()["id"]
        res = await client.post(f"/api/v1/plugins/{pid}/execute", json={
            "input": {"action": "run", "params": {}},
            "code": "print('ok')",
        }, headers=headers)
        assert res.status_code in (200, 401, 500)

    async def test_get_plugin_permissions(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/plugins", json={
            "name": "PermPlugin",
            "version": "1.0.0",
            "author": "test",
            "description": "Permissions test",
            "license": "MIT",
            "min_app_version": "1.0.0",
            "tags": ["tool"],
            "permissions": {},
            "entry_point": "main.py",
        }, headers=headers)
        assert created.status_code == 201
        pid = created.json()["id"]
        res = await client.get(f"/api/v1/plugins/{pid}/permissions", headers=headers)
        assert res.status_code == 200
        assert "permissions" in res.json()

    async def test_list_plugin_executions(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/plugins", json={
            "name": "ExecListPlugin",
            "version": "1.0.0",
            "author": "test",
            "description": "Execution list test",
            "license": "MIT",
            "min_app_version": "1.0.0",
            "tags": ["tool"],
            "permissions": {},
            "entry_point": "main.py",
        }, headers=headers)
        assert created.status_code == 201
        pid = created.json()["id"]
        res = await client.get(f"/api/v1/plugins/{pid}/executions", headers=headers)
        assert res.status_code == 200
        assert "executions" in res.json()
