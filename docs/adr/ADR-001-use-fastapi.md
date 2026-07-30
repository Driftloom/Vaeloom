# ADR-001: Use FastAPI for Backend API

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

The Vaeloom backend requires a Python web framework that supports async I/O, automatic OpenAPI documentation generation, Pydantic-based validation, and high throughput for AI agent orchestration with streaming responses. The framework must integrate well with SQLAlchemy async, Redis, and OpenTelemetry.

Options considered: FastAPI, Django REST Framework, Flask, Starlette.

## Decision

Use **FastAPI** as the backend API framework.

FastAPI provides:
- Native async support via `asyncio` — critical for concurrent agent execution and SSE streaming
- Automatic OpenAPI/Swagger generation from Pydantic models — eliminates manual spec maintenance
- Built-in dependency injection — enables clean separation of auth, DB session, and tenant context
- Starlette middleware support — allows straightforward integration of CORS, rate limiting, security headers, and OpenTelemetry
- First-class WebSocket support — available for future real-time agent communication
- Largest async Python ecosystem with active maintenance

## Consequences

**Positive:**
- All 21 API routers auto-generate OpenAPI schemas with zero manual spec work
- Dependency injection pattern enables clean `get_db`, `get_current_user`, `get_tenant_id` without decorators
- Middleware stack (auth, rate-limit, security-headers, correlation-id, metrics, logging) layers cleanly via `app.add_middleware`
- Streaming responses for agent execution (SSE) work natively with `StreamingResponse`
- Prometheus metrics instrumentation via `prometheus-fastapi-instrumentator` works out of the box

**Negative:**
- Smaller ecosystem than Django for batteries-included features (admin panel, ORM migrations out of the box — we use Alembic separately)
- ASGI deployment requires uvicorn/gunicorn config rather than mod_wsgi
- Team must learn FastAPI-specific patterns (lifespan, dependencies, background tasks)
