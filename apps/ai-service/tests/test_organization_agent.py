"""Tests for Organization Agent."""
import pytest
from app.agents.organization_agent.handler import OrganizationAgent


@pytest.mark.asyncio
async def test_categorize_resume():
    agent = OrganizationAgent()
    docs = [{"id": "d1", "filename": "John_Resume.pdf"}]
    result = await agent.execute(docs)
    assert result["action"] == "suggest"
    proposals = result["result"]["proposals"]
    assert len(proposals) == 1
    assert proposals[0]["suggested_folder"] == "Resumes"


@pytest.mark.asyncio
async def test_categorize_transcript():
    agent = OrganizationAgent()
    docs = [{"id": "d1", "filename": "Spring_2024_Transcript.pdf"}]
    result = await agent.execute(docs)
    proposals = result["result"]["proposals"]
    assert proposals[0]["suggested_folder"] == "Transcripts"


@pytest.mark.asyncio
async def test_asks_when_uncategorized():
    """Agent should ask user when it can't classify a document (confidence < 0.8)."""
    agent = OrganizationAgent()
    docs = [{"id": "d1", "filename": "random_notes.txt"}]
    result = await agent.execute(docs)
    assert result["action"] == "ask_clarification"
    assert len(result["result"]["questions"]) > 0


@pytest.mark.asyncio
async def test_version_chain_detection():
    """Agent should detect that Resume_v2_final_FINAL.pdf is a version of Resume.pdf."""
    agent = OrganizationAgent()
    docs = [
        {"id": "d1", "filename": "Resume.pdf"},
        {"id": "d2", "filename": "Resume_v2_final_FINAL.pdf"},
    ]
    result = await agent.execute(docs)
    proposals = result["result"]["proposals"]
    # The second doc should be detected as a version of the first
    version_proposal = next(p for p in proposals if p["document_id"] == "d2")
    assert version_proposal["is_version_of"] == "d1"


@pytest.mark.asyncio
async def test_never_auto_applies():
    """Organization Agent should never auto-apply; always suggest."""
    agent = OrganizationAgent()
    docs = [{"id": "d1", "filename": "Resume.pdf"}]
    result = await agent.execute(docs)
    # Action should be "suggest", not "execute"
    assert result["action"] in ("suggest", "ask_clarification")
    assert result["action"] != "execute"
