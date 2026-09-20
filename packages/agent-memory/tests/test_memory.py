import pytest
from uuid import uuid4
from vaeloom_agent_contracts import (
    AgentManifest,
    AgentCategory,
    AutonomyLevel,
    MemoryScopeConfig,
    MemoryFact,
    MemoryQuery,
)
from vaeloom_agent_policy import PolicyEngine, PolicyViolationError
from vaeloom_agent_memory import WorkingMemoryStore, SemanticVectorStore, MemoryService


@pytest.fixture
def policy_engine_allowed():
    manifest = AgentManifest(
        agent_id="test-agent",
        name="Test Agent",
        version="1.0.0",
        description="test",
        category=AgentCategory.CAREER,
        memory_scopes=MemoryScopeConfig(
            read_scopes=["semantic_vector"],
            write_scopes=["semantic_vector"],
        ),
    )
    return PolicyEngine(manifest)


@pytest.fixture
def policy_engine_denied():
    manifest = AgentManifest(
        agent_id="test-agent",
        name="Test Agent",
        version="1.0.0",
        description="test",
        category=AgentCategory.CAREER,
        memory_scopes=MemoryScopeConfig(
            denied_scopes=["semantic_vector"],
        ),
    )
    return PolicyEngine(manifest)


def test_working_memory_crud():
    store = WorkingMemoryStore()
    ws_id = uuid4()
    s_id = uuid4()

    store.set(ws_id, s_id, "active_goal", "Become Staff Engineer")
    val = store.get(ws_id, s_id, "active_goal")
    assert val == "Become Staff Engineer"

    store.delete(ws_id, s_id, "active_goal")
    assert store.get(ws_id, s_id, "active_goal") is None


def test_memory_service_policy_gating(policy_engine_allowed, policy_engine_denied):
    svc = MemoryService()
    ws_id = uuid4()

    fact = MemoryFact(
        workspace_id=ws_id,
        category="career",
        content="Candidate has 5 years Python experience",
        provenance_source="resume",
    )

    # Allowed write
    svc.write_fact(policy_engine_allowed, fact)

    # Allowed query
    q = MemoryQuery(workspace_id=ws_id, query_text="Python experience")
    res = svc.query_semantic(policy_engine_allowed, q)
    assert len(res) == 1
    assert "5 years" in res[0].content

    # Denied access raises PolicyViolationError
    with pytest.raises(PolicyViolationError):
        svc.query_semantic(policy_engine_denied, q)
