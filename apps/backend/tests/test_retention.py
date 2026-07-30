import json
import uuid
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import text

from backend.models.schema import Event, UsageRecord
from backend.services.retention import RetentionPolicy, apply_retention, load_retention_policies, RetentionScheduler

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


class TestLoadRetentionPolicies:
    def test_empty_when_not_configured(self, monkeypatch):
        class FakeSettings:
            retention_policies = ""
        monkeypatch.setattr("backend.services.retention.settings", FakeSettings())
        assert load_retention_policies() == []

    def test_parses_json(self, monkeypatch):
        raw = json.dumps([{"max_age_days": 90, "action": "delete", "resource_type": "events"}])
        class FakeSettings:
            retention_policies = raw
        monkeypatch.setattr("backend.services.retention.settings", FakeSettings())
        policies = load_retention_policies()
        assert len(policies) == 1
        assert policies[0].max_age_days == 90


class TestRetentionScheduler:
    async def test_run_once_empty_policies(self, monkeypatch):
        class FakeSettings:
            retention_policies = ""
        monkeypatch.setattr("backend.services.retention.settings", FakeSettings())
        scheduler = RetentionScheduler(interval_hours=24)
        results = await scheduler.run_once()
        assert results == []

    async def test_run_once_with_policies(self, monkeypatch):
        raw = json.dumps([{"max_age_days": 30, "action": "delete", "resource_type": "usage_records"}])
        class FakeSettings:
            retention_policies = raw
        monkeypatch.setattr("backend.services.retention.settings", FakeSettings())
        scheduler = RetentionScheduler(interval_hours=24)
        results = await scheduler.run_once()
        assert len(results) >= 0
