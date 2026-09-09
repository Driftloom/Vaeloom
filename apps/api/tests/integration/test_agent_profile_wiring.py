import pytest
import uuid
from api.agents.job_search_agent.handler import JobSearchAgent
from api.agents.recommendation_agent.handler import RecommendationAgent
from api.orchestrator.context_loader import context_loader
from api.models.schema import User, Memory


@pytest.mark.asyncio
async def test_job_search_agent_respects_dealbreakers_and_preferences():
    agent = JobSearchAgent()
    
    # 1. Test dealbreaker filtering
    preferences = {
        "dealbreakers": ["Crypto", "On-call"],
        "remote_preference": "remote",
        "preferred_industries": ["Developer Tools"],
    }
    
    res = await agent.search(
        keywords=["developer"],
        user_skills=["python", "react"],
        rejected_job_ids=[],
        preferences=preferences,
    )
    
    details = res["result"]["details"]
    # Verify no crypto or on-call in titles or company
    for job in details:
        text = f"{job['title']} {job['company']}".lower()
        assert "crypto" not in text
        assert "on-call" not in text

    # Verify remote jobs received boosted fit scores
    remote_jobs = [j for j in details if j["is_remote"]]
    for rj in remote_jobs:
        assert "Matches remote preference" in rj["fit_reason"]


@pytest.mark.asyncio
async def test_recommendation_agent_receives_preferences():
    agent = RecommendationAgent()
    profile = {"skills": ["python", "fastapi"]}
    preferences = {"remote_preference": "remote", "dealbreakers": ["defense"]}
    
    res = await agent.match_jobs(profile=profile, preferences=preferences)
    assert res is not None
    assert "agent_name" in res or "matched_jobs" in res or "details" in res or "summary" in res


@pytest.mark.asyncio
async def test_context_loader_hydrates_profile(db_session):
    # Seed user with profile fields and memories
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="agent-wire@vaeloom.test",
        password_hash="hash",
        display_name="Wire Tester",
        headline="Principal Platform Engineer",
        location="San Francisco, CA",
        preferences={"theme": "dark"},
    )
    db_session.add(user)
    
    ws_id = uuid.uuid4()
    
    import json
    # Add preference memory
    pref_mem = Memory(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        user_id=str(user_id),
        type="preference",
        domain="career",
        title="Job Preferences",
        summary="User job search preferences",
        content=json.dumps({"remotePreference": "remote", "dealbreakers": ["Crypto"]}),
        content_hash="hash_pref",
        size=10,
        status="active",
    )
    # Add profile memory
    prof_mem = Memory(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        user_id=str(user_id),
        type="profile",
        domain="professional",
        title="Profile Skills",
        summary="User skills",
        content=json.dumps({"skills": ["Python", "Kubernetes", "Next.js"], "yearsExperience": 8}),
        content_hash="hash_prof",
        size=10,
        status="active",
    )
    db_session.add(pref_mem)
    db_session.add(prof_mem)
    await db_session.commit()
    
    context = await context_loader.load_context(
        workspace_id=str(ws_id),
        user_id=str(user_id),
        db=db_session,
    )
    
    assert context.profile["name"] == "Wire Tester"
    assert context.profile["headline"] == "Principal Platform Engineer"
    assert "Python" in context.profile["skills"]
    assert context.profile["job_preferences"]["remote_preference"] == "remote"
    assert "Crypto" in context.profile["job_preferences"]["dealbreakers"]
