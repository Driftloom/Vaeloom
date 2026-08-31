import json
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.schema import Workspace, WorkspaceUser
from ..schemas.approval import (
    ApprovalDecision,
    ApprovalListResponse,
    ApprovalRequest,
    ApprovalResponse,
)
from ..services.audit_service import audit_service


async def _get_user_workspace_ids(user_id: str, db: AsyncSession) -> list[str]:
    """Look up all workspace IDs the user has access to (owned + member)."""
    try:
        uid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        return []

    owned = await db.execute(select(Workspace.id).where(Workspace.user_id == uid))
    member = await db.execute(
        select(WorkspaceUser.workspace_id).where(WorkspaceUser.user_id == uid)
    )
    ids = {str(row[0]) for row in owned.all()} | {str(row[0]) for row in member.all()}
    return sorted(ids)


def _payload_hmac(payload: dict, secret: str) -> str:
    """Deterministic HMAC over canonical JSON payload to detect drift (HNSW companion)."""
    import hashlib
    import hmac as _hmac

    canonical = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"), default=str)
    return _hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()[:32]


class ApprovalManager:
    async def request_approval(
        self,
        agent_name: str,
        action_type: str,
        payload: dict,
        reason: str | None,
        workspace_id: str | None,
        requested_by: str,
        expires_in_minutes: int | None,
        db: AsyncSession,
    ) -> ApprovalResponse:
        approval_id = uuid.uuid4()
        now = datetime.now(UTC)
        expires_at = now + timedelta(minutes=expires_in_minutes or 60)
        # HMAC drift guard: embed payload hash in reason metadata side-channel when ENCRYPTION_KEY available
        payload_sig = None
        try:
            import os

            secret = os.getenv("ENCRYPTION_KEY", "") or os.getenv("JWT_SECRET", "")
            if secret and payload:
                payload_sig = _payload_hmac(payload, secret)
        except Exception:
            payload_sig = None
        # Store sig as prefix in reason if needed, otherwise ignore (backward compat)
        stored_reason = f"[hmac:{payload_sig}] {reason}" if payload_sig and reason else (f"[hmac:{payload_sig}]" if payload_sig else reason)
        await db.execute(
            text("""
                INSERT INTO agent_approvals
                    (id, workspace_id, agent_name, action_type, payload, reason, status,
                     requested_by, expires_at, created_at, updated_at)
                VALUES
                    (:id, :workspace_id, :agent_name, :action_type, :payload, :reason, 'PENDING',
                     :requested_by, :expires_at, :created_at, :created_at)
            """),
            {
                "id": str(approval_id),
                "workspace_id": workspace_id,
                "agent_name": agent_name,
                "action_type": action_type,
                "payload": payload if payload is not None else {},
                "reason": stored_reason,
                "requested_by": requested_by,
                "expires_at": expires_at,
                "created_at": now,
            },
        )
        return await self.get_approval(str(approval_id), db)

    async def _row_to_response(self, row) -> ApprovalResponse:
        def _dt(value):
            if value is None or isinstance(value, datetime):
                return value
            try:
                return datetime.fromisoformat(str(value))
            except (ValueError, TypeError):
                return None

        def _payload(value):
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except (ValueError, TypeError):
                    return {}
            return value or {}

        return ApprovalResponse(
            id=row[0],
            workspace_id=row[1],
            agent_name=row[2],
            action_type=row[3],
            payload=_payload(row[4]),
            reason=row[5],
            status=row[6],
            requested_by=row[7],
            decided_by=row[8],
            decision_note=row[9],
            expires_at=_dt(row[10]),
            created_at=_dt(row[11]),
            updated_at=_dt(row[12]),
            decided_at=_dt(row[13]),
        )

    async def get_approval(self, approval_id: str, db: AsyncSession, user_workspaces: list[str] | None = None) -> ApprovalResponse:
        await self._expire_stale(db)
        result = await db.execute(
            text("""
                SELECT id, workspace_id, agent_name, action_type, payload, reason, status,
                       requested_by, decided_by, decision_note, expires_at, created_at, updated_at, decided_at
                FROM agent_approvals WHERE id = :id
            """),
            {"id": approval_id},
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Approval not found")
        # Workspace isolation: verify user belongs to the approval's workspace.
        # NULL workspace_id approvals are visible to all users (unscoped).
        if user_workspaces is not None and row[1] is not None and str(row[1]) not in user_workspaces:
            raise HTTPException(status_code=404, detail="Approval not found")
        return await self._row_to_response(row)

    async def list_approvals(
        self,
        db: AsyncSession,
        status: str | None = None,
        workspace_id: str | None = None,
        user_workspaces: list[str] | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> ApprovalListResponse:
        await self._expire_stale(db)
        conditions = ["1=1"]
        params: dict = {}
        if status:
            if status not in ("PENDING", "APPROVED", "REJECTED", "EXPIRED"):
                raise ValueError(f"Invalid status filter: {status}")
            conditions.append("status = :status")
            params["status"] = status
        if workspace_id:
            conditions.append("workspace_id = :workspace_id")
            params["workspace_id"] = workspace_id
        elif user_workspaces is not None:
            if not user_workspaces:
                return ApprovalListResponse(items=[], total=0, page=page, page_size=page_size)
            ws_params = {f"ws_{i}": ws for i, ws in enumerate(user_workspaces)}
            ws_placeholders = ", ".join(f":ws_{i}" for i in range(len(user_workspaces)))
            conditions.append(f"(workspace_id IN ({ws_placeholders}) OR workspace_id IS NULL)")
            params.update(ws_params)
        where = " AND ".join(conditions)

        total_result = await db.execute(
            text(f"SELECT COUNT(*) FROM agent_approvals WHERE {where}"),
            params,
        )
        total = total_result.scalar_one()

        result = await db.execute(
            text(f"""
                SELECT id, workspace_id, agent_name, action_type, payload, reason, status,
                       requested_by, decided_by, decision_note, expires_at, created_at, updated_at, decided_at
                FROM agent_approvals WHERE {where}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": page_size, "offset": (page - 1) * page_size},
        )
        rows = result.fetchall()
        return ApprovalListResponse(
            items=[await self._row_to_response(r) for r in rows],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def decide(
        self,
        approval_id: str,
        decision: str,
        decided_by: str,
        note: str | None,
        db: AsyncSession,
        user_workspaces: list[str] | None = None,
    ) -> ApprovalResponse:
        current = await self.get_approval(approval_id, db, user_workspaces=user_workspaces)
        if current.status != "PENDING":
            raise HTTPException(status_code=409, detail=f"Approval already {current.status.lower()}")
        # HMAC drift verification: warn if payload was tampered between request and decide
        try:
            import os
            import re

            secret = os.getenv("ENCRYPTION_KEY", "") or os.getenv("JWT_SECRET", "")
            if secret and current.payload:
                m = re.search(r"\[hmac:([0-9a-f]{32})\]", current.reason or "")
                if m:
                    expected = _payload_hmac(current.payload, secret)
                    if m.group(1) != expected:
                        import logging

                        logging.getLogger(__name__).warning(f"Approval {approval_id} payload HMAC mismatch — possible drift/tamper")
        except Exception:
            pass
        now = datetime.now(UTC)
        await db.execute(
            text("""
                UPDATE agent_approvals
                SET status = :decision, decided_by = :decided_by, decision_note = :note,
                    decided_at = :decided_at, updated_at = :updated_at
                WHERE id = :id
            """),
            {
                "id": approval_id,
                "decision": decision,
                "decided_by": decided_by,
                "note": note,
                "decided_at": now,
                "updated_at": now,
            },
        )
        return await self.get_approval(approval_id, db, user_workspaces=user_workspaces)

    async def _expire_stale(self, db: AsyncSession) -> None:
        now = datetime.now(UTC)
        await db.execute(
            text("""
                UPDATE agent_approvals
                SET status = 'EXPIRED', updated_at = :now
                WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < :now
            """),
            {"now": now},
        )


async def _ingest_feedback_preference(
    workspace_id: str | None,
    agent_name: str,
    action_type: str,
    decision: str,
    note: str | None,
    requested_by: str | None,
    db: AsyncSession,
    decided_by: str | None = None,
) -> None:
    """Persist human feedback as a preference entity + vector so future runs avoid repeating rejected patterns (P2)."""
    if not workspace_id:
        return
    try:
        import uuid
        from api.models.schema import Entity

        polarity = "approved" if decision == "APPROVED" else "rejected"
        base_name = note.strip()[:120] if note and note.strip() else f"User {polarity} {agent_name}:{action_type}"
        canonical_name = base_name if base_name else f"Preference {polarity} {action_type}"
        metadata = {
            "agent_name": agent_name,
            "action_type": action_type,
            "decision": decision,
            "note": note,
            "requested_by": requested_by,
            "decided_by": decided_by,
            "polarity": polarity,
            "source": "approval_feedback",
        }
        # Dedup by (workspace, name, action_type, decision) to avoid collisions — e.g., same note "Objective" for resume vs different agent
        try:
            existing = await db.execute(
                text("SELECT id FROM entities WHERE workspace_id = :wid AND type = 'preference' AND canonical_name = :name AND metadata ->> 'action_type' = :action AND metadata ->> 'decision' = :decision LIMIT 1"),
                {"wid": workspace_id, "name": canonical_name, "action": action_type, "decision": decision},
            )
            if existing.fetchone():
                return
        except Exception:
            # SQLite fallback: metadata is TEXT, JSONB query fails — fallback to name-only
            existing2 = await db.execute(
                text("SELECT id FROM entities WHERE workspace_id = :wid AND type = 'preference' AND canonical_name = :name LIMIT 1"),
                {"wid": workspace_id, "name": canonical_name},
            )
            if existing2.fetchone():
                return
        entity = Entity(
            id=uuid.uuid4(),
            workspace_id=uuid.UUID(workspace_id) if isinstance(workspace_id, str) else workspace_id,
            type="preference",
            canonical_name=canonical_name,
            aliases=[],
            metadata_=metadata,
        )
        db.add(entity)
        try:
            from api.config import settings
            if settings.llm_api_key:
                from api.services.llm_service import llm_service
                pref_user_id = decided_by or requested_by
                if pref_user_id:
                    tenant_id = workspace_id
                    try:
                        ws_row = await db.execute(text("SELECT tenant_id FROM workspaces WHERE id = :wid"), {"wid": workspace_id})
                        r = ws_row.fetchone()
                        if r and r[0]:
                            tenant_id = str(r[0])
                    except Exception:
                        pass
                    text_for_vec = f"{canonical_name} {note or ''} {agent_name} {action_type}".strip()[:2000]
                    vec = await llm_service.generate_embedding(text_for_vec)
                    vec_str = "[" + ",".join(f"{v:.6f}" for v in vec) + "]"
                    try:
                        await db.execute(
                            text("""
                                INSERT INTO user_preference_vectors (user_id, tenant_id, preference_vector, updated_at)
                                VALUES (:uid, :tid, :vec::vector, now())
                                ON CONFLICT (user_id, tenant_id) DO UPDATE
                                SET preference_vector = :vec::vector, updated_at = now()
                            """),
                            {"uid": pref_user_id, "tid": tenant_id, "vec": vec_str},
                        )
                    except Exception:
                        try:
                            await db.execute(
                                text("""
                                    INSERT INTO user_preference_vectors (user_id, tenant_id, preference_vector, updated_at)
                                    VALUES (:uid, :tid, :vec, :now)
                                    ON CONFLICT(user_id, tenant_id) DO UPDATE SET preference_vector=:vec, updated_at=:now
                                """),
                                {"uid": pref_user_id, "tid": tenant_id, "vec": vec_str, "now": datetime.now(UTC)},
                            )
                        except Exception:
                            pass
        except Exception as ve:
            import logging
            logging.getLogger(__name__).debug(f"Preference vector upsert skipped (non-blocking): {ve}")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Preference ingestion failed (non-blocking): {e}")


approval_manager = ApprovalManager()


async def _maybe_start_approval_workflow(approval_id: str, workspace_id: str | None, timeout_seconds: int = 3600) -> None:
    """Best-effort: start the durable ApprovalWorkflow when Temporal is enabled.

    Must never block approval creation. Fail-open: log and continue if Temporal
    unavailable — the DB row remains the source of truth (§12).
    """
    try:
        from ..config import settings as _settings
        if not getattr(_settings, "temporal_enabled", False):
            return
        from ..temporal.client import get_temporal_client
        from ..temporal.queues import queue_name

        client = await get_temporal_client()
        if client is None:
            return
        wid = f"approval:{workspace_id or 'global'}:{approval_id}"
        from ..temporal.workflows import ApprovalWorkflowInput

        from temporalio.common import WorkflowIDReusePolicy as _WIDP2  # type: ignore

        from datetime import timedelta as _td2
        await client.start_workflow(
            "ApprovalWorkflow",
            ApprovalWorkflowInput(approval_id=approval_id, timeout_seconds=timeout_seconds),
            id=wid,
            task_queue=queue_name("approvals"),
            id_reuse_policy=_WIDP2.REJECT_DUPLICATE,
            execution_timeout=_td2(hours=2),
        )
        try:
            from ..temporal.metrics import _inc_workflow_started

            _inc_workflow_started("ApprovalWorkflow", queue_name("approvals"))
        except Exception:
            pass
    except Exception as e:
        import logging
        logging.getLogger(__name__).debug(f"ApprovalWorkflow start skipped for {approval_id}: {e}")


async def _maybe_signal_approval_workflow(approval_id: str, workspace_id: str | None, decision: str, actor: str, note: str | None) -> None:
    """Best-effort: signal the waiting ApprovalWorkflow with the human decision."""
    try:
        from ..config import settings as _settings
        if not getattr(_settings, "temporal_enabled", False):
            return
        from ..temporal.client import get_temporal_client

        client = await get_temporal_client()
        if client is None:
            return
        wid = f"approval:{workspace_id or 'global'}:{approval_id}"
        handle = client.get_workflow_handle(wid)
        await handle.signal("decision", {"decision": decision, "actor": actor, "note": note or "", "approval_id": approval_id})
    except Exception as e:
        import logging
        logging.getLogger(__name__).debug(f"ApprovalWorkflow signal skipped for {approval_id}: {e}")


router = APIRouter()


@router.post("/approvals", response_model=ApprovalResponse, status_code=201)
async def request_approval(
    dto: ApprovalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    actor = str(current_user.get("sub"))
    approval = await approval_manager.request_approval(
        agent_name=dto.agent_name,
        action_type=dto.action_type,
        payload=dto.payload,
        reason=dto.reason,
        workspace_id=str(dto.workspace_id) if dto.workspace_id else None,
        requested_by=actor,
        expires_in_minutes=dto.expires_in_minutes,
        db=db,
    )
    await audit_service.record_event(
        actor_id=actor,
        action="approval.request",
        resource="approval",
        resource_id=str(approval.id),
        tenant_id=current_user.get("tenant_id"),
        metadata={"agent_name": dto.agent_name, "action_type": dto.action_type},
        db=db,
    )
    await db.commit()
    # Fire-and-forget Temporal wait workflow (non-blocking, fail-open)
    try:
        import asyncio as _aio
        _aio.create_task(_maybe_start_approval_workflow(str(approval.id), str(approval.workspace_id) if approval.workspace_id else None))
    except Exception:
        pass
    return approval


@router.get("/approvals", response_model=ApprovalListResponse)
async def list_approvals(
    status: str | None = Query(default=None, pattern="^(PENDING|APPROVED|REJECTED|EXPIRED)$"),
    workspace_id: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_ws = await _get_user_workspace_ids(current_user.get("sub", ""), db)
    return await approval_manager.list_approvals(
        db=db,
        status=status,
        workspace_id=workspace_id,
        user_workspaces=user_ws or None,
        page=page,
        page_size=page_size,
    )


@router.get("/approvals/{approval_id}", response_model=ApprovalResponse)
async def get_approval(
    approval_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_ws = await _get_user_workspace_ids(current_user.get("sub", ""), db)
    return await approval_manager.get_approval(approval_id, db, user_workspaces=user_ws or None)


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalResponse)
async def approve_approval(
    approval_id: str,
    dto: ApprovalDecision | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    actor = str(current_user.get("sub"))
    user_ws = await _get_user_workspace_ids(actor, db)
    approval = await approval_manager.decide(approval_id, "APPROVED", actor, dto.note if dto else None, db, user_workspaces=user_ws or None)
    await audit_service.record_event(
        actor_id=actor,
        action="approval.approve",
        resource="approval",
        resource_id=str(approval.id),
        tenant_id=current_user.get("tenant_id"),
        metadata={"agent_name": approval.agent_name, "action_type": approval.action_type},
        db=db,
    )
    try:
        await _ingest_feedback_preference(
            workspace_id=str(approval.workspace_id) if approval.workspace_id else None,
            agent_name=approval.agent_name,
            action_type=approval.action_type,
            decision="APPROVED",
            note=dto.note if dto else None,
            requested_by=str(approval.requested_by) if approval.requested_by else None,
            db=db,
            decided_by=actor,
        )
    except Exception:
        pass
    await db.commit()
    try:
        import asyncio as _aio2
        _aio2.create_task(_maybe_signal_approval_workflow(str(approval.id), str(approval.workspace_id) if approval.workspace_id else None, "APPROVED", actor, dto.note if dto else None))
    except Exception:
        pass
    return approval


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalResponse)
async def reject_approval(
    approval_id: str,
    dto: ApprovalDecision | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    actor = str(current_user.get("sub"))
    user_ws = await _get_user_workspace_ids(actor, db)
    approval = await approval_manager.decide(approval_id, "REJECTED", actor, dto.note if dto else None, db, user_workspaces=user_ws or None)
    await audit_service.record_event(
        actor_id=actor,
        action="approval.reject",
        resource="approval",
        resource_id=str(approval.id),
        tenant_id=current_user.get("tenant_id"),
        metadata={"agent_name": approval.agent_name, "action_type": approval.action_type},
        db=db,
    )
    try:
        await _ingest_feedback_preference(
            workspace_id=str(approval.workspace_id) if approval.workspace_id else None,
            agent_name=approval.agent_name,
            action_type=approval.action_type,
            decision="REJECTED",
            note=dto.note if dto else None,
            requested_by=str(approval.requested_by) if approval.requested_by else None,
            db=db,
            decided_by=actor,
        )
    except Exception:
        pass
    await db.commit()
    try:
        import asyncio as _aio3
        _aio3.create_task(_maybe_signal_approval_workflow(str(approval.id), str(approval.workspace_id) if approval.workspace_id else None, "REJECTED", actor, dto.note if dto else None))
    except Exception:
        pass
    return approval
