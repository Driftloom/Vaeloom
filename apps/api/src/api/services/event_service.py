import contextlib
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Event, EventSubscription


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
        await db.commit()
        await db.refresh(event)
        # Fire-and-forget Temporal event-triggered workflow (dedup per event_id, §7/§20)
        try:
            import asyncio as _aio

            async def _trigger():
                try:
                    from ..config import settings as _settings
                    if not getattr(_settings, "temporal_enabled", False):
                        return
                    from ..temporal.client import get_temporal_client
                    from ..temporal.queues import queue_name
                    from ..temporal.workflows import EventTriggerInput  # type: ignore
                    # Only durable-execute for configured event types (prevent infinite loop)
                    DURABLE_EVENT_TYPES = {"document.created", "document.updated", "connector.updated", "application.status_changed", "deadline.created"}
                    if event.type not in DURABLE_EVENT_TYPES:
                        return
                    client = await get_temporal_client()
                    if client is None:
                        return
                    from temporalio.common import WorkflowIDReusePolicy as _WIDP  # type: ignore

                    wid = f"event:{str(event.workspace_id) if event.workspace_id else 'global'}:{event.type}:{event.id}"
                    await client.start_workflow(
                        "EventTriggeredWorkflow",
                        EventTriggerInput(
                            event_type=event.type,
                            event_id=str(event.id),
                            workspace_id=str(event.workspace_id) if event.workspace_id else None,
                            correlation_id=str(event.correlation_id) if event.correlation_id else str(event.id),
                            causation_id=str(event.id),
                            payload=event.payload if isinstance(event.payload, dict) else {},
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

                        logging.getLogger(__name__).debug(f"EventTriggeredWorkflow trigger skipped for {event.id}: {e}")

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
