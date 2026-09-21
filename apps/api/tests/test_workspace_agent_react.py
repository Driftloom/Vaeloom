"""Tests for WorkspaceAgent ReAct reasoning, structural analysis, sprawl detection, and multi-tenant isolation.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from api.agents.workspace_agent.handler import WorkspaceAgent, WorkspaceCleanupProposal


@pytest.mark.asyncio
async def test_workspace_agent_metadata_and_tools():
    """Verify WorkspaceAgent declares proper tools and autonomy profile."""
    agent = WorkspaceAgent()
    assert agent.default_autonomy == "suggest"
    tool_names = [t.name for t in agent.tools]
    assert "list_workspace_folders" in tool_names
    assert "create_workspace_folder" in tool_names
    assert "search_documents" in tool_names
    assert "rename_file" in tool_names
    assert "move_file" in tool_names


@pytest.mark.asyncio
async def test_workspace_agent_structure_analysis():
    """Verify folder distribution and hygiene score computation."""
    agent = WorkspaceAgent()
    files = [
        {"id": "1", "path": "docs/architecture/spec.pdf"},
        {"id": "2", "path": "docs/architecture/adr.md"},
        {"id": "3", "path": "marketing/flyer.png"},
        {"id": "4", "path": "unfiled_notes.txt"},
        {"id": "5", "path": "scratch.md"},
    ]

    analysis = await agent.analyze_workspace_structure(files)
    assert analysis["total_files"] == 5
    assert analysis["folder_distribution"]["docs"] == 2
    assert analysis["folder_distribution"]["marketing"] == 1
    assert analysis["folder_distribution"]["root"] == 2
    assert analysis["unorganized_count"] == 2
    assert 0.0 <= analysis["hygiene_score"] <= 1.0


@pytest.mark.asyncio
async def test_workspace_agent_sprawl_detection():
    """Verify sprawl detector flags duplicate filenames and copy artifacts."""
    agent = WorkspaceAgent()
    files = [
        {"id": "1", "filename": "Annual_Report.pdf", "path": "finance/Annual_Report.pdf"},
        {"id": "2", "filename": "Annual_Report copy.pdf", "path": "finance/Annual_Report copy.pdf"},
        {"id": "3", "filename": "Deck (1).pptx", "path": "pitch/Deck (1).pptx"},
        {"id": "4", "filename": "roadmap v2.docx", "path": "product/roadmap v2.docx"},
        {"id": "5", "filename": "annual_report.pdf", "path": "backup/annual_report.pdf"},
    ]

    sprawl = await agent.detect_workspace_sprawl(files)
    assert len(sprawl) >= 4

    copy_sprawl = [s for s in sprawl if "copy" in s["name"]]
    assert len(copy_sprawl) == 1
    assert copy_sprawl[0]["severity"] == "medium"

    dup_sprawl = [s for s in sprawl if "Identical filename detected" in s.get("issue", "")]
    assert len(dup_sprawl) >= 1
    assert dup_sprawl[0]["severity"] == "high"


@pytest.mark.asyncio
async def test_workspace_agent_empty_workspace():
    """Verify agent handles empty workspace cleanly."""
    agent = WorkspaceAgent()
    res = await agent.process({"workspace_id": str(uuid.uuid4())})
    assert res["agent_name"] == "workspace"
    assert res["action"] == "suggest"
    assert "clean and empty" in res["result"]["summary"].lower()


@pytest.mark.asyncio
async def test_workspace_agent_process_with_db_grounding():
    """Verify process() grounds into live database session and proposes cleanups."""
    agent = WorkspaceAgent()
    ws_id = str(uuid.uuid4())

    doc1 = type("Doc", (), {
        "id": uuid.uuid4(),
        "workspace_id": uuid.UUID(ws_id),
        "path": "reports/Q3_Budget.xlsx",
        "deleted_at": None,
    })()
    doc2 = type("Doc", (), {
        "id": uuid.uuid4(),
        "workspace_id": uuid.UUID(ws_id),
        "path": "reports/Q3_Budget copy.xlsx",
        "deleted_at": None,
    })()

    class MockAsyncSession:
        async def execute(self, stmt):
            class Res:
                def scalars(self):
                    return self
                def all(self):
                    return [doc1, doc2]
            return Res()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    with patch("api.database.async_session_factory", return_value=MockAsyncSession()):
        res = await agent.process({"workspace_id": ws_id})
        assert res["agent_name"] == "workspace"
        assert res["action"] == "suggest"
        result = res["result"]
        assert "2 files analyzed" in result["summary"]
        assert len(result["proposals"]) >= 1
        assert result["proposals"][0]["action"] == "archive"
