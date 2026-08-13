"""Migration 0002 — microservice tables (knowledge graph).

Parity with the PostgreSQL alembic 0002 (knowledge-graph portion). The SQLite
runtime registry starts at 0003; knowledge_nodes / knowledge_edges are raw-SQL
tables not covered by Base.metadata.create_all, so SQLite databases never
created them. Idempotent: no-op if the tables already exist.
"""
from sqlalchemy import inspect, text

VERSION = "0002_microservice_tables"


async def upgrade(conn) -> None:
    if await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table("knowledge_nodes")):
        return
    await conn.execute(text("""
        CREATE TABLE knowledge_nodes (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            importance REAL DEFAULT 0.5,
            properties TEXT DEFAULT '{}',
            embedding TEXT,
            tenant_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    await conn.execute(text("""
        CREATE TABLE knowledge_edges (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
            relationship TEXT NOT NULL,
            weight REAL DEFAULT 1.0,
            properties TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source "
        "ON knowledge_edges (source_id)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target "
        "ON knowledge_edges (target_id)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_tenant_type "
        "ON knowledge_nodes (tenant_id, type)"
    ))


async def downgrade(conn) -> None:
    await conn.execute(text("DROP TABLE IF EXISTS knowledge_edges"))
    await conn.execute(text("DROP TABLE IF EXISTS knowledge_nodes"))