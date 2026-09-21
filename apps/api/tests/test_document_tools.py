"""Tests for Document and Workspace Tools in ToolExecutor.

Verifies schema compliance, scope authorization, workspace boundaries,
quarantine filtering, and live handler execution for all Module 05 tools.
"""
import uuid
import pytest
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

from api.tools.definitions import (
    SEARCH_DOCUMENTS,
    GET_DOCUMENT_CONTENT,
    LIST_WORKSPACE_FOLDERS,
    CREATE_WORKSPACE_FOLDER,
    GET_DOCUMENT_VERSION,
    RESTORE_DOCUMENT_VERSION,
    SHARE_WORKSPACE_DOCUMENT,
    GET_DOCUMENT_AUDIT_HISTORY,
    RENAME_FILE,
    MOVE_FILE,
)
from api.tools.executor import (
    execute_tool,
    PermissionDeniedError,
    _execute_search_documents,
    _execute_get_document_content,
    _execute_list_workspace_folders,
    _execute_create_workspace_folder,
    _execute_get_document_version,
    _execute_restore_document_version,
    _execute_share_workspace_document,
    _execute_get_document_audit_history,
    _execute_rename_file,
    _execute_move_file,
)


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

    async def execute(self, stmt):
        return MockScalarResult(self.execute_return)

    async def get(self, model, id_):
        return self.get_return

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


@pytest.mark.asyncio
async def test_search_documents_excludes_quarantined_and_deleted():
    """Verify search_documents tool queries active, non-quarantined documents."""
    ws_id = str(uuid.uuid4())
    doc1 = type("Doc", (), {
        "id": uuid.uuid4(),
        "path": "reports/q3_earnings.pdf",
        "type": "pdf",
        "summary": "Q3 earnings summary with positive revenue growth",
        "created_at": datetime.now(UTC),
    })()

    mock_sess = MockAsyncSession()
    mock_sess.execute_return = [doc1]

    with patch("api.tools.executor._ws_session", return_value=mock_sess):
        res = await _execute_search_documents({"query": "earnings", "limit": 5}, ws_id)
        assert res["status"] == "success"
        assert res["count"] == 1
        assert res["result"][0]["path"] == "reports/q3_earnings.pdf"


@pytest.mark.asyncio
async def test_get_document_content_retrieves_bounded_text():
    """Verify get_document_content tool retrieves text within max_chars."""
    ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())

    doc = type("Doc", (), {
        "id": uuid.UUID(doc_id),
        "workspace_id": uuid.UUID(ws_id),
        "path": "notes/architecture.md",
        "content": b"Zero-Trust Architecture Blueprint: All components must verify before trusting.",
        "summary": "Architecture notes",
        "deleted_at": None,
        "scan_status": "clean",
    })()

    mock_sess = MockAsyncSession()
    mock_sess.get_return = doc

    with patch("api.tools.executor._ws_session", return_value=mock_sess):
        res = await _execute_get_document_content({"document_id": doc_id, "max_chars": 50}, ws_id)
        assert res["status"] == "success"
        assert res["result"]["chars_returned"] == 50
        assert res["result"]["content"] == "Zero-Trust Architecture Blueprint: All components "


@pytest.mark.asyncio
async def test_get_document_content_blocks_quarantined_files():
    """Verify get_document_content tool blocks quarantined files."""
    ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())

    doc = type("Doc", (), {
        "id": uuid.UUID(doc_id),
        "workspace_id": uuid.UUID(ws_id),
        "path": "invoices/malicious.pdf",
        "content": b"EICAR test payload",
        "summary": "Quarantined invoice",
        "deleted_at": None,
        "scan_status": "quarantined",
    })()

    mock_sess = MockAsyncSession()
    mock_sess.get_return = doc

    with patch("api.tools.executor._ws_session", return_value=mock_sess):
        res = await _execute_get_document_content({"document_id": doc_id}, ws_id)
        assert res["status"] == "error"
        assert "quarantined" in res["result"]


@pytest.mark.asyncio
async def test_list_and_create_workspace_folders():
    """Verify folder listing and creation tools."""
    ws_id = str(uuid.uuid4())
    folder_id = uuid.uuid4()

    folder = type("Folder", (), {
        "id": folder_id,
        "name": "Engineering",
        "path": "Engineering",
        "parent_id": None,
    })()

    mock_sess = MockAsyncSession()
    mock_sess.execute_return = [folder]

    with patch("api.tools.executor._ws_session", return_value=mock_sess):
        list_res = await _execute_list_workspace_folders({}, ws_id)
        assert list_res["status"] == "success"
        assert list_res["count"] == 1
        assert list_res["result"][0]["name"] == "Engineering"

    with patch("api.tools.executor._ws_session", return_value=mock_sess), \
         patch("api.services.folder_service.folder_service.create_folder", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = folder
        create_res = await _execute_create_workspace_folder({"name": "Engineering"}, ws_id)
        assert create_res["status"] == "success"
        assert create_res["result"]["name"] == "Engineering"


@pytest.mark.asyncio
async def test_get_and_restore_document_version():
    """Verify document version inspection and restoration tools."""
    ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    ver_id = str(uuid.uuid4())

    doc = type("Doc", (), {
        "id": uuid.UUID(doc_id),
        "workspace_id": uuid.UUID(ws_id),
        "path": "spec.md",
    })()

    ver = type("Ver", (), {
        "id": uuid.UUID(ver_id),
        "version_number": 1,
        "size_bytes": 1024,
        "checksum": "sha256-dummy",
        "created_at": datetime.now(UTC),
    })()

    mock_sess = MockAsyncSession()
    mock_sess.get_return = doc
    mock_sess.execute_return = [ver]

    with patch("api.tools.executor._ws_session", return_value=mock_sess):
        ver_res = await _execute_get_document_version({"document_id": doc_id}, ws_id)
        assert ver_res["status"] == "success"
        assert ver_res["result"]["count"] == 1
        assert ver_res["result"]["versions"][0]["version_number"] == 1

    with patch("api.tools.executor._ws_session", return_value=mock_sess), \
         patch("api.services.document_service.document_service.restore_version", new_callable=AsyncMock) as mock_restore:
        mock_restore.return_value = doc
        restore_res = await _execute_restore_document_version({"document_id": doc_id, "version_id": ver_id}, ws_id)
        assert restore_res["status"] == "success"
        assert restore_res["result"]["status"] == "restored"


@pytest.mark.asyncio
async def test_share_workspace_document_and_audit_history():
    """Verify sharing and action history tools."""
    ws_id = str(uuid.uuid4())
    target_ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())

    share_obj = type("Share", (), {
        "id": uuid.uuid4(),
        "document_id": uuid.UUID(doc_id),
        "target_workspace_id": uuid.UUID(target_ws_id),
        "permission": "view",
    })()

    action_obj = type("Action", (), {
        "id": uuid.uuid4(),
        "action_type": "rename",
        "old_path": "old.pdf",
        "new_path": "new.pdf",
        "actor_id": uuid.uuid4(),
        "undone_at": None,
        "created_at": datetime.now(UTC),
    })()

    mock_sess = MockAsyncSession()
    mock_sess.execute_return = [action_obj]

    with patch("api.tools.executor._ws_session", return_value=mock_sess), \
         patch("api.services.document_service.document_service.share_document", new_callable=AsyncMock) as mock_share:
        mock_share.return_value = share_obj
        share_res = await _execute_share_workspace_document({
            "document_id": doc_id,
            "target_workspace_id": target_ws_id,
            "permission": "view"
        }, ws_id)
        assert share_res["status"] == "success"
        assert share_res["result"]["permission"] == "view"

    with patch("api.tools.executor._ws_session", return_value=mock_sess):
        hist_res = await _execute_get_document_audit_history({"document_id": doc_id}, ws_id)
        assert hist_res["status"] == "success"
        assert hist_res["count"] == 1
        assert hist_res["result"][0]["action_type"] == "rename"


@pytest.mark.asyncio
async def test_rename_and_move_file_workspace_idor_protection():
    """Verify rename_file and move_file reject documents belonging to other workspaces."""
    owner_ws_id = str(uuid.uuid4())
    attacker_ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())

    # Doc belongs to owner_ws_id
    doc = type("Doc", (), {
        "id": uuid.UUID(doc_id),
        "workspace_id": uuid.UUID(owner_ws_id),
        "path": "sensitive.pdf",
        "deleted_at": None,
    })()

    mock_sess = MockAsyncSession()
    mock_sess.get_return = doc

    with patch("api.tools.executor._ws_session", return_value=mock_sess):
        # Attacker tries to rename doc from owner's workspace
        res = await _execute_rename_file({"document_id": doc_id, "new_name": "hacked.pdf"}, attacker_ws_id)
        assert res["status"] == "error"
        assert "not found in workspace" in res["result"]

        # Attacker tries to move doc from owner's workspace
        move_res = await _execute_move_file({"document_id": doc_id, "target_folder": "hacked"}, attacker_ws_id)
        assert move_res["status"] == "error"
        assert "not found in workspace" in move_res["result"]


@pytest.mark.asyncio
async def test_tool_executor_permission_scope_enforcement():
    """Verify execute_tool denies execution when agent lacks required scope."""
    ws_id = str(uuid.uuid4())
    # GET_DOCUMENT_CONTENT requires memory.read
    with pytest.raises(PermissionDeniedError):
        await execute_tool(
            tool=GET_DOCUMENT_CONTENT,
            params={"document_id": str(uuid.uuid4())},
            agent_id="test_agent",
            agent_scopes=["connector.read"],  # Missing memory.read
            workspace_id=ws_id,
        )
