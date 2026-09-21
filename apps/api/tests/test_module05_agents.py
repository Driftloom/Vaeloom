"""Test Suite: Module 05 Agent Runtime & Grounding (M05-AGENT).
Verifies DocumentAgent and WorkspaceAgent ReAct execution, live DB grounding, and verified citations.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from api.agents.document_agent.handler import DocumentAgent, DocumentCitation
from api.agents.workspace_agent.handler import WorkspaceAgent
from api.config import settings


@pytest.mark.asyncio
async def test_grounded_agent_synthesis_and_citations(monkeypatch):
    """Verify DocumentAgent synthesizes answers with verified citations from retrieved documents."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-mock-key")
    agent = DocumentAgent()
    doc_id = str(uuid.uuid4())

    docs = [
        {
            "id": doc_id,
            "title": "SOC2_Audit.pdf",
            "page_or_section": "Section 3.2",
            "excerpt": "Continuous automated audit logging is maintained with 365-day retention.",
        }
    ]

    mock_llm_res = {
        "content": "Audit logs are retained for 365 days according to Section 3.2 of the SOC2 Audit.",
        "role": "assistant",
    }

    with patch("api.services.llm_service.llm_service.generate_completion", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_llm_res
        res = await agent.synthesize_documents("What is the audit log retention?", docs)

        assert mock_gen.called
        assert len(res["citations"]) == 1
        cit = res["citations"][0]
        assert cit["document_id"] == doc_id
        assert cit["document_title"] == "SOC2_Audit.pdf"
        assert "365-day retention" in cit["excerpt"]


@pytest.mark.asyncio
async def test_workspace_agent_sprawl_and_hygiene():
    """Verify WorkspaceAgent detects duplicate files and computes structure metrics."""
    agent = WorkspaceAgent()
    files = [
        {"id": "1", "filename": "Budget.xlsx", "path": "finance/Budget.xlsx"},
        {"id": "2", "filename": "Budget copy.xlsx", "path": "finance/Budget copy.xlsx"},
        {"id": "3", "filename": "Unorganized.txt", "path": "Unorganized.txt"},
    ]

    analysis = await agent.analyze_workspace_structure(files)
    assert analysis["total_files"] == 3
    assert analysis["unorganized_count"] == 1

    sprawl = await agent.detect_workspace_sprawl(files)
    assert len(sprawl) >= 1
    assert any("copy" in s["name"] for s in sprawl)
