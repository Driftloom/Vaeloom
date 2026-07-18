"""Tests for Resume Agent."""
import pytest
from app.agents.resume_agent.handler import ResumeAgent


@pytest.mark.asyncio
async def test_asks_when_missing_field():
    """Resume Agent should ask a specific clarifying question when profile is missing expected fields."""
    agent = ResumeAgent()
    incomplete_profile = {
        "name": "John Doe",
        "email": "john@example.com",
        # Missing: education, experience
    }
    result = await agent.execute(incomplete_profile)
    assert result["action"] == "ask_clarification"
    assert len(result["result"]["questions"]) > 0
    # Should ask specifically about the missing fields
    questions_text = " ".join(result["result"]["questions"]).lower()
    assert "education" in questions_text or "experience" in questions_text


@pytest.mark.asyncio
async def test_generates_resume_with_complete_profile():
    """Resume Agent generates resume when profile is complete."""
    agent = ResumeAgent()
    profile = {
        "name": "John Doe",
        "email": "john@example.com",
        "education": [{"degree": "BS CS", "institution": "MIT", "source_doc_id": "doc1"}],
        "experience": [
            {
                "role": "Software Engineer",
                "company": "Google",
                "achievements": ["Built X measured by Y by doing Z"],
                "source_doc_id": "doc2",
            }
        ],
        "skills": ["Python", "React", "AWS"],
    }
    result = await agent.execute(profile)
    assert result["action"] == "suggest"
    assert result["confidence"] >= 0.8
    details = result["result"]["details"]
    assert details["variant_type"] == "master"
    assert "education" in details["sections"]
    assert "experience" in details["sections"]


@pytest.mark.asyncio
async def test_never_fabricates():
    """Resume Agent should never fabricate data — only use what's in the profile."""
    agent = ResumeAgent()
    profile = {
        "name": "Jane Smith",
        "email": "jane@example.com",
        "education": [],
        "experience": [],
        "skills": [],
    }
    result = await agent.execute(profile)
    # With empty data, it should generate empty sections, not fabricated content
    assert result["action"] == "suggest"
    details = result["result"]["details"]
    assert len(details["sections"].get("experience", [])) == 0


@pytest.mark.asyncio
async def test_supports_variant_types():
    """Resume Agent should support master, ats, and role_specific variants."""
    agent = ResumeAgent()
    profile = {
        "name": "John Doe",
        "email": "john@example.com",
        "education": [{"degree": "BS", "institution": "Uni"}],
        "experience": [{"role": "Dev", "company": "Corp", "achievements": ["Did stuff"]}],
        "skills": ["Python"],
    }
    for variant in ["master", "ats", "role_specific"]:
        result = await agent.execute(profile, variant_type=variant)
        assert result["result"]["details"]["variant_type"] == variant
