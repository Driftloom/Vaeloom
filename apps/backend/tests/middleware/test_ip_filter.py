from unittest.mock import MagicMock, AsyncMock

import pytest
from fastapi import Request
from starlette.responses import Response

from backend.middleware.ip_filter import IPAllowlistMiddleware, _parse_allowlist, ALLOWLIST_BYPASS_PATHS

pytestmark = pytest.mark.asyncio


class TestParseAllowlist:
    def test_empty_string(self):
        assert _parse_allowlist("") == []

    def test_single_cidr(self):
        nets = _parse_allowlist("10.0.0.0/8")
        assert len(nets) == 1

    def test_multiple_cidrs(self):
        nets = _parse_allowlist("10.0.0.0/8,192.168.0.0/16")
        assert len(nets) == 2

    def test_invalid_cidr_skipped(self):
        nets = _parse_allowlist("not-a-cidr,10.0.0.0/8")
        assert len(nets) == 1

    def test_ipv6_cidr(self):
        nets = _parse_allowlist("::1/128")
        assert len(nets) == 1


class TestIPAllowlistMiddleware:
    @pytest.mark.asyncio
    async def test_bypasses_health_paths(self):
        app = MagicMock()
        middleware = IPAllowlistMiddleware(app, allowlist_raw="10.0.0.0/8")
        for path in ["/health", "/health/ready", "/metrics"]:
            request = MagicMock(spec=Request)
            request.url.path = path
            call_next = AsyncMock(return_value=Response())
            result = await middleware.dispatch(request, call_next)
            assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_bypasses_auth_paths(self):
        app = MagicMock()
        middleware = IPAllowlistMiddleware(app, allowlist_raw="10.0.0.0/8")
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/auth/signup"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_allows_allowlisted_ip(self):
        app = MagicMock()
        middleware = IPAllowlistMiddleware(app, allowlist_raw="10.0.0.0/8")
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.headers = {}
        request.client.host = "10.0.0.5"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_denies_non_allowlisted_ip(self):
        app = MagicMock()
        middleware = IPAllowlistMiddleware(app, allowlist_raw="10.0.0.0/8")
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.headers = {}
        request.client.host = "192.168.1.1"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 403
        assert result.headers.get("X-IP-Allowlist") == "denied"

    @pytest.mark.asyncio
    async def test_uses_x_forwarded_for(self):
        app = MagicMock()
        middleware = IPAllowlistMiddleware(app, allowlist_raw="10.0.0.0/8")
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.headers = {"X-Forwarded-For": "10.0.0.1, 192.168.1.1"}
        request.client.host = "192.168.1.1"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_allows_all_when_no_allowlist(self):
        app = MagicMock()
        middleware = IPAllowlistMiddleware(app, allowlist_raw="")
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.headers = {}
        request.client.host = "1.2.3.4"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_denies_with_header(self):
        app = MagicMock()
        middleware = IPAllowlistMiddleware(app, allowlist_raw="10.0.0.0/8")
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.headers = {}
        request.client.host = "203.0.113.5"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 403
        assert result.headers["X-IP-Allowlist"] == "denied"

    @pytest.mark.asyncio
    async def test_bypasses_sso_prefix(self):
        app = MagicMock()
        middleware = IPAllowlistMiddleware(app, allowlist_raw="10.0.0.0/8")
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/auth/sso/google/callback"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200
