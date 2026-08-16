"""Approval tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-16 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "approval_request",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "workspace_id",
            sa.UUID(),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("scope_claims", postgresql.JSONB(), nullable=True),
        sa.Column(
            "ttl_seconds", sa.Integer(), nullable=False, server_default="300"
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("idempotency_key", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workspace_id",
            "idempotency_key",
            name="uq_approval_workspace_idempotency",
        ),
    )
    op.create_index(
        "idx_approval_workspace_status_expiry",
        "approval_request",
        ["workspace_id", "status", "expires_at"],
    )

    op.create_table(
        "approval_decision",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "approval_request_id",
            sa.UUID(),
            sa.ForeignKey("approval_request.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column(
            "decided_by",
            sa.UUID(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "decided_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("client_context", postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column(
        "applications",
        sa.Column("idempotency_key", sa.String(255), nullable=True),
    )
    op.create_index(
        "uq_applications_idempotency",
        "applications",
        ["idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )

    op.add_column(
        "agent_actions",
        sa.Column("idempotency_key", sa.String(255), nullable=True),
    )
    op.add_column(
        "agent_actions",
        sa.Column(
            "approval_request_id",
            sa.UUID(),
            sa.ForeignKey("approval_request.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("agent_actions", "approval_request_id")
    op.drop_column("agent_actions", "idempotency_key")

    op.drop_index(
        "uq_applications_idempotency",
        table_name="applications",
    )
    op.drop_column("applications", "idempotency_key")

    op.drop_table("approval_decision")
    op.drop_index(
        "idx_approval_workspace_status_expiry",
        table_name="approval_request",
    )
    op.drop_table("approval_request")
