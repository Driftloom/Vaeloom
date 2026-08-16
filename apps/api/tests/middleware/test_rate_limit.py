import time
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import Request
from starlette.responses import Response

from api.middleware.rate_limit import (
    MemoryBackend,
    RateLimitMiddleware,
    rate_limit,
    _resolve_rate_limit,
)


class TestMemoryBackend:
    @pytest.mark.asyncio
    async def test_allows_under_limit(self):
        backend = MemoryBackend()
        allowed, retry_after = await backend.check_and_record("test:key", 5, 60)
        assert allowed is True
        assert retry_after == 0

    @pytest.mark.asyncio
    async def test_rejects_over_limit(self):
        backend = MemoryBackend()
        for _ in range(2):
            allowed, _ = await backend.check_and_record("test:over", 2, 60)
            assert allowed is True
        allowed, retry_after = await backend.check_and_record("test:over", 2, 60)
        assert allowed is False
        assert retry_after >= 1

    @pytest.mark.asyncio
    async def test_returns_positive_retry_after(self):
        backend = MemoryBackend()
        for _ in range(3):
            await backend.check_and_record("test:retry", 3, 60)
        allowed, retry_after = await backend.check_and_record("test:retry", 3, 60)
        assert allowed is False
        assert retry_after > 0

    @pytest.mark.asyncio
    async def test_sliding_window_expires_old(self):
        backend = MemoryBackend()
        key = "test:slide"
        for _ in range(2):
            await backend.check_and_record(key, 2, 0.1)
        time.sleep(0.15)
        allowed, _ = await backend.check_and_record(key, 2, 0.1)
        assert allowed is True

    @pytest.mark.asyncio
    async def test_independent_keys(self):
        backend = MemoryBackend()
        for _ in range(3):
            await backend.check_and_record("key:a", 3, 60)
        allowed_a, _ = await backend.check_and_record("key:a", 3, 60)
        assert allowed_a is False
        allowed_b, _ = await backend.check_and_record("key:b", 3, 60)
        assert allowed_b is True


class TestRateLimitMiddleware:
    @pytest.mark.asyncio
    async def test_skips_health_endpoint(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=100)
        request = MagicMock(spec=Request)
        request.url.path = "/health"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200
        call_next.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_skips_docs_endpoint(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/docs"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_allows_request_under_limit(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=100)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.state.user_id = "user-1"
        request.client.host = "127.0.0.1"
        request.scope = {}
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_raises_429_when_over_limit(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=2)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.state.user_id = "user-2"
        request.client.host = "127.0.0.1"
        request.scope = {}
        call_next = AsyncMock(return_value=Response())
        await middleware.dispatch(request, call_next)
        await middleware.dispatch(request, call_next)
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 429
        assert "Rate limit exceeded" in result.body.decode()

    @pytest.mark.asyncio
    async def test_returns_retry_after_header(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=1)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.state.user_id = "user-retry"
        request.client.host = "127.0.0.1"
        request.scope = {}
        call_next = AsyncMock(return_value=Response())
        await middleware.dispatch(request, call_next)
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 429
        assert "Retry-After" in result.headers
        assert int(result.headers["Retry-After"]) > 0

    @pytest.mark.asyncio
    async def test_uses_client_host_when_no_user_id(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=1)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        del request.state.user_id
        request.client.host = "10.0.0.1"
        request.scope = {}
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_per_endpoint_decorator_override(self):
        @rate_limit(max_requests=1, window_seconds=30)
        async def fake_endpoint():
            return {"ok": True}

        config = _resolve_rate_limit(fake_endpoint)
        assert config == (1, 30)

    @pytest.mark.asyncio
    async def test_defaults_when_no_override(self):
        async def plain_endpoint():
            return {"ok": True}

        config = _resolve_rate_limit(plain_endpoint)
        assert config is None

    @pytest.mark.asyncio
    async def test_env_configurable_defaults(self, monkeypatch):
        monkeypatch.setenv("RATE_LIMIT_REQUESTS", "50")
        monkeypatch.setenv("RATE_LIMIT_WINDOW", "30")

        class FakeSettings:
            rate_limit_requests = 50
            rate_limit_window = 30

        monkeypatch.setattr("api.main.settings", FakeSettings())
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=50, window_seconds=30)
        assert middleware.default_max_requests == 50
        assert middleware.default_window_seconds == 30

    @pytest.mark.asyncio
    async def test_uses_route_endpoint_override(self):
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=100)

        @rate_limit(max_requests=3, window_seconds=10)
        async def special_endpoint():
            return {"ok": True}

        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/special"
        request.state.user_id = "user-special"
        request.client.host = "127.0.0.1"
        route = MagicMock()
        route.endpoint = special_endpoint
        request.scope = {"route": route}
        call_next = AsyncMock(return_value=Response())
        await middleware.dispatch(request, call_next)
        await middleware.dispatch(request, call_next)
        await middleware.dispatch(request, call_next)
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 429

    @pytest.mark.asyncio
    async def test_logs_violations(self, caplog):
        import logging
        caplog.set_level(logging.WARNING)
        app = MagicMock()
        middleware = RateLimitMiddleware(app, requests_per_minute=1)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/log-test"
        request.state.user_id = "user-log"
        request.client.host = "127.0.0.1"
        request.scope = {}
        call_next = AsyncMock(return_value=Response())
        await middleware.dispatch(request, call_next)
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 429
        assert any("Rate limit exceeded" in msg for msg in caplog.messages)
