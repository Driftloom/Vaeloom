"""FORCE ROW LEVEL SECURITY + dedicated roles

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-17 00:00:00.000000

Critical RLS hardening:
1. FORCE ROW LEVEL SECURITY on all RLS-enabled tables (table owners bypass
   RLS without FORCE — this is the default and it's wrong for SaaS)
2. Create BYPASSRLS migration role (migrations must bypass RLS)
3. Create readonly role for analytics/reporting
4. Revoke FORCE from vaeloom_app (application role must NOT bypass RLS)

Per AWS/Crunchy Data/Bytebase guidance: FORCE ROW LEVEL SECURITY is
non-optional for multi-tenant SaaS. Without it, the table owner (typically
the application role) bypasses all policies.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = [
    "workspaces",
    "workspace_users",
    "documents",
    "document_versions",
    "memories",
    "memory_records",
    "resumes",
    "applications",
    "approval_request",
    "approval_decision",
    "schedule_events",
    "connectors",
    "events",
    "event_subscriptions",
    "dead_letter_events",
    "notifications",
    "agent_executions",
    "agent_actions",
    "api_keys",
    "auth_sessions",
    "usage_records",
    "webhooks",
    "webhook_deliveries",
    "subscriptions",
    "integrations",
    "plugins",
    "plugin_executions",
    "agent_schedules",
    "embeddings",
    "entities",
    "relationships",
    # Newly created in 0007
    "agent_approvals",
    "idempotency_records",
    "gmail_watches",
]


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # 1. Create migration role with BYPASSRLS
    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vaeloom_migrator') THEN "
        "CREATE ROLE vaeloom_migrator NOLOGIN; "
        "END IF; "
        "END $$"
    )
    op.execute("GRANT BYPASSRLS TO vaeloom_migrator")
    op.execute("GRANT ALL ON ALL TABLES IN SCHEMA public TO vaeloom_migrator")
    op.execute("GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO vaeloom_migrator")

    # 2. Create readonly role for analytics
    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vaeloom_readonly') THEN "
        "CREATE ROLE vaeloom_readonly NOLOGIN; "
        "END IF; "
        "END $$"
    )
    op.execute("GRANT CONNECT ON DATABASE vaeloom TO vaeloom_readonly")
    op.execute("GRANT USAGE ON SCHEMA public TO vaeloom_readonly")
    op.execute("GRANT SELECT ON ALL TABLES IN SCHEMA public TO vaeloom_readonly")

    # 3. FORCE ROW LEVEL SECURITY on all tables
    # This ensures the table owner (vaeloom_app) cannot bypass RLS.
    # Without FORCE, the GRANT USAGE + table ownership lets the app role
    # see all rows regardless of policies.
    for table in RLS_TABLES:
        if not op.get_bind().dialect.has_table(op.get_bind(), table):
            continue
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    # 4. Ensure vaeloom_app does NOT have BYPASSRLS
    op.execute("REVOKE BYPASSRLS FROM vaeloom_app")

    # 5. Grant readonly access to application role for cross-tenant admin
    # (only if needed — keep minimal)
    op.execute("GRANT vaeloom_readonly TO vaeloom_app")


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    op.execute("REVOKE vaeloom_readonly FROM vaeloom_app")

    for table in RLS_TABLES:
        if not op.get_bind().dialect.has_table(op.get_bind(), table):
            continue
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")

    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM vaeloom_readonly")
    op.execute("REVOKE CONNECT ON DATABASE vaeloom FROM vaeloom_readonly")
    op.execute("DROP ROLE IF EXISTS vaeloom_readonly")

    op.execute("REVOKE BYPASSRLS FROM vaeloom_migrator")
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM vaeloom_migrator")
    op.execute("DROP ROLE IF EXISTS vaeloom_migrator")
