"""Create proactive proposals table with workspace RLS.

Revision ID: 0035
Revises: 0034
Create Date: 2026-09-09

Phase 4 of PIOS Blueprint:
- Proactive Proposals table for anticipation daemon
- PostgreSQL Row-Level Security (RLS) workspace scoping
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0035"
down_revision: Union[str, None] = "0034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(bind, name: str) -> bool:
    try:
        return bool(bind.dialect.has_table(bind, name))
    except Exception:
        return False


def _index_exists(bind, name: str, table: str) -> bool:
    try:
        from sqlalchemy import inspect as _inspect

        return any(ix["name"] == name for ix in _inspect(bind).get_indexes(table))
    except Exception:
        return False


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        conn.execute(sa.text(sql))
        return
    conn.execute(sa.text("SAVEPOINT sp_0035"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0035"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0035"))
        print(f"0035 skipped statement ({e}): {sql[:120]}")


def upgrade() -> None:
    # NOTE (2026-09-11 repair): hardened with existence guards — live targets
    # created this table via create_all before alembic reached this revision.
    bind = op.get_bind()
    if _table_exists(bind, "proactive_proposals"):
        return _upgrade_rls_only()
    is_pg = op.get_context().dialect.name == "postgresql"
    json_type = postgresql.JSONB() if is_pg else sa.JSON()

    # 1. Proactive Proposals table
    op.create_table(
        "proactive_proposals",
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workspace_id", sa.UUID(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trigger_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("proposed_action", sa.String(100), nullable=False),
        sa.Column("action_payload", json_type, server_default="{}", nullable=False),
        sa.Column("urgency", sa.String(20), server_default="MEDIUM", nullable=False),
        sa.Column("status", sa.String(20), server_default="PENDING", nullable=False),
        sa.Column("relevance_score", sa.Float(), server_default="0.8", nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dismissed_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index("idx_proposals_workspace_status", "proactive_proposals", ["workspace_id", "status"])
    op.create_index("idx_proposals_user_status", "proactive_proposals", ["user_id", "status"])
    op.create_index("idx_proposals_trigger_type", "proactive_proposals", ["trigger_type"])

    _upgrade_rls_only()


def _upgrade_rls_only() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    # 2. PostgreSQL Row-Level Security
    if is_pg:
        bind = op.get_bind()
        _safe(bind, "ALTER TABLE proactive_proposals ENABLE ROW LEVEL SECURITY")
        _safe(bind, "ALTER TABLE proactive_proposals FORCE ROW LEVEL SECURITY")
        _safe(bind, "DROP POLICY IF EXISTS p_proactive_proposals_workspace ON proactive_proposals")
        _safe(
            bind,
            """
            CREATE POLICY p_proactive_proposals_workspace ON proactive_proposals
            FOR ALL
            USING (
                workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
            )
            WITH CHECK (
                workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
            )
            """,
        )


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if is_pg:
        op.execute("DROP POLICY IF EXISTS p_proactive_proposals_workspace ON proactive_proposals")
    op.drop_table("proactive_proposals")
