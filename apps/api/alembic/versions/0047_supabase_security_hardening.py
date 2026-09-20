"""Supabase Security Advisor hardening: move vector extension, restrict permissive RLS policies, revoke anon/authenticated from SECURITY DEFINER functions, and add missing RLS policies.

Revision ID: 0047
Revises: 0046
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0047"
down_revision: Union[str, None] = "0046"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0047"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0047"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0047"))
        print(f"0047 skipped statement ({e}): {sql[:140]}")


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn = op.get_bind()
    run = lambda s: _safe(conn, s)

    # 1. Move vector extension from public to extensions schema
    run("CREATE SCHEMA IF NOT EXISTS extensions")
    run("ALTER EXTENSION vector SET SCHEMA extensions")

    # 2. Revoke public/anon/authenticated execution on SECURITY DEFINER functions
    for func in (
        "app_agent_scope(uuid)",
        "app_gmail_watch_scope(text, text)",
        "app_tenant_for_workspace(uuid)",
        "app_workspace_owner(uuid)",
    ):
        run(f"REVOKE EXECUTE ON FUNCTION public.{func} FROM PUBLIC, anon, authenticated")
        run(f"GRANT EXECUTE ON FUNCTION public.{func} TO service_role, postgres")
        run(f"GRANT EXECUTE ON FUNCTION public.{func} TO vaeloom_app")

    # 3. Restrict permissive RLS policies from PUBLIC to service_role, vaeloom_app, postgres
    # Ensure vaeloom_app role exists or fallback gracefully
    run("DO $$ BEGIN CREATE ROLE vaeloom_app; EXCEPTION WHEN duplicate_object THEN NULL; END $$")

    service_tables = (
        ("agent_schedules", "p_agent_schedules_service"),
        ("auth_sessions", "p_auth_sessions_service"),
        ("consent_records", "p_consent_records_service"),
        ("dead_letter_events", "p_dead_letter_events_service"),
        ("email_verification_tokens", "p_email_tokens_service"),
        ("event_subscriptions", "p_event_subscriptions_service"),
        ("job_executions", "p_job_executions_service"),
        ("notification_templates", "p_notification_templates_service"),
        ("onboarding_states", "p_onboarding_states_service"),
        ("plugin_executions", "p_plugin_executions_service"),
        ("revoked_user_cutoffs", "p_cutoffs_service"),
        ("users", "p_users_service"),
        ("webhook_deliveries", "p_webhook_deliveries_service"),
    )

    for table, pol_name in service_tables:
        run(f"DROP POLICY IF EXISTS {pol_name} ON public.{table}")
        run(
            f"CREATE POLICY {pol_name} ON public.{table} FOR ALL "
            f"TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
        )

    # tenants insert policy
    run("DROP POLICY IF EXISTS p_tenants_insert ON public.tenants")
    run(
        "CREATE POLICY p_tenants_insert ON public.tenants FOR INSERT "
        "TO service_role, postgres, vaeloom_app WITH CHECK (true)"
    )

    # User self-scoped policies for authenticated PostgREST users (Defense-in-depth)
    run("DROP POLICY IF EXISTS p_users_self ON public.users")
    run(
        "CREATE POLICY p_users_self ON public.users FOR SELECT TO authenticated "
        "USING (id = auth.uid() OR id::text = NULLIF(current_setting('app.user_id', true), ''))"
    )

    run("DROP POLICY IF EXISTS p_auth_sessions_self ON public.auth_sessions")
    run(
        "CREATE POLICY p_auth_sessions_self ON public.auth_sessions FOR SELECT TO authenticated "
        "USING (user_id = auth.uid() OR user_id::text = NULLIF(current_setting('app.user_id', true), ''))"
    )

    run("DROP POLICY IF EXISTS p_onboarding_states_self ON public.onboarding_states")
    run(
        "CREATE POLICY p_onboarding_states_self ON public.onboarding_states FOR ALL TO authenticated "
        "USING (user_id = auth.uid() OR user_id::text = NULLIF(current_setting('app.user_id', true), '')) "
        "WITH CHECK (user_id = auth.uid() OR user_id::text = NULLIF(current_setting('app.user_id', true), ''))"
    )

    # 4. Add policies for tables with RLS enabled but no policies (Info items)
    # Migration tables: service only
    for mig_table in ("alembic_version", "schema_migrations"):
        run(f"DROP POLICY IF EXISTS p_{mig_table}_service ON public.{mig_table}")
        run(
            f"CREATE POLICY p_{mig_table}_service ON public.{mig_table} FOR ALL "
            f"TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
        )

    # approval_decision
    run("DROP POLICY IF EXISTS p_approval_decision_service ON public.approval_decision")
    run(
        "CREATE POLICY p_approval_decision_service ON public.approval_decision FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )
    run("DROP POLICY IF EXISTS p_approval_decision_user ON public.approval_decision")
    run(
        "CREATE POLICY p_approval_decision_user ON public.approval_decision FOR ALL TO authenticated "
        "USING (decided_by = auth.uid() OR decided_by::text = NULLIF(current_setting('app.user_id', true), '')) "
        "WITH CHECK (decided_by = auth.uid() OR decided_by::text = NULLIF(current_setting('app.user_id', true), ''))"
    )

    # marketplace_listings
    run("DROP POLICY IF EXISTS p_marketplace_listings_select ON public.marketplace_listings")
    run("CREATE POLICY p_marketplace_listings_select ON public.marketplace_listings FOR SELECT TO authenticated, anon USING (true)")
    run("DROP POLICY IF EXISTS p_marketplace_listings_service ON public.marketplace_listings")
    run(
        "CREATE POLICY p_marketplace_listings_service ON public.marketplace_listings FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )

    # marketplace_reviews
    run("DROP POLICY IF EXISTS p_marketplace_reviews_select ON public.marketplace_reviews")
    run("CREATE POLICY p_marketplace_reviews_select ON public.marketplace_reviews FOR SELECT TO authenticated, anon USING (true)")
    run("DROP POLICY IF EXISTS p_marketplace_reviews_service ON public.marketplace_reviews")
    run(
        "CREATE POLICY p_marketplace_reviews_service ON public.marketplace_reviews FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )
    run("DROP POLICY IF EXISTS p_marketplace_reviews_user ON public.marketplace_reviews")
    run(
        "CREATE POLICY p_marketplace_reviews_user ON public.marketplace_reviews FOR ALL TO authenticated "
        "USING (user_id = auth.uid() OR user_id::text = NULLIF(current_setting('app.user_id', true), '')) "
        "WITH CHECK (user_id = auth.uid() OR user_id::text = NULLIF(current_setting('app.user_id', true), ''))"
    )

    # memory_taxonomy_ledger (internal ledger, no tenant_id column)
    run("DROP POLICY IF EXISTS p_memory_taxonomy_ledger_service ON public.memory_taxonomy_ledger")
    run(
        "CREATE POLICY p_memory_taxonomy_ledger_service ON public.memory_taxonomy_ledger FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )
    run("DROP POLICY IF EXISTS p_memory_taxonomy_ledger_tenant ON public.memory_taxonomy_ledger")

    # notification_device_tokens (token/payload/created_at, no user_id column)
    run("DROP POLICY IF EXISTS p_notification_device_tokens_service ON public.notification_device_tokens")
    run(
        "CREATE POLICY p_notification_device_tokens_service ON public.notification_device_tokens FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )
    run("DROP POLICY IF EXISTS p_notification_device_tokens_user ON public.notification_device_tokens")

    # organizations (tenant_id, workspace_id, no owner_id column)
    run("DROP POLICY IF EXISTS p_organizations_service ON public.organizations")
    run(
        "CREATE POLICY p_organizations_service ON public.organizations FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )
    run("DROP POLICY IF EXISTS p_organizations_user ON public.organizations")
    run(
        "CREATE POLICY p_organizations_tenant ON public.organizations FOR SELECT TO authenticated "
        "USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))"
    )

    # organization_members
    run("DROP POLICY IF EXISTS p_organization_members_service ON public.organization_members")
    run(
        "CREATE POLICY p_organization_members_service ON public.organization_members FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )
    run("DROP POLICY IF EXISTS p_organization_members_user ON public.organization_members")
    run(
        "CREATE POLICY p_organization_members_user ON public.organization_members FOR SELECT TO authenticated "
        "USING (user_id = auth.uid() OR user_id::text = NULLIF(current_setting('app.user_id', true), ''))"
    )

    # organization_invitations
    run("DROP POLICY IF EXISTS p_organization_invitations_service ON public.organization_invitations")
    run(
        "CREATE POLICY p_organization_invitations_service ON public.organization_invitations FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )

    # tenant_scim_tokens
    run("DROP POLICY IF EXISTS p_tenant_scim_tokens_service ON public.tenant_scim_tokens")
    run(
        "CREATE POLICY p_tenant_scim_tokens_service ON public.tenant_scim_tokens FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )
    run("DROP POLICY IF EXISTS tenant_scim_tokens_tenant_isolation ON public.tenant_scim_tokens")
    run(
        "CREATE POLICY tenant_scim_tokens_tenant_isolation ON public.tenant_scim_tokens FOR ALL TO authenticated "
        "USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) "
        "WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)"
    )

    # workspace_plugin_installs
    run("DROP POLICY IF EXISTS p_workspace_plugin_installs_service ON public.workspace_plugin_installs")
    run(
        "CREATE POLICY p_workspace_plugin_installs_service ON public.workspace_plugin_installs FOR ALL "
        "TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)"
    )
    run("DROP POLICY IF EXISTS p_workspace_plugin_installs_workspace ON public.workspace_plugin_installs")
    run(
        "CREATE POLICY p_workspace_plugin_installs_workspace ON public.workspace_plugin_installs FOR ALL TO authenticated "
        "USING (workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')) "
        "WITH CHECK (workspace_id::text = NULLIF(current_setting('app.workspace_id', true), ''))"
    )


def downgrade() -> None:
    pass
