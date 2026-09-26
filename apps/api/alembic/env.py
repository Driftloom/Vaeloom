import asyncio
import os
from logging.config import fileConfig
from pathlib import Path

try:
    from dotenv import load_dotenv

    # Look for .env in current directory or app root
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        load_dotenv()
except Exception:
    pass

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from api.database import Base
from api.models import *  # noqa: F403 — ensure all models are loaded

config = context.config
if config.config_file_name is not None:
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
        or config.get_main_option("sqlalchemy.url")
    )
    if url and url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url and "sslmode=" in url:
        url = url.replace("sslmode=", "ssl=")
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
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
