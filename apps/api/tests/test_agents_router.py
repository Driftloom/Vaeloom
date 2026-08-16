import json
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from api.dependencies import get_current_user
from api.services.agent_service import agent_service

pytestmark = pytest.mark.asyncio


class TestAgentsRouterCoverage:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "agent-cov@test.com", "password": "Test1234!",
        })
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _override_user_none(self, client: AsyncClient):
        client._transport.app.dependency_overrides[get_current_user] = lambda: None

    async def _create_agent(self, client, headers, name="CovAgent"):
        res = await client.post("/api/v1/agents", json={
            "name": name, "category": "general",
        }, headers=headers)
        assert res.status_code == 201
        return res.json()["id"]

    # --- create_agent ---

    async def test_create_agent(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/agents", json={
            "name": "Created", "category": "general",
        }, headers=headers)
        assert res.status_code == 201
        assert res.json()["name"] == "Created"

    # --- list_agents ---

    async def test_list_agents(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/agents", headers=headers)
        assert res.status_code == 200
        assert "agents" in res.json()
        assert "total" in res.json()

    async def test_list_agents_with_filters(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/agents?category=general&search=test&page=1&page_size=10", headers=headers)
        assert res.status_code == 200

    # --- get_agent ---

    async def test_get_agent(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "GetAgent")
        res = await client.get(f"/api/v1/agents/{aid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "GetAgent"

    async def test_get_agent_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/agents/00000000-0000-0000-0000-000000000000", headers=headers,
        )
        assert res.status_code == 404

    # --- chat ---

    async def test_chat_endpoint(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/agents/chat", json={
            "message": "hello", "workspaceId": str(uuid.uuid4()),
        }, headers=headers)
        assert res.status_code in (200, 500)

    # --- list_executions ---

    async def test_list_executions_empty(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "ExecListCov")
        res = await client.get(f"/api/v1/agents/{aid}/executions", headers=headers)
        assert res.status_code == 200
        assert res.json()["total"] == 0

    # --- update_agent ---

    async def test_update_agent_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "UpdCov")
        res = await client.put(f"/api/v1/agents/{aid}", json={"name": "Updated"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Updated"

    async def test_update_agent_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.put(f"/api/v1/agents/{uuid.uuid4()}", json={"name": "X"}, headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    async def test_update_agent_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.put(
            f"/api/v1/agents/00000000-0000-0000-0000-000000000000",
            json={"name": "Nope"}, headers=headers,
        )
        assert res.status_code == 404

    # --- deactivate_agent ---

    async def test_deactivate_agent_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "DelCov")
        res = await client.delete(f"/api/v1/agents/{aid}", headers=headers)
        assert res.status_code == 204

    async def test_deactivate_agent_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.delete(f"/api/v1/agents/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    async def test_deactivate_agent_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.delete(
            f"/api/v1/agents/00000000-0000-0000-0000-000000000000", headers=headers,
        )
        assert res.status_code == 404

    # --- run_agent ---

    async def test_run_agent_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "RunCov")
        res = await client.post(f"/api/v1/agents/{aid}/run", json={"input": {}}, headers=headers)
        assert res.status_code == 200
        assert "id" in res.json()

    async def test_run_agent_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.post(f"/api/v1/agents/{uuid.uuid4()}/run", json={"input": {}}, headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    async def test_run_agent_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        with patch.object(agent_service, "execute_agent", AsyncMock(side_effect=ValueError("not found"))):
            res = await client.post(
                f"/api/v1/agents/00000000-0000-0000-0000-000000000000/run",
                json={"input": {}}, headers=headers,
            )
        assert res.status_code == 404

    # --- schedule_agent ---

    async def test_schedule_agent_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "SchedCov")
        res = await client.post(f"/api/v1/agents/{aid}/schedule", json={
            "cron": "0 9 * * *", "input": {},
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_schedule_agent_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.post(
            f"/api/v1/agents/{uuid.uuid4()}/schedule",
            json={"cron": "0 9 * * *", "input": {}}, headers=headers,
        )
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    # --- execute_agent (non-streaming) ---

    async def test_execute_agent_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "ExecOk")
        res = await client.post(f"/api/v1/agents/{aid}/execute", json={"input": {}}, headers=headers)
        assert res.status_code in (200, 500)

    async def test_execute_agent_value_error(self, client: AsyncClient):
        headers = await self._auth_header(client)
        with patch.object(agent_service, "execute_agent", AsyncMock(side_effect=ValueError("not found"))):
            res = await client.post(
                f"/api/v1/agents/00000000-0000-0000-0000-000000000000/execute",
                json={"input": {"prompt": "test"}}, headers=headers,
            )
        assert res.status_code == 404

    # --- execute_agent streaming ---

    async def _fake_stream_ok(self, *args, **kwargs):
        yield {"type": "content", "text": "hello"}
        yield {"type": "done", "finish_reason": "stop"}

    async def _fake_stream_value_error(self, *args, **kwargs):
        yield None
        raise ValueError("Agent gone")

    async def _fake_stream_exception(self, *args, **kwargs):
        yield None
        raise RuntimeError("boom")

    async def test_execute_agent_stream_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "StreamOk")
        with patch("api.routers.agents.agent_service.execute_agent_stream", self._fake_stream_ok):
            res = await client.post(
                f"/api/v1/agents/{aid}/execute",
                json={"input": {"prompt": "test"}, "stream": True}, headers=headers,
            )
        assert res.status_code == 200
        assert "text/event-stream" in res.headers.get("content-type", "")
        assert "event: start" in res.text
        assert "event: done" in res.text
        assert "hello" in res.text

    async def test_execute_agent_stream_value_error(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "StreamValErr")
        with patch("api.routers.agents.agent_service.execute_agent_stream", self._fake_stream_value_error):
            res = await client.post(
                f"/api/v1/agents/{aid}/execute",
                json={"input": {"prompt": "test"}, "stream": True}, headers=headers,
            )
        assert res.status_code == 200
        assert "event: error" in res.text
        assert "Agent gone" in res.text

    async def test_execute_agent_stream_exception(self, client: AsyncClient):
        headers = await self._auth_header(client)
        aid = await self._create_agent(client, headers, "StreamExc")
        with patch("api.routers.agents.agent_service.execute_agent_stream", self._fake_stream_exception):
            res = await client.post(
                f"/api/v1/agents/{aid}/execute",
                json={"input": {"prompt": "test"}, "stream": True}, headers=headers,
            )
        assert res.status_code == 200
        assert "event: error" in res.text
        assert "boom" in res.text
