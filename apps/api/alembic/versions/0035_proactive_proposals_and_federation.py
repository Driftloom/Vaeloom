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


def upgrade() -> None:
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

    # 2. PostgreSQL Row-Level Security
    if is_pg:
        op.execute("ALTER TABLE proactive_proposals ENABLE ROW LEVEL SECURITY")
        op.execute(
            """
            CREATE POLICY p_proactive_proposals_workspace ON proactive_proposals
            FOR ALL
            USING (
                workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
            )
            WITH CHECK (
                workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
            )
            """
        )


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if is_pg:
        op.execute("DROP POLICY IF EXISTS p_proactive_proposals_workspace ON proactive_proposals")
    op.drop_table("proactive_proposals")
