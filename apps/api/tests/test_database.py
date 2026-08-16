import pytest


class TestDatabase:
    def test_base_class_exists(self):
        from api.database import Base
        assert hasattr(Base, "metadata")

    def test_engine_exists(self):
        from api.database import engine
        assert engine is not None

    def test_async_session_factory_exists(self):
        from api.database import async_session_factory
        assert async_session_factory is not None

    @pytest.mark.asyncio
    async def test_get_db_yields_session(self):
        from api.database import get_db
        gen = get_db()
        session = await gen.__anext__()
        assert session is not None
        try:
            await gen.__anext__()
        except StopAsyncIteration:
            pass

    @pytest.mark.asyncio
    async def test_get_db_rollback_on_exception(self, monkeypatch):
        from api.database import get_db
        gen = get_db()
        session = await gen.__anext__()

        async def failing_commit():
            raise RuntimeError("commit failed")

        monkeypatch.setattr(session, "commit", failing_commit)

        rollback_called = False
        async def track_rollback():
            nonlocal rollback_called
            rollback_called = True
        monkeypatch.setattr(session, "rollback", track_rollback)

        close_called = False
        async def track_close():
            nonlocal close_called
            close_called = True
        monkeypatch.setattr(session, "close", track_close)

        with pytest.raises(RuntimeError, match="commit failed"):
            await gen.__anext__()

        assert rollback_called
        assert close_called
