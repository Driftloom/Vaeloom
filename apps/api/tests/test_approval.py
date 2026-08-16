import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestApproval:
    async def _auth_header(self, client: AsyncClient, email: str = "appr@test.com") -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": email, "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_request_approval(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/approvals", json={
            "agent_name": "email-sender",
            "action_type": "send_email",
            "payload": {"to": "user@example.com", "subject": "Hi"},
            "reason": "Send marketing email",
        }, headers=headers)
        assert res.status_code == 201
        body = res.json()
        assert body["status"] == "PENDING"
        assert body["agent_name"] == "email-sender"
        assert body["action_type"] == "send_email"
        assert body["payload"]["subject"] == "Hi"
        assert body["expires_at"] is not None

    async def test_request_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/approvals", json={
            "agent_name": "a", "action_type": "b",
        })
        assert res.status_code == 401

    async def test_list_approvals_filters_status(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await client.post("/api/v1/approvals", json={
            "agent_name": "a", "action_type": "run",
        }, headers=headers)
        res = await client.get("/api/v1/approvals?status=PENDING", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["total"] == 1
        assert body["items"][0]["status"] == "PENDING"

    async def test_approve_and_reject(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/approvals", json={
            "agent_name": "a", "action_type": "run", "reason": "needs ok",
        }, headers=headers)
        aid = created.json()["id"]

        approved = await client.post(f"/api/v1/approvals/{aid}/approve", json={
            "note": "looks good",
        }, headers=headers)
        assert approved.status_code == 200
        assert approved.json()["status"] == "APPROVED"
        assert approved.json()["decision_note"] == "looks good"

        rejected = await client.post(f"/api/v1/approvals/{aid}/reject", headers=headers)
        assert rejected.status_code == 409

    async def test_approve_then_cannot_approve_again(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/approvals", json={
            "agent_name": "a", "action_type": "run",
        }, headers=headers)
        aid = created.json()["id"]
        await client.post(f"/api/v1/approvals/{aid}/approve", headers=headers)
        second = await client.post(f"/api/v1/approvals/{aid}/approve", headers=headers)
        assert second.status_code == 409

    async def test_get_approval_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/approvals/00000000-0000-0000-0000-000000000000",
            headers=headers,
        )
        assert res.status_code == 404

    async def test_expired_approval(self, client: AsyncClient, db_session):
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import text

        headers = await self._auth_header(client)
        created = await client.post("/api/v1/approvals", json={
            "agent_name": "a", "action_type": "run", "expires_in_minutes": 1,
        }, headers=headers)
        aid = created.json()["id"]

        await db_session.execute(
            text("UPDATE agent_approvals SET expires_at = :t WHERE id = :id"),
            {"t": datetime.now(timezone.utc) - timedelta(hours=1), "id": aid},
        )
        await db_session.commit()

        res = await client.get(f"/api/v1/approvals/{aid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["status"] == "EXPIRED"

    async def test_decision_audited(self, client: AsyncClient, db_session):
        from sqlalchemy import text

        headers = await self._auth_header(client)
        created = await client.post("/api/v1/approvals", json={
            "agent_name": "a", "action_type": "run",
        }, headers=headers)
        aid = created.json()["id"]
        await client.post(f"/api/v1/approvals/{aid}/approve", headers=headers)

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM audit_events WHERE action = 'approval.approve'")
        )
        assert result.scalar_one() == 1
