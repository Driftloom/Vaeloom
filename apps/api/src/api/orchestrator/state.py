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


class ConcurrentUpdateError(Exception):
    """Optimistic-concurrency conflict: another writer won the CAS race."""


class LoopState:
    def __init__(self, request_id: str, workspace_id: str | None = None):
        self.request_id = request_id
        self.run_id = request_id  # stable execution identity across retries/restarts
        self.migrated_from: str | None = None  # set only by v1 -> v2 migration
        self.workspace_id = str(workspace_id) if workspace_id else None
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
            "workspace_id": self.workspace_id,
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
        state = cls(data["request_id"], workspace_id=data.get("workspace_id"))
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
            "compiler_version", "context_fingerprint",
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
        state.phases = data.get("phases", {})
        state.created_at = data.get("created_at", "")
        state.updated_at = data.get("updated_at", "")
        return state


from .state_store import get_state_store


async def load_or_create_state(request_id: str, workspace_id: str | None = None) -> LoopState:
    try:
        data = await get_state_store().load(request_id)
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


async def save_checkpoint(
    state: LoopState,
    workspace_id: str | None = None,
    *,
    expected_version: int | None = None,
) -> int:
    """Persist with optimistic concurrency.

    Increments state_version on success and returns it. When expected_version
    is given and the stored version differs, raises ConcurrentUpdateError
    instead of silently last-write-winning.
    """
    wid = workspace_id or getattr(state, "workspace_id", None)
    # Primary: Save via pluggable StateStore (Database/Redis/Composite/File)
    try:
        from .state_store import ConcurrentUpdateError as _CUE

        new_version = await get_state_store().save(
            state.request_id, state.to_dict(), wid, expected_version=expected_version
        )
        state.state_version = new_version
        logger.info(f"Checkpoint saved for {state.request_id}: v{new_version} phases={list(state.phases.keys())}")
        return new_version
    except Exception as exc:
        # CAS conflicts must surface, never silently fall back to file LWW.
        try:
            from .state_store import ConcurrentUpdateError as _CUE2

            if isinstance(exc, _CUE2):
                raise
        except ConcurrentUpdateError:
            raise
        except Exception:
            pass
        logger.warning(f"StateStore save failed for {state.request_id}, falling back to local file: {exc}")

    # Fallback: Direct local file write (bumps version locally).
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"{state.request_id}.json"
    try:
        state.state_version += 1
        await asyncio.to_thread(
            state_file.write_text,
            json.dumps(state.to_dict(), indent=2, default=str),
        )
        logger.info(f"Checkpoint saved to local file for {state.request_id}: v{state.state_version} phases={list(state.phases.keys())}")
        return state.state_version
    except OSError as e:
        # Historical contract: persistence failure is logged, never raised —
        # the run continues with in-memory state (test_save_checkpoint_handles_oserror).
        logger.error(f"Failed to save checkpoint for {state.request_id}: {e}")
        return state.state_version
