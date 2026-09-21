import pytest
from pathlib import Path
from uuid import uuid4

from vaeloom_agent_common import AgentCancelledError, AgentTurnContext, CancellationToken
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_agent_security import SecurityContext
from vaeloom_career_agent import CareerAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_career_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "career-agent"
    assert manifest.category.value == "career"
    assert manifest.autonomy_level.value == "full"
    assert manifest.delegation.can_delegate is True
    assert "ats-agent" in manifest.delegation.allowed_targets
    assert "resume-agent" in manifest.delegation.allowed_targets
    assert "job-search-agent" in manifest.delegation.allowed_targets


@pytest.mark.asyncio
async def test_career_agent_initialization():
    agent = CareerAgent()
    assert agent.manifest.agent_id == "career-agent"
    assert agent.validate_tool_call("web_search").allowed is True
    assert agent.validate_tool_call("delete_database").allowed is False


@pytest.mark.asyncio
async def test_career_agent_run_step_career_analysis():
    agent = CareerAgent()
    sec_ctx = SecurityContext.create(workspace_id=uuid4(), tenant_id=uuid4(), user_id=uuid4())
    context = AgentTurnContext(
        security=sec_ctx,
        session_id=uuid4(),
        agent_id="career-agent",
        user_prompt="I am a backend developer wanting to transition into distributed AI systems architect.",
        profile_data={"current_role": "Backend Developer", "skills": ["Python", "FastAPI", "Docker"]},
    )
    token = CancellationToken(timeout_seconds=30)
    step = await agent.run_step(context, token)

    assert step.is_final is True
    assert "Career Trajectory Analysis" in step.final_answer
    assert "Backend Developer" in step.final_answer
    assert "Strategic 3-Phase Milestone Roadmap" in step.final_answer


@pytest.mark.asyncio
async def test_career_agent_delegation_ats():
    agent = CareerAgent()
    sec_ctx = SecurityContext.create(workspace_id=uuid4(), tenant_id=uuid4(), user_id=uuid4())
    context = AgentTurnContext(
        security=sec_ctx,
        session_id=uuid4(),
        agent_id="career-agent",
        user_prompt="Please check my ATS score and keyword match for Senior AI Engineer.",
    )
    token = CancellationToken(timeout_seconds=30)
    step = await agent.run_step(context, token)

    assert step.action_name == "delegate:ats-agent"
    assert "ats-agent" in step.final_answer


@pytest.mark.asyncio
async def test_career_agent_delegation_resume():
    agent = CareerAgent()
    sec_ctx = SecurityContext.create(workspace_id=uuid4(), tenant_id=uuid4(), user_id=uuid4())
    context = AgentTurnContext(
        security=sec_ctx,
        session_id=uuid4(),
        agent_id="career-agent",
        user_prompt="Tailor resume for Staff Systems Engineer.",
    )
    token = CancellationToken(timeout_seconds=30)
    step = await agent.run_step(context, token)

    assert step.action_name == "delegate:resume-agent"
    assert "resume-agent" in step.final_answer


@pytest.mark.asyncio
async def test_career_agent_tool_invocation():
    agent = CareerAgent()
    sec_ctx = SecurityContext.create(workspace_id=uuid4(), tenant_id=uuid4(), user_id=uuid4())
    context = AgentTurnContext(
        security=sec_ctx,
        session_id=uuid4(),
        agent_id="career-agent",
        user_prompt="Please execute web_search for latest tech compensation benchmarks in 2026.",
    )
    token = CancellationToken(timeout_seconds=30)
    step = await agent.run_step(context, token)

    assert step.action_name == "web_search"
    assert step.is_final is False
    assert "Retrieved relevant career data" in step.observation


@pytest.mark.asyncio
async def test_career_agent_budget_limit():
    agent = CareerAgent()
    sec_ctx = SecurityContext.create(workspace_id=uuid4(), tenant_id=uuid4(), user_id=uuid4())
    context = AgentTurnContext(
        security=sec_ctx,
        session_id=uuid4(),
        agent_id="career-agent",
        user_prompt="Continue reasoning",
        step_count=20,  # Exceeds max_steps_per_turn = 15
    )
    token = CancellationToken(timeout_seconds=30)
    step = await agent.run_step(context, token)

    assert step.is_final is True
    assert "maximum allowed steps" in step.final_answer


@pytest.mark.asyncio
async def test_career_agent_cancellation():
    agent = CareerAgent()
    sec_ctx = SecurityContext.create(workspace_id=uuid4(), tenant_id=uuid4(), user_id=uuid4())
    context = AgentTurnContext(
        security=sec_ctx,
        session_id=uuid4(),
        agent_id="career-agent",
        user_prompt="Analyze career options",
    )
    token = CancellationToken()
    token.cancel()

    with pytest.raises(AgentCancelledError):
        await agent.run_step(context, token)
