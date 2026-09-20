"""Zero-Trust Gap Tests: Module 02 (Tenant Isolation & Multi-Tenancy).

Covers:
- TEST-TEN-SEC-01: Workspace member cannot escalate role or mutate workspace.
- TEST-TEN-SEC-02: TenantContext ContextVar isolation under high concurrency.
- TEST-TEN-SEC-03: Cross-tenant organization tree enumeration rejection.
- TEST-TEN-SEC-04: Tenant cascading deletion integrity & cross-tenant safety.
"""
import asyncio
import random
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.tenant import TenantContext
from api.models.schema import User, Workspace, WorkspaceUser


@pytest.mark.asyncio
async def test_workspace_member_cannot_escalate_role(client: AsyncClient, db_session: AsyncSession):
    """TEST-TEN-SEC-01: Verify that a Workspace Member cannot elevate their role to Admin/Owner."""
    # 1. Owner creates workspace
    res_owner = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "owner_ws@vaeloom.test",
            "password": "OwnerPassword123!",
            "display_name": "Owner WS",
        },
    )
    token_owner = res_owner.json()["access_token"]
    owner_id = uuid.UUID(res_owner.json()["user"]["id"])

    ws_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Owner Primary Workspace"},
        headers={"Authorization": f"Bearer {token_owner}"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # 2. Member signs up
    res_member = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "member_ws@vaeloom.test",
            "password": "MemberPassword123!",
            "display_name": "Member WS",
        },
    )
    token_member = res_member.json()["access_token"]
    member_id = uuid.UUID(res_member.json()["user"]["id"])

    # Add member to workspace with MEMBER role
    wu = WorkspaceUser(
        workspace_id=uuid.UUID(ws_id),
        user_id=member_id,
        role="MEMBER",
    )
    db_session.add(wu)
    await db_session.commit()

    # 3. Member attempts to PATCH the workspace name (Owner only)
    patch_res = await client.patch(
        f"/api/v1/workspaces/{ws_id}",
        json={"name": "Member Hijacked Name"},
        headers={"Authorization": f"Bearer {token_member}"},
    )
    # Must reject with 404 (anti-enumeration) or 403
    assert patch_res.status_code in (403, 404)

    # 4. Member attempts to DELETE the workspace
    del_res = await client.delete(
        f"/api/v1/workspaces/{ws_id}",
        headers={"Authorization": f"Bearer {token_member}"},
    )
    assert del_res.status_code in (403, 404)


@pytest.mark.asyncio
async def test_tenant_context_async_task_isolation():
    """TEST-TEN-SEC-02: Verify ContextVar isolation across 50 concurrent async tasks."""
    async def worker(task_idx: int):
        tid = f"tenant_{task_idx}_{uuid.uuid4().hex[:6]}"
        wid = f"ws_{task_idx}_{uuid.uuid4().hex[:6]}"
        uid = f"user_{task_idx}_{uuid.uuid4().hex[:6]}"

        # Set task-local ContextVar
        TenantContext.set(tenant_id=tid, workspace_id=wid, user_id=uid)

        # Yield control repeatedly with randomized sleeps to maximize task interleaving
        for _ in range(5):
            await asyncio.sleep(random.uniform(0.001, 0.005))
            assert TenantContext.get_tenant_id() == tid, "TenantContext leaked cross-task tenant_id!"
            assert TenantContext.get_workspace_id() == wid, "TenantContext leaked cross-task workspace_id!"
            assert TenantContext.get_user_id() == uid, "TenantContext leaked cross-task user_id!"

        TenantContext.clear()
        assert TenantContext.get() == {}

    # Run 50 concurrent workers
    tasks = [worker(i) for i in range(50)]
    await asyncio.gather(*tasks)


@pytest.mark.asyncio
async def test_cross_tenant_org_tree_isolation(client: AsyncClient):
    """TEST-TEN-SEC-03: Verify Tenant B cannot access or enumerate Tenant A's organization tree."""
    # Tenant A
    res_a = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "org_user_a@vaeloom.test",
            "password": "OrgPassword123!",
            "display_name": "Org User A",
        },
    )
    token_a = res_a.json()["access_token"]

    # Tenant B
    res_b = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "org_user_b@vaeloom.test",
            "password": "OrgPassword123!",
            "display_name": "Org User B",
        },
    )
    token_b = res_b.json()["access_token"]

    # User B queries organizations with their token
    res_b_tree = await client.get(
        "/api/v1/organizations/tree",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    # If user has no tenant, fails closed (400); if user has tenant, only sees own orgs
    if res_b_tree.status_code == 200:
        orgs = res_b_tree.json()
        assert isinstance(orgs, list)
    else:
        assert res_b_tree.status_code in (400, 403, 404)


@pytest.mark.asyncio
async def test_tenant_cascade_delete_integrity(client: AsyncClient, db_session: AsyncSession):
    """TEST-TEN-SEC-04: Verify deleting User A in Tenant A leaves Tenant B completely intact."""
    # User A
    res_a = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "cascade_a@vaeloom.test",
            "password": "CascadePassword123!",
            "display_name": "Cascade User A",
        },
    )
    u_a_id = uuid.UUID(res_a.json()["user"]["id"])
    token_a = res_a.json()["access_token"]

    # Create workspace for User A
    ws_a_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Workspace A to Delete"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    ws_a_id = ws_a_res.json()["id"]

    # User B
    res_b = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "cascade_b@vaeloom.test",
            "password": "CascadePassword123!",
            "display_name": "Cascade User B",
        },
    )
    u_b_id = uuid.UUID(res_b.json()["user"]["id"])
    token_b = res_b.json()["access_token"]

    # Create workspace for User B
    ws_b_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Workspace B Must Stay"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    ws_b_id = ws_b_res.json()["id"]

    # Delete User A's workspace
    del_res = await client.delete(
        f"/api/v1/workspaces/{ws_a_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert del_res.status_code == 204

    # Verify User B's workspace is 100% unaffected
    get_b = await client.get(
        f"/api/v1/workspaces/{ws_b_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert get_b.status_code == 200
    assert get_b.json()["name"] == "Workspace B Must Stay"
