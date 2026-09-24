"""Layer E — Execution Planning & Supervisor Dependency DAG.

Builds structured execution plans, resolves tool requirements,
and validates topological dependencies without fragile word-count heuristics.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from ..capability_registry import capability_registry
from ..contracts.capability import AutonomyLevel
from ..contracts.decision import ExecutionPlan, SubtaskNode
from ..contracts.intent import IntentEnvelope
from .layer_d_policy import PolicyEvaluationResult

logger = logging.getLogger(__name__)


class LayerEPlanner:
    """Execution planner constructing topological dependency DAGs for agents."""

    def __init__(self) -> None:
        self.registry = capability_registry

    def plan_execution(
        self,
        policy_res: PolicyEvaluationResult,
    ) -> ExecutionPlan:
        envelope = policy_res.envelope

        # If subtasks already decomposed in IntentEnvelope
        subtask_nodes: list[SubtaskNode] = []
        if envelope.is_complex_goal and envelope.subtasks:
            for st in envelope.subtasks:
                cap_id = st.get("capability_required", envelope.normalized_intent)
                agent_id = st.get("agent_assigned", envelope.selected_agent)
                subtask_nodes.append(
                    SubtaskNode(
                        task_id=st.get("task_id", f"task_{uuid.uuid4().hex[:8]}"),
                        title=st.get("title", f"Execute {agent_id}"),
                        capability_required=cap_id,
                        agent_assigned=agent_id,
                        parameters=st.get("parameters", {}),
                        dependencies=st.get("dependencies", []),
                        autonomy_level=policy_res.effective_autonomy,
                    )
                )
        else:
            # Single task plan
            subtask_nodes.append(
                SubtaskNode(
                    task_id=f"task_{uuid.uuid4().hex[:8]}",
                    title=f"Execute {envelope.selected_agent} for {envelope.normalized_intent}",
                    capability_required=envelope.normalized_intent,
                    agent_assigned=envelope.selected_agent,
                    parameters=envelope.extracted_parameters,
                    dependencies=[],
                    autonomy_level=policy_res.effective_autonomy,
                )
            )

        # Topological verification (Cycle detection)
        self._verify_no_cycles(subtask_nodes)

        plan = ExecutionPlan(
            plan_id=f"plan_{uuid.uuid4().hex[:10]}",
            goal_summary=f"Execution plan for {envelope.raw_query[:100]}",
            subtasks=subtask_nodes,
            is_sequential=len(subtask_nodes) > 1,
            estimated_latency_ms=1200.0 * len(subtask_nodes),
            requires_human_approval=policy_res.requires_human_approval,
            approval_reasons=[policy_res.denial_reason] if policy_res.denial_reason else [],
        )

        return plan

    def _verify_no_cycles(self, nodes: list[SubtaskNode]) -> None:
        """Kahn's algorithm cycle check for subtask dependencies."""
        in_degree: dict[str, int] = {node.task_id: 0 for node in nodes}
        adj: dict[str, list[str]] = {node.task_id: [] for node in nodes}

        for node in nodes:
            for dep in node.dependencies:
                if dep in in_degree:
                    in_degree[node.task_id] += 1
                    adj[dep].append(node.task_id)

        queue = [t for t, deg in in_degree.items() if deg == 0]
        visited = 0

        while queue:
            curr = queue.pop(0)
            visited += 1
            for neighbor in adj.get(curr, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if visited != len(nodes):
            logger.error("LAYER_E: Circular dependency detected in supervisor execution plan")
            # Break cycles safely by resetting dependencies
            for node in nodes:
                node.dependencies = []
