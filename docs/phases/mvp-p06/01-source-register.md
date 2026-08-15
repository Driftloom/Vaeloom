# MVP-P06 — 01. Source Register (Re-Run 2026-08-15)

> Prompt §4 + §15. Live inspection evidence outranks design prose. All sources
> verified at phase start 2026-08-15. Baseline: `master` @ `e48f547`. Prior run
> (2026-08-07) preserved as `*-2026-08-07.md`.

## 1. Internal sources (INT)

| ID     | Source                                   | Use                                 | Status    |
| ------ | ---------------------------------------- | ----------------------------------- | --------- |
| INT-01 | Gatekeeper compendium                    | Governing 32-section contract       | Available |
| INT-02 | `vaeloom-mvp-e2e-enterprise-hardened.md` | Authoritative corrections/hardening | Available |
| INT-03 | `vaeloom-mvp-e2e.md`                     | MVP execution baseline              | Available |
| INT-05 | `docs/01-vaeloom-mvp-spec.md`            | Canonical MVP scope                 | Available |
| INT-07 | `docs/02-system-architecture.md`         | Architecture intent                 | Available |
| INT-08 | `docs/03-agent-workflow.md`              | Agent/approval flow intent          | Available |
| INT-09 | `docs/04-memory-knowledge-graph.md`      | Memory/RAG intent                   | Available |
| REPO   | `master` @ `e48f547`                     | Implementation truth (zero trust)   | Available |

Authority order: REPO reality > INT-02 > gatekeeper > INT-05 > INT-07/08/09.

## 2. External standards (EXT) — re-verified 2026-08-15

| ID     | Standard                             | Snapshot   | Applicability                 |
| ------ | ------------------------------------ | ---------- | ----------------------------- |
| EXT-01 | MCP Spec                             | 2026-07-28 | APPLICABLE — connectors/mcp   |
| EXT-02 | OWASP Agentic Top 10                 | 2026       | APPLICABLE — mapped P05 §06   |
| EXT-03 | OWASP LLM Top 10                     | 2026       | APPLICABLE — mapped P05 §06   |
| EXT-04 | NIST AI RMF + GenAI                  | current    | APPLICABLE                    |
| EXT-05 | WCAG 2.2                             | W3C Rec    | APPLICABLE — P09              |
| EXT-06 | RFC 9700 OAuth BCP                   | IETF       | APPLICABLE — P08 (NFR-16)     |
| EXT-07 | RFC 9728 Protected Resource Metadata | IETF       | APPLICABLE — P08              |
| EXT-08 | OpenAPI 3.2.0                        | current    | APPLICABLE — pin at P08       |
| EXT-09 | OpenTelemetry                        | latest     | APPLICABLE — repo has OTel    |
| EXT-10 | SLSA v1.2                            | current    | DEFER — P16/P19               |
| EXT-11 | NIST SSDF 800-218                    | v1.1       | APPLICABLE — P06/P13          |
| EXT-12 | Gmail API push/quotas                | current    | APPLICABLE — polling-first    |
| EXT-13 | GitHub App Permissions               | current    | APPLICABLE — least privilege  |
| EXT-14 | GDPR                                 | EU         | NOT_APPLICABLE (India launch) |
| EXT-15 | EU AI Act                            | EU         | NOT_APPLICABLE (India launch) |
| EXT-16 | DPDP Act + Rules 2025                | staged     | APPLICABLE — P13              |
| EXT-17 | FERPA/COPPA                          | US ED/FTC  | NOT_APPLICABLE (18+)          |

## 3. Conflict log (CF-P06-01..N)

| ID        | Conflict                                                        | Resolution                                                                                   | Authority       | Date       |
| --------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------- | ---------- |
| CF-P06-01 | Prompt §3 lists NestJS + `apps/core-api` + `apps/ai-service`    | Repo truth: single FastAPI + web; no NestJS app                                              | REPO > prompt   | 2026-08-15 |
| CF-P06-02 | "shadcn/ui" in ADR-009, developer docs                          | ui-kit = 5 hand-written Tailwind primitives                                                  | REPO inspection | 2026-08-15 |
| CF-P06-03 | "All 16 pages wired" in ADR-002                                 | 23 page routes; ~10 are static mockups                                                       | REPO inspection | 2026-08-15 |
| CF-P06-04 | Meilisearch claimed in search docs                              | Not installed; actual = SQL ILIKE                                                            | REPO inspection | 2026-08-15 |
| CF-P06-05 | BullMQ claimed in architecture docs                             | No consumers; worker not deployed                                                            | REPO inspection | 2026-08-15 |
| CF-P06-06 | "11 workflows (backend, frontend, docker, deploy, release)"     | No release workflow exists                                                                   | REPO inspection | 2026-08-15 |
| CF-P06-07 | "PostgreSQL as system of record with vector/graph projections"  | PG = intended in docker; SQLite in dev/tests; pgvector cols exist but no indexes; AGE unused | REPO inspection | 2026-08-15 |
| CF-P06-08 | Dual migration systems (alembic 0001-0002 vs runtime 0002-0007) | CF-P05-04 carried; single path at P07                                                        | REPO inspection | 2026-08-15 |

## 4. Zero-trust repo inventory (prompt §14) @ `e48f547`

### Backend

| Area       | Finding                                                                                                                                                                                                     | Evidence                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Framework  | FastAPI 0.115.14, Python >=3.12, SQLAlchemy 2.0.51, asyncpg 0.31, pydantic 2.13, alembic 1.19, redis 8.1, pgvector 0.5, boto3 1.43, OpenTelemetry 1.44, structlog, anthropic 0.121, openai 2.53 (raw httpx) | `pyproject.toml`, `uv.lock`        |
| Routers    | 30 `include_router` calls (22 unconditional + 8 enterprise-gated)                                                                                                                                           | `main.py:139-173`                  |
| Middleware | 11 middleware (auth, csrf, tenant, rate-limit, security-headers, correlation, logging, api-version, prompt-injection, idempotency, metrics)                                                                 | `main.py:93-114`                   |
| Tables     | 36 `__tablename__` entries                                                                                                                                                                                  | `models/schema.py`                 |
| Agents     | 22 agent handlers + 4 memory subagents + orchestrator module                                                                                                                                                | `agents/`                          |
| Migrations | DUAL: alembic (0001-0002) + runtime registry (0002-0007)                                                                                                                                                    | `alembic/versions/`, `migrations/` |
| Tests      | 130 test files, 2333 pass, 97% coverage, autouse mock_llm + mock_connector_test                                                                                                                             | `tests/`                           |

### Frontend

| Area       | Finding                                                  | Evidence                  |
| ---------- | -------------------------------------------------------- | ------------------------- |
| Framework  | Next.js 15.5.20, React 18.3.1, TS 5.9.3, Tailwind 3.4.19 | `apps/web/package.json`   |
| State      | SWR 2.4.2, Zustand 5.0.14                                | `apps/web/package.json`   |
| Pages      | 23 page.tsx files (~10 static mockups)                   | `apps/web/src/app/`       |
| API client | `api.ts` + `api-client.ts` with transformKeys            | `apps/web/src/lib/`       |
| UI kit     | 5 hand-written Tailwind primitives (NOT shadcn)          | `packages/ui-kit/src/`    |
| Testing    | Jest 29.7, Playwright 1.62.1, @axe-core/playwright 4.13  | `apps/web/jest.config.js` |

### Infrastructure

| Area         | Finding                                                  | Evidence                  |
| ------------ | -------------------------------------------------------- | ------------------------- |
| Compose dev  | postgres, redis, web, backend, minio, pgbouncer, pgadmin | `docker-compose.yml`      |
| Compose prod | nginx, web, backend, postgres, redis, pgbouncer, minio   | `docker-compose.prod.yml` |
| CI           | 11 workflows (no release)                                | `.github/workflows/`      |
| PaaS         | NONE (no fly.toml, vercel.json, render.yaml)             | grep                      |
| AWS          | Terraform + k8s = enterprise/out-of-MVP                  | `infra/`                  |

### Supply Chain

| Area       | Finding                                            | Evidence                 |
| ---------- | -------------------------------------------------- | ------------------------ |
| Dependabot | npm, docker, github-actions — NO pip               | `.github/dependabot.yml` |
| pnpm audit | `continue-on-error: true`                          | `security-audit.yml`     |
| pip-audit  | targets nonexistent `apps/ai-service`              | `security-audit.yml`     |
| SBOM       | anchore/sbom-action SPDX in security-scan + deploy | workflows                |
| cosign     | v2.2.4 keyless in deploy                           | `deploy.yml`             |
| gitleaks   | action in CI; no local config                      | workflows                |

### Tooling

| Area            | Finding                                      | Evidence                                |
| --------------- | -------------------------------------------- | --------------------------------------- |
| ESLint          | 8.57 legacy; no flat config                  | `packages/eslint-config/`               |
| Ruff            | config only in python-common; NOT in backend | `packages/python-common/pyproject.toml` |
| mypy            | config only in python-common; NOT in backend | `packages/python-common/pyproject.toml` |
| Prettier        | 3.2.x                                        | root devDeps                            |
| Vale            | Vaeloom custom + write-good                  | `.vale.ini`                             |
| .python-version | MISSING                                      | glob → none                             |

## 5. EVD base

| ID              | Claim                      | Requirement     | Type          | Location                   | Result | Date       |
| --------------- | -------------------------- | --------------- | ------------- | -------------------------- | ------ | ---------- |
| EVD-MVP-P06-001 | Backend version inventory  | MVP-P06-R01/R02 | REPO_VERIFIED | `01-source-register.md` §4 | PASS   | 2026-08-15 |
| EVD-MVP-P06-002 | Frontend version inventory | MVP-P06-R01/R02 | REPO_VERIFIED | `01-source-register.md` §4 | PASS   | 2026-08-15 |
| EVD-MVP-P06-003 | Infrastructure inventory   | MVP-P06-R01/R02 | REPO_VERIFIED | `01-source-register.md` §4 | PASS   | 2026-08-15 |
| EVD-MVP-P06-004 | Supply chain inventory     | MVP-P06-R03     | REPO_VERIFIED | `01-source-register.md` §4 | PASS   | 2026-08-15 |
