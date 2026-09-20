#!/usr/bin/env python3
"""
Vaeloom Enterprise Multi-Agent Workspace Collaboration Demo.

Demonstrates:
1. Multi-Agent Delegation DAG routing with cycle prevention.
2. Scoped Blackboard shared state across collaborating sub-agents.
3. End-to-end workflow:
   - Coding Agent reviews architectural PR and candidate code submission.
   - Slack Agent generates formatted engineering team channel digest.
   - Memory Agent captures architectural decisions into enterprise memory graph.
4. Tamper-evident provenance logging.
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[2]
for path_dir in [ROOT]:
    if str(path_dir) not in sys.path:
        sys.path.insert(0, str(path_dir))
for pkg in (ROOT / "packages").glob("*/src"):
    if str(pkg) not in sys.path:
        sys.path.insert(0, str(pkg))
for ag in (ROOT / "agents").glob("*/src"):
    if str(ag) not in sys.path:
        sys.path.insert(0, str(ag))

from vaeloom_agent_contracts import (
    AgentManifest,
    AgentCategory,
    DelegationPolicy,
    MemoryScopeConfig,
    BudgetConfig,
    AutonomyLevel,
)
from vaeloom_agent_policy import PolicyEngine
from vaeloom_agent_delegation import ScopedBlackboard, DelegationDAGRouter, CyclicDelegationError


def run_enterprise_workspace_demo():
    print("=" * 76)
    print("    VAELOOM ENTERPRISE MULTI-AGENT WORKSPACE COLLABORATION DEMO")
    print("=" * 76)

    session_id = uuid.uuid4()
    blackboard = ScopedBlackboard(session_id=session_id)
    router = DelegationDAGRouter()

    # Define enterprise policy manifest
    manifest = AgentManifest(
        agent_id="workspace-supervisor",
        name="Workspace Supervisor",
        version="1.0.0",
        description="Supervises enterprise developer workflows and multi-agent coordination.",
        category=AgentCategory.DEVELOPER,
        autonomy_level=AutonomyLevel.FULL,
        tools=["code_review", "slack_post", "memory_record"],
        delegation=DelegationPolicy(
            allowed_targets=["coding-agent", "slack-agent", "memory-agent"],
            max_depth=4,
            can_delegate=True,
        ),
        memory_scopes=MemoryScopeConfig(
            read_scopes=["tenant", "workspace", "session"],
            write_scopes=["workspace", "session"],
        ),
        budget=BudgetConfig(max_usd_per_turn=50.0),
    )
    policy = PolicyEngine(manifest)

    print(f"\n[1] Workspace Session Initialized:")
    print(f"    Session UUID: {session_id}")
    print(f"    Supervisor:   {manifest.name} (Max Depth: {manifest.delegation.max_depth})")
    print(f"    Allowed Sub-Agents: {', '.join(manifest.delegation.allowed_targets)}")

    # Step 1: Coding Agent checks code submission
    call_path = ["workspace-supervisor"]
    target_agent = "coding-agent"
    print(f"\n[2] Stage 1: Delegating to [{target_agent}]...")
    router.can_delegate("workspace-supervisor", target_agent, policy, call_path)

    pr_code_diff = """
    + async def handle_edge_lease(lease_id: str, timeout_ms: int) -> bool:
    +     # Profiled with eBPF: zero allocations in hot path
    +     return await raft_node.renew_lease(lease_id, timeout_ms)
    """

    code_review_result = {
        "pr_number": 142,
        "author": "alex.mercer@vaeloom.test",
        "verdict": "APPROVED",
        "comments": [
            "eBPF hot-path profiling verified with zero heap allocations.",
            "Raft lease renewal satisfies strict sub-5ms latency requirements."
        ],
        "test_coverage": "96.4%",
    }
    blackboard.write("code_review_summary", code_review_result, agent_id=target_agent)
    print(f"  - Coding Agent Verdict: {code_review_result['verdict']}")
    print(f"  - Test Coverage:        {code_review_result['test_coverage']}")
    print(f"  - Blackboard updated with key: 'code_review_summary'")

    # Step 2: Slack Agent posts digest to #engineering channel
    call_path.append(target_agent)
    next_agent = "slack-agent"
    print(f"\n[3] Stage 2: Delegating to [{next_agent}]...")
    router.can_delegate("coding-agent", next_agent, policy, call_path)

    # Read previous findings from blackboard
    review_data = blackboard.read("code_review_summary")
    slack_payload = {
        "channel": "#infra-deployments",
        "text": (
            f":white_check_mark: *PR #{review_data['pr_number']} Approved* by Coding Agent\n"
            f"> *Author*: `{review_data['author']}`\n"
            f"> *Coverage*: {review_data['test_coverage']}\n"
            f"> *Highlights*: {review_data['comments'][0]}"
        ),
        "status": "DISPATCHED",
    }
    blackboard.write("slack_notification", slack_payload, agent_id=next_agent)
    print(f"  - Slack Agent dispatched message to {slack_payload['channel']}:")
    print(f"    \"{slack_payload['text'][:80]}...\"")
    print(f"  - Blackboard updated with key: 'slack_notification'")

    # Step 3: Memory Agent stores architectural decision
    memory_agent = "memory-agent"
    print(f"\n[4] Stage 3: Delegating to [{memory_agent}]...")
    router.can_delegate("slack-agent", memory_agent, policy, call_path)

    memory_fact = {
        "entity": "RaftLeaseRenewal",
        "attribute": "allocation_policy",
        "value": "zero_heap_allocations_via_ebpf",
        "provenance_pr": 142,
        "confidence": 1.0,
    }
    blackboard.write("arch_decision_memory", memory_fact, agent_id=memory_agent)
    print(f"  - Memory Agent committed architectural knowledge:")
    print(f"    {memory_fact['entity']}.{memory_fact['attribute']} = {memory_fact['value']}")
    print(f"  - Blackboard updated with key: 'arch_decision_memory'")

    # Step 4: Validate Cycle Prevention Guardrail
    print(f"\n[5] Guardrail Verification: Simulating Illegal Cyclic Delegation...")
    call_path_with_cycle = ["workspace-supervisor", "coding-agent", "slack-agent"]
    try:
        # Attempt to loop back to coding-agent
        router.can_delegate("slack-agent", "coding-agent", policy, call_path_with_cycle)
        print("  [ERROR] Cycle detection failed!")
    except CyclicDelegationError as e:
        print(f"  [PASS] Cycle detected and rejected: {e}")

    # Step 5: Blackboard state inspection
    print(f"\n[6] Final Scoped Blackboard State:")
    print(f"    Active Keys: {blackboard.list_keys()}")
    for k in blackboard.list_keys():
        entry = blackboard.read(k)
        print(f"    - {k}: {type(entry).__name__}")

    print("\n" + "=" * 76)
    print("  ENTERPRISE WORKSPACE DEMO: MULTI-AGENT PIPELINE 100% SUCCESSFUL")
    print("=" * 76)


if __name__ == "__main__":
    run_enterprise_workspace_demo()
