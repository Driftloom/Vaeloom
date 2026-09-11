"""Versioned, concurrency-safe agent loop state (Phase B).

Schema v2 extends the v1 {request_id, workspace_id, phases} envelope with the
durable fields a run needs to be recoverable, observable, and resumable:

- run_id / agent identity / workflow-graph versions
- iteration / phase / status / explicit termination reason
- goal / plan summary fingerprint (no raw sensitive content)
- completed tool calls (idempotency keys, never blind replay)
- observation fingerprints (progress detection input)
- approvals consumed (single-use token ids)
- budgets + spent (per-run hard ceilings)
- model / prompt / compiler versions + context fingerprint (provenance)
- retrieval context identifiers (memory/entity/document ids)
- optimistic-concurrency state_version (no naive LWW)

v1 payloads load and migrate forward (migrated_from="v1").
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

STATE_DIR = Path(os.environ.get("VAELOOM_STATE_DIR", str(Path.home() / ".vaeloom" / "state")))

STATE_SCHEMA_VERSION = 2

TERMINAL_STATUSES = frozenset({"success", "failed", "escalated", "cancelled", "paused_awaiting_approval"})

# Explicit termination reasons — every run end must name one (Phase B §6).
TERMINATION_REASONS = frozenset({
    "success",
    "qa_failed",           # QA rejected after retries; output delivered best-effort or failed closed
    "failure",             # unrecoverable error
    "no_progress",         # repeated identical observations / no state change
    "cycle_detected",      # A->B->A oscillation or 3x repeated action
    "max_iterations",      # hard iteration ceiling
    "timeout",             # wall-clock ceiling
    "token_budget",        # token ceiling
    "tool_budget",         # tool-call ceiling
    "cost_budget",         # USD ceiling (daily or per-run)
    "user_cancel",         # explicit cancellation
    "policy_stop",         # contract/permission/policy denial
    "dependency_failure",  # DB/vector/queue/provider outage
})

# Muse §30 failure taxonomy: every terminal run maps to an explicit code.
# Kept stable for operators; termination_reason stays the fine-grained cause.
FAILURE_CODES = frozenset({
    "OK",
    "AUTHORIZATION_FAILURE",
    "VALIDATION_FAILURE",
    "MODEL_FAILURE",
    "TOOL_FAILURE",
    "RETRIEVAL_FAILURE",
    "MEMORY_FAILURE",
    "APPROVAL_REQUIRED",
    "APPROVAL_FAILURE",
    "TIMEOUT",
    "CANCELLATION",
    "RETRY_EXHAUSTED",
    "CHECKPOINT_FAILURE",
    "POLICY_FAILURE",
})

_TERMINATION_TO_FAILURE_CODE = {
    "success": "OK",
    "qa_failed": "VALIDATION_FAILURE",
    "failure": "TOOL_FAILURE",
    "no_progress": "POLICY_FAILURE",
    "cycle_detected": "POLICY_FAILURE",
    "max_iterations": "RETRY_EXHAUSTED",
    "timeout": "TIMEOUT",
    "token_budget": "POLICY_FAILURE",
    "tool_budget": "POLICY_FAILURE",
    "cost_budget": "POLICY_FAILURE",
    "user_cancel": "CANCELLATION",
    "policy_stop": "POLICY_FAILURE",
    "dependency_failure": "TOOL_FAILURE",
}


def failure_code_for(status: str, reason: str | None) -> str:
    """Map (status, termination_reason) to the §30 failure taxonomy."""
    if status == "paused_awaiting_approval":
        return "APPROVAL_REQUIRED"
    if not reason:
        return "OK" if status in ("success", "running") else "TOOL_FAILURE"
    return _TERMINATION_TO_FAILURE_CODE.get(reason, "TOOL_FAILURE")

# Default per-run hard ceilings (Phase B §13). These apply even when the
# workspace daily budget is 0.0 (unlimited) — a run is never unbounded.
DEFAULT_RUN_BUDGETS: dict[str, float] = {
    "max_iterations": 3,
    "max_tool_calls": 12,
    "max_tokens": 12000,
    "max_cost_usd": 0.50,
    "max_duration_s": 120.0,
}


def _fingerprint(value: Any, limit: int = 2000) -> str:
    try:
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)[:limit]
    except Exception:
        raw = str(value)[:limit]
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


class StaleCheckpointError(Exception):
    """Checkpoint on disk/DB is older than the caller's known version."""


try:  # Single canonical CAS exception (defined in state_store).
    from .state_store import ConcurrentUpdateError
except Exception:  # pragma: no cover — import-cycle fallback
    class ConcurrentUpdateError(Exception):  # type: ignore[no-redef]
        """Optimistic-concurrency conflict: another writer won the CAS race."""


class ForeignCheckpointError(Exception):
    """Resume refused: stored checkpoint identity does not match the caller.

    Raised by validate_resume_identity() when a checkpoint owned by another
    tenant/workspace/agent is presented for resume (LOOP-RESUME-01). Callers
    must fail closed: no serving, no merging, no identity overwrite.
    """


def validate_resume_identity(
    state: "LoopState",
    *,
    tenant_id: str | None = None,
    workspace_id: str | None = None,
    agent_id: str | None = None,
) -> "LoopState":
    """Enforce resume trust parity with the graph path (LOOP-RESUME-01).

    Rules (fail closed on mismatch, pin-on-first-sight for legacy blanks):
    - stored workspace present + incoming present + differ -> refuse.
    - stored tenant present + incoming present + differ -> refuse.
    - stored agent present + incoming present + differ -> refuse.
    - stored *_id absent + incoming present -> pin incoming (one-time;
      covers legacy checkpoints that predate identity binding).
    - nothing stored and nothing incoming -> fresh run, nothing to check.
    Returns the (possibly pinned) state. Never adopts foreign identity.
    """
    def _norm(v):
        return str(v) if v not in (None, "") else None

    for attr, incoming in (
        ("workspace_id", _norm(workspace_id)),
        ("tenant_id", _norm(tenant_id)),
        ("agent_id", _norm(agent_id)),
    ):
        stored = _norm(getattr(state, attr, None))
        if stored and incoming and stored != incoming:
            raise ForeignCheckpointError(
                f"checkpoint {attr} mismatch (stored={stored} incoming={incoming}) — refusing resume"
            )
        if not stored and incoming:
            setattr(state, attr, incoming)
    return state


class LoopState:
    def __init__(self, request_id: str, workspace_id: str | None = None,
                 tenant_id: str | None = None, user_id: str | None = None):
        self.request_id = request_id
        self.run_id = request_id  # stable execution identity across retries/restarts
        self.migrated_from: str | None = None  # set only by v1 -> v2 migration
        # §29 trace correlation: caller-provided (middleware/queue/envelope)
        # or defaults to the run id. Never a secret.
        self.correlation_id = request_id
        # §31 cooperative cancellation: set via request_cancel(); the loop
        # checks it before every act phase and stops without further side
        # effects. Durable (checkpointed) so worker restarts honor it.
        self.cancel_requested = False
        self.cancel_requested_at: str | None = None
        self.workspace_id = str(workspace_id) if workspace_id else None
        # LOOP-RESUME-01: tenant/user binding for resume isolation parity.
        self.tenant_id = str(tenant_id) if tenant_id else None
        self.user_id = str(user_id) if user_id else None
        self.agent_id = ""
        self.agent_version = "v1.0"
        self.workflow_version = "v1"
        self.graph_version = "v1"
        self.iteration = 0
        self.phase = "created"
        self.status = "running"  # running|succeeded|failed|escalated|cancelled|paused_awaiting_approval
        self.termination_reason: str | None = None
        self.goal_fingerprint = ""
        self.plan_fingerprint = ""
        self.completed_tool_calls: list[dict[str, Any]] = []  # [{tool, idem_key, status, at}]
        self.observation_fingerprints: list[str] = []
        self.approvals_consumed: list[str] = []
        self.budgets: dict[str, float] = dict(DEFAULT_RUN_BUDGETS)
        self.spent: dict[str, float] = {"tool_calls": 0, "tokens": 0, "cost_usd": 0.0, "elapsed_s": 0.0}
        self.model_name = ""
        self.model_provider = ""
        self.prompt_version = ""
        self.compiler_version = ""
        self.context_fingerprint = ""
        self.retrieval_ids: list[str] = []
        self.policy_decisions: list[dict[str, Any]] = []
        self.state_version = 1  # optimistic-concurrency counter (CAS)
        # CAS-DEAD-01: version observed at load; save_checkpoint defaults its
        # expected_version to this so every production writer gets CAS.
        # Advanced on every successful save (save sets both fields).
        self._loaded_version = 1
        self.phases: dict[str, Any] = {}
        self.created_at: str = datetime.now(UTC).isoformat()
        self.updated_at: str = self.created_at
        self._started_monotonic = time.monotonic()

    # -- mutation helpers -------------------------------------------------
    def add_phase(self, phase_name: str, result: Any):
        self.phases[phase_name] = result
        self.phase = phase_name
        self.updated_at = datetime.now(UTC).isoformat()

    def record_tool_call(self, tool: str, idem_key: str | None, status: str) -> None:
        self.completed_tool_calls.append({
            "tool": tool,
            "idem_key": idem_key or "",
            "status": status,
            "at": datetime.now(UTC).isoformat(),
        })
        self.spent["tool_calls"] = float(len(self.completed_tool_calls))

    def has_completed_tool_call(self, idem_key: str) -> dict[str, Any] | None:
        if not idem_key:
            return None
        for rec in self.completed_tool_calls:
            if rec.get("idem_key") == idem_key:
                return rec
        return None

    def record_observation(self, observation: Any) -> str:
        fp = _fingerprint(observation)
        self.observation_fingerprints.append(fp)
        return fp

    def record_policy(self, decision: str, detail: str = "") -> None:
        self.policy_decisions.append({
            "decision": decision,
            "detail": detail[:500],
            "at": datetime.now(UTC).isoformat(),
        })

    def terminate(self, status: str, reason: str) -> None:
        if reason not in TERMINATION_REASONS:
            raise ValueError(f"unknown termination reason: {reason}")
        self.status = status
        self.termination_reason = reason
        self.phase = f"terminated:{reason}"
        self.spent["elapsed_s"] = round(time.monotonic() - self._started_monotonic, 3)
        self.updated_at = datetime.now(UTC).isoformat()

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES

    # -- serialization ----------------------------------------------------
    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": STATE_SCHEMA_VERSION,
            "request_id": self.request_id,
            "run_id": self.run_id,
            "correlation_id": self.correlation_id,
            "cancel_requested": self.cancel_requested,
            "cancel_requested_at": self.cancel_requested_at,
            "workspace_id": self.workspace_id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "agent_id": self.agent_id,
            "agent_version": self.agent_version,
            "workflow_version": self.workflow_version,
            "graph_version": self.graph_version,
            "iteration": self.iteration,
            "phase": self.phase,
            "status": self.status,
            "termination_reason": self.termination_reason,
            "goal_fingerprint": self.goal_fingerprint,
            "plan_fingerprint": self.plan_fingerprint,
            "completed_tool_calls": self.completed_tool_calls,
            "observation_fingerprints": self.observation_fingerprints,
            "approvals_consumed": self.approvals_consumed,
            "budgets": self.budgets,
            "spent": self.spent,
            "model_name": self.model_name,
            "model_provider": self.model_provider,
            "prompt_version": self.prompt_version,
            "compiler_version": self.compiler_version,
            "context_fingerprint": self.context_fingerprint,
            "retrieval_ids": self.retrieval_ids,
            "policy_decisions": self.policy_decisions,
            "state_version": self.state_version,
            "phases": self._serialize_phases(),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def _serialize_phases(self) -> dict[str, Any]:
        serialized = {}
        for key, value in self.phases.items():
            if hasattr(value, "model_dump"):
                serialized[key] = value.model_dump()
            elif hasattr(value, "dict"):
                serialized[key] = value.dict()
            elif isinstance(value, (str, int, float, bool, list, dict)):
                serialized[key] = value
            else:
                serialized[key] = str(value)
        return serialized

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "LoopState":
        state = cls(
            data["request_id"],
            workspace_id=data.get("workspace_id"),
            tenant_id=data.get("tenant_id"),
            user_id=data.get("user_id"),
        )
        if data.get("schema_version", 1) < STATE_SCHEMA_VERSION:
            # v1 -> v2 forward migration (no data loss; new fields defaulted).
            state.phases = data.get("phases", {})
            state.created_at = data.get("created_at", "")
            state.updated_at = data.get("updated_at", "")
            state.run_id = data.get("run_id") or data["request_id"]
            state.migrated_from = "v1"
            return state
        for field in (
            "run_id", "agent_id", "agent_version", "workflow_version", "graph_version",
            "iteration", "phase", "status", "termination_reason", "goal_fingerprint",
            "plan_fingerprint", "model_name", "model_provider", "prompt_version",
            "compiler_version", "context_fingerprint", "correlation_id",
            "cancel_requested", "cancel_requested_at", "tenant_id", "user_id",
        ):
            if field in data:
                setattr(state, field, data[field])
        state.completed_tool_calls = list(data.get("completed_tool_calls", []))
        state.observation_fingerprints = list(data.get("observation_fingerprints", []))
        state.approvals_consumed = list(data.get("approvals_consumed", []))
        state.budgets = {**dict(DEFAULT_RUN_BUDGETS), **dict(data.get("budgets", {}))}
        state.spent = {**dict(state.spent), **dict(data.get("spent", {}))}
        state.retrieval_ids = list(data.get("retrieval_ids", []))
        state.policy_decisions = list(data.get("policy_decisions", []))
        try:
            state.state_version = int(data.get("state_version", 1))
        except (TypeError, ValueError):
            state.state_version = 1
        state._loaded_version = state.state_version
        state.phases = data.get("phases", {})
        state.created_at = data.get("created_at", "")
        state.updated_at = data.get("updated_at", "")
        return state


from .state_store import get_state_store


async def load_or_create_state(request_id: str, workspace_id: str | None = None) -> LoopState:
    try:
        data = await get_state_store().load(request_id, workspace_id)
        if data:
            logger.info(f"Loaded existing state for {request_id}")
            st = LoopState.from_dict(data)
            if workspace_id and not st.workspace_id:
                st.workspace_id = str(workspace_id)
            return st
    except Exception as exc:
        logger.warning(f"StateStore load failed for {request_id}: {exc}")

    # Fallback to local file if state store returned None
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"{request_id}.json"
    if state_file.exists():
        try:
            data = json.loads(await asyncio.to_thread(state_file.read_text))
            logger.info(f"Loaded existing state from local file for {request_id}")
            st = LoopState.from_dict(data)
            if workspace_id and not st.workspace_id:
                st.workspace_id = str(workspace_id)
            return st
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Failed to load state for {request_id}: {e}")
    return LoopState(request_id, workspace_id=workspace_id)


async def request_cancel(request_id: str) -> bool:
    """Request cooperative cancellation of a run (§31).

    Sets the durable flag; the loop (and any worker driving it) observes it
    before the next consequential step and terminates as
    cancelled/user_cancel without further side effects. Returns False only
    when no checkpoint exists (nothing to cancel) — never raises for a
    missing run. Terminal runs are left untouched (idempotent).
    """
    try:
        state = await load_or_create_state(request_id)
    except Exception as exc:
        logger.warning(f"Cancel lookup failed for {request_id}: {exc}")
        return False
    if not state.phases:
        # No checkpoint exists yet (fresh state) — nothing to cancel.
        # A real run always persists at least one phase per checkpoint.
        return False
    if state.is_terminal:
        return True
    state.cancel_requested = True
    state.cancel_requested_at = datetime.now(UTC).isoformat()
    try:
        await save_checkpoint(state)
    except Exception as exc:
        logger.warning(f"Cancel checkpoint save failed for {request_id}: {exc}")
        return False
    logger.info(f"Cancel requested for run {request_id}")
    return True


async def save_checkpoint(
    state: LoopState,
    workspace_id: str | None = None,
    *,
    expected_version: int | None = None,
    max_conflict_retries: int = 3,
) -> int:
    """Persist with optimistic concurrency (CAS-DEAD-01: always on).

    expected_version defaults to the version observed at load
    (state._loaded_version), so EVERY production caller gets CAS without code
    changes. On conflict: reload truth, merge monotonic signals
    (cancel/terminal), and retry bounded times; then raise
    ConcurrentUpdateError. Transport failures fall back to the local file
    THROUGH FileStateStore.save with the same expected_version (CAS still
    enforced) — never manual LWW.
    """
    wid = workspace_id or getattr(state, "workspace_id", None)
    if expected_version is None:
        expected_version = getattr(state, "_loaded_version", None)
        if expected_version is None:
            try:
                expected_version = int(state.state_version)
            except (TypeError, ValueError):
                expected_version = 1
    last_exc: Exception | None = None
    for _attempt in range(max_conflict_retries + 1):
        # Merge-before-write (§31 crash-safety): the in-memory copy may be stale
        # relative to a concurrent writer (cancel endpoint, supervisor resume,
        # crash-retry). Monotonic durable signals must survive:
        # - cancel_requested is once-True: a stored True always wins.
        # - terminal status is once-terminal: a stored terminal outcome always
        #   wins over a stale non-terminal copy (prevents un-completing runs).
        try:
            _stored = await get_state_store().load(state.request_id, wid)
        except Exception:
            _stored = None
        if isinstance(_stored, dict):
            if _stored.get("cancel_requested") and not state.cancel_requested:
                state.cancel_requested = True
                state.cancel_requested_at = _stored.get("cancel_requested_at") or state.cancel_requested_at
                logger.info(f"Merged concurrent cancel flag into checkpoint for {state.request_id}")
            if _stored.get("status") in TERMINAL_STATUSES and not state.is_terminal:
                state.status = _stored.get("status")
                state.termination_reason = _stored.get("termination_reason")
                logger.warning(f"Preserved stored terminal outcome for {state.request_id} over stale in-memory copy")
            try:
                expected_version = int(_stored.get("state_version", expected_version))
            except (TypeError, ValueError):
                pass
        # Primary: Save via pluggable StateStore (Database/Redis/Composite/File)
        try:
            new_version = await get_state_store().save(
                state.request_id, state.to_dict(), wid, expected_version=expected_version
            )
            state.state_version = new_version
            state._loaded_version = new_version
            logger.info(f"Checkpoint saved for {state.request_id}: v{new_version} phases={list(state.phases.keys())}")
            return new_version
        except ConcurrentUpdateError as exc:
            # CAS conflicts retry with fresh truth (loop head reloads).
            last_exc = exc
            logger.warning(
                f"Checkpoint CAS conflict for {state.request_id} "
                f"(attempt {_attempt + 1}): {exc}"
            )
            continue
        except Exception as exc:
            # Transport failures fall through to the file fallback below
            # (which still enforces CAS).
            logger.warning(f"StateStore save failed for {state.request_id}, falling back to local file: {exc}")
            break
    if last_exc is not None and _attempt >= max_conflict_retries:
        raise last_exc

    # Fallback: local file write THROUGH FileStateStore (CAS-enforced), never
    # manual last-write-wins.
    try:
        from .state_store import FileStateStore

        new_version = await FileStateStore().save(
            state.request_id, state.to_dict(), wid, expected_version=expected_version
        )
        state.state_version = new_version
        state._loaded_version = new_version
        logger.info(f"Checkpoint saved to local file for {state.request_id}: v{state.state_version} phases={list(state.phases.keys())}")
        return state.state_version
    except ConcurrentUpdateError:
        raise
    except Exception as exc:
        logger.warning(f"File fallback save failed for {state.request_id}: {exc}")
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        state_file = STATE_DIR / f"{state.request_id}.json"
        await asyncio.to_thread(
            state_file.write_text,
            json.dumps(state.to_dict(), indent=2, default=str),
        )
        return state.state_version
    except OSError as e:
        # Historical contract: persistence failure is logged, never raised —
        # the run continues with in-memory state (test_save_checkpoint_handles_oserror).
        logger.error(f"Failed to save checkpoint for {state.request_id}: {e}")
        return state.state_version
