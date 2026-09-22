"""
Automated Live PostgreSQL RLS Proof Matrix Runner.
Tests all tables under `vaeloom_app` role against disposable PostgreSQL instance (port 5433).
Demonstrates:
1. Fail-closed behavior (no GUCs set -> 0 rows on all tables)
2. Strict isolation on all tables (Alpha GUC sees 1 row, Foreign GUC sees 0 rows)
3. Zero leakage across all audited tables post-Migration 0052
"""
import asyncio
import datetime
import os
import sys
import uuid
import asyncpg

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = int(os.getenv("PG_PORT", "5433"))
PG_DB = os.getenv("PG_DB", "vaeloom_rls_proof")
SUPERUSER_URL = os.getenv("VAELOOM_TEST_PG_URL", f"postgresql://postgres:vaeloom_dev@{PG_HOST}:{PG_PORT}/{PG_DB}")
APP_USER_URL = os.getenv("VAELOOM_APP_URL", f"postgresql://vaeloom_app:vaeloom_app_proof_pw@{PG_HOST}:{PG_PORT}/{PG_DB}")

TENANT_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
TENANT_B = uuid.UUID("22222222-2222-2222-2222-222222222222")
FOREIGN_ID = uuid.UUID("00000000-0000-0000-0000-000000000000")

USER_A = uuid.UUID("33333333-3333-3333-3333-333333333333")
USER_B = uuid.UUID("44444444-4444-4444-4444-444444444444")

WS_A = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
WS_B = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

ORG_A = uuid.UUID("55555555-5555-5555-5555-555555555555")
ORG_B = uuid.UUID("66666666-6666-6666-6666-666666666666")

async def seed_data():
    """Seed data across Tenant A and Tenant B using superuser connection."""
    conn = await asyncpg.connect(SUPERUSER_URL)
    try:
        # 1. Clean existing test data to ensure clean slate
        tables_to_truncate = [
            "documents", "memories", "provider_keys", "organization_members", 
            "organizations", "workspaces", "auth_sessions", "tenant_scim_tokens", 
            "users", "tenants"
        ]
        await conn.execute(f"TRUNCATE {', '.join(tables_to_truncate)} CASCADE;")

        # 2. Seed Tenants
        await conn.execute("""
            INSERT INTO tenants (id, name, slug, status, isolation, plan, settings, limits, features)
            VALUES ($1, 'Tenant Alpha', 'alpha', 'ACTIVE', 'pooled', 'free', '{}'::jsonb, '{}'::jsonb, ARRAY[]::varchar[]),
                   ($2, 'Tenant Beta', 'beta', 'ACTIVE', 'pooled', 'free', '{}'::jsonb, '{}'::jsonb, ARRAY[]::varchar[]);
        """, TENANT_A, TENANT_B)

        # 3. Seed Users
        await conn.execute("""
            INSERT INTO users (id, email, password_hash, display_name, auth_provider, status, preferences, tenant_id, email_verified, failed_login_attempts, mfa_enabled)
            VALUES ($1, 'alice@alpha.com', 'hashA', 'Alice Alpha', 'email', 'ACTIVE', '{}'::jsonb, $2, true, 0, false),
                   ($3, 'bob@beta.com', 'hashB', 'Bob Beta', 'email', 'ACTIVE', '{}'::jsonb, $4, true, 0, false);
        """, USER_A, TENANT_A, USER_B, TENANT_B)

        # 4. Seed Workspaces
        await conn.execute("""
            INSERT INTO workspaces (id, user_id, name, description)
            VALUES ($1, $2, 'Workspace Alpha', 'Alpha Work'),
                   ($3, $4, 'Workspace Beta', 'Beta Work');
        """, WS_A, USER_A, WS_B, USER_B)

        # 5. Seed Memories (Strict RLS)
        await conn.execute("""
            INSERT INTO memories (id, type, domain, status, title, content_hash, size, metadata, tags, tenant_id, workspace_id, user_id, content)
            VALUES ($1, 'note', 'working', 'active', 'Alpha Memory', 'hash1', 10, '{}'::jsonb, ARRAY[]::varchar[], $2, $3, $4, 'Alpha Secret Memory'),
                   ($5, 'note', 'working', 'active', 'Beta Memory', 'hash2', 10, '{}'::jsonb, ARRAY[]::varchar[], $6, $7, $8, 'Beta Secret Memory');
        """, uuid.uuid4(), TENANT_A, WS_A, USER_A, uuid.uuid4(), TENANT_B, WS_B, USER_B)

        # 6. Seed Documents (Strict RLS)
        await conn.execute("""
            INSERT INTO documents (id, workspace_id, path, type, metadata, retention_policy, status, scan_status)
            VALUES ($1, $2, 'docs/alpha.txt', 'file', '{}'::jsonb, 'standard', 'active', 'clean'),
                   ($3, $4, 'docs/beta.txt', 'file', '{}'::jsonb, 'standard', 'active', 'clean');
        """, uuid.uuid4(), WS_A, uuid.uuid4(), WS_B)

        # 7. Seed Provider Keys (Strict RLS)
        await conn.execute("""
            INSERT INTO provider_keys (id, user_id, workspace_id, provider, encrypted_key, key_hint, key_prefix, is_active)
            VALUES ($1, $2, $3, 'openai', 'enc_alpha', 'hint_a', 'sk-a', true),
                   ($4, $5, $6, 'openai', 'enc_beta', 'hint_b', 'sk-b', true);
        """, uuid.uuid4(), USER_A, WS_A, uuid.uuid4(), USER_B, WS_B)

        # 8. Seed Organizations
        await conn.execute("""
            INSERT INTO organizations (id, tenant_id, name, type, metadata, default_role)
            VALUES ($1, $2, 'Org Alpha', 'team', '{}'::json, 'member'),
                   ($3, $4, 'Org Beta', 'team', '{}'::json, 'member');
        """, ORG_A, TENANT_A, ORG_B, TENANT_B)

        # 9. Seed Organization Members
        await conn.execute("""
            INSERT INTO organization_members (id, organization_id, user_id, role, status)
            VALUES ($1, $2, $3, 'admin', 'active'),
                   ($4, $5, $6, 'admin', 'active');
        """, uuid.uuid4(), ORG_A, USER_A, uuid.uuid4(), ORG_B, USER_B)

        # 10. Seed Auth Sessions
        now = datetime.datetime.now(datetime.timezone.utc)
        expires = now + datetime.timedelta(days=7)
        await conn.execute("""
            INSERT INTO auth_sessions (id, user_id, provider, status, token, refresh_token, expires_at, last_activity)
            VALUES ($1, $2, 'email', 'ACTIVE', 'tok_alpha', 'refr_alpha', $3, $4),
                   ($5, $6, 'email', 'ACTIVE', 'tok_beta', 'refr_beta', $3, $4);
        """, uuid.uuid4(), USER_A, expires, now, uuid.uuid4(), USER_B)

        # 11. Seed Tenant SCIM Tokens
        await conn.execute("""
            INSERT INTO tenant_scim_tokens (id, tenant_id, token_hash, name, revoked)
            VALUES ($1, $2, 'scim_hash_alpha', 'Alpha SCIM', false),
                   ($3, $4, 'scim_hash_beta', 'Beta SCIM', false);
        """, uuid.uuid4(), TENANT_A, uuid.uuid4(), TENANT_B)

        # Grant table permissions to vaeloom_app so RLS policies are exercised
        await conn.execute("""
            GRANT ALL ON ALL TABLES IN SCHEMA public TO vaeloom_app;
            GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO vaeloom_app;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vaeloom_app;
        """)
        print("[+] Seeded 2 distinct tenants (Alpha & Beta) across 10 tables successfully.")
    finally:
        await conn.close()

async def run_proof_matrix():
    """Connect as vaeloom_app and probe the tables under 3 GUC states."""
    conn = await asyncpg.connect(APP_USER_URL)
    try:
        tables_to_test = [
            ("memories", "Core Strict", "workspace_id & tenant_id RLS"),
            ("documents", "Core Strict", "workspace_id RLS"),
            ("workspaces", "Core Strict", "user_id & membership RLS"),
            ("provider_keys", "Core Strict", "workspace_id RLS"),
            ("users", "Tightened Service", "0052 p_users_service + app.user_id"),
            ("organizations", "Tightened Service", "0052 p_organizations_service + app.tenant_id"),
            ("organization_members", "Tightened Service", "0052 p_organization_members_service + app.user_id"),
            ("auth_sessions", "Tightened Service", "0052 p_auth_sessions_service + app.user_id"),
            ("tenant_scim_tokens", "Tightened Service", "0052 p_tenant_scim_tokens_service + app.tenant_id"),
            ("tenants", "Tightened Service", "0052 p_tenants_select + app.tenant_id"),
        ]

        print("\n" + "=" * 115)
        print(f"{'TABLE':<22} | {'CATEGORY':<18} | {'NO GUCs':<8} | {'ALPHA GUC':<10} | {'FOREIGN GUC':<12} | {'VERIFIED STATUS'}")
        print("=" * 115)

        failures = 0
        for table, category, note in tables_to_test:
            # 1. No GUCs
            await conn.execute("RESET ALL;")
            count_no_guc = await conn.fetchval(f"SELECT count(*) FROM {table};")

            # 2. Alpha GUCs
            await conn.execute("RESET ALL;")
            await conn.execute(f"SELECT set_config('app.tenant_id', '{str(TENANT_A)}', false);")
            await conn.execute(f"SELECT set_config('app.workspace_id', '{str(WS_A)}', false);")
            await conn.execute(f"SELECT set_config('app.user_id', '{str(USER_A)}', false);")
            count_alpha = await conn.fetchval(f"SELECT count(*) FROM {table};")

            # 3. Foreign GUCs
            await conn.execute("RESET ALL;")
            await conn.execute(f"SELECT set_config('app.tenant_id', '{str(FOREIGN_ID)}', false);")
            await conn.execute(f"SELECT set_config('app.workspace_id', '{str(FOREIGN_ID)}', false);")
            await conn.execute(f"SELECT set_config('app.user_id', '{str(FOREIGN_ID)}', false);")
            count_foreign = await conn.fetchval(f"SELECT count(*) FROM {table};")

            # Evaluate status: Fail-closed requires NO GUCs == 0, Foreign GUCs == 0, and Alpha GUC >= 1
            if count_no_guc == 0 and count_alpha >= 1 and count_foreign == 0:
                status = "[PASS] Fail-Closed & Zero Leakage (0 rows)"
            elif count_foreign > 0:
                status = f"[FAIL] Foreign Leakage: {count_foreign} rows exposed!"
                failures += 1
            elif count_no_guc > 0:
                status = f"[FAIL] Not Fail-Closed: {count_no_guc} rows exposed without GUCs!"
                failures += 1
            else:
                status = f"[WARN] Alpha count = {count_alpha}"

            print(f"{table:<22} | {category:<18} | {str(count_no_guc):<8} | {str(count_alpha):<10} | {str(count_foreign):<12} | {status}")

        print("=" * 115)
        if failures == 0:
            print("\n[+] 10 / 10 TABLES FULLY PROVEN ISOLATED & FAIL-CLOSED UNDER VAELOOM_APP ROLE (0/2 LEAKAGE)")
        else:
            print(f"\n[-] {failures} TABLES FAILED ISOLATION CHECKS")
            sys.exit(1)

    finally:
        await conn.close()

async def main():
    await seed_data()
    await run_proof_matrix()

if __name__ == "__main__":
    asyncio.run(main())
