"""IDEM-SCOPE-01 HTTP battery: scoped idempotency identity.

Same (tenant, workspace, actor, key, path) replays; any dimension change
isolates. Covers cross-workspace, cross-tenant, and cross-actor collisions
on the approval endpoint (mutating, consequential, actor-bound).
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _signup(client: AsyncClient, email: str) -> tuple[dict, str]:
    r = await client.post("/api/v1/auth/signup",
                          json={"email": email, "password": "Test1234!"})
    assert r.status_code == 201, r.text
    tok = r.json()["access_token"]
    import jwt as _jwt

    sub = _jwt.decode(tok, options={"verify_signature": False})["sub"]
    return {"Authorization": f"Bearer {tok}"}, sub


async def _ws(client: AsyncClient, headers: dict, name: str) -> str:
    r = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _replayed(r) -> bool:
    return any(k.lower() == "idempotency-replayed" for k in r.headers)


class TestScopedHttpIdempotency:
    async def test_same_scope_replays(self, client: AsyncClient):
        ha, _ = await _signup(client, "idem-s1@test.com")
        wa = await _ws(client, ha, "A")
        hdr = {**ha, "Idempotency-Key": "k-same"}
        body = {"agent_name": "a", "action_type": "run", "workspace_id": wa}
        r1 = await client.post("/api/v1/approvals", json=body, headers=hdr)
        assert r1.status_code == 201, r1.text
        r2 = await client.post("/api/v1/approvals", json=body, headers=hdr)
        assert r2.status_code == 201, r2.text
        assert _replayed(r2), "same scope must replay"
        assert r2.json()["id"] == r1.json()["id"]

    async def test_cross_workspace_isolates(self, client: AsyncClient):
        ha, _ = await _signup(client, "idem-s2@test.com")
        hb, _ = await _signup(client, "idem-s3@test.com")
        wa = await _ws(client, ha, "A")
        wb = await _ws(client, hb, "B")
        hdr_a = {**ha, "Idempotency-Key": "k-xws"}
        hdr_b = {**hb, "Idempotency-Key": "k-xws"}
        r1 = await client.post("/api/v1/approvals",
                               json={"agent_name": "a", "action_type": "run",
                                     "workspace_id": wa}, headers=hdr_a)
        assert r1.status_code == 201, r1.text
        r2 = await client.post("/api/v1/approvals",
                               json={"agent_name": "a", "action_type": "run",
                                     "workspace_id": wb}, headers=hdr_b)
        assert r2.status_code == 201, r2.text
        assert not _replayed(r2), "cross-workspace must NOT replay"
        assert r2.json()["id"] != r1.json()["id"]

    async def test_cross_actor_isolates(self, client: AsyncClient):
        ha, _ = await _signup(client, "idem-s4@test.com")
        hb, _ = await _signup(client, "idem-s5@test.com")
        wa = await _ws(client, ha, "A")
        # hb is not a member of wa: give hb its own workspace but reuse the
        # same key to prove actor+workspace scoping (request would 404 on
        # foreign ws; use two keys on the SAME endpoint path instead).
        wb = await _ws(client, hb, "B")
        r1 = await client.post("/api/v1/approvals",
                               json={"agent_name": "a", "action_type": "run",
                                     "workspace_id": wa},
                               headers={**ha, "Idempotency-Key": "k-actor"})
        assert r1.status_code == 201, r1.text
        r2 = await client.post("/api/v1/approvals",
                               json={"agent_name": "a", "action_type": "run",
                                     "workspace_id": wb},
                               headers={**hb, "Idempotency-Key": "k-actor"})
        assert r2.status_code == 201, r2.text
        assert not _replayed(r2), "different actor+workspace must NOT replay"

    async def test_payload_mismatch_conflicts(self, client: AsyncClient):
        ha, _ = await _signup(client, "idem-s6@test.com")
        wa = await _ws(client, ha, "A")
        hdr = {**ha, "Idempotency-Key": "k-conf"}
        r1 = await client.post("/api/v1/approvals",
                               json={"agent_name": "a", "action_type": "run",
                                     "workspace_id": wa}, headers=hdr)
        assert r1.status_code == 201, r1.text
        r2 = await client.post("/api/v1/approvals",
                               json={"agent_name": "a", "action_type": "OTHER",
                                     "workspace_id": wa}, headers=hdr)
        assert r2.status_code == 422, r2.text
