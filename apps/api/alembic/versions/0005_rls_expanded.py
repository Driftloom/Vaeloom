"""RLS expanded

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-16 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCOPED_TABLES = [
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
]


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vaeloom_app') THEN "
        "CREATE ROLE vaeloom_app LOGIN; "
        "END IF; "
        "END $$"
    )
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vaeloom_app"
    )
    op.execute(
        "GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO vaeloom_app"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vaeloom_app"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT USAGE ON SEQUENCES TO vaeloom_app"
    )

    for table in SCOPED_TABLES:
        if not op.get_bind().dialect.has_table(op.get_bind(), table):
            continue
        op.execute(
            f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"
        )
        op.execute(
            f"""
            CREATE POLICY p_{table}_workspace ON {table}
            USING (workspace_id = current_setting('app.workspace_id', true)::uuid
                   AND tenant_id = current_setting('app.tenant_id', true)::uuid)
            WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid
                        AND tenant_id = current_setting('app.tenant_id', true)::uuid)
            """
        )


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    for table in SCOPED_TABLES:
        op.execute(
            f"DROP POLICY IF EXISTS p_{table}_workspace ON {table}"
        )
        op.execute(
            f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"
        )

    op.execute(
        "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM vaeloom_app"
    )
    op.execute("DROP ROLE IF EXISTS vaeloom_app")
