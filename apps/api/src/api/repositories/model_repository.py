"""Enterprise Model Provider Registry Repository."""

from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.registries import ModelProviderEntry
from .base import BaseRepository


class ModelRepository(BaseRepository[ModelProviderEntry]):
    """Repository for querying and managing ModelProviderEntry records."""

    def __init__(
        self,
        session: AsyncSession,
        tenant_id: uuid.UUID | str | None = None,
        workspace_id: uuid.UUID | str | None = None,
    ):
        super().__init__(ModelProviderEntry, session, tenant_id, workspace_id)

    async def get_by_model_id(self, model_id: str) -> ModelProviderEntry | None:
        """Fetch model by model_id within tenant boundary."""
        stmt = select(ModelProviderEntry).where(ModelProviderEntry.model_id == model_id)
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def list_active_by_tier(self, tier: str) -> Sequence[ModelProviderEntry]:
        """Fetch all active models in a complexity tier."""
        stmt = select(ModelProviderEntry).where(
            ModelProviderEntry.tier == tier,
            ModelProviderEntry.is_active.is_(True),
            ModelProviderEntry.health_status != "unhealthy",
        )
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def list_healthy_models(self) -> Sequence[ModelProviderEntry]:
        """Fetch all active healthy models."""
        stmt = select(ModelProviderEntry).where(
            ModelProviderEntry.is_active.is_(True),
            ModelProviderEntry.health_status == "healthy",
        )
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        return res.scalars().all()
