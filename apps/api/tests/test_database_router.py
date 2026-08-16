from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import text

pytestmark = pytest.mark.asyncio


class TestDatabaseRouter:
    async def test_router_no_replica(self):
        from api.infrastructure.database_router import DatabaseRouter

        with patch.dict("os.environ", {"DATABASE_URL": "sqlite+aiosqlite://", "DATABASE_REPLICA_URL": ""}):
            router = DatabaseRouter(primary_url="sqlite+aiosqlite://")
            assert not router.has_replica

    async def test_router_with_replica(self):
        from api.infrastructure.database_router import DatabaseRouter

        router = DatabaseRouter(
            primary_url="sqlite+aiosqlite:///primary.db",
            replica_url="sqlite+aiosqlite:///replica.db",
        )
        assert router.has_replica

    async def test_read_session(self):
        from api.infrastructure.database_router import DatabaseRouter

        router = DatabaseRouter(primary_url="sqlite+aiosqlite://")
        async with router.get_read_session() as session:
            result = await session.execute(text("SELECT 1"))
            assert result is not None

    async def test_write_session(self):
        from api.infrastructure.database_router import DatabaseRouter

        router = DatabaseRouter(primary_url="sqlite+aiosqlite://")
        async with router.get_write_session() as session:
            result = await session.execute(text("SELECT 1"))
            assert result is not None

    async def test_get_router_singleton(self):
        from api.infrastructure.database_router import get_router, reset_router

        reset_router()
        r1 = get_router()
        r2 = get_router()
        assert r1 is r2
        reset_router()

    async def test_write_rollback_on_error(self):
        from api.infrastructure.database_router import DatabaseRouter

        router = DatabaseRouter(primary_url="sqlite+aiosqlite://")
        with pytest.raises(RuntimeError):
            async with router.get_write_session() as session:
                raise RuntimeError("test error")

    async def test_read_falls_back_to_primary(self):
        from api.infrastructure.database_router import DatabaseRouter

        router = DatabaseRouter(
            primary_url="sqlite+aiosqlite://",
            replica_url=None,
        )
        assert not router.has_replica
        async with router.get_read_session() as session:
            result = await session.execute(text("SELECT 1 AS val"))
            row = result.fetchone()
            assert row is not None
