import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestApplications:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "apps@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict) -> str:
        res = await client.post("/api/v1/workspaces", json={"name": "App Test Workspace"}, headers=headers)
        assert res.status_code == 201
        return res.json()["id"]

    async def test_list_applications_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/workspaces/00000000-0000-0000-0000-000000000000/applications")
        assert res.status_code == 401

    async def test_create_application(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        res = await client.post(f"/api/v1/workspaces/{ws_id}/applications", json={
            "job_external_id": "ext-123",
            "platform": "linkedin",
            "status": "DRAFT",
        }, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert "id" in data
        assert data["workspace_id"] == ws_id
        assert data["status"] == "DRAFT"
        assert data["job_external_id"] == "ext-123"
        assert data["platform"] == "linkedin"

    async def test_get_application(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        created = await client.post(f"/api/v1/workspaces/{ws_id}/applications", json={
            "job_external_id": "ext-456",
            "platform": "indeed",
            "status": "DRAFT",
        }, headers=headers)
        assert created.status_code == 201
        app_id = created.json()["id"]
        res = await client.get(f"/api/v1/workspaces/{ws_id}/applications/{app_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == app_id
        assert data["workspace_id"] == ws_id
        assert data["status"] == "DRAFT"
        assert data["job_external_id"] == "ext-456"
        assert data["platform"] == "indeed"

    async def test_get_application_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        res = await client.get(
            f"/api/v1/workspaces/{ws_id}/applications/00000000-0000-0000-0000-000000000000",
            headers=headers,
        )
        assert res.status_code == 404

    async def test_list_applications(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        res = await client.get(f"/api/v1/workspaces/{ws_id}/applications", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_update_outcome(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        created = await client.post(f"/api/v1/workspaces/{ws_id}/applications", json={
            "job_external_id": "ext-789",
            "platform": "linkedin",
            "status": "DRAFT",
        }, headers=headers)
        assert created.status_code == 201
        app_id = created.json()["id"]
        res = await client.patch(
            f"/api/v1/workspaces/{ws_id}/applications/{app_id}/outcome",
            json={"status": "accepted"},
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "accepted"
        assert data["id"] == app_id

    async def test_update_outcome_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        res = await client.patch(
            f"/api/v1/workspaces/{ws_id}/applications/00000000-0000-0000-0000-000000000000/outcome",
            json={"status": "accepted"},
            headers=headers,
        )
        assert res.status_code == 404
