"""Transactional outbox ledger (0051): outbox_events table for DB+Redis dual-write safety.

Revision ID: 0051
Revises: 0050

Slice 1 (ADR-045): table only. No publisher rewiring (Loop 2).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0051"
down_revision: Union[str, None] = "0050"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Cross-db conventions (per 0049): native UUID/JSONB on Postgres,
    # String(36)/JSON on SQLite.
    uuid_col = sa.UUID(as_uuid=True) if is_pg else sa.String(36)
    json_col = postgresql.JSONB() if is_pg else sa.JSON()

    op.create_table(
        "outbox_events",
        sa.Column("id", uuid_col, primary_key=True),
        sa.Column("tenant_id", uuid_col, nullable=True),
        sa.Column(
            "workspace_id",
            uuid_col,
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("payload", json_col, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_outbox_status_due", "outbox_events", ["status", "next_attempt_at"])
    op.create_index("idx_outbox_workspace_id", "outbox_events", ["workspace_id"])
    op.create_index("idx_outbox_created_at", "outbox_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("outbox_events")
