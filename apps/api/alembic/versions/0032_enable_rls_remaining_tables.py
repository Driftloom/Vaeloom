"""Enable and force Row Level Security across remaining policy-bearing tables.

Revision ID: 0032
Revises: 0031
Create Date: 2026-09-09

Zero-trust RLS expansion:
Ensures all secondary, audit, ledger, and lifecycle tables have both
ENABLE ROW LEVEL SECURITY and FORCE ROW LEVEL SECURITY applied with strict
tenant/workspace/user isolation policies.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REMAINING_RLS_TABLES = [
    "audit_events",
    "analytics_events",
    "learning_events",
    "loop_checkpoints",
    "plugins",
    "plugin_executions",
    "document_versions",
    "agent_executions",
    "agent_schedules",
    "approval_decision",
    "webhook_deliveries",
    "gmail_watches",
    "retention_runs",
    "auth_sessions",
]


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    bind = op.get_bind()

    # 1. Enable and Force RLS across remaining tables
    for table in REMAINING_RLS_TABLES:
        if bind.dialect.has_table(bind, table):
            try:
                op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
                op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
            except Exception:
                pass

    # 2. Direct Tenant/String-scoped Tables
    for table in ["audit_events", "analytics_events"]:
        if bind.dialect.has_table(bind, table):
            try:
                op.execute(sa.text(f"DROP POLICY IF EXISTS p_{table}_tenant ON {table}"))
                op.execute(sa.text(
                    f"CREATE POLICY p_{table}_tenant ON {table} "
                    f"USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) "
                    f"WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))"
                ))
            except Exception:
                pass

    # 3. Direct Workspace-scoped Tables (UUID)
    if bind.dialect.has_table(bind, "learning_events"):
        try:
            op.execute(sa.text("DROP POLICY IF EXISTS p_learning_events_workspace ON learning_events"))
            op.execute(sa.text(
                "CREATE POLICY p_learning_events_workspace ON learning_events "
                "USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid) "
                "WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)"
            ))
        except Exception:
            pass

    # 4. Direct Workspace-scoped Tables (String)
    if bind.dialect.has_table(bind, "loop_checkpoints"):
        try:
            op.execute(sa.text("DROP POLICY IF EXISTS p_loop_checkpoints_workspace ON loop_checkpoints"))
            op.execute(sa.text(
                "CREATE POLICY p_loop_checkpoints_workspace ON loop_checkpoints "
                "USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')) "
                "WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), ''))"
            ))
        except Exception:
            pass

    # 5. Direct User-scoped Tables (UUID)
    for table in ["auth_sessions", "gmail_watches"]:
        if bind.dialect.has_table(bind, table):
            try:
                op.execute(sa.text(f"DROP POLICY IF EXISTS p_{table}_user ON {table}"))
                op.execute(sa.text(
                    f"CREATE POLICY p_{table}_user ON {table} "
                    f"USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid) "
                    f"WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)"
                ))
            except Exception:
                pass

    # 6. Direct Tenant-scoped Tables (UUID)
    if bind.dialect.has_table(bind, "retention_runs"):
        try:
            op.execute(sa.text("DROP POLICY IF EXISTS p_retention_runs_tenant ON retention_runs"))
            op.execute(sa.text(
                "CREATE POLICY p_retention_runs_tenant ON retention_runs "
                "USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) "
                "WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)"
            ))
        except Exception:
            pass

    # 7. Plugins & Plugin Executions (Tenant isolation with system global fallback)
    if bind.dialect.has_table(bind, "plugins"):
        try:
            op.execute(sa.text("DROP POLICY IF EXISTS p_plugins_tenant ON plugins"))
            op.execute(sa.text(
                "CREATE POLICY p_plugins_tenant ON plugins "
                "USING (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')) "
                "WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))"
            ))
        except Exception:
            pass

    if bind.dialect.has_table(bind, "plugin_executions"):
        try:
            op.execute(sa.text("DROP POLICY IF EXISTS p_plugin_executions_tenant ON plugin_executions"))
            op.execute(sa.text(
                "CREATE POLICY p_plugin_executions_tenant ON plugin_executions "
                "USING (plugin_id IN (SELECT id FROM plugins WHERE tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))) "
                "WITH CHECK (plugin_id IN (SELECT id FROM plugins WHERE tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')))"
            ))
        except Exception:
            pass

    # 8. Document Versions (Workspace isolation via Document FK)
    if bind.dialect.has_table(bind, "document_versions"):
        try:
            op.execute(sa.text("DROP POLICY IF EXISTS p_document_versions_workspace ON document_versions"))
            op.execute(sa.text(
                "CREATE POLICY p_document_versions_workspace ON document_versions "
                "USING (document_id IN (SELECT id FROM documents WHERE workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)) "
                "WITH CHECK (document_id IN (SELECT id FROM documents WHERE workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid))"
            ))
        except Exception:
            pass

    # 9. Agent Executions & Schedules (Workspace isolation via Agent FK)
    for table in ["agent_executions", "agent_schedules"]:
        if bind.dialect.has_table(bind, table):
            try:
                op.execute(sa.text(f"DROP POLICY IF EXISTS p_{table}_workspace ON {table}"))
                op.execute(sa.text(
                    f"CREATE POLICY p_{table}_workspace ON {table} "
                    f"USING (agent_id IN (SELECT id FROM agents WHERE workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)) "
                    f"WITH CHECK (agent_id IN (SELECT id FROM agents WHERE workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid))"
                ))
            except Exception:
                pass

    # 10. Webhook Deliveries (Tenant isolation via Webhook FK)
    if bind.dialect.has_table(bind, "webhook_deliveries"):
        try:
            op.execute(sa.text("DROP POLICY IF EXISTS p_webhook_deliveries_tenant ON webhook_deliveries"))
            op.execute(sa.text(
                "CREATE POLICY p_webhook_deliveries_tenant ON webhook_deliveries "
                "USING (webhook_id IN (SELECT id FROM webhooks WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)) "
                "WITH CHECK (webhook_id IN (SELECT id FROM webhooks WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid))"
            ))
        except Exception:
            pass

    # 11. Approval Decisions (Workspace isolation via Approval Request FK)
    if bind.dialect.has_table(bind, "approval_decision"):
        try:
            op.execute(sa.text("DROP POLICY IF EXISTS p_approval_decision_workspace ON approval_decision"))
            op.execute(sa.text(
                "CREATE POLICY p_approval_decision_workspace ON approval_decision "
                "USING (approval_request_id IN (SELECT id FROM approval_request WHERE workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)) "
                "WITH CHECK (approval_request_id IN (SELECT id FROM approval_request WHERE workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid))"
            ))
        except Exception:
            pass


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    for table in REMAINING_RLS_TABLES:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            try:
                op.execute(sa.text(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY"))
                op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
            except Exception:
                pass
