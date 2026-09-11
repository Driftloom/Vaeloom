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


def _evaluate_conditional_branches(layer_results: list[dict[str, Any]], remaining_layers: list[list[str]]) -> list[list[str]]:
    """Inspect intermediate results and dynamically add or prune DAG layers."""
    updated = [list(l) for l in remaining_layers]
    for r in layer_results:
        aname = r.get("agent_name", "")
        res = r.get("result", {}) or {}
        # Dynamic Branch Rule 1: ATS score under threshold -> inject resume tailor/rewrite step if not already queued
        if aname == "ats":
            score = res.get("ats_score") or res.get("score")
            if score is None:
                summary_txt = str(res.get("summary", ""))
                import re as _re
                match = _re.search(r"(\d{1,3})\s*(?:/\s*100|%|points)?", summary_txt)
                if match:
                    try:
                        score = float(match.group(1))
                    except Exception:
                        score = None
            if score is not None and score < 75:
                already_queued = any("resume" in l for l in updated)
                if not already_queued:
                    logger.info(f"Conditional DAG branch: ATS score {score} < 75 -> inserting resume rewrite layer")
                    updated.insert(0, ["resume"])

        # Dynamic Branch Rule 2: Explicit required_agents returned in result
        required = res.get("required_agents", [])
        if isinstance(required, list):
            for req_ag in required:
                if isinstance(req_ag, str) and not any(req_ag in l for l in updated):
                    logger.info(f"Conditional DAG branch: dynamically adding required agent {req_ag}")
                    updated.append([req_ag])

    return updated


def _detect_pending_approvals(layer_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Scan layer results for any actions or proposals requiring human approval."""
    pending = []
    for r in layer_results:
        if r.get("action") == "request_approval":
            pending.append({
                "agent_name": r.get("agent_name"),
                "reason": r.get("result", {}).get("summary", "Action requires approval"),
                "payload": r.get("result"),
            })
        proposals = r.get("result", {}).get("proposals", [])
        if isinstance(proposals, list):
            for p in proposals:
                if isinstance(p, dict) and p.get("requires_approval"):
                    pending.append({
                        "agent_name": r.get("agent_name"),
                        "action_type": p.get("approval_type", "action"),
                        "proposal": p,
                    })
    return pending


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

    # Phase B §8: LoopController bounds the delegation fan-out — sub-agent
    # spawns, delegation cycles (A->B->A across layers), and wall-clock are
    # enforced here, on the live multi-agent path.
    from ..services.agent_contracts import ContractViolation, LoopController, LoopPolicy
    try:
        from ..config import settings as _settings
        _delegation_policy = LoopPolicy(
            max_iterations=len(layers) + 4,
            max_tool_calls=12 * max(1, len(candidate_names)),
            max_sub_agents=max(3, len(candidate_names)),
            max_duration_s=float(getattr(_settings, "agent_max_duration_s", 120.0) or 120.0),
        )
    except Exception:
        _delegation_policy = LoopPolicy()
    _controller = LoopController(_delegation_policy)
    _controller_snapshot: dict[str, Any] = {}

    layers_to_run = list(layers)
    layer_idx = 0

    while layer_idx < len(layers_to_run):
        layer = layers_to_run[layer_idx]
        logger.info(f"SUPERVISOR layer {layer_idx+1}/{len(layers_to_run)}: {layer}")
        try:
            _controller.before_step(f"layer:{layer_idx}")
        except ContractViolation as _cv:
            logger.warning(f"SUPERVISOR loop bound hit at layer {layer_idx}: {_cv}")
            break
        # Delegation bounds: max sub-agents via the controller; per-agent
        # re-spawn capped at 2 (initial + one conditional refinement) so a
        # dynamically injected resume->ats->resume->ats... cycle cannot loop
        # forever, while legitimate single refinement still runs.
        _spawn_counts: dict[str, int] = _controller_snapshot.get("spawn_counts", {}) if isinstance(_controller_snapshot, dict) else {}
        _pruned: list[str] = []
        for _ag in layer:
            _spawn_counts[_ag] = int(_spawn_counts.get(_ag, 0)) + 1
            if _spawn_counts[_ag] > 2:
                logger.warning(f"SUPERVISOR cycle bound: agent '{_ag}' spawned 3x — pruning from layer {layer_idx}")
                continue
            try:
                if _ag not in _controller.delegation_chain:
                    _controller.record_delegation(_ag)
            except ContractViolation as _cv:
                logger.warning(f"SUPERVISOR delegation bound hit for {_ag}: {_cv}")
                _spawn_counts[_ag] -= 1
                continue
            _pruned.append(_ag)
        layer = _pruned
        if not layer:
            # Entire layer pruned by cycle/delegation bounds — stop instead of
            # re-running a pruned agent.
            logger.warning(f"SUPERVISOR layer {layer_idx} fully pruned by bounds — stopping DAG")
            break
        if len(layer) == 1:
            result = await _run_single_agent(layer[0], message, workspace_id, request_id, context)
            results = [result]
        else:
            # Parallel execution
            results = await asyncio.gather(*[_run_single_agent(ag, message, workspace_id, request_id, context) for ag in layer])
        _controller.commit_step(f"layer:{layer_idx}")
        _controller_snapshot = _controller.snapshot()
        _controller_snapshot["spawn_counts"] = _spawn_counts

        for r in results:
            aname = r.get("agent_name", "unknown")
            summary = r.get("result", {}).get("summary", "")
            if summary:
                summaries.append(f"[{aname}] {summary}")
                context[aname] = summary
            all_details.append(r)
            proposals = r.get("result", {}).get("proposals", [])
            all_proposals.extend(proposals)

        # Dynamic conditional DAG evaluation based on intermediate results
        remaining_layers = layers_to_run[layer_idx + 1:]
        dyn_layers = _evaluate_conditional_branches(results, remaining_layers)
        if dyn_layers != remaining_layers:
            logger.info(f"SUPERVISOR dynamic DAG update: {dyn_layers}")
            layers_to_run = layers_to_run[:layer_idx + 1] + dyn_layers

        # Check for approval pause if subsequent work remains
        pending_approvals = _detect_pending_approvals(results)
        if pending_approvals and layer_idx + 1 < len(layers_to_run):
            from .state import LoopState, save_checkpoint

            state = LoopState(request_id, workspace_id=workspace_id)
            state.add_phase(f"supervisor_pause_{layer_idx}", {
                "status": "paused_awaiting_approval",
                "layer_idx": layer_idx,
                "remaining_layers": layers_to_run[layer_idx + 1:],
                "context": context,
                "all_details": all_details,
                "all_proposals": all_proposals,
                "summaries": summaries,
                "pending_approvals": pending_approvals,
                "message": message,
                "delegation": _controller_snapshot,
            })
            await save_checkpoint(state, workspace_id=workspace_id)
            return {
                "agent_name": "supervisor",
                "action": "request_approval",
                "status": "paused_awaiting_approval",
                "confidence": 0.85,
                "checkpoint_token": request_id,
                "pending_approvals": pending_approvals,
                "result": {
                    "summary": f"Workflow paused at layer {layer_idx + 1} awaiting human approval.",
                    "details": all_details,
                    "proposals": all_proposals,
                    "questions": [],
                    "dag": layers_to_run,
                },
                "supervisor": True,
                "dag": layers_to_run,
            }

        layer_idx += 1

    merged_summary = "\n".join(summaries) if summaries else "Multi-agent workflow completed."

    return {
        "agent_name": "supervisor",
        "action": "suggest",
        "confidence": 0.87,
        "status": "success",
        "result": {
            "summary": merged_summary,
            "details": all_details,
            "proposals": all_proposals,
            "questions": [],
            "dag": layers_to_run,
            "subtasks": [a for a, _ in subtasks],
        },
        "supervisor": True,
        "dag": layers_to_run,
        "delegation": _controller_snapshot,
    }


async def resume_supervisor(
    request_id: str,
    workspace_id: str,
    approval_decision: dict[str, Any],
) -> dict[str, Any]:
    """Resume a paused supervisor DAG workflow using its persisted checkpoint."""
    from .state import ForeignCheckpointError, load_or_create_state, save_checkpoint, validate_resume_identity

    state = await load_or_create_state(request_id, workspace_id=workspace_id)
    # LOOP-RESUME-01: supervisor resume honors the same trust gate (the
    # approval decision carries no identity; the workspace argument does).
    try:
        validate_resume_identity(state, workspace_id=workspace_id)
    except ForeignCheckpointError:
        return {
            "agent_name": "supervisor",
            "action": "error",
            "confidence": 0.0,
            "result": {"summary": f"Resume refused for {request_id}: checkpoint identity mismatch"},
            "status": "refused",
        }
    # Find latest pause phase
    pause_key = None
    for k in sorted(state.phases.keys(), reverse=True):
        if k.startswith("supervisor_pause_"):
            pause_key = k
            break

    if not pause_key:
        return {
            "agent_name": "supervisor",
            "action": "error",
            "confidence": 0.0,
            "result": {"summary": f"No paused supervisor checkpoint found for {request_id}"},
            "status": "not_found",
        }

    pause_data = state.phases[pause_key]
    decision_str = str(approval_decision.get("decision", "")).lower()

    if decision_str in ("rejected", "deny", "denied"):
        state.add_phase(f"supervisor_resume_{pause_data['layer_idx']}", {
            "status": "aborted",
            "reason": approval_decision.get("reason", "Human rejected approval request"),
        })
        await save_checkpoint(state, workspace_id=workspace_id)
        return {
            "agent_name": "supervisor",
            "action": "suggest",
            "confidence": 0.9,
            "status": "aborted",
            "result": {
                "summary": f"Workflow was aborted: {approval_decision.get('reason', 'Approval rejected by user.')}",
                "details": pause_data.get("all_details", []),
                "proposals": [],
                "questions": [],
            },
            "supervisor": True,
        }

    # Approved: restore context and resume remaining layers
    message = pause_data.get("message", "")
    context = dict(pause_data.get("context", {}))
    context["approval_decision"] = approval_decision
    all_details = list(pause_data.get("all_details", []))
    all_proposals = list(pause_data.get("all_proposals", []))
    summaries = list(pause_data.get("summaries", []))
    remaining_layers = list(pause_data.get("remaining_layers", []))

    logger.info(f"SUPERVISOR resuming {request_id} with remaining layers: {remaining_layers}")

    for idx, layer in enumerate(remaining_layers):
        if len(layer) == 1:
            result = await _run_single_agent(layer[0], message, workspace_id, request_id, context)
            results = [result]
        else:
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

    merged_summary = "\n".join(summaries) if summaries else "Resumed multi-agent workflow completed."
    state.add_phase("supervisor_completed", {"status": "completed", "summary": merged_summary})
    await save_checkpoint(state, workspace_id=workspace_id)

    return {
        "agent_name": "supervisor",
        "action": "suggest",
        "confidence": 0.88,
        "status": "completed",
        "result": {
            "summary": merged_summary,
            "details": all_details,
            "proposals": all_proposals,
            "questions": [],
        },
        "supervisor": True,
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
