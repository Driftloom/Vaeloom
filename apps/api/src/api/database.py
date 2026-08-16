from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings

engine = create_async_engine(
    settings.database__url,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=10,
    echo=settings.service_environment == "local",
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            # CRITICAL: Set RLS session variables for tenant isolation
            # This bridges the TenantMiddleware context to PostgreSQL RLS policies
            try:
                from .middleware.tenant import TenantContext, set_rls_session_vars
                await set_rls_session_vars(session)
            except Exception:
                pass  # SQLite or non-PostgreSQL — RLS not applicable
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
