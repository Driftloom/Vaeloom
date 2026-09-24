"""Enterprise Execution State Machine & Transition Validator.

Validates that state transitions follow the authoritative lifecycle invariants.
"""

from __future__ import annotations

import logging
from typing import Set

logger = logging.getLogger(__name__)

# Valid transitions from node -> set of allowable next nodes
VALID_TRANSITIONS: dict[str, Set[str]] = {
    "understand": {"plan", "complete", "failed"},
    "plan": {"execute", "complete", "failed"},
    "execute": {"observe", "failed"},
    "observe": {"approve", "reflect", "failed"},
    "approve": {"reflect", "waiting_approval", "failed"},
    "waiting_approval": {"reflect", "failed", "cancelled"},
    "reflect": {"plan", "complete", "failed"},
    "complete": set(),  # Terminal
    "failed": set(),    # Terminal
    "cancelled": set(), # Terminal
}


class InvalidStateTransitionError(ValueError):
    """Raised when an illegal transition is attempted in the execution graph."""
    pass


class ExecutionStateMachine:
    """Manages and validates state transitions in the execution graph."""

    @staticmethod
    def validate_transition(from_node: str, to_node: str) -> bool:
        """Validate whether a transition from from_node to to_node is allowable."""
        allowed = VALID_TRANSITIONS.get(from_node, set())
        if to_node not in allowed:
            raise InvalidStateTransitionError(
                f"Illegal state transition attempted: '{from_node}' -> '{to_node}'. "
                f"Allowable target states: {sorted(list(allowed))}"
            )
        return True

    @staticmethod
    def is_terminal(node: str) -> bool:
        """Check if a node is terminal."""
        return len(VALID_TRANSITIONS.get(node, set())) == 0
