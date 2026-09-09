"""Create scale_memory_nodes table with RLS policies and indices.

Revision ID: 0033
Revises: 0032
Create Date: 2026-09-09

SCALE Multiscale Temporal Memory Hierarchy (Pillar 2 of PIOS Blueprint):
Stores multiscale temporal memory nodes (SUB_DAILY, DAILY, WEEKLY, MONTHLY, ANNUAL, NORTH_STAR)
with vector embeddings, key insights, friction points, and action commitments.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    Vector = None

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    json_type = postgresql.JSONB() if is_pg else sa.JSON()
    vector_type = Vector(1536) if (is_pg and Vector is not None) else sa.NullType()

    op.create_table(
        "scale_memory_nodes",
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workspace_id", sa.UUID(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("key_insights", json_type, nullable=False, server_default="[]"),
        sa.Column("friction_points", json_type, nullable=False, server_default="[]"),
        sa.Column("unresolved_questions", json_type, nullable=False, server_default="[]"),
        sa.Column("action_commitments", json_type, nullable=False, server_default="[]"),
        sa.Column("embedding", vector_type, nullable=True),
        sa.Column("metadata", json_type, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_index("idx_scale_memory_user_tier", "scale_memory_nodes", ["user_id", "tier", "period_start"])
    op.create_index("idx_scale_memory_workspace_tier", "scale_memory_nodes", ["workspace_id", "tier", "period_start"])

    # Enforce RLS on PostgreSQL
    if is_pg:
        op.execute(sa.text("ALTER TABLE scale_memory_nodes ENABLE ROW LEVEL SECURITY"))
        op.execute(sa.text("ALTER TABLE scale_memory_nodes FORCE ROW LEVEL SECURITY"))
        op.execute(sa.text("""
            CREATE POLICY p_scale_memory_workspace ON scale_memory_nodes
            FOR ALL
            USING (
                workspace_id::text = current_setting('app.workspace_id', true)
                OR user_id::text = current_setting('app.user_id', true)
                OR current_setting('app.is_admin', true) = 'true'
            )
            WITH CHECK (
                workspace_id::text = current_setting('app.workspace_id', true)
                OR user_id::text = current_setting('app.user_id', true)
                OR current_setting('app.is_admin', true) = 'true'
            )
        """))


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if is_pg:
        op.execute(sa.text("DROP POLICY IF EXISTS p_scale_memory_workspace ON scale_memory_nodes"))
    op.drop_index("idx_scale_memory_workspace_tier", table_name="scale_memory_nodes")
    op.drop_index("idx_scale_memory_user_tier", table_name="scale_memory_nodes")
    op.drop_table("scale_memory_nodes")
