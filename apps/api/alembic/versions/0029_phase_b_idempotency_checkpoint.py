"""Phase B durable runtime: tool idempotency + checkpoint versioning.

Revision ID: 0029
Revises: 0028
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Durable side-effect idempotency (UNIQUE is the correctness mechanism).
    op.create_table(
        "tool_idempotency",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.String(255), nullable=False),
        sa.Column("idem_key", sa.String(255), nullable=False),
        sa.Column("tool_name", sa.String(255), nullable=False),
        sa.Column("agent_id", sa.String(255), nullable=False, server_default=""),
        sa.Column("request_id", sa.String(255), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="succeeded"),
        sa.Column("result_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", "idem_key", name="uq_tool_idempotency_ws_key"),
    )
    op.create_index("idx_tool_idempotency_ws_tool", "tool_idempotency", ["workspace_id", "tool_name"])

    # Optimistic-concurrency version on checkpoints (SQLite: plain column;
    # Postgres: plain column, CAS enforced in application transaction).
    try:
        op.add_column("loop_checkpoints", sa.Column("state_version", sa.Integer(), nullable=False, server_default="1"))
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index("idx_tool_idempotency_ws_tool", table_name="tool_idempotency")
    except Exception:
        pass
    try:
        op.drop_table("tool_idempotency")
    except Exception:
        pass
    try:
        op.drop_column("loop_checkpoints", "state_version")
    except Exception:
        pass
