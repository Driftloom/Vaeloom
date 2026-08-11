"""Migration 0004 — memory taxonomy: `domain` facet, `supersedes_id` supersession
link, `deleted_at` soft-delete timestamp, and tenant/domain index on memories."""
from sqlalchemy import inspect, text

VERSION = "0004_memory_taxonomy"


async def _table_columns(conn) -> set[str]:
    def _columns(sync_conn):
        inspector = inspect(sync_conn)
        return {col["name"] for col in inspector.get_columns("memories")}
    return await conn.run_sync(_columns)


async def _add_column(conn, name: str, ddl_type: str) -> None:
    await conn.execute(text(f"ALTER TABLE memories ADD COLUMN {name} {ddl_type}"))


async def upgrade(conn) -> None:
    if not await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table("memories")):
        return
    columns = await _table_columns(conn)
    if "domain" not in columns:
        await _add_column(conn, "domain", "VARCHAR(100)")
    if "supersedes_id" not in columns:
        await _add_column(conn, "supersedes_id", "VARCHAR(36)")
    if "deleted_at" not in columns:
        await _add_column(conn, "deleted_at", "TIMESTAMP")
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_memories_tenant_domain "
        "ON memories (tenant_id, domain)"
    ))


async def downgrade(conn) -> None:
    if not await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table("memories")):
        return
    await conn.execute(text("DROP INDEX IF EXISTS idx_memories_tenant_domain"))
    columns = await _table_columns(conn)
    for name in ("deleted_at", "supersedes_id", "domain"):
        if name in columns:
            await conn.execute(text(f"ALTER TABLE memories DROP COLUMN {name}"))
