import uuid
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import async_session_factory, Base


class TenantNotFoundError(Exception):
    def __init__(self, tenant_id: str) -> None:
        self.tenant_id = tenant_id
        super().__init__(f"Tenant not found: {tenant_id}")


async def get_tenant_connection(tenant_id: str) -> AsyncSession:
    session = async_session_factory()
    try:
        from ..models.schema import Tenant
        from sqlalchemy import select as _select

        tid = uuid.UUID(tenant_id)
        result = await session.execute(_select(Tenant).where(Tenant.id == tid))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise TenantNotFoundError(tenant_id)
        return session
    except Exception:
        await session.close()
        raise


class TenantAwareRepository:
    def __init__(self, db: AsyncSession, tenant_id: str | None = None) -> None:
        self.db = db
        self.tenant_id = tenant_id

    def _apply_tenant_filter(self, stmt: Select, model_class: type[Base]) -> Select:
        if not self.tenant_id:
            return stmt
        if hasattr(model_class, "tenant_id"):
            try:
                tid = uuid.UUID(self.tenant_id)
                return stmt.where(model_class.tenant_id == tid)
            except (ValueError, TypeError):
                return stmt.where(model_class.tenant_id == self.tenant_id)
        return stmt

    def _count_query(self, model_class: type[Base]) -> Select:
        stmt = select(model_class)
        return self._apply_tenant_filter(stmt, model_class)

    async def count(self, model_class: type[Base]) -> int:
        from sqlalchemy import func

        stmt = self._count_query(model_class)
        stmt = select(func.count()).select_from(stmt.subquery())
        result = await self.db.execute(stmt)
        return result.scalar_one() or 0

    async def find_all(
        self,
        model_class: type[Base],
        skip: int = 0,
        limit: int = 100,
        order_by: Any = None,
    ) -> list[Base]:
        stmt = self._apply_tenant_filter(select(model_class), model_class)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_id(self, model_class: type[Base], row_id: uuid.UUID) -> Base | None:
        stmt = select(model_class).where(model_class.id == row_id)
        stmt = self._apply_tenant_filter(stmt, model_class)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, instance: Base) -> Base:
        if hasattr(instance, "tenant_id") and self.tenant_id:
            try:
                instance.tenant_id = uuid.UUID(self.tenant_id)
            except (ValueError, TypeError):
                instance.tenant_id = self.tenant_id
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def delete(self, instance: Base) -> None:
        await self.db.delete(instance)
        await self.db.flush()
