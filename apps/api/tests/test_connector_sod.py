"""Separation-of-duties tests: destructive + insecure ops need workspace admin (CON-SOD-01)."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import User, WorkspaceUser

pytestmark = pytest.mark.asyncio


async def _signup(client: AsyncClient, tag: str):
    email = f"sod-{tag}-{uuid.uuid4().hex[:6]}@test.com"
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "TestPassword123!", "name": "SoD Tester"},
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}, email


async def _user_id(db: AsyncSession, email: str) -> uuid.UUID:
    res = await db.execute(select(User.id).where(User.email == email))
    return res.scalar_one()


async def _add_member(db: AsyncSession, workspace_id: str, user_id: uuid.UUID, role: str = "member"):
    db.add(
        WorkspaceUser(
            workspace_id=uuid.UUID(str(workspace_id)), user_id=user_id, role=role
        )
    )
    await db.commit()


async def _make_connector(client: AsyncClient, headers: dict, extra_config: dict | None = None):
    """Create a connector in the caller's fallback workspace; return (id, workspace_id)."""
    payload = {
        "name": f"SoD {uuid.uuid4().hex[:6]}",
        "type": "rest",
        "config": {"url": "https://api.example.com/v1", **(extra_config or {})},
    }
    res = await client.post("/api/v1/connectors", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    body = res.json()
    return body["id"], body["workspace_id"]


class TestConnectorSeparationOfDuties:
    async def test_member_delete_forbidden_owner_allowed(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        ha, _ = await _signup(client, "owner")
        hb, email_b = await _signup(client, "member")

        cid, cws = await _make_connector(client, ha)
        await _add_member(db_session, cws, await _user_id(db_session, email_b), "member")

        r = await client.delete(f"/api/v1/connectors/{cid}", headers=hb)
        assert r.status_code == 403
        # Connector survives; owner can still read it
        assert (await client.get(f"/api/v1/connectors/{cid}", headers=ha)).status_code == 200

    async def test_admin_member_delete_allowed(self, client: AsyncClient, db_session: AsyncSession):
        ha, _ = await _signup(client, "owner")
        hb, email_b = await _signup(client, "admin")

        cid, cws = await _make_connector(client, ha)
        await _add_member(db_session, cws, await _user_id(db_session, email_b), "ADMIN")

        r = await client.delete(f"/api/v1/connectors/{cid}", headers=hb)
        assert r.status_code == 204

    async def test_outsider_delete_stays_404(self, client: AsyncClient):
        ha, _ = await _signup(client, "owner")
        hb, _ = await _signup(client, "outsider")
        cid, _ = await _make_connector(client, ha)
        r = await client.delete(f"/api/v1/connectors/{cid}", headers=hb)
        assert r.status_code == 404

    async def test_insecure_create_needs_admin(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        from api.routers.connectors import _require_workspace_admin

        ha, email_a = await _signup(client, "owner")
        hb, email_b = await _signup(client, "member")
        _, cws = await _make_connector(client, ha)
        uid_b = await _user_id(db_session, email_b)
        await _add_member(db_session, cws, uid_b, "member")

        member_user = {"sub": str(uid_b)}
        with pytest.raises(Exception) as exc:
            await _require_workspace_admin(cws, member_user, db_session)
        assert getattr(exc.value, "status_code", None) == 403

        # Owner passes the gate (may create insecure transports)
        owner_id = await _user_id(db_session, email_a)
        await _require_workspace_admin(cws, {"sub": str(owner_id)}, db_session)
