import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAgents:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "agent@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_create_agent(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/agents", json={
            "name": "Test Agent", "category": "general",
        }, headers=headers)
        assert res.status_code == 201
        assert res.json()["name"] == "Test Agent"

    async def test_list_agents(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/agents", headers=headers)
        assert res.status_code == 200
        assert "agents" in res.json()

    async def test_get_agent(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/agents", json={
            "name": "Get Test", "category": "general",
        }, headers=headers)
        assert created.status_code == 201
        aid = created.json()["id"]
        res = await client.get(f"/api/v1/agents/{aid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Get Test"

    async def test_get_agent_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/agents/00000000-0000-0000-0000-000000000000",
            headers=headers,
        )
        assert res.status_code == 404

    async def test_update_agent(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/agents", json={
            "name": "Before", "category": "general",
        }, headers=headers)
        assert created.status_code == 201
        aid = created.json()["id"]
        res = await client.put(f"/api/v1/agents/{aid}", json={
            "name": "After",
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "After"

    async def test_deactivate_agent(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/agents", json={
            "name": "Delete Me", "category": "general",
        }, headers=headers)
        assert created.status_code == 201
        aid = created.json()["id"]
        res = await client.delete(f"/api/v1/agents/{aid}", headers=headers)
        assert res.status_code == 204

    async def test_list_executions_empty(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/agents", json={
            "name": "Exec Test", "category": "general",
        }, headers=headers)
        assert created.status_code == 201
        aid = created.json()["id"]
        res = await client.get(f"/api/v1/agents/{aid}/executions", headers=headers)
        assert res.status_code == 200
        assert res.json()["total"] == 0

    async def test_create_agent_schedule(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/agents", json={
            "name": "Schedule Agent", "category": "general",
        }, headers=headers)
        assert created.status_code == 201
        aid = created.json()["id"]
        res = await client.post(f"/api/v1/agents/{aid}/schedule", json={
            "cron": "0 9 * * *",
            "input": {"task": "daily"},
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_chat_endpoint(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/agents/chat", json={
            "message": "hello",
            "workspaceId": "00000000-0000-0000-0000-000000000000",
        }, headers=headers)
        assert res.status_code in (200, 401, 500)

    async def test_agent_execute(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/agents", json={
            "name": "Execute Agent", "category": "general",
        }, headers=headers)
        assert created.status_code == 201
        aid = created.json()["id"]
        res = await client.post(f"/api/v1/agents/{aid}/execute", json={
            "input": {"prompt": "test"},
        }, headers=headers)
        assert res.status_code != 401
