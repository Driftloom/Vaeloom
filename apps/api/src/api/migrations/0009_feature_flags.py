"""Migration 0009 — feature_flags table.

Workspace-scoped feature flags for A/B testing and progressive rollouts.
Idempotent: no-op if the table already exists.
"""
from sqlalchemy import inspect, text

VERSION = "0009_feature_flags"


async def upgrade(conn) -> None:
    if await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table("feature_flags")):
        return
    await conn.execute(text("""
        CREATE TABLE feature_flags (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            enabled INTEGER DEFAULT 0,
            rollout_percentage INTEGER DEFAULT 0,
            category TEXT DEFAULT 'general',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_feature_flags_workspace "
        "ON feature_flags (workspace_id)"
    ))
    await conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_workspace_name "
        "ON feature_flags (workspace_id, name)"
    ))


async def downgrade(conn) -> None:
    await conn.execute(text("DROP TABLE IF EXISTS feature_flags"))
