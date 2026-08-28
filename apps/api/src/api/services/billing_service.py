import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, select

from ..models.schema import Subscription, UsageRecord


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
        now = datetime.now(UTC)
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

    async def list_invoices(self, user_id: str, db=None):
        # Derive invoices from subscriptions + usage_records (no separate invoices table yet)
        # Each subscription period generates one invoice; amount from plan + usage
        subs = await db.execute(
            select(Subscription).where(Subscription.user_id == uuid.UUID(user_id)).order_by(Subscription.created_at.desc())
        )
        subscriptions = subs.scalars().all()
        invoices = []
        plan_prices = {"free": 0.0, "pro": 29.0, "enterprise": 99.0, "starter": 9.0}
        for sub in subscriptions:
            # usage for this period
            usage_res = await db.execute(
                select(UsageRecord).where(
                    and_(
                        UsageRecord.user_id == uuid.UUID(user_id),
                        UsageRecord.timestamp >= sub.current_period_start,
                        UsageRecord.timestamp <= sub.current_period_end,
                    )
                )
            )
            usage = usage_res.scalars().all()
            usage_total = sum(float(getattr(u, "value", 0) or 0) * 0.01 for u in usage)  # $0.01 per unit
            base = plan_prices.get(str(sub.plan).lower(), 19.0)
            amount = round(base + usage_total, 2)
            invoices.append({
                "id": f"inv_{sub.id.hex[:8]}_{sub.current_period_start.strftime('%Y%m')}",
                "subscription_id": str(sub.id),
                "plan": str(sub.plan),
                "amount": amount,
                "currency": "USD",
                "status": "paid" if str(sub.status).lower() == "active" else "pending",
                "period_start": sub.current_period_start,
                "period_end": sub.current_period_end,
                "issued_at": sub.current_period_start,
                "download_url": f"/api/v1/billing/invoices/inv_{sub.id.hex[:8]}_{sub.current_period_start.strftime('%Y%m')}/download",
            })
        # If no subscription, return empty (frontend will show empty, not mock)
        return invoices


billing_service = BillingService()
