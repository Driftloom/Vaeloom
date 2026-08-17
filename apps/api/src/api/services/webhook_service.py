import asyncio
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.schema import Webhook, WebhookDelivery
from ..services.encryption import encrypt_value, decrypt_value, is_encrypted


class WebhookService:
    async def create(self, tenant_id: str | None, name: str, url: str, secret: str, events: list[str], db: AsyncSession) -> Webhook:
        tid = uuid.UUID(tenant_id) if tenant_id else uuid.uuid4()
        # Encrypt secret at rest
        encrypted_secret = encrypt_value(secret)
        webhook = Webhook(
            tenant_id=tid,
            name=name,
            url=url,
            secret=encrypted_secret,
            events=events,
        )
        db.add(webhook)
        await db.commit()
        await db.refresh(webhook)
        return webhook

    async def list(self, tenant_id: str | None, db: AsyncSession) -> list[Webhook]:
        query = select(Webhook)
        if tenant_id:
            query = query.where(Webhook.tenant_id == uuid.UUID(tenant_id))
        query = query.order_by(Webhook.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

    async def get(self, webhook_id: uuid.UUID, tenant_id: str | None, db: AsyncSession) -> Webhook | None:
        query = select(Webhook).where(Webhook.id == webhook_id)
        if tenant_id:
            query = query.where(Webhook.tenant_id == uuid.UUID(tenant_id))
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def update(self, webhook_id: uuid.UUID, tenant_id: str | None, updates: dict, db: AsyncSession) -> Webhook | None:
        webhook = await self.get(webhook_id, tenant_id, db)
        if not webhook:
            return None
        for key, value in updates.items():
            if hasattr(webhook, key):
                setattr(webhook, key, value)
        webhook.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(webhook)
        return webhook

    async def delete(self, webhook_id: uuid.UUID, tenant_id: str | None, db: AsyncSession) -> bool:
        webhook = await self.get(webhook_id, tenant_id, db)
        if not webhook:
            return False
        await db.delete(webhook)
        await db.commit()
        return True

    async def _compute_signature(self, payload: bytes, secret: str) -> str:
        # Decrypt if encrypted
        actual_secret = decrypt_value(secret) if is_encrypted(secret) else secret
        return hmac.new(actual_secret.encode(), payload, hashlib.sha256).hexdigest()

    async def dispatch(self, event_type: str, payload: dict, tenant_id: str | None, db: AsyncSession) -> list[WebhookDelivery]:
        query = select(Webhook).where(Webhook.active == True)
        if tenant_id:
            query = query.where(Webhook.tenant_id == uuid.UUID(tenant_id))
        if event_type != "*":
            query = query.where(
                Webhook.events.contains(json.dumps(event_type))
            )
        result = await db.execute(query)
        webhooks = result.scalars().all()

        deliveries: list[WebhookDelivery] = []
        for wh in webhooks:
            delivery = WebhookDelivery(
                webhook_id=wh.id,
                event_type=event_type,
                payload=payload,
                status="PENDING",
                max_attempts=wh.retry_count or 3,
            )
            db.add(delivery)
            await db.flush()
            deliveries.append(delivery)

        await db.commit()

        for delivery in deliveries:
            asyncio.create_task(self._send(delivery.id, db))

        return deliveries

    async def _send(self, delivery_id: uuid.UUID, db: AsyncSession) -> None:
        result = await db.execute(
            select(WebhookDelivery, Webhook)
            .join(Webhook, WebhookDelivery.webhook_id == Webhook.id)
            .where(WebhookDelivery.id == delivery_id)
        )
        row = result.one_or_none()
        if not row:
            return
        delivery, webhook = row

        body = json.dumps({
            "event_type": delivery.event_type,
            "payload": delivery.payload,
            "delivery_id": str(delivery.id),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }).encode()

        signature = await self._compute_signature(body, webhook.secret)

        for attempt in range(1, delivery.max_attempts + 1):
            try:
                async with httpx.AsyncClient(timeout=webhook.timeout_ms / 1000) as client:
                    resp = await client.post(
                        webhook.url,
                        content=body,
                        headers={
                            "Content-Type": "application/json",
                            "X-Webhook-Signature": signature,
                            "X-Webhook-Event": delivery.event_type,
                            "X-Webhook-Delivery": str(delivery.id),
                        },
                    )

                delivery.status_code = resp.status_code
                delivery.response_body = resp.text[:2000]
                delivery.status = "DELIVERED" if resp.is_success else "FAILED"
                delivery.completed_at = datetime.now(timezone.utc)
                await db.commit()
                return

            except (httpx.RequestError, asyncio.TimeoutError) as exc:
                if attempt < delivery.max_attempts:
                    wait = 2 ** attempt
                    delivery.next_retry_at = datetime.now(timezone.utc)
                    delivery.attempt = attempt + 1
                    await db.commit()
                    await asyncio.sleep(wait)
                else:
                    delivery.status = "FAILED"
                    delivery.completed_at = datetime.now(timezone.utc)
                    delivery.response_body = str(exc)[:2000]
                    await db.commit()

    async def list_deliveries(self, webhook_id: uuid.UUID, db: AsyncSession) -> list[WebhookDelivery]:
        result = await db.execute(
            select(WebhookDelivery)
            .where(WebhookDelivery.webhook_id == webhook_id)
            .order_by(WebhookDelivery.created_at.desc())
            .limit(50)
        )
        return result.scalars().all()


webhook_service = WebhookService()
