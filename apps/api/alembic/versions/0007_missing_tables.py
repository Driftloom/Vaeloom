"""Create missing tables: agent_approvals, idempotency_records, gmail_watches

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-17 00:00:00.000000

These 3 tables have ORM models in schema.py but were never created by any
Alembic migration. The custom runner created some of them under different names,
but Alembic is the canonical migration authority (P06 restriction).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # 1. agent_approvals — post-action confirmation records
    op.create_table(
        "agent_approvals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
        sa.Column("agent_name", sa.String(100), nullable=False),
        sa.Column("action_type", sa.String(100), nullable=False),
        sa.Column("payload", sa.JSON, nullable=False, server_default="{}"),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("requested_by", UUID(as_uuid=True), nullable=True),
        sa.Column("decided_by", UUID(as_uuid=True), nullable=True),
        sa.Column("decision_note", sa.Text, nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_agent_approvals_workspace_status", "agent_approvals", ["workspace_id", "status"])
    op.create_index("idx_agent_approvals_workspace_created", "agent_approvals", ["workspace_id", "created_at"])

    # 2. idempotency_records — HTTP replay protection
    op.create_table(
        "idempotency_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("idempotency_key", sa.String(255), nullable=False),
        sa.Column("request_path", sa.String(255), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response_body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("idempotency_key", "request_path", name="uq_idempotency_key_path"),
    )
    op.create_index("idx_idempotency_expires", "idempotency_records", ["expires_at"])

    # 3. gmail_watches — Gmail push notification lifecycle
    op.create_table(
        "gmail_watches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("topic", sa.String(512), nullable=False),
        sa.Column("channel_id", sa.String(255), nullable=False),
        sa.Column("resource_id", sa.String(255), nullable=True),
        sa.Column("history_id", sa.String(64), nullable=True),
        sa.Column("expiration", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("last_reconciled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("workspace_id"),
    )
    op.create_index("idx_gmail_watches_channel_id", "gmail_watches", ["channel_id"])
    op.create_index("idx_gmail_watches_status_expiration", "gmail_watches", ["status", "expiration"])


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    op.drop_table("gmail_watches")
    op.drop_table("idempotency_records")
    op.drop_table("agent_approvals")
