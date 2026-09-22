"""Outbox relay tick (Loop 3): daemon delivers due event.* rows durably."""
import asyncio
import uuid
from datetime import UTC, datetime

import pytest

pytestmark = pytest.mark.asyncio


@pytest.fixture
def relay_db(tmp_path, monkeypatch):
    """Throwaway SQLite DB wired into api.database.async_session_factory."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    import api.database as db_mod

    async def _build():
        engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'relay.db'}", poolclass=NullPool)
        async with engine.begin() as conn:
            from api.database import Base
            await conn.run_sync(Base.metadata.create_all)
        return engine, async_sessionmaker(engine, expire_on_commit=False)

    loop = asyncio.get_event_loop()
    engine, factory = loop.run_until_complete(_build())
    monkeypatch.setattr(db_mod, "async_session_factory", factory)
    yield factory
    loop.run_until_complete(engine.dispose())


async def _seed(factory, event_type="event.document.created"):
    from api.services.outbox import record_outbox_event

    async with factory() as session:
        record_outbox_event(
            session,
            event_type=event_type,
            payload={"event_id": "e-1", "event_type": "document.created",
                     "workspace_id": None, "payload": {}},
            workspace_id=None,
        )
        await session.commit()


async def _count(factory, status):
    from sqlalchemy import func, select

    from api.models.schema import OutboxEvent

    async with factory() as session:
        return (await session.execute(
            select(func.count()).select_from(OutboxEvent).where(OutboxEvent.status == status)
        )).scalar_one()


class TestOutboxRelayTick:
    async def test_disabled_by_default(self, relay_db, monkeypatch):
        from api.config import settings
        from api.infrastructure.background_daemon import _run_outbox_relay

        monkeypatch.setattr(settings, "outbox_relay_enabled", False)
        await _seed(relay_db)
        result = await _run_outbox_relay(datetime.now(UTC))
        assert result["status"] == "disabled"
        assert await _count(relay_db, "pending") == 1

    async def test_enabled_publishes_event_rows(self, relay_db, monkeypatch):
        from api.config import settings
        from api.infrastructure.background_daemon import _run_outbox_relay

        monkeypatch.setattr(settings, "outbox_relay_enabled", True)
        await _seed(relay_db)
        result = await _run_outbox_relay(datetime.now(UTC))
        assert result == {"status": "ok", "published": 1, "retried": 0, "failed": 0}
        assert await _count(relay_db, "published") == 1

    async def test_relay_ignores_other_families(self, relay_db, monkeypatch):
        from api.config import settings
        from api.infrastructure.background_daemon import _run_outbox_relay

        monkeypatch.setattr(settings, "outbox_relay_enabled", True)
        await _seed(relay_db, event_type="application.status_changed")
        result = await _run_outbox_relay(datetime.now(UTC))
        assert result["published"] == 0
        assert await _count(relay_db, "pending") == 1

    async def test_tick_never_raises(self, relay_db, monkeypatch):
        from api.infrastructure import background_daemon as daemon_mod

        async def _boom():
            raise RuntimeError("db gone")

        monkeypatch.setattr(daemon_mod, "_run_due_agent_schedules", _boom)
        # _daemon_tick swallows poller exceptions by design (return_exceptions)
        await daemon_mod._daemon_tick(datetime.now(UTC))
