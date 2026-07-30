# ADR-006: SQLAlchemy Async for Database Access

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom's backend uses async Python throughout (FastAPI + asyncio). The database access layer must support asynchronous connection pooling, concurrent query execution without blocking the event loop, and work with both PostgreSQL (production) and SQLite (testing). Alembic must handle migrations for both sync and async contexts.

Options considered: SQLAlchemy 2.0 async, asyncpg directly, psycopg3 async, Datasette, GINO.

## Decision

Use **SQLAlchemy 2.0 async** with `asyncpg` driver for PostgreSQL.

Configuration:
- `create_async_engine` with connection pool (`pool_size=20`, `max_overflow=10`)
- `async_sessionmaker` for session factory
- `AsyncSession` dependency with auto-commit on success, rollback on exception
- `DeclarativeBase` with full type annotations (`Mapped`, `mapped_column`)
- Alembic migrations run via async-compatible `run_async` helper

## Consequences

**Positive:**
- Fully async database operations never block the event loop during agent execution
- Type-annotated models with `Mapped` provide IDE autocompletion and mypy validation
- Connection pooling with `pool_pre_ping=True` ensures stale connections are discarded
- SQLite async via `aiosqlite` in tests provides fast, isolated test runs without PostgreSQL dependency
- Alembic handles schema migrations with the same model definitions — no sync/async mismatch

**Negative:**
- Reload patterns (`db.refresh()`, `db.flush()`) differ slightly from sync SQLAlchemy — team must learn async variants
- `AsyncSession` does not support lazy loading outside of an active session (requires `selectinload` or `joinedload` explicitly)
- Some advanced PostgreSQL features (LISTEN/NOTIFY, advisory locks) require raw `asyncpg` access via `connection.exec_driver_sql`
- Connection pool sizing must be tuned per deployment; default 20 may be too high for small instances
