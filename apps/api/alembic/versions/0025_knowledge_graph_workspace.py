"""knowledge graph workspace isolation

Revision ID: 0025
Revises: 0024
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> Sequence:
    op.add_column("knowledge_nodes", sa.Column("workspace_id", sa.String(255), nullable=True))
    op.add_column("knowledge_edges", sa.Column("workspace_id", sa.String(255), nullable=True))
    op.create_index("idx_knowledge_nodes_workspace", "knowledge_nodes", ["workspace_id"])
    op.create_index("idx_knowledge_edges_workspace", "knowledge_edges", ["workspace_id"])


def downgrade() -> Sequence:
    op.drop_index("idx_knowledge_edges_workspace", "knowledge_edges")
    op.drop_index("idx_knowledge_nodes_workspace", "knowledge_nodes")
    op.drop_column("knowledge_edges", "workspace_id")
    op.drop_column("knowledge_nodes", "workspace_id")
