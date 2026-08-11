import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import sqlalchemy.types as sa_types
from sqlalchemy.dialects.sqlite import TEXT, JSON


class MockVector(sa_types.TypeDecorator):
    impl = sa_types.Text
    cache_ok = True

    def __init__(self, dim=None):
        super().__init__()


import pgvector.sqlalchemy
pgvector.sqlalchemy.Vector = MockVector

class MockArray(sa_types.JSON):
    def __init__(self, item_type=None, *args, **kwargs):
        super().__init__(*args, **kwargs)

import uuid


class MockUUID(sa_types.TypeDecorator):
    impl = sa_types.String
    cache_ok = True
    def __init__(self, as_uuid=True, *args, **kwargs):
        super().__init__(*args, **kwargs)
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return str(value)
        if isinstance(value, str):
            return value
        return str(value)
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value) if value else None

import sqlalchemy.dialects.postgresql
sqlalchemy.dialects.postgresql.JSONB = JSON
sqlalchemy.dialects.postgresql.ARRAY = MockArray
sqlalchemy.dialects.postgresql.UUID = MockUUID

import re
import uuid
import sqlite3

sqlite3.register_adapter(uuid.UUID, lambda u: str(u))
sqlite3.register_adapter(dict, lambda d: __import__("json").dumps(d))
sqlite3.register_adapter(list, lambda l: __import__("json").dumps(l))

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from httpx import AsyncClient, ASGITransport
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest, REGISTRY
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from backend.config import settings
from sqlalchemy.pool import NullPool
from starlette.exceptions import HTTPException as StarletteHTTPException

import backend.models  # noqa: F401 — register ORM models before create_all runs
from backend.database import Base, get_db
from backend.middleware.auth import AuthMiddleware
from backend.middleware.exception_handler import unified_exception_handler, generic_exception_handler


def _build_test_app(db_session):
    """Create a fresh FastAPI instance per test — no shared mutable state."""
    import backend.infrastructure.metrics  # noqa: F401 — register Prometheus metrics
    from backend.routers import (
        health, auth, workspaces, memory, agents, events, search,
        integrations, billing, documents, resumes, applications,
        plugins, chat, notifications, connectors, scheduler,
        analytics, audit, iam, knowledge_graph, recommendations,
        webhooks,
    )
    from backend.services.gdpr import router as gdpr_router
    from backend.services.consent import router as consent_router
    from backend.services.approval import router as approval_router
    from backend.routers import admin_console

    test_app = FastAPI()

    test_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    test_app.add_middleware(AuthMiddleware)
    test_app.add_exception_handler(StarletteHTTPException, unified_exception_handler)
    test_app.add_exception_handler(Exception, generic_exception_handler)

    from backend.infrastructure.metrics import MetricsMiddleware
    test_app.add_middleware(MetricsMiddleware)

    from sqlalchemy.ext.asyncio import async_sessionmaker
    from backend.middleware.idempotency import IdempotencyMiddleware
    test_app.add_middleware(
        IdempotencyMiddleware,
        session_factory=async_sessionmaker(db_session.bind, expire_on_commit=False),
    )

    test_app.include_router(health.router, prefix="/health")
    test_app.include_router(auth.router, prefix="/api/v1/auth")
    test_app.include_router(workspaces.router, prefix="/api/v1/workspaces")
    test_app.include_router(memory.router, prefix="/api/v1/memories")
    test_app.include_router(agents.router, prefix="/api/v1/agents")
    test_app.include_router(events.router, prefix="/api/v1/events")
    test_app.include_router(search.router, prefix="/api/v1/search")
    test_app.include_router(integrations.router, prefix="/api/v1/integrations")
    test_app.include_router(billing.router, prefix="/api/v1/billing")
    test_app.include_router(documents.router, prefix="/api/v1/documents")
    test_app.include_router(resumes.router, prefix="/api/v1/resumes")
    test_app.include_router(applications.router, prefix="/api/v1/workspaces/{workspace_id}/applications")
    test_app.include_router(notifications.router, prefix="/api/v1/notifications")
    test_app.include_router(connectors.router, prefix="/api/v1/connectors")
    test_app.include_router(scheduler.router, prefix="/api/v1/scheduler")
    test_app.include_router(analytics.router, prefix="/api/v1/analytics")
    test_app.include_router(audit.router, prefix="/api/v1/audit")
    test_app.include_router(iam.router, prefix="/api/v1/iam")
    test_app.include_router(plugins.router, prefix="/api/v1/plugins")
    test_app.include_router(chat.router, prefix="/api/v1/chat")
    test_app.include_router(knowledge_graph.router, prefix="/api/v1/knowledge-graph")
    test_app.include_router(recommendations.router, prefix="/api/v1/recommendations")
    test_app.include_router(webhooks.router, prefix="/api/v1/webhooks")
    test_app.include_router(gdpr_router, prefix="/api/v1")
    test_app.include_router(consent_router, prefix="/api/v1")
    test_app.include_router(approval_router, prefix="/api/v1")
    test_app.include_router(admin_console.router, prefix="")

    @test_app.get("/metrics")
    async def metrics():
        return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)

    async def override_get_db():
        yield db_session
        try:
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise
    test_app.dependency_overrides[get_db] = override_get_db

    return test_app


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test.db")


@pytest_asyncio.fixture
async def db_session(db_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", poolclass=NullPool)

    @event.listens_for(engine.sync_engine, "connect")
    def _register_sqlite_functions(dbapi_connection, _connection_record):
        dbapi_connection.create_function("cosine_distance", 2, lambda a, b: 0.0)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        raw_sql_queries = [
            "CREATE TABLE IF NOT EXISTS scheduled_jobs (id TEXT PRIMARY KEY, name TEXT, type TEXT, cron TEXT, method TEXT, url TEXT, event TEXT, payload TEXT, headers TEXT, status TEXT, tenant_id TEXT, last_run_at TIMESTAMP, next_run_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS notification_templates (id TEXT PRIMARY KEY, name TEXT, subject TEXT, body TEXT, channel TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS notification_subscribers (id TEXT PRIMARY KEY, url TEXT, tenant_id TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT, resource TEXT, resource_id TEXT, tenant_id TEXT, metadata TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY, name TEXT, properties TEXT, tenant_id TEXT, user_id TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS job_executions (id TEXT PRIMARY KEY, job_id TEXT, status TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS knowledge_nodes (id TEXT PRIMARY KEY, label TEXT NOT NULL, type TEXT NOT NULL, description TEXT, importance REAL DEFAULT 0.5, properties TEXT DEFAULT '{}', embedding TEXT, tenant_id TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS knowledge_edges (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE, relationship TEXT NOT NULL, weight REAL DEFAULT 1.0, properties TEXT DEFAULT '{}', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS iam_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, tenant_id TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP, updated_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS iam_user_roles (user_id TEXT NOT NULL REFERENCES iam_users(id) ON DELETE CASCADE, role_id TEXT NOT NULL, PRIMARY KEY (user_id, role_id))",
            "CREATE TABLE IF NOT EXISTS rbac_roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, permissions TEXT DEFAULT '[]')",
            "DROP TABLE IF EXISTS usage_records",
            "CREATE TABLE IF NOT EXISTS usage_records (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, metric TEXT, value REAL, timestamp TIMESTAMP, recorded_at TEXT, memories_created INTEGER DEFAULT 0, agents_run INTEGER DEFAULT 0, tokens_used INTEGER DEFAULT 0)",
            "CREATE TABLE IF NOT EXISTS consent_records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tenant_id TEXT, scope TEXT NOT NULL, granted_at TIMESTAMP, revoked_at TIMESTAMP, ip_address TEXT)",
        ]
        for q in raw_sql_queries:
            await conn.execute(text(q))

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    test_app = _build_test_app(db_session)
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(autouse=True)
async def mock_llm(monkeypatch):
    """Return fake LLM responses — no real API calls."""
    from backend.services.llm_service import LLMService

    # Deterministic env: agents must see no LLM key unless a test sets one
    monkeypatch.setattr(settings, "llm_api_key", "")
    # MVP scope lock is off by default for existing suites; the dedicated
    # test_mvp_scope.py module re-enables it and verifies the gate.
    monkeypatch.setattr(settings, "mvp_scope_enforced", False)

    fake_embedding = [0.1] * 1536

    async def fake_generate_embedding(self, text: str) -> list[float]:
        return fake_embedding

    async def fake_generate_completion(
        self, messages: list[dict], model: str | None = None,
        temperature: float = 0.7, max_tokens: int = 4096,
    ) -> dict:
        return {"content": "Mock reply from test LLM", "role": "assistant"}

    monkeypatch.setattr(LLMService, "generate_embedding", fake_generate_embedding)
    monkeypatch.setattr(LLMService, "generate_completion", fake_generate_completion)


@pytest_asyncio.fixture(autouse=True)
async def mock_connector_test(monkeypatch):
    """Mock connector test_connection — no real HTTP calls."""
    from backend.services.connector_ext_service import ConnectorExtService

    async def fake_test_connection(self, connector_id, tenant_id=None, db=None):
        return {"status": "ok", "code": 200}

    monkeypatch.setattr(ConnectorExtService, "test_connection", fake_test_connection)
