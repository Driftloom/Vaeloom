"""Least-privilege runtime role + complete RLS coverage (OP-RLS-01).

Revision ID: 0036
Revises: 0035

Context: the application runtime historically connected as a BYPASSRLS role,
so RLS was non-enforcing for app traffic and 42/71 tables had zero policies.
This migration makes `vaeloom_app` (bypassrls=false) a viable runtime role:

- GRANT schema usage + DML on all present tables + default privileges for
  future tables (DDL itself stays with the owner/migrator role).
- SECURITY DEFINER helpers (fixed search_path) for owner lookup and
  workspace->tenant resolution without RLS recursion.
- Strict GUC-scoped policies for every tenant-data table lacking one.
- Explicit permissive-service policies (USING true) ONLY where pre-auth or
  privileged-background flows fundamentally lack GUC context
  (users/auth_sessions/tenants-directory/auth-adjacent infra). Each is
  documented below; service-layer checks remain authoritative there.
- REVOKE ALL FROM vaeloom_app on migrator-only and dead tables.
- FORCE RLS on every RLS table (constrains owners; no-ops for bypass roles).

Conventions (match 0005..0035): fail-closed NULL GUC semantics via
NULLIF(current_setting('app.<scope>', true), ''); ::text comparison works
for both uuid and varchar columns. All statements idempotent
(DROP POLICY IF EXISTS / GRANT is naturally idempotent).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0036"
down_revision: Union[str, None] = "0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TEN = "NULLIF(current_setting('app.tenant_id', true), '')"
WS = "NULLIF(current_setting('app.workspace_id', true), '')"
USR = "NULLIF(current_setting('app.user_id', true), '')"


def _pol(table: str, name: str, using: str, check: str | None = None,
         cmd: str = "ALL") -> str:
    # PostgreSQL grammar: SELECT/DELETE take USING only; INSERT takes WITH
    # CHECK only; UPDATE/ALL take both.
    chk = check if check is not None else using
    if cmd == "INSERT":
        tail = f"WITH CHECK ({chk})"
    elif cmd in ("SELECT", "DELETE"):
        tail = f"USING ({using})"
    else:
        tail = f"USING ({using}) WITH CHECK ({chk})"
    return (
        f"DROP POLICY IF EXISTS {name} ON {table};\n"
        f"CREATE POLICY {name} ON {table} FOR {cmd} {tail};"
    )


def _safe(conn, sql: str) -> None:
    """One statement per savepoint (PG): a failure rolls back only itself,
    never the whole migration. Prints skips instead of silently passing."""
    conn.execute(sa.text("SAVEPOINT sp_0036"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0036"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0036"))
        print(f"0036 skipped statement ({e}): {sql[:160]}")


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn = op.get_bind()
    run = lambda s: _safe(conn, s)  # noqa: E731

    # 0. Grants: schema usage + present-table DML + future-table defaults.
    run("GRANT USAGE ON SCHEMA public TO vaeloom_app")
    run(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES "
        "IN SCHEMA public TO vaeloom_app"
    )
    run(
        "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vaeloom_app"
    )
    run(
        "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public "
        "GRANT USAGE, SELECT ON SEQUENCES TO vaeloom_app"
    )

    # 1. SECURITY DEFINER helpers (fixed search_path; GRANT EXECUTE).
    run("DROP FUNCTION IF EXISTS app_workspace_owner(uuid)")
    run(
        """
        CREATE FUNCTION app_workspace_owner(ws uuid) RETURNS uuid
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
        $$ SELECT user_id FROM public.workspaces WHERE id = ws $$
        """
    )
    run("DROP FUNCTION IF EXISTS app_tenant_for_workspace(uuid)")
    run(
        """
        CREATE FUNCTION app_tenant_for_workspace(ws uuid) RETURNS uuid
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
        $$ SELECT u.tenant_id FROM public.workspaces w
           JOIN public.users u ON u.id = w.user_id WHERE w.id = ws $$
        """
    )
    run("GRANT EXECUTE ON FUNCTION app_workspace_owner(uuid) TO vaeloom_app")
    run("GRANT EXECUTE ON FUNCTION app_tenant_for_workspace(uuid) TO vaeloom_app")

    # 1b. Backfill NULL tenant_id from workspace ownership (legacy rows that
    # would otherwise go fail-closed-invisible under strict policies).
    for t in ("agents", "approval_request", "connectors", "memories",
              "knowledge_nodes", "learning_events"):
        run(
            f"UPDATE {t} SET tenant_id = app_tenant_for_workspace(workspace_id::uuid) "
            f"WHERE tenant_id IS NULL AND workspace_id IS NOT NULL"
        )

    stmts: list[str] = []

    # 2. Tenant-scoped tables (strict).
    for t in (
        "analytics_events", "audit_events", "scheduled_jobs", "plugins",
        "iam_users", "notification_subscribers", "retention_runs",
    ):
        stmts.append(_pol(t, f"p_{t}_tenant", f"tenant_id::text = {TEN}"))
    for t in ("recommendations", "recommendation_feedback", "user_preference_vectors"):
        stmts.append(_pol(
            t, f"p_{t}_user_tenant",
            f"user_id::text = {USR} AND tenant_id::text = {TEN}",
        ))

    # 3. Workspace/user-scoped tables (strict).
    # NOTE: scale_memory_nodes / sovereign_identities / verifiable_credentials /
    # crdt_sync_deltas are owned by repaired 0033/0034 (strict); not repeated here.
    for t in (
        "document_actions", "feature_flags",
        "gmail_watches",
    ):
        stmts.append(_pol(t, f"p_{t}_workspace", f"workspace_id::text = {WS}"))
    stmts.append(_pol(
        "learning_events", "p_learning_events_scope",
        f"workspace_id::text = {WS} AND tenant_id::text = {TEN}",
    ))
    stmts.append(_pol(
        "loop_checkpoints", "p_loop_checkpoints_workspace",
        f"workspace_id::text = {WS}",
    ))
    stmts.append(_pol(
        "tool_idempotency", "p_tool_idempotency_workspace",
        f"workspace_id::text = {WS}",
    ))
    # agent_executions carries its own tenant+user (no join needed).
    stmts.append(_pol(
        "agent_executions", "p_agent_executions_scope",
        f"tenant_id::text = {TEN} AND user_id::text = {USR}",
    ))
    # knowledge graph: nodes carry tenant+workspace (varchar); edges carry
    # workspace + inherit tenant through their source node (no tenant column).
    stmts.append(_pol(
        "knowledge_nodes", "p_knowledge_nodes_scope",
        f"tenant_id::text = {TEN} AND workspace_id::text = {WS}",
    ))
    stmts.append(_pol(
        "knowledge_edges", "p_knowledge_edges_scope",
        f"workspace_id::text = {WS} AND EXISTS "
        f"(SELECT 1 FROM knowledge_nodes src WHERE src.id = source_id "
        f"AND src.tenant_id::text = {TEN})",
    ))
    # document_versions inherits scope through its parent document.
    stmts.append(_pol(
        "document_versions", "p_document_versions_scope",
        "EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id "
        f"AND d.workspace_id::text = {WS})",
    ))

    # 4. workspaces / workspace_users (owner/member parity with service layer).
    stmts.append(_pol(
        "workspaces", "p_workspaces_select",
        f"user_id::text = {USR} OR EXISTS (SELECT 1 FROM workspace_users m "
        f"WHERE m.workspace_id = workspaces.id AND m.user_id::text = {USR})",
        check="true", cmd="SELECT",
    ))
    stmts.append(_pol(
        "workspaces", "p_workspaces_write",
        f"user_id::text = {USR}",
        check=f"user_id::text = {USR}",
        cmd="ALL",
    ))
    # NOTE: p_workspaces_write(All) would shadow SELECT; Postgres evaluates
    # ALL-policies together with SELECT-policies (OR semantics), so the
    # member-visible SELECT above still applies. Owner-only writes hold.
    stmts.append(_pol(
        "workspace_users", "p_workspace_users_select",
        f"user_id::text = {USR} OR app_workspace_owner(workspace_id)::text = {USR}",
        check="true", cmd="SELECT",
    ))
    stmts.append(_pol(
        "workspace_users", "p_workspace_users_write",
        f"app_workspace_owner(workspace_id)::text = {USR}",
        check=f"app_workspace_owner(workspace_id)::text = {USR}",
        cmd="INSERT",
    ))
    stmts.append(_pol(
        "workspace_users", "p_workspace_users_delete",
        f"app_workspace_owner(workspace_id)::text = {USR} OR user_id::text = {USR}",
        check="true", cmd="DELETE",
    ))
    stmts.append(_pol(
        "workspace_users", "p_workspace_users_update",
        f"app_workspace_owner(workspace_id)::text = {USR}",
        check=f"app_workspace_owner(workspace_id)::text = {USR}",
        cmd="UPDATE",
    ))

    # 5. Explicit permissive-service tables. Rationale: pre-auth flows
    # (signup/login) and privileged background dispatch fundamentally lack
    # GUC context; protection is credential checks + service-layer scoping.
    for t in (
        "users", "auth_sessions",
        "event_subscriptions", "agent_schedules", "dead_letter_events",
        "job_executions", "webhook_deliveries", "notification_templates",
        "plugin_executions",
    ):
        stmts.append(_pol(t, f"p_{t}_service", "true"))
    # tenants: readable directory + service-gated creation; strict writes.
    stmts.append(_pol("tenants", "p_tenants_select", "true", check="true", cmd="SELECT"))
    stmts.append(_pol("tenants", "p_tenants_insert", "true", check="true", cmd="INSERT"))
    stmts.append(_pol(
        "tenants", "p_tenants_write",
        f"id::text = {TEN}", check=f"id::text = {TEN}", cmd="UPDATE",
    ))
    stmts.append(_pol(
        "tenants", "p_tenants_delete",
        f"id::text = {TEN}", check="true", cmd="DELETE",
    ))

    for s in stmts:
        for part in s.split(";\n"):
            part = part.strip()
            if part:
                _safe(conn, part)

    # 5b. Replace legacy fail-open policies with strict tenant-required
    # versions (the `(tenant_id IS NULL) OR ...` form exposed legacy
    # NULL-tenant rows to any workspace context; backfilled in §1b).
    for t in ("agents", "approval_request", "connectors", "memories"):
        _safe(conn, f"DROP POLICY IF EXISTS p_{t}_workspace ON {t}")
        _safe(
            conn,
            f"CREATE POLICY p_{t}_workspace ON {t} FOR ALL "
            f"USING (workspace_id::text = {WS} AND tenant_id::text = {TEN}) "
            f"WITH CHECK (workspace_id::text = {WS} AND tenant_id::text = {TEN})",
        )
    _safe(conn, "DROP POLICY IF EXISTS tenant_isolation_memories ON memories")
    _safe(conn, "DROP POLICY IF EXISTS p_users_tenant ON users")
    _safe(conn, "DROP POLICY IF EXISTS p_workspace_users_workspace ON workspace_users")

    # 6. Revoke runtime role on migrator-only and dead tables.
    for t in (
        "alembic_version", "schema_migrations", "approval_decision",
        "notification_device_tokens", "memory_taxonomy_ledger",
    ):
        _safe(conn, f"REVOKE ALL ON {t} FROM vaeloom_app")

    # 7. FORCE RLS everywhere (constrains owners; no-op for bypass roles).
    tables = conn.execute(
        sa.text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        )
    ).fetchall()
    for (t,) in tables:
        _safe(conn, f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
        _safe(conn, f"ALTER TABLE {t} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn = op.get_bind()
    # Drop policies BEFORE functions (policies depend on the helpers).
    for name, table in [
        ("p_tenants_delete", "tenants"), ("p_tenants_write", "tenants"),
        ("p_tenants_insert", "tenants"), ("p_tenants_select", "tenants"),
        ("p_workspace_users_update", "workspace_users"),
        ("p_workspace_users_delete", "workspace_users"),
        ("p_workspace_users_write", "workspace_users"),
        ("p_workspace_users_select", "workspace_users"),
        ("p_workspaces_write", "workspaces"), ("p_workspaces_select", "workspaces"),
        ("p_document_versions_scope", "document_versions"),
        ("p_knowledge_edges_scope", "knowledge_edges"),
        ("p_knowledge_nodes_scope", "knowledge_nodes"),
        ("p_tool_idempotency_workspace", "tool_idempotency"),
        ("p_agent_executions_scope", "agent_executions"),
        ("p_agents_workspace", "agents"),
        ("p_approval_request_workspace", "approval_request"),
        ("p_connectors_workspace", "connectors"),
        ("p_memories_workspace", "memories"),
        ("p_learning_events_scope", "learning_events"),
        ("p_loop_checkpoints_workspace", "loop_checkpoints"),
    ]:
        _safe(conn, f"DROP POLICY IF EXISTS {name} ON {table}")
    _safe(conn, "DROP POLICY IF EXISTS tenant_isolation_memories ON memories")
    for t in (
        "analytics_events", "audit_events", "scheduled_jobs", "plugins",
        "iam_users", "notification_subscribers", "retention_runs",
        "recommendations", "recommendation_feedback", "user_preference_vectors",
        "document_actions", "feature_flags",
        "gmail_watches", "users", "auth_sessions",
        "event_subscriptions", "agent_schedules", "dead_letter_events",
        "job_executions", "webhook_deliveries", "notification_templates",
        "plugin_executions",
    ):
        _safe(conn, f"DROP POLICY IF EXISTS p_{t}_service ON {t}")
        for suffix in ("_tenant", "_user_tenant", "_workspace", "_user", "_scope"):
            _safe(conn, f"DROP POLICY IF EXISTS p_{t}{suffix} ON {t}")
    _safe(conn, "DROP FUNCTION IF EXISTS app_workspace_owner(uuid)")
    _safe(conn, "DROP FUNCTION IF EXISTS app_tenant_for_workspace(uuid)")
    for t in (
        "alembic_version", "schema_migrations", "approval_decision",
        "notification_device_tokens", "memory_taxonomy_ledger",
    ):
        _safe(
            conn,
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON {t} TO vaeloom_app",
        )
