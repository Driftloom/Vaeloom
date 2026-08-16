# ADR-015: Alembic for Database Migrations

| Metadata     | Value            |
| ------------ | ---------------- |
| **Status**   | Accepted         |
| **Date**     | 2026-07-22       |
| **Deciders** | Engineering Team |

## Context

The Vaeloom database schema evolves rapidly with 25+ models (users, tenants,
workspaces, agents, memories, knowledge graph nodes/edges, documents,
integrations, connectors, plugins, audit events, etc.). Migrations must be
versioned, reversible, and work with async SQLAlchemy and both PostgreSQL and
SQLite.

Options considered: Alembic, Django migrations, manual SQL scripts, SQLAlchemy
`create_all` only.

## Decision

Use **Alembic** for database migration management.

Configuration:

- Single `alembic.ini` at `apps/api/` with `sqlalchemy.url` from environment
- Auto-generation via `alembic revision --autogenerate -m "description"`
- Async-compatible migration runner for PostgreSQL target
- `Base.metadata.create_all` on startup handles fresh database initialization in
  development
- Migrations run before application startup in Docker
  (`CMD ["sh", "-c", "alembic upgrade head && uvicorn ..."]`)
- Rollback via `alembic downgrade -1` with manual verification for destructive
  changes

## Consequences

**Positive:**

- Auto-generated migrations reduce human error in schema changes
- Versioned migration chain enables deterministic database state across
  environments
- `alembic upgrade head` in Docker entrypoint ensures zero-downtime schema
  deployment
- Compatibility with both PostgreSQL (production) and SQLite (test) via
  dialect-aware migration generation
- `--autogenerate` detects column additions, removals, type changes, index
  changes, and constraint changes

**Negative:**

- Auto-generated migrations still require manual review — index-only changes,
  data migrations, and complex DDL need hand-editing
- Rollback of destructive changes (column drops, table drops) loses data —
  requires backup restore for recovery
- Migration conflicts arise when multiple developers generate migrations from
  the same schema version
- Async migration runner adds complexity compared to Alembic's default
  synchronous mode
