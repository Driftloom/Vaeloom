import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Hermetic unit test database baseline: default to local sqlite so module-level
# engines never connect to remote Supabase instances specified in developer .env files
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///./test_dev.db")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_dev.db")
os.environ.setdefault("DATABASE_MIGRATION__URL", "")

# Ensure ENCRYPTION_KEY is set for tests that trigger encrypt_value()
os.environ.setdefault("ENCRYPTION_KEY", "test-encryption-key-must-be-at-least-32-chars!!")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-ci-only-32-chars-long!!")

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
import sqlalchemy.dialects.postgresql
_orig_pg_uuid = getattr(sqlalchemy.dialects.postgresql, "UUID", None)

class MockUUID(sa_types.TypeDecorator):
    impl = sa_types.String
    cache_ok = True
    def __init__(self, as_uuid=True, *args, **kwargs):
        super().__init__(*args, **kwargs)
    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql" and _orig_pg_uuid is not None:
            return dialect.type_descriptor(_orig_pg_uuid(as_uuid=True))
        return dialect.type_descriptor(sa_types.String(36))
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
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

sqlalchemy.dialects.postgresql.JSONB = JSON
sqlalchemy.dialects.postgresql.ARRAY = MockArray
sqlalchemy.dialects.postgresql.UUID = MockUUID

import re
import json
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
from api.config import settings

# Isolate test suite from developer's local credentials in .env
for _env_key in [
    "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN",
    "MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET", "MS_GRAPH_REFRESH_TOKEN",
    "JOB_BOARD_API_URL", "JOB_BOARD_API_KEY",
    "SSO_PROVIDERS",
]:
    os.environ.pop(_env_key, None)

settings.google_client_id = ""
settings.google_client_secret = ""
settings.google_refresh_token = ""
settings.ms_graph_client_id = ""
settings.ms_graph_client_secret = ""
settings.ms_graph_refresh_token = ""
settings.job_board_api_url = ""
settings.job_board_api_key = ""
settings.sso_providers = {}
from sqlalchemy.pool import NullPool
from starlette.exceptions import HTTPException as StarletteHTTPException

import api.models  # noqa: F401 — register ORM models before create_all runs
from api.database import Base, get_db
from api.middleware.auth import AuthMiddleware
from api.middleware.exception_handler import unified_exception_handler, generic_exception_handler, validation_exception_handler
from fastapi.exceptions import RequestValidationError

from api.services.memory_type_packs import CAREER_PACK_SLUG, CAREER_TYPES


def _build_test_app(db_session):
    """Create a fresh FastAPI instance per test — no shared mutable state."""
    import api.infrastructure.metrics  # noqa: F401 — register Prometheus metrics
    from api.routers import (
        health, auth, workspaces, memory, agents, events, search,
        integrations, billing, documents, resumes, applications,
        plugins, chat, notifications, connectors, capabilities, scheduler,
        analytics, audit, iam, knowledge_graph, recommendations,
        webhooks, gmail, provider_keys, profile, opportunities, council,
        cognition, sovereignty, anticipation, federation,
        marketplace, organizations, realtime, onboarding, orchestrator, career,
        vault_sync, conversations,
    )
    from api.services.gdpr import router as gdpr_router
    from api.services.consent import router as consent_router
    from api.services.approval import router as approval_router
    from api.routers import admin_console

    test_app = FastAPI()

    test_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    # Mirror production middleware stack: Tenant inner, Auth outer (Auth runs first to populate user/tenant)
    from api.middleware.tenant import TenantMiddleware
    from sqlalchemy.ext.asyncio import async_sessionmaker

    test_session_factory = async_sessionmaker(db_session.bind, expire_on_commit=False)
    # IDEM-SCOPE-01: idempotency must run AFTER Auth+Tenant (added before
    # them, since Starlette executes last-added first) so replays are
    # authenticated and tenant/workspace-scoped. Replaying before auth would
    # serve stored responses to unauthenticated callers.
    from api.middleware.idempotency import IdempotencyMiddleware
    test_app.add_middleware(
        IdempotencyMiddleware,
        session_factory=test_session_factory,
    )
    test_app.add_middleware(TenantMiddleware, session_factory=test_session_factory)
    test_app.add_middleware(AuthMiddleware, session_factory=test_session_factory)
    test_app.add_exception_handler(StarletteHTTPException, unified_exception_handler)
    test_app.add_exception_handler(Exception, generic_exception_handler)
    test_app.add_exception_handler(RequestValidationError, validation_exception_handler)

    from api.infrastructure.metrics import MetricsMiddleware
    test_app.add_middleware(MetricsMiddleware)

    test_app.include_router(health.router, prefix="/health")
    test_app.include_router(auth.router, prefix="/api/v1/auth")
    test_app.include_router(workspaces.router, prefix="/api/v1/workspaces")
    test_app.include_router(conversations.router, prefix="/api/v1/workspaces/{workspace_id}/conversations")
    test_app.include_router(memory.router, prefix="/api/v1/memories")
    test_app.include_router(agents.router, prefix="/api/v1/agents")
    test_app.include_router(provider_keys.router, prefix="/api/v1/provider-keys")
    test_app.include_router(events.router, prefix="/api/v1/events")
    test_app.include_router(search.router, prefix="/api/v1/search")
    test_app.include_router(integrations.router, prefix="/api/v1/integrations")
    test_app.include_router(billing.router, prefix="/api/v1/billing")
    test_app.include_router(documents.router, prefix="/api/v1/documents")
    test_app.include_router(resumes.router, prefix="/api/v1/resumes")
    test_app.include_router(applications.router, prefix="/api/v1/workspaces/{workspace_id}/applications")
    test_app.include_router(notifications.router, prefix="/api/v1/notifications")
    test_app.include_router(connectors.router, prefix="/api/v1/connectors")
    test_app.include_router(capabilities.router, prefix="/api/v1/capabilities")
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
    test_app.include_router(gmail.router, prefix="/api/v1")
    test_app.include_router(admin_console.router, prefix="")
    test_app.include_router(profile.router, prefix="/api/v1/profile")
    test_app.include_router(opportunities.router, prefix="/api/v1/opportunities")
    test_app.include_router(council.router, prefix="/api/v1/council")
    test_app.include_router(cognition.router, prefix="/api/v1/cognition")
    test_app.include_router(sovereignty.router, prefix="/api/v1/sovereignty")
    test_app.include_router(anticipation.router, prefix="/api/v1/anticipation")
    test_app.include_router(federation.router, prefix="/api/v1/federation")
    test_app.include_router(realtime.router, prefix="/api/v1/realtime")
    test_app.include_router(organizations.router, prefix="/api/v1/organizations")
    test_app.include_router(marketplace.router, prefix="/api/v1/marketplace")
    test_app.include_router(onboarding.router, prefix="/api/v1/onboarding")
    test_app.include_router(orchestrator.router, prefix="/api/v1/orchestrator")
    test_app.include_router(career.router, prefix="/api/v1")
    test_app.include_router(vault_sync.router, prefix="/api/v1/vault-sync")


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


# Returned by the SQLite stand-in for app_tenant_for_workspace(). Fixed so a
# test can assert on it; see the listener below.
_SQLITE_TENANT_ID = "00000000-0000-0000-0000-0000000000aa"


@pytest_asyncio.fixture
async def db_session(db_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", poolclass=NullPool)

    @event.listens_for(engine.sync_engine, "connect")
    def _register_sqlite_functions(dbapi_connection, _connection_record):
        dbapi_connection.create_function("cosine_distance", 2, lambda a, b: 0.0)
        dbapi_connection.create_function("set_config", 3, lambda a, b, c: b)
        # Migration 0036's SECURITY DEFINER workspace->tenant resolver, which
        # `ranking_weights.provision_profile` calls to fill ranking_weight_
        # profiles.tenant_id (NOT NULL, but never read by the resolver or by any
        # RLS predicate -- it is derived, not threaded). Under PostgreSQL the real
        # function resolves from workspaces.user_id -> users.tenant_id and bypasses
        # RLS by design; SQLite has neither the function nor RLS, so without this
        # shim the provisioning INSERT raises "no such function", the raise is
        # swallowed by its own best-effort guard, and every test that wants to
        # observe a provisioned row silently observes none.
        #
        # It returns a constant rather than resolving anything: what these tests
        # are about is whether the provisioning write happens and is idempotent,
        # not whether tenant derivation is correct. That derivation is
        # PostgreSQL-only and stays unverified here -- the same honest gap the
        # live-PG suites in test_ranking_weights_rls.py cover.
        dbapi_connection.create_function(
            "app_tenant_for_workspace", 1, lambda ws: _SQLITE_TENANT_ID
        )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        raw_sql_queries = [
            "CREATE TABLE IF NOT EXISTS scheduled_jobs (id TEXT PRIMARY KEY, name TEXT, type TEXT, cron TEXT, method TEXT, url TEXT, event TEXT, payload TEXT, headers TEXT, status TEXT, tenant_id TEXT, last_run_at TIMESTAMP, next_run_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS notification_templates (id TEXT PRIMARY KEY, name TEXT, subject TEXT, body TEXT, channel TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS notification_subscribers (id TEXT PRIMARY KEY, url TEXT, tenant_id TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT, resource TEXT, resource_id TEXT, tenant_id TEXT, metadata TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY, name TEXT, properties TEXT, tenant_id TEXT, user_id TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS job_executions (id TEXT PRIMARY KEY, job_id TEXT, status TEXT, started_at TIMESTAMP, finished_at TIMESTAMP, status_code INTEGER, error TEXT, created_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS knowledge_nodes (id TEXT PRIMARY KEY, label TEXT NOT NULL, type TEXT NOT NULL, description TEXT, importance REAL DEFAULT 0.5, properties TEXT DEFAULT '{}', embedding TEXT, tenant_id TEXT NOT NULL, workspace_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS knowledge_edges (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE, relationship TEXT NOT NULL, weight REAL DEFAULT 1.0, properties TEXT DEFAULT '{}', workspace_id text, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS iam_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, tenant_id TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP, updated_at TIMESTAMP)",
            "CREATE TABLE IF NOT EXISTS iam_user_roles (user_id TEXT NOT NULL REFERENCES iam_users(id) ON DELETE CASCADE, role_id TEXT NOT NULL, PRIMARY KEY (user_id, role_id))",
            "CREATE TABLE IF NOT EXISTS rbac_roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, permissions TEXT DEFAULT '[]')",
            "DROP TABLE IF EXISTS usage_records",
            "CREATE TABLE IF NOT EXISTS usage_records (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, metric TEXT, value REAL, timestamp TIMESTAMP, recorded_at TEXT, memories_created INTEGER DEFAULT 0, agents_run INTEGER DEFAULT 0, tokens_used INTEGER DEFAULT 0)",
            "CREATE TABLE IF NOT EXISTS consent_records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tenant_id TEXT, scope TEXT NOT NULL, granted_at TIMESTAMP, revoked_at TIMESTAMP, ip_address TEXT)",
        ]
        for q in raw_sql_queries:
            await conn.execute(text(q))

        # Seed the career domain pack, mirroring migration 0068. `upgrade()`
        # returns early off PostgreSQL, so without this the SQLite database holds
        # an empty registry -- and an *empty* registry is not a fallback case: it
        # means "no pack is active", which by design rejects every memory type
        # (services.memory_type_packs returns [] for empty and only falls back to
        # the built-in pack when the table cannot be read at all). Since the pack
        # check is the write path's only type guard, an unseeded test database
        # rejects every memory write in the suite.
        #
        # Written on this connection rather than the test session so it is a
        # committed row that survives a test's rollback. `id` is supplied
        # explicitly: the ORM default is Python-side, so raw SQL gets no value.
        await conn.execute(
            text(
                "INSERT INTO memory_type_packs "
                "(id, slug, version, label, types, is_active) "
                "VALUES (:id, :slug, 1, 'Career', :types, 1) "
                "ON CONFLICT (slug) DO NOTHING"
            ),
            {
                "id": str(uuid.uuid4()),
                "slug": CAREER_PACK_SLUG,
                "types": json.dumps(list(CAREER_TYPES)),
            },
        )

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            yield session
    finally:
        # Drain pending audit and orchestrator background tasks before disposing engine
        try:
            import asyncio
            from api.tools.executor import drain_pending_audit_tasks

            await drain_pending_audit_tasks(timeout=1.0)
        except Exception:
            pass

        try:
            import asyncio
            from api.orchestrator.loop import _BACKGROUND_TASKS

            if _BACKGROUND_TASKS:
                pending_bg = [t for t in _BACKGROUND_TASKS if not t.done()]
                if pending_bg:
                    _, pending = await asyncio.wait(pending_bg, timeout=1.0)
                    for t in pending:
                        t.cancel()
                    if pending:
                        await asyncio.gather(*pending, return_exceptions=True)
        except Exception:
            pass

        try:
            import asyncio
            current_task = asyncio.current_task()
            all_pending = [
                t for t in asyncio.all_tasks()
                if t is not current_task and not t.done()
            ]
            if all_pending:
                for t in all_pending:
                    t.cancel()
                await asyncio.gather(*all_pending, return_exceptions=True)
        except Exception:
            pass

        # Teardown: tmp_path isolates and cleans the SQLite db file; cleanly dispose the engine.
        try:
            await engine.dispose()
        except Exception:
            pass


@pytest_asyncio.fixture
async def client(db_session):
    test_app = _build_test_app(db_session)
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict:
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": "test-auth@vaeloom.test", "password": "TestAuth1234!"},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(autouse=True)
async def mock_llm(monkeypatch, request):
    """Return fake LLM responses — no real API calls, unless marked live_provider."""
    if request.node.get_closest_marker("live_provider"):
        return
    from api.services.llm_service import LLMService

    # Deterministic env: agents must see no LLM key unless a test sets one
    for _k in ("llm_api_key", "groq_api_key", "openai_api_key", "anthropic_api_key", "gemini_api_key"):
        if hasattr(settings, _k):
            monkeypatch.setattr(settings, _k, "")
    for _env in ("LLM_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.setenv(_env, "")

    # MVP scope lock is off by default for existing suites; the dedicated
    # test_mvp_scope.py module re-enables it and verifies the gate.
    monkeypatch.setattr(settings, "mvp_scope_enforced", False)

    fake_embedding = [0.1] * 1536

    async def fake_generate_embedding(self, text: str, *args, **kwargs) -> list[float]:
        return fake_embedding

    async def fake_generate_completion(
        self, messages: list[dict], model: str | None = None,
        temperature: float = 0.7, max_tokens: int = 4096, *args, **kwargs,
    ) -> dict:
        return {"content": "Mock reply from test LLM", "role": "assistant", "usage": {"input_tokens": 10, "output_tokens": 10}}

    async def fake_generate_completion_with_tools(self, messages: list[dict], tools: list[dict], model: str | None = None, temperature: float = 0.7, *args, **kwargs) -> dict:
        return {"content": "Mock tool reply", "role": "assistant", "tool_calls": [], "usage": {"input_tokens": 10, "output_tokens": 10}}

    async def fake_generate_completion_stream(self, messages: list[dict], model: str | None = None, temperature: float = 0.7, max_tokens: int = 4096, *args, **kwargs):
        yield {"type": "content", "text": "Mock stream"}
        yield {"type": "done", "finish_reason": "stop"}

    # NOTE: generate_completion_with_tools_stream intentionally NOT mocked here.
    # Its no-key fallback delegates to the mocked buffered tool completion above,
    # keeping a single mock surface for all LLM tool paths.

    monkeypatch.setattr(LLMService, "generate_embedding", fake_generate_embedding)
    monkeypatch.setattr(LLMService, "generate_completion", fake_generate_completion)
    monkeypatch.setattr(LLMService, "generate_completion_with_tools", fake_generate_completion_with_tools)
    monkeypatch.setattr(LLMService, "generate_completion_stream", fake_generate_completion_stream, raising=False)

    try:
        from api.services.llm_service import llm_service
        monkeypatch.setattr(llm_service, "api_key", "")
        for _attr in ("generate_embedding", "generate_completion", "generate_completion_with_tools", "generate_completion_stream"):
            if _attr in llm_service.__dict__:
                monkeypatch.delattr(llm_service, _attr, raising=False)
    except Exception:
        pass


@pytest_asyncio.fixture(autouse=True)
async def mock_connector_test(monkeypatch):
    """Mock connector test_connection — no real HTTP calls."""
    from api.services.connector_ext_service import ConnectorExtService

    async def fake_test_connection(self, connector_id, tenant_id=None, db=None, **kwargs):
        return {"status": "ok", "code": 200}

    monkeypatch.setattr(ConnectorExtService, "test_connection", fake_test_connection)


@pytest.fixture(autouse=True)
def _clean_global_state(monkeypatch):
    """Isolate parser sys.modules + circuit state across xdist workers.

    Full 2731-suite reuses workers (loadfile); a previous file's
    monkeypatch.setitem(sys.modules, 'fitz', None) would otherwise leak
    into the next file's `import fitz` inside parsers._parse_sync.
    Also clear loop circuit breakers that survive worker reuse.
    """
    for mod in ("fitz", "pdfplumber", "PyPDF2", "docx", "pytesseract", "PIL", "PIL.Image"):
        monkeypatch.delitem(sys.modules, mod, raising=False)
    # Clear in-memory circuit breakers / rate limiter state if present
    try:
        from api.orchestrator.loop import _circuit_breakers

        _circuit_breakers.clear()
    except Exception:
        pass
    try:
        from api.infrastructure.circuit_breaker import CircuitBreaker as _CB

        # no global to clear, instance-local
        pass
    except Exception:
        pass
    yield
    for mod in ("fitz", "pdfplumber", "PyPDF2", "docx", "pytesseract", "PIL", "PIL.Image"):
        monkeypatch.delitem(sys.modules, mod, raising=False)
    try:
        from api.orchestrator.loop import _circuit_breakers as _cb2

        _cb2.clear()
    except Exception:
        pass
