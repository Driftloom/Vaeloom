import pytest
from unittest.mock import AsyncMock, MagicMock

from fastapi import Request
from starlette.responses import Response

from backend.middleware.rate_limit import APIKeyRateLimiter, MemoryBackend, RateLimitMiddleware


class TestAPIKeyRateLimiter:
    @pytest.mark.asyncio
    async def test_allows_under_limit(self):
        backend = MemoryBackend()
        limiter = APIKeyRateLimiter(backend, api_key_limit=5, window_seconds=60)
        allowed, retry_after = await limiter.check("key-123")
        assert allowed is True
        assert retry_after == 0

    @pytest.mark.asyncio
    async def test_rejects_over_limit(self):
        backend = MemoryBackend()
        limiter = APIKeyRateLimiter(backend, api_key_limit=2, window_seconds=60)
        await limiter.check("key-over")
        await limiter.check("key-over")
        allowed, retry_after = await limiter.check("key-over")
        assert allowed is False
        assert retry_after > 0

    @pytest.mark.asyncio
    async def test_independent_keys(self):
        backend = MemoryBackend()
        limiter = APIKeyRateLimiter(backend, api_key_limit=2, window_seconds=60)
        await limiter.check("key-a")
        await limiter.check("key-a")
        allowed_a, _ = await limiter.check("key-a")
        assert allowed_a is False
        allowed_b, _ = await limiter.check("key-b")
        assert allowed_b is True

    @pytest.mark.asyncio
    async def test_sliding_window_expires(self):
        backend = MemoryBackend()
        limiter = APIKeyRateLimiter(backend, api_key_limit=2, window_seconds=0.1)
        await limiter.check("key-slide")
        await limiter.check("key-slide")
        import time
        time.sleep(0.15)
        allowed, _ = await limiter.check("key-slide")
        assert allowed is True


class TestRateLimitMiddlewareAPIKey:
    @pytest.mark.asyncio
    async def test_skips_without_api_key(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=100, api_key_rate_limit=1000)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.state.user_id = "user-1"
        request.client.host = "127.0.0.1"
        request.headers = {}
        request.scope = {}
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_allows_api_key_under_limit(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=100, api_key_rate_limit=5)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.state.user_id = "user-1"
        request.client.host = "127.0.0.1"
        request.headers = {"X-API-Key": "test-api-key-abc"}
        request.scope = {}
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_blocks_api_key_over_limit(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=100, api_key_rate_limit=2)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.state.user_id = "user-1"
        request.client.host = "127.0.0.1"
        request.headers = {"X-API-Key": "over-key-abc"}
        request.scope = {}
        call_next = AsyncMock(return_value=Response())
        await middleware.dispatch(request, call_next)
        await middleware.dispatch(request, call_next)
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 429
        assert "API key rate limit exceeded" in result.body.decode()

    @pytest.mark.asyncio
    async def test_configurable_api_key_limit(self, monkeypatch):
        monkeypatch.setenv("API_KEY_RATE_LIMIT", "500")
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=100, api_key_rate_limit=500)
        assert middleware._api_key_limiter._api_key_limit == 500