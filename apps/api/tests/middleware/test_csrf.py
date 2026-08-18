import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import Request, HTTPException
from starlette.responses import Response

from api.middleware.csrf import CSRFMiddleware, CSRFTokenStore, create_csrf_token


class TestCSRFTokenStore:
    def setup_method(self):
        self.store = CSRFTokenStore()

    def test_generate_returns_string(self):
        token = self.store.generate()
        assert isinstance(token, str)
        assert len(token) > 16

    def test_validate_own_token(self):
        token = self.store.generate()
        assert self.store.validate(token) is True

    def test_validate_unknown_token(self):
        assert self.store.validate("fake-token") is False

    def test_validate_expired_token(self):
        store = CSRFTokenStore()
        store._ttl = -1
        token = store.generate()
        assert store.validate(token) is False


class TestCSRFMiddleware:
    @pytest.mark.asyncio
    async def test_skips_health_endpoint(self):
        app = MagicMock()
        middleware = CSRFMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/health"
        request.method = "POST"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_skips_get_requests(self):
        app = MagicMock()
        middleware = CSRFMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.method = "GET"
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_skips_xhr_requests(self):
        """XHR bypass was removed as security fix (FIND-CSRF-001). XHR now requires CSRF token."""
        app = MagicMock()
        middleware = CSRFMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.method = "POST"
        request.headers = {"X-Requested-With": "XMLHttpRequest"}
        request.cookies = {}
        call_next = AsyncMock(return_value=Response())
        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(request, call_next)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_api_key_requests_still_require_csrf(self):
        app = MagicMock()
        middleware = CSRFMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.method = "POST"
        request.headers = {"X-API-Key": "some-api-key"}
        request.cookies = {}
        call_next = AsyncMock(return_value=Response())
        with pytest.raises(HTTPException) as exc:
            await middleware.dispatch(request, call_next)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_raises_403_when_token_missing(self):
        app = MagicMock()
        middleware = CSRFMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.method = "POST"
        request.headers = {}
        request.cookies = {}
        call_next = AsyncMock(return_value=Response())
        with pytest.raises(HTTPException) as exc:
            await middleware.dispatch(request, call_next)
        assert exc.value.status_code == 403
        assert "CSRF token missing" in exc.value.detail

    @pytest.mark.asyncio
    async def test_passes_with_valid_token(self):
        token, cookie_value = create_csrf_token()
        app = MagicMock()
        middleware = CSRFMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.method = "POST"
        request.headers = {"X-CSRF-Token": token}
        request.cookies = {"csrf_token": cookie_value}
        call_next = AsyncMock(return_value=Response())
        result = await middleware.dispatch(request, call_next)
        assert result.status_code == 200

    @pytest.mark.asyncio
    async def test_raises_403_on_token_mismatch(self):
        token, cookie_value = create_csrf_token()
        app = MagicMock()
        middleware = CSRFMiddleware(app)
        request = MagicMock(spec=Request)
        request.url.path = "/api/v1/test"
        request.method = "POST"
        request.headers = {"X-CSRF-Token": "wrong-token"}
        request.cookies = {"csrf_token": cookie_value}
        call_next = AsyncMock(return_value=Response())
        with pytest.raises(HTTPException) as exc:
            await middleware.dispatch(request, call_next)
        assert exc.value.status_code == 403