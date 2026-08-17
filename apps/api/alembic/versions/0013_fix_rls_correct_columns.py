"""Fix RLS policies with correct column references per actual schema.py

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-17 12:00:00.000000

FINDING-G1: Migration 0012 created 24 RLS policies but 11 of 13 composite
policies reference columns that do not exist in the ORM (most tables lack
tenant_id). Only 8 of 24 policies reference valid columns.

FINDING-G2: Migration 0012 DROPPED working policies from 6 tables
(memories, entities, relationships, webhooks, api_keys, embeddings) without
recreating them. The core `memories` table was left unprotected.

This migration:
1. Drops ALL policies from 0012
2. Recreates policies using ONLY tables with verified correct columns
3. Restores RLS on the 6 tables lost from 0005
4. Adds RLS to users, webhooks, permissions, entities, relationships
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ── VERIFIED column audit from schema.py ──────────────────────────
# Each table listed only if the required columns ACTUALLY EXIST as UUID type.

# Both workspace_id (UUID) AND tenant_id (UUID) exist
COMPOSITE = [
    "connectors",          # workspace_id UUID FK, tenant_id UUID
    "memories",            # workspace_id UUID FK, tenant_id UUID
    "agents",              # workspace_id UUID FK, tenant_id UUID
    "approval_request",    # workspace_id UUID FK, tenant_id UUID
]

# workspace_id (UUID) exists, no tenant_id
WORKSPACE_ONLY = [
    "workspace_users",     # workspace_id UUID FK
    "documents",           # workspace_id UUID FK
    "memory_records",      # workspace_id UUID FK
    "entities",            # workspace_id UUID FK
    "relationships",       # workspace_id UUID
    "embeddings",          # workspace_id UUID
    "resumes",             # workspace_id UUID FK
    "applications",        # workspace_id UUID FK
    "schedule_events",     # workspace_id UUID FK
    "agent_actions",       # workspace_id UUID FK
    "agent_approvals",     # workspace_id UUID FK
    "permissions",         # workspace_id UUID FK
    "notifications",       # workspace_id UUID FK
]

# tenant_id (UUID) exists, no workspace_id
TENANT_ONLY = [
    "users",               # tenant_id UUID FK
    "api_keys",            # tenant_id UUID
    "events",              # tenant_id UUID
    "subscriptions",       # tenant_id UUID
    "webhooks",            # tenant_id UUID FK
    "usage_records",       # tenant_id UUID
    "integrations",        # tenant_id UUID
]

# String-typed scope columns — cannot use ::uuid cast, app-level only
TYPE_MISMATCH = [
    "agent_executions",    # tenant_id String(36)
    "plugins",             # tenant_id String(255)
    "gmail_watches",       # workspace_id String(36)
]

# No scope columns or scoped via FK only — no RLS needed
NO_RLS_NEEDED = [
    "tenants",             # IS the tenant
    "workspaces",          # IS the workspace
    "auth_sessions",       # session tokens, scoped via user_id
    "document_versions",   # FK to documents
    "idempotency_records", # request dedup
    "approval_decision",   # FK to approval_request
    "event_subscriptions", # internal routing
    "dead_letter_events",  # error queue
    "webhook_deliveries",  # delivery log
    "plugin_executions",   # FK to plugins
    "agent_schedules",     # FK to agents
]


def _drop_all_policies() -> None:
    """Drop all RLS policies from previous migrations."""
    all_tables = COMPOSITE + WORKSPACE_ONLY + TENANT_ONLY + TYPE_MISMATCH + NO_RLS_NEEDED
    # Also drop from any table that might have had policies from 0005
    extra = [
        "workspaces", "document_versions", "approval_decision",
        "event_subscriptions", "dead_letter_events", "webhook_deliveries",
        "plugin_executions", "agent_schedules", "agent_executions",
        "plugins", "gmail_watches", "idempotency_records",
    ]
    for table in set(all_tables + extra):
        if not op.get_bind().dialect.has_table(op.get_bind(), table):
            continue
        op.execute(f"DROP POLICY IF EXISTS p_{table}_workspace ON {table}")
        op.execute(f"DROP POLICY IF EXISTS p_{table}_tenant ON {table}")


def _create_composite(table: str) -> None:
    op.execute(
        f"CREATE POLICY p_{table}_workspace ON {table} "
        f"USING (workspace_id = current_setting('app.workspace_id', true)::uuid "
        f"AND tenant_id = current_setting('app.tenant_id', true)::uuid) "
        f"WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid "
        f"AND tenant_id = current_setting('app.tenant_id', true)::uuid)"
    )


def _create_workspace_only(table: str) -> None:
    op.execute(
        f"CREATE POLICY p_{table}_workspace ON {table} "
        f"USING (workspace_id = current_setting('app.workspace_id', true)::uuid) "
        f"WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid)"
    )


def _create_tenant_only(table: str) -> None:
    op.execute(
        f"CREATE POLICY p_{table}_tenant ON {table} "
        f"USING (tenant_id = current_setting('app.tenant_id', true)::uuid) "
        f"WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)"
    )


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # Step 1: Drop ALL existing policies
    _drop_all_policies()

    # Step 2: Create correct policies
    for table in COMPOSITE:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            _create_composite(table)

    for table in WORKSPACE_ONLY:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            _create_workspace_only(table)

    for table in TENANT_ONLY:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            _create_tenant_only(table)

    # Step 3: Ensure FORCE RLS on all policy-bearing tables (prevents table-owner bypass)
    all_rls_tables = COMPOSITE + WORKSPACE_ONLY + TENANT_ONLY
    for table in all_rls_tables:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    all_rls_tables = COMPOSITE + WORKSPACE_ONLY + TENANT_ONLY
    for table in all_rls_tables:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
            op.execute(f"DROP POLICY IF EXISTS p_{table}_workspace ON {table}")
            op.execute(f"DROP POLICY IF EXISTS p_{table}_tenant ON {table}")
