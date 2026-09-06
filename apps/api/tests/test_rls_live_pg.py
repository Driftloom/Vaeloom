"""Live RLS proof — cross-workspace / cross-tenant isolation on real PostgreSQL.

Unlike test_rls_isolation.py (SQLite-skipped), THESE TESTS RUN against a real
PostgreSQL database and verify the actual RLS mechanism:

* unset GUCs      -> zero rows (fail-closed)
* cross-tenant    -> zero rows from another tenant
* cross-workspace -> zero rows from another workspace (same tenant)
* own scope       -> own rows visible
* WITH CHECK      -> mismatched insert rejected (write path)

Target: set VAELOOM_TEST_PG_URL to a *disposable* database, e.g.
    VAELOOM_TEST_PG_URL=postgresql://vaeloom:vaeloom_dev@localhost:5432/vaeloom_rls_proof

Safety: refuses to run unless the database name ends with _proof or _test.
The test applies the three representative policies with IF NOT EXISTS DO
blocks transcribed VERBATIM from the migration chain, so it never depends on
alembic state:

* memories  <- 0014_memories_rls_workspace_only.py:34-41
* users     <- 0020_rls_remaining_5.py:50-62
* documents <- 0013 workspace-only template (_create_workspace_only)

Scope note: the 42/42 rollout uses these same three policy templates across
all tables (audited in 0010/0012/0013/0019/0020). This file live-proves the
mechanism; the matrix is covered by mechanism-proof + migration audit.

Run (from apps/api; plain `uv run` so the env var is inherited):
    $env:VAELOOM_TEST_PG_URL="postgresql://vaeloom:vaeloom_dev@localhost:5432/vaeloom_rls_proof"
    uv run python -m pytest tests/test_rls_live_pg.py -q -o addopts=""
"""

import os
import uuid
from urllib.parse import urlsplit, urlunsplit

import asyncpg
import pytest

PG_URL = os.environ.get("VAELOOM_TEST_PG_URL", "")
APP_USER = "vaeloom_app"
APP_PASSWORD = "vaeloom_app_proof_pw"

REQUIREMENT = "set VAELOOM_TEST_PG_URL to a disposable PG database (*_proof|*_test)"


def _app_url() -> str:
    """Same target DB, but connecting as the non-superuser app role.

    RLS FORCE applies to table owners, but superusers bypass RLS entirely,
    so the proof traffic must NOT run as superuser (mirrors prod, where the
    app connects as vaeloom_app per 0005_rls_expanded.py).
    """
    parts = urlsplit(PG_URL)
    netloc = f"{APP_USER}:{APP_PASSWORD}@{parts.hostname}"
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, ""))


def _target_db() -> str:
    # asyncpg URL form: postgresql://user:pw@host:port/dbname
    return PG_URL.rsplit("/", 1)[-1].split("?", 1)[0]


# Idempotent app-role provisioning (mirrors 0005_rls_expanded.py role setup).
ROLE_SQL = (
    "\nDO $$\nBEGIN\n"
    f"    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{APP_USER}') THEN\n"
    f"        CREATE ROLE {APP_USER} LOGIN PASSWORD '{APP_PASSWORD}';\n"
    "    END IF;\nEND $$;\n"
    f"ALTER ROLE {APP_USER} WITH PASSWORD '{APP_PASSWORD}';\n"
    f'GRANT CONNECT ON DATABASE "{_target_db()}" TO {APP_USER};\n'
    f"GRANT USAGE ON SCHEMA public TO {APP_USER};\n"
    "GRANT SELECT, INSERT, UPDATE, DELETE\n"
    f"    ON tenants, users, workspaces, memories, documents TO {APP_USER};\n"
)

# Verbatim policy SQL from the migration chain (see module docstring).
POLICY_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'p_memories_workspace' AND tablename = 'memories'
    ) THEN
        CREATE POLICY p_memories_workspace ON memories
        USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
        WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'tenant_isolation_users' AND tablename = 'users'
    ) THEN
        CREATE POLICY tenant_isolation_users ON users
        USING (
            tenant_id::text = current_setting('app.tenant_id', true)
            OR id::text = current_setting('app.user_id', true)
        );
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'p_documents_workspace' AND tablename = 'documents'
    ) THEN
        CREATE POLICY p_documents_workspace ON documents
        USING (workspace_id = current_setting('app.workspace_id', true)::uuid)
        WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid);
    END IF;
END $$;
"""

FORCE_SQL = """
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories FORCE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
"""


pytestmark = pytest.mark.skipif(
    not PG_URL or not _target_db().endswith(("_proof", "_test")),
    reason=REQUIREMENT,
)


@pytest.fixture
async def pg():
    admin = await asyncpg.connect(PG_URL)
    try:
        # Base schema must exist (0001-0004 or create_all); policies idempotent.
        has_memories = await admin.fetchval(
            "SELECT to_regclass('public.memories') IS NOT NULL")
        if not has_memories:
            pytest.skip("target DB has no schema; apply base schema first")
        # Explicit transaction: multi-statement execute() must commit,
        # else it rolls back on close and policies silently vanish.
        async with admin.transaction():
            await admin.execute(ROLE_SQL)
            await admin.execute(FORCE_SQL)
            await admin.execute(POLICY_SQL)
    finally:
        await admin.close()
    # Proof traffic runs as the non-superuser app role (see _app_url).
    conn = await asyncpg.connect(_app_url())
    try:
        yield conn
    finally:
        await conn.close()


async def _set(conn, tenant=None, workspace=None, user=None):
    # NOTE: never RESET placeholder GUCs to "unset" them — PG turns a RESET
    # custom GUC into '' (empty string), and ''::uuid RAISES instead of
    # evaluating to NULL. Always overwrite with real values; the truly-unset
    # (NULL) state only exists on a fresh connection (see test_unset_*).
    if tenant:
        await conn.execute(
            "SELECT set_config('app.tenant_id', $1, false)", str(tenant))
    if workspace:
        await conn.execute(
            "SELECT set_config('app.workspace_id', $1, false)", str(workspace))
    if user:
        await conn.execute(
            "SELECT set_config('app.user_id', $1, false)", str(user))


@pytest.fixture
async def tenant_a(pg):
    """Seed one tenant + user + workspace + memory + document. Yields ids."""
    tid, wid, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    mid, did = uuid.uuid4(), uuid.uuid4()
    tag = f"RLS-PROOF-{tid.hex[:8]}"
    await _set(pg, tid, wid, uid)
    # Raw SQL must supply every NOT NULL column (ORM Python-side defaults
    # do not fire here) and satisfy FKs (tenants row first).
    await pg.execute(
        "INSERT INTO tenants (id, name, slug, status, isolation, plan,"
        " settings, limits, features)"
        " VALUES ($1, $2, $3, 'ACTIVE', 'pooled', 'free', '{}', '{}', '{}')",
        tid, tag, tag.lower())
    await pg.execute(
        "INSERT INTO users (id, email, display_name, auth_provider, status,"
        " preferences, tenant_id)"
        " VALUES ($1, $2, $3, 'email', 'ACTIVE', '{}', $4)",
        uid, f"{tag}@example.com", tag, tid)
    await pg.execute(
        "INSERT INTO workspaces (id, user_id, name) VALUES ($1, $2, $3)",
        wid, uid, tag)
    await pg.execute(
        "INSERT INTO memories (id, workspace_id, user_id, tenant_id, type,"
        " title, content_hash, metadata, tags, size, status)"
        " VALUES ($1, $2, $3, $4, 'profile', $5, 'hash', '{}', '{}', 0,"
        " 'PROCESSING')",
        mid, wid, uid, tid, f"{tag}-memory")
    await pg.execute(
        "INSERT INTO documents (id, workspace_id, path, type, metadata)"
        " VALUES ($1, $2, $3, 'pdf', '{}')",
        did, wid, f"{tag}.pdf")
    yield {"tenant": tid, "workspace": wid, "user": uid, "tag": tag}
    # Teardown in own scope (policies allow it), FK order.
    await _set(pg, tid, wid, uid)
    await pg.execute("DELETE FROM memories WHERE id = $1", mid)
    await pg.execute("DELETE FROM documents WHERE id = $1", did)
    await pg.execute("DELETE FROM documents WHERE workspace_id = $1", wid)
    await pg.execute("DELETE FROM workspaces WHERE id = $1", wid)
    await pg.execute("DELETE FROM users WHERE id = $1", uid)
    await pg.execute("DELETE FROM tenants WHERE id = $1", tid)


async def test_unset_gucs_see_zero_rows(pg, tenant_a):
    # Truly-unset GUCs (NULL) exist only on a fresh connection — RESET would
    # yield '' which errors on ::uuid cast instead of returning zero rows.
    fresh = await asyncpg.connect(_app_url())
    try:
        assert await fresh.fetchval("SELECT count(*) FROM memories") == 0
        assert await fresh.fetchval("SELECT count(*) FROM documents") == 0
        assert await fresh.fetchval("SELECT count(*) FROM users") == 0
    finally:
        await fresh.close()


async def test_cross_tenant_cannot_read(pg, tenant_a):
    other = {"tenant": uuid.uuid4(), "workspace": uuid.uuid4(),
             "user": uuid.uuid4()}
    await _set(pg, other["tenant"], other["workspace"], other["user"])
    assert await pg.fetchval("SELECT count(*) FROM memories") == 0
    assert await pg.fetchval("SELECT count(*) FROM documents") == 0
    rows = await pg.fetch("SELECT id FROM users")
    assert tenant_a["user"] not in {r["id"] for r in rows}


async def test_cross_workspace_same_tenant_cannot_read(pg, tenant_a):
    await _set(pg, tenant_a["tenant"], uuid.uuid4(), tenant_a["user"])
    assert await pg.fetchval("SELECT count(*) FROM memories") == 0
    assert await pg.fetchval("SELECT count(*) FROM documents") == 0


async def test_own_scope_reads_own_rows(pg, tenant_a):
    await _set(pg, tenant_a["tenant"], tenant_a["workspace"], tenant_a["user"])
    assert await pg.fetchval("SELECT count(*) FROM memories") == 1
    assert await pg.fetchval("SELECT count(*) FROM documents") == 1
    assert await pg.fetchval(
        "SELECT count(*) FROM users WHERE id = $1", tenant_a["user"]) == 1


async def test_with_check_rejects_mismatched_insert(pg, tenant_a):
    # GUC workspace differs from row workspace: row is otherwise fully valid,
    # so only the RLS WITH CHECK can reject it.
    await _set(pg, tenant_a["tenant"], uuid.uuid4(), tenant_a["user"])
    with pytest.raises(Exception, match="(?i)(policy|permission|violates)"):
        await pg.execute(
            "INSERT INTO memories (workspace_id, user_id, tenant_id, type,"
            " title, content_hash, metadata, tags, size, status)"
            " VALUES ($1, $2, $3, 'profile', 'x', 'y', '{}', '{}', 0,"
            " 'PROCESSING')",
            tenant_a["workspace"], tenant_a["user"], tenant_a["tenant"])
