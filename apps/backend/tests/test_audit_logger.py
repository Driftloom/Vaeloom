import json
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, Depends
from httpx import AsyncClient, ASGITransport

from backend.models.schema import Tenant
from backend.services.audit import AuditLogEntry, AuditLogger, AuditMiddleware, audit_router

pytestmark = pytest.mark.asyncio


class TestAuditLogEntry:
    def test_valid_entry(self):
        entry = AuditLogEntry(
            id=str(uuid.uuid4()),
            tenant_id="t-1",
            workspace_id="w-1",
            user_id="u-1",
            action="document:create",
            resource_type="document",
            resource_id="doc-1",
            details={"size": 1024},
            ip_address="10.0.0.1",
            user_agent="test-agent",
        )
        assert entry.action == "document:create"
        assert entry.resource_type == "document"
        assert entry.tenant_id == "t-1"

    def test_minimal_entry(self):
        entry = AuditLogEntry(
            id="e-1",
            action="view",
            resource_type="page",
        )
        assert entry.action == "view"
        assert entry.tenant_id is None
        assert entry.user_id is None

    def test_extra_fields_ignored(self):
        entry = AuditLogEntry(id="e-1", action="test", resource_type="r", unknown_field="x")
        assert not hasattr(entry, "unknown_field")
        assert entry.action == "test"


class TestAuditLogger:
    @pytest.fixture
    def svc(self):
        return AuditLogger

    async def test_log_basic(self):
        db = MagicMock()
        calls = []

        async def execute(sql, params=None):
            calls.append((sql, params))

        db.execute = execute
        logger = AuditLogger(db)
        entry_id = await logger.log(
            action="file:upload",
            resource_type="file",
            resource_id="f-1",
            tenant_id="t-1",
            user_id="u-1",
        )
        assert uuid.UUID(entry_id)
        assert len(calls) == 1
        params = calls[0][1]
        assert params["action"] == "file:upload"
        assert params["resource"] == "file"
        assert params["resource_id"] == "f-1"
        assert params["tenant_id"] == "t-1"
        assert params["actor_id"] == "u-1"

    async def test_log_with_details(self):
        db = MagicMock()
        calls = []

        async def execute(sql, params=None):
            calls.append((sql, params))

        db.execute = execute
        logger = AuditLogger(db)
        details = {"reason": "test", "count": 5}
        await logger.log(
            action="bulk:delete",
            resource_type="items",
            details=details,
            tenant_id="t-2",
            user_id="u-2",
            ip_address="192.168.1.1",
            user_agent="curl/7.0",
        )
        meta = json.loads(calls[0][1]["metadata"])
        assert meta["reason"] == "test"
        assert meta["count"] == 5
        assert meta["ip_address"] == "192.168.1.1"
        assert meta["user_agent"] == "curl/7.0"

    async def test_log_minimal(self):
        db = MagicMock()
        calls = []

        async def execute(sql, params=None):
            calls.append((sql, params))

        db.execute = execute
        logger = AuditLogger(db)
        entry_id = await logger.log(action="login", resource_type="auth")
        assert uuid.UUID(entry_id)
        assert calls[0][1]["resource_id"] == ""

    async def test_query_empty(self):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 0
        rows_result = MagicMock()
        rows_result.fetchall.return_value = []
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        logger = AuditLogger(db)
        items, total = await logger.query(page=1, page_size=10)
        assert total == 0
        assert items == []

    async def test_query_with_filters(self):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1
        rows_result = MagicMock()
        dt = datetime.now(timezone.utc)
        rows_result.fetchall.return_value = [
            ("e1", "u-1", "create", "doc", "d-1", "t-1",
             '{"workspace_id":"w-1"}', dt),
        ]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        logger = AuditLogger(db)
        items, total = await logger.query(page=1, page_size=10, tenant_id="t-1", action="create", resource_type="doc")
        assert total == 1
        assert items[0].action == "create"
        assert items[0].tenant_id == "t-1"
        assert items[0].workspace_id == "w-1"

    async def test_query_with_metadata_decode_error(self):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1
        rows_result = MagicMock()
        dt = datetime.now(timezone.utc)
        rows_result.fetchall.return_value = [
            ("e1", "u-1", "view", "page", None, None, "{bad", dt),
        ]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        logger = AuditLogger(db)
        items, total = await logger.query(page=1, page_size=10)
        assert total == 1
        assert items[0].details == {}

    async def test_query_with_non_dict_metadata(self):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1
        rows_result = MagicMock()
        dt = datetime.now(timezone.utc)
        rows_result.fetchall.return_value = [
            ("e1", "u-1", "delete", "file", "f-1", "t-1", 123, dt),
        ]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        logger = AuditLogger(db)
        items, total = await logger.query(page=1, page_size=10)
        assert total == 1
        assert items[0].resource_id == "f-1"


class TestAuditMiddleware:
    async def test_passes_get_through(self):
        app = FastAPI()

        @app.get("/health")
        async def health():
            return {"ok": True}

        app.add_middleware(AuditMiddleware)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/health")
        assert res.status_code == 200

    async def test_does_not_block_mutations(self):
        app = FastAPI()

        @app.post("/items")
        async def create():
            return {"id": "new-item"}

        app.add_middleware(AuditMiddleware)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/items", json={"name": "test"})
        assert res.status_code == 200


class TestAuditEndpoint:
    async def test_requires_auth(self):
        app = FastAPI()
        app.include_router(audit_router)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/audit")
        assert res.status_code == 401

    async def test_requires_admin_role(self):
        from backend.dependencies import get_current_user

        app = FastAPI()
        app.include_router(audit_router)

        async def fake_user():
            return {"sub": "u-1", "roles": ["editor"]}
        app.dependency_overrides[get_current_user] = fake_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/audit")
        assert res.status_code == 403

    async def test_admin_can_query(self):
        from backend.database import get_db as _get_db
        from backend.dependencies import get_current_user

        app = FastAPI()
        app.include_router(audit_router)

        async def fake_user():
            return {"sub": "admin-1", "roles": ["admin"], "tenant_id": "t-1"}
        app.dependency_overrides[get_current_user] = fake_user

        class FakeResult:
            def scalar_one(self):
                return 0

            def fetchall(self):
                return []

        fake_db = MagicMock()
        call_count = 0

        async def fake_execute(sql, params=None):
            nonlocal call_count
            call_count += 1
            return FakeResult()

        fake_db.execute = fake_execute
        app.dependency_overrides[_get_db] = lambda: fake_db

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/audit?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert data["total"] == 0
        assert data["page"] == 1
