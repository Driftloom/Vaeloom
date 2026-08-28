# MVP-P00 — 02. Asset and Access Inventory

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Baseline:** P00
> evidence pinned at repo `master` @ `3ad6bca68ca827050cb0e1c4c323f2ba4fee88ac`;
> **repo HEAD now `2f12d944d5e8247763ad0af7711134d4403b3f06` (2026-08-16, in
> sync with origin 0/0)** — P01–P05 committed since; **UNCOMMITTED P06/P07 work
> present** (see §4 finding 7). **Status:** INVENTORY COMPLETE (on-disk evidence
> re-verified 2026-08-12, **counts re-audited 2026-08-16**); access/owners
> partially `TO_BE_VERIFIED` **Register root:** `docs/phases/mvp-p00/`

## 1. Repository snapshot

| Item | Value |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch | `master` (tracks `origin/master`, **0 ahead / 0 behind** — pushed; verified 2026-08-16) |
| HEAD (2026-08-16) | `2f12d944d5e8247763ad0af7711134d4403b3f06` — **moved past P00 pin `3ad6bca`** (P01–P05 landed) |
| P00 evidence pin | `3ad6bca68ca827050cb0e1c4c323f2ba4fee88ac` (`fix(web,e2e): harden login/sidebar flows + stabilize e2e suite (39/39)`) — historical, reproducible |
| Recent history | P05 amend `735f431` → P05 close `e48f547` → P06 docs `2f12d94`; P11 batch 2 (`929e659` gmail watch + draft-only API); e2e hardening (`3ad6bca` — 39/39); 66-prompt pack placement + pristine restore (`f7b03fc`, `d09fa07`) |
| Workspace | pnpm 9.x monorepo; Nx 20 (nx.json); `pnpm-workspace.yaml` covers apps/_, packages/_, sdk/_, integrations/_, connectors/_, plugins/_, infra/_, scripts/_, testing/* |
| Stack (verified in code) | Next.js 15 (web), FastAPI (backend, Python ≥3.12, tested on 3.14.6), SQLAlchemy async, PostgreSQL/pgvector (mocked to SQLite in tests), Redis, Alembic, OpenTelemetry (OTEL disabled in tests) |

## 2. Asset inventory (on-disk, excluding node_modules/build artifacts)

### 2.1 apps

| Asset | Files | Purpose | Status |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `apps/web` | 89 TypeScript source files (src/app 23 pages, components, hooks, i18n, lib, store, styles, e2e) | Next.js 15 frontend; 23 page routes under `src/app/workspace/[workspaceId]/` | IMPLEMENTED_WITH_EVIDENCE (jest 37/37, e2e 39/39) |
| `apps/api` | **220 Python source files** (apps/api/); **130 test files** | FastAPI: 21 agents + orchestrator, 30 DB models, 26 routers, 49 services, 12 middleware, SQLAlchemy + Alembic, 11 GitHub Actions workflows | IMPLEMENTED_WITH_EVIDENCE (2333 pass / 0 fail / 2 xfailed) |

### 2.2 packages (9)

| Package | Purpose |
| --------------------------------------------- | ------------------------------------- |
| `packages/shared-types` | Cross-app TS DTOs/contracts |
| `packages/ui-kit` | Shared React components/design system |
| `packages/eslint-config`, `packages/tsconfig` | Lint/TS standards |
| `packages/python-common` | Python shared lib |
| `packages/observability` | Telemetry/observability helpers |
| `packages/queue` | Queue abstractions |
| `packages/service-auth` | Auth service shared |
| `packages/plugin-sdk` | Plugin SDK |

### 2.3 connectors (3) / integrations (6) / plugins (5) / sdk (3)

| Area | Items | Status |
| --------------- | ------------------------------------------------------------------------ | ---------------------- |
| `connectors/` | graphql, mcp, rest (3 connectors) | IMPLEMENTED_UNVERIFIED |
| `integrations/` | calendar, email, github, google-drive, notion, slack (6 integrations) | IMPLEMENTED_UNVERIFIED |
| `plugins/` | tag-generator, word-count, sentiment, summarizer, translator (5 plugins) | IMPLEMENTED_UNVERIFIED |
| `sdk/` | typescript, python + plugin-sdk (3 SDKs) | IMPLEMENTED_UNVERIFIED |

### 2.4 infra (12 subdirs)

`database`, `docker`, `events`, `kubernetes`, `logging`, `migrations`,
`monitoring`, `ops`, `scripts`, `security`, `telemetry`, `terraform` — 151
files. Includes pgbouncer, load-testing, deployment/DR runbooks, compliance
docs.

- **12 Terraform modules** in `infra/terraform/`
- **21 Kubernetes app manifests** in `infra/kubernetes/`

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

| Corpus | Count |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/` tree | **574** `.md` files (2026-08-16; was 492 at 2026-08-12 — P01–P05/06/07 docs added); **26 ADRs** (`docs/adr/`, was 20 — ADR-021…026); canonical 01–06 at root; gap/completion reports at root |
| `docs/agents/mvp/agent-inventory.md` | Agent inventory (unverified vs repo) |
| Downloads corpus (outside repo) | `vaeloom-mvp-e2e.md`, `vaeloom-mvp-e2e-enterprise-hardened.md`, `vaeloom-enterprise-e2e.md`, `vaeloom-mvp-phase-prompts.md`, 66-prompt pack, 3-track gatekeeper deliverables zip |

### 2.8 Environments / secrets / data

| Item | Status |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env` + `.env.example` + `.env.production.template` at root; `apps/api/.env.example` | PRESENT — contents NOT verified (secrets policy); must confirm via `DATABASE__URL` double-underscore scheme (Pydantic does NOT read `.env` by default) |
| `dev.db` (SQLite) at root | PRESENT — dev artifact; runtime evidence only for local tests |
| Postgres/Redis/object storage (prod) | NOT_PROVISIONED / access UNKNOWN — BQ-02 blocker |
| Gmail/LLM provider credentials | UNKNOWN — BQ-02/03 |

## 3. Owner / access matrix

| Asset | Owner | Access | Access verified? |
| -------------------------------------- | ----------------- | ---------------- | ------------------------------------------------------------- |
| Repo (master) | Engineering | Read-write local | YES (local evidence) |
| `.env` secrets | Security/Platform | Restricted | NO — TO_BE_VERIFIED |
| Deploy targets (staging/prod) | Platform/Release | UNKNOWN | NO — BLOCKING for GO |
| External APIs (Gmail, LLM, job boards) | Integration/AI | UNKNOWN | NO — BLOCKING for GO |
| Database production | Platform | UNKNOWN | NO — BLOCKING for GO |
| Design system / `.pen` files | Design | Pencil MCP | Workspace has no .pen at P00 — NOT_APPLICABLE (verify in P09) |

## 4. Findings from inventory

1. **Prompt skeleton ≠ repo reality** (CF-01): expected dirs `apps/core-api`,
 `apps/ai-service`, `packages/contracts`, `packages/design-system` do not
 exist. Use actual repo layout; do not rename anything without approved
 change.
2. **Enterprise features present in repo** (CF-05/06): billing, marketplace,
 admin, webhooks, SSO/SAML/SCIM services, enterprise agents — all outside MVP
 scope. MVP build must keep them disabled/unshipable.
3. **Baseline in sync** — `master` @ `3ad6bca` pushed to origin (0/0,
 2026-08-12); evidence reproducible.
4. **No prior phase-gate artifacts existed** before P00; the P00 set is the
 first gate artifact set (01–09).
5. **Docs corpus is mature (574 docs, 26 ADRs) but documentation ≠ runtime** —
 maturity matrix in 03 separates the two.
6. **Coverage honesty** — fresh `--cov` run measures **94%** total (641 missing
 lines); lowest: `webhook_service` 64%, `middleware/tenant` 68%,
 `admin_console` 72%, `sso` 74%, `retention` 79% (see 03 §2.3; RISK-P00-13).
7. **Baseline drift + uncommitted work (2026-08-16)** — P00 evidence pins
 `3ad6bca`; the repo has since advanced (HEAD `2f12d94`, P01–P05) and the
 working tree contains UNCOMMITTED P06/P07 changes: alembic migrations
 `0003_approval_tables`–`0006_provenance`, services
 `erasure_service`/`export_service`/`provenance_service`, schema.py
 consent/retention/provenance fields, `main.py`/`tenant.py` edits,
 `scripts/backup.sh`/`restore.sh`/`verify_backup.sh`. These are P06/P07-owned
 and outside P00's change scope; P00's pinned evidence remains reproducible at
 `3ad6bca`.

## 5. Evidence commands

```text
git status --short --branch ; git rev-parse HEAD ; git log -n 10 --oneline
# inventory: Get-ChildItem apps, packages, infra, testing, connectors, integrations, plugins, sdk, docs
# counts (2026-08-16): 220 backend src .py, 89 TypeScript src, 130 test files,
#   574 docs, 26 ADRs, 26 routers, 49 services, 12 middleware, 30 DB models,
#   21 agents + orchestrator, 11 workflows, 12 terraform modules, 21 k8s manifests
```
