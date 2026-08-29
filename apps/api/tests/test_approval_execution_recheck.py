import uuid

import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import text

pytestmark = pytest.mark.asyncio


def _utc(**kw):
    return datetime.now(timezone.utc).replace(**kw) if kw else datetime.now(timezone.utc)


class TestApprovalExecutionRecheck:
    """ZT-02: execute_approved_action must re-validate the approval's CURRENT
    authorization at execution time, not trust the stored state."""

    async def _auth_header(self, client, email="zt02@test.com"):
        res = await client.post("/api/v1/auth/signup", json={
            "email": email, "password": "Test1234!",
        })
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _seed_approved(self, client, headers, action_type="send_email", expires_in_minutes=60):
        created = await client.post("/api/v1/approvals", json={
            "agent_name": "email-sender",
            "action_type": action_type,
            "payload": {"to": "x@y.com"},
            "expires_in_minutes": expires_in_minutes,
        }, headers=headers)
        aid = created.json()["id"]
        await client.post(f"/api/v1/approvals/{aid}/approve", json={"note": "ok"}, headers=headers)
        return aid

    async def _seed_direct(self, db_session, *, status="APPROVED", action_type="send_email",
                           agent_name="email-sender", workspace_id=None, requested_by=None,
                           expires_at=None):
        aid = str(uuid.uuid4())
        if expires_at is None:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db_session.execute(
            text("""
                INSERT INTO agent_approvals
                    (id, workspace_id, agent_name, action_type, payload, reason, status,
                     requested_by, expires_at, created_at, updated_at)
                VALUES
                    (:id, :ws, :agent, :action, :payload, :reason, :status,
                     :requested_by, :expires_at, :now, :now)
            """),
            {
                "id": aid,
                "ws": workspace_id,
                "agent": agent_name,
                "action": action_type,
                "payload": "{}",
                "reason": "seed",
                "status": status,
                "requested_by": requested_by,
                "expires_at": expires_at,
                "now": datetime.now(timezone.utc),
            },
        )
        await db_session.commit()
        return aid

    async def test_approved_executes(self, client, db_session):
        from api.temporal.activities import _revalidate_approval_for_execution

        headers = await self._auth_header(client)
        aid = await self._seed_approved(client, headers)
        result = await _revalidate_approval_for_execution(db_session, aid, {"decision": "APPROVED"})
        assert result["ok"] is True, result

    async def test_rejected_refused(self, client, db_session):
        from api.temporal.activities import _revalidate_approval_for_execution

        headers = await self._auth_header(client)
        created = await client.post("/api/v1/approvals", json={
            "agent_name": "a", "action_type": "run",
        }, headers=headers)
        aid = created.json()["id"]
        await client.post(f"/api/v1/approvals/{aid}/reject", headers=headers)
        result = await _revalidate_approval_for_execution(db_session, aid, {})
        assert result["ok"] is False
        assert "not approved" in result["error"]

    async def test_expired_refused(self, client, db_session):
        from api.temporal.activities import _revalidate_approval_for_execution

        headers = await self._auth_header(client)
        aid = await self._seed_approved(client, headers, expires_in_minutes=1)
        await db_session.execute(
            text("UPDATE agent_approvals SET expires_at = :t WHERE id = :id"),
            {"t": datetime.now(timezone.utc) - timedelta(hours=1), "id": aid},
        )
        await db_session.commit()
        result = await _revalidate_approval_for_execution(db_session, aid, {})
        assert result["ok"] is False
        assert result["error"] == "approval expired"

    async def test_workspace_mismatch_refused(self, db_session):
        from api.temporal.activities import _revalidate_approval_for_execution

        ws = str(uuid.uuid4())
        aid = await self._seed_direct(db_session, workspace_id=ws, requested_by=None)
        result = await _revalidate_approval_for_execution(
            db_session, aid, {"workspace_id": str(uuid.uuid4())}
        )
        assert result["ok"] is False
        assert result["error"] == "workspace mismatch"

    async def test_action_swap_refused(self, db_session):
        from api.temporal.activities import _revalidate_approval_for_execution

        ws = str(uuid.uuid4())
        aid = await self._seed_direct(db_session, workspace_id=ws, requested_by=None, action_type="send_email")
        result = await _revalidate_approval_for_execution(
            db_session, aid, {"action_type": "delete_workspace"}
        )
        assert result["ok"] is False
        assert result["error"] == "action_type mismatch"

    async def test_permission_revoked_refused(self, db_session):
        from api.temporal.activities import _revalidate_approval_for_execution

        ws = str(uuid.uuid4())
        aid = await self._seed_direct(db_session, workspace_id=ws, requested_by=None, action_type="send_email")
        now = datetime.now(timezone.utc)
        await db_session.execute(
            text(
                "INSERT INTO permissions (id, workspace_id, agent_name, action_type, scope, granted_at, revoked_at) "
                "VALUES (:id, :ws, :agent, :action, 'send', :g, :r)"
            ),
            {
                "id": str(uuid.uuid4()),
                "ws": ws,
                "agent": "email-sender",
                "action": "send_email",
                "g": now,
                "r": now,
            },
        )
        await db_session.commit()
        result = await _revalidate_approval_for_execution(db_session, aid, {})
        assert result["ok"] is False
        assert result["error"] == "permission revoked"
