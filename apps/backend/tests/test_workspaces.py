import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestWorkspaces:
    async def _signup_and_login(self, client: AsyncClient) -> str:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "test@test.com",
            "password": "Test1234!",
        })
        return res.json()["access_token"]

    async def test_create_workspace(self, client: AsyncClient):
        token = await self._signup_and_login(client)
        res = await client.post(
            "/api/v1/workspaces",
            json={"name": "My Workspace"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        assert res.json()["name"] == "My Workspace"

    async def test_list_workspaces(self, client: AsyncClient):
        token = await self._signup_and_login(client)
        res = await client.get(
            "/api/v1/workspaces",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        assert len(res.json()) >= 1

    async def test_get_workspace_not_found(self, client: AsyncClient):
        token = await self._signup_and_login(client)
        res = await client.get(
            "/api/v1/workspaces/00000000-0000-0000-0000-000000000000",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 404
