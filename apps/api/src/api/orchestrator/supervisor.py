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
# ADR-037 extends chains to cover common continuations (memory↔resume, github↔coding)
PARALLEL_SAFE = {"gmail", "scheduler", "organization", "memory", "research", "github", "analytics", "recommendation"}
SEQUENTIAL_CHAINS = [
    ["memory", "resume", "ats", "application"],
    ["career", "learning"],
    ["planning", "research"],
    ["github", "coding"],
    ["organization", "memory"],
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
            from .router import CATEGORY_AGENT_MAP  # local to avoid circular at top
            agents_in_cat = CATEGORY_AGENT_MAP.get(category, ["memory"])
            agent_name, conf = await classify_intent(message)
            if agent_name in agents_in_cat:
                if agent_name not in [c[0] for c in candidates]:
                    candidates.append((agent_name, confidence))
            else:
                primary = agents_in_cat[0]
                if primary not in [c[0] for c in candidates]:
                    candidates.append((primary, confidence))
    top_agent, top_conf = await classify_intent(message)
    if top_agent not in [c[0] for c in candidates] and top_conf >= 0.33:
        candidates.insert(0, (top_agent, top_conf))
    # MVP scope lock: filter to canonical agents when enforced (AC-02 fix)
    try:
        from ..config import settings as _settings
        if _settings.mvp_scope_enforced:
            from .router import MVP_CANONICAL_AGENTS
            candidates = [c for c in candidates if c[0] in MVP_CANONICAL_AGENTS]
    except Exception:
        pass
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
    # Inject prior context with provenance tagging (AC-07: prevent prompt injection via string concat)
    enriched_message = message
    if context:
        # Tag each prior output with source agent and untrusted marker
        ctx_parts = []
        for k, v in context.items():
            snippet = str(v)[:300].replace("\n", " ")
            ctx_parts.append(f"[from:{k} untrusted]{snippet}[end:{k}]")
        ctx_str = "; ".join(ctx_parts)
        if ctx_str:
            enriched_message = f"{message}\n\n[Prior step outputs (untrusted, provenance-tagged): {ctx_str}]"

    req = AgentRequest(agent=agent, request_id=f"{request_id}-{agent_name}", message=enriched_message, workspace_id=workspace_id, agent_name=agent_name)
    resp = await run_agent_loop(req)
    return {"agent_name": agent_name, "action": "suggest", "confidence": 0.85, "result": {"summary": resp.final_result, "details": resp.final_result, "proposals": [], "questions": []}, "status": resp.status}


def is_multi_agent_request(message: str) -> bool:
    """Synchronous heuristic check — used by router to decide supervisor vs single-agent."""
    if len(message.split()) < MULTI_AGENT_MIN_MESSAGE_WORDS:
        return False
    msg_lower = message.lower()
    # When MVP scope is enforced, only count canonical categories
    try:
        from ..config import settings as _settings
        if _settings.mvp_scope_enforced:
            from .router import MVP_CATEGORY_AGENT_MAP
            # Only count keywords for canonical categories
            canonical_cats = set(MVP_CATEGORY_AGENT_MAP.keys())
            matching_cats = sum(1 for cat, kws in CATEGORY_KEYWORDS.items() if cat in canonical_cats and any(kw in msg_lower for kw in kws))
            return matching_cats >= MULTI_AGENT_MIN_CATEGORIES
    except Exception:
        pass
    matching_cats = 0
    for keywords in CATEGORY_KEYWORDS.values():
        if any(kw in msg_lower for kw in keywords):
            matching_cats += 1
    return matching_cats >= MULTI_AGENT_MIN_CATEGORIES


async def _try_llm_planner(message: str, candidates: list[str]) -> list[list[str]] | None:
    """Optional LLM-powered DAG planner (SUPERVISOR_LLM_PLANNER=1).

    Asks the LLM to order the given candidate agents into execution layers.
    Falls back to heuristic on any failure (offline, no key, parse error).
    """
    import os as _os

    if _os.environ.get("SUPERVISOR_LLM_PLANNER", "").lower() not in ("1", "true", "yes"):
        return None
    try:
        from ..config import settings as _settings

        if not _settings.llm_api_key:
            return None
        from ..services.llm_service import llm_service

        # Keep prompt tiny and deterministic — only ordering, not new agents
        prompt = (
            "You are a DAG planner. Given the user request and candidate agents, "
            "return ONLY JSON: {\"layers\": [[\"agent\",...], ...]} where layers are "
            "sequential batches and agents inside one layer run in parallel. "
            "Use only agents from the candidate list, preserve all, order dependencies "
            f"(resume before ats, ats before application). Candidates: {candidates}\n\n"
            f"User request: {message[:600]}"
        )
        resp = await llm_service.generate_completion(
            [{"role": "user", "content": prompt}], temperature=0.1, max_tokens=300
        )
        import json as _json
        import re as _re
        txt = resp.get("content", "") or ""
        # Extract first JSON object
        m = _re.search(r"\{.*\}", txt, _re.DOTALL)
        if not m:
            return None
        data = _json.loads(m.group(0))
        layers = data.get("layers")
        if not isinstance(layers, list) or not layers:
            return None
        # Validate: all are lists of known candidates, no invented agents
        flat = []
        for layer in layers:
            if not isinstance(layer, list):
                return None
            for ag in layer:
                if ag not in candidates:
                    return None
                flat.append(ag)
        if set(flat) != set(candidates):
            return None
        # Must respect known sequential dependencies (heuristic safeguard)
        logger.info(f"SUPERVISOR LLM planner succeeded: {layers}")
        return layers
    except Exception as e:
        logger.debug(f"SUPERVISOR LLM planner fallback to heuristic ({e})")
        return None


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

    # Try LLM planner first when enabled, fallback to heuristic
    candidate_names = [a for a, _ in subtasks]
    llm_layers = await _try_llm_planner(message, candidate_names)
    if llm_layers is not None:
        layers = llm_layers
        planner = "llm"
    else:
        layers = _build_dag(subtasks)
        planner = "heuristic"
    logger.info(f"SUPERVISOR DAG: {layers} from subtasks {subtasks} (planner={planner})")

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
    """Streaming variant — yields per-agent events plus final merged done.

    Single-agent requests delegate to the full orchestrator stream so clients
    receive REAL token events (ADR-033); multi-agent layers keep agent-level
    granularity (parallel sub-run tokens would interleave chaotically).
    """
    request_id = request_id or str(uuid.uuid4())
    subtasks = await _detect_subtasks(message)
    if len(subtasks) < 2:
        top_agent = subtasks[0][0] if subtasks else "memory"
        yield {"event": "supervisor_start", "data": {"mode": "single", "agent": top_agent}}
        agent_cls = AGENT_REGISTRY.get(top_agent)
        if agent_cls is not None:
            from .loop import AgentRequest as _AgentRequest
            from .loop import run_agent_loop_stream

            agent_req = _AgentRequest(
                agent=agent_cls(),
                request_id=f"{request_id}-{top_agent}",
                message=message,
                workspace_id=workspace_id,
                agent_name=top_agent,
            )
            async for evt in run_agent_loop_stream(agent_req):
                etype = evt.get("event")
                if etype in ("token", "tool_start", "tool_result", "approval_required"):
                    yield evt
                elif etype == "done":
                    data = evt.get("data") or {}
                    final_text = str(data.get("result", "") or "")
                    result = {
                        "agent_name": top_agent,
                        "action": "suggest",
                        "confidence": 0.85,
                        "result": {
                            "summary": final_text,
                            "details": final_text,
                            "proposals": [],
                            "questions": [],
                        },
                        "status": data.get("status", "success"),
                    }
                    yield {"event": "supervisor_agent_done", "data": result}
                    yield {"event": "done", "data": result}
                    return
        # Registry miss or stream produced no terminal event — blocking fallback
        result = await _run_single_agent(top_agent, message, workspace_id, request_id)
        yield {"event": "supervisor_agent_done", "data": result}
        yield {"event": "done", "data": result}
        return

    candidate_names = [a for a, _ in subtasks]
    llm_layers = await _try_llm_planner(message, candidate_names)
    if llm_layers is not None:
        layers = llm_layers
        planner = "llm"
    else:
        layers = _build_dag(subtasks)
        planner = "heuristic"
    logger.info(f"SUPERVISOR stream DAG: {layers} (planner={planner})")
    yield {"event": "supervisor_start", "data": {"dag": layers, "subtasks": [a for a, _ in subtasks], "planner": planner}}

    context: dict[str, Any] = {}
    all_proposals: list[dict[str, Any]] = []
    all_details: list[dict[str, Any]] = []
    summaries: list[str] = []

    for layer_idx, layer in enumerate(layers):
        yield {"event": "supervisor_layer_start", "data": {"layer": layer_idx, "agents": layer, "planner": planner}}
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
