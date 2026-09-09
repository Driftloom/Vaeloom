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


# ── Provider failure taxonomy (Muse cross-provider fallback completion) ──
# Every provider error maps to exactly one category with explicit policy:
#   fallback_allowed: may the chain try another candidate?
#   retry_same:       may the same candidate be retried (tenacity)?
#   try_different_provider: may the chain hop provider boundaries?
#   terminal:         must the chain abort immediately (no fallback)?
# Fallback on auth/invalid/context/capability errors is unsafe or meaningless:
# a 401 will 401 on every model, a 400 will 400 again, and blind retries burn
# budget while leaking latency. Those are TERMINAL by design.

FailurePolicy = dict[str, bool]

FAILURE_TAXONOMY: dict[str, dict[str, Any]] = {
    # Retryable transport / capacity failures → full fallback allowed.
    "timeout": {"fallback_allowed": True, "retry_same": True, "try_different_provider": True, "terminal": False},
    "rate_limit": {"fallback_allowed": True, "retry_same": True, "try_different_provider": True, "terminal": False},
    "server_5xx": {"fallback_allowed": True, "retry_same": True, "try_different_provider": True, "terminal": False},
    "provider_unavailable": {"fallback_allowed": True, "retry_same": False, "try_different_provider": True, "terminal": False},
    "network": {"fallback_allowed": True, "retry_same": True, "try_different_provider": True, "terminal": False},
    # Terminal: fallback cannot help and must not be attempted.
    "auth_failure": {"fallback_allowed": False, "retry_same": False, "try_different_provider": False, "terminal": True},
    "invalid_request": {"fallback_allowed": False, "retry_same": False, "try_different_provider": False, "terminal": True},
    "context_limit": {"fallback_allowed": False, "retry_same": False, "try_different_provider": False, "terminal": True},
    "unsupported_capability": {"fallback_allowed": False, "retry_same": False, "try_different_provider": False, "terminal": True},
    # Unknown: one cautious hop (never blind chains); tenacity still retries.
    "unknown": {"fallback_allowed": True, "retry_same": True, "try_different_provider": True, "terminal": False},
}


def classify_provider_failure(
    status_code: int | None = None,
    error_text: str = "",
    exception_type: str = "",
) -> dict[str, Any]:
    """Map a provider failure to its taxonomy category + policy.

    Pure function (no I/O) so the taxonomy is unit-testable and auditable.
    """
    text = f"{error_text or ''}".lower()
    etype = f"{exception_type or ''}".lower()

    def _pack(category: str) -> dict[str, Any]:
        pol = dict(FAILURE_TAXONOMY[category])
        pol["category"] = category
        return pol

    # Explicit timeout / network signals first (exception-type driven).
    if "timeout" in etype or "timeout" in text:
        return _pack("timeout")
    if "network" in etype or "connecterror" in etype or "connection" in text:
        return _pack("network")
    # Status-code driven taxonomy.
    if status_code == 401 or status_code == 403:
        return _pack("auth_failure")
    if status_code == 429:
        return _pack("rate_limit")
    if status_code in (500, 502, 503, 504):
        return _pack("server_5xx")
    if status_code in (400, 404, 405, 422):
        if "context" in text and ("length" in text or "token" in text or "too long" in text or "maximum" in text):
            return _pack("context_limit")
        return _pack("invalid_request")
    if status_code == 413:
        return _pack("context_limit")
    if status_code in (501, 505):
        return _pack("unsupported_capability")
    # Text-driven fallback when no status code is available.
    if "rate limit" in text or "rate_limit" in text or "too many requests" in text:
        return _pack("rate_limit")
    if "context" in text and ("token" in text or "length" in text):
        return _pack("context_limit")
    if "invalid" in text and "request" in text or "bad request" in text:
        return _pack("invalid_request")
    if "unauthorized" in text or "forbidden" in text or "invalid api key" in text or "incorrect api key" in text:
        return _pack("auth_failure")
    if "not supported" in text or "unsupported" in text:
        return _pack("unsupported_capability")
    if "service unavailable" in text or "overloaded" in text or "capacity" in text:
        return _pack("provider_unavailable")
    if status_code is not None and 500 <= status_code <= 599:
        return _pack("server_5xx")
    return _pack("unknown")


# ── Provider outcome counters (operator observability) ─────────────────
# In-memory counters (Redis-ready pattern, same as agent_costs): total calls,
# failures by category, fallbacks executed, requests ultimately served, and
# accumulated latency per provider. Answers: how often is A failing? how often
# do we fall back? who ultimately served? how much latency did fallback add?

_provider_stats: dict[str, dict[str, Any]] = {}


def record_provider_outcome(
    provider: str,
    *,
    success: bool,
    latency_ms: float = 0.0,
    failure_category: str | None = None,
    fallback_hop: bool = False,
    served_after_fallback: bool = False,
) -> dict[str, Any]:
    entry = _provider_stats.setdefault(provider, {
        "total": 0, "success": 0, "failure": 0,
        "failures_by_category": {}, "fallback_hops": 0,
        "served_after_fallback": 0, "latency_ms_total": 0.0,
    })
    entry["total"] += 1
    entry["latency_ms_total"] = round(entry["latency_ms_total"] + float(latency_ms or 0.0), 3)
    if success:
        entry["success"] += 1
    else:
        entry["failure"] += 1
        if failure_category:
            entry["failures_by_category"][failure_category] = \
                entry["failures_by_category"].get(failure_category, 0) + 1
    if fallback_hop:
        entry["fallback_hops"] += 1
    if served_after_fallback:
        entry["served_after_fallback"] += 1
    return dict(entry)


def get_provider_stats(provider: str | None = None) -> dict[str, Any]:
    if provider:
        return dict(_provider_stats.get(provider, {}))
    out: dict[str, Any] = {}
    for prov, entry in _provider_stats.items():
        avg = round(entry["latency_ms_total"] / entry["total"], 2) if entry["total"] else 0.0
        out[prov] = {**entry, "avg_latency_ms": avg,
                     "failure_rate": round(entry["failure"] / entry["total"], 4) if entry["total"] else 0.0}
    return out


def reset_provider_stats() -> None:
    _provider_stats.clear()
