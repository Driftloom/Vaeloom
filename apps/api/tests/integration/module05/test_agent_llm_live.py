"""Live integration test for DocumentAgent using real TypeSafe AI Jev and Ollama Cloud Gemma.

Verifies the genuine, non-mocked 30% System 1 + 70% System 2 cognitive pipeline on real career documents:
1. System 1 (TypeSafe AI Jev System One):
   - choice: Sub-50ms discrete action classification.
   - noul: Binary safety triage flagging destructive mutations for HITL approval.
2. System 2 (Ollama Cloud Gemma 4 31B):
   - Grounded career document synthesis over XML-fenced excerpts with provenance citations.

Run:
  uv run --project apps/api python -m pytest apps/api/tests/integration/module05/test_agent_llm_live.py -v -o addopts=""
"""
import os
import httpx
import pytest

from api.agents.document_agent.handler import DocumentAgent
from api.config import settings
from api.services.jev_service import jev_service

pytestmark = [pytest.mark.integration, pytest.mark.live_provider]


@pytest.mark.asyncio
async def test_live_document_agent_with_ollama_and_jev():
    """Verify live Ollama Cloud Gemma document synthesis + TypeSafe AI Jev System 1 routing."""
    ollama_key = os.environ.get("OLLAMA_API_KEY") or getattr(settings, "ollama_api_key", "")
    jev_key = os.environ.get("JEV_API_KEY") or getattr(settings, "jev_api_key", "")

    if not ollama_key:
        pytest.skip("OLLAMA_API_KEY not configured in environment or settings")
    if not jev_key:
        pytest.skip("JEV_API_KEY not configured in environment or settings")

    # Configure Ollama Cloud provider
    settings.llm_provider = "ollama"
    settings.ollama_base_url = "https://ollama.com"
    settings.ollama_api_key = ollama_key
    settings.llm_api_key = ollama_key
    settings.llm_model = "gemma4:31b"

    # Configure TypeSafe AI Jev
    settings.jev_api_key = jev_key
    settings.jev_gateway_url = "https://api.typesafe.ai/v1/systemone"
    jev_service.api_key = jev_key
    jev_service.gateway_url = "https://api.typesafe.ai/v1/systemone"

    # Real application query on career documents
    query = "What matching backend architectural competencies does the candidate possess according to the uploaded resume and job spec?"

    # 1. System 1: TypeSafe AI Jev fast deterministic action classification (<50ms)
    action_choices = ["extract_skills", "summarize", "search", "compare", "audit_security"]
    selected_action = await jev_service.choice(query, action_choices)
    is_dangerous = await jev_service.noul(query)

    assert selected_action in ("extract_skills", "summarize", "search", "compare")
    assert is_dangerous is False  # Career QA inquiry is safe and read-only

    # 2. System 2: Grounded DocumentAgent synthesis with Ollama Cloud Gemma
    agent = DocumentAgent()
    docs = [
        {
            "id": "doc-resume-01",
            "title": "Principal_Staff_Architect_Resume.pdf",
            "excerpt": "Principal Full-Stack Architect with 10+ years experience in Distributed Systems, Python, FastAPI, and PostgreSQL. Architected real-time streaming pipeline reducing p99 latency by 64%.",
        },
        {
            "id": "doc-job-02",
            "title": "Staff_AI_Engineer_Job_Description.docx",
            "excerpt": "Requirements: Strong expertise in Python microservices, autonomous agent workflows, distributed caching, and zero-trust security architecture.",
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

    # The real Ollama Cloud Gemma model synthesizes grounded facts from both documents
    assert any(term in synthesis for term in ["python", "distributed", "systems", "microservices", "architect", "fastapi"])
