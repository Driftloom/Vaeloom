"""Enterprise rate limiting (Loop 3): shared Redis enforced non-local,
fail-open with telemetry when the store is down."""
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import Request
from starlette.responses import Response

from api.middleware.rate_limit import MemoryBackend, RateLimitMiddleware, RedisBackend

pytestmark = pytest.mark.asyncio


class TestRedisWiring:
    def test_redis_backend_selected_when_url_given(self):
        mw = RateLimitMiddleware(MagicMock(), redis_url="redis://localhost:6379/1")
        assert isinstance(mw.backend, RedisBackend)

    def test_memory_backend_without_url(self):
        mw = RateLimitMiddleware(MagicMock())
        assert isinstance(mw.backend, MemoryBackend)


class TestFailOpen:
    def _req(self):
        request = MagicMock()
        request.url.path = "/api/v1/memories"
        request.method = "GET"
        request.headers = {}
        request.client.host = "9.9.9.9"
        request.state.user_id = None
        request.app.routes = []
        request.scope = {}
        return request

    async def test_dead_store_passes_request(self):
        mw = RateLimitMiddleware(MagicMock(), requests_per_minute=1)

        class _DeadBackend:
            async def check_and_record(self, *a, **k):
                raise ConnectionError("redis down")

        mw.backend = _DeadBackend()
        call_next = AsyncMock(return_value=Response())
        result = await mw.dispatch(self._req(), call_next)
        assert result.status_code == 200
        call_next.assert_awaited_once()

    async def test_dead_store_increments_metric(self):
        from api.infrastructure import metrics as metrics_mod

        mw = RateLimitMiddleware(MagicMock(), requests_per_minute=1)

        class _DeadBackend:
            async def check_and_record(self, *a, **k):
                raise ConnectionError("redis down")

        mw.backend = _DeadBackend()
        before = metrics_mod.rate_limit_degraded_total._value.get()
        await mw.dispatch(self._req(), AsyncMock(return_value=Response()))
        assert metrics_mod.rate_limit_degraded_total._value.get() == before + 1


class TestRedisRequiredNonLocal:
    def test_nonlocal_without_redis_url_refuses(self, monkeypatch):
        import api.config as config_mod

        monkeypatch.setattr(config_mod.settings, "service_environment", "staging")
        monkeypatch.setattr(config_mod.settings, "rate_limit_redis_url", "")
        monkeypatch.setattr(config_mod.settings, "jwt_secret", "x" * 40)
        monkeypatch.setattr(config_mod.settings, "encryption_key", "y" * 40)
        monkeypatch.setattr(config_mod.settings, "database__url", "sqlite+aiosqlite:///./t.db")
        with pytest.raises(RuntimeError, match="RATE_LIMIT_REDIS_URL"):
            config_mod.validate_settings()

    def test_local_without_redis_url_warns_only(self, monkeypatch):
        import api.config as config_mod

        monkeypatch.setattr(config_mod.settings, "service_environment", "local")
        monkeypatch.setattr(config_mod.settings, "rate_limit_redis_url", "")
        monkeypatch.setattr(config_mod.settings, "jwt_secret", "x" * 40)
        monkeypatch.setattr(config_mod.settings, "encryption_key", "y" * 40)
        monkeypatch.setattr(config_mod.settings, "database__url", "sqlite+aiosqlite:///./t.db")
        out = config_mod.validate_settings()
        assert any("RATE_LIMIT_REDIS_URL" in w for w in out["warnings"])
