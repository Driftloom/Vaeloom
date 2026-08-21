"""Migration 0008 — document content column (in-app viewer) and
document_actions table (durable rename/archive/restore history + undo)."""
from sqlalchemy import inspect, text

VERSION = "0008_document_content"


async def upgrade(conn) -> None:
    has_docs = await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("documents")
    )
    if not has_docs:
        await conn.execute(text(
            "CREATE TABLE documents ("
            "id VARCHAR(36) PRIMARY KEY, workspace_id VARCHAR(36) NOT NULL, "
            "name VARCHAR(500) NOT NULL, path VARCHAR(1000), "
            "mime_type VARCHAR(255), size INTEGER DEFAULT 0, "
            "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "
            "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "
            "deleted_at TIMESTAMP"
            ")"
        ))
    dialect = conn.dialect.name
    columns = await conn.run_sync(
        lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("documents")]
    )
    if "content" not in columns:
        blob_type = "BLOB" if dialect == "sqlite" else "BYTEA"
        await conn.execute(text(f"ALTER TABLE documents ADD COLUMN content {blob_type}"))

    if not await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("document_actions")
    ):
        await conn.execute(text("""
            CREATE TABLE document_actions (
                id VARCHAR(36) PRIMARY KEY,
                document_id VARCHAR(36) NOT NULL,
                workspace_id VARCHAR(36) NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                old_path VARCHAR(1000),
                new_path VARCHAR(1000),
                old_deleted_at TIMESTAMP,
                new_deleted_at TIMESTAMP,
                undone_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_document_actions_document "
            "ON document_actions (document_id, created_at)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_document_actions_workspace "
            "ON document_actions (workspace_id, created_at)"
        ))


async def downgrade(conn) -> None:
    await conn.execute(text("DROP TABLE IF EXISTS document_actions"))
    has_docs = await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("documents")
    )
    if has_docs:
        columns = await conn.run_sync(
            lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("documents")]
        )
        if "content" in columns:
            dialect = conn.dialect.name
            if dialect == "postgresql":
                await conn.execute(text("ALTER TABLE documents DROP COLUMN content CASCADE"))
            else:
                await conn.execute(text("ALTER TABLE documents DROP COLUMN content"))
