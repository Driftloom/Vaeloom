import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from backend.dependencies import get_current_user

pytestmark = pytest.mark.asyncio


def _fake_user():
    return {"sub": str(uuid.uuid4()), "tenant_id": None}


class TestWorkspaces:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "ws-cov@test.com", "password": "Test1234!",
        })
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _override_user_none(self, client: AsyncClient):
        client._transport.app.dependency_overrides[get_current_user] = lambda: None

    async def _create_workspace(self, client, headers, name="CovWS"):
        res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
        assert res.status_code == 201
        return res.json()["id"]

    # --- create_workspace ---

    async def test_create_workspace_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/workspaces", json={"name": "WS1"}, headers=headers)
        assert res.status_code == 201
        assert res.json()["name"] == "WS1"
        assert "id" in res.json()

    async def test_create_workspace_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.post("/api/v1/workspaces", json={"name": "NoAuth"}, headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    async def test_create_workspace_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/workspaces", json={"name": "NoAuth"})
        assert res.status_code == 401

    # --- list_workspaces ---

    async def test_list_workspaces_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._create_workspace(client, headers, "ListWS")
        res = await client.get("/api/v1/workspaces", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1

    async def test_list_workspaces_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.get("/api/v1/workspaces", headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    # --- get_workspace ---

    async def test_get_workspace_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wid = await self._create_workspace(client, headers, "GetWS")
        res = await client.get(f"/api/v1/workspaces/{wid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "GetWS"

    async def test_get_workspace_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            f"/api/v1/workspaces/00000000-0000-0000-0000-000000000000", headers=headers,
        )
        assert res.status_code == 404

    async def test_get_workspace_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.get(f"/api/v1/workspaces/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    # --- update_workspace ---

    async def test_update_workspace_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wid = await self._create_workspace(client, headers, "Before")
        res = await client.patch(f"/api/v1/workspaces/{wid}", json={"name": "After"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "After"

    async def test_update_workspace_description(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wid = await self._create_workspace(client, headers, "DescWS")
        res = await client.patch(f"/api/v1/workspaces/{wid}", json={"description": "New description"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["description"] == "New description"

    async def test_update_workspace_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.patch(
            f"/api/v1/workspaces/00000000-0000-0000-0000-000000000000",
            json={"name": "Nope"}, headers=headers,
        )
        assert res.status_code == 404

    async def test_update_workspace_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.patch(f"/api/v1/workspaces/{uuid.uuid4()}", json={"name": "X"}, headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    # --- delete_workspace ---

    async def test_delete_workspace_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wid = await self._create_workspace(client, headers, "DelWS")
        res = await client.delete(f"/api/v1/workspaces/{wid}", headers=headers)
        assert res.status_code == 204

    async def test_delete_workspace_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.delete(
            f"/api/v1/workspaces/00000000-0000-0000-0000-000000000000", headers=headers,
        )
        assert res.status_code == 404

    async def test_delete_workspace_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.delete(f"/api/v1/workspaces/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    # --- list_workspace_agents ---

    async def test_list_workspace_agents_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wid = await self._create_workspace(client, headers, "AgentsWS")
        res = await client.get(f"/api/v1/workspaces/{wid}/agents", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_list_workspace_agents_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.get(f"/api/v1/workspaces/{uuid.uuid4()}/agents", headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    # --- list_workspace_memories ---

    async def test_list_workspace_memories_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wid = await self._create_workspace(client, headers, "MemWS")
        res = await client.get(f"/api/v1/workspaces/{wid}/memories", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_list_workspace_memories_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.get(f"/api/v1/workspaces/{uuid.uuid4()}/memories", headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()

    # --- list_workspace_connectors ---

    async def test_list_workspace_connectors_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        wid = await self._create_workspace(client, headers, "ConnWS")
        res = await client.get(f"/api/v1/workspaces/{wid}/connectors", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_list_workspace_connectors_returns_401_when_no_user(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._override_user_none(client)
        res = await client.get(f"/api/v1/workspaces/{uuid.uuid4()}/connectors", headers=headers)
        assert res.status_code == 401
        assert "not authenticated" in res.json()["error"]["message"].lower()
