import uuid
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column

from ..database import Base


class RowLevelSecurityMixin:
    @declared_attr
    def tenant_id(cls) -> Mapped[uuid.UUID | None]:
        return mapped_column(UUID(as_uuid=True), default=None)

    def set_tenant(self, tenant_id: str | uuid.UUID) -> None:
        if isinstance(tenant_id, str):
            self.tenant_id = uuid.UUID(tenant_id)
        else:
            self.tenant_id = uuid.UUID(str(tenant_id))


class TenantScopedQuery:
    def __init__(self, model_class: type[Base], tenant_id: str | uuid.UUID) -> None:
        self.model_class = model_class
        if isinstance(tenant_id, str):
            self.tenant_id = uuid.UUID(tenant_id)
        else:
            self.tenant_id = tenant_id

    def _apply(self, stmt: Select) -> Select:
        if hasattr(self.model_class, "tenant_id"):
            return stmt.where(self.model_class.tenant_id == self.tenant_id)
        return stmt

    def select(self) -> Select:
        return self._apply(select(self.model_class))

    def find_by_id(self, row_id: uuid.UUID) -> Select:
        stmt = select(self.model_class).where(self.model_class.id == row_id)
        return self._apply(stmt)

    @staticmethod
    def filter_query(stmt: Select, tenant_id: str | uuid.UUID) -> Select:
        if isinstance(tenant_id, str):
            tid = uuid.UUID(tenant_id)
        else:
            tid = tenant_id
        if hasattr(stmt, "get_final_froms"):
            froms = stmt.get_final_froms()
            for f in froms:
                col = f.c.get("tenant_id") if hasattr(f, "c") else None
                if col is not None:
                    return stmt.where(col == tid)
        return stmt


class TenantAwareBase(RowLevelSecurityMixin, Base):
    __abstract__ = True

    @declared_attr
    def tenant_id(cls) -> Mapped[uuid.UUID | None]:
        return mapped_column(UUID(as_uuid=True), default=None)

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
