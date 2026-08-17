from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings

engine = create_async_engine(
    settings.database__url,
    pool_pre_ping=True,
    pool_size=getattr(settings, "db_pool_size", 20),
    max_overflow=getattr(settings, "db_max_overflow", 10),
    echo=settings.service_environment == "local",
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            # Set RLS session variables for tenant isolation.
            # Uses SET LOCAL (transaction-scoped) for PgBouncer compatibility.
            # On SQLite, this is a no-op (RLS is disabled).
            try:
                from .middleware.tenant import set_rls_session_vars
                await set_rls_session_vars(session)
            except Exception:
                # SQLite or non-PostgreSQL — RLS not applicable
                pass
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
