import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestResumes:
    async def _auth_and_ws(self, client: AsyncClient) -> tuple[dict, uuid.UUID]:
        res = await client.post("/api/v1/auth/signup", json={
            "email": f"res-{uuid.uuid4().hex[:6]}@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        ws = await client.post("/api/v1/workspaces", json={"name": "res-ws"}, headers=headers)
        ws_id = uuid.UUID(ws.json()["id"])
        return headers, ws_id

    async def test_list_resumes(self, client: AsyncClient):
        headers, ws_id = await self._auth_and_ws(client)
        res = await client.get(
            f"/api/v1/resumes?workspace_id={ws_id}",
            headers=headers,
        )
        assert res.status_code == 200

    async def test_get_master_not_found(self, client: AsyncClient):
        headers, ws_id = await self._auth_and_ws(client)
        res = await client.get(
            f"/api/v1/resumes/master?workspace_id={ws_id}",
            headers=headers,
        )
        assert res.status_code == 404

    async def test_resume_requires_workspace_id(self, client: AsyncClient):
        headers, _ = await self._auth_and_ws(client)
        res = await client.get("/api/v1/resumes", headers=headers)
        assert res.status_code == 400

    async def test_get_master_resume_unseeded(self, client: AsyncClient):
        headers, ws_id = await self._auth_and_ws(client)
        res = await client.get(
            f"/api/v1/resumes/master?workspace_id={ws_id}",
            headers=headers,
        )
        assert res.status_code == 404

    async def test_generate_resume(self, client: AsyncClient):
        headers, ws_id = await self._auth_and_ws(client)
        res = await client.post(
            f"/api/v1/resumes/{uuid.uuid4()}/generate",
            json={"job_description": "Software Engineer", "variant_type": "standard"},
            headers=headers,
        )
        assert res.status_code == 404

    async def test_get_master_resume_found(self, client: AsyncClient, db_session):
        headers, ws_id = await self._auth_and_ws(client)
        from api.models.schema import Resume
        resume = Resume(
            id=uuid.uuid4(),
            workspace_id=ws_id,
            variant_type="master",
            content={},
            version=1,
        )
        db_session.add(resume)
        await db_session.commit()
        res = await client.get(
            f"/api/v1/resumes/master?workspace_id={ws_id}",
            headers=headers,
        )
        assert res.status_code == 200
        assert res.json()["variant_type"] == "master"

    async def test_generate_resume_success(self, client: AsyncClient, db_session):
        headers, ws_id = await self._auth_and_ws(client)
        from api.models.schema import Resume
        resume = Resume(
            id=uuid.uuid4(),
            workspace_id=ws_id,
            variant_type="master",
            content={},
            version=1,
        )
        db_session.add(resume)
        await db_session.commit()
        res = await client.post(
            f"/api/v1/resumes/{resume.id}/generate",
            json={"job_description": "Software Engineer", "variant_type": "standard"},
            headers=headers,
        )
        assert res.status_code == 200
        assert "id" in res.json()
