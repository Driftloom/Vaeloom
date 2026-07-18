"""Tests for ATS Agent."""
import pytest
from app.agents.ats_agent.handler import ATSAgent


@pytest.mark.asyncio
async def test_score_matching_resume():
    agent = ATSAgent()
    resume = "Experience: Python developer with AWS and Docker skills. Education: BS CS. Skills: Python, AWS, Docker"
    jd = "Looking for a Python developer with AWS experience"
    result = await agent.score(resume, jd)
    assert result["action"] == "suggest"
    details = result["result"]["details"]
    assert details["overall_score"] > 0.0
    assert "python" in details["matched_keywords"]
    assert "aws" in details["matched_keywords"]


@pytest.mark.asyncio
async def test_identifies_missing_keywords():
    agent = ATSAgent()
    resume = "Experience in basic data entry. Education: High School."
    jd = "Looking for Python developer with machine learning and React experience"
    result = await agent.score(resume, jd)
    details = result["result"]["details"]
    assert len(details["missing_keywords"]) > 0


@pytest.mark.asyncio
async def test_read_only_never_writes():
    """ATS Agent should have empty write scopes — it's read-only."""
    agent = ATSAgent()
    assert agent.memory_scopes.write_types == []
    assert agent.default_autonomy == "read_only"


@pytest.mark.asyncio
async def test_asks_when_missing_input():
    """ATS Agent should ask for JD when not provided."""
    agent = ATSAgent()
    result = await agent.score("", "")
    assert result["action"] == "ask_clarification"
