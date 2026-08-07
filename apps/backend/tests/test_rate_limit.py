import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import Request
from starlette.responses import Response

from backend.middleware.rate_limit import RateLimitMiddleware


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
