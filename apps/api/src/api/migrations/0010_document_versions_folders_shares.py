"""Migration 0010 — document_versions, folders, document_shares tables.

Creates:
- document_versions: stores file snapshots per document with UNIQUE(document_id, version_number)
  constraint that prevents the P0-07 version number race condition.
- folders: hierarchical folder structure within workspaces.
- document_shares: per-document share grants with explicit permission field (P0-03).
- Missing columns on documents table: tenant_id, user_id, summary, scan_status,
  scan_result, detected_mime_type, metadata_, raw_storage_key, folder_id, status.
"""
from sqlalchemy import inspect, text

VERSION = "0010_document_versions_folders_shares"


async def upgrade(conn) -> None:
    dialect = conn.dialect.name

    # -------------------------------------------------------------------------
    # 1. document_versions
    # -------------------------------------------------------------------------
    if not await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("document_versions")
    ):
        blob_type = "BLOB" if dialect == "sqlite" else "BYTEA"
        await conn.execute(text(f"""
            CREATE TABLE document_versions (
                id VARCHAR(36) PRIMARY KEY,
                document_id VARCHAR(36) NOT NULL,
                version_number INTEGER NOT NULL,
                storage_key VARCHAR(1000),
                checksum VARCHAR(64),
                size_bytes INTEGER DEFAULT 0,
                content {blob_type},
                created_by VARCHAR(36),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        # P0-07: UNIQUE constraint prevents race-condition duplicate version numbers
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_version "
            "ON document_versions (document_id, version_number)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_document_versions_doc "
            "ON document_versions (document_id)"
        ))

    # -------------------------------------------------------------------------
    # 2. folders
    # -------------------------------------------------------------------------
    if not await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("folders")
    ):
        await conn.execute(text("""
            CREATE TABLE folders (
                id VARCHAR(36) PRIMARY KEY,
                workspace_id VARCHAR(36) NOT NULL,
                parent_id VARCHAR(36),
                name VARCHAR(500) NOT NULL,
                path VARCHAR(2000),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_folders_workspace ON folders (workspace_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders (parent_id)"
        ))

    # -------------------------------------------------------------------------
    # 3. document_shares  (P0-03: explicit permission field)
    # -------------------------------------------------------------------------
    if not await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("document_shares")
    ):
        await conn.execute(text("""
            CREATE TABLE document_shares (
                id VARCHAR(36) PRIMARY KEY,
                document_id VARCHAR(36) NOT NULL,
                workspace_id VARCHAR(36) NOT NULL,
                shared_with_user_id VARCHAR(36),
                shared_with_workspace_id VARCHAR(36),
                permission VARCHAR(20) NOT NULL DEFAULT 'read',
                created_by VARCHAR(36),
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_document_shares_doc "
            "ON document_shares (document_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_document_shares_user "
            "ON document_shares (shared_with_user_id)"
        ))

    # -------------------------------------------------------------------------
    # 4. Missing columns on documents table
    # -------------------------------------------------------------------------
    has_docs = await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("documents")
    )
    if has_docs:
        existing = await conn.run_sync(
            lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("documents")]
        )
        json_type = "TEXT" if dialect == "sqlite" else "JSONB"
        missing_columns = {
            "tenant_id": "VARCHAR(36)",
            "user_id": "VARCHAR(36)",
            "summary": "TEXT",
            "expiration_policy": "VARCHAR(50)",
            "scan_status": "VARCHAR(50)",
            "scan_result": "TEXT",
            "detected_mime_type": "VARCHAR(255)",
            "metadata_": json_type,
            "raw_storage_key": "VARCHAR(1000)",
            "folder_id": "VARCHAR(36)",
            "status": "VARCHAR(50) DEFAULT 'ACTIVE'",
        }
        for col, col_type in missing_columns.items():
            if col not in existing:
                await conn.execute(text(
                    f"ALTER TABLE documents ADD COLUMN {col} {col_type}"
                ))


async def downgrade(conn) -> None:
    await conn.execute(text("DROP TABLE IF EXISTS document_shares"))
    await conn.execute(text("DROP TABLE IF EXISTS document_versions"))
    await conn.execute(text("DROP TABLE IF EXISTS folders"))
