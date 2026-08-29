"""Graph routing — wraps existing router/supervisor, no reimplementation."""

from __future__ import annotations

from typing import Any

# Reuse existing deterministic classifiers — do not copy logic
try:
    from ..orchestrator.router import AGENT_REGISTRY, classify_intent, CATEGORY_KEYWORDS  # type: ignore
except Exception:  # pragma: no cover
    AGENT_REGISTRY = {}  # type: ignore
    CATEGORY_KEYWORDS = {}  # type: ignore
    def classify_intent(msg: str):  # type: ignore
        return ("memory", 0.5)

try:
    from ..orchestrator.supervisor import (  # type: ignore
        PARALLEL_SAFE,
        SEQUENTIAL_CHAINS,
        _build_dag,
        _detect_subtasks,
    )
except Exception:  # pragma: no cover
    PARALLEL_SAFE = set()
    SEQUENTIAL_CHAINS = []
    def _detect_subtasks(msg: str):  # type: ignore
        return []
    def _build_dag(subtasks):  # type: ignore
        return [[s] for s in subtasks]


async def route_classify(task: str) -> dict[str, Any]:
    agent, conf = await classify_intent(task or "")
    return {"agent": agent, "confidence": float(conf)}


async def route_classify_structured(task: str) -> dict[str, Any]:
    """
    Structured routing with explainable provenance (LG-04).

    Builds RoutingDecision: primary/secondary, confidence, candidates,
    policy filtering, final_agent, provenance. Never exposes chain-of-thought.
    """
    from .contracts import validate_routing_decision

    msg = task or ""
    lower = msg.lower()
    # Collect candidate categories (keyword hits)
    scores: dict[str, int] = {}
    try:
        for cat, kws in CATEGORY_KEYWORDS.items():
            scores[cat] = sum(1 for kw in kws if kw in lower)
    except Exception:
        scores = {}

    # Candidates: all categories with score>0, sorted by score desc
    cands_sorted = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    secondary: list[str] = [cat for cat, sc in cands_sorted if sc > 0][:3]

    routed = await route_classify(msg)
    agent = routed.get("agent", "memory")
    conf = float(routed.get("confidence", 0.5))

    # Policy filtering already includes MVP scope in orchestrator; replicate minimal filter for graph path
    policy_filtered: list[str] = []
    try:
        from ..orchestrator.router import MVP_CANONICAL_AGENTS  # type: ignore
        from ..config import settings as _s  # type: ignore

        if _s.mvp_scope_enforced and agent not in MVP_CANONICAL_AGENTS:
            policy_filtered = [agent]
            agent = "memory"
            conf = 0.55
    except Exception:
        pass

    # Validate agent known else fallback (fail-closed to memory)
    if not is_valid_agent(agent):
        policy_filtered.append(agent)
        agent = "memory"
        conf = 0.5

    # Determine primary/secondary intents from scores
    primary = max(scores, key=lambda k: scores[k]) if scores and max(scores.values()) > 0 else agent
    secondary_intents = [c for c in secondary if c != primary][:2]

    decision: dict[str, Any] = {
        "primary_intent": primary,
        "secondary_intents": secondary_intents,
        "confidence": float(conf),
        "candidate_agents": [agent] + [c for c in secondary_intents[:2] if c not in (agent,)],
        "policy_filtered": policy_filtered,
        "final_agent": agent,
        "provenance": {
            "keywordsMatched": {k: v for k, v in scores.items() if v > 0},
            "tied": len([s for s in scores.values() if s == max(scores.values())]) if scores else 0,
            "mvpFiltered": bool(policy_filtered),
        },
        "explain": {"route": f"keywords->{agent} conf={conf:.2f}"},
        "schema_version": 1,
    }
    try:
        validate_routing_decision(decision)
    except ValueError:
        # fallback safe
        decision = {
            "primary_intent": "memory",
            "secondary_intents": [],
            "confidence": 0.5,
            "candidate_agents": ["memory"],
            "policy_filtered": [],
            "final_agent": "memory",
            "provenance": {"keywordsMatched": {}},
            "explain": {"route": "fallback"},
            "schema_version": 1,
        }
    return decision


async def supervisor_dag(task: str) -> list[list[str]]:
    subtasks = await _detect_subtasks(task or "")
    if not subtasks:
        # fallback handled by caller (needs async classify) — return empty to let route decide
        return []
    dag = _build_dag(subtasks)
    return dag  # list[list[str]] layers


async def route_classify_sync(task: str) -> dict[str, Any]:
    """Sync wrapper for non-async contexts (fallback)."""
    try:
        return await route_classify(task)
    except Exception:
        return {"agent": "memory", "confidence": 0.5}


def is_valid_agent(agent_id: str) -> bool:
    return agent_id in AGENT_REGISTRY


def is_valid_agent_strict(agent_id: str) -> bool:
    """Strict variant — also checks type string bound."""
    if not isinstance(agent_id, str) or not agent_id or len(agent_id) > 64:
        return False
    return is_valid_agent(agent_id)
