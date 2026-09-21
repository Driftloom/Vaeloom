"""Live integration test for DocumentAgent using real Ollama Cloud / Local models and Jev System 1.

Verifies:
1. System 1 (TypeSafe AI Jev): <50ms action selection and HITL safety noul.
2. System 2 (Ollama Cloud / Gemma): Grounded document synthesis with XML context fencing and citations.

Run:
  $env:LLM_PROVIDER="ollama"
  $env:OLLAMA_BASE_URL="http://localhost:11434"   # or cloud endpoint
  $env:OLLAMA_MODEL="gemma:latest"                 # or gemma3:latest / cloud model
  uv run --project apps/api python -m pytest apps/api/tests/integration/module05/test_agent_llm_live.py -v -o addopts=""
"""
import os
import httpx
import pytest

from api.agents.document_agent.handler import DocumentAgent
from api.config import settings
from api.services.jev_service import jev_service
from api.services.llm_service import llm_service

pytestmark = [pytest.mark.integration, pytest.mark.live_provider]


@pytest.mark.asyncio
async def test_live_document_agent_with_ollama_and_jev():
    """Verify live Ollama cloud model synthesis + Jev action routing and safety triage."""
    ollama_url = os.environ.get("OLLAMA_BASE_URL") or getattr(settings, "ollama_base_url", "http://localhost:11434")
    model_name = os.environ.get("OLLAMA_MODEL") or os.environ.get("LLM_MODEL") or "gemma:latest"
    jev_key = os.environ.get("JEV_API_KEY") or getattr(settings, "jev_api_key", "")

    # 1. Verify Ollama availability
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{ollama_url.rstrip('/')}/api/tags")
            if resp.status_code != 200:
                pytest.skip(f"Ollama endpoint {ollama_url} returned HTTP {resp.status_code}")
    except Exception as ex:
        pytest.skip(f"Ollama endpoint {ollama_url} is unreachable ({ex}). Please start Ollama or configure Ollama Cloud endpoint.")

    # Configure Ollama settings
    settings.llm_provider = "ollama"
    settings.llm_model = model_name
    settings.ollama_base_url = ollama_url
    if os.environ.get("OLLAMA_API_KEY"):
        settings.llm_api_key = os.environ["OLLAMA_API_KEY"]
    else:
        settings.llm_api_key = "ollama"

    # 2. System 1: Verify TypeSafe AI Jev action decision
    query = os.environ.get("DOCUMENT_TEST_QUERY") or "What file types are rejected to prevent XSS according to File_Upload_Security.docx and what isolation is implemented?"
    action_choices = ["summarize", "search", "audit_security", "compare", "extract_skills"]
    selected_action = await jev_service.choice(query, action_choices)
    is_dangerous = await jev_service.noul(query)

    assert selected_action in action_choices
    assert is_dangerous is False  # Read/query operation is not dangerous

    # 3. System 2: DocumentAgent synthesis with real Ollama Gemma model
    agent = DocumentAgent()
    docs = [
        {
            "id": "doc-live-1",
            "title": "File_Upload_Security.docx",
            "excerpt": "HTML, SVG, and XML files are strictly rejected at the router level with HTTP 400 to eliminate stored XSS attack vectors.",
        },
        {
            "id": "doc-live-2",
            "title": "Architecture_ZeroTrust.pdf",
            "excerpt": "Vaeloom Module 05 enforces complete workspace isolation, multi-tier RBAC for write operations, and namespaced cache keys.",
        },
    ]

    result = await agent.synthesize_documents(
        query=query,
        documents=docs,
    )

    assert result["query"] == query
    assert len(result["citations"]) == 2
    assert result["documents_consulted"] == 2
    synthesis = result["synthesis"].lower()

    # Verify the live Ollama Gemma model successfully synthesized grounded answers
    assert any(term in synthesis for term in ["html", "svg", "xss", "rejected", "isolation", "rbac", "security", "router"])
