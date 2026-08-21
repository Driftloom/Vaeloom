"""Tenant isolation tests — verifies workspace-level data isolation."""
import pytest
from httpx import AsyncClient


async def _create_user_and_get_token(client: AsyncClient, email: str, password: str) -> str:
    """Helper: sign up a user and return their JWT token."""
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


async def _get_user_id(client: AsyncClient, token: str) -> str:
    """Helper: get the user ID from /auth/me."""
    res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    return res.json()["user"]["id"]


@pytest.mark.asyncio
class TestWorkspaceIsolation:
    """Verify users cannot access other users' workspace data."""

    async def test_user_cannot_list_other_users_workspaces(
        self, client: AsyncClient,
    ):
        """User A's workspaces should not appear in User B's list."""
        token_a = await _create_user_and_get_token(client, "isol-a@test.com", "TestPass1234!")
        token_b = await _create_user_and_get_token(client, "isol-b@test.com", "TestPass1234!")

        res = await client.post(
            "/api/v1/workspaces",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"name": "Private Workspace A"},
        )
        assert res.status_code in (200, 201)
        ws_a_id = res.json()["id"]

        res = await client.get(
            "/api/v1/workspaces",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert res.status_code == 200
        workspaces = res.json()
        ws_ids = [ws["id"] for ws in workspaces] if isinstance(workspaces, list) else []
        assert ws_a_id not in ws_ids, "User B can see User A's workspace — isolation breach"

    async def test_user_cannot_access_other_users_workspace_directly(
        self, client: AsyncClient,
    ):
        """GET /workspaces/{id} for another user's workspace should return 404 or 403."""
        token_a = await _create_user_and_get_token(client, "isol-a2@test.com", "TestPass1234!")
        token_b = await _create_user_and_get_token(client, "isol-b2@test.com", "TestPass1234!")

        res = await client.post(
            "/api/v1/workspaces",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"name": "Private Workspace A2"},
        )
        assert res.status_code in (200, 201)
        ws_a_id = res.json()["id"]

        res = await client.get(
            f"/api/v1/workspaces/{ws_a_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert res.status_code in (403, 404), f"Expected 403/404, got {res.status_code}"

    async def test_user_cannot_access_other_users_memories(
        self, client: AsyncClient,
    ):
        """User A's memories should not appear in User B's memory list."""
        token_a = await _create_user_and_get_token(client, "isol-ma@test.com", "TestPass1234!")
        token_b = await _create_user_and_get_token(client, "isol-mb@test.com", "TestPass1234!")

        res = await client.post(
            "/api/v1/memories",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"type": "profile", "content": "Secret memory from user A"},
        )
        assert res.status_code in (200, 201)

        res = await client.get(
            "/api/v1/memories",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert res.status_code == 200
        memories = res.json() if isinstance(res.json(), list) else res.json().get("data", [])
        for mem in memories:
            assert "Secret memory from user A" not in str(mem.get("content", "")), \
                "User B can see User A's memory — isolation breach"

    async def test_user_cannot_modify_other_users_workspace(
        self, client: AsyncClient,
    ):
        """PATCH on another user's workspace should be rejected."""
        token_a = await _create_user_and_get_token(client, "isol-u3@test.com", "TestPass1234!")
        token_b = await _create_user_and_get_token(client, "isol-u4@test.com", "TestPass1234!")

        res = await client.post(
            "/api/v1/workspaces",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"name": "Workspace U3"},
        )
        assert res.status_code in (200, 201)
        ws_id = res.json()["id"]

        res = await client.patch(
            f"/api/v1/workspaces/{ws_id}",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"name": "Hacked Workspace"},
        )
        assert res.status_code in (403, 404), f"Expected 403/404, got {res.status_code}"

    async def test_user_cannot_delete_other_users_workspace(
        self, client: AsyncClient,
    ):
        """DELETE on another user's workspace should be rejected."""
        token_a = await _create_user_and_get_token(client, "isol-d1@test.com", "TestPass1234!")
        token_b = await _create_user_and_get_token(client, "isol-d2@test.com", "TestPass1234!")

        res = await client.post(
            "/api/v1/workspaces",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"name": "Workspace D1"},
        )
        assert res.status_code in (200, 201)
        ws_id = res.json()["id"]

        res = await client.delete(
            f"/api/v1/workspaces/{ws_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert res.status_code in (403, 404), f"Expected 403/404, got {res.status_code}"

    async def test_unauthenticated_user_cannot_access_anything(self, client: AsyncClient):
        """Unauthenticated requests should be rejected on private endpoints."""
        res = await client.get("/api/v1/workspaces")
        assert res.status_code == 401

        res = await client.post(
            "/api/v1/workspaces",
            json={"name": "Should Fail"},
        )
        assert res.status_code == 401
