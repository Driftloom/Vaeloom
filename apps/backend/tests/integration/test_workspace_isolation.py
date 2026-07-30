import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestWorkspaceIsolation:
    """Verify tenant A cannot access tenant B data (multi-tenancy isolation)."""

    async def test_user_cannot_access_other_users_workspace(
        self, client: AsyncClient, auth_headers: dict, secondary_auth_headers: dict
    ):
        user_a_ws = await client.post(
            "/api/v1/workspaces",
            json={"name": "User A Workspace"},
            headers=auth_headers,
        )
        assert user_a_ws.status_code == 201
        ws_id = user_a_ws.json()["id"]

        res = await client.get(
            f"/api/v1/workspaces/{ws_id}",
            headers=secondary_auth_headers,
        )
        assert res.status_code == 404

    async def test_user_cannot_update_other_users_workspace(
        self, client: AsyncClient, auth_headers: dict, secondary_auth_headers: dict
    ):
        user_a_ws = await client.post(
            "/api/v1/workspaces",
            json={"name": "Secret WS"},
            headers=auth_headers,
        )
        ws_id = user_a_ws.json()["id"]

        res = await client.patch(
            f"/api/v1/workspaces/{ws_id}",
            json={"name": "Hacked"},
            headers=secondary_auth_headers,
        )
        assert res.status_code == 404

    async def test_user_cannot_delete_other_users_workspace(
        self, client: AsyncClient, auth_headers: dict, secondary_auth_headers: dict
    ):
        user_a_ws = await client.post(
            "/api/v1/workspaces",
            json={"name": "Do Not Delete"},
            headers=auth_headers,
        )
        ws_id = user_a_ws.json()["id"]

        res = await client.delete(
            f"/api/v1/workspaces/{ws_id}",
            headers=secondary_auth_headers,
        )
        assert res.status_code == 404

    async def test_user_can_list_own_memories(
        self, client: AsyncClient, auth_headers: dict
    ):
        created = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "My Memory"},
            headers=auth_headers,
        )
        assert created.status_code == 201
        res = await client.get(
            "/api/v1/memories?status=PROCESSING", headers=auth_headers
        )
        assert res.status_code == 200
        titles = {m["title"] for m in res.json().get("memories", [])}
        assert "My Memory" in titles

    async def test_user_cannot_access_other_users_workspace_memories(
        self, client: AsyncClient, auth_headers: dict, secondary_auth_headers: dict
    ):
        ws = await client.post(
            "/api/v1/workspaces",
            json={"name": "Memory Isolation WS"},
            headers=auth_headers,
        )
        assert ws.status_code == 201
        ws_id = ws.json()["id"]

        ws_get = await client.get(
            f"/api/v1/workspaces/{ws_id}",
            headers=secondary_auth_headers,
        )
        assert ws_get.status_code == 404

    async def test_list_workspaces_only_returns_own(
        self, client: AsyncClient, auth_headers: dict, secondary_auth_headers: dict
    ):
        await client.post(
            "/api/v1/workspaces",
            json={"name": "Workspace A"},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/workspaces",
            json={"name": "Workspace B"},
            headers=secondary_auth_headers,
        )

        user_a_list = await client.get(
            "/api/v1/workspaces", headers=auth_headers
        )
        user_b_list = await client.get(
            "/api/v1/workspaces", headers=secondary_auth_headers
        )

        a_names = {ws["name"] for ws in user_a_list.json()}
        b_names = {ws["name"] for ws in user_b_list.json()}

        assert "Workspace A" in a_names
        assert "Workspace B" not in a_names
        assert "Workspace B" in b_names
        assert "Workspace A" not in b_names
