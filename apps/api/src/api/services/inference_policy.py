"""Inference policy + tool trust boundary.

Implements §16-18, §20-22 of the Harness spec as an additive layer over
the existing model_router + tool executor (no hot-path rewrites):

- route(): risk/latency/cost-aware model selection with explicit fallback
  chain recording (primary -> compatible -> secondary -> degraded).
- ToolTrust: risk classification (READ..DESTRUCTIVE), output quarantine,
  minimal output-schema validation, deterministic idempotency keys.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any, Literal

from .model_router import MODEL_CATALOG, model_router

ToolRisk = Literal["READ", "SEARCH", "ANALYZE", "TRANSFORM", "WRITE", "ACT", "DESTRUCTIVE"]

# Static risk classification. MCP-bridged tools default to ACT (approval-gated
# unless registered read-only) — enforced in register_dynamic_tool path.
TOOL_RISK: dict[str, ToolRisk] = {
    "search_documents": "SEARCH", "query_graph": "SEARCH", "get_entity": "READ",
    "search_gmail": "SEARCH", "search_jobs": "SEARCH", "list_calendar_events": "READ",
    "list_drive_files": "READ", "search_drive": "SEARCH",
    "read_google_doc": "READ", "create_google_doc": "WRITE", "append_google_doc": "WRITE", "replace_google_doc_text": "WRITE",
    "create_entity": "WRITE", "merge_entities": "WRITE", "categorize_document": "WRITE",
    "draft_outlook_mail": "WRITE", "draft_email": "WRITE",
    "create_calendar_event": "ACT", "create_outlook_calendar_event": "ACT",
    "send_slack_message": "ACT", "create_github_issue": "ACT",
    "create_github_pull_request": "ACT", "execute_code_sandbox": "DESTRUCTIVE",
}


def classify_tool(tool_name: str) -> ToolRisk:
    if tool_name.startswith("mcp__"):
        return "ACT"  # untrusted external tools are ACT by default
    return TOOL_RISK.get(tool_name, "ANALYZE")


# Muse §26 consequential-action model. Maps the fine-grained ToolRisk onto
# five action tiers with explicit approval semantics. This table is
# DECLARATIVE: it never grants authorization by itself. The loader-level
# guarantee (proven by test) is that every CONSEQUENTIAL_WRITE or higher
# tool is a member of the executor's approval-gated set — model output
# saying "approved"/"send it"/"execute" can never substitute for the
# single-use approval token consumed at the executor boundary.
ActionTier = Literal[
    "READ", "LOW_RISK_WRITE", "CONSEQUENTIAL_WRITE",
    "EXTERNAL_COMMUNICATION", "FINANCIAL_LEGAL_IRREVERSIBLE",
]

_TOOL_RISK_TO_ACTION_TIER: dict[ToolRisk, ActionTier] = {
    "READ": "READ",
    "SEARCH": "READ",
    "ANALYZE": "READ",
    "TRANSFORM": "LOW_RISK_WRITE",
    "WRITE": "CONSEQUENTIAL_WRITE",
    "ACT": "EXTERNAL_COMMUNICATION",
    "DESTRUCTIVE": "FINANCIAL_LEGAL_IRREVERSIBLE",
}

# Tools whose blast radius exceeds their static risk class (external send,
# irreversible publish). Explicit so the mapping stays reviewable.
_ACTION_TIER_OVERRIDES: dict[str, ActionTier] = {
    "send_slack_message": "EXTERNAL_COMMUNICATION",
    "draft_email": "EXTERNAL_COMMUNICATION",
    "draft_outlook_mail": "EXTERNAL_COMMUNICATION",
    "create_github_issue": "EXTERNAL_COMMUNICATION",
    "create_github_pull_request": "EXTERNAL_COMMUNICATION",
    "execute_code_sandbox": "FINANCIAL_LEGAL_IRREVERSIBLE",
}


def action_tier(tool_name: str) -> ActionTier:
    """Consequential-action tier for a tool (deterministic, no LLM)."""
    if tool_name in _ACTION_TIER_OVERRIDES:
        return _ACTION_TIER_OVERRIDES[tool_name]
    if tool_name.startswith("mcp__"):
        return "EXTERNAL_COMMUNICATION"  # untrusted external tools fail high
    return _TOOL_RISK_TO_ACTION_TIER.get(classify_tool(tool_name), "CONSEQUENTIAL_WRITE")


def tier_requires_approval(tier: ActionTier) -> bool:
    """Tiers at/above CONSEQUENTIAL_WRITE must hold a consumed approval token."""
    return tier in ("CONSEQUENTIAL_WRITE", "EXTERNAL_COMMUNICATION", "FINANCIAL_LEGAL_IRREVERSIBLE")


@dataclass
class RouteDecision:
    model: str
    provider: str
    tier: str
    fallback_chain: list[str] = field(default_factory=list)
    degraded: bool = False
    reason: str = ""
    estimated_cost_usd: float = 0.0


def route(
    task_type: str,
    *,
    risk: str = "low",
    complexity: str = "medium",  # simple|medium|complex
    context_tokens: int = 1000,
    latency_target: str = "normal",  # fast|normal|thorough
    provider_health: dict[str, bool] | None = None,
) -> RouteDecision:
    """Budget/latency/risk-aware routing.

    Rules (legible, deterministic):
    - simple + fast latency           -> fast tier
    - high/critical risk              -> powerful tier + verification note
    - complex or large context (>6k)  -> powerful tier
    - unhealthy primary provider      -> fall back to healthy provider same tier
    """
    provider_health = provider_health or {}
    if risk in ("high", "critical"):
        tier, reason = "powerful", f"risk={risk} -> strongest + verification"
    elif complexity == "simple" or latency_target == "fast":
        tier, reason = "fast", f"complexity={complexity} latency={latency_target} -> fast"
    elif complexity == "complex" or context_tokens > 6000 or latency_target == "thorough":
        tier, reason = "powerful", "complex/large-context -> powerful"
    else:
        tier, reason = "balanced", "default balanced"

    cfg = model_router.select_model(task_type, force_tier=tier)
    chain = [cfg.name]
    if provider_health and provider_health.get(cfg.provider) is False:
        # find same-tier model on a healthy provider
        for cand in MODEL_CATALOG.values():
            if cand.tier == tier and provider_health.get(cand.provider, True):
                chain.append(cand.name)
                cfg = cand
                reason += f"; fallback {chain[0]}->{cand.name} (provider {chain[0]} unhealthy)"
                break
        else:
            reason += "; all same-tier providers unhealthy -> degraded"
            return RouteDecision(model=cfg.name, provider=cfg.provider, tier=tier,
                                 fallback_chain=chain, degraded=True, reason=reason)
    est = round((context_tokens / 1000) * cfg.cost_per_1k_input, 6)
    return RouteDecision(model=cfg.name, provider=cfg.provider, tier=tier,
                         fallback_chain=chain, reason=reason, estimated_cost_usd=est)


def sanitize_tool_output(tool_name: str, output: Any, max_chars: int = 6000) -> tuple[str, bool]:
    """Quarantine tool output as untrusted data. Returns (safe_text, flagged)."""
    from .prompt_compiler import quarantine
    text = output if isinstance(output, str) else json.dumps(output, default=str)
    return quarantine(text[:max_chars], source=f"tool:{tool_name}")


def validate_tool_output(output: Any, schema: dict[str, Any] | None) -> list[str]:
    """Minimal deterministic output-schema validation (type/required only).

    Full JSON-Schema validation stays in the API layer; this catches the
    shape violations that indicate a misbehaving/malicious tool without
    adding a dependency.
    """
    if not schema:
        return []
    problems: list[str] = []
    if schema.get("type") == "object" and not isinstance(output, dict):
        problems.append(f"expected object, got {type(output).__name__}")
        return problems
    if isinstance(output, dict):
        for req in schema.get("required", []) or []:
            if req not in output:
                problems.append(f"missing required field: {req}")
    return problems


def idempotency_key(execution_id: str, tool_name: str, params: dict[str, Any]) -> str:
    """Deterministic idempotency key: same (execution, tool, params) -> same key.

    Retries reuse the key; distinct params produce distinct keys so a retry
    never accidentally replays a *different* action.
    """
    canonical = json.dumps(params or {}, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(f"{execution_id}|{tool_name}|{canonical}".encode()).hexdigest()[:24]


def record_fallback(agent_name: str, task_type: str, chain: list[str], reason: str) -> dict[str, Any]:
    rec = {"timestamp": time.time(), "agent_name": agent_name, "task_type": task_type,
           "chain": chain, "reason": reason}
    try:
        from .agent_runtime import agent_runtime
        agent_runtime._shadow_log.append({"type": "model_fallback", **rec})
    except Exception:
        pass
    return rec
