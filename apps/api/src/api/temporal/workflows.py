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


@dataclass
class ApprovalWorkflowInput:
    approval_id: str
    timeout_seconds: int = 3600


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
                        {"workflow_type": "IngestDocumentWorkflow", "task_queue": "vaeloom-ingest-q", "status": "completed"},
                        start_to_close_timeout=timedelta(seconds=5),
                        retry_policy=RetryPolicy(maximum_attempts=1),
                    )
                except Exception:
                    pass
                return IngestResult(status="completed", document_id=inp.document_id, memories_created=int(written.get("memories_created", 0) or 0))
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
                        correlation_id=payload.get("correlation_id"),
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

            # Kill-switch check (§13) before expensive LLM call
            try:
                ag = payload.agent_id if hasattr(payload, "agent_id") else str(payload.get("agent_id", "memory")) if isinstance(payload, dict) else "memory"  # type: ignore[union-attr]
                ks = await wf.execute_activity(
                    "check_kill_switch",
                    {"agent": ag},
                    start_to_close_timeout=timedelta(seconds=5),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
                if ks and not ks.get("enabled", True):
                    self._status = "cancelled"
                    return {"status": "cancelled", "error": f"killed kill-switch agent={ag}"}
            except Exception as ke:
                if _is_cancel(ke):
                    self._status = "cancelled"
                    return {"status": "cancelled", "error": str(ke)[:500]}

            # Quota check (T-007) — durable Redis, fail-open if unavailable, fail-closed on exceeded
            try:
                await wf.execute_activity(
                    "check_quota",
                    {"workspace_id": payload.workspace_id, "metric": "requests", "increment": 1},
                    start_to_close_timeout=timedelta(seconds=5),
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
                res = await wf.execute_activity(
                    "durable_agent_run",
                    payload,
                    start_to_close_timeout=timedelta(seconds=120),
                    heartbeat_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=2, backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )
                self._status = "completed"
                return res
            except Exception as e:
                if _is_cancel(e):
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

        @workflow.signal
        def decision(self, payload: dict[str, Any]) -> None:  # noqa: N802
            # Validated at API gateway; minimal guard here.
            self._decision = payload
            self._status = str(payload.get("decision", "decided"))

        @workflow.query
        def getProposal(self) -> dict[str, Any]:  # noqa: N802
            return {"status": self._status, "decision": self._decision}

        @workflow.run
        async def run(self, inp: ApprovalWorkflowInput) -> dict[str, Any]:
            import temporalio.workflow as wf

            try:
                wf.patched("approval-v1")  # type: ignore[attr-defined]
            except Exception:
                pass

            def _is_cancel(e: Exception) -> bool:
                base = f"{type(e).__name__} {e} {getattr(e, 'cause', '')} {getattr(e, '__cause__', '')}".lower()
                return "cancel" in base

            try:
                await wf.wait_condition(lambda: self._decision is not None, timeout=timedelta(seconds=inp.timeout_seconds))
            except Exception as we:
                if _is_cancel(we):
                    self._status = "cancelled"
                    return {"status": "cancelled", "approval_id": inp.approval_id, "error": str(we)[:500]}
            if self._decision is None:
                # Check if cancelled during wait (Temporal cancels wait_condition)
                try:
                    if wf.is_cancelled():  # type: ignore[attr-defined]
                        self._status = "cancelled"
                        return {"status": "cancelled", "approval_id": inp.approval_id}
                except Exception:
                    pass
                self._status = "expired"
                return {"status": "expired", "approval_id": inp.approval_id}
            self._status = str(self._decision.get("decision", "decided"))
            try:
                res = await wf.execute_activity(
                    "execute_approved_action",
                    {"approval_id": inp.approval_id, "decision": self._decision},
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=2, backoff_coefficient=2.0, non_retryable_error_types=["ValueError", "ApplicationError"]),
                )
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

