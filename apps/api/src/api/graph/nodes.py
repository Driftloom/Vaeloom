"""LangGraph nodes — thin wrappers around existing orchestrator/tool/memory/policy.

Phase 2-12 upgrades: structured RoutingDecision, typed handoff, real dispatch,
per-tool quota, idempotency key, EvaluationResult, memory closed-loop hook.
Temporal still owns durability, Policy still owns authorization.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from .state import validate_graph_state, validate_handoff_state, validate_no_secrets, validate_workspace_binding
from .routing import route_classify, route_classify_structured, supervisor_dag
from .errors import (
    ApprovalRequiredError,
    KillSwitchError,
    QuotaExceededError,
    SecretPayloadError,
    ValidationError,
    WorkspaceMismatchError,
)

try:
    from ..temporal.interceptors import record_graph_span
except ImportError:
    from contextlib import nullcontext as record_graph_span  # type: ignore[assignment]

logger = logging.getLogger(__name__)


async def validate_input_node(state: dict[str, Any]) -> dict[str, Any]:
    with record_graph_span("validate_input", {"workspace_id": state.get("workspace_id"), "agent_id": state.get("agent_id")}):
        # Secret/payload/workspace checks are already done in build_initial_state,
        # re-validate on entry for defense-in-depth.
        validate_graph_state(state)
        validate_handoff_state(state)
        # Workspace binding — graph must not trust state merely because it claims workspace_valid
        ws = state.get("workspace_id") or ""
        try:
            validate_workspace_binding(state, ws)
        except Exception as we:
            raise WorkspaceMismatchError(str(we)) from we
        # Kill-switch pre-check (fail-closed in non-local, fail-open only in local dev)
        try:
            from ..infrastructure.agent_observability import kill_switch  # type: ignore
            from ..config import settings as _cs  # type: ignore

            ag = state.get("agent_id") or state.get("selected_agent") or ""
            if ag and not kill_switch.is_enabled(ag):
                raise KillSwitchError(f"agent {ag} disabled via kill switch")
        except KillSwitchError:
            raise
        except Exception as e:
            # Only fail-open when explicitly local; otherwise kill-switch unreadable → fail-closed
            try:
                from ..config import settings as _cs2  # type: ignore
                if getattr(_cs2, "service_environment", "local") != "local":
                    raise KillSwitchError(f"kill-switch unavailable — fail-closed: {e}") from e
            except KillSwitchError:
                raise
            except Exception:
                pass
            logger.debug("kill_switch check skipped (local): %s", e)
        # Adversarial prompt check (all severities log, critical blocks)
        try:
            from ..infrastructure.agent_eval import detect_adversarial_prompt  # type: ignore

            findings = detect_adversarial_prompt(state.get("task") or "")
            if any(getattr(f, "severity", "") == "critical" for f in findings):
                raise ValidationError("prompt flagged by adversarial filter")
            if findings:
                logger.debug("adversarial findings non-critical: %s", [getattr(f, "category", "") for f in findings])
        except ValidationError:
            raise
        except Exception:
            pass

        return {"execution_status": "routing", "metadata": {**state.get("metadata", {}), "node": "validate_input"}}


async def retrieve_context_node(state: dict[str, Any]) -> dict[str, Any]:
    # RAG context assembly: vector search (pgvector) → LIKE fallback → preferences + KG traverse.
    # On SQLite (dev/test), pgvector is unavailable — fallback returns empty arrays.
    # This is expected behavior, not a bug. In production with Postgres+pgvector,
    # real embeddings are returned. See F-RAG-01 (documented, not blocking).
    # Distinguishes: ok / empty / unavailable / timeout / error (never fabricated).
    rag = None
    rag_status: str = "ok"
    try:
        from ..orchestrator.loop import _assemble_rag_context  # type: ignore
        import asyncio as _asyncio

        # Bounded timeout — RAG must never block graph indefinitely
        try:
            rag = await _asyncio.wait_for(
                _assemble_rag_context(
                    state.get("workspace_id") or "", state.get("task") or "", type("A", (), {"memory_scopes": type("S", (), {"read_types": []})()})()
                ),
                timeout=5.0,
            )
        except _asyncio.TimeoutError:
            rag = {"entities": [], "documents": [], "preferences": []}
            rag_status = "timeout"
            logger.warning("retrieve_context timeout — status=timeout")
        # Truncate to bounds (8/8/5 already, but ensure 8KB via utf-8 bytes)
        if rag is not None and len(json.dumps(rag, default=str).encode("utf-8")) > 8192:
            # keep only IDs/names
            rag = {k: (v[:5] if isinstance(v, list) else v) for k, v in rag.items()}
            if len(json.dumps(rag, default=str).encode("utf-8")) > 8192:
                rag = {"entities": [], "documents": [], "preferences": []}
                rag_status = "error"
        # Determine empty vs ok (workspace filtering already done in _assemble_rag_context)
        if rag is not None and rag_status == "ok":
            if not rag.get("entities") and not rag.get("documents") and not rag.get("preferences"):
                rag_status = "empty"
            else:
                # Provenance tagging: retrieved entities are UNTRUSTED refs; keep bounded, never exec policy
                # Secret guard — ensure no secret leaked via RAG refs
                try:
                    validate_no_secrets(rag)
                except ValueError as se:
                    logger.warning("retrieve_context secret in rag refs redacted: %s", se)
                    rag = {"entities": [], "documents": [], "preferences": []}
                    rag_status = "error"
                else:
                    rag_status = "ok"
    except Exception as e:
        msg = str(e).lower()
        # Database unavailable vs generic error — distinguish for observability
        if any(k in msg for k in ("password authent", "could not connect", "connection", "operationalerror", "undefinedtable")):
            rag_status = "unavailable"
        else:
            rag_status = "error"
        logger.debug("retrieve_context fallback (status=%s): %s", rag_status, e)
        # Never fabricated content — always empty arrays on failure
        rag = {"entities": [], "documents": [], "preferences": []}
    return {"rag_context": rag, "rag_status": rag_status, "execution_status": "routing", "metadata": {**state.get("metadata", {}), "node": "retrieve_context", "rag_status": rag_status}}


async def route_node(state: dict[str, Any]) -> dict[str, Any]:
    task = state.get("task") or ""
    # Hardening §13: routing cannot bypass workspace/permissions/approval/quota/kill-switch — those are enforced downstream
    # Prefer structured decision for provenance (LG-04)
    try:
        routed_struct = await route_classify_structured(task)
        agent = routed_struct.get("final_agent") or routed_struct.get("agent") or "memory"
        conf = float(routed_struct.get("confidence", 0.5))
        decision = routed_struct
    except Exception:
        routed = await route_classify(task)
        agent = routed["agent"]
        conf = float(routed["confidence"])
        decision = {"final_agent": agent, "confidence": conf, "schema_version": 1}
    # Validate agent is known registry member; fallback to memory if unknown (fail-closed to known)
    try:
        from .routing import is_valid_agent  # type: ignore
        if not is_valid_agent(agent):
            agent = "memory"
            conf = 0.5
            if isinstance(decision, dict):
                decision["final_agent"] = agent
                decision["confidence"] = conf
    except Exception:
        pass
    # Low confidence → ask clarification is handled as finalizing, not separate graph branch
    return {
        "selected_agent": agent,
        "category": agent,  # simplified
        "execution_status": "executing_tool" if conf >= 0.7 else "finalizing",
        "metadata": {**state.get("metadata", {}), "route_confidence": conf, "route_decision": decision, "node": "route"},
    }


async def supervisor_node(state: dict[str, Any]) -> dict[str, Any]:
    task = state.get("task") or ""
    dag = await supervisor_dag(task)
    if not dag:
        # Fallback to single agent from route
        routed = await route_classify(task)
        dag = [[routed["agent"]]] if routed.get("agent") else []
    # Hardening: bounded DAG — no cycles, bounded depth/fan-out/node count, deterministic topology
    # Limits per §14: depth ≤5, fan-out ≤8, total nodes ≤20
    if dag:
        # Normalize: ensure list[list[str]]
        normed: list[list[str]] = []
        total = 0
        for layer in dag:
            if not isinstance(layer, list):
                layer = [str(layer)]
            # bound fan-out per layer
            layer = [str(x)[:64] for x in layer][:8]
            total += len(layer)
            if total > 20:
                # truncate total
                remaining = 20 - (total - len(layer))
                layer = layer[:max(0, remaining)]
                normed.append(layer)
                break
            normed.append(layer)
            if len(normed) > 5:
                normed = normed[:5]
                break
        # cycle check: no agent appears twice across layers
        seen: set[str] = set()
        deduped: list[list[str]] = []
        for layer in normed:
            nl = [a for a in layer if a not in seen]
            for a in nl:
                seen.add(a)
            if nl:
                deduped.append(nl)
        dag = deduped
        # Validate via contracts (fail-closed to single)
        try:
            from .contracts import validate_agent_plan

            validate_agent_plan({"dag": dag, "schema_version": 1})
        except ValueError as ve:
            logger.warning("supervisor dag invalid -> fallback single: %s", ve)
            routed = await route_classify(task)
            dag = [[routed.get("agent", "memory")]]
        # workspace preserved — dag stored in metadata only, provenance preserved via node tag
    # dag is list[list[str]] layers — store in metadata, not as unbounded state
    return {
        "metadata": {**state.get("metadata", {}), "dag": dag, "node": "supervisor"},
        "execution_status": "executing_tool",
    }


# ── Native Send fan-out (F-02) ──────────────────────────────────────────────
# Topology:
#   supervisor -> route_fanout --+-- Send(fanout_worker, task_1) --+--> fan_in -> tool_decision ...
#                                +-- Send(fanout_worker, task_2) --+
# Branches are read-only analysis: agent_node never executes tools itself
# (tool_execute lives downstream in the single main path), so fan-out cannot
# multiply side effects. Each branch returns ONLY its branch_results entry —
# never agent_node's raw update — so parallel branches cannot clobber the
# shared scalar keys (selected_tool, execution_status, result).
# v1 fans out the FIRST parallel layer only; later sequential layers are not
# re-entered (the previous behavior ran a single agent for the whole DAG).
MAX_FANOUT_BRANCHES = 8  # §14 fan-out bound (mirrors contracts.validate_agent_plan)


async def fanout_worker_node(state: dict[str, Any]) -> dict[str, Any]:
    """One Send-spawned branch: run a single agent, capture output as data.

    Never raises — a failing branch records a failed entry so fan-in still
    completes with the surviving branches (failure isolation).
    """
    ft = state.get("fanout_task") or {}
    agent = str(ft.get("agent") or state.get("selected_agent") or state.get("agent_id") or "memory")[:64]
    try:
        out = await agent_node({**state, "selected_agent": agent})
        result = out.get("result") or {}
        entry = {
            "agent": agent,
            "status": out.get("execution_status") or "finalizing",
            "summary": str(result.get("summary") or "")[:800],
            "selected_tool": out.get("selected_tool"),
        }
    except Exception as e:
        logger.warning("fanout branch failed agent=%s: %s", agent, e)
        entry = {"agent": agent, "status": "failed", "error": str(e)[:500]}
    return {"branch_results": [entry]}


async def fan_in_node(state: dict[str, Any]) -> dict[str, Any]:
    """Merge reducer-collected branch outputs into one result (F-02 fan-in).

    Routes onward with no selected_tool, so the main flow continues through
    tool_decision -> evaluate -> finalize exactly like the single-agent path.
    """
    branches = [b for b in (state.get("branch_results") or []) if isinstance(b, dict)]
    failed = [b for b in branches if b.get("status") == "failed"]
    succeeded = [b for b in branches if b.get("status") != "failed"]
    summary = "; ".join(
        f"{b.get('agent')}: {b.get('summary') or b.get('error') or ''}" for b in branches
    )[:2000]
    return {
        "result": {
            "summary": summary,
            "fanout": {"branches": len(branches), "succeeded": len(succeeded), "failed": len(failed)},
        },
        "execution_status": "finalizing",
        "metadata": {
            **state.get("metadata", {}),
            "node": "fan_in",
            "fanout_branches": len(branches),
            "fanout_failed": len(failed),
        },
    }


def _map_react_result(react_res: dict[str, Any], state: dict[str, Any], agent_id: str) -> dict[str, Any] | None:
    """Map a completed ReAct act-result onto graph agent-node output.

    Returns None when the stub ladder should proceed (react declined/errored).
    Pause cards carry the real approval_id (resumable); answers carry bounded
    summaries + react provenance (rounds/tools/termination — never reasoning).
    """
    if not isinstance(react_res, dict):
        return None
    base_meta = {**(state.get("metadata") or {}), "node": "agent", "via": "react"}
    try:
        rmeta = react_res.get("react") if isinstance(react_res.get("react"), dict) else {}
        if rmeta:
            base_meta["react"] = {k: rmeta.get(k) for k in
                                  ("run_id", "rounds", "tool_calls", "termination",
                                   "provider_fallbacks", "resumed") if rmeta.get(k) is not None}
    except Exception:
        pass
    if react_res.get("action") == "request_approval":
        appr = react_res.get("approval") if isinstance(react_res.get("approval"), dict) else {}
        if not appr.get("approval_id"):
            return None  # fail-closed pause without an id is not resumable — stub ladder
        res = react_res.get("result") if isinstance(react_res.get("result"), dict) else {}
        return {
            "selected_agent": agent_id,
            "selected_tool": None,
            "approval_state": {"status": "pending", "approval_id": str(appr["approval_id"]),
                               "tool": appr.get("tool")},
            "result": {"summary": str(res.get("summary") or f"tool {appr.get('tool')} awaiting approval")[:800]},
            "execution_status": "waiting_approval",
            "metadata": {**base_meta, "approval_required": True},
        }
    res = react_res.get("result") if isinstance(react_res.get("result"), dict) else {}
    summary = res.get("summary") if isinstance(res.get("summary"), str) else ""
    if react_res.get("action") in ("suggest", "execute") and summary.strip():
        return {
            "selected_agent": agent_id,
            "selected_tool": None,
            "result": {"summary": summary[:800], "agent": agent_id},
            "execution_status": "finalizing",
            "metadata": base_meta,
        }
    return None


async def agent_node(state: dict[str, Any]) -> dict[str, Any]:
    agent_id = state.get("selected_agent") or state.get("agent_id") or "memory"
    # Handoff validation if present (LG-09)
    handoff = state.get("handoff")
    if handoff:
        try:
            validate_handoff_state(state)
        except Exception as he:
            logger.warning("agent_node handoff rejected %s: %s", agent_id, he)
            return {
                "error": f"handoff rejected: {he}"[:500],
                "execution_status": "failed",
                "metadata": {**state.get("metadata", {}), "node": "agent", "handoff_rejected": True},
            }
    # Quota pre-check before expensive LLM/tool (reuse activity check_quota semantics)
    try:
        from ..temporal.quota import check_and_reserve  # type: ignore

        ws = state.get("workspace_id") or ""
        if ws:
            await check_and_reserve(ws, metric="requests", increment=1)
    except Exception as e:
        if "quota exceeded" in str(e).lower():
            raise QuotaExceededError(str(e)) from e
        # fail-open on Redis outage for local — log
        logger.debug("quota check fail-open: %s", e)

    # ── ReAct delegation (§10): the node runs the COMPLETED ReAct runtime
    # (existing executor → AgentCard → tool executor), never a new one.
    # Ladder: ReAct result → mapped below; ReAct decline/failure → stub path
    # (existing behavior preserved, incl. PYTEST determinism when the flag or
    # key is absent).
    try:
        from ..config import settings as _rsettings
        _react_allowed = bool(getattr(_rsettings, "agent_react_enabled", False)) and bool(
            getattr(_rsettings, "llm_api_key", ""))
    except Exception:
        _react_allowed = False
    if _react_allowed:
        try:
            import os as _ros

            from ..orchestrator.router import AGENT_REGISTRY as _REG  # type: ignore
            from ..orchestrator.loop import _try_react_loop  # type: ignore

            _agent_name = str(agent_id or "")
            _handler_cls = _REG.get(_agent_name)
            _in_pytest = bool(_ros.environ.get("PYTEST_CURRENT_TEST"))
            _force_real = _ros.environ.get("VAELOOM_TEST_REAL_AGENT") == "1"
            if _handler_cls is not None and (not _in_pytest or _force_real):
                _handler = _handler_cls() if callable(_handler_cls) else _handler_cls
                _ws = str(state.get("workspace_id") or "")
                _tenant = state.get("tenant_id")
                _react_res = await _try_react_loop(
                    _handler, str(state.get("task") or ""), _ws, _agent_name,
                    user_id=str(state.get("user_id") or "") or None,
                    db=None,
                    correlation_id=str(state.get("correlation_id") or state.get("request_id") or ""),
                    request_id=str(state.get("request_id") or "") or None,
                    state=None,
                    tenant_id=_tenant if isinstance(_tenant, str) else None,
                )
                if isinstance(_react_res, dict):
                    _mapped = _map_react_result(_react_res, state, agent_id)
                    if _mapped is not None:
                        return _mapped
        except Exception as _re:
            logger.debug("graph agent ReAct delegation skipped for %s: %s", agent_id, _re)

    # Actual agent dispatch — try real handler first, fallback deterministic stub (MVP truth when LANGGRAPH_ENABLED=false)
    # Real dispatch via AGENT_REGISTRY handler when available (bounded, never destructive)
    result_summary = f"graph agent {agent_id} stub for request {state.get('request_id')}"
    tool_needed = False
    t = (state.get("task") or "").lower()
    if any(k in t for k in ("search", "file", "document", "calendar", "email", "github", "tool", "query", "rag")):
        tool_needed = True
    # Attempt real handler (best-effort, preserves stub fallback for tests/offline)
    # In test env (PYTEST_CURRENT_TEST) stay deterministic stub to avoid LLM/DB network hangs (see hardening §9)
    # but still honor handler tool declaration for tool_needed signaling
    import os as _os

    should_try_real = not _os.environ.get("PYTEST_CURRENT_TEST")
    # Allow tests that explicitly opt into real dispatch via VAELOOM_TEST_REAL_AGENT=1
    if _os.environ.get("VAELOOM_TEST_REAL_AGENT") == "1":
        should_try_real = True

    if should_try_real:
        try:
            from ..orchestrator.router import AGENT_REGISTRY  # type: ignore

            handler_cls = AGENT_REGISTRY.get(agent_id)
            if handler_cls:
                handler = handler_cls() if callable(handler_cls) else handler_cls
                # Heuristic from handler's declared tools — if any, mark tool_needed
                try:
                    declared = getattr(handler, "tools", []) or []
                    if declared:
                        tool_needed = True
                except Exception:
                    pass
                # Try to call handler.execute if signature matches (content, source_type, source_id, workspace_id)
                try:
                    import inspect as _insp

                    if hasattr(handler, "execute") and callable(getattr(handler, "execute")):
                        sig = _insp.signature(getattr(handler, "execute"))
                        if len(sig.parameters) >= 4:
                            res = await handler.execute(
                                content=state.get("task") or "",
                                source_type="graph",
                                source_id=str(state.get("request_id") or ""),
                                workspace_id=str(state.get("workspace_id") or ""),
                            )
                            if isinstance(res, dict) and res.get("result", {}).get("summary"):
                                result_summary = str(res["result"]["summary"])[:800]
                            elif isinstance(res, dict) and res.get("summary"):
                                result_summary = str(res["summary"])[:800]
                            elif isinstance(res, dict) and res.get("final_result"):
                                result_summary = str(res.get("final_result"))[:800]
                except Exception as he:
                    logger.debug("agent real dispatch fallback for %s: %s", agent_id, he)
        except Exception as e:
            logger.debug("agent registry lookup failed for %s: %s", agent_id, e)
    else:
        # Even in PYTEST, honor tool declaration for coverage without network
        try:
            from ..orchestrator.router import AGENT_REGISTRY  # type: ignore

            handler_cls = AGENT_REGISTRY.get(agent_id)
            if handler_cls:
                try:
                    declared = getattr(handler_cls(), "tools", []) if callable(handler_cls) else []
                    if declared:
                        tool_needed = True
                except Exception:
                    pass
        except Exception:
            pass

    # Idempotency key for this agent turn (prevents duplicate side effects across retries)
    idempotency_key = hashlib.sha256(
        f"{state.get('workspace_id')}:{state.get('request_id')}:{agent_id}:{state.get('task','')[:200]}".encode()
    ).hexdigest()[:16]

    return {
        "selected_agent": agent_id,
        "selected_tool": "search_documents" if tool_needed else None,
        "result": {"summary": result_summary, "agent": agent_id, "tool_needed": tool_needed},
        "execution_status": "executing_tool" if tool_needed else "finalizing",
        "metadata": {**state.get("metadata", {}), "node": "agent", "idempotency_key": idempotency_key},
    }


async def tool_decision_node(state: dict[str, Any]) -> dict[str, Any]:
    # Terminal-ish pauses/failures pass through untouched — this node only
    # decides for live agent output. (Prevents swallowing waiting_approval
    # pauses and failure states set upstream.)
    _incoming = state.get("execution_status")
    if _incoming in ("waiting_approval", "failed", "cancelled"):
        return {"execution_status": _incoming,
                "metadata": {**state.get("metadata", {}), "node": "tool_decision"}}
    need = bool(state.get("selected_tool"))
    return {"execution_status": "executing_tool" if need else "finalizing", "metadata": {**state.get("metadata", {}), "node": "tool_decision"}}


async def policy_check_node(state: dict[str, Any]) -> dict[str, Any]:
    # Pass through terminal-ish states set upstream (same contract as tool_decision).
    _incoming = state.get("execution_status")
    if _incoming in ("failed", "cancelled"):
        return {"execution_status": _incoming,
                "metadata": {**state.get("metadata", {}), "node": "policy_check"}}
    tool = state.get("selected_tool")
    if not tool:
        return {"execution_status": "finalizing"}
    # Policy: approval gate — for v1, mark waiting_approval (ApprovalWorkflow is durable truth)
    # True LangGraph interrupt via `interrupt()` will be enabled in v2 when we set interrupt_before
    # Approval cannot be bypassed via forged state — validate state hasn't already claimed approved
    approval_state = state.get("approval_state")
    if isinstance(approval_state, dict) and approval_state.get("status") == "approved":
        # Forged approval in state must never authorize tool — require Temporal ApprovalWorkflow signal
        logger.warning("policy_check: forged approved state rejected for tool %s", tool)
        return {
            "execution_status": "waiting_approval",
            "approval_state": {"status": "pending", "tool": tool, "reason": f"tool {tool} requires approval (forged state rejected)"},
            "metadata": {**state.get("metadata", {}), "node": "policy_check", "approval_required": True, "forged_rejected": True},
        }
    try:
        from ..tools.executor import approval_gated_tools  # type: ignore

        gated = approval_gated_tools()
        if tool in gated:
            # Instead of raising, set waiting_approval so activity can signal ApprovalWorkflow
            return {
                "execution_status": "waiting_approval",
                "approval_state": {"status": "pending", "tool": tool, "reason": f"tool {tool} requires approval"},
                "metadata": {**state.get("metadata", {}), "node": "policy_check", "approval_required": True},
            }
        # Unknown tool must not auto-execute — fail closed via tool_execute validation
        return {"execution_status": "executing_tool", "metadata": {**state.get("metadata", {}), "node": "policy_check"}}
    except Exception as e:
        if "requires approval" in str(e):
            raise
        # Fail-closed for consequential tools: if policy unreadable, assume approval required
        try:
            from ..tools.executor import _BASE_APPROVAL_GATED  # type: ignore
            if tool in _BASE_APPROVAL_GATED:
                logger.warning("policy_check unreadable for gated tool %s — fail-closed to waiting_approval: %s", tool, e)
                return {
                    "execution_status": "waiting_approval",
                    "approval_state": {"status": "pending", "tool": tool, "reason": f"tool {tool} requires approval (policy check failed)"},
                    "metadata": {**state.get("metadata", {}), "node": "policy_check", "approval_required": True, "fail_closed": True},
                }
        except Exception:
            pass
        logger.debug("policy_check allow: %s", e)
    return {"execution_status": "executing_tool", "metadata": {**state.get("metadata", {}), "node": "policy_check"}}


async def tool_execute_node(state: dict[str, Any]) -> dict[str, Any]:
    tool = state.get("selected_tool")
    if not tool:
        return {"execution_status": "finalizing"}
    ws = state.get("workspace_id") or ""
    agent_id = state.get("selected_agent") or state.get("agent_id") or "graph"
    # Per-tool quota (LG-09) — WRITE/DESTRUCTIVE/approval_gated cannot bypass
    try:
        from ..temporal.quota import check_and_reserve  # type: ignore
        from ..tools.executor import approval_gated_tools as _agt  # type: ignore

        gated_for_quota = False
        try:
            gated_for_quota = tool in _agt()
        except Exception:
            pass
        # Enforce per-tool quota for gated or when tool implies side effect
        if ws and (gated_for_quota or tool in ("create_entity", "merge_entities", "rename_file", "move_file", "draft_email", "create_calendar_event")):
            try:
                await check_and_reserve(ws, metric="tool_calls", increment=1)
            except Exception as qe:
                if "quota exceeded" in str(qe).lower():
                    return {
                        "error": f"quota exceeded for tool {tool}: {qe}"[:500],
                        "execution_status": "failed",
                        "metadata": {**state.get("metadata", {}), "node": "tool_execute", "quota_exceeded": True},
                    }
                logger.debug("tool quota fail-open: %s", qe)
    except Exception:
        pass

    # Execute via existing executor (bounded, mock-safe, with timeouts/retries)
    try:
        from ..tools.executor import execute_tool, get_tool_definition  # type: ignore

        td = get_tool_definition(tool)
        if td is None:
            raise ValueError(f"unknown tool {tool}")
        # Test/offline fast-path after unknown check: avoid DB network hangs
        import os as _os

        if _os.environ.get("PYTEST_CURRENT_TEST") and _os.environ.get("VAELOOM_TEST_REAL_TOOL") != "1":
            # Deterministic mock — still bounded 4KB and secret-free, proves topology without DB
            # Unknown already raised above, so this is known tool mock
            return {
                "result": {"tool": tool, "output": {"mock": True, "note": "PYTEST mock — tool not executed (offline)"}, "summary": f"tool {tool} mock executed (test)"},
                "execution_status": "finalizing",
                "metadata": {**state.get("metadata", {}), "node": "tool_execute", "mock": True},
            }
        # For graph v1, use minimal params from task; real params derived from LLM in future
        params: dict[str, Any] = {}
        if tool == "search_documents":
            params = {"query": state.get("task") or "", "limit": 5}
        elif tool == "query_graph":
            params = {"query": state.get("task") or "", "limit": 5}
        # Secret resolution happens inside execute_tool handlers via SecretManager — never in state
        # Scopes derive from the agent's card (SAME rule as the ReAct path).
        # Fail-closed: underivable scopes deny execution. The old `scopes=[]`
        # comment claimed "fail-open for graph" — that let denied tools return
        # mock success; denials below are now terminal failures (production).
        from ..orchestrator.router import AGENT_REGISTRY  # type: ignore
        agent_cls = AGENT_REGISTRY.get(agent_id)
        scopes: list[str] = []
        if agent_cls and hasattr(agent_cls, "tools"):
            try:
                scopes = [get_tool_definition(t.name).required_scope for t in agent_cls.tools if hasattr(t, "name")]
            except Exception:
                scopes = []
        if not scopes:
            logger.warning("graph tool_execute denied (no derivable scopes) agent=%s tool=%s", agent_id, tool)
            return {
                "error": f"no authorized scopes for agent {agent_id} tool {tool}"[:500],
                "execution_status": "failed",
                "metadata": {**state.get("metadata", {}), "node": "tool_execute", "error": True, "scope_denied": True},
            }
        # Argument validation (shared ReAct policy — schema/types/binding/size).
        try:
            from ..orchestrator.react_policy import validate_tool_arguments  # type: ignore
            _ok_args, _clean_args, _arg_errs = validate_tool_arguments(
                td, params, workspace_id=ws,
                tenant_id=state.get("tenant_id") if isinstance(state.get("tenant_id"), str) else None,
                user_id=state.get("user_id") if isinstance(state.get("user_id"), str) else None)
            if not _ok_args:
                logger.warning("graph tool_execute arguments rejected agent=%s tool=%s: %s", agent_id, tool, _arg_errs)
                return {
                    "error": f"invalid tool arguments: {'; '.join(_arg_errs[:4])}"[:500],
                    "execution_status": "failed",
                    "metadata": {**state.get("metadata", {}), "node": "tool_execute", "error": True, "arg_rejected": True},
                }
            params = _clean_args
        except ValueError:
            raise
        except Exception as _ve:
            logger.debug("graph arg validation skipped: %s", _ve)
        # Idempotency: the executor computes its own canonical key internally
        # (workspace+agent+tool+params). Nothing is injected into params — a
        # caller-supplied key would both break the canonical hash and fail
        # argument validation as an unexpected field.
        res = await execute_tool(td, params, agent_id, scopes, ws)
        # Truncate tool output to 4KB (measure utf-8 bytes to match state validation)
        if isinstance(res, dict) and len(json.dumps(res, default=str).encode("utf-8")) > 4096:
            # Never allow unbounded accumulation → truncate before state/history amplification
            dumped = json.dumps(res, default=str)
            res = {"truncated": True, "summary": dumped[:3000], "original_bytes": len(dumped.encode("utf-8"))}
        # Secret guard on tool output — tool must not exfiltrate secrets into state
        try:
            validate_no_secrets(res)
        except ValueError as se:
            logger.warning("tool output contained forbidden secret key — redacted for tool %s: %s", tool, se)
            res = {"truncated": True, "summary": "tool output redacted (contained forbidden key)", "tool": tool}
        return {
            "result": {"tool": tool, "output": res, "summary": f"tool {tool} executed"},
            "execution_status": "finalizing",
            "metadata": {**state.get("metadata", {}), "node": "tool_execute"},
        }
    except Exception as e:
        # Permission/scope denial is NEVER masked as mock success — fail closed
        # with a truthful terminal state (the old non-gated "permission
        # fallback" mock is removed: it fabricated success for denied tools).
        if "permission" in str(e).lower() or "scope" in str(e).lower():
            logger.warning("tool_execute permission denied agent=%s tool=%s — failing closed: %s",
                           agent_id, tool, e)
            return {
                "error": f"permission denied for tool {tool}: {e}"[:500],
                "execution_status": "failed",
                "metadata": {**state.get("metadata", {}), "node": "tool_execute", "error": True, "permission_denied": True},
            }
        logger.warning("tool_execute failed %s: %s", tool, e)
        return {
            "error": str(e)[:500],
            "execution_status": "failed",
            "metadata": {**state.get("metadata", {}), "node": "tool_execute", "error": True},
        }


async def evaluate_node(state: dict[str, Any]) -> dict[str, Any]:
    # Approval pause is sticky: a node that paused for approval must NOT be
    # converted into completed/failed by scoring — the router's
    # waiting_approval branch (→ finalize with the pause intact) depends on it.
    if state.get("execution_status") == "waiting_approval":
        rag_ctx_w = state.get("rag_context") or {}
        return {
            "execution_status": "waiting_approval",
            "evaluation": {
                "task_completion": False,
                "tool_correctness": True,
                "retrieval_relevance": state.get("rag_status") in ("ok", "empty"),
                "memory_relevance": bool(rag_ctx_w.get("preferences")),
                "policy_correctness": bool(state.get("approval_state")),
                "workspace_correctness": True,
                "output_schema_valid": True,
                "provenance_complete": True,
                "user_objective_met": False,
                "score": 0.5,
                "replan_required": False,
                "reason": "awaiting approval",
                "schema_version": 1,
            },
            "metadata": {**state.get("metadata", {}), "node": "evaluate"},
        }
    if state.get("error"):
        # Build evaluation for failure path
        rag_ctx_err = state.get("rag_context") or {}
        eval_res = {
            "task_completion": False,
            "tool_correctness": False,
            "retrieval_relevance": state.get("rag_status") == "ok",
            "memory_relevance": bool(rag_ctx_err.get("preferences")),
            "policy_correctness": True,
            "workspace_correctness": True,
            "output_schema_valid": False,
            "provenance_complete": bool(state.get("metadata", {}).get("node")),
            "user_objective_met": False,
            "score": 0.0,
            "replan_required": False,
            "reason": state.get("error", "failed")[:200],
            "schema_version": 1,
        }
        return {"execution_status": "failed", "evaluation": eval_res, "metadata": {**state.get("metadata", {}), "node": "evaluate"}}
    # Evaluation: score tool/rag/memory/policy/workspace + replan signal
    has_result = bool(state.get("result"))
    rag_ok = state.get("rag_status") in ("ok", "empty")
    has_provenance = bool(state.get("metadata", {}).get("node"))
    workspace_ok = True
    try:
        validate_workspace_binding(state, state.get("workspace_id") or "")
    except Exception:
        workspace_ok = False

    score = 0.0
    if has_result:
        score += 0.4
    if rag_ok:
        score += 0.2
    if has_provenance:
        score += 0.2
    if workspace_ok:
        score += 0.2

    # Bounded replan: only if score<0.6 and attempts<3
    attempt = int(state.get("metadata", {}).get("attempt", 0) or 0)
    replan = score < 0.6 and attempt < 2 and has_result is False

    rag_ctx = state.get("rag_context") or {}
    eval_res = {
        "task_completion": has_result,
        "tool_correctness": bool(state.get("selected_tool") is None or state.get("result", {}).get("tool")),
        "retrieval_relevance": rag_ok,
        "memory_relevance": bool(rag_ctx.get("preferences") or rag_ctx.get("entities")),
        "policy_correctness": state.get("execution_status") != "waiting_approval" or bool(state.get("approval_state")),
        "workspace_correctness": workspace_ok,
        "output_schema_valid": has_result,
        "provenance_complete": has_provenance,
        "user_objective_met": has_result and workspace_ok,
        "score": round(score, 2),
        "replan_required": bool(replan),
        "reason": "ok" if has_result else "no result",
        "schema_version": 1,
    }
    # Cap evaluation size
    try:
        from .contracts import validate_evaluation

        validate_evaluation(eval_res)
    except Exception:
        pass

    if replan:
        # Genuine replan signal: stay out of finalize so the router can send
        # the run back to the agent node with an incremented attempt budget.
        return {"execution_status": "needs_replan", "evaluation": eval_res, "metadata": {**state.get("metadata", {}), "node": "evaluate", "attempt": attempt + 1}}
    if has_result:
        return {"execution_status": "completed", "evaluation": eval_res, "metadata": {**state.get("metadata", {}), "node": "evaluate"}}
    return {"execution_status": "failed", "evaluation": eval_res, "metadata": {**state.get("metadata", {}), "node": "evaluate"}}


async def finalize_node(state: dict[str, Any]) -> dict[str, Any]:
    # Approval pause passes through untouched (same contract as tool_decision/
    # evaluate): finalize must never convert a pause into completed/failed.
    if state.get("execution_status") == "waiting_approval":
        return {
            "execution_status": "waiting_approval",
            "metadata": {**state.get("metadata", {}), "node": "finalize"},
        }
    # Failure truthfulness (§31): surface the terminal reason in the result so
    # downstream consumers (and operators) see WHY the graph failed instead of
    # a stale upstream summary. The `error` key keeps the activity contract.
    if state.get("execution_status") == "failed":
        _reason = str(state.get("error") or (state.get("evaluation") or {}).get("reason") or "failed")[:500]
        return {
            "result": {"summary": f"graph failed: {_reason}"[:800], "error": _reason},
            "execution_status": "failed",
            "metadata": {**state.get("metadata", {}), "node": "finalize"},
        }
    # Merge result + rag summary + bounded (never exceed 20KB)
    result = state.get("result") or {"summary": f"graph completed for {state.get('agent_id')}"}
    if len(json.dumps(result, default=str).encode("utf-8")) > 20480:
        dumped = json.dumps(result, default=str)
        result = {"summary": dumped[:15000], "truncated": True, "original_bytes": len(dumped.encode("utf-8"))}
    # Validate no secret leaked into final result
    try:
        validate_no_secrets(result)
    except ValueError:
        result = {"summary": "result redacted (contained forbidden key)", "truncated": True}

    # Memory closed-loop hook: task preference signals flow through the
    # COMPLETED learning pipeline (admission gate + dedup + tenant binding),
    # never direct memory writes. Best-effort, never fails finalize.
    # Skip in tests unless explicitly opted in (VAELOOM_TEST_MEMORY_WRITE=1).
    task_lower = (state.get("task") or "").lower()
    if "prefer" in task_lower and ("concise" in task_lower or "brief" in task_lower or "short" in task_lower):
        try:
            result.setdefault("provenance", {})["memory_candidate"] = {"type": "preference", "signal": "concise", "task": state.get("task", "")[:200]}
            import os as _os

            if not _os.environ.get("PYTEST_CURRENT_TEST") or _os.environ.get("VAELOOM_TEST_MEMORY_WRITE") == "1":
                try:
                    from ..agents.memory.consolidator import memory_consolidator  # type: ignore

                    _ws = state.get("workspace_id")
                    _tenant = state.get("tenant_id")
                    if _ws not in (None, "", "unknown", "req-unknown"):
                        _lr = await memory_consolidator.consolidate_trajectory(
                            workspace_id=str(_ws),
                            agent_name=str(state.get("selected_agent") or state.get("agent_id") or "graph"),
                            user_prompt=str(state.get("task") or ""),
                            summary="graph run completed",
                            event_id=f"graph:{state.get('request_id')}",
                            tenant_id=_tenant if isinstance(_tenant, str) else None,
                            correlation_id=str(state.get("correlation_id") or state.get("request_id") or ""),
                            source="trajectory_feedback",
                        )
                        if isinstance(_lr, dict) and _lr.get("status") == "success" and _lr.get("consolidated_count"):
                            result["provenance"]["memory_persisted"] = True
                except Exception as _mem_err:  # fail-open: never block finalize
                    logger.warning("finalize learning pipeline skipped: %s", _mem_err)
        except Exception:
            pass

    # Attach evaluation provenance (never chain-of-thought)
    eval_provenance = state.get("evaluation")
    if eval_provenance:
        result.setdefault("provenance", {})["evaluation_score"] = eval_provenance.get("score")

    # Attach rag_status provenance for observability
    if state.get("rag_status"):
        result.setdefault("provenance", {})["rag_status"] = state.get("rag_status")

    return {
        "result": result,
        "execution_status": "completed" if not state.get("error") else "failed",
        "metadata": {**state.get("metadata", {}), "node": "finalize"},
    }
