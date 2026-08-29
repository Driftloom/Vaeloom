"""Comprehensive tests for backend/tools/executor.py."""
import asyncio
import datetime
import logging
import uuid

import pytest

from api.tools.definitions import ToolDefinition
from api.tools.executor import (
    CATEGORY_RETRIES,
    TOOL_DISPATCH,
    PermissionDeniedError,
    ToolExecutionError,
    _audit_log,
    _execute_categorize_document,
    _execute_create_calendar_event,
    _execute_create_entity,
    _execute_draft_email,
    _execute_get_entity,
    _execute_list_calendar_events,
    _execute_merge_entities,
    _execute_mock,
    _execute_move_file,
    _execute_notify_user,
    _execute_query_graph,
    _execute_rename_file,
    _execute_search_documents,
    _execute_search_gmail,
    _execute_search_jobs,
    check_permission,
    execute_tool,
)

# ── Mock model helpers ──────────────────────────────────────────────

WS_ID = str(uuid.uuid4())
ENTITY_ID = uuid.uuid4()
DOC_ID = uuid.uuid4()
REL_ID = uuid.uuid4()


class MockDoc:
    def __init__(self, id=DOC_ID, path="/docs/report.pdf", type="pdf",
                 summary="Annual report", created_at=None, metadata_=None,
                 workspace_id=None):
        self.id = id
        self.path = path
        self.type = type
        self.summary = summary
        self.created_at = created_at or datetime.datetime.now(datetime.timezone.utc)
        self.metadata_ = metadata_ or {}
        self.workspace_id = workspace_id or uuid.UUID(WS_ID)


class MockEntity:
    def __init__(self, id=ENTITY_ID, workspace_id=None, type="person",
                 canonical_name="Alice", aliases=None, metadata_=None,
                 created_at=None):
        self.id = id
        self.workspace_id = workspace_id or uuid.UUID(WS_ID)
        self.type = type
        self.canonical_name = canonical_name
        self.aliases = aliases or []
        self.metadata_ = metadata_ or {}
        self.created_at = created_at or datetime.datetime.now(datetime.timezone.utc)


class MockRel:
    def __init__(self, id=REL_ID, from_entity_id=ENTITY_ID, to_entity_id=ENTITY_ID,
                 relation_type="knows", confidence=1.0):
        self.id = id
        self.from_entity_id = from_entity_id
        self.to_entity_id = to_entity_id
        self.relation_type = relation_type
        self.confidence = confidence


class MockScalarResult:
    def __init__(self, items=None):
        self._items = items or []

    def scalars(self):
        return self

    def all(self):
        return self._items

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None


class MockAsyncSession:
    def __init__(self):
        self.execute_return = []
        self.get_return = None
        self.added = []
        self.committed = False
        self.refreshed = []
        self.deleted = None
        self._commit_exc = None
        self._execute_side_effect = None

    def set_commit_exception(self, exc):
        self._commit_exc = exc

    async def execute(self, stmt):
        if self._execute_side_effect:
            return await self._execute_side_effect(stmt)
        return MockScalarResult(self.execute_return)

    async def get(self, model, id_):
        return self.get_return

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        if self._commit_exc:
            raise self._commit_exc
        self.committed = True

    async def refresh(self, obj):
        self.refreshed.append(obj)

    async def delete(self, obj):
        self.deleted = obj

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


# ── 1. Permission checks ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_check_permission_exact_match():
    assert await check_permission(["memory.read"], "memory.read") is True


@pytest.mark.asyncio
async def test_check_permission_wildcard_match():
    assert await check_permission(["memory.*"], "memory.read") is True
    assert await check_permission(["connector.*"], "connector.gmail.read") is True


@pytest.mark.asyncio
async def test_check_permission_no_match():
    assert await check_permission(["memory.read"], "connector.read") is False


@pytest.mark.asyncio
async def test_check_permission_empty_scopes():
    assert await check_permission([], "memory.read") is False


# ── 2. _execute_search_documents ──────────────────────────────────

@pytest.mark.asyncio
async def test_execute_search_documents_success(monkeypatch):
    session = MockAsyncSession()
    session.execute_return = [MockDoc()]
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_search_documents({"query": "report", "limit": 5}, WS_ID)
    assert result["status"] == "success"
    assert result["tool"] == "search_documents"
    assert len(result["result"]) == 1
    assert result["result"][0]["id"] == str(DOC_ID)
    assert result["result"][0]["path"] == "/docs/report.pdf"


@pytest.mark.asyncio
async def test_execute_search_documents_import_error(monkeypatch):
    import api.database
    monkeypatch.delattr("api.database.async_session_factory")
    result = await _execute_search_documents({"query": "x"}, WS_ID)
    assert result["status"] == "error"
    assert "DB imports unavailable" in result["result"]


# ── 3. _execute_query_graph ───────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_query_graph_success(monkeypatch):
    session = MockAsyncSession()
    entity = MockEntity()
    rel = MockRel()
    session.execute_return = [entity]

    call_log = []

    async def side_effect(stmt):
        call_log.append(type(stmt).__name__)
        if len(call_log) == 1:
            return MockScalarResult([entity])
        return MockScalarResult([rel])

    session._execute_side_effect = side_effect

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_query_graph({"query": "Alice", "entity_type": "person", "limit": 10}, WS_ID)
    assert result["status"] == "success"
    assert result["tool"] == "query_graph"
    assert len(result["result"]) == 1
    assert result["result"][0]["name"] == "Alice"
    assert len(result["result"][0]["relationships"]) == 1
    assert result["result"][0]["relationships"][0]["relation_type"] == "knows"


@pytest.mark.asyncio
async def test_execute_query_graph_import_error(monkeypatch):
    import api.database
    monkeypatch.delattr("api.database.async_session_factory")
    result = await _execute_query_graph({"query": "x"}, WS_ID)
    assert result["status"] == "error"
    assert "DB imports unavailable" in result["result"]


# ── 4. _execute_get_entity ────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_get_entity_found(monkeypatch):
    session = MockAsyncSession()
    entity = MockEntity()
    rel = MockRel()
    session.get_return = entity

    call_log = []

    async def side_effect(stmt):
        call_log.append(1)
        return MockScalarResult([rel])

    session._execute_side_effect = side_effect
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_get_entity({"entity_id": str(ENTITY_ID)}, WS_ID)
    assert result["status"] == "success"
    assert result["result"]["name"] == "Alice"
    assert len(result["result"]["relationships"]) == 1


@pytest.mark.asyncio
async def test_execute_get_entity_not_found(monkeypatch):
    session = MockAsyncSession()
    session.get_return = None
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_get_entity({"entity_id": str(uuid.uuid4())}, WS_ID)
    assert result["status"] == "error"
    assert "not found" in result["result"]


# ── 5. _execute_create_entity ─────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_create_entity_success(monkeypatch):
    session = MockAsyncSession()
    session.execute_return = []

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_create_entity(
        {"name": "Bob", "entity_type": "person", "properties": {"aliases": ["Bobby"], "metadata": {"age": 30}}},
        WS_ID,
    )
    assert result["status"] == "success"
    assert result["result"]["name"] == "Bob"
    assert result["result"]["type"] == "person"
    assert len(session.added) == 1
    assert session.committed


@pytest.mark.asyncio
async def test_execute_create_entity_duplicate(monkeypatch):
    session = MockAsyncSession()
    session.execute_return = [MockEntity()]

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_create_entity({"name": "Alice", "entity_type": "person"}, WS_ID)
    assert result["status"] == "error"
    assert "already exists" in result["result"]


@pytest.mark.asyncio
async def test_execute_create_entity_missing_params():
    result = await _execute_create_entity({"name": "", "entity_type": ""}, WS_ID)
    assert result["status"] == "error"
    assert "name and entity_type are required" in result["result"]


# ── 6. _execute_categorize_document ────────────────────────────────

@pytest.mark.asyncio
async def test_execute_categorize_document_success(monkeypatch):
    session = MockAsyncSession()
    doc = MockDoc(metadata_={"old": "val"})
    session.get_return = doc

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_categorize_document(
        {"document_id": str(DOC_ID), "category": "finance", "folder": "/finance"}, WS_ID,
    )
    assert result["status"] == "success"
    assert result["result"]["category"] == "finance"
    assert result["result"]["folder"] == "/finance"
    assert doc.metadata_["category"] == "finance"
    assert doc.metadata_["folder"] == "/finance"
    assert doc.metadata_["old"] == "val"
    assert session.committed


@pytest.mark.asyncio
async def test_execute_categorize_document_not_found(monkeypatch):
    session = MockAsyncSession()
    session.get_return = None

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_categorize_document({"document_id": str(uuid.uuid4()), "category": "x"}, WS_ID)
    assert result["status"] == "error"
    assert "not found" in result["result"]


# ── 7. _execute_notify_user ───────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_notify_user_db_success(monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    session = MockAsyncSession()

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_notify_user({"message": "Hello", "priority": "high"}, WS_ID)
    assert result["status"] == "success"
    assert result["result"]["delivered"] is True
    assert "action_id" in result["result"]
    assert len(session.added) == 1
    assert session.committed
    assert "NOTIFICATION" in caplog.text


@pytest.mark.asyncio
async def test_execute_notify_user_import_fallback(monkeypatch):
    import api.database
    monkeypatch.delattr("api.database.async_session_factory")

    result = await _execute_notify_user({"message": "Hi"}, WS_ID)
    assert result["status"] == "success"
    assert result["result"]["logged_to"] == "stdout"


@pytest.mark.asyncio
async def test_execute_notify_user_db_exception_fallback(monkeypatch):
    session = MockAsyncSession()
    session.set_commit_exception(RuntimeError("DB down"))

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_notify_user({"message": "Hi"}, WS_ID)
    assert result["status"] == "success"
    assert result["result"]["logged_to"] == "stdout"


# ── 8. _execute_merge_entities ────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_merge_entities_success(monkeypatch):
    session = MockAsyncSession()
    source = MockEntity(id=uuid.uuid4(), canonical_name="Bob", aliases=["Bobby"], metadata_={"a": 1})
    target = MockEntity(id=uuid.uuid4(), canonical_name="Robert", aliases=["Rob"], metadata_={"b": 2})
    session.get_return = target

    call_log = []

    async def side_effect(stmt):
        call_log.append(1)
        return MockScalarResult([])

    session._execute_side_effect = side_effect

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    # Need to make the first get call return source, second return target
    get_count = [0]
    orig_get = session.get

    async def get_side_effect(model, id_):
        get_count[0] += 1
        if get_count[0] == 1:
            return source
        return target

    session.get = get_side_effect

    result = await _execute_merge_entities(
        {"source_id": str(source.id), "target_id": str(target.id)}, WS_ID,
    )
    assert result["status"] == "success"
    assert result["result"]["merged_into_id"] == str(target.id)
    assert result["result"]["source_id_removed"] == str(source.id)
    assert session.deleted is source
    # Second commit should happen if aliases/metadata changed
    assert session.committed


@pytest.mark.asyncio
async def test_execute_merge_entities_missing_params(monkeypatch):
    result = await _execute_merge_entities({"source_id": "", "target_id": ""}, WS_ID)
    assert result["status"] == "error"
    assert "source_id and target_id are required" in result["result"]


@pytest.mark.asyncio
async def test_execute_merge_entities_same_ids(monkeypatch):
    id_ = str(uuid.uuid4())
    result = await _execute_merge_entities({"source_id": id_, "target_id": id_}, WS_ID)
    assert result["status"] == "error"
    assert "must be different" in result["result"]


@pytest.mark.asyncio
async def test_execute_merge_entities_source_not_found(monkeypatch):
    session = MockAsyncSession()
    session.get_return = None
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_merge_entities(
        {"source_id": str(uuid.uuid4()), "target_id": str(uuid.uuid4())}, WS_ID,
    )
    assert result["status"] == "error"
    assert "not found" in result["result"]


# ── 9. _execute_search_gmail ──────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_search_gmail_success(monkeypatch):
    emails = [{"id": "1", "subject": "Hello", "sender": "a@b.com", "body": "Hi"}]

    class MockGmail:
        async def fetch_emails(self, query="", max_results=20):
            return emails

    monkeypatch.setattr("api.clients.gmail_client.GmailClient", MockGmail)

    result = await _execute_search_gmail({"query": "hello", "max_results": 10}, WS_ID)
    assert result["status"] == "success"
    assert len(result["result"]) == 1
    assert result["result"][0]["subject"] == "Hello"


@pytest.mark.asyncio
async def test_execute_search_gmail_mock_fallback(monkeypatch):
    class MockGmail:
        async def fetch_emails(self, query="", max_results=20):
            return None

    monkeypatch.setattr("api.clients.gmail_client.GmailClient", MockGmail)

    result = await _execute_search_gmail({"query": "hello", "max_results": 5}, WS_ID)
    assert result["status"] == "success"
    assert "mock_" in result["result"][0]["id"]
    assert "unavailable" in result.get("note", "")


# ── 10. _execute_search_jobs ─────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_search_jobs_with_keyword_list(monkeypatch):
    jobs = [{"title": "Engineer", "company": "Acme", "location": "Remote"}]

    class MockClient:
        async def search_jobs(self, keywords=None, location=None):
            return jobs

    monkeypatch.setattr("api.clients.job_board_client.JobBoardClient", MockClient)

    result = await _execute_search_jobs({"keywords": ["engineer"], "limit": 10}, WS_ID)
    assert result["status"] == "success"
    assert result["count"] == 1


@pytest.mark.asyncio
async def test_execute_search_jobs_with_string_keywords(monkeypatch):
    jobs = [{"title": "Engineer", "company": "Acme", "location": "Remote"}]

    class MockClient:
        async def search_jobs(self, keywords=None, location=None):
            return jobs

    monkeypatch.setattr("api.clients.job_board_client.JobBoardClient", MockClient)

    result = await _execute_search_jobs({"keywords": "engineer remote python", "limit": 10}, WS_ID)
    assert result["status"] == "success"


@pytest.mark.asyncio
async def test_execute_search_jobs_missing_keywords():
    result = await _execute_search_jobs({"keywords": ""}, WS_ID)
    assert result["status"] == "error"
    assert "keywords are required" in result["result"]


@pytest.mark.asyncio
async def test_execute_search_jobs_remote_ok_filters_non_remote(monkeypatch):
    class MockClient:
        async def search_jobs(self, keywords=None, location=None):
            return [
                {"title": "Engineer", "company": "Acme", "location": "Remote"},
                {"title": "Janitor", "company": "CleanCo", "location": "New York"},
            ]

    monkeypatch.setattr("api.clients.job_board_client.JobBoardClient", MockClient)

    result = await _execute_search_jobs({"keywords": ["engineer"], "remote_ok": True, "limit": 20}, WS_ID)
    assert result["status"] == "success"
    # First job matches "remote" in location, kept; second doesn't match so it's filtered out
    # Filter keeps non-empty list (one item), no fallback, so count=1
    assert result["count"] == 1


@pytest.mark.asyncio
async def test_execute_search_jobs_remote_ok_only_remote_match(monkeypatch):
    class MockClient:
        async def search_jobs(self, keywords=None, location=None):
            return [
                {"title": "Remote Engineer", "company": "Acme", "location": "Anywhere"},
                {"title": "Onsite", "company": "Corp", "location": "NYC"},
            ]

    monkeypatch.setattr("api.clients.job_board_client.JobBoardClient", MockClient)

    result = await _execute_search_jobs({"keywords": ["engineer"], "remote_ok": True, "limit": 20}, WS_ID)
    assert result["status"] == "success"
    # First matches "remote" in title, kept; second doesn't match so filtered out
    # Filter result (one item) is non-empty, no fallback, so count=1
    assert result["count"] == 1


# ── 11. _execute_list_calendar_events ─────────────────────────────

@pytest.mark.asyncio
async def test_execute_list_calendar_events_success(monkeypatch):
    events = [{"id": "evt1", "title": "Meeting", "start_time": "2025-01-01T09:00:00Z",
               "end_time": "2025-01-01T10:00:00Z", "source": "calendar"}]

    class MockClient:
        async def list_events(self, time_min=None, time_max=None, max_results=50):
            return events

    monkeypatch.setattr("api.clients.calendar_client.CalendarClient", MockClient)

    result = await _execute_list_calendar_events(
        {"start_date": "2025-01-01T00:00:00Z", "end_date": "2025-01-02T00:00:00Z"}, WS_ID,
    )
    assert result["status"] == "success"
    assert result["count"] == 1


@pytest.mark.asyncio
async def test_execute_list_calendar_events_mock_fallback(monkeypatch):
    class MockClient:
        async def list_events(self, time_min=None, time_max=None, max_results=50):
            return None

    monkeypatch.setattr("api.clients.calendar_client.CalendarClient", MockClient)

    result = await _execute_list_calendar_events({"start_date": "", "end_date": ""}, WS_ID)
    assert result["status"] == "success"
    assert "mock_" in result["result"][0]["id"]


# ── 12. _execute_rename_file ─────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_rename_file_success(monkeypatch):
    session = MockAsyncSession()
    doc = MockDoc(path="/docs/report.pdf")
    session.get_return = doc

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_rename_file({"document_id": str(DOC_ID), "new_name": "new_report.pdf"}, WS_ID)
    assert result["status"] == "success"
    assert result["result"]["new_path"] == "/docs/new_report.pdf"
    assert result["result"]["old_path"] == "/docs/report.pdf"
    assert session.committed


@pytest.mark.asyncio
async def test_execute_rename_file_not_found(monkeypatch):
    session = MockAsyncSession()
    session.get_return = None

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_rename_file({"document_id": str(uuid.uuid4()), "new_name": "x"}, WS_ID)
    assert result["status"] == "error"
    assert "not found" in result["result"]


@pytest.mark.asyncio
async def test_execute_rename_file_missing_params():
    result = await _execute_rename_file({"document_id": "", "new_name": ""}, WS_ID)
    assert result["status"] == "error"
    assert "document_id and new_name are required" in result["result"]


# ── 13. _execute_move_file ───────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_move_file_success(monkeypatch):
    session = MockAsyncSession()
    doc = MockDoc(path="/docs/report.pdf", metadata_={"existing": "val"})
    session.get_return = doc

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_move_file({"document_id": str(DOC_ID), "target_folder": "/archive"}, WS_ID)
    assert result["status"] == "success"
    assert "/archive/report.pdf" in result["result"]["new_path"]
    assert result["result"]["target_folder"] == "/archive"
    assert doc.metadata_["folder"] == "/archive"
    assert doc.metadata_["previous_path"] == "/docs/report.pdf"
    assert doc.metadata_["existing"] == "val"
    assert doc.path == "/archive/report.pdf"
    assert session.committed


@pytest.mark.asyncio
async def test_execute_move_file_not_found(monkeypatch):
    session = MockAsyncSession()
    session.get_return = None

    monkeypatch.setattr("api.database.async_session_factory", lambda: session)

    result = await _execute_move_file({"document_id": str(uuid.uuid4()), "target_folder": "/x"}, WS_ID)
    assert result["status"] == "error"
    assert "not found" in result["result"]


# ── 14. _execute_draft_email ──────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_draft_email_success(monkeypatch):
    class MockClient:
        async def create_draft(self, to="", subject="", body=""):
            return {"id": "draft_123"}

    monkeypatch.setattr("api.clients.gmail_client.GmailClient", MockClient)

    result = await _execute_draft_email(
        {"to": "a@b.com", "subject": "Hi", "body": "Hello", "reply_to_id": "msg_1"}, WS_ID,
    )
    assert result["status"] == "success"
    assert result["result"]["draft_id"] == "draft_123"
    assert result["result"]["status"] == "draft_created"


@pytest.mark.asyncio
async def test_execute_draft_email_mock_fallback(monkeypatch):
    class MockClient:
        async def create_draft(self, to="", subject="", body=""):
            return None

    monkeypatch.setattr("api.clients.gmail_client.GmailClient", MockClient)

    result = await _execute_draft_email({"to": "a@b.com", "subject": "Hi", "body": "Hello"}, WS_ID)
    assert result["status"] == "not_configured"
    assert result["result"] == "Gmail connector not configured"


@pytest.mark.asyncio
async def test_execute_draft_email_missing_params():
    result = await _execute_draft_email({"to": "", "subject": "", "body": ""}, WS_ID)
    assert result["status"] == "error"
    assert "to, subject, and body are required" in result["result"]


# ── 15. _execute_create_calendar_event ────────────────────────────

@pytest.mark.asyncio
async def test_execute_create_calendar_event_success(monkeypatch):
    class MockClient:
        async def create_event(self, summary="", start_time="", end_time="", description=""):
            return {"id": "evt_123"}

    monkeypatch.setattr("api.clients.calendar_client.CalendarClient", MockClient)

    result = await _execute_create_calendar_event(
        {"title": "Standup", "start_time": "2025-01-01T09:00:00Z",
         "end_time": "2025-01-01T09:30:00Z", "description": "Daily standup"}, WS_ID,
    )
    assert result["status"] == "success"
    assert result["result"]["event_id"] == "evt_123"
    assert result["result"]["status"] == "event_created"


@pytest.mark.asyncio
async def test_execute_create_calendar_event_mock_fallback(monkeypatch):
    class MockClient:
        async def create_event(self, summary="", start_time="", end_time="", description=""):
            return None

    monkeypatch.setattr("api.clients.calendar_client.CalendarClient", MockClient)

    result = await _execute_create_calendar_event(
        {"title": "Standup", "start_time": "2025-01-01T09:00:00Z"}, WS_ID,
    )
    assert result["status"] == "not_configured"
    assert result["result"] == "Calendar connector not configured"


@pytest.mark.asyncio
async def test_execute_create_calendar_event_missing_params():
    result = await _execute_create_calendar_event({"title": "", "start_time": ""}, WS_ID)
    assert result["status"] == "error"
    assert "title and start_time are required" in result["result"]


# ── 16. _execute_mock ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_mock():
    tool = ToolDefinition(
        name="unknown_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="system",
    )
    result = await _execute_mock(tool, {"a": 1, "b": 2})
    assert result["status"] == "success"
    assert result["tool"] == "unknown_tool"
    assert "a" in result["params_received"]
    assert "b" in result["params_received"]


# ── 17. execute_tool() ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_tool_success(monkeypatch):
    async def mock_check(*a): return True
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
    monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

    # Use a mock handler (avoid real DB access)
    async def mock_handler(params, ws_id):
        return {"status": "success", "tool": "test_tool", "result": "ok"}

    monkeypatch.setitem(TOOL_DISPATCH, "test_tool", mock_handler)

    tool = ToolDefinition(
        name="test_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="system",
    )

    result = await execute_tool(tool, {"query": "test"}, "agent-1", ["x"], WS_ID)
    assert result["status"] == "success"
    assert result["result"] == "ok"


@pytest.mark.asyncio
async def test_execute_tool_permission_denied(monkeypatch):
    async def mock_check(*a): return False
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
    monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

    tool = ToolDefinition(
        name="search_documents", description="", input_schema={}, output_schema={},
        required_scope="admin.access", category="memory_read",
    )
    with pytest.raises(PermissionDeniedError):
        await execute_tool(tool, {}, "agent-1", ["user.access"], WS_ID)


@pytest.mark.asyncio
async def test_execute_tool_unknown_tool_fallback(monkeypatch):
    async def mock_check(*a): return True
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
    monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

    # Monkeypatch _execute_mock so it matches (params, ws_id) dispatch signature
    async def mock_fallback(params, ws_id):
        return {
            "status": "success",
            "tool": "nonexistent_tool",
            "result": "Mock result for nonexistent_tool",
            "params_received": list(params.keys()),
            "note": "Real implementation requires external connector or service",
        }

    monkeypatch.setattr("api.tools.executor._execute_mock", mock_fallback)

    tool = ToolDefinition(
        name="nonexistent_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="system",
    )
    result = await execute_tool(tool, {"x": 1}, "agent-1", ["x"], WS_ID)
    assert result["status"] == "success"
    assert result["note"] == "Real implementation requires external connector or service"
    assert "x" in result["params_received"]


@pytest.mark.asyncio
async def test_execute_tool_timeout_retry_then_fail(monkeypatch):
    async def mock_check(*a): return True
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
    monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

    call_count = [0]

    async def mock_wait_for(coro, timeout, **kw):
        call_count[0] += 1
        raise asyncio.TimeoutError("timed out")

    monkeypatch.setattr(asyncio, "wait_for", mock_wait_for)

    async def mock_handler(params, ws_id):
        return {"status": "success"}

    monkeypatch.setitem(TOOL_DISPATCH, "test_tool", mock_handler)

    tool = ToolDefinition(
        name="test_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="memory_read",
    )
    with pytest.raises(ToolExecutionError) as excinfo:
        await execute_tool(tool, {}, "agent-1", ["x"], WS_ID)
    assert "timed out" in str(excinfo.value)
    assert call_count[0] == CATEGORY_RETRIES["memory_read"]


@pytest.mark.asyncio
async def test_execute_tool_transient_failure_retry_then_fail(monkeypatch):
    async def mock_check(*a): return True
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
    monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

    call_count = [0]

    async def mock_wait_for(coro, timeout, **kw):
        call_count[0] += 1
        raise ValueError("service unavailable")

    monkeypatch.setattr(asyncio, "wait_for", mock_wait_for)

    async def mock_handler(params, ws_id):
        return {"status": "success"}

    monkeypatch.setitem(TOOL_DISPATCH, "test_tool", mock_handler)

    tool = ToolDefinition(
        name="test_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="memory_read",
    )
    with pytest.raises(ToolExecutionError) as excinfo:
        await execute_tool(tool, {}, "agent-1", ["x"], WS_ID)
    assert "service unavailable" in str(excinfo.value)
    assert call_count[0] == CATEGORY_RETRIES["memory_read"]


@pytest.mark.asyncio
async def test_execute_tool_non_retryable_error_permission_msg(monkeypatch):
    async def mock_check(*a): return True
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
    monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

    call_count = [0]

    async def mock_wait_for(coro, timeout, **kw):
        call_count[0] += 1
        raise ValueError("permission denied for resource")

    monkeypatch.setattr(asyncio, "wait_for", mock_wait_for)

    async def mock_handler(params, ws_id):
        return {"status": "success"}

    monkeypatch.setitem(TOOL_DISPATCH, "test_tool", mock_handler)

    tool = ToolDefinition(
        name="test_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="memory_read",
    )
    with pytest.raises(ToolExecutionError) as excinfo:
        await execute_tool(tool, {}, "agent-1", ["x"], WS_ID)
    assert "permission" in str(excinfo.value).lower()
    assert call_count[0] == 1


@pytest.mark.asyncio
async def test_execute_tool_non_retryable_error_input_msg(monkeypatch):
    async def mock_check(*a): return True
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
    monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

    call_count = [0]

    async def mock_wait_for(coro, timeout, **kw):
        call_count[0] += 1
        raise ValueError("invalid input parameters")

    monkeypatch.setattr(asyncio, "wait_for", mock_wait_for)

    async def mock_handler(params, ws_id):
        return {"status": "success"}

    monkeypatch.setitem(TOOL_DISPATCH, "test_tool", mock_handler)

    tool = ToolDefinition(
        name="test_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="memory_read",
    )
    with pytest.raises(ToolExecutionError) as excinfo:
        await execute_tool(tool, {}, "agent-1", ["x"], WS_ID)
    assert "input" in str(excinfo.value).lower()
    assert call_count[0] == 1


@pytest.mark.asyncio
async def test_execute_tool_audit_log_on_success(monkeypatch):
    async def mock_check(*a): return True
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)

    audit_entries = []

    def fake_audit(agent_id, tool_name, workspace_id, success, duration_ms, error):
        audit_entries.append((agent_id, tool_name, workspace_id, success, duration_ms, error))

    monkeypatch.setattr("api.tools.executor._audit_log", fake_audit)

    async def mock_handler(params, ws_id):
        return {"status": "success", "result": "ok"}

    monkeypatch.setitem(TOOL_DISPATCH, "audit_test_tool", mock_handler)

    tool = ToolDefinition(
        name="audit_test_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="system",
    )

    await execute_tool(tool, {"msg": "hi"}, "agent-1", ["x"], WS_ID)
    assert len(audit_entries) >= 1
    entry = audit_entries[0]
    assert entry[0] == "agent-1"
    assert entry[1] == "audit_test_tool"
    assert entry[3] is True
    assert entry[5] is None


@pytest.mark.asyncio
async def test_execute_tool_audit_log_on_failure(monkeypatch):
    async def mock_check(*a): return True
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)

    audit_entries = []

    def fake_audit(agent_id, tool_name, workspace_id, success, duration_ms, error):
        audit_entries.append((agent_id, tool_name, workspace_id, success, duration_ms, error))

    monkeypatch.setattr("api.tools.executor._audit_log", fake_audit)

    async def mock_wait_for(coro, timeout, **kw):
        raise ValueError("crash")

    monkeypatch.setattr(asyncio, "wait_for", mock_wait_for)

    async def mock_handler(params, ws_id):
        return {"status": "success"}

    monkeypatch.setitem(TOOL_DISPATCH, "test_tool", mock_handler)

    tool = ToolDefinition(
        name="test_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="memory_read",
    )
    with pytest.raises(ToolExecutionError):
        await execute_tool(tool, {}, "agent-1", ["x"], WS_ID)

    assert len(audit_entries) >= 1
    failure_entry = audit_entries[-1]
    assert failure_entry[3] is False
    assert failure_entry[5] is not None


# ── 18. _audit_log ─────────────────────────────────────────────────

def test_audit_log_logs(caplog):
    caplog.set_level(logging.INFO)
    _audit_log("agent-1", "test_tool", "ws-1", True, 42, None)
    assert "AUDIT:" in caplog.text
    assert "agent-1" in caplog.text
    assert "test_tool" in caplog.text
    assert "42" in caplog.text


def test_audit_log_with_error(caplog):
    caplog.set_level(logging.INFO)
    _audit_log("agent-2", "error_tool", "ws-2", False, 100, "something broke")
    assert "error_tool" in caplog.text
    assert "something broke" in caplog.text


# ── 19. TOOL_DISPATCH sanity ──────────────────────────────────────

# ── 20. get_tools_for_agent ────────────────────────────────────────

def test_get_tools_for_agent_returns_matching_tools():
    from api.tools.definitions import get_tools_for_agent, ALL_TOOLS
    tools = get_tools_for_agent(["search_documents", "notify_user"])
    assert len(tools) == 2
    assert tools[0].name == "search_documents"
    assert tools[1].name == "notify_user"


def test_get_tools_for_agent_skips_unknown():
    from api.tools.definitions import get_tools_for_agent
    tools = get_tools_for_agent(["nonexistent_tool", "search_documents"])
    assert len(tools) == 1
    assert tools[0].name == "search_documents"


def test_get_tools_for_agent_empty_list():
    from api.tools.definitions import get_tools_for_agent
    tools = get_tools_for_agent([])
    assert tools == []


# ── 21. Import error paths for all DB-based tools ───────────────────

@pytest.mark.asyncio
async def test_execute_search_documents_import_error_exception(monkeypatch):
    session = MockAsyncSession()

    async def raise_error(stmt):
        raise RuntimeError("query failed")

    session._execute_side_effect = raise_error
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    result = await _execute_search_documents({"query": "x", "limit": 5}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_query_graph_exception(monkeypatch):
    session = MockAsyncSession()

    async def raise_error(stmt):
        raise RuntimeError("query failed")

    session._execute_side_effect = raise_error
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    result = await _execute_query_graph({"query": "test", "limit": 5}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_get_entity_import_error(monkeypatch):
    import api.database
    monkeypatch.delattr("api.database.async_session_factory")
    result = await _execute_get_entity({"entity_id": str(uuid.uuid4())}, WS_ID)
    assert result["status"] == "error"
    assert "DB imports unavailable" in result["result"]


@pytest.mark.asyncio
async def test_execute_get_entity_exception(monkeypatch):
    session = MockAsyncSession()
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    result = await _execute_get_entity({"entity_id": "not-a-uuid"}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_create_entity_import_error(monkeypatch):
    import api.database
    monkeypatch.delattr("api.database.async_session_factory")
    result = await _execute_create_entity({"name": "test", "entity_type": "person"}, WS_ID)
    assert result["status"] == "error"
    assert "DB imports unavailable" in result["result"]


@pytest.mark.asyncio
async def test_execute_create_entity_exception(monkeypatch):
    session = MockAsyncSession()
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    session._execute_side_effect = lambda *a: (_ for _ in ()).throw(RuntimeError("db error"))
    result = await _execute_create_entity({"name": "test", "entity_type": "person"}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_categorize_document_import_error(monkeypatch):
    import api.database
    monkeypatch.delattr("api.database.async_session_factory")
    result = await _execute_categorize_document({"document_id": str(uuid.uuid4()), "category": "fin"}, WS_ID)
    assert result["status"] == "error"
    assert "DB imports unavailable" in result["result"]


@pytest.mark.asyncio
async def test_execute_categorize_document_exception(monkeypatch):
    session = MockAsyncSession()
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    result = await _execute_categorize_document({"document_id": "bad-id", "category": "fin"}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_merge_entities_import_error(monkeypatch):
    import api.database
    monkeypatch.delattr("api.database.async_session_factory")
    result = await _execute_merge_entities({"source_id": str(uuid.uuid4()), "target_id": str(uuid.uuid4())}, WS_ID)
    assert result["status"] == "error"
    assert "DB imports unavailable" in result["result"]


@pytest.mark.asyncio
async def test_execute_merge_entities_target_not_found(monkeypatch):
    session = MockAsyncSession()
    get_count = [0]
    async def get_side(model, id_):
        get_count[0] += 1
        if get_count[0] == 1:
            return MockEntity(id=uuid.uuid4())
        return None
    session.get = get_side
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    result = await _execute_merge_entities({"source_id": str(uuid.uuid4()), "target_id": str(uuid.uuid4())}, WS_ID)
    assert result["status"] == "error"
    assert "not found" in result["result"]


@pytest.mark.asyncio
async def test_execute_merge_entities_exception(monkeypatch):
    session = MockAsyncSession()
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    result = await _execute_merge_entities({"source_id": "bad1", "target_id": "bad2"}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_search_gmail_import_error(monkeypatch):
    import api.clients.gmail_client
    monkeypatch.delattr("api.clients.gmail_client.GmailClient")
    result = await _execute_search_gmail({"query": "test"}, WS_ID)
    assert result["status"] == "error"
    assert "Gmail client import failed" in str(result.get("result", ""))


@pytest.mark.asyncio
async def test_execute_search_gmail_with_after_date(monkeypatch):
    class MockGmail:
        async def fetch_emails(self, query="", max_results=20):
            return [{"id": "1", "subject": "Hi"}]
    monkeypatch.setattr("api.clients.gmail_client.GmailClient", MockGmail)
    result = await _execute_search_gmail({"query": "hello", "max_results": 10, "after_date": "2025-01-01"}, WS_ID)
    assert result["status"] == "success"


@pytest.mark.asyncio
async def test_execute_search_gmail_exception(monkeypatch):
    class MockGmail:
        async def fetch_emails(self, query="", max_results=20):
            raise RuntimeError("gmail error")
    monkeypatch.setattr("api.clients.gmail_client.GmailClient", MockGmail)
    result = await _execute_search_gmail({"query": "test"}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_search_jobs_import_error(monkeypatch):
    import api.clients.job_board_client
    monkeypatch.delattr("api.clients.job_board_client.JobBoardClient")
    result = await _execute_search_jobs({"keywords": ["test"]}, WS_ID)
    assert result["status"] == "error"
    assert "Job board client import failed" in str(result.get("result", ""))


@pytest.mark.asyncio
async def test_execute_search_jobs_none_result(monkeypatch):
    class MockClient:
        async def search_jobs(self, keywords=None, location=None):
            return None
    monkeypatch.setattr("api.clients.job_board_client.JobBoardClient", MockClient)
    result = await _execute_search_jobs({"keywords": ["engineer"], "limit": 5}, WS_ID)
    assert result["status"] == "success"
    assert "mock_" in result["result"][0]["id"]


@pytest.mark.asyncio
async def test_execute_search_jobs_exception(monkeypatch):
    class MockClient:
        async def search_jobs(self, keywords=None, location=None):
            raise RuntimeError("jobs error")
    monkeypatch.setattr("api.clients.job_board_client.JobBoardClient", MockClient)
    result = await _execute_search_jobs({"keywords": ["engineer"]}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_list_calendar_events_import_error(monkeypatch):
    import api.clients.calendar_client
    monkeypatch.delattr("api.clients.calendar_client.CalendarClient")
    result = await _execute_list_calendar_events({"start_date": "", "end_date": ""}, WS_ID)
    assert result["status"] == "error"
    assert "Calendar client import failed" in str(result.get("result", ""))


@pytest.mark.asyncio
async def test_execute_list_calendar_events_exception(monkeypatch):
    class MockClient:
        async def list_events(self, time_min=None, time_max=None, max_results=50):
            raise RuntimeError("cal error")
    monkeypatch.setattr("api.clients.calendar_client.CalendarClient", MockClient)
    result = await _execute_list_calendar_events({"start_date": "", "end_date": ""}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_rename_file_import_error(monkeypatch):
    import api.database
    monkeypatch.delattr("api.database.async_session_factory")
    result = await _execute_rename_file({"document_id": str(uuid.uuid4()), "new_name": "x"}, WS_ID)
    assert result["status"] == "error"
    assert "DB imports unavailable" in result["result"]


@pytest.mark.asyncio
async def test_execute_rename_file_root_level(monkeypatch):
    session = MockAsyncSession()
    doc = MockDoc(path="report.pdf")
    session.get_return = doc
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    result = await _execute_rename_file({"document_id": str(DOC_ID), "new_name": "new_report.pdf"}, WS_ID)
    assert result["status"] == "success"
    assert result["result"]["new_path"] == "new_report.pdf"


@pytest.mark.asyncio
async def test_execute_rename_file_exception(monkeypatch):
    session = MockAsyncSession()
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    result = await _execute_rename_file({"document_id": "bad-id", "new_name": "x"}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_move_file_missing_params():
    result = await _execute_move_file({"document_id": "", "target_folder": ""}, WS_ID)
    assert result["status"] == "error"
    assert "document_id and target_folder are required" in result["result"]


@pytest.mark.asyncio
async def test_execute_move_file_import_error(monkeypatch):
    import api.database
    monkeypatch.delattr("api.database.async_session_factory")
    result = await _execute_move_file({"document_id": str(uuid.uuid4()), "target_folder": "/x"}, WS_ID)
    assert result["status"] == "error"
    assert "DB imports unavailable" in result["result"]


@pytest.mark.asyncio
async def test_execute_move_file_exception(monkeypatch):
    session = MockAsyncSession()
    monkeypatch.setattr("api.database.async_session_factory", lambda: session)
    result = await _execute_move_file({"document_id": "bad-id", "target_folder": "/x"}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_draft_email_import_error(monkeypatch):
    import api.clients.gmail_client
    monkeypatch.delattr("api.clients.gmail_client.GmailClient")
    result = await _execute_draft_email({"to": "a@b.com", "subject": "Hi", "body": "Hello"}, WS_ID)
    assert result["status"] == "error"
    assert "Gmail client import failed" in str(result.get("result", ""))


@pytest.mark.asyncio
async def test_execute_draft_email_exception(monkeypatch):
    class MockClient:
        async def create_draft(self, to="", subject="", body=""):
            raise RuntimeError("draft error")
    monkeypatch.setattr("api.clients.gmail_client.GmailClient", MockClient)
    result = await _execute_draft_email({"to": "a@b.com", "subject": "Hi", "body": "Hello"}, WS_ID)
    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_execute_create_calendar_event_import_error(monkeypatch):
    import api.clients.calendar_client
    monkeypatch.delattr("api.clients.calendar_client.CalendarClient")
    result = await _execute_create_calendar_event({"title": "Event", "start_time": "2025-01-01T09:00:00Z"}, WS_ID)
    assert result["status"] == "error"
    assert "Calendar client import failed" in str(result.get("result", ""))


@pytest.mark.asyncio
async def test_execute_create_calendar_event_exception(monkeypatch):
    class MockClient:
        async def create_event(self, summary="", start_time="", end_time="", description=""):
            raise RuntimeError("create error")
    monkeypatch.setattr("api.clients.calendar_client.CalendarClient", MockClient)
    result = await _execute_create_calendar_event({"title": "Event", "start_time": "2025-01-01T09:00:00Z"}, WS_ID)
    assert result["status"] == "error"


# ── 22. execute_tool PermissionDeniedError re-raise ─────────────────

@pytest.mark.asyncio
async def test_execute_tool_permission_denied_during_exec(monkeypatch):
    async def mock_check(*a): return True
    monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
    monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

    call_count = [0]

    async def mock_wait_for(coro, timeout, **kw):
        call_count[0] += 1
        raise PermissionDeniedError("denied inside handler")

    monkeypatch.setattr(asyncio, "wait_for", mock_wait_for)

    async def mock_handler(params, ws_id):
        return {"status": "success"}

    monkeypatch.setitem(TOOL_DISPATCH, "pd_test_tool", mock_handler)

    tool = ToolDefinition(
        name="pd_test_tool", description="", input_schema={}, output_schema={},
        required_scope="x", category="memory_read",
    )
    with pytest.raises(PermissionDeniedError):
        await execute_tool(tool, {}, "agent-1", ["x"], WS_ID)
    assert call_count[0] == 1


def test_tool_dispatch_has_known_tools():
    assert "search_documents" in TOOL_DISPATCH
    assert "notify_user" in TOOL_DISPATCH
    assert "query_graph" in TOOL_DISPATCH
    assert "create_entity" in TOOL_DISPATCH
    assert "get_entity" in TOOL_DISPATCH
    assert "draft_email" in TOOL_DISPATCH
    assert "search_gmail" in TOOL_DISPATCH
    assert "search_jobs" in TOOL_DISPATCH
    assert "list_calendar_events" in TOOL_DISPATCH
    assert "rename_file" in TOOL_DISPATCH
    assert "move_file" in TOOL_DISPATCH
    assert "create_calendar_event" in TOOL_DISPATCH
    assert "merge_entities" in TOOL_DISPATCH
    assert "categorize_document" in TOOL_DISPATCH
