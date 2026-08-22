import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from httpx import AsyncClient, ASGITransport

from api.config import settings
from api.logging import correlation_id_var, tenant_id_var, user_id_var
from api.middleware.auth import AuthMiddleware
from api.middleware.rate_limit import RateLimitMiddleware
from api.middleware.exception_handler import unified_exception_handler, generic_exception_handler
from starlette.exceptions import HTTPException as StarletteHTTPException

pytestmark = pytest.mark.asyncio

EXPECTED_ROUTER_PREFIXES = [
    "/health",
    "/api/v1/auth",
    "/api/v1/workspaces",
    "/api/v1/memories",
    "/api/v1/agents",
    "/api/v1/events",
    "/api/v1/search",
    "/api/v1/integrations",
    "/api/v1/documents",
    "/api/v1/resumes",
    "/api/v1/workspaces/{workspace_id}/applications",
    "/api/v1/notifications",
    "/api/v1/connectors",
    "/api/v1/scheduler",
    "/api/v1/chat",
    "/api/v1/knowledge-graph",
]

ENTERPRISE_ROUTER_PREFIXES = [
    "/api/v1/billing",
    "/api/v1/plugins",
    "/api/v1/analytics",
    "/api/v1/audit",
    "/api/v1/iam",
    "/api/v1/recommendations",
    "/api/v1/webhooks",
]


@pytest.fixture(autouse=True)
def _patch_prometheus():
    with patch("prometheus_fastapi_instrumentator.Instrumentator") as m:
        m.return_value.instrument.return_value.expose.return_value = None
        yield
    sys.modules.pop("api.main", None)


@pytest.fixture(autouse=True)
def _reset_enterprise_routes():
    """Restore MVP default (enterprise routes off) after each test."""
    settings.enterprise_routes_enabled = False
    yield
    settings.enterprise_routes_enabled = False


def _reimport_main():
    for key in list(sys.modules):
        if key == "api.main":
            del sys.modules[key]
    import api.main as m
    return m


def _auth_headers(**extra):
    token = jwt.encode(
        {
            "sub": "test-user",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    h = {"Authorization": f"Bearer {token}"}
    h.update(extra)
    return h


class TestAppCreation:
    def test_app_is_fastapi_instance(self):
        mod = _reimport_main()
        assert isinstance(mod.app, FastAPI)

    def test_app_title(self):
        mod = _reimport_main()
        assert mod.app.title == "Vaeloom Backend"

    def test_app_version(self):
        mod = _reimport_main()
        assert mod.app.version == settings.service_version


class TestMiddlewareRegistration:
    def test_cors_middleware_registered(self):
        mod = _reimport_main()
        types = [mw.cls for mw in mod.app.user_middleware]
        assert CORSMiddleware in types

    def test_auth_middleware_registered(self):
        mod = _reimport_main()
        types = [mw.cls for mw in mod.app.user_middleware]
        assert AuthMiddleware in types

    def test_rate_limit_middleware_registered(self):
        mod = _reimport_main()
        types = [mw.cls for mw in mod.app.user_middleware]
        assert RateLimitMiddleware in types

    def test_exception_handlers_registered(self):
        mod = _reimport_main()
        assert mod.app.exception_handlers[StarletteHTTPException] is unified_exception_handler
        assert mod.app.exception_handlers[Exception] is generic_exception_handler


class TestRouterRegistration:
    @staticmethod
    def _route_paths(mod) -> set:
        # Newer FastAPI wraps includes in lazy _IncludedRouter objects whose
        # .path is unavailable — OpenAPI generation materializes all routes.
        return set(mod.app.openapi()["paths"].keys())

    def test_all_routers_included(self):
        mod = _reimport_main()
        route_paths = self._route_paths(mod)
        for prefix in EXPECTED_ROUTER_PREFIXES:
            assert any(p.startswith(prefix) for p in route_paths), f"Missing prefix: {prefix}"
        # Enterprise routes (CF-06 / R6) are gated behind the MVP flag.
        should_present = settings.enterprise_routes_enabled
        for prefix in ENTERPRISE_ROUTER_PREFIXES:
            present = any(p.startswith(prefix) for p in route_paths)
            assert present is should_present, (
                f"Prefix {prefix}: present={present}, expected={should_present}"
            )

    def test_router_count(self):
        mod = _reimport_main()
        prefixes_found = set()
        for path in self._route_paths(mod):
            for prefix in EXPECTED_ROUTER_PREFIXES:
                if path.startswith(prefix):
                    prefixes_found.add(prefix)
        assert len(prefixes_found) == len(EXPECTED_ROUTER_PREFIXES)

    def test_enterprise_routes_enabled_adds_prefixes(self):
        settings.enterprise_routes_enabled = True
        mod = _reimport_main()
        route_paths = self._route_paths(mod)
        for prefix in ENTERPRISE_ROUTER_PREFIXES:
            assert any(p.startswith(prefix) for p in route_paths), f"Missing prefix: {prefix}"

    def test_enterprise_routes_gated_in_mvp_default(self):
        settings.enterprise_routes_enabled = False
        mod = _reimport_main()
        route_paths = self._route_paths(mod)
        for prefix in ENTERPRISE_ROUTER_PREFIXES:
            assert not any(p.startswith(prefix) for p in route_paths), f"Leaked prefix: {prefix}"


class TestRequestContextMiddleware:
    async def test_sets_context_vars_from_headers(self):
        mod = _reimport_main()
        from fastapi import Request as FReq

        async def _check_ctx(_r: FReq):
            return {
                "cid": correlation_id_var.get(),
                "tid": tenant_id_var.get(),
                "uid": user_id_var.get(),
            }

        mod.app.add_api_route("/_ctx_check", _check_ctx, methods=["GET"])
        transport = ASGITransport(app=mod.app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/_ctx_check", headers=_auth_headers(**{
                "x-request-id": "req-abc",
                "x-tenant-id": "tenant-xyz",
                "x-user-id": "user-123",
            }))
        assert resp.status_code == 200
        body = resp.json()
        assert body["cid"] == "req-abc"
        assert body["tid"] == "tenant-xyz"
        assert body["uid"] == "user-123"

    async def test_sets_x_request_id_response_header(self):
        mod = _reimport_main()
        transport = ASGITransport(app=mod.app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/health", headers=_auth_headers(**{"x-request-id": "rid-42"}))
        assert resp.headers.get("x-request-id") == "rid-42"

    async def test_generates_request_id_if_not_provided(self):
        mod = _reimport_main()
        transport = ASGITransport(app=mod.app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/health", headers=_auth_headers())
        rid = resp.headers.get("x-request-id", "")
        assert len(rid) > 0 and rid != ""

    async def test_resets_context_vars_in_finally(self):
        mod = _reimport_main()
        original = correlation_id_var.set("pre-request-value")
        transport = ASGITransport(app=mod.app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            await ac.get("/health", headers=_auth_headers())
        assert correlation_id_var.get() == "pre-request-value", "contextvar was restored after request"

    async def test_handles_exception_in_handler(self):
        mod = _reimport_main()
        from fastapi import Request as FReq

        async def _raise_exc(_r: FReq):
            raise RuntimeError("Middleware test error")

        mod.app.add_api_route("/_ctx_err", _raise_exc, methods=["GET"])
        transport = ASGITransport(app=mod.app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/_ctx_err", headers=_auth_headers())
        assert resp.status_code == 500


class TestLifespan:
    def _make_mock_engine(self):
        mock_conn = AsyncMock()
        mock_engine = MagicMock()
        mock_engine.begin.return_value.__aenter__.return_value = mock_conn
        mock_engine.begin.return_value.__aexit__.return_value = None
        mock_engine.dispose = AsyncMock()
        return mock_engine, mock_conn

    async def test_lifespan_creates_tables_and_disposes(self):
        mod = _reimport_main()
        mock_engine, mock_conn = self._make_mock_engine()

        with patch.object(mod, "engine", mock_engine), \
             patch.object(mod, "Base") as mock_base, \
             patch.object(mod, "validate_settings"), \
             patch("alembic.command.upgrade") as mock_upgrade:
            async with mod.lifespan(mod.app):
                pass
        mock_conn.run_sync.assert_awaited_once_with(mock_base.metadata.create_all)
        mock_upgrade.assert_called_once()
        mock_engine.dispose.assert_awaited_once()

    async def test_lifespan_startup_logs(self):
        mod = _reimport_main()
        mock_engine, mock_conn = self._make_mock_engine()

        with patch.object(mod, "engine", mock_engine), \
             patch.object(mod, "Base"), \
             patch.object(mod, "validate_settings"), \
             patch("alembic.command.upgrade"):
            async with mod.lifespan(mod.app):
                pass


class TestOpenTelemetry:
    def test_handles_import_error_gracefully(self):
        for key in list(sys.modules):
            if key == "api.main":
                del sys.modules[key]

        import builtins
        real_import = builtins.__import__

        def _mock_import(name, *args, **kwargs):
            if name.startswith("opentelemetry"):
                raise ImportError("Simulated failure")
            return real_import(name, *args, **kwargs)

        with patch("prometheus_fastapi_instrumentator.Instrumentator") as mp:
            mp.return_value.instrument.return_value.expose.return_value = None
            with patch("builtins.__import__", side_effect=_mock_import):
                import api.main as mod2
            assert isinstance(mod2.app, FastAPI)

    def test_instrumentation_succeeds_when_available(self):
        mod = _reimport_main()
        assert isinstance(mod.app, FastAPI)
