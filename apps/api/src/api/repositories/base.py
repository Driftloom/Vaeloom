"""Enterprise Base Repository with Tenant and Workspace RLS Scoping.

All queries through BaseRepository automatically enforce tenant_id and workspace_id
boundaries, preventing cross-tenant leakage at the data access layer.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Generic, Sequence, Type, TypeVar

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import Base

logger = logging.getLogger(__name__)

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Generic async repository providing tenant-isolated CRUD operations."""

    def __init__(
        self,
        model_cls: Type[ModelT],
        session: AsyncSession,
        tenant_id: uuid.UUID | str | None = None,
        workspace_id: uuid.UUID | str | None = None,
    ):
        self.model_cls = model_cls
        self.session = session
        self.tenant_id = uuid.UUID(str(tenant_id)) if tenant_id else None
        self.workspace_id = uuid.UUID(str(workspace_id)) if workspace_id else None

    def _scope_query(self, stmt: Any) -> Any:
        """Apply tenant and workspace isolation filters to the statement."""
        if hasattr(self.model_cls, "tenant_id") and self.tenant_id:
            stmt = stmt.where(
                (getattr(self.model_cls, "tenant_id") == self.tenant_id)
                | (getattr(self.model_cls, "tenant_id").is_(None))
            )
        if hasattr(self.model_cls, "workspace_id") and self.workspace_id:
            stmt = stmt.where(
                (getattr(self.model_cls, "workspace_id") == self.workspace_id)
                | (getattr(self.model_cls, "workspace_id").is_(None))
            )
        return stmt

    async def get_by_id(self, entity_id: uuid.UUID | str) -> ModelT | None:
        """Fetch a single entity by ID enforcing tenancy scoping."""
        uid = uuid.UUID(str(entity_id)) if isinstance(entity_id, str) else entity_id
        stmt = select(self.model_cls).where(self.model_cls.id == uid)
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def list_all(self, skip: int = 0, limit: int = 100) -> Sequence[ModelT]:
        """List entities respecting pagination and tenancy boundaries."""
        stmt = select(self.model_cls).offset(skip).limit(limit)
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def create(self, entity: ModelT) -> ModelT:
        """Add new entity attaching tenant context."""
        if hasattr(entity, "tenant_id") and not getattr(entity, "tenant_id"):
            setattr(entity, "tenant_id", self.tenant_id)
        if hasattr(entity, "workspace_id") and not getattr(entity, "workspace_id"):
            setattr(entity, "workspace_id", self.workspace_id)
        self.session.add(entity)
        await self.session.commit()
        await self.session.refresh(entity)
        return entity

    async def delete(self, entity_id: uuid.UUID | str) -> bool:
        """Delete an entity by ID within tenant boundary."""
        uid = uuid.UUID(str(entity_id)) if isinstance(entity_id, str) else entity_id
        stmt = delete(self.model_cls).where(self.model_cls.id == uid)
        stmt = self._scope_query(stmt)
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount > 0
