"""Migration 0006 — idempotency records table (replay protection for
consequential POST/PATCH/PUT requests)."""
from sqlalchemy import inspect, text

VERSION = "0006_idempotency"


async def upgrade(conn) -> None:
    if await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table("idempotency_records")):
        return
    await conn.execute(text("""
        CREATE TABLE idempotency_records (
            id VARCHAR(36) PRIMARY KEY,
            idempotency_key VARCHAR(255) NOT NULL,
            request_path VARCHAR(255) NOT NULL,
            request_hash VARCHAR(64) NOT NULL,
            status_code INTEGER NOT NULL,
            response_body TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        )
    """))
    await conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_key_path "
        "ON idempotency_records (idempotency_key, request_path)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_idempotency_expires "
        "ON idempotency_records (expires_at)"
    ))


async def downgrade(conn) -> None:
    await conn.execute(text("DROP TABLE IF EXISTS idempotency_records"))
