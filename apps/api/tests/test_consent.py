import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from api.database import get_db
from api.services.consent import ConsentScope, consent_manager, router as consent_router

pytestmark = pytest.mark.asyncio


def _build_app(db_session, user_override: dict | None = None):
    app = FastAPI()
    app.include_router(consent_router, prefix="/api/v1")

    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db

    user = user_override or {"sub": "test-user-id", "tenant_id": "test-tenant", "roles": ["admin"]}

    async def fake_current_user():
        return user

    from api.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = fake_current_user

    return app


class TestConsentManager:
    async def test_record_and_check_consent(self, db_session):
        await consent_manager.record_consent(
            user_id="user-1", scope=ConsentScope.data_processing, db=db_session,
        )
        assert await consent_manager.check_consent("user-1", ConsentScope.data_processing, db_session) is True
        assert await consent_manager.check_consent("user-1", ConsentScope.agent_access, db_session) is False

    async def test_revoke_consent(self, db_session):
        await consent_manager.record_consent(
            user_id="user-2", scope=ConsentScope.email_marketing, db=db_session,
        )
        assert await consent_manager.check_consent("user-2", ConsentScope.email_marketing, db_session) is True
        await consent_manager.revoke_consent("user-2", ConsentScope.email_marketing, db_session)
        assert await consent_manager.check_consent("user-2", ConsentScope.email_marketing, db_session) is False

    async def test_list_consents(self, db_session):
        await consent_manager.record_consent(user_id="user-3", scope=ConsentScope.data_processing, db=db_session)
        await consent_manager.record_consent(user_id="user-3", scope=ConsentScope.agent_access, db=db_session)
        records = await consent_manager.list_consents("user-3", db_session)
        assert len(records) == 2
        scopes = {r["scope"] for r in records}
        assert scopes == {"data_processing", "agent_access"}

    async def test_rerender_replaces_old_consent(self, db_session):
        await consent_manager.record_consent(user_id="user-4", scope=ConsentScope.data_processing, db=db_session)
        await consent_manager.record_consent(user_id="user-4", scope=ConsentScope.data_processing, db=db_session)
        records = await consent_manager.list_consents("user-4", db_session)
        assert len(records) == 1  # replaced, not duplicated


class TestConsentEndpoints:
    async def test_list_scopes(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/consent/scopes")
            assert res.status_code == 200
            data = res.json()
            assert "data_processing" in {s["name"] for s in data["scopes"]}

    async def test_grant_consent(self, db_session):
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/api/v1/consent/grant", json={"scope": "agent_access"})
            assert res.status_code == 200
            data = res.json()
            assert data["scope"] == "agent_access"

    async def test_revoke_consent(self, db_session):
        await consent_manager.record_consent("test-user-id", ConsentScope.email_marketing, db_session)
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post("/api/v1/consent/revoke/email_marketing")
            assert res.status_code == 200
            data = res.json()
            assert data["scope"] == "email_marketing"
            assert data["revoked_at"] is not None

    async def test_my_consents(self, db_session):
        await consent_manager.record_consent("test-user-id", ConsentScope.data_processing, db_session)
        app = _build_app(db_session)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/v1/consent/me")
            assert res.status_code == 200
            data = res.json()
            assert len(data["items"]) == 1
            assert data["items"][0]["scope"] == "data_processing"
