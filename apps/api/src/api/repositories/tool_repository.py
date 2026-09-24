"""Enterprise Tool Registry Repository."""

from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.registries import ToolRegistryEntry
from .base import BaseRepository


class ToolRepository(BaseRepository[ToolRegistryEntry]):
    """Repository for querying and managing ToolRegistryEntry records."""

    def __init__(
        self,
        session: AsyncSession,
        tenant_id: uuid.UUID | str | None = None,
        workspace_id: uuid.UUID | str | None = None,
    ):
        super().__init__(ToolRegistryEntry, session, tenant_id, workspace_id)

    async def get_by_tool_id(self, tool_id: str) -> ToolRegistryEntry | None:
        """Fetch tool entry by tool_id within tenant boundary."""
        stmt = select(ToolRegistryEntry).where(ToolRegistryEntry.tool_id == tool_id)
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def list_active_tools(self) -> Sequence[ToolRegistryEntry]:
        """Fetch all active tools visible to current workspace."""
        stmt = select(ToolRegistryEntry).where(ToolRegistryEntry.is_active.is_(True))
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        return res.scalars().all()
