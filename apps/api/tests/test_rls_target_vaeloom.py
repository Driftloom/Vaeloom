"""Live RLS proof for the ``vaeloom_app`` application role.

Proves the deployed role, not a superuser, is the one that is confined:
unset GUCs see zero rows, a workspace sees only its own rows, another
workspace sees none of them, and a write with a mismatched workspace is
refused by the WITH CHECK clause.

Target: a DISPOSABLE PostgreSQL database, named like ``*_proof`` / ``*_test``:

    $env:VAELOOM_TEST_PG_URL="postgresql://postgres:postgres@localhost:5432/vaeloom_rls_proof"

The test creates the ``vaeloom_app`` role and grants on the target database,
so it must never point at a shared or production database. It skips itself
when no disposable target is configured, which is why the core CI suite (no
PostgreSQL service) reports it as skipped rather than failing.
"""
import json
import os
import uuid
from urllib.parse import urlsplit, urlunsplit

import asyncpg
import pytest

PG_URL = os.environ.get("VAELOOM_TEST_PG_URL", "").replace(
    "postgresql+asyncpg://", "postgresql://"
)
REQUIREMENT = "set VAELOOM_TEST_PG_URL to a disposable PG database (*_proof|*_test)"
APP_USER = "vaeloom_app"
APP_PASSWORD = "vaeloom_app_pw"


def _target_db() -> str:
    return PG_URL.rsplit("/", 1)[-1].split("?", 1)[0]


def _app_url() -> str:
    """Same target database, connected as the non-superuser application role.

    Superusers bypass RLS entirely, so the proof traffic must NOT run as one.
    """
    parts = urlsplit(PG_URL)
    netloc = f"{APP_USER}:{APP_PASSWORD}@{parts.hostname}"
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, ""))


pytestmark = pytest.mark.skipif(
    not PG_URL or not _target_db().endswith(("_proof", "_test")),
    reason=REQUIREMENT,
)


@pytest.mark.asyncio
async def test_target_vaeloom_rls_isolation():
    # 1. Setup as admin
    admin_conn = await asyncpg.connect(PG_URL)
    has_schema = await admin_conn.fetchval(
        "SELECT to_regclass('public.memories') IS NOT NULL"
    )
    if not has_schema:
        await admin_conn.close()
        pytest.skip("target DB has no schema; apply the base schema first")
    await admin_conn.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{APP_USER}') THEN
                CREATE ROLE {APP_USER} LOGIN PASSWORD '{APP_PASSWORD}';
            END IF;
        END $$;
        ALTER ROLE {APP_USER} WITH PASSWORD '{APP_PASSWORD}';
        GRANT CONNECT ON DATABASE "{_target_db()}" TO {APP_USER};
        GRANT USAGE ON SCHEMA public TO {APP_USER};
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_USER};
    """)

    tid = uuid.uuid4()
    uid = uuid.uuid4()
    ws_a = uuid.uuid4()
    ws_b = uuid.uuid4()

    # Seed hierarchy: tenant -> user -> workspaces
    await admin_conn.execute(
        "INSERT INTO tenants (id, name, slug, status, isolation, plan, settings, limits, features) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);",
        tid, "Test Tenant", f"tenant-{tid}", "ACTIVE", "shared", "pro", "{}", "{}", []
    )
    await admin_conn.execute(
        "INSERT INTO users (id, email, display_name, auth_provider, status, preferences, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7);",
        uid, f"user-{uid}@test.com", "Test User", "local", "ACTIVE", "{}", tid
    )
    await admin_conn.execute(
        "INSERT INTO workspaces (id, user_id, name) VALUES ($1, $2, $3);",
        ws_a, uid, "Workspace A"
    )
    await admin_conn.execute(
        "INSERT INTO workspaces (id, user_id, name) VALUES ($1, $2, $3);",
        ws_b, uid, "Workspace B"
    )
    await admin_conn.close()

    # 2. Test as application role (vaeloom_app) subject to RLS
    app_conn = await asyncpg.connect(_app_url())

    # Fail-closed check: No GUCs set -> 0 rows visible
    count_noguc = await app_conn.fetchval("SELECT count(*) FROM memories;")
    assert count_noguc == 0, f"Expected 0 without GUCs, got {count_noguc}"

    mem_id = uuid.uuid4()
    tx = app_conn.transaction()
    await tx.start()

    # Set GUC for Workspace A
    await app_conn.execute("SELECT set_config('app.workspace_id', $1, true);", str(ws_a))
    await app_conn.execute(
        """
        INSERT INTO memories (
            id, workspace_id, user_id, type, status, title, content_hash, size, metadata, tags, content, domain
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
        """,
        mem_id, ws_a, uid, "working", "ACTIVE", "Secret Memory", "hash123", 100, json.dumps({}), [], "Secret Workspace A Memory", "profile"
    )

    # Workspace A sees its own row
    rows_a = await app_conn.fetch("SELECT id, content FROM memories;")
    assert len(rows_a) == 1, f"Expected 1 row in workspace A, got {len(rows_a)}"
    assert rows_a[0]["content"] == "Secret Workspace A Memory"

    # Switch GUC to Workspace B -> cross-workspace access denied (0 rows)
    await app_conn.execute("SELECT set_config('app.workspace_id', $1, true);", str(ws_b))
    rows_b = await app_conn.fetch("SELECT id, content FROM memories;")
    assert len(rows_b) == 0, f"Cross-workspace breach! Workspace B saw {len(rows_b)} rows from Workspace A"

    # WITH CHECK verification: Attempting to insert into Workspace A while GUC is Workspace B must fail
    with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
        await app_conn.execute(
            """
            INSERT INTO memories (
                id, workspace_id, user_id, type, status, title, content_hash, size, metadata, tags, content, domain
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
            """,
            uuid.uuid4(), ws_a, uid, "working", "ACTIVE", "Spoofed Memory", "hash999", 50, json.dumps({}), [], "Spoofed", "profile"
        )

    await tx.rollback()
    await app_conn.close()
