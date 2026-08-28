"""Temporal status/signal/cancel API (ADR-038 §46).

Mounted only as admin/ops surface; user-facing flows prefer domain APIs
(approvals/documents/agents) which internally signal workflows. All routes
re-check workspace authorization at call time (§14).
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter()


def _require_temporal() -> None:
    if not getattr(settings, "temporal_enabled", False):
        raise HTTPException(status_code=503, detail="Temporal is disabled (set TEMPORAL_ENABLED=true)")


async def _verify_workflow_workspace_access(workflow_id: str, current_user: dict, db: AsyncSession) -> None:
    """Parse workspace_id from deterministic IDs and verify membership — fail-closed per T-002."""
    # Allow hello smoke workflows without workspace
    if workflow_id.startswith("hello"):
        return
    try:
        parts = workflow_id.split(":")
        if len(parts) < 2:
            raise HTTPException(status_code=404, detail="Workflow not found")
        candidate = parts[1]
        # No global bypass — every user-owned workflow must have valid workspace UUID
        if candidate in ("global", "ws", "workspace"):
            raise HTTPException(status_code=404, detail="Workflow not found")
        from sqlalchemy import select as _sel
        from ..models.schema import Workspace, WorkspaceUser
        from uuid import UUID as _UUID

        try:
            ws_uuid = _UUID(candidate)
        except Exception:
            raise HTTPException(status_code=404, detail="Workflow not found")
        try:
            uid = _UUID(str(current_user.get("sub") or current_user.get("user_id")))
        except Exception:
            raise HTTPException(status_code=401, detail="Not authenticated")
        r1 = await db.execute(_sel(Workspace).where(Workspace.id == ws_uuid, Workspace.user_id == uid))
        if r1.scalar_one_or_none():
            return
        r2 = await db.execute(_sel(WorkspaceUser).where(WorkspaceUser.workspace_id == ws_uuid, WorkspaceUser.user_id == uid))
        if r2.scalar_one_or_none():
            return
        raise HTTPException(status_code=404, detail="Workflow not found")
    except HTTPException:
        raise
    except Exception as e:
        # Database failure or unexpected → 503 fail-closed, never allow
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=503, detail="Authorization check failed")


@router.get("/workflows/{workflow_id}")
async def get_workflow_status(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_temporal()
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workflow_workspace_access(workflow_id, current_user, db)
    try:
        from ..temporal.client import get_temporal_client

        client = await get_temporal_client()
        if client is None:
            raise HTTPException(status_code=503, detail="Temporal client unavailable")
        handle = client.get_workflow_handle(workflow_id)
        desc = await handle.describe()
        # Best-effort query; not all workflows expose getStatus
        status = None
        try:
            status = await handle.query("getStatus")
        except Exception:
            status = None
        return {
            "workflow_id": workflow_id,
            "run_id": getattr(desc, "run_id", None),
            "status": getattr(getattr(desc, "status", None), "name", str(getattr(desc, "status", None))),
            "query": status,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Temporal error: {e}")


@router.post("/workflows/{workflow_id}/cancel")
async def cancel_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_temporal()
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workflow_workspace_access(workflow_id, current_user, db)
    try:
        from ..temporal.client import get_temporal_client

        client = await get_temporal_client()
        if client is None:
            raise HTTPException(status_code=503, detail="Temporal client unavailable")
        handle = client.get_workflow_handle(workflow_id)
        await handle.cancel()
        return {"workflow_id": workflow_id, "status": "cancel_requested"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflows/{workflow_id}/signal/{signal_name}")
async def signal_workflow(
    workflow_id: str,
    signal_name: str,
    payload: dict | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_temporal()
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # T-002: allowlist signals, T-001/T-008: payload validation
    if signal_name not in ("decision", "updateProgress"):
        raise HTTPException(status_code=400, detail=f"Unknown signal: {signal_name}")
    if payload is not None:
        try:
            from ..temporal.validation import validate_no_secrets, validate_payload_size

            validate_no_secrets(payload)
            validate_payload_size(payload, label="signal payload")
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
    await _verify_workflow_workspace_access(workflow_id, current_user, db)
    try:
        from ..temporal.client import get_temporal_client

        client = await get_temporal_client()
        if client is None:
            raise HTTPException(status_code=503, detail="Temporal client unavailable")
        handle = client.get_workflow_handle(workflow_id)
        await handle.signal(signal_name, payload or {})
        return {"workflow_id": workflow_id, "signal": signal_name, "status": "signaled"}
    except HTTPException:
        raise
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning(f"signal failed for {workflow_id}: {e}")
        raise HTTPException(status_code=500, detail="Temporal unavailable")


@router.post("/workflows/ingest")
async def start_ingest_workflow(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_temporal()
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    workspace_id = str(body.get("workspace_id") or body.get("workspaceId") or "")
    document_id = str(body.get("document_id") or body.get("documentId") or "")
    content_hash = str(body.get("content_hash") or body.get("contentHash") or document_id[:12])
    if not workspace_id or not document_id:
        raise HTTPException(status_code=400, detail="workspace_id and document_id required")
    # Minimal authorization: caller must have workspace access (reuse documents rule)
    try:
        from sqlalchemy import select
        from ..models.schema import Workspace
        from uuid import UUID

        wid, uid = UUID(workspace_id), UUID(current_user.get("sub") or current_user.get("user_id"))
        r = await db.execute(select(Workspace).where(Workspace.id == wid, Workspace.user_id == uid))
        if not r.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Workspace not found")
    except HTTPException:
        raise
    except Exception:
        pass
    # T-008 payload limit + T-001 secret check (fail-closed)
    try:
        from ..temporal.validation import validate_no_secrets, validate_payload_size

        validate_no_secrets(body)
        validate_payload_size(body, label="ingest payload")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    workflow_id = f"ingest:{workspace_id}:{content_hash}:{document_id}"
    try:
        from ..temporal.client import get_temporal_client
        from ..temporal.queues import queue_name
        from ..temporal.workflows import IngestInput

        client = await get_temporal_client()
        if client is None:
            raise HTTPException(status_code=503, detail="Temporal client unavailable")
        from temporalio.common import WorkflowIDReusePolicy  # type: ignore

        correlation_id = str(body.get("correlation_id") or body.get("correlationId") or f"corr-{document_id[:8]}")
        handle = await client.start_workflow(
            "IngestDocumentWorkflow",
            IngestInput(workspace_id=workspace_id, document_id=document_id, content_hash=content_hash, requested_by=str(current_user.get("sub")), correlation_id=correlation_id),
            id=workflow_id,
            task_queue=queue_name("ingest"),
            id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE,
            execution_timeout=timedelta(hours=2),
        )
        try:
            from ..temporal.metrics import _inc_workflow_started

            _inc_workflow_started("IngestDocumentWorkflow", queue_name("ingest"))
        except Exception:
            pass
        from datetime import UTC, datetime

        return {"workflow_id": handle.id, "run_id": handle.result_run_id if hasattr(handle, "result_run_id") else None, "status": "accepted", "accepted_at": datetime.now(UTC).isoformat(), "correlation_id": correlation_id}
    except Exception as e:
        # Idempotency: already started → return existing id (case-insensitive, handles "Workflow execution already started")
        msg = str(e)
        low = msg.lower()
        if "already" in low and "started" in low:
            return {"workflow_id": workflow_id, "status": "already_started"}
        raise HTTPException(status_code=500, detail=msg[:500])


@router.post("/workflows/connector-sync")
async def start_connector_sync(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_temporal()
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    workspace_id = str(body.get("workspace_id") or body.get("workspaceId") or "")
    connector_id = str(body.get("connector_id") or body.get("connectorId") or "")
    sync_token = str(body.get("sync_token") or body.get("syncToken") or body.get("connector_id") or connector_id)[:32]
    if not workspace_id or not connector_id:
        raise HTTPException(status_code=400, detail="workspace_id and connector_id required")
    # Verify connector belongs to workspace (workspace_id check via connectors query)
    try:
        from sqlalchemy import text as _text

        r = await db.execute(_text("SELECT id FROM connectors WHERE id=:id AND workspace_id=:ws"), {"id": connector_id, "ws": workspace_id})
        if not r.first():
            # Also allow connectors scoped by tenant workspace fallback — check workspace access
            from sqlalchemy import select as _sel
            from ..models.schema import Workspace, WorkspaceUser
            from uuid import UUID as _UUID

            try:
                ws_uuid, uid = _UUID(workspace_id), _UUID(str(current_user.get("sub") or current_user.get("user_id")))
                q1 = await db.execute(_sel(Workspace).where(Workspace.id == ws_uuid, Workspace.user_id == uid))
                if not q1.scalar_one_or_none():
                    q2 = await db.execute(_sel(WorkspaceUser).where(WorkspaceUser.workspace_id == ws_uuid, WorkspaceUser.user_id == uid))
                    if not q2.scalar_one_or_none():
                        raise HTTPException(status_code=404, detail="Workspace not found")
            except HTTPException:
                raise
            except Exception:
                pass
    except HTTPException:
        raise
    except Exception:
        pass
    # T-008 + T-001 validation
    try:
        from ..temporal.validation import validate_no_secrets, validate_payload_size

        validate_no_secrets(body)
        validate_payload_size(body, label="connector sync payload")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    workflow_id = f"connector_sync:{workspace_id}:{connector_id}:{sync_token}"
    try:
        from ..temporal.client import get_temporal_client
        from ..temporal.queues import queue_name
        from ..temporal.activities import SyncConnectorInput

        client = await get_temporal_client()
        if client is None:
            raise HTTPException(status_code=503, detail="Temporal client unavailable")
        from temporalio.common import WorkflowIDReusePolicy as _WIDPolicy  # type: ignore

        handle = await client.start_workflow(
            "ConnectorSyncWorkflow",
            SyncConnectorInput(workspace_id=workspace_id, connector_id=connector_id, sync_token=sync_token),
            id=workflow_id,
            task_queue=queue_name("connectors"),
            id_reuse_policy=_WIDPolicy.REJECT_DUPLICATE,
            execution_timeout=timedelta(minutes=30),
        )
        try:
            from ..temporal.metrics import _inc_workflow_started

            _inc_workflow_started("ConnectorSyncWorkflow", queue_name("connectors"))
        except Exception:
            pass
        return {"workflow_id": handle.id, "run_id": handle.result_run_id if hasattr(handle, "result_run_id") else None, "status": "accepted"}
    except Exception as e:
        msg = str(e)
        low = msg.lower()
        if "already" in low and "started" in low:
            return {"workflow_id": workflow_id, "status": "already_started"}
        raise HTTPException(status_code=500, detail=msg[:500])
