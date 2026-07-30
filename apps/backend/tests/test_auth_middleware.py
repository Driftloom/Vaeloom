import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import Request
from starlette.responses import JSONResponse, Response

import jwt
from backend.middleware.auth import AuthMiddleware, PUBLIC_PATHS


def _make_token_request(token_value="Bearer test.token.here"):
    from unittest.mock import MagicMock
    from fastapi import Request
    request = MagicMock(spec=Request)
    request.url.path = "/api/v1/protected"
    request.headers.get.return_value = token_value
    return request


class TestAuthMiddleware:
    @pytest.mark.asyncio
    async def test_public_paths_pass_through(self):
        app = MagicMock()
        middleware = AuthMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/health"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200
        call_next.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_public_paths_set(self):
        assert "/health" in PUBLIC_PATHS
        assert "/docs" in PUBLIC_PATHS
        assert "/api/v1/auth/login" in PUBLIC_PATHS
        assert "/api/v1/auth/signup" in PUBLIC_PATHS

    @pytest.mark.asyncio
    async def test_missing_auth_header_returns_401(self):
        app = MagicMock()
        middleware = AuthMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.headers.get.return_value = ""
        result = await middleware.dispatch(request, AsyncMock())
        assert isinstance(result, JSONResponse)
        assert result.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_auth_header_returns_401(self):
        app = MagicMock()
        middleware = AuthMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.headers.get.return_value = "Basic token"
        result = await middleware.dispatch(request, AsyncMock())
        assert isinstance(result, JSONResponse)
        assert result.status_code == 401

    @pytest.mark.asyncio
    async def test_public_auth_path_does_not_check_header(self):
        app = MagicMock()
        middleware = AuthMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/auth/login"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_expired_token_returns_401(self):
        app = MagicMock()
        middleware = AuthMiddleware(app)
        request = _make_token_request()
        def raise_expired(*a, **kw):
            raise jwt.ExpiredSignatureError()
        with patch("backend.middleware.auth.jwt.decode", raise_expired):
            result = await middleware.dispatch(request, AsyncMock())
        assert result.status_code == 401
        assert "Token expired" in result.body.decode()

    @pytest.mark.asyncio
    async def test_invalid_token_returns_401(self):
        app = MagicMock()
        middleware = AuthMiddleware(app)
        request = _make_token_request()
        def raise_invalid(*a, **kw):
            raise jwt.InvalidTokenError()
        with patch("backend.middleware.auth.jwt.decode", raise_invalid):
            result = await middleware.dispatch(request, AsyncMock())
        assert result.status_code == 401
        assert "Invalid token" in result.body.decode()
