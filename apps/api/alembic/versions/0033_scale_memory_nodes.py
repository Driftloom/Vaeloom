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


def _safe(conn, sql: str) -> None:
    """Execute one statement in its own savepoint (PG): a failure rolls back
    only this statement, never the whole migration transaction. SQLite: direct."""
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        conn.execute(sa.text(sql))
        return
    conn.execute(sa.text("SAVEPOINT sp_0033"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0033"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0033"))
        print(f"0033 skipped statement ({e}): {sql[:120]}")


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    json_type = postgresql.JSONB() if is_pg else sa.JSON()
    vector_type = Vector(1536) if (is_pg and Vector is not None) else sa.NullType()
    bind = op.get_bind()

    if not bind.dialect.has_table(bind, "scale_memory_nodes"):
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

    from sqlalchemy import inspect as _inspect

    existing_indexes = {ix["name"] for ix in _inspect(bind).get_indexes("scale_memory_nodes")}
    if "idx_scale_memory_user_tier" not in existing_indexes:
        op.create_index("idx_scale_memory_user_tier", "scale_memory_nodes", ["user_id", "tier", "period_start"])
    if "idx_scale_memory_workspace_tier" not in existing_indexes:
        op.create_index("idx_scale_memory_workspace_tier", "scale_memory_nodes", ["workspace_id", "tier", "period_start"])

    # Enforce RLS on PostgreSQL — STRICT fail-closed (workspace AND user).
    # Repaired 2026-09-11: the original OR-user/is_admin form allowed any
    # user-scoped session to read foreign-workspace rows.
    if is_pg:
        _safe(bind, "ALTER TABLE scale_memory_nodes ENABLE ROW LEVEL SECURITY")
        _safe(bind, "ALTER TABLE scale_memory_nodes FORCE ROW LEVEL SECURITY")
        _safe(bind, "DROP POLICY IF EXISTS p_scale_memory_workspace ON scale_memory_nodes")
        _safe(
            bind,
            """
            CREATE POLICY p_scale_memory_workspace ON scale_memory_nodes
            FOR ALL
            USING (
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
                AND user_id::text = NULLIF(current_setting('app.user_id', true), '')
            )
            WITH CHECK (
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
                AND user_id::text = NULLIF(current_setting('app.user_id', true), '')
            )
            """,
        )


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if is_pg:
        op.execute(sa.text("DROP POLICY IF EXISTS p_scale_memory_workspace ON scale_memory_nodes"))
    op.drop_index("idx_scale_memory_workspace_tier", table_name="scale_memory_nodes")
    op.drop_index("idx_scale_memory_user_tier", table_name="scale_memory_nodes")
    op.drop_table("scale_memory_nodes")
