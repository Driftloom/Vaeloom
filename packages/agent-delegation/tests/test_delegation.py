import pytest
from uuid import uuid4
from vaeloom_agent_contracts import (
    AgentManifest,
    AgentCategory,
    AutonomyLevel,
    DelegationPolicy,
)
from vaeloom_agent_policy import PolicyEngine, PolicyViolationError
from vaeloom_agent_delegation import (
    ScopedBlackboard,
    DelegationDAGRouter,
    CyclicDelegationError,
)


@pytest.fixture
def policy():
    manifest = AgentManifest(
        agent_id="supervisor-agent",
        name="Supervisor",
        version="1.0.0",
        description="Supervisor",
        category=AgentCategory.SYSTEM,
        delegation=DelegationPolicy(
            allowed_targets=["career-agent", "ats-agent"],
            max_depth=2,
            can_delegate=True,
        ),
    )
    return PolicyEngine(manifest)


def test_blackboard_read_write():
    bb = ScopedBlackboard(uuid4())
    bb.write("career_summary", "Staff engineer trajectory", "career-agent")
    
    assert bb.read("career_summary") == "Staff engineer trajectory"
    assert bb.read("non_existent") is None
    assert "career_summary" in bb.list_keys()


def test_acyclic_delegation_and_cycle_detection(policy):
    router = DelegationDAGRouter()

    # Allowed first-hop delegation
    assert router.can_delegate("supervisor-agent", "career-agent", policy, ["supervisor-agent"]) is True

    # Cycle detection
    with pytest.raises(CyclicDelegationError):
        router.can_delegate("career-agent", "supervisor-agent", policy, ["supervisor-agent", "career-agent"])

    # Target not in allowed targets
    with pytest.raises(PolicyViolationError):
        router.can_delegate("supervisor-agent", "hacker-agent", policy, ["supervisor-agent"])
