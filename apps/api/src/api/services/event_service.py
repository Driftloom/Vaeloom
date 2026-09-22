import contextlib
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Event, EventSubscription

try:  # Temporal is an optional dependency (disabled by default)
    from ..temporal.client import get_temporal_client
    from ..temporal.queues import queue_name
    from ..temporal.workflows import EventTriggerInput
except Exception:  # pragma: no cover - import-time fallback
    get_temporal_client = None  # type: ignore[assignment]
    queue_name = None  # type: ignore[assignment]
    EventTriggerInput = None  # type: ignore[assignment]

#: Event types that fan out to durable execution (prevents infinite loops).
DURABLE_EVENT_TYPES = {"document.created", "document.updated", "connector.updated", "application.status_changed", "deadline.created"}


async def dispatch_event_workflow(
    event_id: str,
    event_type: str,
    workspace_id: str | None,
    payload: dict,
    correlation_id: str | None = None,
) -> None:
    """Durable fan-out for one event (Trigger.dev preferred, Temporal fallback).

    Extracted from ``EventService.publish`` so the outbox relay can deliver the
    SAME dispatch durably (Loop 2 vertical slice): the request path calls this
    fire-and-forget; the relay calls it per claimed outbox row. Delivery is
    at-least-once — downstream dedups on ``event:{event_id}``.
    """
    try:
        from ..config import settings as _settings
        from ..trigger.client import (
            TASK_INGEST_DOCUMENT,
            TASK_SYNC_CONNECTOR,
            get_trigger_client,
            is_trigger_enabled,
        )

        if event_type not in DURABLE_EVENT_TYPES:
            return

        if is_trigger_enabled():
            tclient = get_trigger_client()
            task_mapping = {
                "document.created": TASK_INGEST_DOCUMENT,
                "document.updated": TASK_INGEST_DOCUMENT,
                "connector.updated": TASK_SYNC_CONNECTOR,
            }
            target_task = task_mapping.get(event_type, f"vaeloom.event.{event_type}")
            await tclient.trigger(
                task_name=target_task,
                payload={
                    "event_id": event_id,
                    "event_type": event_type,
                    "workspace_id": workspace_id,
                    "payload": payload if isinstance(payload, dict) else {},
                },
                options={"idempotencyKey": f"event:{event_id}"},
            )
            return

        if not getattr(_settings, "temporal_enabled", False):
            return
        if get_temporal_client is None or EventTriggerInput is None or queue_name is None:
            return  # Temporal SDK unavailable; degraded to no durable fan-out
        client = await get_temporal_client()
        if client is None:
            import logging
            logging.getLogger(__name__).warning(
                "Temporal cluster unreachable or disabled; degraded to synchronous local fallback for event %s",
                event_id,
                extra={"event_id": event_id, "event_type": event_type, "fallback": True},
            )
            from ..temporal.metrics import inc_temporal_fallback
            inc_temporal_fallback("EventTriggeredWorkflow", reason="temporal_client_disabled")
            return
        from temporalio.common import WorkflowIDReusePolicy as _WIDP  # type: ignore

        wid = f"event:{workspace_id if workspace_id else 'global'}:{event_type}:{event_id}"
        await client.start_workflow(
            "EventTriggeredWorkflow",
            EventTriggerInput(
                event_type=event_type,
                event_id=event_id,
                workspace_id=workspace_id,
                correlation_id=correlation_id or event_id,
                causation_id=event_id,
                payload=payload if isinstance(payload, dict) else {},
                schema_version=1,
            ),
            id=wid,
            task_queue=queue_name("events"),
            id_reuse_policy=_WIDP.REJECT_DUPLICATE,
            execution_timeout=timedelta(minutes=10),
        )
    except Exception as e:
        # Handle idempotency: AlreadyStarted means duplicate event (dedup OK)
        msg = str(e)
        if "AlreadyStarted" not in msg and "WorkflowExecutionAlreadyStarted" not in msg:
            import logging

            logging.getLogger(__name__).warning(
                "Temporal workflow dispatch error for event %s (%s); degraded to local fallback",
                event_id,
                e,
                extra={"event_id": event_id, "error": str(e), "fallback": True},
            )
            from ..temporal.metrics import inc_temporal_fallback
            inc_temporal_fallback("EventTriggeredWorkflow", reason="dispatch_exception")


async def publish_event_from_outbox(outbox_event) -> None:
    """Outbox relay publisher for ``event.*`` rows (Loop 2 real publisher).

    Raises on dispatch failure so the relay retries/exhausts per its policy.
    Unknown event types are a no-op success (nothing durable to do).
    """
    data = getattr(outbox_event, "payload", None) or {}
    if not isinstance(data, dict):
        return
    await dispatch_event_workflow(
        str(data.get("event_id") or getattr(outbox_event, "id", "")),
        str(data.get("event_type", "")),
        data.get("workspace_id"),
        data.get("payload", {}),
    )


class EventService:
    async def publish(self, dto, user_id: str, db: AsyncSession = None):
        # Extract workspace_id from DTO or payload (back-compat)
        ws_id = getattr(dto, "workspace_id", None) or dto.payload.get("workspaceId") or dto.payload.get("workspace_id")
        try:
            ws_uuid = uuid.UUID(ws_id) if ws_id else None
        except (ValueError, TypeError):
            ws_uuid = None
        # T-002: verify workspace ownership — fail closed
        if ws_uuid and user_id and db is not None:
            try:
                from fastapi import HTTPException
                from sqlalchemy import text as _text2

                uid = uuid.UUID(user_id)
                r1 = await db.execute(_text2("SELECT id FROM workspaces WHERE id=:ws AND user_id=:uid"), {"ws": str(ws_uuid), "uid": str(uid)})
                if not r1.first():
                    r2 = await db.execute(_text2("SELECT workspace_id FROM workspace_users WHERE workspace_id=:ws AND user_id=:uid"), {"ws": str(ws_uuid), "uid": str(uid)})
                    if not r2.first():
                        raise HTTPException(status_code=403, detail="Not authorized for workspace")
            except HTTPException:
                raise
            except Exception:
                # DB failure → 503 fail-closed (T-002)
                from fastapi import HTTPException as _HE2

                raise _HE2(status_code=503, detail="Authorization check failed")
        # T-001 + T-008: payload secret and size validation (fail-closed)
        try:
            from ..temporal.validation import validate_no_secrets, validate_payload_size

            if dto.payload is not None:
                validate_no_secrets(dto.payload)
                validate_payload_size(dto.payload, label="event payload")
        except ValueError as ve:
            from fastapi import HTTPException as _HE3

            raise _HE3(status_code=400, detail=str(ve))
        event = Event(
            type=dto.type,
            source=dto.source,
            category=dto.category,
            correlation_id=uuid.UUID(dto.correlation_id) if dto.correlation_id else uuid.uuid4(),
            payload=dto.payload,
            priority=dto.priority,
            user_id=uuid.UUID(user_id) if user_id else None,
            workspace_id=ws_uuid,
            status="PUBLISHED",
            published_at=datetime.now(UTC),
        )
        db.add(event)
        await db.flush()  # id available pre-commit for the outbox row below
        # Outbox (Loop 2): mirror this write in the SAME transaction. A crash
        # after commit leaves the relay a durable row to deliver; a crash
        # before commit rolls both back. No separate commit here.
        try:
            from .outbox import record_outbox_event

            record_outbox_event(
                db,
                event_type=f"event.{event.type}",
                payload={
                    "event_id": str(event.id),
                    "event_type": event.type,
                    "workspace_id": str(event.workspace_id) if event.workspace_id else None,
                    "payload": event.payload if isinstance(event.payload, dict) else {},
                },
                workspace_id=event.workspace_id,
            )
        except Exception:
            pass  # outbox mirror must never break the primary write
        await db.commit()
        await db.refresh(event)
        # Fire-and-forget Temporal event-triggered workflow (dedup per event_id, §7/§20)
        try:
            import asyncio as _aio

            async def _trigger():
                await dispatch_event_workflow(
                    str(event.id), event.type,
                    str(event.workspace_id) if event.workspace_id else None,
                    event.payload if isinstance(event.payload, dict) else {},
                    correlation_id=str(event.correlation_id) if event.correlation_id else None,
                )

            _aio.create_task(_trigger())
        except Exception:
            pass
        return event

    async def find_all(self, user_id: str, db: AsyncSession = None, workspace_id: str | None = None):
        stmt = select(Event)
        if user_id:
            stmt = stmt.where(Event.user_id == uuid.UUID(user_id))
        if workspace_id:
            with contextlib.suppress(ValueError, TypeError):
                stmt = stmt.where(Event.workspace_id == uuid.UUID(workspace_id))
        stmt = stmt.order_by(Event.created_at.desc())
        result = await db.execute(stmt)
        return result.scalars().all()

    async def create_subscription(self, dto, user_id: str, db: AsyncSession = None):
        sub = EventSubscription(
            event_type=dto.event_type,
            handler_id=uuid.UUID(dto.handler_id),
            handler_type=dto.handler_type,
            config=dto.config,
            filters=dto.filters,
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
        return sub

    async def list_subscriptions(self, user_id: str, db: AsyncSession = None):
        result = await db.execute(select(EventSubscription))
        return result.scalars().all()


event_service = EventService()
