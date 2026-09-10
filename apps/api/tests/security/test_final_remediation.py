"""FINAL zero-trust remediation regression (FINAL-01).

Proves the resumes workspace-isolation fix applied in the final
end-to-end verification:
- FINAL-01: resumes list/master/generate enforce workspace membership

Approval fixes (FINAL-02/03) are covered in tests/test_final_approval_remediation.py
(the security-suite test app does not mount the approvals router).
FINAL-04 is covered by code re-audit (execute_approved_action consume gate);
a direct execution test is omitted because the activity binds the
process-global session factory and would touch the configured live DB.
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


async def _signup(client: AsyncClient, email: str) -> dict:
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "Test1234!"},
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def _make_workspace(client: AsyncClient, headers: dict, name: str) -> str:
    res = await client.post(
        "/api/v1/workspaces", json={"name": name}, headers=headers
    )
    assert res.status_code in (200, 201), res.text
    return res.json()["id"]


async def _seed_resume(db_session: AsyncSession, workspace_id: str, variant: str = "master"):
    from api.models.schema import Resume

    row = Resume(
        workspace_id=uuid.UUID(workspace_id),
        variant_type=variant,
        content={"name": "Alice", "title": "Engineer"},
        version=1,
    )
    db_session.add(row)
    await db_session.commit()
    await db_session.refresh(row)
    return row


class TestFinal01ResumeIsolation:
    async def test_list_foreign_workspace_forbidden(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        ha = await _signup(client, "final-ra@test.com")
        hb = await _signup(client, "final-rb@test.com")
        ws_a = await _make_workspace(client, ha, "A ws")
        await _seed_resume(db_session, ws_a)
        res = await client.get(
            "/api/v1/resumes", params={"workspace_id": ws_a}, headers=hb
        )
        assert res.status_code == 404, res.text

    async def test_list_own_workspace_allowed(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        ha = await _signup(client, "final-rc@test.com")
        ws_a = await _make_workspace(client, ha, "A ws")
        await _seed_resume(db_session, ws_a)
        res = await client.get(
            "/api/v1/resumes", params={"workspace_id": ws_a}, headers=ha
        )
        assert res.status_code == 200, res.text
        assert len(res.json()) == 1

    async def test_master_foreign_workspace_forbidden(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        ha = await _signup(client, "final-rd@test.com")
        hb = await _signup(client, "final-re@test.com")
        ws_a = await _make_workspace(client, ha, "A ws")
        await _seed_resume(db_session, ws_a, "master")
        res = await client.get(
            "/api/v1/resumes/master", params={"workspace_id": ws_a}, headers=hb
        )
        assert res.status_code == 404, res.text

    async def test_generate_foreign_resume_forbidden(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        ha = await _signup(client, "final-rf@test.com")
        hb = await _signup(client, "final-rg@test.com")
        ws_a = await _make_workspace(client, ha, "A ws")
        row = await _seed_resume(db_session, ws_a, "master")
        res = await client.post(
            f"/api/v1/resumes/{row.id}/generate",
            json={"variant_type": "tailored"},
            headers=hb,
        )
        assert res.status_code == 404, res.text

    async def test_generate_own_resume_allowed(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        ha = await _signup(client, "final-rh@test.com")
        ws_a = await _make_workspace(client, ha, "A ws")
        row = await _seed_resume(db_session, ws_a, "master")
        res = await client.post(
            f"/api/v1/resumes/{row.id}/generate",
            json={"variant_type": "tailored"},
            headers=ha,
        )
        assert res.status_code == 200, res.text

