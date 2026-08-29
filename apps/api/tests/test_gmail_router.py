from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from api.database import get_db
from api.dependencies import get_current_user, get_tenant_id
from api.models.schema import GmailWatch
from api.routers.gmail import router as gmail_router
from api.services.gmail_service import gmail_service, hash_channel_token

pytestmark = pytest.mark.asyncio


class FakeGmailClient:
    def __init__(self, configured=True, watch_result=None):
        self._configured = configured
        self.watch_result = watch_result or {
            "id": "channel-1",
            "resourceId": "resource-1",
            "historyId": "100",
        }
        self.draft_result = {"id": "draft-1", "message": {"id": "msg-1"}}
        self.drafts = [{"id": "draft-1", "message": {"id": "msg-1"}}]
        self.start_watch = AsyncMock(return_value=self.watch_result)
        self.stop_watch = AsyncMock(return_value=True)
        self.create_draft = AsyncMock(return_value=self.draft_result)
        self.list_drafts = AsyncMock(return_value=self.drafts)


def _build_app(db_session, user_override=None):
    app = FastAPI()
    app.include_router(gmail_router, prefix="/api/v1")

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    user = user_override or {"sub": "user-1", "tenant_id": "tenant-1"}

    async def fake_current_user():
        return user

    async def fake_tenant_id():
        return user.get("tenant_id")

    app.dependency_overrides[get_current_user] = fake_current_user
    app.dependency_overrides[get_tenant_id] = fake_tenant_id
    return app


async def _watch_row(db_session, channel_id="channel-1"):
    result = await db_session.execute(select(GmailWatch).where(GmailWatch.channel_id == channel_id))
    return result.scalar_one_or_none()


class TestGmailWatchEndpoints:
    async def test_start_watch_success(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/gmail/watch", json={"topic": "projects/p/topics/t"})
        assert res.status_code == 200
        data = res.json()
        assert data["active"] is True
        assert data["channel_id"] == "channel-1"
        assert data["history_id"] == "100"
        row = await _watch_row(db_session)
        assert row is not None
        assert row.workspace_id == "tenant-1"
        assert row.topic == "projects/p/topics/t"

    async def test_start_watch_not_configured(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient(configured=False))
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/gmail/watch", json={"topic": "t"})
        assert res.status_code == 200
        assert res.json()["active"] is False

    async def test_start_watch_api_failure(self, db_session, monkeypatch):
        fake = FakeGmailClient()
        fake.start_watch = AsyncMock(return_value=None)
        monkeypatch.setattr(gmail_service, "_client", fake)
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/gmail/watch", json={"topic": "t"})
        assert res.status_code == 200
        assert res.json()["active"] is False
        assert "Failed" in res.json()["message"]

    async def test_start_watch_restarts_existing_watch(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            await ac.post("/api/v1/gmail/watch", json={"topic": "t1"})
            res = await ac.post("/api/v1/gmail/watch", json={"topic": "t2"})
        assert res.status_code == 200
        rows = (await db_session.execute(select(GmailWatch))).scalars().all()
        assert len(rows) == 1
        assert rows[0].topic == "t2"

    async def test_get_watch_status_active(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            await ac.post("/api/v1/gmail/watch", json={"topic": "t"})
            res = await ac.get("/api/v1/gmail/watch")
        assert res.status_code == 200
        assert res.json()["active"] is True
        assert res.json()["status"] == "ACTIVE"

    async def test_get_watch_status_no_watch(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/api/v1/gmail/watch")
        assert res.status_code == 200
        assert res.json()["active"] is False

    async def test_stop_watch(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            await ac.post("/api/v1/gmail/watch", json={"topic": "t"})
            res = await ac.delete("/api/v1/gmail/watch")
        assert res.status_code == 200
        assert res.json()["status"] == "STOPPED"
        row = await _watch_row(db_session)
        assert row.status == "STOPPED"

    async def test_renewal_on_status_when_expiring(self, db_session, monkeypatch):
        fake = FakeGmailClient()
        monkeypatch.setattr(gmail_service, "_client", fake)
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            await ac.post("/api/v1/gmail/watch", json={"topic": "t"})
        row = await _watch_row(db_session)
        row.expiration = datetime.now(timezone.utc) + timedelta(hours=1)
        await db_session.commit()
        fake.start_watch.return_value = {"id": "channel-2", "historyId": "200"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/api/v1/gmail/watch")
        assert res.status_code == 200
        assert res.json()["channel_id"] == "channel-2"
        row = await _watch_row(db_session, channel_id="channel-2")
        assert row is not None

    async def test_requires_auth(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session, user_override=None)

        async def fake_current_user():
            return None

        app.dependency_overrides[get_current_user] = fake_current_user
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/gmail/watch", json={"topic": "t"})
        assert res.status_code == 401


class TestGmailDraftEndpoints:
    async def test_create_draft_success(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/gmail/drafts",
                json={"to": "a@b.com", "subject": "Hi", "body": "Hello"},
            )
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == "draft-1"
        assert data["message"]["id"] == "msg-1"

    async def test_create_draft_not_configured(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient(configured=False))
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/gmail/drafts",
                json={"to": "a@b.com", "subject": "Hi", "body": "Hello"},
            )
        assert res.status_code == 503

    async def test_create_draft_api_failure(self, db_session, monkeypatch):
        fake = FakeGmailClient()
        fake.create_draft = AsyncMock(return_value=None)
        monkeypatch.setattr(gmail_service, "_client", fake)
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/gmail/drafts",
                json={"to": "a@b.com", "subject": "Hi", "body": "Hello"},
            )
        assert res.status_code == 502

    async def test_create_draft_validation(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/gmail/drafts", json={"to": "x", "subject": "", "body": ""})
        assert res.status_code == 422

    async def test_list_drafts_success(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/api/v1/gmail/drafts")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert data["items"][0]["id"] == "draft-1"

    async def test_list_drafts_not_configured(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient(configured=False))
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/api/v1/gmail/drafts")
        assert res.status_code == 503


class TestGmailWebhook:
    async def test_webhook_accepts_valid_channel(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        # Channel tokens are hashed at rest (FIND-SEC-010); Google sends the
        # plaintext token, which the webhook hashes for comparison.
        watch = GmailWatch(
            workspace_id="tenant-1",
            user_id="user-1",
            topic="projects/p/topics/t",
            channel_id="channel-1",
            channel_token=hash_channel_token("known-channel-token"),
            resource_id="resource-1",
            history_id="100",
            expiration=datetime.now(timezone.utc) + timedelta(days=7),
            status="ACTIVE",
        )
        db_session.add(watch)
        await db_session.commit()
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/gmail/webhook",
                json={"historyId": 777},
                headers={
                    "X-Goog-Channel-ID": "channel-1",
                    "X-Goog-Channel-Token": "known-channel-token",
                },
            )
        assert res.status_code == 200
        row = await _watch_row(db_session)
        assert row.history_id == "777"
        assert row.last_reconciled_at is not None

    async def test_webhook_unknown_channel(self, db_session, monkeypatch):
        monkeypatch.setattr(gmail_service, "_client", FakeGmailClient())
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/gmail/webhook",
                json={"historyId": 1},
                headers={
                    "X-Goog-Channel-ID": "unknown-channel",
                    "X-Goog-Channel-Token": "bogus-token",
                },
            )
        assert res.status_code == 403

    async def test_webhook_missing_channel_header(self, db_session, monkeypatch):
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/gmail/webhook", json={"historyId": 1})
        assert res.status_code == 400

    async def test_webhook_unsupported_resource_state(self, db_session, monkeypatch):
        app = _build_app(db_session)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post(
                "/api/v1/gmail/webhook",
                json={},
                headers={"X-Goog-Channel-ID": "channel-1", "X-Goog-Resource-State": "bogus"},
            )
        assert res.status_code == 400
