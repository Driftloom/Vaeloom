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
from .routers import health, memory, agents, embeddings
from .workers.queue_worker import BullMQWorker, handle_event_publish, handle_subscription_create

logger = get_logger(__name__)


_queue_worker: BullMQWorker | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _queue_worker
    setup_logging()
    logger.info("Starting Vaeloom AI Service v%s (env=%s)", settings.service_version, settings.service_environment)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified")

    _queue_worker = BullMQWorker(queue_name="events")
    _queue_worker.register("event.publish", handle_event_publish)
    _queue_worker.register("subscription.create", handle_subscription_create)
    worker_task = asyncio.create_task(_queue_worker.start())
    logger.info("Queue worker started")

    yield

    await _queue_worker.stop()
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()
    logger.info("AI Service shutdown complete")


app = FastAPI(
    title="Vaeloom AI Service",
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

# Prometheus metrics endpoint. Exposed at /metrics (no api/v1 prefix) so
# Prometheus can scrape it directly.
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


# OpenTelemetry tracing setup (OTLP exporter). Collector endpoint comes from the
# OTEL_EXPORTER_OTLP_ENDPOINT env var, defaulting to http://localhost:4318.
# Auto-instrumentation for FastAPI/HTTP is applied via the distro in deps.
try:  # pragma: no cover - optional dependency
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    FastAPIInstrumentor.instrument_app(app)
except Exception:  # pragma: no cover
    pass


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """
    Establishes per-request context: correlation ID, tenant, and user.
    Mirrors the NestJS RequestContextMiddleware so logs from both services
    share the same trace_id for a given user request.
    """
    # Reuse upstream x-request-id (from NestJS api or gateway), else mint one
    inbound_id = request.headers.get("x-request-id", "")
    request_id = inbound_id.strip() or str(uuid.uuid4())

    # Tenant and user from headers (set by internal RPC from api service)
    tenant_id = request.headers.get("x-tenant-id", "")
    user_id = request.headers.get("x-user-id", "")

    # Set context vars for the duration of this request
    cid_token = correlation_id_var.set(request_id)
    tid_token = tenant_id_var.set(tenant_id)
    uid_token = user_id_var.set(user_id)

    try:
        logger.debug("→ %s %s", request.method, request.url.path)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.debug("← %s %s %d", request.method, request.url.path, response.status_code)
        return response
    except Exception:
        logger.exception("Unhandled exception in %s %s", request.method, request.url.path)
        raise
    finally:
        correlation_id_var.reset(cid_token)
        tenant_id_var.reset(tid_token)
        user_id_var.reset(uid_token)


app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(memory.router, prefix="/api/v1/memory", tags=["memory"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(embeddings.router, prefix="/api/v1/embeddings", tags=["embeddings"])
