"""Migration 0007 — Gmail push watch state (watch lifecycle for push
notifications, renewal and reconciliation)."""
from sqlalchemy import inspect, text

VERSION = "0007_gmail_watch"


async def upgrade(conn) -> None:
    if await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table("gmail_watches")):
        return
    await conn.execute(text("""
        CREATE TABLE gmail_watches (
            id VARCHAR(36) PRIMARY KEY,
            workspace_id VARCHAR(36) NOT NULL,
            user_id VARCHAR(36) NOT NULL,
            topic VARCHAR(512) NOT NULL,
            channel_id VARCHAR(255) NOT NULL,
            resource_id VARCHAR(255),
            history_id VARCHAR(64),
            expiration TIMESTAMP,
            status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
            last_reconciled_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_gmail_watches_workspace UNIQUE (workspace_id)
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_gmail_watches_channel_id "
        "ON gmail_watches (channel_id)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_gmail_watches_status_expiration "
        "ON gmail_watches (status, expiration)"
    ))


async def downgrade(conn) -> None:
    await conn.execute(text("DROP TABLE IF EXISTS gmail_watches"))
