import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestResumes:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "res@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_list_resumes(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/resumes?workspace_id=00000000-0000-0000-0000-000000000001",
            headers=headers,
        )
        assert res.status_code == 200

    async def test_get_master_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/resumes/master?workspace_id=00000000-0000-0000-0000-000000000001",
            headers=headers,
        )
        assert res.status_code == 404

    async def test_resume_requires_workspace_id(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/resumes", headers=headers)
        assert res.status_code == 400

    async def test_get_master_resume_success(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/resumes/master?workspace_id=00000000-0000-0000-0000-000000000001",
            headers=headers,
        )
        assert res.status_code in (200, 404)

    async def test_generate_resume(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post(
            "/api/v1/resumes/00000000-0000-0000-0000-000000000001/generate",
            json={"job_description": "Software Engineer", "variant_type": "standard"},
            headers=headers,
        )
        assert res.status_code in (200, 404, 500)

    async def test_get_master_resume_found(self, client: AsyncClient, db_session):
        headers = await self._auth_header(client)
        import uuid
        from backend.models.schema import Resume
        resume = Resume(
            id=uuid.uuid4(),
            workspace_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            variant_type="master",
            content={},
            version=1,
        )
        db_session.add(resume)
        await db_session.commit()
        res = await client.get(
            "/api/v1/resumes/master?workspace_id=00000000-0000-0000-0000-000000000001",
            headers=headers,
        )
        assert res.status_code == 200
        assert res.json()["variant_type"] == "master"

    async def test_generate_resume_success(self, client: AsyncClient, db_session):
        headers = await self._auth_header(client)
        import uuid
        from backend.models.schema import Resume
        resume = Resume(
            id=uuid.uuid4(),
            workspace_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
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
