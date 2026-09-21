"""Test Suite: Module 05 Tool System & Security (M05-TOOL).
Verifies MCP-shaped document tools, argument validation, multi-tenant IDOR defense, and quarantine blocking.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from api.tools.definitions import ALL_TOOLS, GET_DOCUMENT_CONTENT
from api.tools.executor import execute_tool, PermissionDeniedError


def test_document_tool_declarations():
    """Verify all required enterprise document tools are defined and registered."""
    assert "search_documents" in ALL_TOOLS
    assert "get_document_content" in ALL_TOOLS
    assert "list_workspace_folders" in ALL_TOOLS
    assert "create_workspace_folder" in ALL_TOOLS
    assert "get_document_version" in ALL_TOOLS
    assert "restore_document_version" in ALL_TOOLS
    assert "share_workspace_document" in ALL_TOOLS
    assert "get_document_audit_history" in ALL_TOOLS


@pytest.mark.asyncio
async def test_document_tools_workspace_boundary_enforcement():
    """Verify execute_tool enforces workspace_id requirement and blocks parameter tampering."""
    ws_id = str(uuid.uuid4())
    attacker_ws = str(uuid.uuid4())

    # Missing workspace_id must raise ValueError
    with pytest.raises(ValueError) as exc:
        await execute_tool(
            tool=GET_DOCUMENT_CONTENT,
            params={"document_id": str(uuid.uuid4())},
            agent_id="doc_agent",
            agent_scopes=["memory.read"],
            workspace_id="",
        )
    assert "workspace_id is required" in str(exc.value)

    # Cross-workspace parameter tampering must raise PermissionDeniedError
    with pytest.raises(PermissionDeniedError) as exc:
        await execute_tool(
            tool=GET_DOCUMENT_CONTENT,
            params={"document_id": str(uuid.uuid4()), "workspace_id": attacker_ws},
            agent_id="doc_agent",
            agent_scopes=["memory.read"],
            workspace_id=ws_id,
        )
    assert "Cross-workspace tool execution prohibited" in str(exc.value)
