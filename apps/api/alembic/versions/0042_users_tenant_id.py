"""Ensure users.tenant_id exists with index (OP-RLS-01 tenant resolution).

Revision ID: 0042
Revises: 0041

The RLS design resolves workspace tenants through users
(app_tenant_for_workspace). This migration guarantees the column + index
exist (no-op where already present, as on the current live target).
Existing NULLs stay NULL (fail-closed; operator-backfillable).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0042"
down_revision: Union[str, None] = "0041"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cols(bind, table: str) -> set:
    try:
        return {c["name"] for c in sa.inspect(bind).get_columns(table)}
    except Exception:
        return set()


def upgrade() -> None:
    bind = op.get_bind()
    if "tenant_id" not in _cols(bind, "users"):
        op.add_column("users", sa.Column("tenant_id", sa.UUID(), nullable=True))
    try:
        op.create_index("idx_users_tenant_id", "users", ["tenant_id"])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index("idx_users_tenant_id", table_name="users")
    except Exception:
        pass
    try:
        op.drop_column("users", "tenant_id")
    except Exception:
        pass
