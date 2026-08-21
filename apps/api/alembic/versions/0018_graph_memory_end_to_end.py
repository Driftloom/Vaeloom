"""Graph Memory End-to-End: DB-backed versioning + chunk->embedding auto-wiring

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-22

Fixes EXC-P12-03 (memory versioning in-memory only) and EXC-P12-04 (chunk/embedding not wired).

- memory_versions: durable version history for Memory rows (replaces in-memory dict)
- document_chunks: persisted chunk rows with provenance (index, offsets, token_count) so pipeline's
  chunk_text() output is durable and auto-embedded via embeddings table.

Both tables are SQLite-compatible (via Base.metadata.create_all fallback) and Postgres-native.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return table in insp.get_table_names()


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    # -- memory_versions (DB-backed versioning) --
    if not _has_table("memory_versions"):
        op.create_table(
            "memory_versions",
            sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
            sa.Column("memory_id", PG_UUID(as_uuid=True), sa.ForeignKey("memories.id", ondelete="CASCADE"), nullable=False),
            sa.Column("workspace_id", PG_UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
            sa.Column("version_number", sa.Integer, nullable=False),
            sa.Column("changes", sa.JSON, nullable=False),
            sa.Column("snapshot", sa.JSON, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("created_by", PG_UUID(as_uuid=True), nullable=True),
            sa.UniqueConstraint("memory_id", "version_number", name="uq_memory_version_number"),
        )
        op.create_index("idx_memory_versions_memory_id", "memory_versions", ["memory_id"])
        op.create_index("idx_memory_versions_workspace_id", "memory_versions", ["workspace_id"])
        op.create_index("idx_memory_versions_created_at", "memory_versions", ["created_at"])

    # -- document_chunks (persisted chunk provenance + chunk->embedding linkage) --
    if not _has_table("document_chunks"):
        # Use PG VECTOR only on Postgres; on SQLite this is mocked as Text in main.py lifespan
        # but the column is created as TEXT via generic type for cross-compat.
        # We keep embedding linkage via embeddings table (source_type=document_chunk), not inline vector.
        op.create_table(
            "document_chunks",
            sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
            sa.Column("workspace_id", PG_UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
            sa.Column("document_id", PG_UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
            sa.Column("document_version_id", PG_UUID(as_uuid=True), sa.ForeignKey("document_versions.id", ondelete="CASCADE"), nullable=True),
            sa.Column("chunk_index", sa.Integer, nullable=False),
            sa.Column("content", sa.Text, nullable=False),
            sa.Column("start_offset", sa.Integer, nullable=False),
            sa.Column("end_offset", sa.Integer, nullable=False),
            sa.Column("token_count", sa.Integer, nullable=False),
            sa.Column("embedding_id", PG_UUID(as_uuid=True), sa.ForeignKey("embeddings.id", ondelete="SET NULL"), nullable=True),
            sa.Column("content_hash", sa.String(64), nullable=True),
            sa.Column("metadata", sa.JSON, nullable=False, server_default=sa.text("'{}'")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.UniqueConstraint("document_version_id", "chunk_index", name="uq_chunk_version_index"),
        )
        op.create_index("idx_document_chunks_workspace", "document_chunks", ["workspace_id"])
        op.create_index("idx_document_chunks_document", "document_chunks", ["document_id"])
        op.create_index("idx_document_chunks_version", "document_chunks", ["document_version_id"])
        op.create_index("idx_document_chunks_embedding", "document_chunks", ["embedding_id"])


def downgrade() -> None:
    for idx in ["idx_document_chunks_embedding", "idx_document_chunks_version", "idx_document_chunks_document", "idx_document_chunks_workspace"]:
        try:
            op.drop_index(idx, table_name="document_chunks")
        except Exception:
            pass
    if _has_table("document_chunks"):
        op.drop_table("document_chunks")

    for idx in ["idx_memory_versions_created_at", "idx_memory_versions_workspace_id", "idx_memory_versions_memory_id"]:
        try:
            op.drop_index(idx, table_name="memory_versions")
        except Exception:
            pass
    if _has_table("memory_versions"):
        op.drop_table("memory_versions")
