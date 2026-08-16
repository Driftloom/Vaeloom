import pytest
from unittest.mock import AsyncMock

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_redis(monkeypatch):
    redis_mock = AsyncMock()
    redis_mock.hgetall = AsyncMock(return_value={})
    redis_mock.hset = AsyncMock()
    redis_mock.zadd = AsyncMock()
    redis_mock.sadd = AsyncMock()
    redis_mock.close = AsyncMock()
    import redis.asyncio
    monkeypatch.setattr(redis.asyncio.Redis, "from_url", lambda *a, **kw: redis_mock)
    return redis_mock


class TestBullMQWorker:
    async def test_process_job_success(self, mock_redis):
        from api.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis

        handler = AsyncMock(return_value={"status": "ok"})
        worker.register("test.type", handler)

        mock_redis.hgetall = AsyncMock(return_value={
            "name": "test.type",
            "data": '{"key": "value"}',
            "timestamp": "1000",
        })

        await worker._process_job("job1")
        handler.assert_called_once_with({"key": "value"})
        mock_redis.zadd.assert_called_once()
        mock_redis.hset.assert_called()

    async def test_process_job_no_handler(self, mock_redis):
        from api.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis

        mock_redis.hgetall = AsyncMock(return_value={
            "name": "unknown.type",
            "data": "{}",
            "timestamp": "1000",
        })

        await worker._process_job("job2")
        mock_redis.sadd.assert_called_once()
        mock_redis.hset.assert_called()

    async def test_process_job_error(self, mock_redis):
        from api.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis

        async def failing_handler(data):
            raise ValueError("processing failed")

        worker.register("failing.type", failing_handler)

        mock_redis.hgetall = AsyncMock(return_value={
            "name": "failing.type",
            "data": "{}",
            "timestamp": "1000",
        })

        await worker._process_job("job3")
        mock_redis.zadd.assert_called_once_with("bull:events:failed", {"job3": 0})

    async def test_stop(self, mock_redis):
        from api.workers.queue_worker import BullMQWorker
        worker = BullMQWorker(queue_name="events")
        worker._redis = mock_redis

        await worker.stop()
        assert worker._running is False
        assert worker._redis is None
        mock_redis.close.assert_called_once()
