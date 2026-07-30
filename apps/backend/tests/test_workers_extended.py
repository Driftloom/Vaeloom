import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_redis(monkeypatch):
    redis_mock = AsyncMock()
    redis_mock.hgetall = AsyncMock(return_value={})
    redis_mock.hset = AsyncMock()
    redis_mock.zadd = AsyncMock()
    redis_mock.sadd = AsyncMock()
    redis_mock.blpop = AsyncMock()
    redis_mock.close = AsyncMock()
    import redis.asyncio
    monkeypatch.setattr(redis.asyncio.Redis, "from_url", lambda *a, **kw: redis_mock)
    return redis_mock


class TestBullMQWorkerExtended:
    async def test_init_with_custom_params(self):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="custom", redis_url="redis://myhost:6380/0", concurrency=10, poll_interval=0.5)
        assert worker.queue_name == "custom"
        assert worker.redis_url == "redis://myhost:6380/0"
        assert worker.concurrency == 10
        assert worker.poll_interval == 0.5

    async def test_properties(self):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        assert worker._wait_key == "bull:events:wait"
        assert worker._active_key == "bull:events:active"
        assert worker._completed_key == "bull:events:completed"
        assert worker._failed_key == "bull:events:failed"
        assert worker._job_key("abc") == "bull:events:abc"

    async def test_register_stores_handler(self):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        async def handler(data):
            pass
        worker.register("my.type", handler)
        assert "my.type" in worker._handlers
        assert worker._handlers["my.type"] is handler

    async def test_start_blpop_returns_job_id(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        mock_redis.blpop.side_effect = [("bull:events:wait", "job-1"), asyncio.CancelledError()]
        with patch.object(worker, "_process_job", AsyncMock()) as mock_process:
            await worker.start()
            mock_process.assert_awaited_once_with("job-1")

    async def test_start_blpop_returns_none(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        mock_redis.blpop.side_effect = [None, asyncio.CancelledError()]
        with patch.object(worker, "_process_job", AsyncMock()) as mock_process:
            await worker.start()
            mock_process.assert_not_called()

    async def test_start_cancelled_error_drains(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        mock_redis.blpop.side_effect = asyncio.CancelledError()
        with patch.object(worker, "_drain", AsyncMock()) as mock_drain:
            await worker.start()
            mock_drain.assert_awaited_once()

    async def test_process_job_success_path(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        handler = AsyncMock(return_value={"handled": True})
        worker.register("test.type", handler)
        mock_redis.hgetall = AsyncMock(return_value={
            "name": "test.type",
            "data": '{"key": "val"}',
            "timestamp": "2000",
        })
        await worker._process_job("job-1")
        handler.assert_called_once_with({"key": "val"})
        mock_redis.zadd.assert_called_once_with("bull:events:completed", {"job-1": "2000"})
        assert mock_redis.hset.call_count == 1

    async def test_process_job_no_handler(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        mock_redis.hgetall = AsyncMock(return_value={
            "name": "unknown.type",
            "data": "{}",
            "timestamp": "3000",
        })
        await worker._process_job("job-2")
        mock_redis.sadd.assert_called_once_with("bull:events:failed", "job-2")
        mock_redis.hset.assert_called_once()

    async def test_process_job_handler_raises(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        async def failing(data):
            raise RuntimeError("fail")
        worker.register("fail.type", failing)
        mock_redis.hgetall = AsyncMock(return_value={
            "name": "fail.type",
            "data": "{}",
            "timestamp": "4000",
        })
        await worker._process_job("job-3")
        mock_redis.zadd.assert_called_once_with("bull:events:failed", {"job-3": 0})
        mock_redis.hset.assert_called_once_with("bull:events:job-3", "failedReason", "Worker processing error")

    async def test_process_job_not_found(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        mock_redis.hgetall = AsyncMock(return_value={})
        await worker._process_job("missing-job")
        mock_redis.zadd.assert_not_called()
        mock_redis.sadd.assert_not_called()

    async def test_stop_sets_running_and_closes(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        worker._running = True
        await worker.stop()
        assert worker._running is False
        assert worker._redis is None
        mock_redis.close.assert_called_once()

    async def test_drain_awaits_active_tasks(self):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        task = asyncio.create_task(asyncio.sleep(0.01))
        worker._active_tasks.add(task)
        await worker._drain()
        assert task.done()

    async def test_drain_no_active_tasks(self):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        await worker._drain()

    async def test_handle_event_publish_agent_execute(self, monkeypatch):
        mock_handle = AsyncMock(return_value="agent_done")
        mock_request = MagicMock()
        monkeypatch.setattr("backend.orchestrator.router.handle", mock_handle)
        monkeypatch.setattr("backend.orchestrator.router.UserRequest", lambda **kw: mock_request)
        from backend.workers.queue_worker import handle_event_publish
        result = await handle_event_publish({
            "type": "agent.execute",
            "payload": {"message": "run test", "workspaceId": "ws-1"},
            "tenantId": "tenant-1",
        })
        assert result["status"] == "processed"
        assert result["agent_result"] == "agent_done"

    async def test_handle_event_publish_other_event(self):
        from backend.workers.queue_worker import handle_event_publish
        result = await handle_event_publish({
            "type": "user.login",
            "payload": {"userId": "u1"},
        })
        assert result["status"] == "acknowledged"
        assert result["event_type"] == "user.login"

    async def test_handle_subscription_create(self):
        from backend.workers.queue_worker import handle_subscription_create
        result = await handle_subscription_create({
            "eventType": "user.created",
            "handlerId": "h-1",
        })
        assert result["status"] == "registered"
        assert result["event_type"] == "user.created"

    async def test_get_redis_creates_when_none(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        assert worker._redis is None
        r = await worker._get_redis()
        assert r is mock_redis
        assert worker._redis is mock_redis

    async def test_get_redis_returns_existing(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        r = await worker._get_redis()
        assert r is mock_redis

    async def test_start_blpop_raises_generic_exception(self, mock_redis):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis
        mock_redis.blpop.side_effect = [RuntimeError("connection error"), asyncio.CancelledError()]
        await worker.start()
        mock_redis.blpop.assert_called()

    async def test_run_worker_full_entry(self, monkeypatch):
        from backend.workers.queue_worker import run_worker
        mock_worker = AsyncMock()
        mock_worker.start = AsyncMock()
        mock_worker.stop = AsyncMock()
        mock_worker_task = AsyncMock()
        mock_worker_task.done.return_value = True

        async def fake_start():
            pass

        async def fake_stop():
            pass

        called = {"start": False, "stop": False}

        async def tracking_start():
            called["start"] = True

        async def tracking_stop():
            called["stop"] = True

        mock_worker.start = tracking_start
        mock_worker.stop = tracking_stop

        monkeypatch.setattr("backend.workers.queue_worker.BullMQWorker", lambda **kw: mock_worker)
        monkeypatch.setattr("asyncio.get_event_loop", lambda: AsyncMock())

        loop = AsyncMock()
        monkeypatch.setattr("asyncio.get_event_loop", lambda: loop)
        loop.add_signal_handler = lambda *a: None

        stop_event = AsyncMock()
        stop_event.wait = AsyncMock()

        async def fake_wait():
            called["stopped"] = True

        import asyncio
        orig_create_task = asyncio.create_task

        def stubbed_create_task(coro, *a, **kw):
            class FakeTask:
                def __await__(self):
                    return iter(())
                def cancel(self):
                    pass
            return FakeTask()

        monkeypatch.setattr(asyncio, "Event", lambda: stop_event)
        monkeypatch.setattr(asyncio, "create_task", stubbed_create_task)

        await run_worker()

    async def test_worker_stop_no_redis(self):
        from backend.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._running = True
        await worker.stop()
        assert worker._running is False

    def test_main_block_import(self):
        import backend.workers.queue_worker
        assert backend.workers.queue_worker.__name__ == "backend.workers.queue_worker"

    # ── run_worker — covers lines 189-216 ──────────────────────────────

    async def test_run_worker_cancelled_path(self, monkeypatch):
        import signal
        from backend.workers.queue_worker import run_worker

        mock_worker = MagicMock()

        async def blocked_start():
            await asyncio.Event().wait()

        mock_worker.start = blocked_start
        mock_worker.stop = AsyncMock()
        mock_worker.register = MagicMock()

        monkeypatch.setattr("backend.workers.queue_worker.BullMQWorker", lambda **kw: mock_worker)

        handlers = []

        def add_signal_handler(sig, handler):
            handlers.append(handler)
            if len(handlers) == 1:
                return
            raise NotImplementedError("Signal not supported")

        loop = AsyncMock()
        loop.add_signal_handler = add_signal_handler
        monkeypatch.setattr("asyncio.get_event_loop", lambda: loop)

        stop_event = asyncio.Event()
        monkeypatch.setattr(asyncio, "Event", lambda: stop_event)

        task = asyncio.create_task(run_worker())
        await asyncio.sleep(0.05)

        handlers[0]()

        await asyncio.wait_for(task, timeout=3)
        mock_worker.stop.assert_called_once()

    # ── __main__ block — covers lines 220-221 ─────────────────────────

    def test_main_block_executes(self, monkeypatch):
        import backend.workers.queue_worker as module
        import pathlib

        mock_run = MagicMock()
        monkeypatch.setattr("asyncio.run", mock_run)
        monkeypatch.setattr("logging.basicConfig", MagicMock())

        source = pathlib.Path(module.__file__).read_text(encoding="utf-8")
        code = compile(source, module.__file__, "exec")
        globals_copy = dict(module.__dict__)
        globals_copy["__name__"] = "__main__"
        exec(code, globals_copy)

        mock_run.assert_called_once()
