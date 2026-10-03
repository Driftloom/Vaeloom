from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from api.database import RLSGuardedAsyncSession


def _build_engine(url: str) -> Any:
    kwargs: dict[str, Any] = {"pool_pre_ping": True}
    if not url.startswith("sqlite"):
        kwargs["pool_size"] = 20
        kwargs["max_overflow"] = 10
    else:
        kwargs["poolclass"] = NullPool
    return create_async_engine(url, **kwargs)


class DatabaseRouter:
    def __init__(
        self,
        primary_url: str | None = None,
        replica_url: str | None = None,
    ):
        from api.config import settings

        self._primary_url = (
            primary_url
            or os.environ.get("DATABASE_URL")
            or getattr(settings, "database__url", "")
            or "postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom"
        )
        self._replica_url = (
            replica_url
            or os.environ.get("DATABASE_REPLICA_URL")
            or getattr(settings, "database_replica_url", "")
            or ""
        )
        self._primary_engine = _build_engine(self._primary_url)
        self._replica_engine: Any = None
        if self._replica_url:
            self._replica_engine = _build_engine(self._replica_url)
        self._primary_factory = async_sessionmaker(self._primary_engine, class_=RLSGuardedAsyncSession, expire_on_commit=False)
        self._replica_factory: Any = None
        if self._replica_engine:
            self._replica_factory = async_sessionmaker(self._replica_engine, class_=RLSGuardedAsyncSession, expire_on_commit=False)

    @property
    def has_replica(self) -> bool:
        return self._replica_engine is not None

    @asynccontextmanager
    async def get_read_session(self) -> AsyncGenerator[AsyncSession, None]:
        factory = self._replica_factory if self._replica_factory else self._primary_factory
        async with factory() as session:
            try:
                from api.middleware.tenant import set_rls_session_vars

                await set_rls_session_vars(session)
            except Exception:
                pass
            try:
                yield session
            finally:
                await session.close()

    @asynccontextmanager
    async def get_write_session(self) -> AsyncGenerator[AsyncSession, None]:
        async with self._primary_factory() as session:
            try:
                from api.middleware.tenant import set_rls_session_vars

                await set_rls_session_vars(session)
            except Exception:
                pass
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()


_router: DatabaseRouter | None = None


def get_router() -> DatabaseRouter:
    global _router
    if _router is None:
        _router = DatabaseRouter()
    return _router


def reset_router() -> None:
    global _router
    _router = None


async def get_db_read() -> AsyncGenerator[AsyncSession, None]:
    router = get_router()
    async with router.get_read_session() as session:
        yield session


async def get_db_write() -> AsyncGenerator[AsyncSession, None]:
    router = get_router()
    async with router.get_write_session() as session:
        yield session

