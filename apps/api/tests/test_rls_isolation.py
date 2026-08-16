"""RLS isolation tests — verify cross-tenant data cannot leak.

These tests MUST run against a real PostgreSQL instance (not SQLite).
They verify that Row Level Security policies correctly isolate data
between tenants.

Run with: pytest tests/test_rls_isolation.py -v --postgresql

Requires: PostgreSQL with RLS enabled, migration 0005+ applied.
"""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import Memory, Workspace


@pytest.mark.asyncio
async def test_unset_tenant_returns_no_rows(db: AsyncSession):
    """When app.tenant_id is NOT set, RLS should return zero rows."""
    # Insert a row as superuser (bypasses RLS)
    tenant_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()

    await db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": str(tenant_id)})
    await db.execute(text("SET LOCAL app.workspace_id = :wid"), {"wid": str(workspace_id)})

    # Create workspace and memory
    ws = Workspace(id=workspace_id, user_id=user_id, name="test")
    db.add(ws)
    await db.flush()

    mem = Memory(
        workspace_id=workspace_id,
        user_id=user_id,
        tenant_id=tenant_id,
        type="profile",
        title="Test memory",
        content_hash="abc123",
    )
    db.add(mem)
    await db.commit()

    # Now test with a DIFFERENT tenant — should see zero rows
    await db.execute(text("RESET app.tenant_id"))
    await db.execute(text("RESET app.workspace_id"))

    result = await db.execute(text("SELECT count(*) FROM memories"))
    count = result.scalar()
    assert count == 0, f"RLS leak: saw {count} rows with unset tenant_id"


@pytest.mark.asyncio
async def test_different_tenant_cannot_see_rows(db: AsyncSession):
    """Tenant A's data must be invisible to Tenant B."""
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()
    workspace_a = uuid.uuid4()
    workspace_b = uuid.uuid4()
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()

    # Create data for Tenant A
    await db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": str(tenant_a)})
    await db.execute(text("SET LOCAL app.workspace_id = :wid"), {"wid": str(workspace_a)})

    ws_a = Workspace(id=workspace_a, user_id=user_a, name="tenant-a-workspace")
    db.add(ws_a)
    await db.flush()

    mem_a = Memory(
        workspace_id=workspace_a,
        user_id=user_a,
        tenant_id=tenant_a,
        type="profile",
        title="Tenant A secret memory",
        content_hash="aaa",
    )
    db.add(mem_a)
    await db.commit()

    # Switch to Tenant B — should NOT see Tenant A's data
    await db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": str(tenant_b)})
    await db.execute(text("SET LOCAL app.workspace_id = :wid"), {"wid": str(workspace_b)})

    result = await db.execute(text("SELECT count(*) FROM memories"))
    count = result.scalar()
    assert count == 0, f"RLS leak: Tenant B saw {count} of Tenant A's rows"


@pytest.mark.asyncio
async def test_same_tenant_sees_own_rows(db: AsyncSession):
    """A tenant should be able to see its own rows."""
    tenant_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    user_id = uuid.uuid4()

    # Create data
    await db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": str(tenant_id)})
    await db.execute(text("SET LOCAL app.workspace_id = :wid"), {"wid": str(workspace_id)})

    ws = Workspace(id=workspace_id, user_id=user_id, name="own-workspace")
    db.add(ws)
    await db.flush()

    mem = Memory(
        workspace_id=workspace_id,
        user_id=user_id,
        tenant_id=tenant_id,
        type="profile",
        title="My own memory",
        content_hash="bbb",
    )
    db.add(mem)
    await db.commit()

    # Query as same tenant — should see it
    result = await db.execute(text("SELECT count(*) FROM memories"))
    count = result.scalar()
    assert count == 1, f"Expected 1 row for own tenant, got {count}"


@pytest.mark.asyncio
async def test_workspace_isolation_within_tenant(db: AsyncSession):
    """Within the same tenant, workspace isolation must hold at DB level."""
    tenant_id = uuid.uuid4()
    workspace_1 = uuid.uuid4()
    workspace_2 = uuid.uuid4()
    user_1 = uuid.uuid4()
    user_2 = uuid.uuid4()

    # Create data in workspace 1
    await db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": str(tenant_id)})
    await db.execute(text("SET LOCAL app.workspace_id = :wid"), {"wid": str(workspace_1)})

    ws1 = Workspace(id=workspace_1, user_id=user_1, name="ws1")
    db.add(ws1)
    await db.flush()

    mem1 = Memory(
        workspace_id=workspace_1,
        user_id=user_1,
        tenant_id=tenant_id,
        type="profile",
        title="Workspace 1 memory",
        content_hash="ccc",
    )
    db.add(mem1)
    await db.commit()

    # Switch to workspace 2 (same tenant) — should NOT see workspace 1's data
    await db.execute(text("SET LOCAL app.workspace_id = :wid"), {"wid": str(workspace_2)})

    result = await db.execute(text("SELECT count(*) FROM memories"))
    count = result.scalar()
    assert count == 0, f"Workspace isolation leak: saw {count} rows from workspace 1"
