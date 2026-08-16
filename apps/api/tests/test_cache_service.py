import json
import time
from unittest.mock import MagicMock, AsyncMock
import pytest
from api.services.cache_service import CacheService


@pytest.fixture
def cache_service():
    svc = CacheService()
    svc._store = {}
    svc._redis = None
    return svc


def _redis_cache():
    """Return a CacheService instance backed by a fake redis."""
    svc = CacheService()
    fake_redis = MagicMock()
    fake_redis.get = AsyncMock()
    fake_redis.setex = AsyncMock()
    fake_redis.delete = AsyncMock()
    fake_redis.keys = AsyncMock()
    fake_redis.ping = AsyncMock()
    svc._redis = fake_redis
    svc._store = {}
    return svc


@pytest.mark.asyncio
async def test_set_and_get(cache_service):
    await cache_service.set("key1", "value1", ttl=300)
    assert await cache_service.get("key1") == "value1"


@pytest.mark.asyncio
async def test_redis_get_hit():
    svc = _redis_cache()
    svc._redis.get.return_value = json.dumps("redis-val")
    val = await svc.get("rk")
    assert val == "redis-val"
    svc._redis.get.assert_awaited_once_with("rk")


@pytest.mark.asyncio
async def test_redis_get_miss():
    svc = _redis_cache()
    svc._redis.get.return_value = None
    val = await svc.get("rk")
    assert val is None


@pytest.mark.asyncio
async def test_redis_set():
    svc = _redis_cache()
    await svc.set("rk", "redis-val", ttl=60)
    svc._redis.setex.assert_awaited_once_with("rk", 60, json.dumps("redis-val"))


@pytest.mark.asyncio
async def test_redis_delete():
    svc = _redis_cache()
    await svc.delete("rk")
    svc._redis.delete.assert_awaited_once_with("rk")


@pytest.mark.asyncio
async def test_redis_invalidate():
    svc = _redis_cache()
    svc._redis.keys.return_value = ["rk1", "rk2"]
    await svc.invalidate("rk*")
    svc._redis.keys.assert_awaited_once_with("rk*")
    svc._redis.delete.assert_awaited_once_with("rk1", "rk2")


@pytest.mark.asyncio
async def test_get_cache_miss(cache_service):
    assert await cache_service.get("nonexistent") is None


@pytest.mark.asyncio
async def test_delete(cache_service):
    await cache_service.set("key2", "value2", ttl=300)
    await cache_service.delete("key2")
    assert await cache_service.get("key2") is None


@pytest.mark.asyncio
async def test_ttl_expiration(cache_service):
    await cache_service.set("key3", "value3", ttl=1)
    assert await cache_service.get("key3") == "value3"
    time.sleep(1.5)
    assert await cache_service.get("key3") is None


@pytest.mark.asyncio
async def test_set_without_ttl(cache_service):
    await cache_service.set("key4", "value4", ttl=0)
    assert await cache_service.get("key4") == "value4"


@pytest.mark.asyncio
async def test_invalidate_pattern(cache_service):
    await cache_service.set("user:1:name", "Alice", ttl=300)
    await cache_service.set("user:2:name", "Bob", ttl=300)
    await cache_service.set("config:theme", "dark", ttl=300)
    await cache_service.invalidate("user:*")
    assert await cache_service.get("user:1:name") is None
    assert await cache_service.get("user:2:name") is None
    assert await cache_service.get("config:theme") == "dark"


@pytest.mark.asyncio
async def test_delete_nonexistent_key(cache_service):
    await cache_service.delete("does_not_exist")
