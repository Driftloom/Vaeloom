# Finding 04 — Makefile Phantom References

**Verified:** `Makefile`, `package.json` (grep), actual directory listings
**Date:** 2026-08-16

## Problem 1: 18 Phantom Microservices

`Makefile:94-105` — `services-dev` target references packages that don't exist:

```makefile
services-dev:
	pnpm --filter @vaeloom/memory-store --filter @vaeloom/auth-service \
	  --filter @vaeloom/knowledge-graph --filter @vaeloom/event-bus \
	  --filter @vaeloom/search-service --filter @vaeloom/agent-engine \
	  --filter @vaeloom/analytics-service --filter @vaeloom/audit-service \
	  --filter @vaeloom/billing-service --filter @vaeloom/connector-service \
	  --filter @vaeloom/document-ingestion --filter @vaeloom/iam-service \
	  --filter @vaeloom/integration-service --filter @vaeloom/job-scheduler \
	  --filter @vaeloom/notification-service --filter @vaeloom/plugin-service \
	  --filter @vaeloom/rbac-service --filter @vaeloom/recommendation-service \
	  dev &
```

**Actual packages in `packages/`:**

```
eslint-config, observability, plugin-sdk, python-common,
queue, service-auth, shared-types, tsconfig, ui-kit
```

**Actual integrations in `integrations/`:**

```
calendar, email, github, google-drive, notion, slack
```

**Actual connectors in `connectors/`:**

```
graphql, mcp, rest
```

**None of the 18 filtered packages exist.** The `services-lint` and
`services-test` targets have the same issue.

## Problem 2: Prisma References (Actual tool: Alembic)

`Makefile:70-80` — 4 targets reference Prisma:

| Target       | Command                                                        | Actual tool |
| ------------ | -------------------------------------------------------------- | ----------- |
| `db-migrate` | `pnpm --filter @vaeloom/api exec prisma migrate dev`           | Alembic     |
| `db-studio`  | `pnpm --filter @vaeloom/api exec prisma studio`                | N/A         |
| `db-seed`    | `pnpm --filter @vaeloom/api exec prisma db seed`               | N/A         |
| `db-reset`   | `pnpm --filter @vaeloom/api exec prisma migrate reset --force` | Alembic     |

**Verification:**

- No `schema.prisma` file exists anywhere in the repo
- `apps/api/alembic.ini` exists — configures Alembic with SQLAlchemy
- `apps/api/src/api/migrations/` has 7 migration files (0002-0007) using
  SQLAlchemy
- `apps/api/src/api/database.py` uses `create_async_engine` (SQLAlchemy async)
- `apps/api/package.json` has no Prisma dependency (grep found nothing)

## Problem 3: Docker Compose Filter References

`Makefile:63-67` — `docker-up-service` and `docker-logs` reference `$(S)`
parameter with no validation. A user could pass any service name.

## Actual Makefile Targets That Work

| Target                    | Command                                        | Works?                     |
| ------------------------- | ---------------------------------------------- | -------------------------- |
| `dev`                     | `pnpm dev`                                     | No — hangs (see AGENTS.md) |
| `dev-web`                 | `cd apps/web && pnpm next dev`                 | ✓                          |
| `dev-be`                  | `cd apps/api && uvicorn api.main:app --reload` | ✓                          |
| `install-fast`            | `pnpm install --no-frozen-lockfile`            | ✓                          |
| `build`                   | `pnpm build`                                   | ✓                          |
| `test`                    | `pnpm test`                                    | ✓                          |
| `lint`                    | `pnpm lint`                                    | ✓                          |
| `typecheck`               | `pnpm typecheck`                               | ✓                          |
| `setup`                   | `pnpm install && pnpm build`                   | ✓                          |
| `clean`                   | `pnpm clean` + find/rm                         | ✓                          |
| `docker-up`               | `docker compose up -d`                         | ✓                          |
| `docker-down`             | `docker compose down`                          | ✓                          |
| `docker-build`            | `docker compose build`                         | ✓                          |
| `docker-up-core`          | `docker compose up -d postgres redis`          | ✓                          |
| `db-*`                    | Prisma commands                                | ✗ Prisma not installed     |
| `services-*`              | Filter phantom packages                        | ✗ Packages don't exist     |
| `format` / `format-check` | `pnpm format` / `pnpm format:check`            | ✓                          |
| `hooks-install`           | `git config core.hooksPath .husky`             | ✓                          |
