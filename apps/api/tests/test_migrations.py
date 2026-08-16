import pytest
import pytest_asyncio
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from api.migrations import MIGRATIONS, downgrade_to, run_migrations

pytestmark = pytest.mark.asyncio

EXPECTED_VERSIONS = {"0002_microservice_tables", "0003_approvals", "0004_memory_taxonomy", "0005_rls", "0006_idempotency", "0007_gmail_watch"}


@pytest_asyncio.fixture
async def migration_engine(tmp_path):
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{tmp_path / 'migrate.db'}",
        poolclass=NullPool,
    )
    yield engine
    await engine.dispose()


class TestMigrationRunner:
    async def test_all_migrations_registered(self):
        assert EXPECTED_VERSIONS.issubset(set(MIGRATIONS.keys()))

    async def test_applies_pending_migrations(self, migration_engine):
        applied = await run_migrations(migration_engine)
        assert set(applied) == EXPECTED_VERSIONS

        async with migration_engine.begin() as conn:
            result = await conn.execute(text("SELECT version FROM schema_migrations ORDER BY version"))
            assert {row[0] for row in result.fetchall()} == EXPECTED_VERSIONS

    async def test_second_run_is_noop(self, migration_engine):
        await run_migrations(migration_engine)
        applied = await run_migrations(migration_engine)
        assert applied == []

    async def test_creates_approval_tables(self, migration_engine):
        await run_migrations(migration_engine)
        async with migration_engine.connect() as conn:
            def _has(sync_conn, table):
                return inspect(sync_conn).has_table(table)
            assert await conn.run_sync(lambda sc: _has(sc, "agent_approvals"))
            assert await conn.run_sync(lambda sc: _has(sc, "idempotency_records"))
            assert await conn.run_sync(lambda sc: _has(sc, "schema_migrations"))

    async def test_memory_taxonomy_columns_added(self, migration_engine):
        async with migration_engine.begin() as conn:
            await conn.execute(text(
                "CREATE TABLE memories (id VARCHAR(36) PRIMARY KEY, type VARCHAR(50) NOT NULL, "
                "status VARCHAR(20), tenant_id VARCHAR(36))"
            ))
        await run_migrations(migration_engine)
        async with migration_engine.connect() as conn:
            def _columns(sync_conn):
                return {c["name"] for c in inspect(sync_conn).get_columns("memories")}
            columns = await conn.run_sync(_columns)
        assert {"domain", "supersedes_id", "deleted_at"}.issubset(columns)

    async def test_downgrade_rolls_back(self, migration_engine):
        await run_migrations(migration_engine)
        rolled_back = await downgrade_to(migration_engine, None)
        assert set(rolled_back) == EXPECTED_VERSIONS

        async with migration_engine.begin() as conn:
            result = await conn.execute(text("SELECT COUNT(*) FROM schema_migrations"))
            assert result.scalar_one() == 0

    async def test_downgrade_partial(self, migration_engine):
        await run_migrations(migration_engine)
        rolled_back = await downgrade_to(migration_engine, "0004_memory_taxonomy")
        assert set(rolled_back) == {"0007_gmail_watch", "0006_idempotency", "0005_rls"}

        async with migration_engine.begin() as conn:
            result = await conn.execute(text("SELECT version FROM schema_migrations ORDER BY version"))
            assert [r[0] for r in result.fetchall()] == ["0002_microservice_tables", "0003_approvals", "0004_memory_taxonomy"]

    async def test_downgrade_drops_approval_table(self, migration_engine):
        await run_migrations(migration_engine)
        await downgrade_to(migration_engine, None)
        async with migration_engine.connect() as conn:
            assert not await conn.run_sync(lambda sc: inspect(sc).has_table("agent_approvals"))
            assert not await conn.run_sync(lambda sc: inspect(sc).has_table("idempotency_records"))

    async def test_rls_noop_on_sqlite(self, migration_engine):
        import importlib
        rls_module = importlib.import_module("api.migrations.0005_rls")
        async with migration_engine.begin() as conn:
            await rls_module.upgrade(conn)
        async with migration_engine.connect() as conn:
            assert await conn.run_sync(lambda sc: inspect(sc).has_table("memories")) is False

    async def test_reapply_after_downgrade(self, migration_engine):
        await run_migrations(migration_engine)
        await downgrade_to(migration_engine, None)
        applied = await run_migrations(migration_engine)
        assert set(applied) == EXPECTED_VERSIONS

    async def test_runs_cleanly_on_create_all_schema(self, migration_engine):
        """Startup path: create_all runs first (fresh DB), migrations must be no-ops."""
        import api.models  # noqa: F401
        from api.database import Base
        async with migration_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        applied = await run_migrations(migration_engine)
        assert set(applied) == EXPECTED_VERSIONS

        async with migration_engine.connect() as conn:
            def _columns(sync_conn):
                return {c["name"] for c in inspect(sync_conn).get_columns("memories")}
            columns = await conn.run_sync(_columns)
            assert {"domain", "supersedes_id", "deleted_at"}.issubset(columns)
            assert await conn.run_sync(lambda sc: inspect(sc).has_table("agent_approvals"))
            assert await conn.run_sync(lambda sc: inspect(sc).has_table("idempotency_records"))

    async def test_runs_cleanly_on_create_all_schema_twice(self, migration_engine):
        """Second boot: schema_migrations present, all versions recorded, no re-runs."""
        import api.models  # noqa: F401
        from api.database import Base
        async with migration_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await run_migrations(migration_engine)
        applied = await run_migrations(migration_engine)
        assert applied == []
