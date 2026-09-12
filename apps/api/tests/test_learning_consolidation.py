"""
Tests for Wave 4 (Context Loader & Hydration) and Wave 5 (Memory Consolidator & Learning Closure).
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from api.agents.memory.consolidator import MemoryConsolidatorAgent, memory_consolidator
from api.agents.resume_agent.handler import ResumeAgent
from api.models.schema import Entity
from api.orchestrator.base import AgentContext
from api.orchestrator.context_loader import AgentContextLoader, context_loader
from api.orchestrator.loop import AgentRequest, plan_phase, act_phase, improve_phase
from api.orchestrator.state import LoopState


class _SessionCtx:
    def __init__(self, s):
        self.s = s

    async def __aenter__(self):
        return self.s

    async def __aexit__(self, *a):
        pass


@pytest.fixture(autouse=True)
def bind_test_db(monkeypatch, db_session):
    factory = lambda: _SessionCtx(db_session)
    monkeypatch.setattr("api.database.async_session_factory", factory)
    _cm = lambda workspace_id=None, **kw: _SessionCtx(db_session)
    monkeypatch.setattr("api.orchestrator.context_loader.get_session_cm", _cm)
    monkeypatch.setattr("api.agents.memory.consolidator.get_session_cm", _cm)


@pytest.mark.asyncio
async def test_context_loader_empty_workspace():
    loader = AgentContextLoader()
    ctx = await loader.load_context(workspace_id="")
    assert ctx.profile["name"] == "User"
    assert ctx.profile["email"] == "user@example.com"
    assert ctx.profile["skills"] == []
    assert ctx.profile["education"] == []
    assert ctx.profile["experience"] == []


@pytest.mark.asyncio
async def test_context_loader_with_db_entities(db_session):
    wid = str(uuid.uuid4())
    w_uuid = uuid.UUID(wid)

    # Insert test entities
    e1 = Entity(
        id=uuid.uuid4(),
        workspace_id=w_uuid,
        type="skill",
        canonical_name="Distributed Systems",
        metadata_={"level": "expert"},
    )
    e2 = Entity(
        id=uuid.uuid4(),
        workspace_id=w_uuid,
        type="education",
        canonical_name="MIT",
        metadata_={"degree": "B.S. CS", "year": 2020},
    )
    e3 = Entity(
        id=uuid.uuid4(),
        workspace_id=w_uuid,
        type="experience",
        canonical_name="Acme Corp",
        metadata_={"role": "Staff Engineer"},
    )
    db_session.add_all([e1, e2, e3])
    await db_session.commit()

    loader = AgentContextLoader()
    ctx = await loader.load_context(workspace_id=wid)

    assert "Distributed Systems" in ctx.profile["skills"]
    assert any(ed["institution"] == "MIT" for ed in ctx.profile["education"])
    assert any(exp["company"] == "Acme Corp" for exp in ctx.profile["experience"])


def test_memory_consolidator_heuristics():
    agent = MemoryConsolidatorAgent()
    text = (
        "I prefer remote work and asynchronous communication.\n"
        "I have strong experience in Rust and Kubernetes."
    )
    extracted = agent._extract_heuristics(text)

    types = {e["type"] for e in extracted}
    names = [e["name"].lower() for e in extracted]

    assert "preference" in types
    assert "skill" in types
    assert any("remote" in n for n in names)
    assert any("rust" in n for n in names)


@pytest.mark.asyncio
async def test_memory_consolidator_trajectory_upsert(db_session):
    wid = str(uuid.uuid4())
    agent = MemoryConsolidatorAgent()

    result = await agent.consolidate_trajectory(
        workspace_id=wid,
        agent_name="career",
        user_prompt="I am looking for a job. I prefer remote roles only and have experience in Python.",
        summary="Found 3 jobs matching your criteria.",
        corrections=[{"field": "skills", "correction": "TypeScript"}],
    )

    assert result["status"] == "success"
    assert result["consolidated_count"] >= 2

    items = result["items"]
    names = [i["name"].lower() for i in items]
    assert any("remote" in n for n in names)
    assert any("python" in n for n in names)
    assert any("typescript" in n for n in names)


@pytest.mark.asyncio
async def test_loop_plan_and_act_hydrates_real_context(db_session):
    wid = str(uuid.uuid4())
    w_uuid = uuid.UUID(wid)

    # Add a skill entity to DB
    e = Entity(
        id=uuid.uuid4(),
        workspace_id=w_uuid,
        type="skill",
        canonical_name="Kubernetes Orchestration",
    )
    db_session.add(e)
    await db_session.commit()

    agent = ResumeAgent()
    req = AgentRequest(agent=agent, request_id="req_test_123", message="Build resume", workspace_id=wid)
    state = LoopState(request_id="req_test_123")

    plan = await plan_phase(req, state)
    assert "agent_context" in plan
    ctx = plan["agent_context"]
    assert ctx is not None
    assert "Kubernetes Orchestration" in ctx.profile["skills"]

    act_res = await act_phase(plan, req)
    assert act_res["action"] == "suggest"
    # Verify that skills from context were included in the resume bullet points
    details = act_res["result"]["details"]
    sections = details["sections"]
    skills_bullets = sections.get("skills", [])
    skills_text = " ".join(b["text"] for b in skills_bullets)
    assert "Kubernetes Orchestration" in skills_text


@pytest.mark.asyncio
async def test_improve_phase_emits_consolidation():
    wid = str(uuid.uuid4())
    agent = ResumeAgent()
    req = AgentRequest(agent=agent, request_id="req_improve_1", message="prefer remote work", workspace_id=wid)
    state = LoopState(request_id="req_improve_1")
    state.add_phase("observe_0", {"payload": {"result": {"summary": "Generated resume successfully"}}})

    with patch.object(memory_consolidator, "consolidate_trajectory", new_callable=AsyncMock) as mock_cons:
        resp = await improve_phase(state, req)
        assert resp.status == "success"
        assert resp.final_result == "Generated resume successfully"
        mock_cons.assert_called_once()
        _kw = mock_cons.call_args.kwargs
        assert _kw["workspace_id"] == wid
        assert _kw["agent_name"] == "resume"
        assert _kw["user_prompt"] == "prefer remote work"
        assert _kw["summary"] == "Generated resume successfully"
        # Zero-trust learning closure: stable idempotent event + correlation.
        assert _kw["event_id"] == "traj:req_improve_1"
        assert _kw["correlation_id"] == "req_improve_1"
