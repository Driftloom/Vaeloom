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
