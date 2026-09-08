"""Live RLS extended matrix (Tests C/D/E/K/L + pool isolation) on real PostgreSQL.

Same disposable target as test_rls_live_pg.py; refuses non-*_proof/*_test DBs.
Run:
    $env:VAELOOM_TEST_PG_URL="postgresql://vaeloom:vaeloom_dev@localhost:5432/vaeloom_rls_proof"
    uv run python -m pytest tests/test_rls_live_extended.py -q -o addopts=""
"""
import asyncio
import os
import random
import uuid
from urllib.parse import urlsplit, urlunsplit

import asyncpg
import pytest

PG_URL = os.environ.get("VAELOOM_TEST_PG_URL", "")
APP_USER = "vaeloom_app"
APP_PASSWORD = "vaeloom_app_proof_pw"


def _target_db() -> str:
    return PG_URL.rsplit("/", 1)[-1].split("?", 1)[0]


def _app_url() -> str:
    parts = urlsplit(PG_URL)
    netloc = f"{APP_USER}:{APP_PASSWORD}@{parts.hostname}"
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, ""))


pytestmark = pytest.mark.skipif(
    not PG_URL or not _target_db().endswith(("_proof", "_test")),
    reason="set VAELOOM_TEST_PG_URL to a disposable PG database (*_proof|*_test)",
)


@pytest.fixture
async def pg():
    admin = await asyncpg.connect(PG_URL)
    try:
        has_memories = await admin.fetchval("SELECT to_regclass('public.memories') IS NOT NULL")
        if not has_memories:
            pytest.skip("target DB has no schema; apply base schema first")
    finally:
        await admin.close()
    conn = await asyncpg.connect(_app_url())
    try:
        yield conn
    finally:
        await conn.close()


async def _set(conn, tenant=None, workspace=None, user=None):
    if tenant:
        await conn.execute("SELECT set_config('app.tenant_id', $1, false)", str(tenant))
    if workspace:
        await conn.execute("SELECT set_config('app.workspace_id', $1, false)", str(workspace))
    if user:
        await conn.execute("SELECT set_config('app.user_id', $1, false)", str(user))


async def _seed(conn, tag: str):
    tid, wid, uid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    mid = uuid.uuid4()
    await _set(conn, tid, wid, uid)
    await conn.execute(
        "INSERT INTO tenants (id, name, slug, status, isolation, plan, settings, limits, features)"
        " VALUES ($1, $2, $3, 'ACTIVE', 'pooled', 'free', '{}', '{}', '{}')",
        tid, tag, tag.lower())
    await conn.execute(
        "INSERT INTO users (id, email, display_name, auth_provider, status, preferences, tenant_id)"
        " VALUES ($1, $2, $3, 'email', 'ACTIVE', '{}', $4)",
        uid, f"{tag}@example.com", tag, tid)
    await conn.execute("INSERT INTO workspaces (id, user_id, name) VALUES ($1, $2, $3)", wid, uid, tag)
    await conn.execute(
        "INSERT INTO memories (id, workspace_id, user_id, tenant_id, type, title, content_hash,"
        " metadata, tags, size, status)"
        " VALUES ($1, $2, $3, $4, 'profile', $5, 'hash', '{}', '{}', 0, 'PROCESSING')",
        mid, wid, uid, tid, f"{tag}-memory")
    return {"tenant": tid, "workspace": wid, "user": uid, "memory": mid, "tag": tag}


async def _teardown(conn, ids):
    await _set(conn, ids["tenant"], ids["workspace"], ids["user"])
    await conn.execute("DELETE FROM memories WHERE id = $1", ids["memory"])
    await conn.execute("DELETE FROM workspaces WHERE id = $1", ids["workspace"])
    await conn.execute("DELETE FROM users WHERE id = $1", ids["user"])
    await conn.execute("DELETE FROM tenants WHERE id = $1", ids["tenant"])


async def test_cross_tenant_update_zero_rows(pg):
    a = await _seed(pg, f"RLSX-A-{uuid.uuid4().hex[:6]}")
    b = await _seed(pg, f"RLSX-B-{uuid.uuid4().hex[:6]}")
    try:
        await _set(pg, b["tenant"], b["workspace"], b["user"])
        status = await pg.execute("UPDATE memories SET title = 'pwned' WHERE id = $1", a["memory"])
        assert status.upper().endswith(" 0"), f"cross-tenant UPDATE affected rows: {status}"
        await _set(pg, a["tenant"], a["workspace"], a["user"])
        title = await pg.fetchval("SELECT title FROM memories WHERE id = $1", a["memory"])
        assert "pwned" not in str(title)
    finally:
        await _teardown(pg, a)
        await _teardown(pg, b)


async def test_cross_tenant_delete_zero_rows(pg):
    a = await _seed(pg, f"RLSX-C-{uuid.uuid4().hex[:6]}")
    b = await _seed(pg, f"RLSX-D-{uuid.uuid4().hex[:6]}")
    try:
        await _set(pg, b["tenant"], b["workspace"], b["user"])
        status = await pg.execute("DELETE FROM memories WHERE id = $1", a["memory"])
        assert status.upper().endswith(" 0"), f"cross-tenant DELETE affected rows: {status}"
        await _set(pg, a["tenant"], a["workspace"], a["user"])
        assert await pg.fetchval("SELECT count(*) FROM memories WHERE id = $1", a["memory"]) == 1
    finally:
        await _teardown(pg, a)
        await _teardown(pg, b)


async def test_insert_other_tenant_workspace_denied(pg):
    a = await _seed(pg, f"RLSX-E-{uuid.uuid4().hex[:6]}")
    b = await _seed(pg, f"RLSX-F-{uuid.uuid4().hex[:6]}")
    try:
        # Context of B, row pointed at A's workspace -> WITH CHECK must deny.
        await _set(pg, b["tenant"], b["workspace"], b["user"])
        with pytest.raises(Exception, match="(?i)(policy|permission|violates)"):
            await pg.execute(
                "INSERT INTO memories (workspace_id, user_id, tenant_id, type, title,"
                " content_hash, metadata, tags, size, status)"
                " VALUES ($1, $2, $3, 'profile', 'smuggle', 'h', '{}', '{}', 0, 'PROCESSING')",
                a["workspace"], b["user"], b["tenant"])
    finally:
        await _teardown(pg, a)
        await _teardown(pg, b)


async def test_force_rls_metadata():
    admin = await asyncpg.connect(PG_URL)
    try:
        rows = await admin.fetch(
            "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class"
            " WHERE relname IN ('memories','users','documents')")
        by_name = {r["relname"]: r for r in rows}
        for table in ("memories", "users", "documents"):
            assert table in by_name, f"table {table} missing"
            assert by_name[table]["relrowsecurity"] is True, f"{table} RLS not enabled"
            assert by_name[table]["relforcerowsecurity"] is True, f"{table} FORCE not set"
    finally:
        await admin.close()


async def test_app_role_has_no_bypassrls():
    admin = await asyncpg.connect(PG_URL)
    try:
        row = await admin.fetchrow("SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = $1", APP_USER)
        assert row is not None, "vaeloom_app role missing"
        assert row["rolbypassrls"] is False, "vaeloom_app must NOT have BYPASSRLS"
    finally:
        await admin.close()


async def test_pool_reuse_sequential_ABA_no_leak(pg):
    """One pooled connection reused A -> B -> A: no state leakage between tenants."""
    a = await _seed(pg, f"RLSX-G-{uuid.uuid4().hex[:6]}")
    b = await _seed(pg, f"RLSX-H-{uuid.uuid4().hex[:6]}")
    try:
        await _set(pg, a["tenant"], a["workspace"], a["user"])
        assert await pg.fetchval("SELECT count(*) FROM memories WHERE title LIKE $1", f"{a['tag']}%") == 1
        await _set(pg, b["tenant"], b["workspace"], b["user"])
        assert await pg.fetchval("SELECT count(*) FROM memories WHERE title LIKE $1", f"{a['tag']}%") == 0
        assert await pg.fetchval("SELECT count(*) FROM memories WHERE title LIKE $1", f"{b['tag']}%") == 1
        await _set(pg, a["tenant"], a["workspace"], a["user"])
        assert await pg.fetchval("SELECT count(*) FROM memories WHERE title LIKE $1", f"{a['tag']}%") == 1
        assert await pg.fetchval("SELECT count(*) FROM memories WHERE title LIKE $1", f"{b['tag']}%") == 0
    finally:
        await _teardown(pg, a)
        await _teardown(pg, b)


async def test_concurrent_10_pairs_isolated():
    """10 concurrent tenant/workspace pairs, randomized order: own==1, foreign==0."""
    admin = await asyncpg.connect(PG_URL)
    try:
        has_memories = await admin.fetchval("SELECT to_regclass('public.memories') IS NOT NULL")
        if not has_memories:
            pytest.skip("target DB has no schema")
    finally:
        await admin.close()

    seed_conn = await asyncpg.connect(_app_url())
    ids_list = []
    try:
        for i in range(10):
            ids_list.append(await _seed(seed_conn, f"RLSX-P{i}-{uuid.uuid4().hex[:4]}"))
    finally:
        await seed_conn.close()

    order = list(range(10))
    rng = random.Random(20260907)
    rng.shuffle(order)

    async def _probe(idx: int) -> tuple[int, int, int]:
        conn = await asyncpg.connect(_app_url())
        try:
            ids = ids_list[idx]
            await _set(conn, ids["tenant"], ids["workspace"], ids["user"])
            own = await conn.fetchval("SELECT count(*) FROM memories WHERE title LIKE $1", f"{ids['tag']}%")
            foreign = await conn.fetchval(
                "SELECT count(*) FROM memories WHERE title NOT LIKE $1", f"{ids['tag']}%")
            total_tagged = await conn.fetchval("SELECT count(*) FROM memories WHERE title LIKE 'RLSX-P%'")
            return own, foreign, total_tagged
        finally:
            await conn.close()

    try:
        results = await asyncio.gather(*(_probe(i) for i in order))
        for own, foreign_visible, _ in results:
            assert own == 1
            # Foreign RLSX-P rows from the other 9 pairs must be invisible.
            assert foreign_visible == 0
    finally:
        cleanup = await asyncpg.connect(_app_url())
        try:
            for ids in ids_list:
                await _teardown(cleanup, ids)
        finally:
            await cleanup.close()
