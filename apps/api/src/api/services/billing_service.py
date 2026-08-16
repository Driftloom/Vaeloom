import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select, and_

from ..models.schema import UsageRecord, Subscription


class BillingService:
    async def get_usage(
        self,
        user_id: str,
        metric: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        db=None,
    ):
        conditions = [UsageRecord.user_id == uuid.UUID(user_id)]
        if metric:
            conditions.append(UsageRecord.metric == metric)
        if from_date:
            conditions.append(UsageRecord.timestamp >= datetime.fromisoformat(from_date))
        if to_date:
            conditions.append(UsageRecord.timestamp <= datetime.fromisoformat(to_date))
        result = await db.execute(
            select(UsageRecord).where(and_(*conditions)).order_by(UsageRecord.timestamp.desc())
        )
        return result.scalars().all()

    async def get_subscription(self, user_id: str, db=None):
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == uuid.UUID(user_id))
        )
        return result.scalar_one_or_none()

    async def create_subscription(self, user_id: str, plan: str, db=None):
        existing = await db.execute(
            select(Subscription).where(Subscription.user_id == uuid.UUID(user_id))
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Subscription already exists")
        now = datetime.now(timezone.utc)
        sub = Subscription(
            user_id=uuid.UUID(user_id),
            plan=plan,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )
        db.add(sub)
        await db.flush()
        await db.refresh(sub)
        return sub


billing_service = BillingService()
