import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

import uuid
import sqlite3

if "sqlite" in __import__("os").environ.get("DATABASE__URL", ""):
    import sqlalchemy.types as sa_types
    from sqlalchemy.dialects.sqlite import TEXT, JSON as SQLiteJSON

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

from .config import settings, validate_settings
from .database import engine, Base
from .infrastructure.logging import CorrelationIDMiddleware, RequestLoggingMiddleware, setup_logging, get_logger
from .infrastructure.metrics import MetricsMiddleware
from .infrastructure.opentelemetry import setup_opentelemetry, instrumement_fastapi
from .migrations import run_migrations
from .middleware.auth import AuthMiddleware
from .middleware.csrf import CSRFMiddleware, create_csrf_token
from .middleware.rate_limit import RateLimitMiddleware
from .middleware.security_headers import SecurityHeadersMiddleware
from .middleware.api_version import APIVersionMiddleware
from .middleware.prompt_injection import PromptInjectionMiddleware
from .middleware.idempotency import IdempotencyMiddleware
from .middleware.exception_handler import unified_exception_handler, generic_exception_handler
from .routers import health, auth, workspaces, memory, agents, events, search, integrations, billing, documents, resumes, applications, plugins, chat, notifications, connectors, scheduler, analytics, audit, iam, knowledge_graph, recommendations, webhooks, admin_console, gmail
from .services.encryption import router as encryption_router
from .services.gdpr import router as gdpr_router
from .services.consent import router as consent_router
from .services.approval import router as approval_router
from .services.agent_costs import router as agent_costs_router
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_settings()
    setup_logging()
    setup_opentelemetry()
    logger.info("Starting Vaeloom Backend v%s (env=%s)", settings.service_version, settings.service_environment)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await run_migrations(engine)
    logger.info("Database tables verified and migrations applied")
    yield
    await engine.dispose()
    logger.info("Backend shutdown complete")


app = FastAPI(
    title="Vaeloom Backend",
    version=settings.service_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Correlation-ID", "X-Requested-With"],
)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window,
    api_key_rate_limit=settings.api_key_rate_limit,
)
app.add_middleware(AuthMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIDMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(APIVersionMiddleware)
app.add_middleware(PromptInjectionMiddleware)
app.add_middleware(IdempotencyMiddleware)
app.add_middleware(MetricsMiddleware)

app.add_exception_handler(StarletteHTTPException, unified_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

@app.get("/csrf-token", tags=["security"])
async def get_csrf_token():
    from fastapi.responses import JSONResponse
    token, cookie_value = create_csrf_token()
    response = JSONResponse({"csrf_token": token})
    response.set_cookie(
        key="csrf_token",
        value=cookie_value,
        max_age=3600,
        secure=False,
        httponly=False,
        samesite="lax",
    )
    return response


# Instrumentator().instrument(app).expose(app, endpoint="/metrics")
# instrumement_fastapi(app)


app.include_router(encryption_router, prefix="/api/v1", tags=["security"])
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(workspaces.router, prefix="/api/v1/workspaces", tags=["workspaces"])
app.include_router(memory.router, prefix="/api/v1/memories", tags=["memory"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(events.router, prefix="/api/v1/events", tags=["events"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["integrations"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(resumes.router, prefix="/api/v1/resumes", tags=["resumes"])
app.include_router(applications.router, prefix="/api/v1/workspaces/{workspace_id}/applications", tags=["applications"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(connectors.router, prefix="/api/v1/connectors", tags=["connectors"])
app.include_router(scheduler.router, prefix="/api/v1/scheduler", tags=["scheduler"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(knowledge_graph.router, prefix="/api/v1/knowledge-graph", tags=["knowledge-graph"])
app.include_router(gdpr_router, prefix="/api/v1", tags=["gdpr"])
app.include_router(consent_router, prefix="/api/v1", tags=["consent"])
app.include_router(approval_router, prefix="/api/v1", tags=["approvals"])
app.include_router(agent_costs_router, prefix="/api/v1", tags=["agents"])
app.include_router(gmail.router, prefix="/api/v1", tags=["gmail"])

# ── Enterprise routes (CF-06 / R6) ──────────────────────────────────
# Out of MVP scope. Mounted only when explicitly enabled via
# `enterprise_routes_enabled=true` (default off in MVP builds).
if settings.enterprise_routes_enabled:
    app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
    app.include_router(plugins.router, prefix="/api/v1/plugins", tags=["plugins"])
    app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
    app.include_router(audit.router, prefix="/api/v1/audit", tags=["audit"])
    app.include_router(iam.router, prefix="/api/v1/iam", tags=["iam"])
    app.include_router(recommendations.router, prefix="/api/v1/recommendations", tags=["recommendations"])
    app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["webhooks"])
    app.include_router(admin_console.router, prefix="", tags=["admin"])
