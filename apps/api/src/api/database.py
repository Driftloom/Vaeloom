from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import settings

connect_args = {}
if "postgresql" in settings.database__url:
    connect_args = {"statement_cache_size": 0, "prepared_statement_cache_size": 0}

engine = create_async_engine(
    settings.database__url,
    pool_pre_ping=True,
    pool_size=getattr(settings, "db_pool_size", 20),
    max_overflow=getattr(settings, "db_max_overflow", 10),
    echo=settings.service_environment == "local",
    connect_args=connect_args,
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


def _migration_url() -> str | None:
    """Owner/migrator URL for DDL + boot migrations (OP-RLS-01).

    Explicit config only (DATABASE_MIGRATION__URL, else VAELOOM_TARGET_URL —
    the same variable the alembic CLI prefers); never derived from the
    runtime URL, so a least-privilege runtime cannot escalate itself.
    """
    import os as _os

    url = (getattr(settings, "database_migration__url", "") or "").strip()
    if not url:
        url = (_os.environ.get("VAELOOM_TARGET_URL", "") or "").strip()
    return url or None


_migration_engine: AsyncEngine | None = None


def get_migration_engine() -> AsyncEngine | None:
    """Engine bound to the owner URL, or None when unconfigured.

    Callers MUST fail closed when they require DDL/privileged access and this
    returns None (never silently fall back to the runtime engine for DDL).
    """
    global _migration_engine
    url = _migration_url()
    if not url:
        return None
    if _migration_engine is None:
        args: dict = {}
        if "postgresql" in url:
            args = {"statement_cache_size": 0, "prepared_statement_cache_size": 0}
        _migration_engine = create_async_engine(
            url, pool_pre_ping=True, pool_size=2, max_overflow=2, connect_args=args
        )
    return _migration_engine


async def check_runtime_role() -> dict:
    """OP-RLS-01 startup guard: report the runtime role's BYPASSRLS state.

    Returns {"role": ..., "bypassrls": bool|None}. bypassrls None = not PG
    (SQLite etc. — RLS n/a). Callers decide fail-fast vs warn by environment.
    """
    if "postgresql" not in settings.database__url:
        return {"role": "n/a (non-PG)", "bypassrls": None}
    async with engine.connect() as conn:
        row = await conn.execute(
            text(
                "SELECT current_user AS role, "
                "(SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass"
            )
        )
        r = row.first()
        return {"role": str(r[0]), "bypassrls": None if r[1] is None else bool(r[1])}


def _session_dialect(session) -> str:
    """Detect the live dialect of a session (OP-RLS-01).

    MUST NOT use global settings: sessions may come from test/override
    factories bound to a different backend (e.g. SQLite) than the configured
    runtime URL. PG-only statements (set_config, definer fns) run only on PG.
    """
    for getter in (
        lambda: getattr(getattr(session, "bind", None), "dialect", None),
        lambda: getattr(session.get_bind(), "dialect", None),
    ):
        try:
            dialect = getter()
            name = getattr(dialect, "name", None)
            if name:
                return str(name)
        except Exception:
            continue
    url = getattr(settings, "database__url", "") or ""
    return "postgresql" if "postgresql" in url else "sqlite"


@asynccontextmanager
async def scoped_session(
    workspace_id: str | None = None,
    tenant_id: str | None = None,
    user_id: str | None = None,
    *,
    require: bool = True,
) -> AsyncGenerator[AsyncSession, None]:
    """Worker/background session with explicit RLS context (OP-RLS-01).

    Request paths use get_db() (context comes from TenantMiddleware). Worker
    paths (Temporal activities, queue consumers, daemons, background loop
    tasks) MUST use this helper with payload-derived scope instead of the raw
    factory, otherwise RLS default-deny yields zero rows (or worse, relied on
    the old bypass role).

    Tenant resolution: explicit tenant_id wins; else resolved from
    workspace_id via the SECURITY DEFINER app_tenant_for_workspace() (PG).
    On SQLite this is a plain session (RLS n/a).

    require=True (default): failure to establish GUCs on PostgreSQL raises
    (fail closed). require=False: warn + yield (request-path behavior).
    """
    from .middleware.tenant import TenantContext

    async with async_session_factory() as session:
        try:
            if _session_dialect(session) == "postgresql":
                tid = tenant_id or TenantContext.get_tenant_id()
                wid = workspace_id or TenantContext.get_workspace_id()
                uid = user_id or TenantContext.get_user_id()
                if wid and not tid:
                    try:
                        tid = await session.scalar(
                            text("SELECT app_tenant_for_workspace(:ws)"),
                            {"ws": str(wid)},
                        )
                        tid = str(tid) if tid else None
                    except Exception:
                        tid = None
                if tid:
                    await session.execute(
                        text("SELECT set_config('app.tenant_id', :v, true)"),
                        {"v": str(tid)},
                    )
                if wid:
                    await session.execute(
                        text("SELECT set_config('app.workspace_id', :v, true)"),
                        {"v": str(wid)},
                    )
                if uid:
                    await session.execute(
                        text("SELECT set_config('app.user_id', :v, true)"),
                        {"v": str(uid)},
                    )
                if require and not tid and not wid:
                    raise RuntimeError(
                        "scoped_session: no tenant/workspace scope could be "
                        "established on PostgreSQL (fail closed)"
                    )
            yield session
            await session.commit()
        except Exception:
            try:
                await session.rollback()
            except Exception:
                pass
            raise
        finally:
            try:
                await session.close()
            except Exception:
                pass


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
