"""Migration registry and runner.

Migrations are versioned modules exposing `upgrade(conn)` and `downgrade(conn)`
async functions. The runner records applied versions in `schema_migrations` and
applies pending migrations in ascending version order. Each migration is written
defensively so it is a no-op on schemas that already contain the target objects
(create_all runs first and may already have created everything on fresh DBs).
"""
import logging

from sqlalchemy import text

logger = logging.getLogger("vaeloom-api.migrations")

MIGRATIONS: dict[str, object] = {}


async def get_applied_versions(conn) -> set[str]:
    result = await conn.execute(text("SELECT version FROM schema_migrations"))
    return {row[0] for row in result.fetchall()}


async def run_migrations(engine) -> list[str]:
    applied_now: list[str] = []
    async with engine.begin() as conn:
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
        ))
        applied = await get_applied_versions(conn)
        for version in sorted(MIGRATIONS):
            if version in applied:
                continue
            migration = MIGRATIONS[version]
            await migration.upgrade(conn)
            await conn.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:v)"),
                {"v": version},
            )
            applied_now.append(version)
            logger.info("Applied migration %s", version)
    return applied_now


async def downgrade_to(engine, target_version: str | None) -> list[str]:
    """Roll back applied migrations until `target_version` (inclusive) is reached.
    Pass None to roll back everything."""
    rolled_back: list[str] = []
    async with engine.begin() as conn:
        applied = await get_applied_versions(conn)
        for version in sorted(MIGRATIONS, reverse=True):
            if version == target_version:
                break
            if version in applied:
                await MIGRATIONS[version].downgrade(conn)
                await conn.execute(
                    text("DELETE FROM schema_migrations WHERE version = :v"),
                    {"v": version},
                )
                rolled_back.append(version)
    return rolled_back
