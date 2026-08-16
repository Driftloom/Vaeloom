import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Event, EventSubscription


class EventService:
    async def publish(self, dto, user_id: str, db: AsyncSession = None):
        event = Event(
            type=dto.type,
            source=dto.source,
            category=dto.category,
            correlation_id=uuid.UUID(dto.correlation_id) if dto.correlation_id else uuid.uuid4(),
            payload=dto.payload,
            priority=dto.priority,
            user_id=uuid.UUID(user_id) if user_id else None,
            status="PUBLISHED",
            published_at=datetime.now(timezone.utc),
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        return event

    async def find_all(self, user_id: str, db: AsyncSession = None):
        stmt = select(Event)
        if user_id:
            stmt = stmt.where(Event.user_id == uuid.UUID(user_id))
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
