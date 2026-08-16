"""Fix schema gaps: missing columns on agent_executions and connectors

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-17 00:00:00.000000

These columns exist in the ORM models (schema.py) but were never added by any
Alembic migration. They were either added by the custom runner or never migrated
at all.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # 1. agent_executions — add tenant_id, user_id, response_time_ms
    # These columns are in schema.py ORM but never migrated.
    # tenant_id and user_id are String(36) in the ORM (not UUID FK) — this is
    # intentional: agent_executions stores denormalized IDs for query performance.
    op.add_column(
        "agent_executions",
        sa.Column("tenant_id", sa.String(36), nullable=True),
    )
    op.add_column(
        "agent_executions",
        sa.Column("user_id", sa.String(36), nullable=True),
    )
    op.add_column(
        "agent_executions",
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
    )

    # 2. connectors — add name and tenant_id
    # name is required (NOT NULL) in the ORM; tenant_id is optional.
    # Use batch mode for SQLite compatibility in tests.
    with op.batch_alter_table("connectors") as batch_op:
        batch_op.add_column(
            sa.Column("name", sa.String(255), nullable=False, server_default="unnamed")
        )
        batch_op.add_column(
            sa.Column("tenant_id", UUID(as_uuid=True), nullable=True)
        )

    # Remove the server_default after backfill (if needed)
    # In practice, existing rows get 'unnamed' which is acceptable for MVP


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    with op.batch_alter_table("connectors") as batch_op:
        batch_op.drop_column("tenant_id")
        batch_op.drop_column("name")

    op.drop_column("agent_executions", "response_time_ms")
    op.drop_column("agent_executions", "user_id")
    op.drop_column("agent_executions", "tenant_id")
