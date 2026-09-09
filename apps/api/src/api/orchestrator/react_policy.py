"""ReAct production policy helpers — Muse ReAct productionization phase.

This module is POLICY ONLY: pure helpers + metrics used by the single
production ReAct path (`orchestrator/loop.py::_try_react_loop`). It creates no
parallel runtime, no second quarantine, no second router/approval/idempotency
system — every enforcement delegates to the existing Muse substrate
(executor, AgentCard/contract, approval service, prompt quarantine,
LoopState/checkpointing, provider-fallback taxonomy, learning gate).

Contract enforced here:
  THINK -> SELECT -> VALIDATE -> AUTHORIZE -> EXECUTE -> OBSERVE -> EVALUATE
  -> CONTINUE/STOP, with structured metadata per step and an explicit
  termination reason on every exit. Raw model reasoning and secrets are NEVER
  persisted (fingerprints + redacted replays only).
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# ── Bounds (defaults; run budgets from LoopState win when present) ──────
REACT_MAX_ARGS_BYTES = 16 * 1024       # total JSON-encoded args cap
REACT_MAX_ARG_STRING = 8 * 1024        # per-string arg cap
REACT_OBSERVATION_MAX_CHARS = 4000     # per-observation model-context cap
REACT_CHECKPOINT_OBS_CHARS = 4000      # per-observation checkpoint cap
REACT_MESSAGE_HISTORY_MAX_CHARS = 12000  # compacted history ceiling
REACT_KEEP_LAST_TOOL_ROUNDS = 3        # history compaction window
REACT_MAX_CONSECUTIVE_DENIALS = 3      # policy denials before policy_stop

# Binding keys a model must never smuggle across boundaries.
_BINDING_KEYS = ("workspace_id", "workspaceId", "tenant_id", "tenantId", "user_id", "userId")

# Secret shapes redacted before any checkpoint/run-record persistence.
_SECRET_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9-_]{8,}"),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]+"),
    re.compile(r"ghp_[A-Za-z0-9]{8,}"),
    re.compile(r"gho_[A-Za-z0-9]{8,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/=]{8,}", re.IGNORECASE),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}"),
    # credential assignments in free text ("password: x", "api_key=abc...")
    re.compile(r"(password|passwd|pwd|api[_-]?key|secret|token)\s*[:=]\s*\S+", re.IGNORECASE),
    # bare credential mentions ("password hunter2") — redacts the token only
    re.compile(r"\b(password|passwd|pwd)\s+[A-Za-z0-9!@#$%^&*]{4,}\b", re.IGNORECASE),
)
_SENSITIVE_KEY_RE = re.compile(r"(password|passwd|pwd|secret|api[_-]?key|token|auth|credential|private[_-]?key)", re.IGNORECASE)


def _fingerprint(value: Any, limit: int = 2000) -> str:
    try:
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)[:limit]
    except Exception:
        raw = str(value)[:limit]
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


# ── Argument validation (§8) ────────────────────────────────────────────

def _type_ok(value: Any, declared: str) -> bool:
    if declared == "string":
        return isinstance(value, str)
    if declared == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if declared == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if declared == "boolean":
        return isinstance(value, bool)
    if declared == "array":
        return isinstance(value, list)
    if declared == "object":
        return isinstance(value, dict)
    if declared == "null":
        return value is None
    return True  # unknown declared type: do not invent rejections


def validate_tool_arguments(
    tool_def: Any,
    args: Any,
    *,
    workspace_id: str,
    tenant_id: str | None = None,
    user_id: str | None = None,
) -> tuple[bool, dict[str, Any], list[str]]:
    """Validate model-proposed tool arguments. Fail-closed triple return.

    Returns (ok, cleaned_args, errors). On ok=False the caller must NOT execute
    and should feed `errors` back to the model for self-correction.
    Checks, in order: shape → size → tenant/workspace/user binding → required →
    types/enum/ranges → unknown-field policy. String values are sanitized
    (existing ADR-031 policy, reused — not a second sanitizer); injection-like
    content is flagged in errors but sanitized-through, never silently executed
    as instruction (the observation boundary quarantines at use).
    """
    if not isinstance(args, dict):
        return False, {}, [f"arguments must be an object, got {type(args).__name__}"]
    try:
        total = len(json.dumps(args, default=str))
    except Exception:
        return False, {}, ["arguments are not JSON-serializable"]
    if total > REACT_MAX_ARGS_BYTES:
        return False, {}, [f"arguments exceed {REACT_MAX_ARGS_BYTES} bytes ({total})"]

    schema = getattr(tool_def, "input_schema", None) or {}
    props = schema.get("properties", {}) if isinstance(schema, dict) else {}
    required = schema.get("required", []) if isinstance(schema, dict) else []

    # Binding: model-supplied identity must match the run context or be absent.
    ctx = {"workspace_id": workspace_id, "workspaceId": workspace_id,
           "tenant_id": tenant_id, "tenantId": tenant_id,
           "user_id": user_id, "userId": user_id}
    for key in _BINDING_KEYS:
        if key in args and args[key] not in (None, ""):
            expected = ctx.get(key)
            if expected is None:
                return False, {}, [f"argument '{key}' not permitted in this context"]
            elif str(args[key]) != str(expected):
                return False, {}, [f"binding mismatch: argument '{key}' does not match run context"]

    cleaned: dict[str, Any] = {}
    advisory: list[str] = []
    hard: list[str] = []
    try:
        from ..utils.sanitize import sanitize_text, looks_like_prompt_injection
    except Exception:  # pragma: no cover
        sanitize_text = lambda v: v  # type: ignore[assignment]
        looks_like_prompt_injection = lambda t: False  # type: ignore[assignment]

    for key, value in args.items():
        if isinstance(value, str) and len(value) > REACT_MAX_ARG_STRING:
            return False, {}, [f"argument '{key}' exceeds {REACT_MAX_ARG_STRING} chars"]
        if isinstance(value, str):
            try:
                if looks_like_prompt_injection(value):
                    advisory.append(f"argument '{key}' contains instruction-like content (sanitized)")
            except Exception:
                pass
            try:
                value = sanitize_text(value)
            except Exception:
                pass
        cleaned[key] = value

    # Unknown-field policy: reject when the schema declares properties and does
    # not opt into additionalProperties (fail closed per §8).
    if isinstance(props, dict) and props:
        additional = schema.get("additionalProperties", False)
        if additional is not True:
            unknown = [k for k in cleaned if k not in props and k not in _BINDING_KEYS]
            if unknown:
                return False, {}, [f"unexpected argument(s): {', '.join(sorted(unknown)[:5])}"]

    for req in required or []:
        if req not in cleaned or cleaned[req] in (None, ""):
            hard.append(f"missing required argument: '{req}'")

    if isinstance(props, dict):
        for key, spec in props.items():
            if key not in cleaned or not isinstance(spec, dict):
                continue
            val = cleaned[key]
            declared = spec.get("type")
            if declared and not _type_ok(val, declared):
                hard.append(f"argument '{key}' must be {declared}, got {type(val).__name__}")
                continue
            if "enum" in spec and val not in spec["enum"]:
                hard.append(f"argument '{key}' must be one of {spec['enum'][:8]}")
            for bound, op in (("minimum", "gte"), ("maximum", "lte"),
                              ("minLength", "minlen"), ("maxLength", "maxlen")):
                if bound in spec and isinstance(val, (int, float, str, list)):
                    try:
                        lim = spec[bound]
                        bad = ((op == "gte" and val < lim) or (op == "lte" and val > lim)
                               or (op == "minlen" and len(val) < lim) or (op == "maxlen" and len(val) > lim))
                        if bad:
                            hard.append(f"argument '{key}' violates {bound}={lim}")
                    except Exception:
                        pass
            if "pattern" in spec and isinstance(val, str):
                try:
                    if not re.search(spec["pattern"], val):
                        hard.append(f"argument '{key}' does not match required pattern")
                except re.error:
                    pass

    if hard:
        return False, {}, hard[:8]
    return True, cleaned, advisory[:3]


# ── Secrets redaction (§27) ─────────────────────────────────────────────

def redact_secrets(value: Any) -> tuple[Any, int]:
    """Redact secret shapes from checkpoint/run-record content. Returns (redacted, count)."""
    count = 0

    def _redact_str(text: str) -> str:
        nonlocal count
        out = text
        for pat in _SECRET_PATTERNS:
            out, n = pat.subn("[REDACTED_SECRET]", out)
            count += n
        return out

    def _walk(node: Any) -> Any:
        if isinstance(node, str):
            return _redact_str(node)
        if isinstance(node, dict):
            return {k: ("[REDACTED_SECRET]" if _SENSITIVE_KEY_RE.search(str(k)) and isinstance(v, str)
                        else _walk(v))
                    for k, v in node.items()}
        if isinstance(node, list):
            return [_walk(v) for v in node]
        return node

    try:
        redacted = _walk(value)
    except Exception:
        return value, 0
    # Count key-name redactions too (walk replaced them silently).
    return redacted, count


# ── Message history compaction (§10) ────────────────────────────────────

def _message_chars(messages: list[dict[str, Any]]) -> int:
    total = 0
    for m in messages:
        try:
            total += len(json.dumps(m, default=str))
        except Exception:
            total += len(str(m))
    return total


def compact_messages(messages: list[dict[str, Any]],
                     keep_last_tool_rounds: int = REACT_KEEP_LAST_TOOL_ROUNDS,
                     max_chars: int = REACT_MESSAGE_HISTORY_MAX_CHARS) -> tuple[list[dict[str, Any]], bool]:
    """Bound model context. Keeps system + first user message + the most recent
    tool exchanges (assistant+tool pairs dropped atomically). Returns (messages, compacted)."""
    if _message_chars(messages) <= max_chars:
        return messages, False
    if len(messages) <= 2:
        return messages, False
    head = messages[:2]
    tail = messages[2:]
    # Group tail into assistant/tool pairs from the end.
    pairs: list[list[dict[str, Any]]] = []
    buf: list[dict[str, Any]] = []
    for m in reversed(tail):
        buf.append(m)
        if m.get("role") == "assistant":
            pairs.append(list(reversed(buf)))
            buf = []
    if buf:
        pairs.append(list(reversed(buf)))
    pairs = list(reversed(pairs))
    kept = pairs[-keep_last_tool_rounds:] if keep_last_tool_rounds > 0 else []
    out = list(head) + [m for p in kept for m in p]
    if _message_chars(out) > max_chars and len(out) > 2:
        # Still too big: hard-truncate oldest tool contents (pair structure kept).
        for m in out[2:]:
            if m.get("role") == "tool" and isinstance(m.get("content"), str) and len(m["content"]) > 2000:
                m["content"] = m["content"][:2000] + " …[compacted]"
            if _message_chars(out) <= max_chars:
                break
    return out, True


# ── Cancellation (§15) ──────────────────────────────────────────────────

async def check_react_cancel(request_id: str | None) -> bool:
    """Re-read the durable cancel flag (same source the outer loop uses)."""
    if not request_id:
        return False
    try:
        from .state import load_or_create_state
        st = await load_or_create_state(request_id)
        return bool(st.cancel_requested)
    except Exception:
        return False


# ── Tool failure classification (§19) ───────────────────────────────────

def classify_tool_failure(exc: BaseException) -> tuple[str, str]:
    """Map a tool-execution exception to (class, reason).

    - terminal-policy: never retry, record + feed denial (permission/card/tamper).
    - replan: executor already retried transient internally; the model may try
      a different action (error observation fed back, loop continues bounded).
    - retryable: reserved for transport-level errors the executor did NOT
      already retry (rare); treated as replan after one immediate re-issue.
    """
    name = type(exc).__name__
    text = str(exc).lower()
    if "permission" in name.lower() or "permission" in text or "denied" in text or "unauthorized" in text:
        return "terminal-policy", f"denied: {str(exc)[:200]}"
    if "workspace" in text and ("tamper" in text or "required" in text or "prohibited" in text):
        return "terminal-policy", f"workspace-boundary: {str(exc)[:200]}"
    if "timeout" in name.lower() or "timed out" in text:
        return "replan", f"timeout-after-retries: {str(exc)[:200]}"
    return "replan", f"tool-error: {str(exc)[:200]}"


# ── Termination vocabulary (§12 — reuses LoopState reasons) ─────────────

REACT_TERMINATION_MAP = {
    "answered": "success",
    "answered_structured": "success",
    "approval_paused": "success",      # outer loop surfaces the approval card (action=request_approval)
    "budget_spend": "cost_budget",
    "budget_time": "timeout",
    "budget_tools": "tool_budget",
    "budget_tokens": "token_budget",
    "cancelled": "user_cancel",
    "cycle": "cycle_detected",
    "no_progress": "no_progress",
    "max_rounds": "max_iterations",
    "policy_denied": "policy_stop",
    "provider_down": "dependency_failure",
    "validation_failed": "failure",
}


# ── Run record + metrics (§23/§24) ──────────────────────────────────────

@dataclass
class ReactRunRecord:
    correlation_id: str
    run_id: str
    agent_name: str
    workspace_id: str
    tenant_id: str | None = None
    rounds: int = 0
    tool_calls: int = 0
    tool_failures: int = 0
    approvals_requested: int = 0
    approvals_consumed: int = 0
    provider_fallbacks: int = 0
    failure_category: str | None = None
    model_name: str = ""
    model_provider: str = ""
    termination: str = "unknown"
    duration_ms: float = 0.0
    tokens_est: int = 0
    denials: int = 0
    compacted: bool = False
    resumed: bool = False


_react_metrics: dict[str, Any] = {
    "runs": 0,
    "by_termination": {},
    "iterations_total": 0,
    "tool_calls_total": 0,
    "tool_failures_total": 0,
    "fallbacks_total": 0,
    "approvals_requested_total": 0,
    "cancels_total": 0,
    "duration_ms_total": 0.0,
}


def record_react_run(rec: ReactRunRecord) -> dict[str, Any]:
    """Structured operator trace (metadata only — never reasoning or secrets)."""
    _react_metrics["runs"] += 1
    _react_metrics["by_termination"][rec.termination] = \
        _react_metrics["by_termination"].get(rec.termination, 0) + 1
    _react_metrics["iterations_total"] += rec.rounds
    _react_metrics["tool_calls_total"] += rec.tool_calls
    _react_metrics["tool_failures_total"] += rec.tool_failures
    _react_metrics["fallbacks_total"] += rec.provider_fallbacks
    _react_metrics["approvals_requested_total"] += rec.approvals_requested
    if rec.termination == "cancelled":
        _react_metrics["cancels_total"] += 1
    _react_metrics["duration_ms_total"] += rec.duration_ms
    entry = {
        "correlation_id": rec.correlation_id, "run_id": rec.run_id,
        "agent": rec.agent_name, "workspace": str(rec.workspace_id)[:8],
        "tenant": str(rec.tenant_id)[:8] if rec.tenant_id else "-",
        "rounds": rec.rounds, "tool_calls": rec.tool_calls,
        "tool_failures": rec.tool_failures,
        "approvals_requested": rec.approvals_requested,
        "approvals_consumed": rec.approvals_consumed,
        "provider_fallbacks": rec.provider_fallbacks,
        "failure_category": rec.failure_category,
        "model": rec.model_name, "provider": rec.model_provider,
        "termination": rec.termination, "duration_ms": round(rec.duration_ms, 1),
        "tokens_est": rec.tokens_est, "denials": rec.denials,
        "compacted": rec.compacted, "resumed": rec.resumed,
    }
    logger.info("REACT_RUN %s", json.dumps(entry, default=str))
    return entry


def get_react_stats() -> dict[str, Any]:
    runs = _react_metrics["runs"]
    return {
        **{k: (dict(v) if isinstance(v, dict) else v) for k, v in _react_metrics.items()},
        "avg_rounds": round(_react_metrics["iterations_total"] / runs, 2) if runs else 0.0,
        "avg_tool_calls": round(_react_metrics["tool_calls_total"] / runs, 2) if runs else 0.0,
        "tool_failure_rate": round(_react_metrics["tool_failures_total"] / _react_metrics["tool_calls_total"], 4)
        if _react_metrics["tool_calls_total"] else 0.0,
        "fallback_rate": round(_react_metrics["fallbacks_total"] / runs, 4) if runs else 0.0,
    }


def reset_react_metrics() -> None:
    _react_metrics.update({"runs": 0, "by_termination": {}, "iterations_total": 0,
                           "tool_calls_total": 0, "tool_failures_total": 0,
                           "fallbacks_total": 0, "approvals_requested_total": 0,
                           "cancels_total": 0, "duration_ms_total": 0.0})


def estimate_tokens(text: str) -> int:
    return max(0, len(text or "") // 4)


# ── Resume replay (§17) ─────────────────────────────────────────────────

def build_resume_messages(phases: dict[str, Any], request_id: str,
                          system_content: str, user_content: str) -> tuple[list[dict[str, Any]] | None, int]:
    """Rebuild message history from a checkpointed react run WITHOUT re-executing tools.

    Returns (messages, completed_rounds) or (None, 0) when no resumable run exists.
    Stored observations are already redacted + capped at checkpoint time.
    """
    key = f"react_run_{request_id}"
    snap = (phases or {}).get(key)
    if not isinstance(snap, dict):
        return None, 0
    rounds = snap.get("rounds") or []
    if snap.get("status") in ("terminal",) or not rounds:
        return None, 0
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]
    done = 0
    for r in rounds:
        # Replay every fully-recorded round (success/error/denied/approval-pause
        # are all deterministic history — replaying them re-executes nothing).
        if not isinstance(r, dict) or not r.get("tool") or not r.get("observation"):
            break  # partial tail is re-executed, never fabricated
        tc = {"id": r.get("tool_call_id") or f"replay-{done}",
              "type": "function",
              "function": {"name": r["tool"], "arguments": r.get("args_redacted") or {}}}
        messages.append({"role": "assistant", "content": r.get("assistant_text") or None, "tool_calls": [tc]})
        messages.append({"role": "tool", "tool_call_id": tc["id"],
                         "content": r.get("observation") or ""})
        done += 1
    if done == 0:
        return None, 0
    return messages, done
