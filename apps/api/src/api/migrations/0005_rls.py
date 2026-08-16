"""Migration 0005 — row-level security (PostgreSQL only).

Enables RLS on tenant-scoped tables and installs policies that scope reads and
writes to the tenant set via `SET app.tenant_id`. On non-PostgreSQL dialects
(SQLite dev/test), this migration is a no-op.
"""
import logging

from sqlalchemy import inspect, text

logger = logging.getLogger("vaeloom-api.migrations")

VERSION = "0005_rls"

# Tables carrying a tenant_id column that should be RLS-scoped.
RLS_TABLES = ("memories", "events", "usage_records", "api_keys")


async def upgrade(conn) -> None:
    if conn.dialect.name != "postgresql":
        logger.info("RLS migration skipped: dialect=%s", conn.dialect.name)
        return
    for table in RLS_TABLES:
        if not await conn.run_sync(lambda sync_conn, t=table: inspect(sync_conn).has_table(t)):
            continue
        await conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        await conn.execute(text(
            f"CREATE POLICY tenant_isolation_{table} ON {table} "
            "USING (tenant_id::text = current_setting('app.tenant_id', true)) "
            "WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true))"
        ))
        logger.info("RLS enabled on %s", table)


async def downgrade(conn) -> None:
    if conn.dialect.name != "postgresql":
        return
    for table in RLS_TABLES:
        if not await conn.run_sync(lambda sync_conn, t=table: inspect(sync_conn).has_table(t)):
            continue
        await conn.execute(text(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}"))
        await conn.execute(text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
