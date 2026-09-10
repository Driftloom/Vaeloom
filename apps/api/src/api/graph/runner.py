"""LangGraph direct runner — production path WITHOUT Temporal.

The compiled graph (`api.graph`) owns TOPOLOGY ONLY. This runner is the
production entry that binds it to the existing Muse substrate:

  HTTP/API → auth → tenant → workspace → agent (router.handle)
      → run_graph_direct → compiled graph → nodes (existing services)
      → Muse durable mirror (LoopState + save_checkpoint/CAS)

It duplicates NOTHING: authorization, tool execution, approval, idempotency,
checkpoints, model routing, fallback, memory, learning, retrieval, budgets and
cancellation all stay in their existing services. Temporal is untouched and is
NOT required (its activity entry remains as the alternate path).

Resume semantics (honest): the Muse mirror is the durable truth. A resumed run
re-executes the compiled graph from the start; side-effect nodes stay
exactly-once via executor durable idempotency + approval single-consume, and
pure nodes simply recompute. No fabricated state, no skipped approvals.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

GRAPH_VERSION = "v1"

# Runner-level bounds (graph topology bounds live in state.py/contracts).
GRAPH_MAX_NODE_UPDATES = 64
GRAPH_WALLCLOCK_S = 120.0
GRAPH_TRACE_MAX_EVENTS = 64

# Static allowed-transition map — mirrors _build_graph edges. Model-influenced
# DATA (selected agent/tool) can never create an edge outside this map; the
# topology test cross-checks this map against the builder to prevent drift.
ALLOWED_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "START": ("validate_input",),
    "validate_input": ("retrieve_context",),
    "retrieve_context": ("route",),
    "route": ("supervisor", "agent"),
    "supervisor": ("agent", "fanout_worker"),
    "fanout_worker": ("fan_in",),
    "fan_in": ("tool_decision",),
    "agent": ("tool_decision",),
    "tool_decision": ("policy_check", "evaluate"),
    "policy_check": ("tool_execute", "evaluate"),
    "tool_execute": ("evaluate",),
    "evaluate": ("finalize", "agent"),
    "finalize": ("END",),
}

EXPECTED_NODES = frozenset({
    "validate_input", "retrieve_context", "route", "supervisor",
    "fanout_worker", "fan_in", "agent", "tool_decision", "policy_check",
    "tool_execute", "evaluate", "finalize",
})

# ── Metrics (dependency-free counters; Temporal prometheus stays untouched) ──
_graph_metrics: dict[str, Any] = {
    "runs": 0,
    "by_termination": {},
    "node_updates_total": 0,
    "approvals_paused_total": 0,
    "cancels_total": 0,
    "fallbacks_total": 0,
    "duration_ms_total": 0.0,
}


def record_graph_run(entry: dict[str, Any]) -> dict[str, Any]:
    _graph_metrics["runs"] += 1
    term = str(entry.get("termination") or "unknown")
    _graph_metrics["by_termination"][term] = _graph_metrics["by_termination"].get(term, 0) + 1
    _graph_metrics["node_updates_total"] += int(entry.get("node_updates") or 0)
    if entry.get("approval_paused"):
        _graph_metrics["approvals_paused_total"] += 1
    if term == "cancelled":
        _graph_metrics["cancels_total"] += 1
    # Fallback count arrives prefixed (react_provider_fallbacks) to avoid
    # colliding with the graph-level "termination" key — accept both spellings.
    _graph_metrics["fallbacks_total"] += int(
        entry.get("provider_fallbacks", entry.get("react_provider_fallbacks", 0)) or 0)
    _graph_metrics["duration_ms_total"] += float(entry.get("duration_ms") or 0.0)
    logger.info("GRAPH_RUN %s", json.dumps(entry, default=str))
    return entry


def get_graph_stats() -> dict[str, Any]:
    runs = _graph_metrics["runs"]
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in _graph_metrics.items()}
    out["avg_node_updates"] = round(_graph_metrics["node_updates_total"] / runs, 2) if runs else 0.0
    out["avg_duration_ms"] = round(_graph_metrics["duration_ms_total"] / runs, 1) if runs else 0.0
    return out


def reset_graph_metrics() -> None:
    for k in ("by_termination",):
        _graph_metrics[k] = {}
    for k in ("runs", "node_updates_total", "approvals_paused_total",
              "cancels_total", "fallbacks_total"):
        _graph_metrics[k] = 0
    _graph_metrics["duration_ms_total"] = 0.0


# ── Gating (§42 — mirrors the activity's enabled/percent semantics) ─────────

def should_use_graph(request_id: str | None = None) -> bool:
    """Direct-path gate: enabled + importable + percent hash. Never raises."""
    try:
        from ..config import settings
        from . import HAS_LANGGRAPH
        if not HAS_LANGGRAPH:
            return False
        if not bool(getattr(settings, "langgraph_enabled", False)):
            return False
        percent = int(getattr(settings, "langgraph_agent_run_percent", 0) or 0)
        if percent <= 0:
            return True  # enabled with no percent limit (mirrors activity)
        if percent >= 100:
            return True
        rid = str(request_id or "0")
        h = int(hashlib.sha256(rid.encode()).hexdigest()[:8], 16) % 100
        return h < percent
    except Exception:
        return False


# ── Topology validation (§17) ──────────────────────────────────────────────

_topology_cache: dict[str, Any] | None = None


def validate_graph_topology() -> dict[str, Any]:
    """Assert the compiled topology matches the allowed static contract.

    Checks: node set, edge endpoints, terminal reachability, bounds present,
    version present. Cached; raises ValueError (fail-closed) on any drift.
    """
    global _topology_cache
    if _topology_cache is not None:
        return _topology_cache
    from . import get_graph_metadata
    meta = get_graph_metadata()
    if not meta.get("has_langgraph"):
        raise ValueError("langgraph not installed")
    nodes = set(meta.get("nodes") or [])
    if nodes != EXPECTED_NODES:
        raise ValueError(f"graph node drift: extra={sorted(nodes - EXPECTED_NODES)} missing={sorted(EXPECTED_NODES - nodes)}")
    for src, dsts in ALLOWED_TRANSITIONS.items():
        if src not in ("START", "END") and src not in nodes:
            raise ValueError(f"transition source unknown: {src}")
        for d in dsts:
            if d not in ("START", "END") and d not in nodes:
                raise ValueError(f"transition target unknown: {src}->{d}")
    # Terminal reachability: every node reaches END through the static map.
    def _reaches_end(n: str, seen: set[str]) -> bool:
        if n == "END":
            return True
        if n in seen:
            return False
        return any(_reaches_end(d, seen | {n}) for d in ALLOWED_TRANSITIONS.get(n, ()))
    unreachable = sorted(n for n in nodes if not _reaches_end(n, set()))
    if unreachable:
        raise ValueError(f"nodes cannot reach terminal: {unreachable}")
    if meta.get("version") != GRAPH_VERSION:
        raise ValueError(f"graph version drift: {meta.get('version')} != {GRAPH_VERSION}")
    from .state import MAX_GRAPH_REPLANS, MAX_FANOUT_BRANCHES
    if not (MAX_GRAPH_REPLANS > 0 and MAX_FANOUT_BRANCHES > 0):
        raise ValueError("graph bounds missing")
    _topology_cache = {"version": GRAPH_VERSION, "nodes": sorted(nodes),
                       "transitions": {k: list(v) for k, v in ALLOWED_TRANSITIONS.items()}}
    return _topology_cache


# ── Trusted context (§6/§7/§27) ────────────────────────────────────────────

def resolve_trusted_context(*, workspace_id: str | None, user_id: str | None,
                            tenant_id: str | None, agent_id: str | None,
                            request_id: str | None) -> dict[str, str]:
    """Build the trusted security context. Explicit params win; middleware
    contextvar is the fallback; anything missing fails closed (never defaulted
    to a privileged value, never taken from model output)."""
    ws = (workspace_id or "").strip()
    uid = (user_id or "").strip()
    tenant = (tenant_id or "").strip()
    agent = (agent_id or "").strip()
    req = (request_id or "").strip()
    if not tenant:
        try:
            from ..middleware.tenant import TenantContext as _TC
            tenant = str(_TC.get_tenant_id() or "").strip()
        except Exception:
            pass
    if not uid:
        try:
            from ..middleware.tenant import TenantContext as _TC2
            uid = str(_TC2.get_user_id() or "").strip()
        except Exception:
            pass
    missing = [k for k, v in (("workspace_id", ws), ("user_id", uid),
                              ("tenant_id", tenant), ("agent_id", agent),
                              ("request_id", req)) if not v]
    if missing:
        raise ValueError(f"graph trusted context missing: {', '.join(missing)}")
    for k, v in (("workspace_id", ws), ("user_id", uid), ("tenant_id", tenant)):
        if len(v) > 256:
            raise ValueError(f"graph trusted context field too long: {k}")
    return {"workspace_id": ws, "user_id": uid, "tenant_id": tenant,
            "agent_id": agent, "request_id": req}


def assert_trusted_context_unchanged(initial: dict[str, str], final_state: dict[str, Any]) -> None:
    """Post-run re-derivation: security-critical ids must equal the trusted
    entry context. A mutation (injection, bug, or drift) fails the run closed."""
    for key in ("workspace_id", "user_id", "tenant_id", "agent_id", "request_id"):
        before = initial.get(key)
        after = final_state.get(key)
        if key == "tenant_id":
            # tenant lives in trusted ctx + mirror, not necessarily graph state
            continue
        if after is not None and str(after) != str(before):
            raise ValueError(f"graph {key} mutated during run ({before!r} -> {after!r}) — rejecting result")


async def check_graph_cancel(request_id: str | None) -> bool:
    """Durable cancel flag shared with the loop path (same source of truth)."""
    if not request_id:
        return False
    try:
        from ..orchestrator.react_policy import check_react_cancel
        return await check_react_cancel(request_id)
    except Exception:
        return False


# ── Direct execution ───────────────────────────────────────────────────────

async def _save_mirror(mirror: Any) -> None:
    """Durable mirror write — awaited (deterministic for tests/recovery)."""
    if mirror is None:
        return
    try:
        from ..orchestrator.state import save_checkpoint as _save
        await _save(mirror)
    except Exception as e:
        logger.debug("graph mirror save skipped: %s", e)


async def run_graph_direct(
    *,
    workspace_id: str,
    user_id: str | None = None,
    tenant_id: str | None = None,
    agent_id: str | None = None,
    request_id: str,
    correlation_id: str | None = None,
    task: str,
    timeout_s: float = GRAPH_WALLCLOCK_S,
    max_node_updates: int = GRAPH_MAX_NODE_UPDATES,
) -> dict[str, Any]:
    """Execute the compiled LangGraph with Muse durability (no Temporal).

    Returns an act-shaped result dict with graph provenance + termination.
    Raises only for infrastructure misuse (missing context, bad topology);
    graph-domain failures return truthful terminal cards (never fabricated).
    """
    t0 = time.monotonic()
    trace: list[dict[str, Any]] = []
    node_updates = 0
    ctx = resolve_trusted_context(
        workspace_id=workspace_id, user_id=user_id, tenant_id=tenant_id,
        agent_id=agent_id or "memory", request_id=request_id)
    corr = correlation_id or request_id

    def _record(termination: str, **extra: Any) -> dict[str, Any]:
        return record_graph_run({
            "correlation_id": corr, "run_id": ctx["request_id"],
            "graph_version": GRAPH_VERSION, "agent": ctx["agent_id"],
            "workspace": ctx["workspace_id"][:8], "tenant": ctx["tenant_id"][:8],
            "termination": termination, "node_updates": node_updates,
            "duration_ms": round((time.monotonic() - t0) * 1000, 1),
            "trace": trace[-GRAPH_TRACE_MAX_EVENTS:],
            **extra,
        })

    # NOTE: _record stays sync (called from sync helpers); slot draining for
    # _record paths happens via _record_release below. Pre-acquire calls are
    # no-ops through the flag. Defined BEFORE first use: the mirror gates
    # below already drain on refusal (a forward reference here would
    # NameError-fail-OPEN inside the surrounding try — see ADV-ws test).
    _slot_held = False

    async def _release_slot() -> None:
        nonlocal _slot_held
        if not _slot_held:
            return
        _slot_held = False
        try:
            from ..infrastructure.agent_observability import workspace_limiter as _wl2
            _wl2.release(ctx["workspace_id"])
        except Exception:
            pass

    async def _record_release(termination: str, **extra: Any) -> dict[str, Any]:
        """Terminal record that also drains the concurrency slot exactly once."""
        await _release_slot()
        return _record(termination, **extra)

    # Topology gate (fail-closed before any work).
    try:
        validate_graph_topology()
    except Exception as e:
        _record("topology_rejected", error=str(e)[:200])
        raise

    # Cancel + spend pre-gates (same gates as the loop path).
    if await check_graph_cancel(ctx["request_id"]):
        _record("cancelled")
        return _terminal("cancelled", "Run cancelled by user request.", ctx, corr, trace,
                         termination_reason="user_cancel")
    try:
        from ..orchestrator.loop import _check_spend_and_quota
        _msg, _kind = await _check_spend_and_quota(ctx["workspace_id"], ctx["agent_id"])
        if _msg:
            _record("budget_exhausted", ceiling=_kind)
            return _terminal("budget_exhausted", _msg, ctx, corr, trace,
                             termination_reason=_kind)
    except Exception:
        pass

    # Durable mirror: resume short-circuit for terminal runs (no re-execution).
    try:
        from ..orchestrator.state import load_or_create_state
        mirror = await load_or_create_state(ctx["request_id"])
        if ctx["workspace_id"] and not mirror.workspace_id:
            mirror.workspace_id = ctx["workspace_id"]
        # Cross-workspace resume is never allowed: a mirror owned by another
        # workspace must not serve this run (fail closed, no merge).
        if mirror.workspace_id and str(mirror.workspace_id) != ctx["workspace_id"]:
            await _record_release("workspace_mismatch")
            raise ValueError("checkpoint workspace does not match run workspace — refusing resume")
        if mirror.is_terminal and mirror.termination_reason:
            _record("resumed_terminal", status=mirror.status)
            return _terminal_from_mirror(mirror, ctx, corr, trace)
        # Version gate: never resume under an incompatible topology.
        try:
            _gv = (mirror.phases.get("graph_run") or {}).get("graph_version")
            if _gv and _gv != GRAPH_VERSION:
                await _record_release("version_mismatch", stored=_gv)
                raise ValueError(f"graph version mismatch (stored {_gv} != {GRAPH_VERSION}) — refusing resume")
        except ValueError:
            raise
        except Exception:
            pass
    except ValueError:
        raise
    except Exception as e:
        logger.debug("graph mirror load skipped: %s", e)
        mirror = None

    # Workspace concurrency guard (same P1c pattern as the loop path).
    # Exact-once release: every terminal path funnels through _record_release()
    # or _normalize(); the flag makes double-release impossible (a stray
    # release would inflate semaphore capacity the other way).
    # (_slot_held/_release_slot are defined above, before first use.)
    try:
        from ..infrastructure.agent_observability import workspace_limiter as _wl
        if await _wl.acquire(ctx["workspace_id"]):
            _slot_held = True
        else:
            logger.warning("GRAPH concurrency limit: workspace %s at capacity", ctx["workspace_id"][:8])
            _record("concurrency_limited")
            return _terminal("concurrency_limited",
                             "System at capacity for this workspace — please retry shortly.",
                             ctx, corr, trace, termination_reason="failure")
    except Exception as e:
        logger.debug("graph concurrency guard skipped: %s", e)

    # Build + validate initial state from TRUSTED ids only.
    try:
        from .state import build_initial_state, validate_graph_state
        from . import get_vaeloom_graph
        gstate = build_initial_state({
            "workspace_id": ctx["workspace_id"], "user_id": ctx["user_id"],
            "agent_id": ctx["agent_id"], "request_id": ctx["request_id"],
            "correlation_id": corr, "tenant_id": ctx["tenant_id"],
            "input": {"message": task},
        })
        gstate["metadata"] = {**(gstate.get("metadata") or {}),
                              "graph_version": GRAPH_VERSION,
                              "tenant_id": ctx["tenant_id"]}
        validate_graph_state(gstate)
        graph = get_vaeloom_graph()
    except Exception as e:
        await _record_release("invalid_input", error=str(e)[:200])
        raise

    # Execute with streamed node updates: mirror each, enforce bounds, honor cancel.
    # NOTE: asyncio.wait_for cannot wrap an async generator — the wall-clock is
    # enforced with an explicit per-chunk deadline instead (honest bounding).
    final_state: dict[str, Any] | None = None
    cancelled = False
    deadline = time.monotonic() + float(timeout_s)
    try:
        config = {"configurable": {"thread_id": ctx["request_id"]}}
        stream = graph.astream(gstate, config=config, stream_mode="updates")
        try:
            async for chunk in stream:
                if time.monotonic() >= deadline:
                    raise TimeoutError(f"graph wall-clock budget exhausted ({timeout_s}s)")
                if not isinstance(chunk, dict):
                    continue
                for node_name, update in chunk.items():
                    node_updates += 1
                    trace.append({"node": str(node_name),
                                  "at": round((time.monotonic() - t0) * 1000, 1),
                                  "status": str((update or {}).get("execution_status") or "ok")
                                  if isinstance(update, dict) else "ok"})
                    if len(trace) > GRAPH_TRACE_MAX_EVENTS:
                        trace.pop(0)
                    await _mirror_node(mirror, node_name, update)
                    if node_updates >= max_node_updates:
                        raise TimeoutError(f"graph node-update budget exhausted ({max_node_updates})")
                    if await check_graph_cancel(ctx["request_id"]):
                        cancelled = True
                        raise asyncio.CancelledError("cancel requested between graph nodes")
        finally:
            try:
                await stream.aclose()
            except Exception:
                pass
        # Full post-run state for validation + normalization.
        try:
            snap = await graph.aget_state(config)
            final_state = dict(snap.values) if snap is not None else None
        except Exception:
            final_state = None
    except asyncio.CancelledError:
        cancelled = True
    except (TimeoutError, asyncio.TimeoutError):
        await _record_release("timeout", node_updates=node_updates)
        await _mirror_terminal(mirror, "timeout")
        return _terminal("timeout", "Graph run exceeded wall-clock budget.", ctx, corr, trace,
                         termination_reason="timeout")
    except Exception as e:
        await _record_release("graph_error", error=str(e)[:300])
        await _mirror_terminal(mirror, "graph_error")
        return _terminal("graph_error", f"Graph execution failed: {e}", ctx, corr, trace,
                         termination_reason="failure")

    if cancelled or await check_graph_cancel(ctx["request_id"]):
        await _record_release("cancelled", node_updates=node_updates)
        await _mirror_terminal(mirror, "cancelled")
        return _terminal("cancelled", "Run cancelled by user request.", ctx, corr, trace,
                         termination_reason="user_cancel")

    if not isinstance(final_state, dict) or not final_state:
        await _record_release("empty_result")
        await _mirror_terminal(mirror, "empty_result")
        return _terminal("empty_result", "Graph produced no state.", ctx, corr, trace,
                         termination_reason="failure")

    # Post-run trust: ids unchanged + state valid (never trust mutated state).
    try:
        from .state import validate_graph_state as _vgs
        _vgs(final_state)
        assert_trusted_context_unchanged(ctx, final_state)
    except Exception as e:
        await _record_release("trust_violation", error=str(e)[:200])
        await _mirror_terminal(mirror, "trust_violation")
        return _terminal("trust_violation", f"Graph result rejected: {e}", ctx, corr, trace,
                         termination_reason="failure")

    _normalized = await _normalize(ctx, corr, trace, node_updates, t0, mirror, final_state)
    await _release_slot()
    return _normalized


def clear_topology_cache() -> None:
    """Test hygiene: drop the cached topology contract."""
    global _topology_cache
    _topology_cache = None


async def _mirror_node(mirror: Any, node_name: str, update: Any) -> None:
    """Best-effort per-node mirror into LoopState (observability + recovery audit).

    History ACCUMULATES per node (bounded list): retries/replans must not
    erase earlier attempts — provenance (e.g. a first attempt's fallback or
    approval metadata) survives even when a later attempt overwrites the
    live channel value.
    """
    if mirror is None:
        return
    try:
        from ..orchestrator.react_policy import redact_secrets
        redacted, _ = redact_secrets(update if isinstance(update, (dict, list, str)) else str(update))
        try:
            blob = json.dumps(redacted, default=str)
            if len(blob.encode()) > 4096:
                redacted = {"_truncated": True}
        except Exception:
            redacted = {"_unserializable": True}
        key = f"graph_node_{node_name}"
        try:
            prior = (getattr(mirror, "phases", {}) or {}).get(key)
        except Exception:
            prior = None
        if isinstance(prior, list):
            history = prior + [redacted]
        elif isinstance(prior, dict):
            history = [prior, redacted]
        else:
            history = [redacted]
        mirror.add_phase(key, history[-8:])
        await _save_mirror(mirror)
    except Exception as e:
        logger.debug("graph node mirror skipped: %s", e)


async def _mirror_terminal(mirror: Any, termination: str) -> None:
    if mirror is None:
        return
    try:
        mirror.add_phase("graph_run", {"status": "terminal", "termination": termination,
                                       "graph_version": GRAPH_VERSION})
        await _save_mirror(mirror)
    except Exception as e:
        logger.debug("graph terminal mirror skipped: %s", e)


def _terminal(termination: str, summary: str, ctx: dict[str, str], corr: str,
              trace: list[dict[str, Any]], termination_reason: str = "failure",
              **extra: Any) -> dict[str, Any]:
    card: dict[str, Any] = {
        "agent_name": ctx["agent_id"],
        "action": "error",
        "confidence": 0.0,
        "result": {"summary": summary, "details": None, "proposals": [], "questions": []},
        "graph": {"run_id": ctx["request_id"], "graph_version": GRAPH_VERSION,
                  "termination": termination, "trace": trace[-GRAPH_TRACE_MAX_EVENTS:]},
        "termination_reason": termination_reason,
    }
    card.update(extra)
    return card


def _terminal_from_mirror(mirror: Any, ctx: dict[str, str], corr: str,
                          trace: list[dict[str, Any]]) -> dict[str, Any]:
    try:
        snap = (mirror.phases.get("graph_run") or {})
        summary = str(snap.get("summary") or f"Graph run {mirror.status}.")
        return _terminal(str(snap.get("termination") or mirror.status or "resumed"),
                         summary, ctx, corr, trace,
                         termination_reason=str(mirror.termination_reason or "failure"))
    except Exception:
        return _terminal("resumed", "Graph run previously completed.", ctx, corr, trace)


async def _normalize(ctx: dict[str, str], corr: str, trace: list[dict[str, Any]],
               node_updates: int, t0: float, mirror: Any,
               final_state: dict[str, Any]) -> dict[str, Any]:
    status = str(final_state.get("execution_status") or "failed")
    result = final_state.get("result") if isinstance(final_state.get("result"), dict) else {}
    summary = str(result.get("summary") or f"graph {status} for {ctx['agent_id']}")
    approval = final_state.get("approval_state") if isinstance(final_state.get("approval_state"), dict) else {}

    if status == "waiting_approval" and approval.get("approval_id"):
        termination = "approval_paused"
        record_graph_run({
            "correlation_id": corr, "run_id": ctx["request_id"], "graph_version": GRAPH_VERSION,
            "agent": ctx["agent_id"], "workspace": ctx["workspace_id"][:8],
            "tenant": ctx["tenant_id"][:8], "termination": termination,
            "node_updates": node_updates, "approval_paused": True,
            "duration_ms": round((time.monotonic() - t0) * 1000, 1),
            "trace": trace[-GRAPH_TRACE_MAX_EVENTS:]})
        try:
            if mirror is not None:
                mirror.add_phase("graph_run", {"status": "awaiting_approval",
                                               "termination": termination,
                                               "graph_version": GRAPH_VERSION,
                                               "summary": summary})
                await _save_mirror(mirror)
        except Exception:
            pass
        return {
            "agent_name": ctx["agent_id"], "action": "request_approval", "confidence": 0.9,
            "result": {"summary": summary, "details": None,
                       "proposals": [{"tool": approval.get("tool"),
                                      "approval_id": approval.get("approval_id"),
                                      "requires_approval": True,
                                      "approval_type": approval.get("tool")}],
                       "questions": []},
            "approval": {"approval_id": approval.get("approval_id"),
                         "tool": approval.get("tool"), "status": "pending"},
            "graph": {"run_id": ctx["request_id"], "graph_version": GRAPH_VERSION,
                      "termination": termination, "trace": trace[-GRAPH_TRACE_MAX_EVENTS:]},
            "termination_reason": "success",
        }

    if status == "waiting_approval":
        # Stub-path pause with no approval request: fail closed (nothing to approve).
        record_graph_run({
            "correlation_id": corr, "run_id": ctx["request_id"], "graph_version": GRAPH_VERSION,
            "agent": ctx["agent_id"], "workspace": ctx["workspace_id"][:8],
            "tenant": ctx["tenant_id"][:8], "termination": "approval_unrequestable",
            "node_updates": node_updates,
            "duration_ms": round((time.monotonic() - t0) * 1000, 1),
            "trace": trace[-GRAPH_TRACE_MAX_EVENTS:]})
        return _terminal("approval_unrequestable",
                         "Graph requires approval but no approval request exists for this tool path.",
                         ctx, corr, trace, termination_reason="failure")

    ok = status in ("completed", "finalizing")
    termination = "completed" if ok else "failed"
    # React provenance: node updates OVERWRITE the shared metadata channel as
    # the graph progresses, so the final state's metadata no longer carries the
    # agent node's react block. The durable mirror accumulates per-node history,
    # so scan every agent attempt for react metadata (first non-empty wins).
    react_meta: dict[str, Any] = {}
    try:
        if mirror is not None:
            for key, phase in (getattr(mirror, "phases", {}) or {}).items():
                if not str(key).startswith("graph_node_agent"):
                    continue
                attempts = phase if isinstance(phase, list) else [phase]
                for attempt in attempts:
                    md = (attempt or {}).get("metadata") if isinstance(attempt, dict) else None
                    rm = (md or {}).get("react") if isinstance(md, dict) else None
                    if isinstance(rm, dict) and rm:
                        for k in ("run_id", "rounds", "tool_calls", "termination",
                                  "provider_fallbacks", "resumed"):
                            if rm.get(k) is not None:
                                react_meta.setdefault(k, rm[k])
                if react_meta:
                    break
    except Exception:
        pass
    # Prefix react keys: a bare spread would overwrite the graph-level
    # "termination" key (P1-class observability corruption — found by E2E-16).
    _react_prefixed = {f"react_{k}": v for k, v in react_meta.items()}
    record_graph_run({
        "correlation_id": corr, "run_id": ctx["request_id"], "graph_version": GRAPH_VERSION,
        "agent": str(final_state.get("selected_agent") or ctx["agent_id"]),
        "workspace": ctx["workspace_id"][:8], "tenant": ctx["tenant_id"][:8],
        "termination": termination, "node_updates": node_updates,
        "duration_ms": round((time.monotonic() - t0) * 1000, 1),
        "trace": trace[-GRAPH_TRACE_MAX_EVENTS:], **_react_prefixed})
    try:
        if mirror is not None:
            mirror.add_phase("graph_run", {"status": "terminal", "termination": termination,
                                           "graph_version": GRAPH_VERSION, "summary": summary})
            await _save_mirror(mirror)
    except Exception:
        pass
    return {
        "agent_name": ctx["agent_id"],
        "action": "suggest" if ok else "error",
        "confidence": 0.85 if ok else 0.0,
        "result": {"summary": summary, "details": result if ok else None,
                   "proposals": [], "questions": []},
        "graph": {"run_id": ctx["request_id"], "graph_version": GRAPH_VERSION,
                  "termination": termination, "trace": trace[-GRAPH_TRACE_MAX_EVENTS:],
                  **_react_prefixed},
        "termination_reason": "success" if ok else "failure",
    }
