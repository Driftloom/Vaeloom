import json
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from api.services.audit_service import AuditService

pytestmark = pytest.mark.asyncio


@pytest.fixture
def svc():
    return AuditService()


def make_row(event_id="evt-1", actor_id="user-1", action="test_action",
             resource="test", resource_id="r-1", tenant_id="t-1",
             metadata=None, created_at=None):
    if created_at is None:
        created_at = datetime.now(timezone.utc)
    return (event_id, actor_id, action, resource, resource_id, tenant_id,
            metadata, created_at)


class TestRecordEvent:
    async def test_record_event_basic(self, svc):
        db = MagicMock()
        calls = []

        async def execute(sql, params=None):
            calls.append((sql, params))

        db.execute = execute
        event_id = await svc.record_event(
            actor_id="user-1", action="create", resource="doc",
            resource_id="doc-1", tenant_id="t-1", metadata=None, db=db,
        )
        assert uuid.UUID(event_id)
        assert len(calls) == 1
        assert calls[0][1]["actor_id"] == "user-1"
        assert calls[0][1]["action"] == "create"
        assert calls[0][1]["metadata"] is None

    async def test_record_event_with_metadata(self, svc):
        db = MagicMock()
        calls = []

        async def execute(sql, params=None):
            calls.append((sql, params))

        db.execute = execute
        meta = {"ip": "10.0.0.1", "agent": "test"}
        event_id = await svc.record_event(
            actor_id="user-2", action="update", resource="config",
            resource_id="cfg-1", tenant_id="t-2", metadata=meta, db=db,
        )
        assert uuid.UUID(event_id)
        assert json.loads(calls[0][1]["metadata"]) == meta

    async def test_record_event_empty_metadata(self, svc):
        db = MagicMock()
        calls = []

        async def execute(sql, params=None):
            calls.append((sql, params))

        db.execute = execute
        event_id = await svc.record_event(
            actor_id="user-3", action="delete", resource="file",
            resource_id=None, tenant_id=None, metadata={"k": "v"}, db=db,
        )
        assert uuid.UUID(event_id)
        assert json.loads(calls[0][1]["metadata"]) == {"k": "v"}


class TestQueryEvents:
    async def test_no_filters(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 2
        rows_result = MagicMock()
        dt = datetime.now(timezone.utc)
        rows_result.fetchall.return_value = [
            make_row("e1", metadata='{"k":"v"}', created_at=dt),
            make_row("e2", metadata=None, created_at=dt),
        ]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        items, total = await svc.query_events(page=1, page_size=10, filters={}, db=db)
        assert total == 2
        assert len(items) == 2
        assert items[0]["metadata"] == {"k": "v"}
        assert items[1]["metadata"] == {}
        assert items[0]["created_at"] == dt.isoformat()

    async def test_all_filters(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1
        rows_result = MagicMock()
        dt = datetime.now(timezone.utc)
        rows_result.fetchall.return_value = [
            make_row("e1", actor_id="alice", action="login", resource="auth",
                     resource_id=None, tenant_id="acme",
                     metadata='{"origin":"web"}', created_at=dt),
        ]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        filters = {
            "actor_id": "alice", "action": "login", "resource": "auth",
            "tenant_id": "acme", "date_from": "2024-01-01", "date_to": "2024-12-31",
        }
        items, total = await svc.query_events(page=1, page_size=10, filters=filters, db=db)
        assert total == 1
        assert items[0]["actor_id"] == "alice"
        assert items[0]["metadata"] == {"origin": "web"}

    async def test_filter_actor_id(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1
        rows_result = MagicMock()
        rows_result.fetchall.return_value = [make_row("e1", actor_id="bob")]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        items, total = await svc.query_events(
            page=1, page_size=10, filters={"actor_id": "bob"}, db=db,
        )
        assert total == 1
        assert items[0]["actor_id"] == "bob"

    async def test_filter_date_range(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 0
        db = MagicMock()

        async def execute(sql, params=None):
            return count_result

        db.execute = execute
        items, total = await svc.query_events(
            page=1, page_size=10,
            filters={"date_from": "2024-01-01", "date_to": "2024-06-30"},
            db=db,
        )
        assert total == 0
        assert items == []

    async def test_metadata_invalid_json(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1
        rows_result = MagicMock()
        rows_result.fetchall.return_value = [make_row("e1", metadata="{invalid}")]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        items, total = await svc.query_events(page=1, page_size=10, filters={}, db=db)
        assert items[0]["metadata"] == {}

    async def test_metadata_type_error(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 1
        rows_result = MagicMock()
        rows_result.fetchall.return_value = [make_row("e1", metadata=123)]
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        items, total = await svc.query_events(page=1, page_size=10, filters={}, db=db)
        assert items[0]["metadata"] == 123


class TestGetEvent:
    async def test_get_event_found(self, svc):
        result = MagicMock()
        dt = datetime.now(timezone.utc)
        result.fetchone.return_value = make_row("e1", metadata='{"key":"val"}', created_at=dt)
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        event = await svc.get_event("e1", db=db)
        assert event is not None
        assert event["id"] == "e1"
        assert event["metadata"] == {"key": "val"}
        assert event["created_at"] == dt.isoformat()

    async def test_get_event_not_found(self, svc):
        result = MagicMock()
        result.fetchone.return_value = None
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        event = await svc.get_event("nonexistent", db=db)
        assert event is None

    async def test_get_event_metadata_not_string(self, svc):
        result = MagicMock()
        result.fetchone.return_value = make_row("e1", metadata={"key": "val"})
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        event = await svc.get_event("e1", db=db)
        assert event["metadata"] == {"key": "val"}

    async def test_get_event_metadata_json_decode_error(self, svc):
        result = MagicMock()
        result.fetchone.return_value = make_row("e1", metadata="not-valid-json")
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        event = await svc.get_event("e1", db=db)
        assert event["metadata"] == {}

    async def test_get_event_created_at_not_datetime(self, svc):
        result = MagicMock()
        result.fetchone.return_value = make_row("e1", created_at="2024-06-01T00:00:00")
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        event = await svc.get_event("e1", db=db)
        assert event["created_at"] == "2024-06-01T00:00:00"


class TestExportEvents:
    async def test_export_json_no_filters(self, svc):
        result = MagicMock()
        dt = datetime.now(timezone.utc)
        result.fetchall.return_value = [make_row("e1", metadata='{"m":1}', created_at=dt)]
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        output = await svc.export_events(None, None, "json", None, db=db)
        data = json.loads(output)
        assert len(data) == 1
        assert data[0]["metadata"] == {"m": 1}

    async def test_export_json_metadata_decode_error(self, svc):
        result = MagicMock()
        dt = datetime.now(timezone.utc)
        result.fetchall.return_value = [
            make_row("e1", metadata="bad-json", created_at=dt),
        ]
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        output = await svc.export_events(None, None, "json", None, db=db)
        data = json.loads(output)
        assert data[0]["metadata"] == {}

    async def test_export_csv(self, svc):
        result = MagicMock()
        dt = datetime.now(timezone.utc)
        result.fetchall.return_value = [
            make_row("e1", metadata='{"m":1}', created_at=dt),
            make_row("e2", metadata=None, created_at=dt),
        ]
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        output = await svc.export_events(None, None, "csv", None, db=db)
        assert "actor_id" in output
        assert "e1" in output
        assert "e2" in output

    async def test_export_csv_no_data(self, svc):
        result = MagicMock()
        result.fetchall.return_value = []
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        output = await svc.export_events(None, None, "csv", None, db=db)
        assert output == ""

    async def test_export_with_tenant_and_date(self, svc):
        result = MagicMock()
        result.fetchall.return_value = [
            make_row("e1", tenant_id="acme", created_at=datetime.now(timezone.utc)),
        ]
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        output = await svc.export_events("2024-01-01", "2024-12-31", "json", "acme", db=db)
        data = json.loads(output)
        assert len(data) == 1

    async def test_export_json_no_data(self, svc):
        result = MagicMock()
        result.fetchall.return_value = []
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        output = await svc.export_events(None, None, "json", None, db=db)
        assert json.loads(output) == []


class TestComplianceReport:
    async def test_compliance_report_with_filters(self, svc):
        action_result = MagicMock()
        action_result.fetchall.return_value = [("create", 5), ("delete", 2)]
        resource_result = MagicMock()
        resource_result.fetchall.return_value = [("doc", 4), ("config", 3)]
        count_result = MagicMock()
        count_result.scalar_one.return_value = 7
        db = MagicMock()

        async def execute(sql, params=None):
            t = sql.text if hasattr(sql, "text") else str(sql)
            if "GROUP BY action" in t:
                return action_result
            if "GROUP BY resource" in t:
                return resource_result
            return count_result

        db.execute = execute
        report = await svc.compliance_report("acme", "2024-01-01", "2024-12-31", db=db)
        assert report["total"] == 7
        assert len(report["by_action"]) == 2
        assert len(report["by_resource"]) == 2
        assert "generated_at" in report

    async def test_compliance_report_no_filters(self, svc):
        action_result = MagicMock()
        action_result.fetchall.return_value = []
        resource_result = MagicMock()
        resource_result.fetchall.return_value = []
        count_result = MagicMock()
        count_result.scalar_one.return_value = 0
        db = MagicMock()

        async def execute(sql, params=None):
            t = sql.text if hasattr(sql, "text") else str(sql)
            if "GROUP BY action" in t:
                return action_result
            if "GROUP BY resource" in t:
                return resource_result
            return count_result

        db.execute = execute
        report = await svc.compliance_report(None, None, None, db=db)
        assert report["total"] == 0
        assert report["by_action"] == []
        assert report["by_resource"] == []
