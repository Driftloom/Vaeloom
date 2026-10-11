import asyncio
import os
from logging.config import fileConfig
from pathlib import Path

try:
    from dotenv import load_dotenv

    # Look for .env in current directory or app root, never overriding explicit shell variables
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=False)
    else:
        load_dotenv(override=False)
except Exception:
    pass

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from api.database import Base
from api.models import *  # noqa: F403 — ensure all models are loaded

config = getattr(context, "config", None)
if config is not None and config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_database_url() -> str:
    """Resolve the DDL target.

    Order matters and was previously wrong: `DATABASE_URL` was consulted before
    `DATABASE__URL`, so the single-underscore alias won over the canonical name.
    Both are set in the checked-in-but-ignored `.env` files, which meant an
    operator who exported `DATABASE__URL=sqlite+aiosqlite:///./local.db` to keep
    migrations off a shared instance still had Alembic connect to the managed
    PostgreSQL from the `.env` alias. Migrations are DDL, so that is a
    write to someone else's database.

    `DATABASE__URL` is the field name Pydantic actually uses, so it is checked
    first. `VAELOOM_TARGET_URL` stays ahead of both: it is the deliberate
    override for the owner/migrator role (OP-RLS-01) and callers set it
    explicitly when they mean it.
    """
    url = (
        os.environ.get("VAELOOM_TARGET_URL")
        or os.environ.get("DATABASE__URL")
        or os.environ.get("DATABASE_URL")
        or (config.get_main_option("sqlalchemy.url") if config else None)
    )
    if url and url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url and "sslmode=" in url:
        url = url.replace("sslmode=", "ssl=")

    from urllib.parse import urlparse

    parsed = urlparse(url or "")
    db_name = parsed.path.rstrip("/").rsplit("/", 1)[-1]
    hostname = (parsed.hostname or "").lower()

    if os.environ.get("VAELOOM_VERIFY_ACTIVE") == "1":
        if not db_name.endswith(("_proof", "_test")):
            raise RuntimeError(
                f"REFUSED BY ALEMBIC: VAELOOM_VERIFY_ACTIVE=1 but target database "
                f"'{db_name}' does not end with _proof or _test."
            )
        if hostname not in ("127.0.0.1", "localhost", ""):
            raise RuntimeError(
                f"REFUSED BY ALEMBIC: VAELOOM_VERIFY_ACTIVE=1 but target hostname "
                f"'{hostname}' is not a local address."
            )
    else:
        # Enterprise Safety Guard: Block accidental migration of remote cloud databases
        # from a local developer machine unless explicitly authorized.
        if hostname not in ("127.0.0.1", "localhost", ""):
            allow_remote = os.environ.get("ALLOW_REMOTE_DDL", "").lower() in ("1", "true", "yes")
            is_ci = os.environ.get("CI", "").lower() in ("1", "true", "yes")
            if not allow_remote and not is_ci:
                raise RuntimeError(
                    f"REFUSED BY ALEMBIC: Target database URL points to remote host '{hostname}'. "
                    "Running Alembic migrations against a remote/cloud database from a local machine is "
                    "blocked by default to prevent accidental data modification. "
                    "If you explicitly intend to migrate this remote database, set ALLOW_REMOTE_DDL=1."
                )
    return url




def run_migrations_offline() -> None:
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    db_url = get_database_url()
    print(f"ALEMBIC CONNECTING TO: {db_url}")
    if db_url:
        configuration["sqlalchemy.url"] = db_url
    connect_args = {}
    if db_url and "postgresql" in db_url:
        connect_args = {"statement_cache_size": 0, "prepared_statement_cache_size": 0}
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pool.submit(asyncio.run, run_async_migrations()).result()
    else:
        asyncio.run(run_async_migrations())


try:
    if context.is_offline_mode():
        run_migrations_offline()
    else:
        run_migrations_online()
except (NameError, AttributeError):
    pass
