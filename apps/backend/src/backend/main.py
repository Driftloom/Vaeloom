import asyncio
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from .config import settings
from .database import engine, Base
from .logging import setup_logging, get_logger, correlation_id_var, tenant_id_var, user_id_var
from .middleware.auth import AuthMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from .middleware.exception_handler import unified_exception_handler, generic_exception_handler
from .routers import health, auth, workspaces, memory, agents, events, search, integrations, billing, documents, resumes, applications, plugins, chat, gateway, notifications, connectors, scheduler, analytics, audit, iam, knowledge_graph, recommendations
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Starting Vaeloom Backend v%s (env=%s)", settings.service_version, settings.service_environment)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified")
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
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuthMiddleware)
app.add_middleware(RateLimitMiddleware)

app.add_exception_handler(StarletteHTTPException, unified_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")

try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    FastAPIInstrumentor.instrument_app(app)
except Exception:
    pass


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    inbound_id = request.headers.get("x-request-id", "")
    request_id = inbound_id.strip() or str(uuid.uuid4())
    tenant_id = request.headers.get("x-tenant-id", "")
    user_id = request.headers.get("x-user-id", "")

    cid_token = correlation_id_var.set(request_id)
    tid_token = tenant_id_var.set(tenant_id)
    uid_token = user_id_var.set(user_id)

    try:
        logger.debug("→ %s %s", request.method, request.url.path)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.debug("<-- %s %s %d", request.method, request.url.path, response.status_code)
        return response
    except Exception:
        logger.exception("Unhandled exception in %s %s", request.method, request.url.path)
        raise
    finally:
        correlation_id_var.reset(cid_token)
        tenant_id_var.reset(tid_token)
        user_id_var.reset(uid_token)


app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(workspaces.router, prefix="/api/v1/workspaces", tags=["workspaces"])
app.include_router(memory.router, prefix="/api/v1/memories", tags=["memory"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(events.router, prefix="/api/v1/events", tags=["events"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["integrations"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(resumes.router, prefix="/api/v1/resumes", tags=["resumes"])
app.include_router(applications.router, prefix="/api/v1/workspaces/{workspace_id}/applications", tags=["applications"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(connectors.router, prefix="/api/v1/connectors", tags=["connectors"])
app.include_router(scheduler.router, prefix="/api/v1/scheduler", tags=["scheduler"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["audit"])
app.include_router(iam.router, prefix="/api/v1/iam", tags=["iam"])
app.include_router(plugins.router, prefix="/api/v1/plugins", tags=["plugins"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(gateway.router, tags=["gateway"])
app.include_router(knowledge_graph.router, prefix="/api/v1/knowledge-graph", tags=["knowledge-graph"])
app.include_router(recommendations.router, prefix="/api/v1/recommendations", tags=["recommendations"])
