"""Replace IVFFlat with HNSW index for pgvector embeddings

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-17 00:00:00.000000

HNSW (Hierarchical Navigable Small World) provides better query-time
performance than IVFFlat for cosine similarity search:
- No required build-time parameter (lists)
- Better recall at high dimensions (1536)
- No clustering step needed

The existing IVFFlat index (from extensions.sql) is dropped and replaced.
IVFFlat required sqrt(row_count) lists and needed rebuilding as data grew.
HNSW is self-tuning and works well from day one.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # Drop the old IVFFlat index if it exists
    op.execute("DROP INDEX IF EXISTS idx_embeddings_vector_ivfflat")

    # Create HNSW index for cosine similarity search
    # m=16: connections per layer (default, good for 1536-dim)
    # ef_construction=64: build-time quality (higher = better recall, slower build)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw "
        "ON embeddings USING hnsw (vector vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )

    # Also add HNSW index on the memories table embedding column
    # This supports direct similarity search on memories without going through
    # the separate embeddings table.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw "
        "ON memories USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    op.execute("DROP INDEX IF EXISTS idx_memories_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS idx_embeddings_vector_hnsw")

    # Recreate IVFFlat as fallback
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_embeddings_vector_ivfflat "
        "ON embeddings USING ivfflat (vector vector_cosine_ops) "
        "WITH (lists = 100)"
    )
