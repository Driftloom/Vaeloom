import uuid
import re
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Notification


class NotificationService:
    async def send(self, dto, db: AsyncSession = None):
        now = datetime.now(timezone.utc)
        body = dto.body
        subject = dto.subject

        if dto.template:
            tpl = await self.resolve_template(dto.template, dto.channel.value, db)
            if tpl:
                subject = subject or tpl.get("subject", "")
                body = body or tpl.get("body", "")
                if dto.data:
                    body = self.interpolate_template(body, dto.data)
                    if subject:
                        subject = self.interpolate_template(subject, dto.data)

        if not body:
            raise HTTPException(400, "No body resolved")

        notification = Notification(
            type="outgoing",
            channel=dto.channel.value,
            title=subject or "",
            message=body,
            recipient=dto.recipient,
            subject=subject,
            status="pending",
            priority="medium",
        )
        db.add(notification)
        await db.flush()

        try:
            if dto.channel.value == "email":
                notification.status = "sent"
            elif dto.channel.value == "slack":
                notification.status = "sent"
            elif dto.channel.value == "push":
                notification.status = "sent"
            notification.updated_at = datetime.now(timezone.utc)
        except Exception:
            notification.status = "failed"
            notification.updated_at = datetime.now(timezone.utc)

        await db.flush()
        await db.refresh(notification)

        await self.notify_subscribers(notification, db)
        return notification

    async def list_notifications(self, page: int, page_size: int, channel: str | None, db: AsyncSession = None):
        query = select(Notification)
        if channel:
            query = query.where(Notification.channel == channel)
        query = query.order_by(Notification.created_at.desc())
        total_result = await db.execute(select(Notification.id).where(query._where_criteria[0] if query._where_criteria else True))
        total = len(total_result.all())
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        rows = result.scalars().all()
        return rows, total

    async def get_notification(self, notification_id: uuid.UUID | str, db: AsyncSession = None):
        if isinstance(notification_id, str):
            notification_id = uuid.UUID(notification_id)
        result = await db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        return result.scalar_one_or_none()

    async def create_template(self, dto, db: AsyncSession = None):
        template_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO notification_templates (id, name, subject, body, channel, created_at)
                VALUES (:id, :name, :subject, :body, :channel, :created_at)
            """),
            {
                "id": template_id,
                "name": dto.name,
                "subject": dto.subject,
                "body": dto.body,
                "channel": dto.channel.value,
                "created_at": now,
            },
        )
        await db.flush()
        return {"id": str(template_id), "name": dto.name, "subject": dto.subject, "body": dto.body, "channel": dto.channel.value, "created_at": now}

    async def list_templates(self, db: AsyncSession = None):
        result = await db.execute(
            text("SELECT * FROM notification_templates ORDER BY created_at DESC")
        )
        rows = result.fetchall()
        return [dict(r._mapping) for r in rows]

    async def resolve_template(self, name: str, channel: str, db: AsyncSession = None):
        result = await db.execute(
            text("SELECT * FROM notification_templates WHERE name = :name AND channel = :channel"),
            {"name": name, "channel": channel},
        )
        row = result.fetchone()
        return dict(row._mapping) if row else None

    def interpolate_template(self, template: str, data: dict) -> str:
        def replacer(match):
            key = match.group(1)
            return str(data.get(key, match.group(0)))
        return re.sub(r"\{\{(\w+)\}\}", replacer, template)

    async def subscribe(self, dto, db: AsyncSession = None):
        sub_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO notification_subscribers (id, url, tenant_id, created_at)
                VALUES (:id, :url, :tenant_id, :created_at)
            """),
            {"id": sub_id, "url": dto.url, "tenant_id": dto.tenant_id, "created_at": now},
        )
        await db.flush()
        return {"id": str(sub_id), "url": dto.url, "tenant_id": dto.tenant_id, "created_at": now}

    async def notify_subscribers(self, notification, db: AsyncSession = None):
        try:
            result = await db.execute(text("SELECT url FROM notification_subscribers"))
            subscribers = result.fetchall()
            async with httpx.AsyncClient(timeout=5) as client:
                for sub in subscribers:
                    try:
                        await client.post(sub[0], json={
                            "id": str(notification.id),
                            "channel": notification.channel,
                            "recipient": notification.recipient,
                            "subject": notification.subject,
                            "body": notification.message,
                            "status": notification.status,
                        })
                    except Exception:
                        pass
        except Exception:
            pass

    async def update_status(self, notification_id: str, status: str, db: AsyncSession = None):
        result = await db.execute(
            text("UPDATE notifications SET status = :status, updated_at = :updated_at WHERE id = :id"),
            {"status": status, "updated_at": datetime.now(timezone.utc), "id": uuid.UUID(notification_id)},
        )
        await db.flush()
        return result.rowcount > 0


notification_service = NotificationService()
