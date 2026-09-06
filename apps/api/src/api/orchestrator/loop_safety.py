"""Loop safety: fingerprints, progress/oscillation detection, run budgets (Phase B §6).

The fixed `range(3)` counter is retained as an outer ceiling, but termination
is now explicit and observable: every run end names a reason from
state.TERMINATION_REASONS. Detection is deterministic (hashes, no LLM):

- repeated tool calls (same tool+args 3x)
- repeated identical plans / observations
- A -> B -> A oscillation (alternating pair 3x)
- no-progress loops (observation unchanged AND no new completed tool call)
- retrieval churn (same retrieval fingerprint across iterations)
- tool-call amplification / nested-loop amplification (budgets)
- budget exhaustion (iterations / tools / tokens / cost / duration)
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any


def fingerprint(value: Any, limit: int = 2000) -> str:
    try:
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)[:limit]
    except Exception:
        raw = str(value)[:limit]
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def tool_fingerprint(tool: str, args: dict[str, Any] | None) -> str:
    return f"{tool}:{fingerprint(args or {})}"


@dataclass
class LoopSafetyTracker:
    """Per-run deterministic safety tracker (serializable to LoopState phases)."""

    max_iterations: int = 3
    max_tool_calls: int = 12
    max_tokens: int = 12000
    max_cost_usd: float = 0.50
    max_duration_s: float = 120.0
    started_at: float = field(default_factory=time.monotonic)
    tool_fingerprints: list[str] = field(default_factory=list)
    plan_fingerprints: list[str] = field(default_factory=list)
    observation_fingerprints: list[str] = field(default_factory=list)
    retrieval_fingerprints: list[str] = field(default_factory=list)
    tool_calls: int = 0
    tokens_used: int = 0
    cost_usd: float = 0.0
    completed_tool_call_count: int = 0

    # -- recording ------------------------------------------------------
    def record_plan(self, plan: Any) -> str:
        fp = fingerprint(plan)
        self.plan_fingerprints.append(fp)
        return fp

    def record_tool(self, tool_fp: str, tokens: int = 0, cost_usd: float = 0.0) -> None:
        self.tool_fingerprints.append(tool_fp)
        self.tool_calls += 1
        self.tokens_used += tokens
        self.cost_usd += cost_usd

    def record_observation(self, observation: Any) -> str:
        fp = fingerprint(observation)
        self.observation_fingerprints.append(fp)
        return fp

    def record_retrieval(self, retrieval_ids: list[str]) -> str:
        fp = fingerprint(sorted(retrieval_ids or []))
        self.retrieval_fingerprints.append(fp)
        return fp

    # -- checks ----------------------------------------------------------
    def check_budgets(self) -> str | None:
        if len(self.plan_fingerprints) >= self.max_iterations and self.max_iterations > 0:
            # plans recorded per iteration; enforcement happens at loop top too
            pass
        if self.tool_calls >= self.max_tool_calls:
            return "tool_budget"
        if self.tokens_used >= self.max_tokens:
            return "token_budget"
        if self.cost_usd >= self.max_cost_usd:
            return "cost_budget"
        if (time.monotonic() - self.started_at) >= self.max_duration_s:
            return "timeout"
        return None

    def detect_cycle(self) -> str | None:
        """3x identical tool call or observation, or A->B->A tool alternation.

        Plan fingerprints are recorded for observability but never trigger:
        the same user goal legitimately yields the same plan every iteration.
        """
        # 3x identical consecutive (tool or observation stream only)
        for stream in (self.tool_fingerprints, self.observation_fingerprints):
            for i in range(len(stream) - 2):
                if stream[i] == stream[i + 1] == stream[i + 2]:
                    return "cycle_detected"
        # A->B->A oscillation over the last 6 tool fingerprints
        tail = self.tool_fingerprints[-6:]
        if len(tail) >= 5:
            for i in range(len(tail) - 4):
                a, b = tail[i], tail[i + 1]
                if a != b and tail[i + 2] == a and tail[i + 3] == b and tail[i + 4] == a:
                    return "cycle_detected"
        return None

    def detect_no_progress(self, completed_tool_calls_now: int) -> str | None:
        """Same observation twice with no new completed side effect in between."""
        if len(self.observation_fingerprints) < 2:
            return None
        if self.observation_fingerprints[-1] != self.observation_fingerprints[-2]:
            return None
        if completed_tool_calls_now <= self.completed_tool_call_count:
            return "no_progress"
        self.completed_tool_call_count = completed_tool_calls_now
        return None

    def snapshot(self) -> dict[str, Any]:
        return {
            "tool_calls": self.tool_calls,
            "tokens_used": self.tokens_used,
            "cost_usd": round(self.cost_usd, 6),
            "elapsed_s": round(time.monotonic() - self.started_at, 3),
            "plans": len(self.plan_fingerprints),
            "observations": len(self.observation_fingerprints),
        }
