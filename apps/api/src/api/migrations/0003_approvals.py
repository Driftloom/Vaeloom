"""Migration 0003 — agent approvals table (post-action confirmation for
consequential agent actions)."""
from sqlalchemy import inspect, text

VERSION = "0003_approvals"


async def upgrade(conn) -> None:
    if await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table("agent_approvals")):
        return
    await conn.execute(text("""
        CREATE TABLE agent_approvals (
            id VARCHAR(36) PRIMARY KEY,
            workspace_id VARCHAR(36),
            agent_name VARCHAR(100) NOT NULL,
            action_type VARCHAR(100) NOT NULL,
            payload TEXT,
            reason TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            requested_by VARCHAR(36),
            decided_by VARCHAR(36),
            decision_note TEXT,
            expires_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            decided_at TIMESTAMP
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_agent_approvals_workspace_status "
        "ON agent_approvals (workspace_id, status)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_agent_approvals_workspace_created "
        "ON agent_approvals (workspace_id, created_at)"
    ))


async def downgrade(conn) -> None:
    await conn.execute(text("DROP TABLE IF EXISTS agent_approvals"))
