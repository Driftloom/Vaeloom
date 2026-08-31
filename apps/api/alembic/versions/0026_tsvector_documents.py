"""Add tsvector for hybrid BM25 search on documents

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-31

Supports P1b hybrid retrieval: to_tsvector + ts_rank without extra infra.
No-op on SQLite (tests). Uses generated column for Postgres 12+.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    # Add tsvector column if missing
    op.execute("""
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(path,'') || ' ' || coalesce(summary,''))) STORED
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_documents_search_vector ON documents USING gin(search_vector)")


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    op.execute("DROP INDEX IF EXISTS idx_documents_search_vector")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS search_vector")
