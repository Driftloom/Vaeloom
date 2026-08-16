"""Memory taxonomy

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-16 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "memories", sa.Column("domain", sa.String(100), nullable=True)
    )
    op.add_column(
        "memories",
        sa.Column(
            "supersedes_id",
            sa.UUID(),
            sa.ForeignKey("memories.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "memories",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "idx_memories_tenant_domain",
        "memories",
        ["tenant_id", "domain"],
    )
    op.create_index(
        "idx_memories_workspace_type_deleted",
        "memories",
        ["workspace_id", "type", "deleted_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "idx_memories_supersedes",
        "memories",
        ["workspace_id", "supersedes_id"],
        postgresql_where=sa.text("supersedes_id IS NOT NULL"),
    )

    op.add_column(
        "memory_records",
        sa.Column(
            "supersedes_id",
            sa.UUID(),
            sa.ForeignKey("memory_records.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "memory_records",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("memory_records", "deleted_at")
    op.drop_column("memory_records", "supersedes_id")

    op.drop_index(
        "idx_memories_supersedes",
        table_name="memories",
    )
    op.drop_index(
        "idx_memories_workspace_type_deleted",
        table_name="memories",
    )
    op.drop_index(
        "idx_memories_tenant_domain",
        table_name="memories",
    )
    op.drop_column("memories", "deleted_at")
    op.drop_column("memories", "supersedes_id")
    op.drop_column("memories", "domain")
