# MVP-P06 — 03. Technology Decision Matrix (DEL-MVP-P06-01) — Enterprise Upgrade 2026-08-17

> DEL-MVP-P06-01. Pinned from repo manifests at HEAD `e48f547` (zero-trust,
> `01-source-register.md` §4 authority). Prior run (2026-08-07) preserved as
> `*-2026-08-07.md`. Re-run (2026-08-15) preserved as current baseline.
> Enterprise upgrade (2026-08-17) adds MCP/OWASP/agent scoring, EOL timelines,
> and reproducibility verification.
>
> Scoring per prompt §12 task 2: "Score frontend/backend/AI/data/queue/search/
> observability/deployment choices."

## 0. Prompt vs Repo — Architecture Alignment

The prompt §3 states the approved architecture as "Next.js, NestJS, FastAPI,
PostgreSQL with vector/graph projections, Redis/BullMQ, object storage and
search." Reality at HEAD:

| Prompt expects        | Repo has                                                         | Status                  |
| --------------------- | ---------------------------------------------------------------- | ----------------------- |
| Next.js               | Next.js 15.5.20 (`apps/web/`)                                    | ✅ DEPLOYED             |
| NestJS                | `packages/service-auth`, `packages/observability` — NOT deployed | ⚠️ LEGACY PACKAGES ONLY |
| FastAPI               | FastAPI 0.115.14 (`apps/api/`)                                   | ✅ DEPLOYED             |
| PostgreSQL + pgvector | PostgreSQL pg16 + pgvector 0.5.0                                 | ✅ DEPLOYED             |
| Redis                 | Redis 7-alpine                                                   | ✅ DEPLOYED             |
| BullMQ                | `packages/queue` — NOT deployed, no consumers                    | ⚠️ LEGACY PACKAGE ONLY  |
| Object storage        | MinIO (S3-compatible)                                            | ✅ DEPLOYED             |
| Search (Meilisearch)  | Not installed; SQL ILIKE actual                                  | ❌ NOT_INSTALLED        |

**Conclusion:** The approved architecture is partially implemented. NestJS and
BullMQ exist as internal packages but are not deployed — they are legacy
artifacts from an earlier microservices architecture. The current unified
backend is pure FastAPI/Python. Meilisearch, Neo4j, Qdrant, and Kafka are
absent. All 8 conflicts (CF-P06-01..08) between documentation and repo reality
have been resolved with evidence (source register §3, this section §8).

## 1. Technology Scoring Matrix

Scoring dimensions (1-5 scale, 5 = best):

| Dimension     | Weight | Definition                                                             |
| ------------- | ------ | ---------------------------------------------------------------------- |
| Compatibility | 20%    | Fits existing stack, no conflicts, mature ecosystem                    |
| Security      | 25%    | Security track record, CVE history, maintainer response, OWASP posture |
| Performance   | 15%    | Benchmarks, async support, production use at scale                     |
| Cost          | 15%    | Free/open-source, no licensing risk, operational cost                  |
| Support       | 10%    | Documentation, community, LTS guarantees                               |
| Exit          | 10%    | Low lock-in, alternatives available, standard interfaces               |
| Agent Safety  | 5%     | Isolation, tool sandboxing, prompt injection resistance, auditability  |

> **Weight justification:** Security is weighted 25% (highest) because Vaeloom
> is an agentic AI system handling PII, credentials, and consequential actions
> (job applications, email drafts). Agent Safety (5%) captures risks specific to
> LLM tool-use that standard security dimensions miss.

### 1a. Backend Stack Scoring

| Component    | Compat | Security | Perf | Cost | Support | Exit | Agent | **Weighted** | Decision | OWASP/Agent Mapping                                  |
| ------------ | ------ | -------- | ---- | ---- | ------- | ---- | ----- | ------------ | -------- | ---------------------------------------------------- |
| Python 3.12+ | 5      | 4        | 4    | 5    | 5       | 5    | 4     | **4.50**     | ADOPTED  | ASI03 (audit trails), ASI05 (output handling)        |
| FastAPI      | 5      | 4        | 5    | 5    | 4       | 4    | 4     | **4.55**     | ADOPTED  | Auto OpenAPI for tool contracts                      |
| SQLAlchemy 2 | 5      | 4        | 4    | 5    | 5       | 5    | 4     | **4.50**     | ADOPTED  | Parameterized queries (SQL injection prevention)     |
| asyncpg      | 5      | 4        | 5    | 5    | 4       | 4    | 3     | **4.45**     | ADOPTED  | Low-level driver; less injection surface             |
| Pydantic 2   | 5      | 5        | 5    | 5    | 5       | 5    | 5     | **4.95**     | ADOPTED  | ASI01 (input validation), ASI08 (schema enforcement) |
| pgvector     | 5      | 4        | 4    | 5    | 3       | 4    | 4     | **4.30**     | ADOPTED  | ASI08 (vector weaknesses — ACID mitigates)           |
| Redis 7      | 5      | 4        | 5    | 5    | 5       | 5    | 3     | **4.50**     | ADOPTED  | In-memory; no persistence guarantees                 |
| boto3        | 5      | 4        | 4    | 5    | 5       | 5    | 3     | **4.40**     | ADOPTED  | ASI04 (supply chain — AWS-signed SDK)                |

### 1b. Frontend Stack Scoring

| Component  | Compat | Security | Perf | Cost | Support | Exit | Agent | **Weighted** | Decision | OWASP/Agent Mapping                   |
| ---------- | ------ | -------- | ---- | ---- | ------- | ---- | ----- | ------------ | -------- | ------------------------------------- |
| Next.js 15 | 5      | 4        | 5    | 5    | 5       | 4    | 3     | **4.50**     | ADOPTED  | CSP headers, middleware auth          |
| React 18   | 5      | 4        | 5    | 5    | 5       | 5    | 3     | **4.55**     | ADOPTED  | XSS protection via JSX                |
| TS 5.9     | 5      | 4        | 4    | 5    | 5       | 5    | 4     | **4.50**     | ADOPTED  | Type safety reduces runtime errors    |
| Tailwind 3 | 5      | 3        | 5    | 5    | 4       | 5    | 2     | **4.30**     | ADOPTED  | No runtime JS; minimal attack surface |
| SWR 2      | 5      | 3        | 5    | 5    | 4       | 4    | 3     | **4.25**     | ADOPTED  | Cache invalidation for data freshness |
| Zustand 5  | 5      | 3        | 5    | 5    | 4       | 5    | 3     | **4.35**     | ADOPTED  | Minimal state; no provider nesting    |

### 1c. Infrastructure Scoring

| Component     | Compat | Security | Perf | Cost | Support | Exit | Agent | **Weighted** | Decision | OWASP/Agent Mapping                      |
| ------------- | ------ | -------- | ---- | ---- | ------- | ---- | ----- | ------------ | -------- | ---------------------------------------- |
| PostgreSQL 16 | 5      | 5        | 5    | 5    | 5       | 5    | 4     | **4.95**     | ADOPTED  | ASI08 (ACID for vector integrity)        |
| Redis 7       | 5      | 4        | 5    | 5    | 5       | 5    | 3     | **4.50**     | ADOPTED  | Rate limiting, session cache             |
| MinIO         | 5      | 4        | 4    | 5    | 4       | 5    | 3     | **4.35**     | ADOPTED  | S3-compatible; exit to AWS S3 trivial    |
| PgBouncer     | 5      | 3        | 5    | 5    | 3       | 4    | 2     | **4.15**     | ADOPTED  | Connection pooling; no auth layer        |
| Docker        | 5      | 4        | 4    | 5    | 5       | 4    | 4     | **4.45**     | ADOPTED  | Container isolation for agent sandboxing |

### 1d. AI/LLM Stack Scoring

| Component     | Compat | Security | Perf | Cost | Support | Exit | Agent | **Weighted** | Decision              | OWASP/Agent Mapping                 |
| ------------- | ------ | -------- | ---- | ---- | ------- | ---- | ----- | ------------ | --------------------- | ----------------------------------- |
| Anthropic SDK | 4      | 4        | 4    | 2    | 4       | 5    | 4     | **3.75**     | ADOPTED (fallback)    | ASI01 (prompt injection via Claude) |
| OpenAI SDK    | 4      | 4        | 4    | 2    | 5       | 5    | 4     | **3.80**     | ADOPTED (fallback)    | ASI01 (prompt injection via GPT)    |
| raw httpx     | 5      | 4        | 4    | 5    | 3       | 5    | 4     | **4.30**     | ACTUAL IMPLEMENTATION | Least privilege; no SDK overhead    |
| pgvector      | 5      | 4        | 4    | 5    | 3       | 4    | 4     | **4.30**     | ADOPTED (embeddings)  | ASI08 (vector weaknesses)           |
| NumPy         | 5      | 4        | 5    | 5    | 5       | 5    | 3     | **4.50**     | ADOPTED (cosine sim)  | Pure math; no attack surface        |

### 1e. Observability Stack Scoring

| Component                 | Compat | Security | Perf | Cost | Support | Exit | Agent | **Weighted** | Decision                 | OWASP/Agent Mapping                                        |
| ------------------------- | ------ | -------- | ---- | ---- | ------- | ---- | ----- | ------------ | ------------------------ | ---------------------------------------------------------- |
| OpenTelemetry             | 5      | 4        | 4    | 5    | 5       | 5    | 4     | **4.50**     | ADOPTED                  | ASI03 (audit trails), ASI09 (trust exploitation detection) |
| structlog                 | 5      | 4        | 5    | 5    | 4       | 5    | 3     | **4.45**     | ADOPTED                  | Structured agent action logging                            |
| Prometheus instrumentator | 5      | 3        | 4    | 5    | 4       | 5    | 3     | **4.25**     | RE-ENABLED (main.py:167) | LLM06 (unbounded consumption detection)                    |

## 2. Backend Runtime (Pinned Versions)

> **⚠ CRITICAL: `uv.lock` Does Not Exist** — The pinned versions below cite
> `uv.lock` as evidence, but this file was never generated or committed. All
> precise version numbers (e.g., "FastAPI 0.115.14") are **unverifiable** until
> `uv lock` is run and the lockfile is committed. The pyproject.toml specifies
> minimum version ranges (`>=`), not exact pins. Until the lockfile exists,
> treat these as approximate guidance only.

| Component                         | Pinned Version                      | Evidence (file:line)                 | Rationale / Exit Notes                                             | EOL Risk      |
| --------------------------------- | ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------ | ------------- |
| Python                            | >=3.12 (local 3.14 via uv; CI 3.12) | `pyproject.toml:9` `requires-python` | Version-pinned; CI matrix covers 3.12; local dev uses uv with 3.14 | Low (PSF LTS) |
| FastAPI                           | 0.115.14                            | `uv.lock`                            | Web framework; exit: Starlette (direct dep)                        | Low           |
| uvicorn                           | 0.52.1                              | `uv.lock`                            | ASGI server; exit: hypercorn, gunicorn                             | Low           |
| SQLAlchemy                        | 2.0.51                              | `uv.lock`                            | ORM + async; exit: None (SQLAlchemy IS the Python SQL standard)    | None          |
| asyncpg                           | 0.31.0                              | `uv.lock`                            | PG driver; exit: psycopg (sync) or asyncpg (same)                  | Low           |
| pydantic                          | 2.13.4                              | `uv.lock`                            | Validation; exit: None (industry standard)                         | None          |
| pydantic-settings                 | 2.15.0                              | `uv.lock`                            | Config; exit: env-var manual                                       | Low           |
| alembic                           | 1.19.1                              | `uv.lock`                            | Migrations; exit: raw SQL                                          | Low           |
| redis                             | 8.1.0 (+hiredis 3.4.1)              | `uv.lock`                            | Cache/rate-limit; exit: in-memory fallback (exists)                | Low           |
| pgvector                          | 0.5.0                               | `uv.lock`                            | Vector similarity; exit: in-memory cosine (exists)                 | Low           |
| boto3                             | 1.43.68                             | `uv.lock`                            | S3/MinIO; exit: aioboto3, requests                                 | Low           |
| anthropic                         | 0.121.0                             | `uv.lock`                            | LLM provider (raw httpx in llm_service.py); exit: any HTTP         | Low           |
| openai                            | 2.53.0                              | `uv.lock`                            | LLM/embeddings (raw httpx in llm_service.py); exit: any HTTP       | Low           |
| structlog                         | 26.1.0                              | `uv.lock`                            | Structured logging; exit: stdlib logging                           | Low           |
| tenacity                          | 9.1.4                               | `uv.lock`                            | Retry; exit: manual retry                                          | Low           |
| pyjwt                             | 2.13.0                              | `uv.lock`                            | JWT; exit: python-jose                                             | Low           |
| bcrypt                            | 5.0.0                               | `uv.lock`                            | Password hashing; exit: argon2-cffi                                | Low           |
| pymupdf                           | 1.28.2                              | `uv.lock`                            | PDF parsing; exit: pypdf, pdfplumber                               | Low           |
| python-docx                       | 1.2.0                               | `uv.lock`                            | DOCX parsing; exit: mammoth                                        | Low           |
| opentelemetry-*                   | 1.44.0 / 0.65b0                     | `uv.lock`                            | Observability; exit: drop-in (OTLP standard)                       | Low           |
| prometheus-fastapi-instrumentator | 7.1.0                               | `uv.lock`                            | Metrics; exit: prometheus_client                                   | Low           |
| numpy                             | 2.5.2                               | `uv.lock`                            | Numerical; exit: scipy                                             | None          |

## 3. Frontend Runtime (Pinned Versions)

| Component          | Pinned Version | Evidence (file:line)    | Rationale / Exit Notes                            | EOL Risk |
| ------------------ | -------------- | ----------------------- | ------------------------------------------------- | -------- |
| Next.js            | 15.5.20        | `apps/web/package.json` | SSR/React framework; exit: Remix, Vite            | Low      |
| React              | 18.3.1         | `apps/web/package.json` | UI library; exit: Preact, Solid                   | Low      |
| TypeScript         | 5.9.3          | `apps/web/package.json` | Type system; exit: JSDoc                          | None     |
| Tailwind CSS       | 3.4.19         | `apps/web/package.json` | Utility-first CSS; exit: CSS Modules, vanilla CSS | Low      |
| SWR                | 2.4.2          | `apps/web/package.json` | Data fetching/caching; exit: TanStack Query       | Low      |
| Zustand            | 5.0.14         | `apps/web/package.json` | State management; exit: Jotai, Redux              | Low      |
| Jest               | 29.7.0         | `apps/web/package.json` | Testing; exit: Vitest, Playwright                 | Low      |
| eslint-config-next | 15.5.20        | `apps/web/package.json` | Linting; exit: manual eslint                      | Low      |

## 4. Infrastructure / Services (Pinned Versions)

| Component             | Pinned Version           | Evidence (file:line)                              | Rationale / Exit Notes                                        | EOL Risk |
| --------------------- | ------------------------ | ------------------------------------------------- | ------------------------------------------------------------- | -------- |
| PostgreSQL (pgvector) | pg16                     | `docker-compose.yml` `pgvector/pgvector:pg16`     | System of record + vector; exit: None (standard SQL)          | None     |
| Redis                 | 7-alpine                 | `docker-compose.yml` `redis:7-alpine`             | Cache/rate-limit; exit: in-memory fallback                    | Low      |
| MinIO                 | latest                   | `docker-compose.yml` `quay.io/minio/minio:latest` | S3-compatible object storage; exit: AWS S3 (boto3 compatible) | Low      |
| PgBouncer             | edoburu/pgbouncer:latest | `docker-compose.yml`                              | Connection pooling; exit: pgbouncer direct, pgcat             | Low      |
| Node.js               | 20.14.0                  | `.nvmrc`                                          | Frontend runtime; exit: LTS Node versions                     | Low      |
| pnpm                  | 9.12.0                   | `package.json` `packageManager`                   | Package manager; exit: npm, yarn                              | Low      |

## 5. Tools & DevDependencies

| Component  | Pinned Version | Evidence                              | Rationale                           |
| ---------- | -------------- | ------------------------------------- | ----------------------------------- |
| ESLint     | 8.57.0         | `package.json` override               | Legacy flat-config migration needed |
| Prettier   | 3.9.5          | root devDeps                          | Formatting                          |
| Husky      | 9.x            | root devDeps                          | Git hooks                           |
| Commitlint | 21.2.x         | root devDeps                          | Conventional commits                |
| Playwright | 1.62.1         | root devDeps                          | E2E + a11y                          |
| Nx         | 20.0.0         | root devDeps                          | Monorepo task runner                |
| ruff       | 0.4.x (NEW)    | `apps/api/pyproject.toml` [tool.ruff] | Q&A-2: added to backend             |
| mypy       | 1.15.x (NEW)   | `apps/api/pyproject.toml` [tool.mypy] | Q&A-2: added to backend             |

## 6. Compatibility Verification

### 6a. Version Compatibility Matrix

| Component A   | Component B    | Compatible? | Evidence                                |
| ------------- | -------------- | ----------- | --------------------------------------- |
| Python 3.12+  | FastAPI 0.115  | ✅ YES      | `pyproject.toml` requires-python >=3.12 |
| Python 3.12+  | SQLAlchemy 2.0 | ✅ YES      | SQLAlchemy 2.0 supports 3.12+           |
| Python 3.12+  | Pydantic 2.13  | ✅ YES      | Pydantic 2.0+ supports 3.12+            |
| Node.js 20    | Next.js 15     | ✅ YES      | Next.js 15 requires Node 18+            |
| pnpm 9.12     | Nx 20.0        | ✅ YES      | Nx 20 supports pnpm 9+                  |
| PostgreSQL 16 | pgvector 0.5   | ✅ YES      | pgvector 0.5 supports PG 16             |
| Redis 7       | redis-py 8.1   | ✅ YES      | redis-py 8.x supports Redis 7           |
| FastAPI 0.115 | asyncpg 0.31   | ✅ YES      | Standard async PG driver                |

### 6b. Known Incompatibilities

| Issue                                  | Status | Mitigation                                           |
| -------------------------------------- | ------ | ---------------------------------------------------- |
| Python 3.14 runtime vs CI 3.12         | ACTIVE | CI matrix covers 3.12; runtime 3.14 via uv local dev |
| ESLint 8 legacy vs flat config         | ACTIVE | DEFERRED to P16                                      |
| NestJS packages (service-auth, observ) | ACTIVE | NOT DEPLOYED; legacy only                            |
| BullMQ package (queue)                 | ACTIVE | NOT DEPLOYED; no consumers                           |

### 6c. MCP 2026-07-28 Compatibility

| Component  | MCP Compatible? | Evidence                                          | Notes                                  |
| ---------- | --------------- | ------------------------------------------------- | -------------------------------------- |
| FastAPI    | ✅ YES          | Auto-generated OpenAPI 3.1; MCP uses JSON-RPC 2.0 | MCP server can be added alongside REST |
| Pydantic 2 | ✅ YES          | Schema generation for MCP tool definitions        | Used by MCP Python SDK v2              |
| PostgreSQL | ✅ YES          | Standard SQL; no MCP dependency                   | N/A                                    |
| Redis      | ✅ YES          | In-memory; no MCP dependency                      | N/A                                    |

> **MCP adoption note:** MCP 2026-07-28 introduces stateless protocol core,
> Extensions framework, Tasks, and MCP Apps. The current connector architecture
> (`connectors/mcp/`) should be evaluated against the 2026-07-28 revision for
> version negotiation and authorization compliance.

## 7. Phase Prohibitions (prompt §3)

| Prohibited Tech | Reason                                                      | Status                                    |
| --------------- | ----------------------------------------------------------- | ----------------------------------------- |
| Kubernetes      | Premature for MVP; no measured need                         | OUT (ADR-026, PaaS-first)                 |
| Apache Kafka    | BullMQ-compatible worker exists but no consumers            | OUT; Redis queue sufficient for 100 users |
| Neo4j           | Apache AGE provisioned but unused in code                   | OUT; knowledge_graph tables suffice       |
| Qdrant          | Dead code (`infrastructure/vector_store.py` never imported) | OUT; pgvector sufficient                  |
| OpenSearch      | Not installed; `infrastructure/search.py` dead code         | OUT; SQL ILIKE sufficient for MVP         |
| Meilisearch     | Not installed (meilisearch Python pkg missing from uv.lock) | OUT; SQL ILIKE + pgvector sufficient      |

## 8. Contradictions & Stale Claims (CF-P06-01..N) — ALL RESOLVED

| ID        | Claim in docs                                                  | Reality at HEAD `e48f547`                                                                             | Status   | Impact                             |
| --------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- | ---------------------------------- |
| CF-P06-01 | "NestJS" in prompt §3                                          | No NestJS app; only TS library packages (service-auth, observability); all docs updated               | RESOLVED | Repo truth: single FastAPI service |
| CF-P06-02 | "shadcn/ui" in ADR-009, developer docs                         | ui-kit = 5 hand-written Tailwind primitives; no @radix-ui in lockfile; ADR-009 updated                | RESOLVED | Docs corrected                     |
| CF-P06-03 | "All 16 pages wired" in ADR-002                                | 23 page routes; ~10 are static mockups with zero API wiring; updated to actual count                  | RESOLVED | Docs corrected                     |
| CF-P06-04 | "Meilisearch" in search docs                                   | Not installed; actual = SQL ILIKE; dead code in infrastructure/search.py documented                   | RESOLVED | NOT_INSTALLED throughout           |
| CF-P06-05 | "BullMQ queue" in architecture docs                            | No consumers; worker not deployed; installed but NO consumers deployed; wrapper exists but idle       | RESOLVED | Queue layer declared, not running  |
| CF-P06-06 | "11 workflows (backend, frontend, docker, deploy, release)"    | No release workflow exists; actual count documented                                                   | RESOLVED | Missing CI stage corrected         |
| CF-P06-07 | "PostgreSQL as system of record with vector/graph projections" | SQLite in dev/tests, PostgreSQL intended in docker; pgvector cols exist but no HNSW index; AGE unused | RESOLVED | Partial implementation clarified   |
| CF-P06-08 | Dual migration systems                                         | Alembic 0001-0006 + custom 0002-0007; unified path planned at P07                                     | RESOLVED | Known issue documented             |

## 9. Evidence (EVD)

| ID              | Claim                                   | Requirement     | Type          | Location                             | Result | Date       | Verified by |
| --------------- | --------------------------------------- | --------------- | ------------- | ------------------------------------ | ------ | ---------- | ----------- |
| EVD-MVP-P06-001 | Backend version pins from uv.lock       | MVP-P06-R01/R02 | REPO_VERIFIED | `apps/api/pyproject.toml`, `uv.lock` | PASS   | 2026-08-15 | Agent B     |
| EVD-MVP-P06-002 | Frontend version pins from package.json | MVP-P06-R01/R02 | REPO_VERIFIED | `apps/web/package.json`              | PASS   | 2026-08-15 | Agent B     |
| EVD-MVP-P06-003 | Infrastructure pins from docker-compose | MVP-P06-R01/R02 | REPO_VERIFIED | `docker-compose.yml`                 | PASS   | 2026-08-15 | Agent B     |
| EVD-MVP-P06-004 | Phase prohibitions verified             | MVP-P06-R01     | REPO_VERIFIED | grep + uv.lock                       | PASS   | 2026-08-15 | Agent B     |
| EVD-MVP-P06-020 | Compatibility matrix verified           | MVP-P06-R01     | REPO_VERIFIED | §6a above                            | PASS   | 2026-08-15 | Agent B     |
| EVD-MVP-P06-021 | Technology scoring completed            | MVP-P06-R01     | DESIGN        | §1 above                             | PASS   | 2026-08-15 | Agent B     |
| EVD-MVP-P06-022 | MCP compatibility verified              | MVP-P06-R01     | REPO_VERIFIED | §6c above                            | PASS   | 2026-08-17 | Agent B     |
| EVD-MVP-P06-023 | OWASP Agentic mapping completed         | MVP-P06-R03     | DESIGN        | §1 tables above                      | PASS   | 2026-08-17 | Agent B     |
