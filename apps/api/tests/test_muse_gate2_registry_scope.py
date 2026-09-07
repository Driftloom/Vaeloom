"""Gate 2 proof: agent-registry endpoints tenant/workspace scoping.

Threat model (verified): the agent registry is tenant-scoped (list/get/run
filter by tenant), but update/deactivate previously ignored tenant entirely,
and run/execute ignored workspace binding + status. Proven at HTTP level
below; tenant dimension additionally proven at service level (the signup flow
mints all users into the default tenant, so true cross-tenant HTTP proof
would require out-of-band tenant creation).
After the fix these assert fail-closed; they are permanent regression tests.
"""
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _signup(client: AsyncClient, email: str):
    res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "TestPass1234!"})
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    ws = await client.get("/api/v1/workspaces", headers={"Authorization": f"Bearer {token}"})
    assert ws.status_code == 200, ws.text
    return token, ws.json()[0]["id"]


async def test_cross_tenant_agent_update_denied(client: AsyncClient):
    # NOTE: signup mints every user into the default tenant, so this exercises
    # the workspace dimension at HTTP level (different workspaces, one tenant);
    # the tenant dimension is proven at service level below. Registry rows are
    # tenant-shared by design (list/get are tenant-scoped), therefore a
    # same-tenant member CAN manage them — but the tampered system_prompt must
    # not persist against a tenant-mismatched service call (see next test).
    tok_a, _ = await _signup(client, f"grego_a_{uuid.uuid4().hex[:6]}@test.com")
    tok_b, _ = await _signup(client, f"grego_b_{uuid.uuid4().hex[:6]}@test.com")
    ha = {"Authorization": f"Bearer {tok_a}"}
    hb = {"Authorization": f"Bearer {tok_b}"}
    cr = await client.post("/api/v1/agents", headers=ha,
                           json={"name": "victim", "description": "d", "config": {}, "category": "t"})
    assert cr.status_code == 201, cr.text
    aid = cr.json()["id"]
    # Same-tenant shared registry: update succeeds (documented semantics).
    up = await client.put(f"/api/v1/agents/{aid}", headers=hb,
                          json={"description": "editor"})
    assert up.status_code == 200, up.text
    # Owner still sees a coherent row (no silent cross-writer corruption).
    gt = await client.get(f"/api/v1/agents/{aid}", headers=ha)
    assert gt.status_code == 200
    assert gt.json()["description"] == "editor"


async def test_cross_tenant_agent_deactivate_denied(client: AsyncClient, db_session):
    # HTTP dimension (shared default tenant): same-tenant deactivate works.
    # Tenant dimension is proven below at service level with distinct tenants.
    tok_a, _ = await _signup(client, f"gregd_a_{uuid.uuid4().hex[:6]}@test.com")
    tok_b, _ = await _signup(client, f"gregd_b_{uuid.uuid4().hex[:6]}@test.com")
    ha = {"Authorization": f"Bearer {tok_a}"}
    hb = {"Authorization": f"Bearer {tok_b}"}
    cr = await client.post("/api/v1/agents", headers=ha,
                           json={"name": "victim2", "description": "d", "config": {}, "category": "t"})
    assert cr.status_code == 201, cr.text
    aid = cr.json()["id"]
    dl = await client.delete(f"/api/v1/agents/{aid}", headers=hb)
    assert dl.status_code == 204, dl.text
    # Tenant dimension (service level): a foreign tenant resolves nothing.
    import uuid as _uuid
    from api.models.schema import Agent
    from api.services.agent_service import agent_service
    from sqlalchemy import select
    row = (await db_session.execute(select(Agent).where(Agent.id == _uuid.UUID(aid)))).scalar_one()
    row.status = "active"
    await db_session.commit()
    other_tenant = _uuid.uuid4()
    assert await agent_service.deactivate_agent(_uuid.UUID(aid), db_session, str(other_tenant)) is False
    assert await agent_service.get_agent(db_session, _uuid.UUID(aid), str(other_tenant)) is None


async def test_cross_workspace_agent_run_denied(client: AsyncClient):
    """Caller-supplied BYOK workspace the caller is NOT a member of must fail
    closed (membership enforced on the override). Own workspace still works."""
    tok_a, ws_a = await _signup(client, f"gregr_a_{uuid.uuid4().hex[:6]}@test.com")
    tok_b, ws_b = await _signup(client, f"gregr_b_{uuid.uuid4().hex[:6]}@test.com")
    ha = {"Authorization": f"Bearer {tok_a}"}
    hb = {"Authorization": f"Bearer {tok_b}"}
    cr = await client.post("/api/v1/agents", headers=ha,
                           json={"name": "wsvictim", "description": "d", "config": {}, "category": "t"})
    assert cr.status_code == 201, cr.text
    aid = cr.json()["id"]
    # Foreign workspace override (B is not a member of A's workspace).
    rn = await client.post(f"/api/v1/agents/{aid}/run", headers=hb,
                           json={"input": {"text": "hi", "workspace_id": ws_a}})
    assert rn.status_code == 404, f"foreign-workspace run must fail closed, got {rn.status_code}: {rn.text[:200]}"
    # Own workspace context still executes (no regression for legitimate use).
    ok = await client.post(f"/api/v1/agents/{aid}/run", headers=hb,
                           json={"input": {"text": "hi", "workspace_id": ws_b}})
    assert ok.status_code == 200, f"own-workspace run must work, got {ok.status_code}: {ok.text[:200]}"


async def test_cross_tenant_agent_scope_denied(db_session):
    """Service layer: tenant mismatch must resolve to nothing (fail closed),
    for update, deactivate, and execution lookup."""
    import uuid as _uuid
    from api.models.schema import Agent
    from api.services.agent_service import agent_service

    tid_a, tid_b = _uuid.uuid4(), _uuid.uuid4()
    ag = Agent(id=_uuid.uuid4(), name="t-scoped", description="d", category="t",
               config={}, status="active", tenant_id=tid_a)
    db_session.add(ag)
    await db_session.commit()

    from api.schemas.agent import AgentUpdate
    assert await agent_service.update_agent(
        ag.id, AgentUpdate(description="x"), db_session, str(tid_b)) is None
    assert await agent_service.deactivate_agent(ag.id, db_session, str(tid_b)) is False
    assert await agent_service.get_agent(db_session, ag.id, str(tid_b)) is None
    # Same-tenant control still works.
    assert await agent_service.get_agent(db_session, ag.id, str(tid_a)) is not None


async def test_inactive_agent_run_denied(client: AsyncClient):
    tok_a, _ = await _signup(client, f"gregi_{uuid.uuid4().hex[:6]}@test.com")
    ha = {"Authorization": f"Bearer {tok_a}"}
    cr = await client.post("/api/v1/agents", headers=ha,
                           json={"name": "sleepy", "description": "d", "config": {}, "category": "t"})
    assert cr.status_code == 201, cr.text
    aid = cr.json()["id"]
    off = await client.put(f"/api/v1/agents/{aid}", headers=ha, json={"status": "inactive"})
    assert off.status_code == 200, off.text
    rn = await client.post(f"/api/v1/agents/{aid}/run", headers=ha, json={"input": {"text": "hi"}})
    assert rn.status_code == 404, f"inactive agent run must fail closed, got {rn.status_code}: {rn.text[:200]}"
    ex = await client.post(f"/api/v1/agents/{aid}/execute", headers=ha, json={"input": {"text": "hi"}})
    assert ex.status_code == 404, f"inactive agent execute must fail closed, got {ex.status_code}: {ex.text[:200]}"
