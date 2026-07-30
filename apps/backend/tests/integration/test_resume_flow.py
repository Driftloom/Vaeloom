import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


class TestResumeFlow:
    """Integration: create resume → generate variant → list variants."""

    WORKSPACE_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

    async def _seed_master_resume(self, db_session: AsyncSession, workspace_id: uuid.UUID):
        from backend.models.schema import Resume

        resume = Resume(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            variant_type="master",
            content={"basics": {"name": "Test User", "email": "test@test.com"}, "skills": ["Python"]},
            version=1,
        )
        db_session.add(resume)
        await db_session.commit()
        return resume.id

    async def test_list_resumes_empty(self, client: AsyncClient, auth_headers: dict):
        res = await client.get(
            f"/api/v1/resumes?workspace_id={self.WORKSPACE_ID}",
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_get_master_not_found(self, client: AsyncClient, auth_headers: dict):
        res = await client.get(
            f"/api/v1/resumes/master?workspace_id={self.WORKSPACE_ID}",
            headers=auth_headers,
        )
        assert res.status_code == 404

    async def test_create_master_then_get(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        resume_id = await self._seed_master_resume(db_session, self.WORKSPACE_ID)

        res = await client.get(
            f"/api/v1/resumes/master?workspace_id={self.WORKSPACE_ID}",
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json()["variant_type"] == "master"
        assert res.json()["id"] == str(resume_id)

    async def test_generate_variant_from_master(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        resume_id = await self._seed_master_resume(db_session, self.WORKSPACE_ID)

        res = await client.post(
            f"/api/v1/resumes/{resume_id}/generate",
            json={"variant_type": "tailored", "job_description": "Senior Engineer"},
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["variant_type"] == "tailored"
        assert data["workspace_id"] == str(self.WORKSPACE_ID)
        assert data["version"] == 2

    async def test_generate_variant_not_found(
        self, client: AsyncClient, auth_headers: dict
    ):
        res = await client.post(
            f"/api/v1/resumes/{uuid.uuid4()}/generate",
            json={"variant_type": "standard"},
            headers=auth_headers,
        )
        assert res.status_code == 404

    async def test_list_variants_includes_generated(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        resume_id = await self._seed_master_resume(db_session, self.WORKSPACE_ID)

        await client.post(
            f"/api/v1/resumes/{resume_id}/generate",
            json={"variant_type": "tailored", "job_description": "Engineer"},
            headers=auth_headers,
        )
        await client.post(
            f"/api/v1/resumes/{resume_id}/generate",
            json={"variant_type": "standard", "job_description": "Manager"},
            headers=auth_headers,
        )

        res = await client.get(
            f"/api/v1/resumes?workspace_id={self.WORKSPACE_ID}",
            headers=auth_headers,
        )
        assert res.status_code == 200
        variants = res.json()
        assert len(variants) >= 3  # master + 2 variants

    async def test_resume_requires_workspace_id(
        self, client: AsyncClient, auth_headers: dict
    ):
        res = await client.get("/api/v1/resumes", headers=auth_headers)
        assert res.status_code == 400
