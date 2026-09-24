"""Tighten RLS service-policy exposure and add SECURITY DEFINER pre-auth lookups.

Revision ID: 0052
Revises: 0051
Create Date: 2026-09-23

Remediates the 25-table service-policy exposure (docs/security/RLS-SERVICE-POLICY-EXPOSURE.md).
Removes vaeloom_app from USING (true) grants so that app database traffic is strictly scoped
by tenant and workspace RLS. Provides hardened SECURITY DEFINER lookup functions for pre-auth
login and session resolution without opening global table access.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0052"
down_revision: Union[str, None] = "0051"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0052"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0052"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0052"))
        print(f"[0052] skipped statement: {e}")


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return

    conn = op.get_bind()
    run = lambda s: _safe(conn, s)

    # 1. SECURITY DEFINER pre-auth lookup functions
    # Hardened against search_path hijacking per Supabase security guidelines.
    run("""
        CREATE OR REPLACE FUNCTION auth_lookup_user_by_email(lookup_email text)
        RETURNS TABLE (
            id uuid,
            email varchar,
            password_hash varchar,
            display_name varchar,
            auth_provider varchar,
            status varchar,
            tenant_id uuid,
            email_verified boolean,
            failed_login_attempts integer,
            locked_until timestamptz,
            mfa_enabled boolean,
            mfa_secret varchar
        )
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT id, email, password_hash, display_name, auth_provider, status, tenant_id, email_verified, failed_login_attempts, locked_until, mfa_enabled, mfa_secret
            FROM public.users
            WHERE LOWER(users.email) = LOWER(lookup_email)
            LIMIT 1;
        $$;
    """)
    run("REVOKE EXECUTE ON FUNCTION auth_lookup_user_by_email(text) FROM PUBLIC, anon, authenticated;")
    run("GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(text) TO vaeloom_app, service_role, postgres;")

    run("""
        CREATE OR REPLACE FUNCTION auth_lookup_session_by_token(lookup_token text)
        RETURNS TABLE (
            id uuid,
            user_id uuid,
            status varchar,
            expires_at timestamptz,
            jti varchar
        )
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT id, user_id, status, expires_at, jti
            FROM public.auth_sessions
            WHERE auth_sessions.token = lookup_token
            LIMIT 1;
        $$;
    """)
    run("REVOKE EXECUTE ON FUNCTION auth_lookup_session_by_token(text) FROM PUBLIC, anon, authenticated;")
    run("GRANT EXECUTE ON FUNCTION auth_lookup_session_by_token(text) TO vaeloom_app, service_role, postgres;")

    # 2. USERS: Remove vaeloom_app from USING (true), install tenant/user/email-scoped policy
    run("DROP POLICY IF EXISTS p_users_service ON public.users;")
    run("""
        CREATE POLICY p_users_service ON public.users FOR ALL
        TO service_role, postgres
        USING (true) WITH CHECK (true);
    """)
    run("DROP POLICY IF EXISTS tenant_isolation_users ON public.users;")
    run("DROP POLICY IF EXISTS p_users_self ON public.users;")
    run("""
        CREATE POLICY tenant_isolation_users ON public.users FOR ALL
        USING (
            tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
            OR id::text = NULLIF(current_setting('app.user_id', true), '')
            OR LOWER(email) = LOWER(NULLIF(current_setting('app.lookup_email', true), ''))
        )
        WITH CHECK (
            tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
            OR id::text = NULLIF(current_setting('app.user_id', true), '')
            OR LOWER(email) = LOWER(NULLIF(current_setting('app.lookup_email', true), ''))
        );
    """)

    # 3. AUTH_SESSIONS: Remove vaeloom_app from USING (true), scope to user_id or lookup_token
    run("DROP POLICY IF EXISTS p_auth_sessions_service ON public.auth_sessions;")
    run("""
        CREATE POLICY p_auth_sessions_service ON public.auth_sessions FOR ALL
        TO service_role, postgres
        USING (true) WITH CHECK (true);
    """)
    run("DROP POLICY IF EXISTS p_auth_sessions_self ON public.auth_sessions;")
    run("DROP POLICY IF EXISTS p_auth_sessions_scoped ON public.auth_sessions;")
    run("""
        CREATE POLICY p_auth_sessions_scoped ON public.auth_sessions FOR ALL
        USING (
            user_id::text = NULLIF(current_setting('app.user_id', true), '')
            OR token = NULLIF(current_setting('app.lookup_token', true), '')
            OR refresh_token = NULLIF(current_setting('app.lookup_token', true), '')
        )
        WITH CHECK (
            user_id::text = NULLIF(current_setting('app.user_id', true), '')
            OR token = NULLIF(current_setting('app.lookup_token', true), '')
            OR refresh_token = NULLIF(current_setting('app.lookup_token', true), '')
        );
    """)

    # 4. ORGANIZATIONS: Remove vaeloom_app from USING (true), enforce tenant_id
    run("DROP POLICY IF EXISTS p_organizations_service ON public.organizations;")
    run("""
        CREATE POLICY p_organizations_service ON public.organizations FOR ALL
        TO service_role, postgres
        USING (true) WITH CHECK (true);
    """)
    run("DROP POLICY IF EXISTS p_organizations_tenant ON public.organizations;")
    run("""
        CREATE POLICY p_organizations_tenant ON public.organizations FOR ALL
        USING (
            tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
        )
        WITH CHECK (
            tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
        );
    """)

    # 5. ORGANIZATION_MEMBERS: Remove vaeloom_app from USING (true), enforce user_id or tenant membership
    run("DROP POLICY IF EXISTS p_organization_members_service ON public.organization_members;")
    run("""
        CREATE POLICY p_organization_members_service ON public.organization_members FOR ALL
        TO service_role, postgres
        USING (true) WITH CHECK (true);
    """)
    run("DROP POLICY IF EXISTS p_organization_members_user ON public.organization_members;")
    run("DROP POLICY IF EXISTS p_organization_members_scoped ON public.organization_members;")
    run("""
        CREATE POLICY p_organization_members_scoped ON public.organization_members FOR ALL
        USING (
            user_id::text = NULLIF(current_setting('app.user_id', true), '')
            OR organization_id IN (
                SELECT id FROM public.organizations 
                WHERE tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
            )
        )
        WITH CHECK (
            user_id::text = NULLIF(current_setting('app.user_id', true), '')
            OR organization_id IN (
                SELECT id FROM public.organizations 
                WHERE tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
            )
        );
    """)

    # 6. TENANT_SCIM_TOKENS: Remove vaeloom_app from USING (true), enforce tenant_id
    run("DROP POLICY IF EXISTS p_tenant_scim_tokens_service ON public.tenant_scim_tokens;")
    run("""
        CREATE POLICY p_tenant_scim_tokens_service ON public.tenant_scim_tokens FOR ALL
        TO service_role, postgres
        USING (true) WITH CHECK (true);
    """)
    run("DROP POLICY IF EXISTS tenant_scim_tokens_tenant_isolation ON public.tenant_scim_tokens;")
    run("""
        CREATE POLICY tenant_scim_tokens_tenant_isolation ON public.tenant_scim_tokens FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        )
        WITH CHECK (
            tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        );
    """)

    # 7. TENANTS: Replace open select with tenant_id / lookup_slug scoping
    run("DROP POLICY IF EXISTS p_tenants_select ON public.tenants;")
    run("""
        CREATE POLICY p_tenants_select ON public.tenants FOR SELECT
        USING (
            id::text = NULLIF(current_setting('app.tenant_id', true), '')
            OR slug = NULLIF(current_setting('app.lookup_slug', true), '')
        );
    """)

    # 8. Remaining service-only tables: Remove vaeloom_app from USING (true)
    other_service_tables = (
        ("consent_records", "p_consent_records_service"),
        ("email_verification_tokens", "p_email_tokens_service"),
        ("onboarding_states", "p_onboarding_states_service"),
        ("organization_invitations", "p_organization_invitations_service"),
        ("revoked_user_cutoffs", "p_cutoffs_service"),
        ("approval_decision", "p_approval_decision_service"),
        ("notification_device_tokens", "p_notification_device_tokens_service"),
        ("memory_taxonomy_ledger", "p_memory_taxonomy_ledger_service"),
        ("workspace_plugin_installs", "p_workspace_plugin_installs_service"),
        ("agent_schedules", "p_agent_schedules_service"),
        ("dead_letter_events", "p_dead_letter_events_service"),
        ("event_subscriptions", "p_event_subscriptions_service"),
        ("job_executions", "p_job_executions_service"),
        ("notification_templates", "p_notification_templates_service"),
        ("plugin_executions", "p_plugin_executions_service"),
        ("webhook_deliveries", "p_webhook_deliveries_service"),
    )
    for table, pol in other_service_tables:
        run(f"DROP POLICY IF EXISTS {pol} ON public.{table};")
        run(f"""
            CREATE POLICY {pol} ON public.{table} FOR ALL
            TO service_role, postgres
            USING (true) WITH CHECK (true);
        """)


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return

    conn = op.get_bind()
    run = lambda s: _safe(conn, s)

    # 1. Restore permissive service policies for vaeloom_app (0047 baseline)
    all_service_tables = (
        ("users", "p_users_service"),
        ("auth_sessions", "p_auth_sessions_service"),
        ("organizations", "p_organizations_service"),
        ("organization_members", "p_organization_members_service"),
        ("tenant_scim_tokens", "p_tenant_scim_tokens_service"),
        ("consent_records", "p_consent_records_service"),
        ("email_verification_tokens", "p_email_tokens_service"),
        ("onboarding_states", "p_onboarding_states_service"),
        ("organization_invitations", "p_organization_invitations_service"),
        ("revoked_user_cutoffs", "p_cutoffs_service"),
        ("approval_decision", "p_approval_decision_service"),
        ("notification_device_tokens", "p_notification_device_tokens_service"),
        ("memory_taxonomy_ledger", "p_memory_taxonomy_ledger_service"),
        ("workspace_plugin_installs", "p_workspace_plugin_installs_service"),
        ("agent_schedules", "p_agent_schedules_service"),
        ("dead_letter_events", "p_dead_letter_events_service"),
        ("event_subscriptions", "p_event_subscriptions_service"),
        ("job_executions", "p_job_executions_service"),
        ("notification_templates", "p_notification_templates_service"),
        ("plugin_executions", "p_plugin_executions_service"),
        ("webhook_deliveries", "p_webhook_deliveries_service"),
    )
    for table, pol in all_service_tables:
        run(f"DROP POLICY IF EXISTS {pol} ON public.{table};")
        run(f"""
            CREATE POLICY {pol} ON public.{table} FOR ALL
            TO service_role, postgres, vaeloom_app
            USING (true) WITH CHECK (true);
        """)

    # 2. Restore open tenants select
    run("DROP POLICY IF EXISTS p_tenants_select ON public.tenants;")
    run("CREATE POLICY p_tenants_select ON public.tenants FOR SELECT TO public USING (true);")

    # 3. Clean up scoped policies added in 0052
    run("DROP POLICY IF EXISTS p_auth_sessions_scoped ON public.auth_sessions;")
    run("DROP POLICY IF EXISTS p_organization_members_scoped ON public.organization_members;")

    # 4. Drop pre-auth lookup helper functions
    run("DROP FUNCTION IF EXISTS auth_lookup_user_by_email(text);")
    run("DROP FUNCTION IF EXISTS auth_lookup_session_by_token(text);")
