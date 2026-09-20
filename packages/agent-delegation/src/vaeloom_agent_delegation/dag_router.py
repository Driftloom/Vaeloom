from typing import Any
from vaeloom_agent_policy import PolicyEngine, PolicyViolationError


class CyclicDelegationError(Exception):
    pass


class DelegationDAGRouter:
    """Acyclic delegation scheduler ensuring DAG depth limits and cycle prevention."""

    def __init__(self):
        self._call_graph: dict[str, list[str]] = {}

    def can_delegate(self, caller: str, target: str, policy: PolicyEngine, current_call_path: list[str]) -> bool:
        if target in current_call_path:
            raise CyclicDelegationError(f"Cyclic delegation detected: {' -> '.join(current_call_path)} -> {target}")

        current_depth = len(current_call_path)
        verdict = policy.authorize_delegation(target, current_depth)
        if not verdict.allowed:
            raise PolicyViolationError(f"Delegation rejected: {verdict.reason}")

        return True
