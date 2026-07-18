"""Tests for Application Agent."""
import pytest
from app.agents.application_agent.handler import ApplicationAgent


@pytest.mark.asyncio
async def test_never_submits_without_approval():
    """Application Agent should NEVER submit without explicit approval."""
    agent = ApplicationAgent()
    job = {"id": "job_1", "title": "Dev", "company": "Corp"}
    profile = {"name": "John", "skills": ["python"]}

    # Without approval
    result = await agent.prepare(job, "resume text", profile, has_approval=False)
    assert result["action"] == "request_approval"
    assert result["result"]["details"]["status"] == "drafted"


@pytest.mark.asyncio
async def test_submits_with_approval():
    """Application Agent submits when user explicitly approves."""
    agent = ApplicationAgent()
    job = {"id": "job_1", "title": "Dev", "company": "Corp"}
    profile = {"name": "John", "skills": ["python"]}

    # With approval
    result = await agent.prepare(job, "resume text", profile, has_approval=True)
    assert result["action"] == "execute"
    assert result["result"]["details"]["status"] == "submitted"


@pytest.mark.asyncio
async def test_generates_cover_letter():
    agent = ApplicationAgent()
    job = {"id": "job_1", "title": "Python Developer", "company": "TechCo"}
    profile = {"name": "Jane Doe", "skills": ["Python", "AWS", "Docker"]}
    result = await agent.prepare(job, "resume text", profile, has_approval=False)
    cover = result["result"]["details"]["cover_letter"]
    assert "Python Developer" in cover
    assert "TechCo" in cover
    assert "Jane Doe" in cover


@pytest.mark.asyncio
async def test_provides_deep_link():
    """When no API exists, provide a deep link."""
    agent = ApplicationAgent()
    job = {"id": "job_1", "title": "Dev", "company": "Corp", "apply_url": "https://corp.com/apply"}
    profile = {"name": "John", "skills": []}
    result = await agent.prepare(job, "", profile, has_approval=False)
    assert result["result"]["details"]["deep_link"] == "https://corp.com/apply"


@pytest.mark.asyncio
async def test_approval_gated_autonomy():
    agent = ApplicationAgent()
    assert agent.default_autonomy == "approval_gated"
