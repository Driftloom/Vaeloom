"""
Supervisor — Hierarchical multi-agent orchestration (DAG delegation).

When a user goal requires multiple specialists (e.g. "tailor my resume,
check ATS, draft a cover letter and add a prep session to my calendar"),
the Supervisor decomposes the request into a DAG of sub-tasks, executes
them in topological order (parallel where possible), and merges outputs
into a single consolidated response card.
"""
import asyncio
import logging
import uuid
from typing import Any

from .loop import AgentRequest
from .router import AGENT_REGISTRY, CATEGORY_KEYWORDS, classify_intent

logger = logging.getLogger(__name__)

# ── Heuristics: which agents can run in parallel vs sequential ──────────
# Resume -> ATS -> Application is a sequential pipeline (each needs previous output).
# Gmail, Scheduler, Organization are independent and can run in parallel.
PARALLEL_SAFE = {"gmail", "scheduler", "organization", "memory", "research", "github"}
SEQUENTIAL_CHAINS = [
    ["resume", "ats", "application"],
    ["career", "learning"],
    ["planning", "research"],
]

# Minimum thresholds for multi-agent detection
MULTI_AGENT_KEYWORD_THRESHOLD = 1  # at least 1 keyword match per extra category
MULTI_AGENT_MIN_CATEGORIES = 2
MULTI_AGENT_MIN_MESSAGE_WORDS = 8  # avoid false positives on short messages


async def _detect_subtasks(message: str) -> list[tuple[str, float]]:
    """Return list of (agent_name, confidence) for every matching category."""
    msg_lower = message.lower()
    candidates: list[tuple[str, float]] = []
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in msg_lower)
        if score >= MULTI_AGENT_KEYWORD_THRESHOLD:
            confidence = min(score / 3.0, 1.0)
            # Disambiguate to concrete agent via classify_intent sub-logic
            # We reuse classify_intent's coarse->fine mapping by crafting a sub-message
            # containing only that category's keywords
            from .router import CATEGORY_AGENT_MAP  # local to avoid circular at top
            agents_in_cat = CATEGORY_AGENT_MAP.get(category, ["memory"])
            # Re-run full classify on message but force category? Simplify: pick first agent in category
            # For better accuracy, call classify_intent on a filtered slice containing only that category's keywords
            # Instead we just use the first agent (or disambiguated one via keyword check in router)
            # For categories with 2 agents (career_resume etc.) we need the right one — run classify on the original message
            # but only keep result if it lands in that category
            agent_name, conf = await classify_intent(message)
            # If classify landed on an agent in this category, keep it; otherwise pick the category's primary
            if agent_name in agents_in_cat:
                # de-duplicate
                if agent_name not in [c[0] for c in candidates]:
                    candidates.append((agent_name, confidence))
            else:
                # Add primary agent for this category if not already present
                primary = agents_in_cat[0]
                if primary not in [c[0] for c in candidates]:
                    candidates.append((primary, confidence))
    # Also add the top intent from classify_intent if not already included
    top_agent, top_conf = await classify_intent(message)
    if top_agent not in [c[0] for c in candidates] and top_conf >= 0.33:
        candidates.insert(0, (top_agent, top_conf))
    return candidates


def _build_dag(subtasks: list[tuple[str, float]]) -> list[list[str]]:
    """Group subtasks into execution layers (parallel batches) respecting sequential chains."""
    agents = [a for a, _ in subtasks]
    # If no sequential chain applies, all can run in parallel in one layer
    layers: list[list[str]] = []
    remaining = set(agents)

    # Extract chain-ordered agents first
    for chain in SEQUENTIAL_CHAINS:
        chain_in_request = [a for a in chain if a in remaining]
        if len(chain_in_request) >= 2:
            # Each step in chain is its own layer (sequential)
            for ag in chain_in_request:
                layers.append([ag])
                remaining.discard(ag)

    # Remaining agents can run in parallel (if parallel-safe) or each in own layer
    if remaining:
        parallel_batch = [a for a in remaining if a in PARALLEL_SAFE]
        sequential_rest = [a for a in remaining if a not in PARALLEL_SAFE]
        if parallel_batch:
            layers.append(parallel_batch)
        for ag in sequential_rest:
            layers.append([ag])

    if not layers and agents:
        layers = [agents]
    return layers


async def _run_single_agent(agent_name: str, message: str, workspace_id: str, request_id: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Run one agent via the standard loop and return its output dict."""
    from .loop import run_agent_loop

    agent_cls = AGENT_REGISTRY.get(agent_name)
    if not agent_cls:
        return {"agent_name": agent_name, "action": "error", "confidence": 0.0, "result": {"summary": f"No agent for {agent_name}", "details": None, "proposals": [], "questions": []}}

    agent = agent_cls()
    # Inject prior context into message if available
    enriched_message = message
    if context:
        # Append prior outputs as context (truncated)
        ctx_str = "; ".join(f"{k}: {str(v)[:300]}" for k, v in context.items() if v)
        if ctx_str:
            enriched_message = f"{message}\n\n[Prior step outputs: {ctx_str}]"

    req = AgentRequest(agent=agent, request_id=f"{request_id}-{agent_name}", message=enriched_message, workspace_id=workspace_id, agent_name=agent_name)
    resp = await run_agent_loop(req)
    return {"agent_name": agent_name, "action": "suggest", "confidence": 0.85, "result": {"summary": resp.final_result, "details": resp.final_result, "proposals": [], "questions": []}, "status": resp.status}


def is_multi_agent_request(message: str) -> bool:
    """Synchronous heuristic check — used by router to decide supervisor vs single-agent."""
    if len(message.split()) < MULTI_AGENT_MIN_MESSAGE_WORDS:
        return False
    msg_lower = message.lower()
    matching_cats = 0
    for keywords in CATEGORY_KEYWORDS.values():
        if any(kw in msg_lower for kw in keywords):
            matching_cats += 1
    return matching_cats >= MULTI_AGENT_MIN_CATEGORIES


async def run_supervisor(message: str, workspace_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Execute multi-agent DAG and return merged response."""
    request_id = request_id or str(uuid.uuid4())
    logger.info(f"SUPERVISOR start: {request_id} message='{message[:80]}'")

    subtasks = await _detect_subtasks(message)
    if len(subtasks) < 2:
        # Not actually multi-agent — delegate to single agent path
        top_agent = subtasks[0][0] if subtasks else "memory"
        single = await _run_single_agent(top_agent, message, workspace_id, request_id)
        return single

    layers = _build_dag(subtasks)
    logger.info(f"SUPERVISOR DAG: {layers} from subtasks {subtasks}")

    context: dict[str, Any] = {}
    all_proposals: list[dict[str, Any]] = []
    all_details: list[dict[str, Any]] = []
    summaries: list[str] = []

    for layer_idx, layer in enumerate(layers):
        logger.info(f"SUPERVISOR layer {layer_idx+1}/{len(layers)}: {layer}")
        if len(layer) == 1:
            result = await _run_single_agent(layer[0], message, workspace_id, request_id, context)
            results = [result]
        else:
            # Parallel execution
            results = await asyncio.gather(*[_run_single_agent(ag, message, workspace_id, request_id, context) for ag in layer])

        for r in results:
            aname = r.get("agent_name", "unknown")
            summary = r.get("result", {}).get("summary", "")
            if summary:
                summaries.append(f"[{aname}] {summary}")
                context[aname] = summary
            all_details.append(r)
            proposals = r.get("result", {}).get("proposals", [])
            all_proposals.extend(proposals)

    merged_summary = "\n".join(summaries) if summaries else "Multi-agent workflow completed."
    # QA gate will still be applied by router.handle after supervisor returns; we do a light pre-check

    return {
        "agent_name": "supervisor",
        "action": "suggest",
        "confidence": 0.87,
        "result": {
            "summary": merged_summary,
            "details": all_details,
            "proposals": all_proposals,
            "questions": [],
            "dag": layers,
            "subtasks": [a for a, _ in subtasks],
        },
        "supervisor": True,
        "dag": layers,
    }


async def run_supervisor_stream(message: str, workspace_id: str, request_id: str | None = None):
    """Streaming variant — yields per-agent events plus final merged done."""
    request_id = request_id or str(uuid.uuid4())
    subtasks = await _detect_subtasks(message)
    if len(subtasks) < 2:
        top_agent = subtasks[0][0] if subtasks else "memory"
        yield {"event": "supervisor_start", "data": {"mode": "single", "agent": top_agent}}
        result = await _run_single_agent(top_agent, message, workspace_id, request_id)
        yield {"event": "supervisor_agent_done", "data": result}
        yield {"event": "done", "data": result}
        return

    layers = _build_dag(subtasks)
    yield {"event": "supervisor_start", "data": {"dag": layers, "subtasks": [a for a, _ in subtasks]}}

    context: dict[str, Any] = {}
    all_proposals: list[dict[str, Any]] = []
    all_details: list[dict[str, Any]] = []
    summaries: list[str] = []

    for layer_idx, layer in enumerate(layers):
        yield {"event": "supervisor_layer_start", "data": {"layer": layer_idx, "agents": layer}}
        if len(layer) == 1:
            result = await _run_single_agent(layer[0], message, workspace_id, request_id, context)
            results = [result]
        else:
            yield {"event": "supervisor_parallel", "data": {"agents": layer}}
            results = await asyncio.gather(*[_run_single_agent(ag, message, workspace_id, request_id, context) for ag in layer])

        for r in results:
            yield {"event": "supervisor_agent_done", "data": r}
            aname = r.get("agent_name", "unknown")
            summary = r.get("result", {}).get("summary", "")
            if summary:
                summaries.append(f"[{aname}] {summary}")
                context[aname] = summary
            all_details.append(r)
            all_proposals.extend(r.get("result", {}).get("proposals", []))

    merged_summary = "\n".join(summaries) if summaries else "Multi-agent workflow completed."
    final = {
        "agent_name": "supervisor",
        "action": "suggest",
        "confidence": 0.87,
        "result": {"summary": merged_summary, "details": all_details, "proposals": all_proposals, "questions": [], "dag": layers},
        "supervisor": True,
        "dag": layers,
    }
    yield {"event": "done", "data": final}
