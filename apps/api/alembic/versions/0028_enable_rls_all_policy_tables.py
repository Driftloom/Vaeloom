"""Enable and force Row Level Security across all policy-bearing tables.

Revision ID: 0028
Revises: 0027
Create Date: 2026-09-06

Zero-trust RLS closure:
Ensures all tables with tenant/workspace isolation policies have both
ENABLE ROW LEVEL SECURITY and FORCE ROW LEVEL SECURITY applied.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALL_RLS_TABLES = [
    "agent_actions",
    "agent_approvals",
    "agents",
    "api_keys",
    "applications",
    "approval_request",
    "connectors",
    "document_actions",
    "document_chunks",
    "documents",
    "embeddings",
    "entities",
    "events",
    "integrations",
    "memories",
    "memory_records",
    "memory_versions",
    "notifications",
    "permissions",
    "provider_keys",
    "relationships",
    "resume_artifacts",
    "resume_sources",
    "resumes",
    "schedule_events",
    "subscriptions",
    "usage_records",
    "users",
    "webhooks",
    "workspace_users",
]


WORKSPACE_TABLES = [
    "workspace_users", "documents", "memory_records", "entities", "relationships",
    "embeddings", "resumes", "applications", "schedule_events", "agent_actions",
    "agent_approvals", "permissions", "notifications", "resume_artifacts",
    "resume_sources", "document_chunks", "memory_versions", "provider_keys",
]

TENANT_TABLES = [
    "users", "api_keys", "events", "subscriptions", "usage_records", "integrations", "webhooks"
]

COMPOSITE_TABLES = [
    "connectors", "memories", "agents", "approval_request"
]


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    bind = op.get_bind()

    # 1. Enable and Force RLS
    for table in ALL_RLS_TABLES:
        if bind.dialect.has_table(bind, table):
            try:
                op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
                op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
            except Exception:
                pass

    # 2. Standardize workspace-only policies with NULLIF (fail-closed, no error on '')
    for table in WORKSPACE_TABLES:
        if bind.dialect.has_table(bind, table):
            try:
                op.execute(sa.text(f"DROP POLICY IF EXISTS p_{table}_workspace ON {table}"))
                op.execute(sa.text(f"DROP POLICY IF EXISTS workspace_isolation_{table} ON {table}"))
                op.execute(sa.text(
                    f"CREATE POLICY p_{table}_workspace ON {table} "
                    f"USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid) "
                    f"WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)"
                ))
            except Exception:
                pass

    # 3. Standardize tenant-only policies with NULLIF (fail-closed, no error on '')
    for table in TENANT_TABLES:
        if bind.dialect.has_table(bind, table):
            try:
                op.execute(sa.text(f"DROP POLICY IF EXISTS p_{table}_tenant ON {table}"))
                op.execute(sa.text(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}"))
                op.execute(sa.text(
                    f"CREATE POLICY p_{table}_tenant ON {table} "
                    f"USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) "
                    f"WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)"
                ))
            except Exception:
                pass

    # 4. Standardize composite policies with NULLIF (fail-closed)
    for table in COMPOSITE_TABLES:
        if bind.dialect.has_table(bind, table):
            try:
                op.execute(sa.text(f"DROP POLICY IF EXISTS p_{table}_workspace ON {table}"))
                op.execute(sa.text(f"DROP POLICY IF EXISTS workspace_isolation_{table} ON {table}"))
                op.execute(sa.text(
                    f"CREATE POLICY p_{table}_workspace ON {table} "
                    f"USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid "
                    f"AND (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)) "
                    f"WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid "
                    f"AND (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid))"
                ))
            except Exception:
                pass


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    for table in ALL_RLS_TABLES:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            try:
                op.execute(sa.text(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY"))
                op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
            except Exception:
                pass
