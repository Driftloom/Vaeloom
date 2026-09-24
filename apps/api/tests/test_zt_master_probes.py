"""Zero-trust master probes (P0): auth + tenant/workspace isolation.

Independent adversarial regression tests for the master audit:
- unauthenticated / forged-token access is denied
- duplicate registration is rejected
- user B cannot read user A's workspace or memory (IDOR/BOLA)
- unauthenticated memory/workspace access is denied
Uses the standard test harness (per-test sqlite, mock LLM). No real network.
"""
import pytest

pytestmark = pytest.mark.asyncio


async def _signup(client, email, password="ProbePass123!"):
    return await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "display_name": "Probe"},
    )


async def test_master_auth_matrix(client):
    ra = await _signup(client, "mprobe-a@zt.test")
    assert ra.status_code == 201, ra.text
    tok_a = ra.json()["access_token"]

    dup = await _signup(client, "mprobe-a@zt.test")
    assert dup.status_code == 409, dup.text

    bad_email = await client.post(
        "/api/v1/auth/signup",
        json={"email": "not-an-email", "password": "ProbePass123!"},
    )
    assert bad_email.status_code == 422, bad_email.text

    weak = await _signup(client, "mprobe-weak@zt.test", password="short")
    assert weak.status_code == 422, weak.text

    ok = await client.post(
        "/api/v1/auth/login",
        json={"email": "mprobe-a@zt.test", "password": "ProbePass123!"},
    )
    assert ok.status_code == 200

    wrong = await client.post(
        "/api/v1/auth/login",
        json={"email": "mprobe-a@zt.test", "password": "WrongPass999!"},
    )
    assert wrong.status_code == 401, wrong.text

    assert (await client.get("/api/v1/auth/me")).status_code == 401
    forged = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer forged.invalid.tok"}
    )
    assert forged.status_code == 401
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tok_a}"}
    )
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "mprobe-a@zt.test"


async def test_master_workspace_isolation(client):
    ra = await _signup(client, "mprobe-wa@zt.test")
    rb = await _signup(client, "mprobe-wb@zt.test")
    ha = {"Authorization": f"Bearer {ra.json()['access_token']}"}
    hb = {"Authorization": f"Bearer {rb.json()['access_token']}"}

    assert (await client.get("/api/v1/workspaces", headers=hb)).status_code == 200

    ca = await client.post(
        "/api/v1/workspaces", json={"name": "Alice Secret"}, headers=ha
    )
    assert ca.status_code == 201, ca.text
    ws_id = ca.json()["id"]

    assert (await client.get("/api/v1/workspaces")).status_code == 401

    # B must not see A's workspace in list
    lb = await client.get("/api/v1/workspaces", headers=hb)
    if lb.status_code == 200:
        assert all(w["id"] != ws_id for w in lb.json())

    # B direct-object access must fail closed (404, never 200)
    cross = await client.get(f"/api/v1/workspaces/{ws_id}", headers=hb)
    assert cross.status_code == 404, cross.text

    own = await client.get(f"/api/v1/workspaces/{ws_id}", headers=ha)
    assert own.status_code == 200


async def test_master_memory_isolation(client):
    ra = await _signup(client, "mprobe-ma@zt.test")
    rb = await _signup(client, "mprobe-mb@zt.test")
    ha = {"Authorization": f"Bearer {ra.json()['access_token']}"}
    hb = {"Authorization": f"Bearer {rb.json()['access_token']}"}

    la = await client.get("/api/v1/workspaces", headers=ha)
    assert la.status_code == 200 and len(la.json()) > 0
    ws_a = la.json()[0]["id"]

    created = await client.post(
        "/api/v1/memories",
        json={
            "workspace_id": ws_a,
            "type": "preference",
            "title": "Alice secret",
            "content": "Alice prefers decaf",
            "confidence": 0.9,
        },
        headers=ha,
    )
    assert created.status_code == 201, created.text
    mem_id = created.json()["id"]

    assert (await client.get("/api/v1/memories")).status_code == 401
    cross = await client.get(f"/api/v1/memories/{mem_id}", headers=hb)
    assert cross.status_code == 403, cross.text

    # B must not retrieve A's memory content via search either
    found = await client.post(
        "/api/v1/memories/search", json={"query": "decaf"}, headers=hb
    )
    if found.status_code == 200:
        assert all(m.get("id") != mem_id for m in found.json())
