import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import sqlalchemy.types as sa_types
from sqlalchemy.dialects.sqlite import TEXT, JSON


class MockVector(sa_types.TypeDecorator):
    impl = sa_types.Text
    cache_ok = True

    def __init__(self, dim=None):
        super().__init__()


import pgvector.sqlalchemy
pgvector.sqlalchemy.Vector = MockVector

class MockArray(sa_types.JSON):
    def __init__(self, item_type=None, *args, **kwargs):
        super().__init__(*args, **kwargs)

import uuid


class MockUUID(sa_types.TypeDecorator):
    impl = sa_types.String
    cache_ok = True
    def __init__(self, as_uuid=True, *args, **kwargs):
        super().__init__(*args, **kwargs)
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return str(value)
        if isinstance(value, str):
            return value
        return str(value)
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value) if value else None

import sqlalchemy.dialects.postgresql
sqlalchemy.dialects.postgresql.JSONB = JSON
sqlalchemy.dialects.postgresql.ARRAY = MockArray
sqlalchemy.dialects.postgresql.UUID = MockUUID

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from backend.database import Base, get_db
from backend.main import app


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test.db")


@pytest_asyncio.fixture
async def db_session(db_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
