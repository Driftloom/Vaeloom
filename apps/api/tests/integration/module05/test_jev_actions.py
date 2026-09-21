"""Test suite for TypeSafe AI Jev System 1 Fast Decision Engine in Module 05.

Verifies sub-50ms deterministic action choice and HITL safety noul decisions
for document operations, both with live Jev gateway (when JEV_API_KEY is present)
and deterministic zero-dependency fallback (<1ms).
"""
import pytest
from api.agents.document_agent.handler import DocumentAgent
from api.services.jev_service import jev_service

pytestmark = [pytest.mark.integration]


@pytest.mark.asyncio
async def test_jev_action_choice_routing():
    """Verify Jev routes user document queries to the correct discrete action."""
    action_choices = ["summarize", "search", "audit_security", "compare", "extract_skills"]

    # Test skill extraction
    action1 = await jev_service.choice("Extract technical skills from candidate resume", action_choices)
    assert action1 == "extract_skills"

    # Test audit security
    action2 = await jev_service.choice("Audit security controls and check for stored XSS", action_choices)
    assert action2 == "audit_security"

    # Test compare
    action3 = await jev_service.choice("Compare candidate A and candidate B resumes", action_choices)
    assert action3 == "compare"

    # Test summarize
    action4 = await jev_service.choice("Please summarize the project proposal", action_choices)
    assert action4 == "summarize"


@pytest.mark.asyncio
async def test_jev_noul_safety_triage():
    """Verify Jev binary safety noul flags dangerous mutating actions for human approval."""
    # Dangerous actions
    assert await jev_service.noul("Delete all documents in workspace") is True
    assert await jev_service.noul("Archive and purge all files") is True
    assert await jev_service.noul("Drop the documents table") is True

    # Safe actions
    assert await jev_service.noul("Summarize the quarterly financial report") is False
    assert await jev_service.noul("Find documents mentioning Kubernetes") is False


@pytest.mark.asyncio
async def test_document_agent_integrated_with_jev():
    """Verify DocumentAgent combines Jev System 1 action routing with execution."""
    agent = DocumentAgent()

    # Test harmless search query
    res_safe = await agent.process({"message": "Search for Python and FastAPI skills in uploaded resumes"})
    assert res_safe["agent_name"] == "document"
    assert res_safe["action"] in ("extract_skills", "search")
    assert res_safe["requires_approval"] is False

    # Test dangerous deletion query
    res_danger = await agent.process({"message": "Delete all archived documents in the workspace"})
    assert res_danger["requires_approval"] is True
