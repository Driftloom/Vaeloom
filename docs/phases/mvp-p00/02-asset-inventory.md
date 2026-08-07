# MVP-P00 — 02. Asset and Access Inventory

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Baseline:** repo
> `master` @ `bea5fe8c381d435f89352a51c61c0e9fc87b232a` (ahead 4) **Status:**
> INVENTORY COMPLETE (on-disk evidence 2026-08-06); access/owners partially
> `TO_BE_VERIFIED` **Register root:** `docs/phases/mvp-p00/`

## 1. Repository snapshot

| Item                     | Value                                                                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                   | `master` (tracks `origin/master`, **ahead 4** — 4 unpushed commits)                                                                                                                           |
| HEAD                     | `bea5fe8c381d435f89352a51c61c0e9fc87b232a`                                                                                                                                                    |
| Recent history           | S12–S15 docs restructure; S11 Docs→docs; S3–S10 dir consolidation; CI/CD + ops + compliance; web e2e/components; backend middleware/services/agents + 150+ tests                              |
| Workspace                | pnpm 9.x monorepo; Nx 20 (nx.json); `pnpm-workspace.yaml` covers apps/_, packages/_, sdk/_, integrations/_, connectors/_, plugins/_, infra/_, scripts/_, testing/*                            |
| Stack (verified in code) | Next.js 15 (web), FastAPI (backend, Python ≥3.12, tested on 3.14.6), SQLAlchemy async, PostgreSQL/pgvector (mocked to SQLite in tests), Redis, Alembic, OpenTelemetry (import-broken locally) |

## 2. Asset inventory (on-disk, excluding node_modules/build artifacts)

### 2.1 apps

| Asset          | Files                                                        | Purpose                                                                                                                                                                                                                                                                     | Status                                                        |
| -------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/web`     | ~489 (app, components, hooks, i18n, lib, store, styles, e2e) | Next.js 15 frontend; 23 route dirs under `src/app/workspace/[workspaceId]/` (chat, memory, resume, jobs, schedule, files, connectors, applications, settings, admin, billing, marketplace, organizations, developer, history, notifications, feature-flags, status, (auth)) | IMPLEMENTED_UNVERIFIED (unit tests failing; e2e not runnable) |
| `apps/backend` | 202 `.py` source (src/backend), 124 test files               | FastAPI: agents (23 dirs), orchestrator (base/loop/router/state), memory (agent + services + versioning), ingestion, models, schemas, routers (24), services (42), middleware (10), tools, workers, prompts, infrastructure, alembic (2 migrations)                         | IMPLEMENTED (2193 tests pass; 47 env-caused fails)            |

### 2.2 packages (9)

| Package                                       | Purpose                               |
| --------------------------------------------- | ------------------------------------- |
| `packages/shared-types`                       | Cross-app TS DTOs/contracts           |
| `packages/ui-kit`                             | Shared React components/design system |
| `packages/eslint-config`, `packages/tsconfig` | Lint/TS standards                     |
| `packages/python-common`                      | Python shared lib                     |
| `packages/observability`                      | Telemetry/observability helpers       |
| `packages/queue`                              | Queue abstractions                    |
| `packages/service-auth`                       | Auth service shared                   |
| `packages/plugin-sdk`                         | Plugin SDK                            |

### 2.3 connectors / integrations / plugins / sdk

| Area            | Items                                                                         | Status                                  |
| --------------- | ----------------------------------------------------------------------------- | --------------------------------------- |
| `connectors/`   | graphql, mcp, rest (each with connector + tests + Dockerfile)                 | IMPLEMENTED_UNVERIFIED (has unit tests) |
| `integrations/` | calendar, email, github, google-drive, notion, slack                          | IMPLEMENTED_UNVERIFIED                  |
| `plugins/`      | community, official                                                           | IMPLEMENTED_UNVERIFIED                  |
| `sdk/`          | TypeScript client (client.ts, types.ts) + Python client (setup.py, client.py) | IMPLEMENTED_UNVERIFIED                  |

### 2.4 infra (12 subdirs)

`database`, `docker`, `events`, `kubernetes`, `logging`, `migrations`,
`monitoring`, `ops`, `scripts`, `security`, `telemetry`, `terraform` — 151
files. Includes pgbouncer, load-testing, deployment/DR runbooks, compliance
docs.

### 2.5 testing (10 subdirs)

`accessibility`, `chaos`, `e2e`, `fuzz`, `integration`, `performance`,
`security`, `smoke`, `unit`, `visual-regression` — Playwright config, k6 load
tests, audit scripts.

### 2.6 CI/CD — `.github/workflows` (11)

`ci.yml` (140 lines), `ci-backend.yml`, `ci-frontend.yml`, `ci-integration.yml`,
`deploy.yml` (194), `deploy-staging.yml`, `docker-build.yml`,
`security-audit.yml` (138), `security-scan.yml` (108), `a11y-audit.yml`,
`docs-validate.yml`.

### 2.7 docs corpus

| Corpus                               | Count                                                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/` tree                         | 295 `.md` files; 20 ADRs (`docs/adr/`); canonical 01–06 at root; gap/completion reports at root                                                                                  |
| `docs/agents/mvp/agent-inventory.md` | Agent inventory (unverified vs repo)                                                                                                                                             |
| Downloads corpus (outside repo)      | `vaeloom-mvp-e2e.md`, `vaeloom-mvp-e2e-enterprise-hardened.md`, `vaeloom-enterprise-e2e.md`, `vaeloom-mvp-phase-prompts.md`, 66-prompt pack, 3-track gatekeeper deliverables zip |

### 2.8 Environments / secrets / data

| Item                                                                                      | Status                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env` + `.env.example` + `.env.production.template` at root; `apps/backend/.env.example` | PRESENT — contents NOT verified (secrets policy); must confirm via `DATABASE__URL` double-underscore scheme (Pydantic does NOT read `.env` by default) |
| `dev.db` (SQLite) at root                                                                 | PRESENT — dev artifact; runtime evidence only for local tests                                                                                          |
| Postgres/Redis/object storage (prod)                                                      | NOT_PROVISIONED / access UNKNOWN — BQ-02 blocker                                                                                                       |
| Gmail/LLM provider credentials                                                            | UNKNOWN — BQ-02/03                                                                                                                                     |

## 3. Owner / access matrix

| Asset                                  | Owner             | Access           | Access verified?                                              |
| -------------------------------------- | ----------------- | ---------------- | ------------------------------------------------------------- |
| Repo (master)                          | Engineering       | Read-write local | YES (local evidence)                                          |
| `.env` secrets                         | Security/Platform | Restricted       | NO — TO_BE_VERIFIED                                           |
| Deploy targets (staging/prod)          | Platform/Release  | UNKNOWN          | NO — BLOCKING for GO                                          |
| External APIs (Gmail, LLM, job boards) | Integration/AI    | UNKNOWN          | NO — BLOCKING for GO                                          |
| Database production                    | Platform          | UNKNOWN          | NO — BLOCKING for GO                                          |
| Design system / `.pen` files           | Design            | Pencil MCP       | Workspace has no .pen at P00 — NOT_APPLICABLE (verify in P09) |

## 4. Findings from inventory

1. **Prompt skeleton ≠ repo reality** (CF-01): expected dirs `apps/core-api`,
   `apps/ai-service`, `packages/contracts`, `packages/design-system` do not
   exist. Use actual repo layout; do not rename anything without approved
   change.
2. **Enterprise features present in repo** (CF-05/06): billing, marketplace,
   admin, webhooks, SSO/SAML/SCIM services, enterprise agents — all outside MVP
   scope. MVP build must keep them disabled/unshipable.
3. **Ahead-4 unpushed commits** — baseline must be pushed or documented before
   P01 to make evidence reproducible.
4. **No prior phase-gate artifacts exist** in repo (no
   registers/scorecards/handoffs) — P00 is first gate artifact set.
5. **Docs corpus is mature (256+ docs, 20 ADRs) but documentation ≠ runtime** —
   maturity matrix in 03 separates the two.

## 5. Evidence commands

```text
git status --short --branch ; git rev-parse HEAD ; git log -n 10 --oneline
# inventory: Get-ChildItem apps, packages, infra, testing, connectors, integrations, plugins, sdk, docs
# counts: 202 backend .py, 124 test files, 489 web files, 295 docs, 11 workflows, 20 ADRs
```
