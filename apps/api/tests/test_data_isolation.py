import uuid

import pytest
from sqlalchemy import Column, Integer, String, select
from sqlalchemy.orm import Mapped, mapped_column

from api.database import Base
from api.infrastructure.data_isolation import (
    RowLevelSecurityMixin,
    TenantAwareBase,
    TenantScopedQuery,
)

pytestmark = pytest.mark.asyncio


class TestRowLevelSecurityMixin:
    def test_mixin_adds_tenant_id_column(self):
        class TestModel(RowLevelSecurityMixin, Base):
            __tablename__ = "test_rls"
            id: Mapped[int] = mapped_column(Integer, primary_key=True)
            name: Mapped[str] = mapped_column(String(50))

        assert hasattr(TestModel, "tenant_id")
        col = TestModel.__table__.c.get("tenant_id")
        assert col is not None

    def test_set_tenant_string(self):
        class TestModel(RowLevelSecurityMixin, Base):
            __tablename__ = "test_set_tenant_str"
            id: Mapped[int] = mapped_column(Integer, primary_key=True)

        instance = TestModel()
        instance.set_tenant("550e8400-e29b-41d4-a716-446655440000")
        assert instance.tenant_id == uuid.UUID("550e8400-e29b-41d4-a716-446655440000")

    def test_set_tenant_uuid(self):
        class TestModel(RowLevelSecurityMixin, Base):
            __tablename__ = "test_set_tenant_uuid"
            id: Mapped[int] = mapped_column(Integer, primary_key=True)

        instance = TestModel()
        tid = uuid.uuid4()
        instance.set_tenant(tid)
        assert instance.tenant_id == tid


class TestTenantScopedQuery:
    def test_select_adds_tenant_filter(self):
        class TestModel(RowLevelSecurityMixin, Base):
            __tablename__ = "test_tsq_select"
            id: Mapped[int] = mapped_column(Integer, primary_key=True)

        tid = uuid.uuid4()
        q = TenantScopedQuery(TestModel, tid)
        stmt = q.select()
        compiled = stmt.compile(compile_kwargs={"literal_binds": True})
        assert str(tid) in str(compiled)

    def test_find_by_id_adds_tenant_filter(self):
        class TestModel(RowLevelSecurityMixin, Base):
            __tablename__ = "test_tsq_find"
            id: Mapped[int] = mapped_column(Integer, primary_key=True)

        tid = uuid.uuid4()
        row_id = uuid.uuid4()
        q = TenantScopedQuery(TestModel, tid)
        stmt = q.find_by_id(row_id)
        compiled = stmt.compile(compile_kwargs={"literal_binds": True})
        assert str(tid) in str(compiled)
        assert "test_tsq_find" in str(compiled)

    def test_filter_query_static(self):
        class TestModel(RowLevelSecurityMixin, Base):
            __tablename__ = "test_tsq_static"
            id: Mapped[int] = mapped_column(Integer, primary_key=True)

        tid = uuid.uuid4()
        stmt = select(TestModel)
        filtered = TenantScopedQuery.filter_query(stmt, tid)
        compiled = filtered.compile(compile_kwargs={"literal_binds": True})
        assert str(tid) in str(compiled)

    def test_different_tenants_produce_different_filters(self):
        class TestModel(RowLevelSecurityMixin, Base):
            __tablename__ = "test_tsq_diff"
            id: Mapped[int] = mapped_column(Integer, primary_key=True)

        t1 = uuid.uuid4()
        t2 = uuid.uuid4()
        q1 = TenantScopedQuery(TestModel, t1)
        q2 = TenantScopedQuery(TestModel, t2)
        stmt1 = q1.select()
        stmt2 = q2.select()
        c1 = stmt1.compile(compile_kwargs={"literal_binds": True})
        c2 = stmt2.compile(compile_kwargs={"literal_binds": True})
        assert str(t1) in str(c1)
        assert str(t2) in str(c2)


class TestTenantAwareBase:
    def test_is_abstract(self):
        assert TenantAwareBase.__abstract__

    def test_concrete_model_has_tenant_id(self):
        class TenantModel(TenantAwareBase):
            __tablename__ = "test_tab"
            id: Mapped[int] = mapped_column(Integer, primary_key=True)
            name: Mapped[str] = mapped_column(String(50))

        assert hasattr(TenantModel, "tenant_id")
        assert "tenant_id" in TenantModel.__table__.c
