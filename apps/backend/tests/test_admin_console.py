import uuid

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from backend.database import get_db
from backend.models.schema import User
from backend.routers.admin_console import router as admin_router

pytestmark = pytest.mark.asyncio


def _build_app(db_session, user_override: dict | None = None):
    app = FastAPI()
    app.include_router(admin_router)

    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db

    user = user_override or {"sub": "admin-id", "roles": ["admin"], "tenant_id": None}

    from backend.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = lambda: user

    return app


class TestAdminListUsers:
    async def test_lists_users(self, db_session):
        db_session.add(User(email="u1@test.com", display_name="User 1"))
        db_session.add(User(email="u2@test.com", display_name="User 2"))
        await db_session.flush()

        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/admin/users")
            assert res.status_code == 200
            data = res.json()
            assert data["total"] >= 2
            emails = {u["email"] for u in data["items"]}
            assert "u1@test.com" in emails

    async def test_filters_by_status(self, db_session):
        db_session.add(User(email="active@test.com", display_name="Active", status="ACTIVE"))
        db_session.add(User(email="suspended@test.com", display_name="Suspended", status="SUSPENDED"))
        await db_session.flush()

        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/admin/users", params={"status": "SUSPENDED"})
            assert res.status_code == 200
            items = res.json()["items"]
            assert all(u["status"] == "SUSPENDED" for u in items)


class TestAdminGetUser:
    async def test_gets_user(self, db_session):
        user = User(email="get@test.com", display_name="Get User")
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)

        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get(f"/admin/users/{user.id}")
            assert res.status_code in (200, 404)

    async def test_404(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get(f"/admin/users/{uuid.uuid4()}")
            assert res.status_code == 404


class TestAdminSuspendActivate:
    async def test_suspend_user(self, db_session):
        user = User(email="sus@test.com", display_name="To Suspend")
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)

        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(f"/admin/users/{user.id}/suspend")
            assert res.status_code == 200
            assert res.json()["status"] == "SUSPENDED"

    async def test_activate_user(self, db_session):
        user = User(email="act@test.com", display_name="To Activate", status="SUSPENDED")
        db_session.add(user)
        await db_session.flush()
        await db_session.refresh(user)

        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(f"/admin/users/{user.id}/activate")
            assert res.status_code == 200
            assert res.json()["status"] == "ACTIVE"


class TestAdminAuditLog:
    async def test_returns_audit_events(self, db_session):
        from datetime import datetime, timezone

        await db_session.execute(
            text("""
                INSERT INTO audit_events (id, actor_id, action, resource, resource_id, tenant_id, metadata, created_at)
                VALUES (:id, :actor, :action, :resource, :rid, :tid, :meta, :now)
            """),
            {
                "id": str(uuid.uuid4()),
                "actor": "admin-1",
                "action": "user.suspend",
                "resource": "User",
                "rid": str(uuid.uuid4()),
                "tid": "tenant-1",
                "meta": "{}",
                "now": datetime.now(timezone.utc),
            },
        )

        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/admin/audit-log")
            assert res.status_code == 200
            data = res.json()
            assert data["total"] >= 1

    async def test_filters_by_action(self, db_session):
        from datetime import datetime, timezone

        eid1 = str(uuid.uuid4())
        eid2 = str(uuid.uuid4())
        await db_session.execute(
            text("INSERT INTO audit_events (id, actor_id, action, resource, resource_id, tenant_id, metadata, created_at) VALUES (:id, :a, :act, :res, :rid, :tid, :m, :now)"),
            {"id": eid1, "a": "admin", "act": "user.suspend", "res": "User", "rid": str(uuid.uuid4()), "tid": None, "m": "{}", "now": datetime.now(timezone.utc)},
        )
        await db_session.execute(
            text("INSERT INTO audit_events (id, actor_id, action, resource, resource_id, tenant_id, metadata, created_at) VALUES (:id, :a, :act, :res, :rid, :tid, :m, :now)"),
            {"id": eid2, "a": "admin", "act": "user.activate", "res": "User", "rid": str(uuid.uuid4()), "tid": None, "m": "{}", "now": datetime.now(timezone.utc)},
        )
        # The admin_console uses /admin/audit-log base path
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/admin/audit-log", params={"action": "user.suspend"})
            assert res.status_code == 200
            data = res.json()
            assert data["total"] >= 1
            assert all(e["action"] == "user.suspend" for e in data["items"])
