"""Enterprise Prompt Version Registry Repository."""

from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.registries import PromptVersionEntry
from .base import BaseRepository


class PromptRepository(BaseRepository[PromptVersionEntry]):
    """Repository for querying and managing PromptVersionEntry records."""

    def __init__(
        self,
        session: AsyncSession,
        tenant_id: uuid.UUID | str | None = None,
        workspace_id: uuid.UUID | str | None = None,
    ):
        super().__init__(PromptVersionEntry, session, tenant_id, workspace_id)

    async def get_latest_version(self, prompt_id: str) -> PromptVersionEntry | None:
        """Fetch latest active prompt version for workspace."""
        stmt = (
            select(PromptVersionEntry)
            .where(
                PromptVersionEntry.prompt_id == prompt_id,
                PromptVersionEntry.is_active.is_(True),
            )
            .order_by(PromptVersionEntry.created_at.desc(), PromptVersionEntry.version.desc())
        )
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def list_versions(self, prompt_id: str) -> Sequence[PromptVersionEntry]:
        """List all versions of a prompt in chronological order."""
        stmt = (
            select(PromptVersionEntry)
            .where(PromptVersionEntry.prompt_id == prompt_id)
            .order_by(PromptVersionEntry.created_at.asc(), PromptVersionEntry.version.asc())
        )
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        return res.scalars().all()
