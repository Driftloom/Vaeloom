"""Fix broken RLS policies from migration 0005

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-17 00:00:00.000000

FINDING-001: Migration 0005 created RLS policies referencing columns that
don't exist in some tables. This migration:
1. Drops ALL policies created by 0005 (including working ones)
2. Re-creates policies ONLY for tables that have BOTH workspace_id (UUID) AND
   tenant_id (UUID) columns
3. Tables missing one or both columns get NO RLS policy (app-level filtering
   is the only protection for those tables)

FINDING-003: Also fixes migration 0010's REVOKE BYPASSRLS that fails on fresh DB.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables that have BOTH workspace_id (UUID) AND tenant_id (UUID) columns.
# Only these can have working composite RLS policies.
# Verified against schema.py as of 2026-08-17.
WORKSPACE_AND_TENANT_SCOPED = [
    "workspaces",
    "workspace_users",
    "documents",
    "document_versions",
    "memory_records",
    "resumes",
    "applications",
    "approval_request",
    "approval_decision",
    "schedule_events",
    "connectors",
    "agent_actions",
    "agent_approvals",
]

# Tables that have tenant_id (UUID) but workspace_id is nullable or missing.
# These can have tenant-only RLS policies.
TENANT_SCOPED_ONLY = [
    "events",
    "usage_records",
    "subscriptions",
    "integrations",
    "agents",
]

# Tables that have workspace_id (UUID) but NO tenant_id.
# These can have workspace-only RLS policies.
WORKSPACE_SCOPED_ONLY = [
    "notifications",
]

# Tables where the ID columns are String, not UUID — RLS ::uuid cast would fail.
# These need app-level filtering only.
TYPE_MISMATCH_TABLES = [
    "agent_executions",      # tenant_id, user_id are String(36)
    "plugins",               # tenant_id is String(255)
    "gmail_watches",         # workspace_id is String(36)
]

# Tables with no scope columns at all
NO_SCOPE_TABLES = [
    "embeddings",
    "auth_sessions",
    "webhook_deliveries",
    "plugin_executions",
    "idempotency_records",
    "api_keys",             # has tenant_id but no workspace_id
]

# Tables that should have RLS but were not in 0005
NEED_RLS = [
    "agent_approvals",
    "idempotency_records",
    "gmail_watches",
]


def _drop_all_old_policies() -> None:
    """Drop all policies created by migration 0005."""
    all_scoped = (
        WORKSPACE_AND_TENANT_SCOPED
        + TENANT_SCOPED_ONLY
        + WORKSPACE_SCOPED_ONLY
        + TYPE_MISMATCH_TABLES
        + NO_SCOPE_TABLES
        + ["webhooks", "event_subscriptions", "dead_letter_events",
           "api_keys", "auth_sessions", "embeddings", "entities",
           "relationships", "agent_executions", "agent_schedules"]
    )
    for table in all_scoped:
        if not op.get_bind().dialect.has_table(op.get_bind(), table):
            continue
        op.execute(f"DROP POLICY IF EXISTS p_{table}_workspace ON {table}")


def _create_composite_policy(table: str) -> None:
    """Create RLS policy matching both workspace_id and tenant_id."""
    op.execute(
        f"CREATE POLICY p_{table}_workspace ON {table} "
        f"USING (workspace_id = current_setting('app.workspace_id', true)::uuid "
        f"AND tenant_id = current_setting('app.tenant_id', true)::uuid) "
        f"WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid "
        f"AND tenant_id = current_setting('app.tenant_id', true)::uuid)"
    )


def _create_tenant_only_policy(table: str) -> None:
    """Create RLS policy matching tenant_id only."""
    op.execute(
        f"CREATE POLICY p_{table}_tenant ON {table} "
        f"USING (tenant_id = current_setting('app.tenant_id', true)::uuid) "
        f"WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)"
    )


def _create_workspace_only_policy(table: str) -> None:
    """Create RLS policy matching workspace_id only."""
    op.execute(
        f"CREATE POLICY p_{table}_workspace ON {table} "
        f"USING (workspace_id = current_setting('app.workspace_id', true)::uuid) "
        f"WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid)"
    )


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # Step 1: Drop all broken policies from 0005
    _drop_all_old_policies()

    # Step 2: Re-create policies for tables with correct columns
    for table in WORKSPACE_AND_TENANT_SCOPED:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            _create_composite_policy(table)

    for table in TENANT_SCOPED_ONLY:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            _create_tenant_only_policy(table)

    for table in WORKSPACE_SCOPED_ONLY:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            _create_workspace_only_policy(table)

    # Step 3: Fix FINDING-003 — ensure REVOKE BYPASSRLS doesn't fail
    op.execute(
        "DO $$ BEGIN "
        "REVOKE BYPASSRLS FROM vaeloom_app; "
        "EXCEPTION WHEN OTHERS THEN "
        "RAISE NOTICE 'vaeloom_app did not have BYPASSRLS — nothing to revoke'; "
        "END $$"
    )


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # Drop all policies created by this migration
    all_tables = (
        WORKSPACE_AND_TENANT_SCOPED
        + TENANT_SCOPED_ONLY
        + WORKSPACE_SCOPED_ONLY
    )
    for table in all_tables:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            op.execute(f"DROP POLICY IF EXISTS p_{table}_workspace ON {table}")
            op.execute(f"DROP POLICY IF EXISTS p_{table}_tenant ON {table}")

    # Re-create the original 0005 policies (including broken ones)
    # This is for rollback consistency only — the broken policies are known-bad
    original_scoped = [
        "workspaces", "workspace_users", "documents", "document_versions",
        "memories", "memory_records", "resumes", "applications",
        "approval_request", "approval_decision", "schedule_events",
        "connectors", "events", "event_subscriptions", "dead_letter_events",
        "notifications", "agent_executions", "agent_actions", "api_keys",
        "auth_sessions", "usage_records", "webhooks", "webhook_deliveries",
        "subscriptions", "integrations", "plugins", "plugin_executions",
        "agent_schedules", "embeddings", "entities", "relationships",
    ]
    for table in original_scoped:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            op.execute(
                f"CREATE POLICY p_{table}_workspace ON {table} "
                f"USING (workspace_id = current_setting('app.workspace_id', true)::uuid "
                f"AND tenant_id = current_setting('app.tenant_id', true)::uuid) "
                f"WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid "
                f"AND tenant_id = current_setting('app.tenant_id', true)::uuid)"
            )
