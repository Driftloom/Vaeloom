"""Workflows (ADR-038 catalogue). Each workflow owns only
lifecycle/retries/timeouts/signals/queries; domain logic lives in activities.

Payload invariant (§15/§16): inputs are IDs/refs; secrets never in history.
Idempotent deterministic workflow IDs (§7).
Versioning via workflow.get_version on breaking field changes (§17).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any

try:
    from temporalio import workflow

    HAS_TEMPORAL = True
except Exception:  # pragma: no cover — SDK absent in lean test env
    HAS_TEMPORAL = False  # type: ignore[assignment]
    workflow = None  # type: ignore[assignment]

# RetryPolicy lives in temporalio.common, not workflow — import via unsafe pass-through
try:
    from temporalio.common import RetryPolicy  # type: ignore[import]

    HAS_RETRY = True
except Exception:
    HAS_RETRY = False
    RetryPolicy = None  # type: ignore[assignment]

with workflow.unsafe.imports_passed_through() if HAS_TEMPORAL else _dummy():  # type: ignore[attr-defined]
    from .activities import (
        ExtractEntitiesInput,
        IndexGraphInput,
        ParseDocumentInput,
        SyncConnectorInput,
        WriteMemoryInput,
    )


def _dummy():  # minimal context manager when temporal missing
    import contextlib

    return contextlib.nullcontext()


# Pre-import validation for workflow sandbox (avoids "imported after initial load" warning)
try:
    from .validation import validate_no_secrets as _wf_validate_no_secrets  # type: ignore
except Exception:  # pragma: no cover
    _wf_validate_no_secrets = None  # type: ignore


@dataclass
class IngestInput:
    workspace_id: str
    document_id: str
    content_hash: str
    requested_by: str | None = None
    correlation_id: str | None = None


@dataclass
class IngestResult:
    status: str
    document_id: str
    memories_created: int = 0
    error: str | None = None
    # T-P1-06: degraded when any step ran in fallback (e.g. memory store
    # unavailable) — the run completed but its counts are not authoritative.
    degraded: bool = False


@dataclass
class ApprovalWorkflowInput:
    approval_id: str
    timeout_seconds: int = 3600
    # Signal-binding fields (T-P1-03): the decision signal must carry the
    # same approval_id (and workspace when set); mismatched signals are
    # ignored, never applied. Optional-with-default so existing histories
    # replay unchanged.
    workspace_id: str | None = None


@dataclass
class DurableAgentRequest:
    """Typed durable agent request — no secrets, only IDs/refs (§15).

    Secrets (api keys, tokens) are resolved inside the activity via SecretManager,
    never carried in workflow history.
    """

    workspace_id: str
    user_id: str
    agent_id: str
    input: dict[str, Any] | None = None
    correlation_id: str | None = None
    # Trusted-identity passthrough (T-P2-01): request_id seeds the graph
    # checkpointer thread + idempotency scope (previously dropped, forcing a
    # shared "graph-req" thread); tenant_id binds tool/memory calls.
    # Graph version pins resume compatibility (T-§30). All optional so older
    # histories and callers keep working.
    request_id: str | None = None
    tenant_id: str | None = None
    graph_version: str = "v1"


@dataclass
class SyncConnectorResult:
    status: str
    connector_id: str
    synced_at: str | None = None
    error: str | None = None


try:
    from .metrics import (  # type: ignore
        temporal_workflow_completed as _wf_completed,
        temporal_workflow_failed as _wf_failed,
        temporal_workflow_started as _wf_started,
    )

    _HAS_WF_METRICS = _wf_started is not None
except Exception:
    _HAS_WF_METRICS = False
    _wf_started = _wf_completed = _wf_failed = None  # type: ignore

if HAS_TEMPORAL:

    async def _drive_activity(
        activity_name: str,
        arg: Any,
        *,
        start_to_close: timedelta,
        schedule_to_close: timedelta | None = None,
        heartbeat: timedelta | None = None,
        retry_policy: Any = None,
        max_redrives: int = 2,
    ) -> Any:
        """Execute an activity, re-driving worker-side cancellations.

        Server-side retries cover activity FAILURE, but NOT attempt
        CANCELLATION from graceful worker shutdown (deploys, pod restarts):
        the workflow then observes CancelledError while ITSELF alive. Without
        a re-drive, every deployment converts in-flight work into a false
        'cancelled' terminal. This helper re-drives (bounded) when the
        workflow is not itself cancelled; genuine user cancellation
        (wf.is_cancelled()) re-raises. Exhaustion raises a non-cancel
        ApplicationError so callers report failed, never a false cancelled.

        Deterministic: loop takes effect only on cancellation (absent from
        replay history the first call succeeds identically); all issued
        commands are recorded workflow commands.
        """
        import temporalio.workflow as wf

        _last: Exception | None = None
        for _ in range(max_redrives + 1):
            try:
                _kw: dict[str, Any] = {
                    "start_to_close_timeout": start_to_close,
                    "retry_policy": retry_policy,
                }
                if schedule_to_close is not None:
                    _kw["schedule_to_close_timeout"] = schedule_to_close
                if heartbeat is not None:
                    _kw["heartbeat_timeout"] = heartbeat
                return await wf.execute_activity(activity_name, arg, **_kw)
            except Exception as e:
                _last = e
                _txt = f"{type(e).__name__} {e}".lower()
                if "cancel" not in _txt:
                    raise
                try:
                    _wf_gone = bool(wf.is_cancelled())
                except Exception:
                    _wf_gone = True
                if _wf_gone:
                    raise
                # Worker-side cancellation with a live workflow: re-drive.
                continue
        try:
            from temporalio.exceptions import ApplicationError as _AE

            raise _AE("activity drive exhausted after worker turmoil",
                      non_retryable=True) from _last
        except ImportError:
            assert _last is not None
            raise _last

    @workflow.defn(name="IngestDocumentWorkflow")
    class IngestDocumentWorkflow:
        """Upload → parse → extract → memory-write → graph index (long-running).

        ID: ingest:{workspace}:{content_hash}:{document_id}
        Query: getStatus — UI polls running/retrying/completed/failed.
        Cancellation: cooperative — checks is_cancelled between steps.
        """

        def __init__(self) -> None:
            self._status: str = "running"
            self._step: str = "queued"
            self._error: str | None = None

        @workflow.query
        def getStatus(self) -> dict[str, Any]:  # noqa: N802 — Temporal query name
            return {"status": self._status, "step": self._step, "error": self._error}

        @workflow.run
        async def run(self, inp: IngestInput) -> IngestResult:
            import temporalio.workflow as wf

            # Version gate for future payload evolution (§17) — SDK 1.9+ uses `patched`
            try:
                wf.patched("ingest-v1")  # type: ignore[attr-defined]
            except Exception:
                pass

            def _is_cancel(e: Exception) -> bool:
                base = f"{type(e).__name__} {e} {getattr(e, 'cause', '')} {getattr(e, '__cause__', '')}".lower()
                return "cancel" in base

            # Kill-switch at workflow entry (§13) — fail-closed via activity
            try:
                ks = await wf.execute_activity(
                    "check_kill_switch",
                    {"agent": "memory"},
                    start_to_close_timeout=timedelta(seconds=5),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
                if ks and not ks.get("enabled", True):
                    self._status = "cancelled"
                    self._step = "killed"
                    self._error = "killed by kill-switch"
                    return IngestResult(status="cancelled", document_id=inp.document_id, error=self._error)
            except Exception as ke:
                if _is_cancel(ke):
                    self._status = "cancelled"
                    self._error = str(ke)[:500]
                    return IngestResult(status="cancelled", document_id=inp.document_id, error=self._error)
                # kill-switch check fail-open on non-cancel errors (activity missing etc.)

            try:
                self._step = "parsing"
                parsed = await wf.execute_activity(
                    "parse_document",
                    ParseDocumentInput(document_id=inp.document_id, workspace_id=inp.workspace_id),
                    start_to_close_timeout=timedelta(seconds=60),
                    heartbeat_timeout=timedelta(seconds=15),
                    retry_policy=RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=1), maximum_interval=timedelta(seconds=8), backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )

                self._step = "extracting"
                extracted = await wf.execute_activity(
                    "extract_entities",
                    ExtractEntitiesInput(document_id=inp.document_id, workspace_id=inp.workspace_id, parsed_ref=str(parsed.get("parsed_ref", ""))),
                    start_to_close_timeout=timedelta(seconds=45),
                    retry_policy=RetryPolicy(maximum_attempts=3, backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )

                self._step = "writing_memory"
                written = await wf.execute_activity(
                    "write_memory",
                    WriteMemoryInput(workspace_id=inp.workspace_id, document_id=inp.document_id, entities=extracted.get("entities", [])),
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=RetryPolicy(maximum_attempts=3, backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )
                # T-P1-06: a fallback parse or write is degraded, not a silent success.
                _degraded = bool(
                    (isinstance(written, dict) and written.get("fallback"))
                    or (isinstance(parsed, dict) and (parsed.get("fallback") or parsed.get("error")))
                )

                self._step = "indexing"
                await wf.execute_activity(
                    "index_graph",
                    IndexGraphInput(workspace_id=inp.workspace_id, document_id=inp.document_id),
                    start_to_close_timeout=timedelta(seconds=10),
                    retry_policy=RetryPolicy(maximum_attempts=2, backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )

                self._status = "completed"
                self._step = "completed"
                try:
                    await wf.execute_activity(
                        "record_workflow_metric",
                        {"workflow_type": "IngestDocumentWorkflow", "task_queue": "vaeloom-ingest-q", "status": "completed" if not _degraded else "degraded"},
                        start_to_close_timeout=timedelta(seconds=5),
                        retry_policy=RetryPolicy(maximum_attempts=1),
                    )
                except Exception:
                    pass
                return IngestResult(status="completed", document_id=inp.document_id, memories_created=int(written.get("memories_created", 0) or 0) if isinstance(written, dict) else 0, degraded=_degraded)
            except Exception as e:
                if _is_cancel(e):
                    self._status = "cancelled"
                    self._error = str(e)[:500]
                    try:
                        await wf.execute_activity(
                            "record_workflow_metric",
                            {"workflow_type": "IngestDocumentWorkflow", "task_queue": "vaeloom-ingest-q", "status": "cancelled"},
                            start_to_close_timeout=timedelta(seconds=5),
                            retry_policy=RetryPolicy(maximum_attempts=1),
                        )
                    except Exception:
                        pass
                    return IngestResult(status="cancelled", document_id=inp.document_id, error=self._error)
                self._status = "failed"
                self._error = str(e)[:500]
                try:
                    await wf.execute_activity(
                        "record_workflow_metric",
                        {"workflow_type": "IngestDocumentWorkflow", "task_queue": "vaeloom-ingest-q", "status": "failed"},
                        start_to_close_timeout=timedelta(seconds=5),
                        retry_policy=RetryPolicy(maximum_attempts=1),
                    )
                except Exception:
                    pass
                return IngestResult(status="failed", document_id=inp.document_id, error=self._error)

    @workflow.defn(name="HelloWorkflow")
    class HelloWorkflow:
        """Smoke workflow for infra verification (Phase 4). Not durable business logic."""

        @workflow.run
        async def run(self, name: str) -> str:
            return f"hello {name}"

    @workflow.defn(name="DurableAgentRunWorkflow")
    class DurableAgentRunWorkflow:
        """Thin durable shell around DurableAgentRunActivity (future LangGraph seam §23).

        ID: durable_run:{workspace}:{user}:{request_id}
        Query: getStatus. Activity owns agent logic, retries, fallbacks.
        Payload is DurableAgentRequest (typed, no secrets — §15).
        """

        def __init__(self) -> None:
            self._status: str = "running"

        @workflow.query
        def getStatus(self) -> dict[str, Any]:  # noqa: N802
            return {"status": self._status}

        @workflow.run
        async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
            import temporalio.workflow as wf
            from temporalio.exceptions import ApplicationError

            try:
                wf.patched("durable-agent-v1")  # type: ignore[attr-defined]
            except Exception:
                pass
            # T-001: Reject any payload containing secret-like keys (recursive, fail-closed)
            # This is the last line of defense — API layer already validates before start_workflow,
            # but workflow must also fail closed if secret reaches history (e.g., direct Temporal client)
            try:
                from .validation import validate_no_secrets
                import temporalio.workflow as _wf2

                _wf2.logger.info(f"Durable payload check keys: {list(payload.keys()) if isinstance(payload, dict) else type(payload).__name__}")

                validate_no_secrets(payload)
            except ValueError as ve:
                raise ApplicationError(str(ve), non_retryable=True) from ve
            # Normalize to typed request for activity (supports both dict and dataclass inputs)
            try:
                if isinstance(payload, dict):
                    # Extract typed fields from dict (handles both DurableAgentRequest-as-dict and legacy)
                    req = DurableAgentRequest(
                        workspace_id=str(payload.get("workspace_id") or payload.get("workspaceId") or "unknown"),
                        user_id=str(payload.get("user_id") or payload.get("userId") or "unknown"),
                        agent_id=str(payload.get("agent_id") or payload.get("agent") or "memory"),
                        input=payload.get("input"),
                        correlation_id=payload.get("correlation_id") or payload.get("correlationId"),
                        # T-P2-01: preserve run identity + tenant + graph pin
                        # (previously dropped → shared "graph-req" thread +
                        # tenant-less graph execution).
                        request_id=payload.get("request_id") or payload.get("requestId") or payload.get("correlation_id") or payload.get("correlationId"),
                        tenant_id=payload.get("tenant_id") or payload.get("tenantId"),
                        graph_version=str(payload.get("graph_version") or "v1"),
                    )
                else:
                    # Already a dataclass (should not happen when signature is dict, but handle)
                    req = payload  # type: ignore[assignment]
            except Exception:
                # If conversion fails, treat as validation error
                raise ApplicationError("invalid durable agent payload", non_retryable=True) from None
            # Use normalized req for kill-switch and activity
            payload = req  # type: ignore[assignment]
            def _is_cancel(e: Exception) -> bool:
                base = f"{type(e).__name__} {e} {getattr(e, 'cause', '')} {getattr(e, '__cause__', '')}".lower()
                return "cancel" in base

            # Kill-switch check (§13) before expensive LLM call.
            # Driven via _drive_activity: a worker shutdown mid-check
            # re-drives instead of falsely cancelling the run.
            try:
                ag = payload.agent_id if hasattr(payload, "agent_id") else str(payload.get("agent_id", "memory")) if isinstance(payload, dict) else "memory"  # type: ignore[union-attr]
                ks = await _drive_activity(
                    "check_kill_switch",
                    {"agent": ag},
                    start_to_close=timedelta(seconds=5),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
                if ks and not ks.get("enabled", True):
                    self._status = "cancelled"
                    return {"status": "cancelled", "error": f"killed kill-switch agent={ag}"}
            except Exception as ke:
                if _is_cancel(ke):
                    self._status = "cancelled"
                    return {"status": "cancelled", "error": str(ke)[:500]}
                # Kill-switch unreadable (non-cancel): fail OPEN for reads is
                # the activity's contract (returns enabled False on error) —
                # an exception here means worker turmoil; fail closed.
                self._status = "failed"
                return {"status": "failed", "error": str(ke)[:500]}

            # Quota check (T-007) — durable Redis, fail-open if unavailable, fail-closed on exceeded
            try:
                await _drive_activity(
                    "check_quota",
                    {"workspace_id": payload.workspace_id, "metric": "requests", "increment": 1},
                    start_to_close=timedelta(seconds=5),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
            except Exception as qe:
                if _is_cancel(qe):
                    self._status = "cancelled"
                    return {"status": "cancelled", "error": str(qe)[:500]}
                if "quota exceeded" in str(qe).lower():
                    self._status = "failed"
                    return {"status": "failed", "error": str(qe)[:500]}
                pass

            try:
                res = await _drive_activity(
                    "durable_agent_run",
                    payload,
                    start_to_close=timedelta(seconds=120),
                    schedule_to_close=timedelta(minutes=10),
                    heartbeat=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=2, initial_interval=timedelta(milliseconds=100), backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )
                # T-P1-02 terminal agreement: Temporal MUST report the same
                # terminal state Muse reached — never collapse waiting/budget/
                # cancelled into "completed". Unknown shapes fail closed.
                _act_status = str((res or {}).get("status") or "failed") if isinstance(res, dict) else "failed"
                if _act_status in ("completed",):
                    self._status = "completed"
                elif _act_status in ("cancelled",):
                    self._status = "cancelled"
                elif _act_status in ("waiting_approval", "budget_exhausted", "timeout",
                                     "failed", "concurrency_limited", "topology_rejected",
                                     "trust_violation", "version_mismatch", "workspace_mismatch",
                                     "resumed_terminal"):
                    self._status = _act_status
                else:
                    self._status = "failed"
                    if isinstance(res, dict):
                        res = {**res, "status": "failed",
                               "error": str(res.get("error") or f"unknown activity status {_act_status!r}")[:500]}
                try:
                    await wf.execute_activity(
                        "record_workflow_metric",
                        {"workflow_type": "DurableAgentRunWorkflow", "task_queue": "vaeloom-agent-q", "status": self._status},
                        start_to_close_timeout=timedelta(seconds=5),
                        retry_policy=RetryPolicy(maximum_attempts=1),
                    )
                except Exception:
                    pass
                return res
            except Exception as e:
                # Terminal mapping distinguishes user cancellation (workflow
                # is cancelled → cancelled) from worker-turmoil exhaustion
                # (_drive_activity raises "drive exhausted", whose CAUSE chain
                # contains a cancellation — must still report failed, never a
                # false cancelled).
                try:
                    _wf_cancelled = bool(wf.is_cancelled())
                except Exception:
                    _wf_cancelled = False
                if _wf_cancelled or (_is_cancel(e)
                                     and "drive exhausted" not in str(e).lower()):
                    self._status = "cancelled"
                    return {"status": "cancelled", "error": str(e)[:500]}
                self._status = "failed"
                return {"status": "failed", "error": str(e)[:500]}

    @workflow.defn(name="ApprovalWorkflow")
    class ApprovalWorkflow:
        """Human-in-loop signal wait. Domain proposal row remains in Postgres;
        workflow only waits for the decision signal (§12)."""

        def __init__(self) -> None:
            self._decision: dict[str, Any] | None = None
            self._status: str = "waiting_approval"
            self._ignored_signals: int = 0
            self._expected_approval_id: str = ""
            self._expected_workspace_id: str | None = None
            self._early: list[dict[str, Any]] = []

        @workflow.signal
        def decision(self, payload: dict[str, Any]) -> None:  # noqa: N802
            # T-P1-03 signal binding: only a decision for THIS approval is
            # applied, and only the FIRST one wins. A forged/swapped/replayed
            # signal (wrong approval_id, wrong workspace, or a second
            # conflicting decision) is ignored and counted — the durable
            # single-consume gate stays in execute_approved_action + decide().
            try:
                data = payload if isinstance(payload, dict) else {}
                if not self._expected_approval_id:
                    # run() has not bound identity yet: buffer in arrival order;
                    # run() replays the buffer through the same validation.
                    self._early.append(data)
                    return
                self._apply_decision(data)
            except Exception:
                self._ignored_signals += 1

        def _apply_decision(self, data: dict[str, Any]) -> None:
            """Shared validation for live and early-buffered signals."""
            if str(data.get("approval_id") or "") != self._expected_approval_id:
                self._ignored_signals += 1
                return
            _ws = data.get("workspace_id")
            if _ws is not None and self._expected_workspace_id is not None and str(_ws) != self._expected_workspace_id:
                self._ignored_signals += 1
                return
            if self._decision is not None:
                # First decision wins; concurrent/duplicate signals ignored.
                self._ignored_signals += 1
                return
            self._decision = data
            self._status = str(data.get("decision", "decided"))

        @workflow.query
        def getProposal(self) -> dict[str, Any]:  # noqa: N802
            return {"status": self._status, "decision": self._decision,
                    "ignored_signals": self._ignored_signals}

        @workflow.run
        async def run(self, inp: ApprovalWorkflowInput) -> dict[str, Any]:
            import temporalio.workflow as wf

            try:
                wf.patched("approval-v1")  # type: ignore[attr-defined]
            except Exception:
                pass

            # Bind expected signal identity BEFORE waiting (deterministic:
            # derived from workflow input, identical on every replay).
            try:
                self._expected_approval_id = str(inp.approval_id or "")
                _w = getattr(inp, "workspace_id", None)
                self._expected_workspace_id = str(_w) if _w else None
                # Drain signals that arrived before binding, in arrival order.
                for _early_sig in list(self._early):
                    try:
                        self._apply_decision(_early_sig)
                    except Exception:
                        self._ignored_signals += 1
                self._early = []
            except Exception:
                pass

            def _is_cancel(e: Exception) -> bool:
                base = f"{type(e).__name__} {e} {getattr(e, 'cause', '')} {getattr(e, '__cause__', '')}".lower()
                return "cancel" in base

            _wait_s = 0.0
            try:
                _wait_start = wf.now()
                await wf.wait_condition(lambda: self._decision is not None, timeout=timedelta(seconds=inp.timeout_seconds))
                try:
                    _wait_s = max(0.0, (wf.now() - _wait_start).total_seconds())
                except Exception:
                    _wait_s = 0.0
            except Exception as we:
                if _is_cancel(we):
                    self._status = "cancelled"
                    try:
                        await wf.execute_activity(
                            "record_workflow_metric",
                            {"workflow_type": "ApprovalWorkflow", "task_queue": "vaeloom-approvals-q", "status": "cancelled"},
                            start_to_close_timeout=timedelta(seconds=5),
                            retry_policy=RetryPolicy(maximum_attempts=1),
                        )
                    except Exception:
                        pass
                    return {"status": "cancelled", "approval_id": inp.approval_id, "error": str(we)[:500]}
            if self._decision is None:
                # Check if cancelled during wait (Temporal cancels wait_condition)
                try:
                    if wf.is_cancelled():  # type: ignore[attr-defined]
                        self._status = "cancelled"
                        try:
                            await wf.execute_activity(
                                "record_workflow_metric",
                                {"workflow_type": "ApprovalWorkflow", "task_queue": "vaeloom-approvals-q", "status": "cancelled", "approval_wait_seconds": _wait_s},
                                start_to_close_timeout=timedelta(seconds=5),
                                retry_policy=RetryPolicy(maximum_attempts=1),
                            )
                        except Exception:
                            pass
                        return {"status": "cancelled", "approval_id": inp.approval_id}
                except Exception:
                    pass
                self._status = "expired"
                try:
                    await wf.execute_activity(
                        "record_workflow_metric",
                        {"workflow_type": "ApprovalWorkflow", "task_queue": "vaeloom-approvals-q", "status": "expired", "approval_wait_seconds": _wait_s},
                        start_to_close_timeout=timedelta(seconds=5),
                        retry_policy=RetryPolicy(maximum_attempts=1),
                    )
                except Exception:
                    pass
                return {"status": "expired", "approval_id": inp.approval_id}
            self._status = str(self._decision.get("decision", "decided"))
            try:
                res = await _drive_activity(
                    "execute_approved_action",
                    {"approval_id": inp.approval_id, "decision": self._decision,
                     # OP-RLS-01: the activity scopes its RLS session from this
                     # (workflow-bound at run() from ApprovalWorkflowInput).
                     "workspace_id": self._expected_workspace_id},
                    start_to_close=timedelta(seconds=30),
                    schedule_to_close=timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=2, backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )
                try:
                    await wf.execute_activity(
                        "record_workflow_metric",
                        {"workflow_type": "ApprovalWorkflow", "task_queue": "vaeloom-approvals-q", "status": self._status, "approval_wait_seconds": _wait_s},
                        start_to_close_timeout=timedelta(seconds=5),
                        retry_policy=RetryPolicy(maximum_attempts=1),
                    )
                except Exception:
                    pass
                return {"status": self._status, "approval_id": inp.approval_id, "result": res}
            except Exception as e:
                if _is_cancel(e):
                    self._status = "cancelled"
                    return {"status": "cancelled", "approval_id": inp.approval_id, "error": str(e)[:500]}
                return {"status": self._status, "approval_id": inp.approval_id, "error": str(e)[:500]}

    @workflow.defn(name="ConnectorSyncWorkflow")
    class ConnectorSyncWorkflow:
        """Durable connector sync — heartbeat-guarded long-running (§10).

        ID: connector_sync:{workspace}:{connector_id}:{sync_token}
        Handles large Drive/Notion enumerations that exceed HTTP timeout.
        Cancellation propagates to activity heartbeat (§11).
        """

        def __init__(self) -> None:
            self._status: str = "running"
            self._progress: int = 0

        @workflow.query
        def getStatus(self) -> dict[str, Any]:  # noqa: N802
            return {"status": self._status, "progress": self._progress}

        @workflow.signal
        def updateProgress(self, payload: dict[str, Any]) -> None:  # noqa: N802 — activity heartbeats via signal proxy when needed
            try:
                self._progress = int(payload.get("progress", self._progress))
            except Exception:
                pass

        @workflow.run
        async def run(self, inp: SyncConnectorInput) -> SyncConnectorResult:
            import temporalio.workflow as wf

            try:
                wf.patched("connector-sync-v1")  # type: ignore[attr-defined]
            except Exception:
                pass

            def _is_cancel(e: Exception) -> bool:
                base = f"{type(e).__name__} {e} {getattr(e, 'cause', '')} {getattr(e, '__cause__', '')}".lower()
                return "cancel" in base

            # Kill-switch (§13) — check connector agent
            try:
                ks = await wf.execute_activity(
                    "check_kill_switch",
                    {"agent": "connector"},
                    start_to_close_timeout=timedelta(seconds=5),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
                if ks and not ks.get("enabled", True):
                    self._status = "cancelled"
                    return SyncConnectorResult(status="cancelled", connector_id=inp.connector_id, error="killed by kill-switch")
            except Exception as ke:
                if _is_cancel(ke):
                    self._status = "cancelled"
                    return SyncConnectorResult(status="cancelled", connector_id=inp.connector_id, error=str(ke)[:500])

            try:
                self._status = "syncing"
                res = await wf.execute_activity(
                    "sync_connector",
                    inp,
                    start_to_close_timeout=timedelta(seconds=300),
                    heartbeat_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=2), maximum_interval=timedelta(seconds=30), backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )
                self._status = "completed"
                self._progress = 100
                return SyncConnectorResult(status="completed", connector_id=inp.connector_id, synced_at=str(res.get("synced_at", "")), error=None)
            except Exception as e:
                if _is_cancel(e):
                    self._status = "cancelled"
                    return SyncConnectorResult(status="cancelled", connector_id=inp.connector_id, error=str(e)[:500])
                self._status = "failed"
                return SyncConnectorResult(status="failed", connector_id=inp.connector_id, error=str(e)[:500])

    @dataclass
    class EventTriggerInput:
        event_type: str
        event_id: str
        workspace_id: str | None
        correlation_id: str
        causation_id: str | None = None
        payload: dict[str, Any] | None = None
        schema_version: int = 1

    @workflow.defn(name="EventTriggeredWorkflow")
    class EventTriggeredWorkflow:
        """Generic event → durable execution (§20).

        ID: event:{workspace}:{event_type}:{event_id}  deterministic dedup (§7).
        Prevents infinite loop: never emits an event that retriggers itself
        (causation/correlation tracked). Activities own domain handling.
        """

        def __init__(self) -> None:
            self._status: str = "running"
            self._handled: str | None = None

        @workflow.query
        def getStatus(self) -> dict[str, Any]:  # noqa: N802
            return {"status": self._status, "handled": self._handled}

        @workflow.run
        async def run(self, inp: EventTriggerInput) -> dict[str, Any]:
            import temporalio.workflow as wf

            try:
                wf.patched("event-trigger-v1")  # type: ignore[attr-defined]
            except Exception:
                pass

            def _is_cancel(e: Exception) -> bool:
                base = f"{type(e).__name__} {e} {getattr(e, 'cause', '')} {getattr(e, '__cause__', '')}".lower()
                return "cancel" in base

            try:
                self._status = "handling"
                res = await wf.execute_activity(
                    "handle_event",
                    inp,
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=RetryPolicy(maximum_attempts=3, backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )
                self._status = "completed"
                self._handled = str(res.get("handled", inp.event_type))
                return {"status": "completed", "event_id": inp.event_id, "event_type": inp.event_type, "handled": self._handled}
            except Exception as e:
                if _is_cancel(e):
                    self._status = "cancelled"
                    return {"status": "cancelled", "event_id": inp.event_id, "error": str(e)[:500]}
                self._status = "failed"
                return {"status": "failed", "event_id": inp.event_id, "error": str(e)[:500]}

