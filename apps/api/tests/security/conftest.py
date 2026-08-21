import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

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
        if value is None: return None
        if isinstance(value, uuid.UUID): return str(value)
        if isinstance(value, str): return value
        return str(value)
    def process_result_value(self, value, dialect):
        if value is None: return None
        if isinstance(value, uuid.UUID): return value
        return uuid.UUID(value) if value else None

import sqlalchemy.dialects.postgresql
sqlalchemy.dialects.postgresql.JSONB = JSON
sqlalchemy.dialects.postgresql.ARRAY = MockArray
sqlalchemy.dialects.postgresql.UUID = MockUUID

import sqlite3
sqlite3.register_adapter(uuid.UUID, lambda u: str(u))
sqlite3.register_adapter(dict, lambda d: __import__("json").dumps(d))
sqlite3.register_adapter(list, lambda l: __import__("json").dumps(l))

import jwt
import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from httpx import AsyncClient, ASGITransport
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from starlette.exceptions import HTTPException as StarletteHTTPException

import api.models
from api.config import Settings
from api.database import Base, get_db
from api.middleware.auth import AuthMiddleware
from api.middleware.exception_handler import unified_exception_handler, generic_exception_handler
from api.middleware.prompt_injection import PromptInjectionMiddleware
from api.middleware.rate_limit import RateLimitMiddleware


def _build_test_app(db_session, enable_rate_limit=False):
    import api.infrastructure.metrics
    from api.routers import (
        health, auth, workspaces, memory, agents, events, search,
        integrations, billing, documents, resumes, applications,
        plugins, chat, notifications, connectors, scheduler,
        analytics, audit, iam, knowledge_graph, recommendations,
    )
    from api.services.consent import router as consent_router
    from api.services.gdpr import router as gdpr_router
    from api.middleware.csrf import CSRFMiddleware, create_csrf_token

    test_app = FastAPI()

    test_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    test_app.add_exception_handler(StarletteHTTPException, unified_exception_handler)
    test_app.add_exception_handler(Exception, generic_exception_handler)

    from api.infrastructure.metrics import MetricsMiddleware
    test_app.add_middleware(MetricsMiddleware)

    if enable_rate_limit:
        test_app.add_middleware(RateLimitMiddleware, requests_per_minute=5, window_seconds=60)

    test_app.add_middleware(PromptInjectionMiddleware)
    test_app.add_middleware(AuthMiddleware)

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
    test_app.include_router(consent_router, prefix="/api/v1")
    test_app.include_router(gdpr_router, prefix="/api/v1")

    async def override_get_db():
        yield db_session
    test_app.dependency_overrides[get_db] = override_get_db

    return test_app


def _build_csrf_test_app(db_session):
    from api.services.consent import router as consent_router
    from api.services.gdpr import router as gdpr_router
    from api.middleware.csrf import CSRFMiddleware, create_csrf_token
    from api.routers import (
        health, auth, workspaces, memory, agents, events, search,
        integrations, billing, documents, resumes, applications,
        plugins, chat, notifications, connectors, scheduler,
        analytics, audit, iam, knowledge_graph, recommendations,
    )

    test_app = FastAPI()
    test_app.add_middleware(CSRFMiddleware)
    test_app.add_middleware(AuthMiddleware)

    test_app.include_router(health.router, prefix="/health")
    test_app.include_router(auth.router, prefix="/api/v1/auth")
    test_app.include_router(workspaces.router, prefix="/api/v1/workspaces")
    test_app.include_router(memory.router, prefix="/api/v1/memories")
    test_app.include_router(agents.router, prefix="/api/v1/agents")
    test_app.include_router(events.router, prefix="/api/v1/events")
    test_app.include_router(search.router, prefix="/api/v1/search")
    test_app.include_router(consent_router, prefix="/api/v1")
    test_app.include_router(gdpr_router, prefix="/api/v1")

    @test_app.get("/csrf-token", tags=["security"])
    async def csrf_token_endpoint():
        token, cookie_value = create_csrf_token()
        from starlette.responses import JSONResponse
        resp = JSONResponse({"csrf_token": token})
        resp.set_cookie("csrf_token", cookie_value, httponly=False, samesite="lax")
        return resp

    async def override_get_db():
        yield db_session
    test_app.dependency_overrides[get_db] = override_get_db

    return test_app


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "security_test.db")


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
            "CREATE TABLE IF NOT EXISTS iam_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, tenant_id TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP, updated_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS iam_user_roles (user_id TEXT NOT NULL, role_id TEXT NOT NULL, PRIMARY KEY (user_id, role_id))",
            "CREATE TABLE IF NOT EXISTS rbac_roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, permissions TEXT DEFAULT '[]')",
            "CREATE TABLE IF NOT EXISTS consent_records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tenant_id TEXT, scope TEXT NOT NULL, granted_at TIMESTAMP, revoked_at TIMESTAMP, ip_address TEXT)",
            "DROP TABLE IF EXISTS usage_records",
            "CREATE TABLE IF NOT EXISTS usage_records (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, metric TEXT, value REAL, timestamp TIMESTAMP, recorded_at TEXT, memories_created INTEGER DEFAULT 0, agents_run INTEGER DEFAULT 0, tokens_used INTEGER DEFAULT 0)",
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


@pytest_asyncio.fixture
async def rate_limited_client(db_session):
    test_app = _build_test_app(db_session, enable_rate_limit=True)
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def csrf_client(db_session):
    test_app = _build_csrf_test_app(db_session)
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def csrf_auth_headers(csrf_client: AsyncClient) -> dict:
    res = await csrf_client.post(
        "/api/v1/auth/signup",
        json={"email": "csrf-test@vaeloom.test", "password": "CsrfTest1234!"},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict:
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": "sec-test@vaeloom.test", "password": "SecTest1234!"},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
def sql_injection_payloads():
    return [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users; --",
        "1; SELECT * FROM admin_users",
        "' OR 1=1 --",
        "admin'--",
        "1' ORDER BY 1--",
        "' UNION ALL SELECT NULL,NULL,NULL--",
        "1' AND 1=1",
        "' WAITFOR DELAY '0:0:5'--",
    ]


@pytest_asyncio.fixture
def xss_payloads():
    return [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        "\"><script>alert(1)</script>",
        "<svg onload=alert(1)>",
        "'; alert(1); '",
        "<body onload=alert(1)>",
        "<<script>alert(1)</script>",
        "<scr<script>ipt>alert(1)</scr<script>ipt>",
        "\" onmouseover=\"alert(1)",
    ]


@pytest_asyncio.fixture(autouse=True)
async def mock_llm(monkeypatch):
    from api.services.llm_service import LLMService

    fake_embedding = [0.1] * 1536

    async def fake_generate_embedding(self, text: str, *args, **kwargs) -> list[float]:
        return fake_embedding

    async def fake_generate_completion(
        self, messages: list[dict], model: str | None = None,
        temperature: float = 0.7, max_tokens: int = 4096, *args, **kwargs,
    ) -> dict:
        return {"content": "Mock reply", "role": "assistant"}

    async def fake_generate_completion_with_tools(self, messages: list[dict], tools: list[dict], model: str | None = None, temperature: float = 0.7, *args, **kwargs) -> dict:
        return {"content": "Mock tool reply", "role": "assistant", "tool_calls": [], "usage": {"input_tokens": 10, "output_tokens": 10}}

    async def fake_generate_completion_stream(self, messages: list[dict], model: str | None = None, temperature: float = 0.7, max_tokens: int = 4096, *args, **kwargs):
        yield {"type": "content", "text": "Mock stream"}
        yield {"type": "done", "finish_reason": "stop"}

    monkeypatch.setattr(LLMService, "generate_embedding", fake_generate_embedding)
    monkeypatch.setattr(LLMService, "generate_completion", fake_generate_completion)
    monkeypatch.setattr(LLMService, "generate_completion_with_tools", fake_generate_completion_with_tools)
    monkeypatch.setattr(LLMService, "generate_completion_stream", fake_generate_completion_stream)


@pytest_asyncio.fixture(autouse=True)
async def mock_connector_test(monkeypatch):
    from api.services.connector_ext_service import ConnectorExtService

    async def fake_test_connection(self, connector_id, tenant_id=None, db=None):
        return {"status": "ok", "code": 200}

    monkeypatch.setattr(ConnectorExtService, "test_connection", fake_test_connection)
