"""Zero-Trust Boundary Tests: Cross-Cutting Agent & Memory Isolation.

Covers:
- TEST-X-AGT-01: AI Agent / Tool cross-workspace memory isolation.
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import Memory


@pytest.mark.asyncio
async def test_agent_cross_workspace_memory_isolation(client: AsyncClient, db_session: AsyncSession):
    """TEST-X-AGT-01: Verify agent execution in Workspace A cannot access Workspace B memories."""
    # User A creates Workspace A
    res_a = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "agent_user_a@vaeloom.test",
            "password": "AgentPasswordA123!",
            "display_name": "Agent User A",
        },
    )
    token_a = res_a.json()["access_token"]
    u_a_id = uuid.UUID(res_a.json()["user"]["id"])

    ws_a_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Agent WS A"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    ws_a_id = ws_a_res.json()["id"]

    # User B creates Workspace B
    res_b = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "agent_user_b@vaeloom.test",
            "password": "AgentPasswordB123!",
            "display_name": "Agent User B",
        },
    )
    token_b = res_b.json()["access_token"]
    u_b_id = uuid.UUID(res_b.json()["user"]["id"])

    ws_b_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Agent WS B"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    ws_b_id = ws_b_res.json()["id"]

    # User B adds a sensitive memory in Workspace B
    mem_b = Memory(
        workspace_id=uuid.UUID(ws_b_id),
        user_id=u_b_id,
        type="profile",
        status="ACTIVE",
        title="Top Secret Strategy",
        content="Project Orion Secret Roadmap 2027",
        content_hash="hash_orion_secret_999",
    )
    db_session.add(mem_b)
    await db_session.commit()

    # User A searches memories in Workspace A via /api/v1/memories
    search_a = await client.get(
        f"/api/v1/workspaces/{ws_a_id}/memories",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert search_a.status_code == 200
    mems = search_a.json()
    contents = [str(m.get("content", "")) for m in mems]
    assert "Project Orion Secret Roadmap 2027" not in " ".join(contents), \
        "Zero-Trust Breach: Workspace A accessed Workspace B's secret memory!"

    # User A tries to directly query Workspace B's memories
    direct_attempt = await client.get(
        f"/api/v1/workspaces/{ws_b_id}/memories",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert direct_attempt.status_code == 404, \
        f"Expected 404 on cross-workspace memory endpoint, got {direct_attempt.status_code}"
