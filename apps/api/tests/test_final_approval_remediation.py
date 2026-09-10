"""FINAL zero-trust remediation regression (FINAL-02/03).

Approval workspace binding + atomic decide. Lives at tests/ root because
the security-suite test app does not mount the approvals router.
"""

import pytest
from httpx import AsyncClient

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


class TestFinal02ApprovalWorkspaceBinding:
    async def test_list_with_foreign_workspace_returns_empty(
        self, client: AsyncClient
    ):
        ha = await _signup(client, "final-aa@test.com")
        hb = await _signup(client, "final-ab@test.com")
        ws_a = await _make_workspace(client, ha, "A ws")
        created = await client.post(
            "/api/v1/approvals",
            json={"agent_name": "a", "action_type": "run", "workspace_id": ws_a},
            headers=ha,
        )
        assert created.status_code == 201, created.text
        res = await client.get(
            "/api/v1/approvals", params={"workspace_id": ws_a}, headers=hb
        )
        assert res.status_code == 200, res.text
        assert res.json()["total"] == 0

    async def test_request_with_foreign_workspace_rejected(
        self, client: AsyncClient
    ):
        ha = await _signup(client, "final-ac@test.com")
        hb = await _signup(client, "final-ad@test.com")
        ws_a = await _make_workspace(client, ha, "A ws")
        res = await client.post(
            "/api/v1/approvals",
            json={"agent_name": "a", "action_type": "run", "workspace_id": ws_a},
            headers=hb,
        )
        assert res.status_code == 404, res.text


class TestFinal03ConcurrentDecide:
    async def test_sequential_double_decide_rejected(self, client: AsyncClient):
        h = await _signup(client, "final-ca@test.com")
        created = await client.post(
            "/api/v1/approvals",
            json={"agent_name": "a", "action_type": "run"},
            headers=h,
        )
        assert created.status_code == 201, created.text
        aid = created.json()["id"]
        first = await client.post(
            f"/api/v1/approvals/{aid}/approve", json={"note": "one"}, headers=h
        )
        assert first.status_code == 200, first.text
        second = await client.post(
            f"/api/v1/approvals/{aid}/approve", json={"note": "two"}, headers=h
        )
        assert second.status_code == 409, second.text

    async def test_stale_reader_decide_rejected(
        self, client: AsyncClient, db_session, db_path
    ):
        """Simulate the TOCTOU interleaving deterministically.

        A second session commits a decision first; the first session's
        subsequent decide must 409 rather than overwrite. The shared-session
        HTTP fixture cannot run a true same-connection race (SQLAlchemy
        forbids concurrent ops on one session), so the atomic
        UPDATE..WHERE status='PENDING' + rowcount guard is additionally
        verified by code re-audit; a live-PG same-row race remains UNVERIFIED.
        """
        import uuid

        from fastapi import HTTPException
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
        from sqlalchemy.pool import NullPool

        from api.services.approval import ApprovalManager

        h = await _signup(client, "final-cc@test.com")
        actor = str(uuid.uuid5(uuid.NAMESPACE_DNS, "final-cc@test.com"))
        # Resolve the real actor id from the approval created via HTTP.
        created = await client.post(
            "/api/v1/approvals",
            json={"agent_name": "a", "action_type": "run"},
            headers=h,
        )
        assert created.status_code == 201, created.text
        aid = created.json()["id"]
        requested_by = created.json()["requested_by"]

        mgr = ApprovalManager()
        engine2 = create_async_engine(f"sqlite+aiosqlite:///{db_path}", poolclass=NullPool)
        try:
            maker2 = async_sessionmaker(engine2, expire_on_commit=False)
            async with maker2() as s2:
                # Rival decider commits first on an independent connection.
                await mgr.decide(aid, "APPROVED", requested_by, "rival", s2, user_workspaces=None)
                await s2.commit()
            # Stale first session attempts to decide over it -> must 409.
            with pytest.raises(HTTPException) as exc:
                await mgr.decide(aid, "REJECTED", requested_by, "stale", db_session, user_workspaces=None)
            assert exc.value.status_code == 409
        finally:
            await engine2.dispose()
