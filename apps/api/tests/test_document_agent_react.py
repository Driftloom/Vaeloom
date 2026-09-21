"""Tests for DocumentAgent ReAct reasoning, synthesis, and citation extraction.

Verifies that DocumentAgent operates against live document schemas, declares
real tools, invokes LLM completion, and produces grounded citations.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from api.agents.document_agent.handler import DocumentAgent, DocumentCitation
from api.config import settings


@pytest.mark.asyncio
async def test_document_agent_tool_declarations():
    """Verify DocumentAgent declares real MCP-shaped tools."""
    agent = DocumentAgent()
    declared_names = [t.name for t in agent.tools]
    assert "search_documents" in declared_names
    assert "get_document_content" in declared_names
    assert "query_graph" in declared_names
    assert "get_document_version" in declared_names
    assert agent.default_autonomy == "read_only"


@pytest.mark.asyncio
async def test_document_agent_grounded_synthesis_with_llm(monkeypatch):
    """Verify DocumentAgent invokes LLM service and extracts grounded citations."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-key")
    agent = DocumentAgent()

    doc_id = str(uuid.uuid4())
    documents = [
        {
            "id": doc_id,
            "title": "Q3_Strategic_Plan.pdf",
            "page_or_section": "Section 4.1",
            "excerpt": "Total revenue grew 34% YoY driven by enterprise agent adoptions.",
        }
    ]

    mock_llm_resp = {
        "content": "Enterprise agent adoptions drove a 34% YoY revenue growth in Q3.",
        "role": "assistant",
        "usage": {"input_tokens": 120, "output_tokens": 25},
    }

    with patch("api.services.llm_service.llm_service.generate_completion", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_llm_resp

        synth = await agent.synthesize_documents(
            query="What drove Q3 revenue growth?",
            documents=documents,
        )

        assert mock_gen.called
        assert "34% YoY" in synth["synthesis"]
        assert len(synth["citations"]) == 1

        cit = synth["citations"][0]
        assert cit["document_id"] == doc_id
        assert cit["document_title"] == "Q3_Strategic_Plan.pdf"
        assert "34% YoY" in cit["excerpt"]


@pytest.mark.asyncio
async def test_document_agent_process_flow(monkeypatch):
    """Verify full process() execution with live request object."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-key")
    agent = DocumentAgent()

    ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())

    doc_row = type("Doc", (), {
        "id": uuid.UUID(doc_id),
        "workspace_id": uuid.UUID(ws_id),
        "path": "policies/security_handbook.pdf",
        "summary": "Mandates multi-factor authentication and zero-trust network access.",
        "deleted_at": None,
    })()

    class MockAsyncSession:
        async def execute(self, stmt):
            class Res:
                def scalars(self):
                    return self
                def all(self):
                    return [doc_row]
            return Res()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    with patch("api.database.async_session_factory", return_value=MockAsyncSession()):
        request = {
            "message": "What are our security requirements?",
            "workspace_id": ws_id,
        }
        res = await agent.process(request)

        assert res["agent_name"] == "document"
        assert res["action"] == "suggest"
        assert res["confidence"] >= 0.90
        assert len(res["result"]["proposals"]) == 1
        assert res["result"]["proposals"][0]["document_id"] == doc_id
        assert "security_handbook.pdf" in res["result"]["proposals"][0]["title"]


@pytest.mark.asyncio
async def test_document_agent_fallback_on_empty():
    """Verify DocumentAgent returns structured guidance when workspace has no files."""
    agent = DocumentAgent()
    fallback = await agent.fallback()
    assert fallback["action"] == "ask_clarification"
    assert len(fallback["result"]["questions"]) >= 1
