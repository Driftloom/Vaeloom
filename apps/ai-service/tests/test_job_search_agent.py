"""Tests for Job Search Agent."""
import pytest
from app.agents.job_search_agent.handler import JobSearchAgent


@pytest.mark.asyncio
async def test_excludes_rejected_roles():
    """Job Search Agent should filter out previously rejected roles."""
    agent = JobSearchAgent()
    result = await agent.search(
        keywords=["python"],
        user_skills=["python", "aws"],
        rejected_job_ids=["job_rejected"],
    )
    details = result["result"]["details"]
    job_ids = [j["job_id"] for j in details]
    assert "job_rejected" not in job_ids


@pytest.mark.asyncio
async def test_fit_reason_per_result():
    """Every result must include a stated fit reason — never unexplained."""
    agent = JobSearchAgent()
    result = await agent.search(
        keywords=["python"],
        user_skills=["python", "django"],
        rejected_job_ids=[],
    )
    details = result["result"]["details"]
    for job in details:
        assert job["fit_reason"] != ""
        assert len(job["fit_reason"]) > 10


@pytest.mark.asyncio
async def test_results_ranked_by_fit():
    agent = JobSearchAgent()
    result = await agent.search(
        keywords=["python"],
        user_skills=["python", "aws", "docker"],
        rejected_job_ids=[],
    )
    details = result["result"]["details"]
    scores = [j["fit_score"] for j in details]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.asyncio
async def test_read_only_agent():
    """Job Search Agent should have no memory write scope."""
    agent = JobSearchAgent()
    assert agent.memory_scopes.write_types == []
