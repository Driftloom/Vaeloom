import os
import uuid

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from backend.database import get_db
from backend.models.schema import User
from backend.services.scim import router as scim_router, verify_scim_token

pytestmark = pytest.mark.asyncio

TEST_TOKEN = "test-scim-token-123"


@pytest.fixture(autouse=True)
def _set_scim_token(monkeypatch):
    monkeypatch.setenv("SCIM_TOKEN", TEST_TOKEN)


def _build_app(db_session):
    app = FastAPI()
    app.include_router(scim_router)

    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db

    return app


AUTH_HEADER = {"Authorization": f"Bearer {TEST_TOKEN}"}


class TestCreateUser:
    async def test_creates_user(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/scim/v2/Users", json={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "jane@example.com",
                "name": {"formatted": "Jane Doe", "familyName": "Doe", "givenName": "Jane"},
                "active": True,
            }, headers=AUTH_HEADER)
            assert res.status_code == 201, res.text
            data = res.json()
            assert data["userName"] == "jane@example.com"
            assert data["active"] is True

    async def test_rejects_duplicate(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            payload = {
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "dup@example.com",
                "active": True,
            }
            res1 = await ac.post("/scim/v2/Users", json=payload, headers=AUTH_HEADER)
            assert res1.status_code == 201
            res2 = await ac.post("/scim/v2/Users", json=payload, headers=AUTH_HEADER)
            assert res2.status_code == 409

    async def test_requires_auth(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/scim/v2/Users", json={"userName": "u@example.com", "schemas": []})
            assert res.status_code == 401


class TestListUsers:
    async def test_lists_all_users(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            await ac.post("/scim/v2/Users", json={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "a@example.com", "active": True,
            }, headers=AUTH_HEADER)
            await ac.post("/scim/v2/Users", json={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "b@example.com", "active": True,
            }, headers=AUTH_HEADER)
            res = await ac.get("/scim/v2/Users", headers=AUTH_HEADER)
            assert res.status_code == 200
            data = res.json()
            assert data["totalResults"] == 2


class TestGetUser:
    async def test_gets_user(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            create = await ac.post("/scim/v2/Users", json={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "get@example.com", "active": True,
            }, headers=AUTH_HEADER)
            uid = create.json()["id"]
            res = await ac.get(f"/scim/v2/Users/{uid}", headers=AUTH_HEADER)
            assert res.status_code == 200
            assert res.json()["userName"] == "get@example.com"

    async def test_404(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get(f"/scim/v2/Users/{uuid.uuid4()}", headers=AUTH_HEADER)
            assert res.status_code == 404


class TestUpdateUser:
    async def test_put_updates_user(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            create = await ac.post("/scim/v2/Users", json={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "old@example.com", "active": True,
            }, headers=AUTH_HEADER)
            uid = create.json()["id"]
            res = await ac.put(f"/scim/v2/Users/{uid}", json={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "new@example.com",
                "name": {"formatted": "New Name"},
                "active": False,
            }, headers=AUTH_HEADER)
            assert res.status_code == 200
            assert res.json()["userName"] == "new@example.com"
            assert res.json()["active"] is False


class TestPatchUser:
    async def test_patch_active(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            create = await ac.post("/scim/v2/Users", json={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "patch@example.com", "active": True,
            }, headers=AUTH_HEADER)
            uid = create.json()["id"]
            res = await ac.patch(f"/scim/v2/Users/{uid}", json={
                "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                "Operations": [{"op": "replace", "path": "active", "value": False}],
            }, headers=AUTH_HEADER)
            assert res.status_code == 200
            assert res.json()["active"] is False


class TestDeleteUser:
    async def test_soft_deletes(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            create = await ac.post("/scim/v2/Users", json={
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "del@example.com", "active": True,
            }, headers=AUTH_HEADER)
            uid = create.json()["id"]
            res = await ac.delete(f"/scim/v2/Users/{uid}", headers=AUTH_HEADER)
            assert res.status_code == 204

            result = await db_session.execute(select(User).where(User.id == uuid.UUID(uid)))
            user = result.scalar_one()
            assert user.status == "INACTIVE"
