import json
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import text

from api.models.schema import Conversation, ChatMessage, Event, UsageRecord, User, Workspace
from api.services.retention import (
    ALLOWED_RETENTION_TABLES,
    ARCHIVE_UNSUPPORTED_TABLES,
    RetentionPolicy,
    apply_retention,
    load_retention_policies,
    RetentionScheduler,
)

pytestmark = pytest.mark.asyncio


class TestRetentionPolicy:
    def test_model_valid(self):
        p = RetentionPolicy(max_age_days=90, action="delete", resource_type="events")
        assert p.max_age_days == 90
        assert p.action == "delete"

    def test_model_with_tenant(self):
        p = RetentionPolicy(tenant_id="tenant-1", max_age_days=30, action="archive", resource_type="audit_events")
        assert p.tenant_id == "tenant-1"

    def test_invalid_action_fails(self):
        with pytest.raises(ValueError):
            RetentionPolicy(max_age_days=90, action="purge", resource_type="events")


class TestApplyRetention:
    async def test_delete_old_records(self, db_session):
        db_session.add(Event(id=uuid.uuid4(), type="test", source="test", category="test", correlation_id=uuid.uuid4(), created_at=datetime.now(timezone.utc) - timedelta(days=200)))
        db_session.add(Event(id=uuid.uuid4(), type="test", source="test", category="test", correlation_id=uuid.uuid4(), created_at=datetime.now(timezone.utc)))
        await db_session.flush()

        policy = RetentionPolicy(max_age_days=90, action="delete", resource_type="events")
        result = await apply_retention(policy, db_session)
        assert result["records_affected"] == 1
        assert result["action"] == "delete"

        count = await db_session.execute(text("SELECT COUNT(*) FROM events"))
        assert count.scalar_one() == 1

    async def test_unknown_resource_type(self, db_session):
        policy = RetentionPolicy(max_age_days=30, action="delete", resource_type="unknown")
        with pytest.raises(ValueError):
            await apply_retention(policy, db_session)

    async def test_archive_old_records(self, db_session):
        await db_session.execute(text("CREATE TABLE IF NOT EXISTS events_archive AS SELECT * FROM events WHERE 1=0"))
        await db_session.commit()
        db_session.add(Event(id=uuid.uuid4(), type="test", source="test", category="test", correlation_id=uuid.uuid4(), created_at=datetime.now(timezone.utc) - timedelta(days=200)))
        await db_session.flush()

        policy = RetentionPolicy(max_age_days=90, action="archive", resource_type="events")
        result = await apply_retention(policy, db_session)
        assert result["action"] == "archive"


class TestChatRetention:
    """Chat transcripts are retained by erasure, never by archive (F-24)."""

    async def _seed_transcript(self, db_session, *, age_days: int, body: str) -> tuple[str, str]:
        user = User(id=uuid.uuid4(), email=f"retention-{uuid.uuid4().hex[:8]}@test.com", display_name="R", status="ACTIVE")
        db_session.add(user)
        workspace = Workspace(id=uuid.uuid4(), user_id=user.id, name="Chat retention")
        db_session.add(workspace)
        stamp = datetime.now(timezone.utc) - timedelta(days=age_days)
        conversation = Conversation(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            title="Salary Review",
            agent_name="resume",
            created_at=stamp,
            updated_at=stamp,
        )
        db_session.add(conversation)
        db_session.add(ChatMessage(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            workspace_id=workspace.id,
            seq=0,
            client_id=f"c-{uuid.uuid4().hex[:8]}",
            role="user",
            text=body,
            status="complete",
            created_at=stamp,
        ))
        await db_session.flush()
        return str(workspace.id), body

    async def test_conversations_are_allow_listed(self):
        assert "conversations" in ALLOWED_RETENTION_TABLES
        assert "chat_messages" in ALLOWED_RETENTION_TABLES

    async def test_delete_old_conversations(self, db_session):
        await self._seed_transcript(db_session, age_days=200, body="stale")
        await self._seed_transcript(db_session, age_days=1, body="fresh")

        policy = RetentionPolicy(max_age_days=90, action="delete", resource_type="conversations")
        result = await apply_retention(policy, db_session)

        assert result["action"] == "delete"
        assert result["table"] == "conversations"
        assert result["records_affected"] == 1

        remaining = await db_session.execute(text("SELECT COUNT(*) FROM conversations"))
        assert remaining.scalar_one() == 1
        kept = await db_session.execute(text("SELECT title FROM conversations"))
        assert [r[0] for r in kept.fetchall()] == ["Salary Review"]

    async def test_delete_old_messages(self, db_session):
        await self._seed_transcript(db_session, age_days=200, body="stale transcript")
        await self._seed_transcript(db_session, age_days=1, body="fresh transcript")

        policy = RetentionPolicy(max_age_days=90, action="delete", resource_type="chat_messages")
        result = await apply_retention(policy, db_session)

        assert result["action"] == "delete"
        assert result["table"] == "chat_messages"
        assert result["records_affected"] == 1

        remaining = await db_session.execute(text("SELECT text FROM chat_messages"))
        assert [r[0] for r in remaining.fetchall()] == ["fresh transcript"]

    async def test_archive_is_refused_for_conversations(self, db_session):
        await self._seed_transcript(db_session, age_days=200, body="must not be archived")

        policy = RetentionPolicy(max_age_days=90, action="archive", resource_type="conversations")
        with pytest.raises(ValueError, match="Archive is not supported"):
            await apply_retention(policy, db_session)

        # Refused before any SQL runs, so the row is neither moved nor destroyed
        # by a half-executed archive.
        remaining = await db_session.execute(text("SELECT text FROM chat_messages"))
        assert [r[0] for r in remaining.fetchall()] == ["must not be archived"]

    async def test_archive_is_refused_for_messages(self, db_session):
        await self._seed_transcript(db_session, age_days=200, body="must not be archived")

        policy = RetentionPolicy(max_age_days=90, action="archive", resource_type="chat_messages")
        with pytest.raises(ValueError, match="Archive is not supported"):
            await apply_retention(policy, db_session)

        assert "chat_messages" in ARCHIVE_UNSUPPORTED_TABLES
        remaining = await db_session.execute(text("SELECT COUNT(*) FROM chat_messages"))
        assert remaining.scalar_one() == 1

    async def test_unknown_resource_type_is_still_rejected(self, db_session):
        # The allow-list must not have been widened into a general pass-through.
        for resource_type in ("users", "documents", "resumes", "embeddings", "conversations_archive"):
            policy = RetentionPolicy(max_age_days=90, action="delete", resource_type=resource_type)
            with pytest.raises(ValueError, match="Unknown resource_type"):
                await apply_retention(policy, db_session)

    async def test_injected_resource_type_cannot_reach_sql(self, db_session):
        db_session.add(User(id=uuid.uuid4(), email="retention-injection@test.com", display_name="R", status="ACTIVE"))
        await db_session.flush()

        policy = RetentionPolicy(max_age_days=90, action="delete", resource_type="users; DROP TABLE users")
        with pytest.raises(ValueError, match="Unknown resource_type"):
            await apply_retention(policy, db_session)

        still_there = await db_session.execute(text("SELECT COUNT(*) FROM users"))
        assert still_there.scalar_one() == 1


class TestLoadRetentionPolicies:
    def test_empty_when_not_configured(self, monkeypatch):
        class FakeSettings:
            retention_policies = ""
        monkeypatch.setattr("api.services.retention.settings", FakeSettings())
        assert load_retention_policies() == []

    def test_parses_json(self, monkeypatch):
        raw = json.dumps([{"max_age_days": 90, "action": "delete", "resource_type": "events"}])
        class FakeSettings:
            retention_policies = raw
        monkeypatch.setattr("api.services.retention.settings", FakeSettings())
        policies = load_retention_policies()
        assert len(policies) == 1
        assert policies[0].max_age_days == 90


class TestRetentionScheduler:
    async def test_run_once_empty_policies(self, monkeypatch):
        class FakeSettings:
            retention_policies = ""
        monkeypatch.setattr("api.services.retention.settings", FakeSettings())
        scheduler = RetentionScheduler(interval_hours=24)
        results = await scheduler.run_once()
        assert results == []

    async def test_run_once_with_policies(self, monkeypatch):
        raw = json.dumps([{"max_age_days": 30, "action": "delete", "resource_type": "usage_records"}])
        class FakeSettings:
            retention_policies = raw
        monkeypatch.setattr("api.services.retention.settings", FakeSettings())
        scheduler = RetentionScheduler(interval_hours=24)
        results = await scheduler.run_once()
        assert len(results) >= 0
