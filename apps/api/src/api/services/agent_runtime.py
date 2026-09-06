"""Agent runtime with policy/budget/timeout/fallback/approval + shadow mode — CONT-P12 DEL-CONT-P12-01.

Task 1: shared runtime mission/tools/memory/risk/budget/timeout/fallback/approval.
Task 2: retrieved/tool content is UNTRUSTED, cannot change policy.
Task 7: shadow comparison quality/safety/lineage/latency/cost.
"""
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from .model_router import model_router


@dataclass
class AgentPolicy:
    name: str
    mission: str
    allowed_tools: list[str]
    max_budget_usd: float = 0.50
    timeout_s: float = 30.0
    max_retries: int = 2
    requires_approval: bool = False
    risk_budget: str = "low"  # low/medium/high
    fallback_agent: str | None = None
    kill_switch: bool = False  # per-phase kill switch 12.5
    version: str = "v1.0"
    owner: str = "AI/ML Engineer"


@dataclass
class AgentRunContext:
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    agent_name: str = ""
    policy: AgentPolicy | None = None
    input: dict[str, Any] = field(default_factory=dict)
    lineage: dict[str, Any] = field(default_factory=dict)
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    shadow: bool = False
    approved: bool = True
    started_at: float = field(default_factory=time.time)


class AgentRuntime:
    """Policy-enforced runtime; tool output is data, not instruction."""

    def __init__(self):
        self._policies: dict[str, AgentPolicy] = {}
        self._shadow_log: list[dict] = []

    def register_policy(self, policy: AgentPolicy) -> None:
        self._policies[policy.name] = policy

    def get_policy(self, name: str) -> AgentPolicy | None:
        return self._policies.get(name)

    def check_budget(self, ctx: AgentRunContext, additional_cost: float = 0) -> bool:
        if not ctx.policy:
            return True
        return (ctx.cost_usd + additional_cost) <= ctx.policy.max_budget_usd

    def check_timeout(self, ctx: AgentRunContext) -> bool:
        if not ctx.policy:
            return True
        return (time.time() - ctx.started_at) <= ctx.policy.timeout_s

    def sanitize_retrieved(self, content: str) -> str:
        """Task 2: retrieved content cannot change policy — strip instruction-like prefixes."""
        # Keep data, drop policy-override attempts (defense-in-depth with injection_classifier)
        markers = ["ignore previous instructions", "ignore all previous instructions", "system:", "you are now", "disregard policy", "delete files", "ignore all"]
        lower = content.lower()
        for m in markers:
            if m in lower:
                # flag but don't execute; return as quoted data
                return f"[UNTRUSTED_DATA quoted] {content[:2000]}"
        return content

    def record_cost(self, ctx: AgentRunContext, input_tokens: int, output_tokens: int, model_name: str) -> dict:
        from .model_router import MODEL_CATALOG
        cfg = MODEL_CATALOG.get(model_name) or MODEL_CATALOG.get("gpt-4o-mini")
        rec = model_router.record_usage(ctx.agent_name, "agent_run", cfg, input_tokens, output_tokens, ctx.latency_ms)
        ctx.cost_usd += rec["cost_usd"]
        ctx.lineage.update({"model": model_name, "tokens": {"in": input_tokens, "out": output_tokens}, "cost_usd": ctx.cost_usd})
        return rec

    def shadow_compare(self, primary: dict, candidate: dict) -> dict:
        """Task 7: compare quality/safety/lineage/latency/cost."""
        result = {
            "primary": primary,
            "candidate": candidate,
            "delta": {
                "latency_ms": candidate.get("latency_ms", 0) - primary.get("latency_ms", 0),
                "cost_usd": candidate.get("cost_usd", 0) - primary.get("cost_usd", 0),
                "quality": (candidate.get("quality", 0) or 0) - (primary.get("quality", 0) or 0),
            },
            "verdict": "candidate_better" if candidate.get("quality", 0) > primary.get("quality", 0) and candidate.get("cost_usd", 999) <= primary.get("cost_usd", 999) * 1.2 else "primary_stays",
            "timestamp": time.time(),
        }
        self._shadow_log.append(result)
        return result

    def kill_switch_tripped(self, agent_name: str) -> bool:
        p = self._policies.get(agent_name)
        return bool(p and p.kill_switch)


agent_runtime = AgentRuntime()

# Seed policies for 8 core agents (expand-contract: shadow for new 20 enterprise agents later)
for _name, _mission, _tools in [
    ("memory", "Extract/merge memory with provenance", ["memory_create", "memory_update"]),
    ("retrieval", "Hybrid retrieval with provenance", ["search_all", "search_memories", "kg_traverse"]),
    ("resume", "Generate resume with provenance", ["resume_generate", "ats_score"]),
    ("job_search", "Fan-out Greenhouse/Lever dedup", ["job_search", "browse_job_page"]),
    ("gmail", "Classify draft-only NEVER send", ["gmail_classify", "gmail_draft"]),
    ("scheduler", "Schedule with conflict check", ["schedule_create"]),
    ("github", "GitHub 7 tools least privilege", ["github_tools"]),
    ("research", "Research with tool data quarantine", ["browse_job_page", "scrape_company_insights"]),
]:
    agent_runtime.register_policy(AgentPolicy(name=_name, mission=_mission, allowed_tools=_tools))
