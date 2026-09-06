import asyncio
import json
import uuid
import asyncpg
import pytest

@pytest.mark.asyncio
async def test_target_vaeloom_rls_isolation():
    # 1. Setup as admin
    admin_conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/vaeloom")
    await admin_conn.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vaeloom_app') THEN
                CREATE ROLE vaeloom_app LOGIN PASSWORD 'vaeloom_app_pw';
            END IF;
        END $$;
        ALTER ROLE vaeloom_app WITH PASSWORD 'vaeloom_app_pw';
        GRANT CONNECT ON DATABASE vaeloom TO vaeloom_app;
        GRANT USAGE ON SCHEMA public TO vaeloom_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vaeloom_app;
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
    app_conn = await asyncpg.connect("postgresql://vaeloom_app:vaeloom_app_pw@localhost:5432/vaeloom")
    
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
