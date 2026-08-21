import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Integration


class IntegrationService:
    async def create(self, dto, user_id: str, db: AsyncSession = None):
        existing = await db.execute(
            select(Integration).where(
                Integration.user_id == uuid.UUID(user_id),
                Integration.provider == dto.provider,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"Integration for provider '{dto.provider}' already exists",
            )

        integration = Integration(
            name=dto.name,
            provider=dto.provider,
            config=dto.config,
            status="disconnected",
            user_id=uuid.UUID(user_id),
        )
        db.add(integration)
        await db.commit()
        await db.refresh(integration)
        return integration

    async def list_for_user(self, user_id: str, db: AsyncSession = None):
        result = await db.execute(
            select(Integration).where(Integration.user_id == uuid.UUID(user_id))
        )
        return result.scalars().all()

    async def update(self, integration_id: str, dto, user_id: str, db: AsyncSession = None):
        result = await db.execute(
            select(Integration).where(
                Integration.id == uuid.UUID(integration_id),
                Integration.user_id == uuid.UUID(user_id),
            )
        )
        integration = result.scalar_one_or_none()
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        if dto.name is not None:
            integration.name = dto.name
        if dto.config is not None:
            integration.config = dto.config

        await db.commit()
        await db.refresh(integration)
        return integration

    async def delete(self, integration_id: str, user_id: str, db: AsyncSession = None):
        result = await db.execute(
            select(Integration).where(
                Integration.id == uuid.UUID(integration_id),
                Integration.user_id == uuid.UUID(user_id),
            )
        )
        integration = result.scalar_one_or_none()
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        await db.delete(integration)
        await db.commit()
        return True

    async def sync(self, integration_id: str, user_id: str, db: AsyncSession = None):
        result = await db.execute(
            select(Integration).where(
                Integration.id == uuid.UUID(integration_id),
                Integration.user_id == uuid.UUID(user_id),
            )
        )
        integration = result.scalar_one_or_none()
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        integration.last_sync_at = datetime.now(UTC)
        integration.status = "syncing"
        await db.commit()
        await db.refresh(integration)
        return {"synced": True, "message": "Sync initiated"}


integration_service = IntegrationService()
