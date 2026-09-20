"""Zero-Trust Stage 3 Verification Tests (GDPR Tenant Data Export, Invited Member Onboarding).

Tests:
1. GDPR Tenant Data Export strict tenant isolation & cross-tenant exfiltration rejection.
2. Invited member onboarding lifecycle (auto-linking invited workspace, bypassing duplicate creation).
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import OnboardingState, Tenant, User, Workspace, WorkspaceUser

pytestmark = pytest.mark.asyncio


async def test_gdpr_tenant_data_export_isolation(client: AsyncClient, db_session: AsyncSession):
    """Verify that GDPR tenant data export is strictly isolated and rejects cross-tenant exfiltration."""
    # 1. Create Tenant A and Tenant B
    tenant_a = Tenant(name="Tenant Alpha", slug=f"alpha-{uuid.uuid4().hex[:6]}")
    tenant_b = Tenant(name="Tenant Beta", slug=f"beta-{uuid.uuid4().hex[:6]}")
    db_session.add_all([tenant_a, tenant_b])
    await db_session.commit()
    await db_session.refresh(tenant_a)
    await db_session.refresh(tenant_b)

    # 2. Create User A in Tenant A
    res_a = await client.post(
        "/api/v1/auth/signup",
        json={"email": f"user_a_{uuid.uuid4().hex[:6]}@alpha.test", "password": "VaeloomSecure2026!", "display_name": "User Alpha"},
    )
    assert res_a.status_code == 201
    user_a_id = uuid.UUID(res_a.json()["user"]["id"])
    token_a = res_a.json()["access_token"]

    # Associate User A with Tenant A
    u_a = await db_session.get(User, user_a_id)
    u_a.tenant_id = tenant_a.id
    # Create workspace for User A
    ws_a = Workspace(id=uuid.uuid4(), name="Alpha Primary", user_id=user_a_id)
    db_session.add(ws_a)
    # Update onboarding state for User A
    from sqlalchemy import select
    ob_res = await db_session.execute(select(OnboardingState).where(OnboardingState.user_id == user_a_id))
    ob_a = ob_res.scalar_one()
    ob_a.tenant_id = tenant_a.id
    ob_a.workspace_id = ws_a.id
    ob_a.current_step = "RESUME"
    ob_a.completed_steps = ["PROFILE", "WORKSPACE"]
    ob_a.step_data = {"role": "Engineer"}
    await db_session.commit()

    # User A logins again to get JWT with tenant_id claim
    login_a = await client.post(
        "/api/v1/auth/login",
        json={"email": u_a.email, "password": "VaeloomSecure2026!"},
    )
    assert login_a.status_code == 200
    auth_token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {auth_token_a}"}

    # 3. User A exports their own Tenant A data -> 200 OK
    res_exp_a = await client.post(f"/api/v1/tenants/{tenant_a.id}/export", headers=headers_a)
    assert res_exp_a.status_code == 200
    export_data_a = res_exp_a.json()
    assert export_data_a["tenant_id"] == str(tenant_a.id)
    assert export_data_a["tenant_name"] == "Tenant Alpha"
    assert export_data_a["total_records"] >= 3
    assert len(export_data_a["data"]["users"]) >= 1
    assert export_data_a["data"]["users"][0]["id"] == str(user_a_id)
    assert len(export_data_a["data"]["workspaces"]) >= 1
    ws_names = [w["name"] for w in export_data_a["data"]["workspaces"]]
    assert "Alpha Primary" in ws_names

    # 4. ZERO-TRUST: User A attempts to export Tenant B data -> 403 Forbidden!
    res_exp_b = await client.post(f"/api/v1/tenants/{tenant_b.id}/export", headers=headers_a)
    assert res_exp_b.status_code == 403
    assert "Cross-tenant violation" in res_exp_b.text


async def test_invited_member_onboarding_flow(client: AsyncClient, db_session: AsyncSession):
    """Verify that an invited user automatically inherits the invited workspace during onboarding."""
    # 1. Owner signs up and creates "Engineering HQ" workspace
    res_owner = await client.post(
        "/api/v1/auth/signup",
        json={"email": f"owner_{uuid.uuid4().hex[:6]}@vaeloom.test", "password": "VaeloomSecure2026!", "display_name": "Org Owner"},
    )
    assert res_owner.status_code == 201
    token_owner = res_owner.json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {token_owner}"}

    ws_res = await client.post(
        "/api/v1/workspaces",
        headers=owner_headers,
        json={"name": "Engineering HQ"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # 2. Member signs up
    member_email = f"member_{uuid.uuid4().hex[:6]}@vaeloom.test"
    res_member = await client.post(
        "/api/v1/auth/signup",
        json={"email": member_email, "password": "VaeloomSecure2026!", "display_name": "New Team Member"},
    )
    assert res_member.status_code == 201
    member_token = res_member.json()["access_token"]
    member_id = uuid.UUID(res_member.json()["user"]["id"])
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # 3. Owner invites the member to "Engineering HQ"
    invite_res = await client.post(
        f"/api/v1/workspaces/{ws_id}/invites",
        headers=owner_headers,
        json={"email": member_email, "role": "member"},
    )
    assert invite_res.status_code == 201

    # 4. Member checks onboarding state -> automatically linked to invited workspace!
    ob_res = await client.get("/api/v1/onboarding", headers=member_headers)
    assert ob_res.status_code == 200
    ob_data = ob_res.json()
    assert ob_data["workspace_id"] == ws_id
    assert "WORKSPACE" in ob_data["completed_steps"]
    assert ob_data["current_step"] == "RESUME"

    # 5. Member can also explicitly join via /onboarding/join
    join_res = await client.post(
        "/api/v1/onboarding/join",
        headers=member_headers,
        json={"workspace_id": ws_id},
    )
    assert join_res.status_code == 200
    assert join_res.json()["workspace_id"] == ws_id
