"""Scoped vaeloom_app RLS policies for pre-auth and worker tables.

Revision ID: 0053
Revises: 0052
Create Date: 2026-09-23

Context: 0052 removed vaeloom_app from USING (true) service grants (correct
direction), but left tables with NO vaeloom_app-readable policy at all. The app
runtime connects as vaeloom_app, so pre-auth flows (login session insert,
verify-email, resend, invite accept, cutoff reads) and worker tables lost all
DB access. Code now sets transaction-scoped lookup GUCs on those paths
(auth_service, organization_service); this migration adds the matching
narrow policies.

Two classes:
A. SCOPED policies (preferred): token-hash / user_id / tenant_id / workspace_id
   GUC branches. Least privilege preserved.
B. RESTORED USING (true) for vaeloom_app ONLY where the table has NO scope
   column at all (pure-operational tables). Each is an explicit accepted risk,
   documented inline — reverting these to service_role-only would silently
   break schedulers/workers with no scoped alternative possible.

Loop-3 vertical slice; staging MUST re-prove (negative matrix + login +
verify-email + invite-accept + scheduler tick) before prod.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0053"
down_revision: Union[str, None] = "0052"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0053"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0053"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0053"))
        print(f"[0053] skipped statement: {e}")


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return

    conn = op.get_bind()
    run = lambda s: _safe(conn, s)

    GUC_USER = "NULLIF(current_setting('app.user_id', true), '')"
    GUC_TENANT = "NULLIF(current_setting('app.tenant_id', true), '')"
    GUC_WS = "NULLIF(current_setting('app.workspace_id', true), '')"
    GUC_TOKEN = "NULLIF(current_setting('app.lookup_token', true), '')"
    GUC_TOKEN_HASH = "NULLIF(current_setting('app.lookup_token_hash', true), '')"

    # 1. AUTH_SESSIONS: refresh flow looks up by refresh_token, but 0052's
    # scoped policy only matches the access-token column. Add the branch.
    run("DROP POLICY IF EXISTS p_auth_sessions_scoped ON public.auth_sessions;")
    run(f"""
        CREATE POLICY p_auth_sessions_scoped ON public.auth_sessions FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (
            user_id::text = {GUC_USER}
            OR token = {GUC_TOKEN}
            OR refresh_token = {GUC_TOKEN}
        )
        WITH CHECK (
            user_id::text = {GUC_USER}
            OR token = {GUC_TOKEN}
            OR refresh_token = {GUC_TOKEN}
        );
    """)

    # 2. EMAIL_VERIFICATION_TOKENS: pre-auth verify/resend by token hash.
    run("DROP POLICY IF EXISTS p_email_tokens_lookup ON public.email_verification_tokens;")
    run(f"""
        CREATE POLICY p_email_tokens_lookup ON public.email_verification_tokens FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (
            token_hash = {GUC_TOKEN_HASH}
            OR user_id::text = {GUC_USER}
        )
        WITH CHECK (
            token_hash = {GUC_TOKEN_HASH}
            OR user_id::text = {GUC_USER}
        );
    """)

    # 3. ORGANIZATION_INVITATIONS: accept by token hash; manage by tenant.
    run("DROP POLICY IF EXISTS p_invitations_lookup ON public.organization_invitations;")
    run(f"""
        CREATE POLICY p_invitations_lookup ON public.organization_invitations FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (
            token_hash = {GUC_TOKEN_HASH}
            OR tenant_id = {GUC_TENANT}::uuid
        )
        WITH CHECK (
            token_hash = {GUC_TOKEN_HASH}
            OR tenant_id = {GUC_TENANT}::uuid
        );
    """)

    # 4. ONBOARDING_STATES: owner or tenant scope.
    run("DROP POLICY IF EXISTS p_onboarding_user ON public.onboarding_states;")
    run(f"""
        CREATE POLICY p_onboarding_user ON public.onboarding_states FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (
            user_id::text = {GUC_USER}
            OR tenant_id::text = {GUC_TENANT}
        )
        WITH CHECK (
            user_id::text = {GUC_USER}
            OR tenant_id::text = {GUC_TENANT}
        );
    """)

    # 5. CONSENT_RECORDS: owner or tenant scope (written at signup).
    run("DROP POLICY IF EXISTS p_consent_user ON public.consent_records;")
    run(f"""
        CREATE POLICY p_consent_user ON public.consent_records FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (
            user_id::text = {GUC_USER}
            OR tenant_id::text = {GUC_TENANT}
        )
        WITH CHECK (
            user_id::text = {GUC_USER}
            OR tenant_id::text = {GUC_TENANT}
        );
    """)

    # 6. REVOKED_USER_CUTOFFS: read by user_id at auth time.
    run("DROP POLICY IF EXISTS p_cutoffs_user ON public.revoked_user_cutoffs;")
    run(f"""
        CREATE POLICY p_cutoffs_user ON public.revoked_user_cutoffs FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (user_id::text = {GUC_USER})
        WITH CHECK (user_id::text = {GUC_USER});
    """)

    # 7. APPROVAL_DECISION: decider scope for the app role.
    run("DROP POLICY IF EXISTS p_approval_user ON public.approval_decision;")
    run(f"""
        CREATE POLICY p_approval_user ON public.approval_decision FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (decided_by::text = {GUC_USER})
        WITH CHECK (decided_by::text = {GUC_USER});
    """)

    # 8. WORKSPACE_PLUGIN_INSTALLS: workspace scope for the app role.
    run("DROP POLICY IF EXISTS p_plugin_installs_workspace ON public.workspace_plugin_installs;")
    run(f"""
        CREATE POLICY p_plugin_installs_workspace ON public.workspace_plugin_installs FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (workspace_id::text = {GUC_WS})
        WITH CHECK (workspace_id::text = {GUC_WS});
    """)

    # 9. DEAD_LETTER_EVENTS / WEBHOOK_DELIVERIES: tenant (+workspace) scope.
    run("DROP POLICY IF EXISTS p_deadletter_scope ON public.dead_letter_events;")
    run(f"""
        CREATE POLICY p_deadletter_scope ON public.dead_letter_events FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (
            tenant_id::text = {GUC_TENANT}
            OR workspace_id::text = {GUC_WS}
        )
        WITH CHECK (
            tenant_id::text = {GUC_TENANT}
            OR workspace_id::text = {GUC_WS}
        );
    """)
    run("DROP POLICY IF EXISTS p_webhook_scope ON public.webhook_deliveries;")
    run(f"""
        CREATE POLICY p_webhook_scope ON public.webhook_deliveries FOR ALL
        TO vaeloom_app, service_role, postgres
        USING (tenant_id::text = {GUC_TENANT})
        WITH CHECK (tenant_id::text = {GUC_TENANT});
    """)

    # 10. ACCEPTED RISK restores: tables with NO user/tenant/workspace/token
    # column cannot be scoped — vaeloom_app keeps USING (true). These are
    # pure-operational (scheduler/worker plumbing, global templates, internal
    # ledger, device tokens keyed by opaque token). Revisit if columns are added.
    scopeless = (
        ("agent_schedules", "p_agent_schedules_service"),
        ("event_subscriptions", "p_event_subscriptions_service"),
        ("job_executions", "p_job_executions_service"),
        ("notification_templates", "p_notification_templates_service"),
        ("plugin_executions", "p_plugin_executions_service"),
        ("memory_taxonomy_ledger", "p_memory_taxonomy_ledger_service"),
        ("notification_device_tokens", "p_notification_device_tokens_service"),
    )
    for table, pol in scopeless:
        run(f"DROP POLICY IF EXISTS {pol} ON public.{table};")
        run(f"""
            CREATE POLICY {pol} ON public.{table} FOR ALL
            TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true);
        """)


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return

    conn = op.get_bind()
    run = lambda s: _safe(conn, s)

    # Remove scoped app policies; restore 0052 service_role-only grants.
    scoped = (
        ("public.auth_sessions", "p_auth_sessions_scoped"),
        ("public.email_verification_tokens", "p_email_tokens_lookup"),
        ("public.organization_invitations", "p_invitations_lookup"),
        ("public.onboarding_states", "p_onboarding_user"),
        ("public.consent_records", "p_consent_user"),
        ("public.revoked_user_cutoffs", "p_cutoffs_user"),
        ("public.approval_decision", "p_approval_user"),
        ("public.workspace_plugin_installs", "p_plugin_installs_workspace"),
        ("public.dead_letter_events", "p_deadletter_scope"),
        ("public.webhook_deliveries", "p_webhook_scope"),
    )
    for table, pol in scoped:
        run(f"DROP POLICY IF EXISTS {pol} ON {table};")
    # NOTE: does not recreate 0052 grants (re-run upgrade, or downgrade to
    # 0051 then back up through 0052, for a clean baseline).
