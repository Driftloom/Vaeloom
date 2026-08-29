import sqlite3
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

# ── P1-37: pfi 7.1.0 crashes on FastAPI 0.141 _IncludedRouter (no .path) —
# every request 500s. Upstream fixed in pfi 8.0.1 (2026-06-22) but 8.x
# requires starlette>=1.0 which conflicts with pinned starlette==0.50.0 +
# FastAPI 0.141. The coordinated framework upgrade is intentionally
# deferred, so this monkey-patch is the accepted resolution (no request
# 500s; included routers are labeled "unknown").
try:
    import prometheus_fastapi_instrumentator.routing as _pfi_routing

    _orig_get_route_name = _pfi_routing.get_route_name

    def _patched_get_route_name(request):  # type: ignore[no-untyped-def]
        try:
            return _orig_get_route_name(request)
        except Exception:
            return "unknown"

    _pfi_routing.get_route_name = _patched_get_route_name  # type: ignore[attr-defined]
except Exception:
    pass  # prometheus not installed in some test envs

if "sqlite" in __import__("os").environ.get("DATABASE__URL", ""):
    import sqlalchemy.types as sa_types
    from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON

    class MockVector(sa_types.TypeDecorator):
        impl = sa_types.Text
        cache_ok = True
        def __init__(self, dim=None): super().__init__()

    import pgvector.sqlalchemy
    pgvector.sqlalchemy.Vector = MockVector

    class MockArray(sa_types.JSON):
        def __init__(self, item_type=None, *args, **kwargs): super().__init__(*args, **kwargs)

    class MockUUID(sa_types.TypeDecorator):
        impl = sa_types.String
        cache_ok = True
        def __init__(self, as_uuid=True, *args, **kwargs): super().__init__(*args, **kwargs)
        def process_bind_param(self, value, dialect):
            if value is None: return None
            return str(value) if isinstance(value, uuid.UUID) else str(value) if isinstance(value, str) else str(value)
        def process_result_value(self, value, dialect):
            if value is None: return None
            return value if isinstance(value, uuid.UUID) else uuid.UUID(value) if value else None

    import sqlalchemy.dialects.postgresql
    sqlalchemy.dialects.postgresql.JSONB = SQLiteJSON
    sqlalchemy.dialects.postgresql.ARRAY = MockArray
    sqlalchemy.dialects.postgresql.UUID = MockUUID

    sqlite3.register_adapter(uuid.UUID, lambda u: str(u))
    sqlite3.register_adapter(dict, lambda d: __import__("json").dumps(d))
    sqlite3.register_adapter(list, lambda l: __import__("json").dumps(l))

from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import settings, validate_settings
from .database import Base, engine
from .infrastructure.logging import (
    CorrelationIDMiddleware,
    RequestLoggingMiddleware,
    get_logger,
    setup_logging,
)

from .infrastructure.opentelemetry import instrumement_fastapi, setup_opentelemetry
from .middleware.api_version import APIVersionMiddleware
from .middleware.auth import AuthMiddleware
from .middleware.csrf import CSRFMiddleware, create_csrf_token
from .middleware.exception_handler import generic_exception_handler, unified_exception_handler
from .middleware.idempotency import IdempotencyMiddleware
from .middleware.ip_filter import IPAllowlistMiddleware
from .middleware.prompt_injection import PromptInjectionMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from .middleware.security_headers import SecurityHeadersMiddleware
from .middleware.tenant import TenantMiddleware
from .routers import (
    admin_console,
    agents,
    analytics,
    applications,
    audit,
    auth,
    billing,
    chat,
    connectors,
    documents,
    events,
    gmail,
    health,
    iam,
    integrations,
    knowledge_graph,
    memory,
    notifications,
    plugins,
    provider_keys,
    recommendations,
    resumes,
    scheduler,
    search,
    temporal as temporal_router,
    webhooks,
    workspaces,
)
from .routers import feature_flags
from .services.agent_costs import router as agent_costs_router
from .services.approval import router as approval_router
from .services.consent import router as consent_router
from .services.encryption import router as encryption_router
from .services.gdpr import router as gdpr_router
from .services.scim import router as scim_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_settings()
    setup_logging()
    setup_opentelemetry()
    logger.info("Starting Vaeloom Backend v%s (env=%s)", settings.service_version, settings.service_environment)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Run Alembic migrations (standard, replaces custom migration runner)
    try:
        import os

        from alembic.config import Config

        from alembic import command
        # Use absolute path to alembic.ini relative to this file
        # (main.py is at apps/api/src/api/main.py → 3 dirnames up = apps/api/)
        alembic_ini = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "alembic.ini")
        if not os.path.exists(alembic_ini):
            # Fallback: try relative to current working directory
            alembic_ini = "alembic.ini"
        alembic_cfg = Config(alembic_ini)
        command.upgrade(alembic_cfg, "head")
        logger.info("Alembic migrations applied successfully")
    except FileNotFoundError as e:
        logger.warning(f"Alembic config not found, using custom runner: {e}")
        await _run_custom_migrations()
    except Exception as e:
        logger.error(f"Alembic migration FAILED (not just skipped): {e}")
        # For real migration errors, still try custom runner but log loudly
        await _run_custom_migrations()
    logger.info("Database tables verified and migrations applied")
    # ── Start background daemon (cron + daily watchers) ──────────────
    try:
        from .infrastructure.background_daemon import start_background_daemon, stop_background_daemon
        start_background_daemon()
        logger.info("Background daemon started")
    except Exception as e:
        logger.warning(f"Background daemon failed to start (non-fatal): {e}")

    # ── Provider registry (ADR-037) — pluggable native providers ──
    try:
        from .integrations.registry import provider_registry

        count = provider_registry.discover_and_register()
        logger.info(f"Provider registry ready: {count} providers")
    except Exception as e:
        logger.warning(f"Provider registry failed (non-fatal): {e}")

    # ── MCP bridge warm-up (fire-and-forget, never blocks boot) ──────
    import asyncio as _asyncio

    def _spawn_mcp_warmup():
        async def _warm():
            try:
                from sqlalchemy import select as _select

                from .database import async_session_factory
                from .models.schema import Connector
                from .services.mcp_client_service import mcp_client_service
            except Exception as e:
                logger.warning("MCP warm-up imports failed (non-fatal): %s", e)
                return

            async with async_session_factory() as session:
                rows = await session.execute(_select(Connector).where(Connector.type == "mcp"))
                for c in rows.scalars():
                    try:
                        names = await mcp_client_service.bridge_connector_tools(c.id, None, session)
                        logger.info("MCP bridge ready: %s → %d tools", c.name, len(names))
                    except Exception as e:  # noqa: BLE001 - one bad server must not block others
                        logger.warning("MCP bridge skipped for %s: %s", c.name, e)

        return _asyncio.create_task(_warm())

    _mcp_task = None
    try:
        _mcp_task = _spawn_mcp_warmup()
    except Exception as e:
        logger.warning(f"MCP bridge warm-up failed to schedule (non-fatal): {e}")
    # ── Temporal client warm-up (fail-open when disabled) ──────────────
    try:
        from .temporal.client import get_temporal_client

        if getattr(settings, "temporal_enabled", False):
            import asyncio as _aio2

            _aio2.create_task(get_temporal_client())
    except Exception:
        pass
    yield
    # ── Stop background daemon ──────────────────────────────────────
    if _mcp_task:
        _mcp_task.cancel()
    try:
        from .infrastructure.background_daemon import stop_background_daemon
        stop_background_daemon()
    except Exception:
        pass
    await engine.dispose()
    logger.info("Backend shutdown complete")


async def _run_custom_migrations():
    """Fallback: run custom migration runner for backward compatibility."""
    try:
        from .migrations import run_migrations as custom_run_migrations
        await custom_run_migrations(engine)
        logger.info("Custom migrations applied successfully")
    except Exception as e2:
        logger.warning(f"Custom migration runner also failed: {e2}")


from .middleware.body_size_limit import BodySizeLimitMiddleware

app = FastAPI(
    title="Vaeloom Backend",
    version=settings.service_version,
    lifespan=lifespan,
)

app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window,
    api_key_rate_limit=settings.api_key_rate_limit,
)
# Guard against DoS via oversized request bodies (FIND-SEC-020).
app.add_middleware(
    BodySizeLimitMiddleware,
    max_bytes=getattr(settings, "max_request_body_bytes", 25 * 1024 * 1024),
)
# Tenant must be inner than Auth (added before Auth so Auth outer) → fixes RLS never-set bug (audit CRITICAL 2026-08-21)
app.add_middleware(TenantMiddleware)
app.add_middleware(AuthMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIDMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(APIVersionMiddleware)
app.add_middleware(PromptInjectionMiddleware)
app.add_middleware(IdempotencyMiddleware)

# IP allowlist always mounted (ADR-031) — no-op when empty, enforce when configured
app.add_middleware(IPAllowlistMiddleware, allowlist_raw=settings.ip_allowlist or "")
# CORS must be outermost (last added) so OPTIONS preflight is handled first
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Correlation-ID", "X-Requested-With", "X-Tenant-ID", "X-Workspace-ID", "X-CSRF-Token"],
)

app.add_exception_handler(StarletteHTTPException, unified_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


from .temporal.client import TemporalUnavailableError as _TemporalUnavailableError  # noqa: E402


@app.exception_handler(_TemporalUnavailableError)
async def _temporal_unavailable_handler(request, exc: _TemporalUnavailableError):  # type: ignore[unused-arg]
    # Fail-closed: durability was requested but Temporal is unreachable — refuse,
    # do not silently fall back to a non-durable run.
    return JSONResponse(
        status_code=503,
        content={"detail": "Temporal service unavailable — durable execution refused", "error": str(exc)},
    )

@app.get("/csrf-token", tags=["security"])
async def get_csrf_token():
    token, cookie_value = create_csrf_token()
    response = JSONResponse({"csrf_token": token})
    # httponly=False so SPA can read cookie for double-submit X-CSRF-Token header (fixes 2026-08-21 audit)
    # TODO: replace in-memory _token_store with Redis for multi-worker (see middleware/csrf.py:49)
    response.set_cookie(
        key="csrf_token",
        value=cookie_value,
        max_age=3600,
        secure=settings.service_environment != "local",
        httponly=False,
        samesite="lax",
    )
    return response


# ── Observability (re-enabled per ADR-011) ──────────────────────────
try:
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
except Exception as e:
    logger.warning("Prometheus Instrumentator failed to load: %s", e)

try:
    instrumement_fastapi(app)
except Exception as e:
    logger.warning("OTel FastAPI instrumentation failed to load: %s", e)


def _safe_include(router, prefix, tags):
    # FINDING-024: a single misbehaving router must not abort application boot.
    try:
        app.include_router(router, prefix=prefix, tags=tags)
    except Exception as exc:  # pragma: no cover - boot resilience
        logger.warning("Skipping router %s (%s) due to error: %s", tags, prefix, exc)


_safe_include(encryption_router, "/api/v1", ["security"])
_safe_include(health.router, "/health", ["health"])
_safe_include(auth.router, "/api/v1/auth", ["auth"])
_safe_include(workspaces.router, "/api/v1/workspaces", ["workspaces"])
_safe_include(memory.router, "/api/v1/memories", ["memory"])
_safe_include(agents.router, "/api/v1/agents", ["agents"])
_safe_include(events.router, "/api/v1/events", ["events"])
_safe_include(search.router, "/api/v1/search", ["search"])
_safe_include(integrations.router, "/api/v1/integrations", ["integrations"])
_safe_include(documents.router, "/api/v1/documents", ["documents"])
_safe_include(resumes.router, "/api/v1/resumes", ["resumes"])
_safe_include(applications.router, "/api/v1/workspaces/{workspace_id}/applications", ["applications"])
_safe_include(notifications.router, "/api/v1/notifications", ["notifications"])
_safe_include(connectors.router, "/api/v1/connectors", ["connectors"])
_safe_include(scheduler.router, "/api/v1/scheduler", ["scheduler"])
_safe_include(chat.router, "/api/v1/chat", ["chat"])
_safe_include(knowledge_graph.router, "/api/v1/knowledge-graph", ["knowledge-graph"])
_safe_include(gdpr_router, "/api/v1", ["gdpr"])
_safe_include(consent_router, "/api/v1", ["consent"])
_safe_include(approval_router, "/api/v1", ["approvals"])
_safe_include(agent_costs_router, "/api/v1", ["agents"])
_safe_include(gmail.router, "/api/v1", ["gmail"])
_safe_include(provider_keys.router, "/api/v1/provider-keys", ["provider-keys"])
_safe_include(temporal_router.router, "/api/v1/temporal", ["temporal"])

# ── Enterprise routes (CF-06 / R6) ──────────────────────────────────
# Out of MVP scope. Mounted only when explicitly enabled via
# `enterprise_routes_enabled=true` (default off in MVP builds).
if settings.enterprise_routes_enabled:
    _safe_include(billing.router, "/api/v1/billing", ["billing"])
    _safe_include(plugins.router, "/api/v1/plugins", ["plugins"])
    _safe_include(analytics.router, "/api/v1/analytics", ["analytics"])
    _safe_include(audit.router, "/api/v1/audit", ["audit"])
    _safe_include(iam.router, "/api/v1/iam", ["iam"])
    _safe_include(recommendations.router, "/api/v1/recommendations", ["recommendations"])
    _safe_include(webhooks.router, "/api/v1/webhooks", ["webhooks"])
    _safe_include(admin_console.router, "", ["admin"])
    _safe_include(scim_router, "/scim", ["scim"])
    _safe_include(feature_flags.router, "/api/v1/feature-flags", ["feature-flags"])
