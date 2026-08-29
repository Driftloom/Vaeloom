"""F-12 regression: scraping quota must be enforceable per-workspace, distributed
across workers when Redis is configured.
"""

import pytest

from api.tools import executor


@pytest.fixture
def reset_backend():
    executor._QUOTA_BACKEND = None
    yield
    executor._QUOTA_BACKEND = None


@pytest.mark.asyncio
async def test_in_memory_quota_enforces_limit(reset_backend):
    backend = executor._InMemoryScrapeQuota()
    executor.set_scrape_quota_backend(backend)
    ws = "ws-f12"
    # Allow up to the limit (5), then deny.
    for _ in range(5):
        assert await executor._check_scrape_quota(ws, limit=5, window_s=3600.0) is True
    assert await executor._check_scrape_quota(ws, limit=5, window_s=3600.0) is False


@pytest.mark.asyncio
async def test_quota_is_per_workspace(reset_backend):
    backend = executor._InMemoryScrapeQuota()
    executor.set_scrape_quota_backend(backend)
    # ws A exhausted, ws B still allowed.
    for _ in range(3):
        await executor._check_scrape_quota("wsA", limit=3, window_s=3600.0)
    assert await executor._check_scrape_quota("wsA", limit=3, window_s=3600.0) is False
    assert await executor._check_scrape_quota("wsB", limit=3, window_s=3600.0) is True


@pytest.mark.asyncio
async def test_backend_selection_prefers_redis_when_configured(reset_backend, monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://fake:6379/0")

    class FakeRedis:
        def __init__(self, *a, **k):
            self.z = {}

        async def zremrangebyscore(self, key, a, b):
            self.z[key] = [t for t in self.z.get(key, []) if t > b]
            return 0

        async def zcard(self, key):
            return len(self.z.get(key, []))

        async def zadd(self, key, mapping):
            self.z.setdefault(key, []).extend(mapping.values())

        async def expire(self, key, t):
            return True

    captured = {}

    class FakeFromUrl:
        def __init__(self, url, **k):
            captured["url"] = url
            self._r = FakeRedis()

        def __getattr__(self, item):
            return getattr(self._r, item)

    import redis.asyncio as _ra

    monkeypatch.setattr(_ra, "from_url", lambda url, **k: FakeFromUrl(url, **k))

    backend = executor._get_quota_backend()
    assert isinstance(backend, executor._RedisScrapeQuota)
    # Enforce through the redis backend
    for _ in range(2):
        assert await executor._check_scrape_quota("wsR", limit=2, window_s=3600.0) is True
    assert await executor._check_scrape_quota("wsR", limit=2, window_s=3600.0) is False


@pytest.mark.asyncio
async def test_backend_selection_falls_back_to_memory_without_redis(reset_backend, monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.delenv("REDIS__URL", raising=False)
    backend = executor._get_quota_backend()
    assert isinstance(backend, executor._InMemoryScrapeQuota)
