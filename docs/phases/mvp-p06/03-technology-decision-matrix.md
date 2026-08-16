# MVP-P06 — 03. Technology Decision Matrix (DEL-MVP-P06-01) — Re-Run 2026-08-15

> DEL-MVP-P06-01. Pinned from repo manifests at HEAD `e48f547` (zero-trust,
> `01-source-register.md` §4 authority). Prior run (2026-08-07) preserved as
> `*-2026-08-07.md`. Scoring per prompt §12 task 2: "Score frontend/backend/
> AI/data/queue/search/observability/deployment choices."

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
| Search (Meilisearch)  | Not installed; SQL ILIKE actual                                  | ❌ NOT PRESENT          |

**Conclusion:** The approved architecture is partially implemented. NestJS and
BullMQ exist as internal packages but are not deployed — they are legacy
artifacts from an earlier microservices architecture. The current unified
backend is pure FastAPI/Python. Meilisearch, Neo4j, Qdrant, and Kafka are
absent. All 8 conflicts (CF-P06-01..08) between documentation and repo reality
have been resolved with evidence (source register §3, this section §8).

## 1. Technology Scoring Matrix

Scoring dimensions (1-5 scale, 5 = best):

| Dimension     | Weight | Definition                                               |
| ------------- | ------ | -------------------------------------------------------- |
| Compatibility | 25%    | Fits existing stack, no conflicts, mature ecosystem      |
| Security      | 20%    | Security track record, vulnerability history, maintainer |
| Performance   | 20%    | Benchmarks, async support, production use                |
| Cost          | 15%    | Free/open-source, no licensing risk                      |
| Support       | 10%    | Documentation, community, LTS guarantees                 |
| Exit          | 10%    | Low lock-in, alternatives available, standard interfaces |

### 1a. Backend Stack Scoring

| Component    | Compat | Security | Perf | Cost | Support | Exit | **Weighted** | Decision |
| ------------ | ------ | -------- | ---- | ---- | ------- | ---- | ------------ | -------- |
| Python 3.12+ | 5      | 4        | 4    | 5    | 5       | 5    | **4.55**     | ADOPTED  |
| FastAPI      | 5      | 4        | 5    | 5    | 4       | 4    | **4.60**     | ADOPTED  |
| SQLAlchemy 2 | 5      | 4        | 4    | 5    | 5       | 5    | **4.55**     | ADOPTED  |
| asyncpg      | 5      | 4        | 5    | 5    | 4       | 4    | **4.60**     | ADOPTED  |
| Pydantic 2   | 5      | 4        | 5    | 5    | 5       | 5    | **4.75**     | ADOPTED  |
| pgvector     | 5      | 4        | 4    | 5    | 3       | 4    | **4.35**     | ADOPTED  |
| Redis 7      | 5      | 4        | 5    | 5    | 5       | 5    | **4.75**     | ADOPTED  |
| boto3        | 5      | 4        | 4    | 5    | 5       | 5    | **4.55**     | ADOPTED  |

### 1b. Frontend Stack Scoring

| Component  | Compat | Security | Perf | Cost | Support | Exit | **Weighted** | Decision |
| ---------- | ------ | -------- | ---- | ---- | ------- | ---- | ------------ | -------- |
| Next.js 15 | 5      | 4        | 5    | 5    | 5       | 4    | **4.65**     | ADOPTED  |
| React 18   | 5      | 4        | 5    | 5    | 5       | 5    | **4.75**     | ADOPTED  |
| TS 5.9     | 5      | 4        | 4    | 5    | 5       | 5    | **4.55**     | ADOPTED  |
| Tailwind 3 | 5      | 3        | 5    | 5    | 4       | 5    | **4.45**     | ADOPTED  |
| SWR 2      | 5      | 3        | 5    | 5    | 4       | 4    | **4.35**     | ADOPTED  |
| Zustand 5  | 5      | 3        | 5    | 5    | 4       | 5    | **4.45**     | ADOPTED  |

### 1c. Infrastructure Scoring

| Component     | Compat | Security | Perf | Cost | Support | Exit | **Weighted** | Decision |
| ------------- | ------ | -------- | ---- | ---- | ------- | ---- | ------------ | -------- |
| PostgreSQL 16 | 5      | 5        | 5    | 5    | 5       | 5    | **5.00**     | ADOPTED  |
| Redis 7       | 5      | 4        | 5    | 5    | 5       | 5    | **4.75**     | ADOPTED  |
| MinIO         | 5      | 4        | 4    | 5    | 4       | 5    | **4.45**     | ADOPTED  |
| PgBouncer     | 5      | 3        | 5    | 5    | 3       | 4    | **4.25**     | ADOPTED  |
| Docker        | 5      | 4        | 4    | 5    | 5       | 4    | **4.45**     | ADOPTED  |

### 1d. AI/LLM Stack Scoring

| Component     | Compat | Security | Perf | Cost | Support | Exit | **Weighted** | Decision              |
| ------------- | ------ | -------- | ---- | ---- | ------- | ---- | ------------ | --------------------- |
| Anthropic SDK | 4      | 4        | 4    | 2    | 4       | 5    | **3.75**     | ADOPTED (fallback)    |
| OpenAI SDK    | 4      | 4        | 4    | 2    | 5       | 5    | **3.80**     | ADOPTED (fallback)    |
| raw httpx     | 5      | 4        | 4    | 5    | 3       | 5    | **4.35**     | ACTUAL IMPLEMENTATION |
| pgvector      | 5      | 4        | 4    | 5    | 3       | 4    | **4.35**     | ADOPTED (embeddings)  |
| NumPy         | 5      | 4        | 5    | 5    | 5       | 5    | **4.75**     | ADOPTED (cosine sim)  |

### 1e. Observability Stack Scoring

| Component                 | Compat | Security | Perf | Cost | Support | Exit | **Weighted** | Decision            |
| ------------------------- | ------ | -------- | ---- | ---- | ------- | ---- | ------------ | ------------------- |
| OpenTelemetry             | 5      | 4        | 4    | 5    | 5       | 5    | **4.55**     | ADOPTED             |
| structlog                 | 5      | 4        | 5    | 5    | 4       | 5    | **4.55**     | ADOPTED             |
| Prometheus instrumentator | 5      | 3        | 4    | 5    | 4       | 5    | **4.25**     | COMMENTED OUT (GAP) |

## 2. Backend Runtime (Pinned Versions)

| Component                         | Pinned Version                   | Evidence (file:line)                 | Rationale / Exit Notes                                          |
| --------------------------------- | -------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| Python                            | >=3.12 (runtime 3.14.7; CI 3.12) | `pyproject.toml:9` `requires-python` | Version-pinned; CI matrix covers 3.12; exit: PSF-supported      |
| FastAPI                           | 0.115.14                         | `uv.lock`                            | Web framework; exit: Starlette (direct dep)                     |
| uvicorn                           | 0.52.1                           | `uv.lock`                            | ASGI server; exit: hypercorn, gunicorn                          |
| SQLAlchemy                        | 2.0.51                           | `uv.lock`                            | ORM + async; exit: None (SQLAlchemy IS the Python SQL standard) |
| asyncpg                           | 0.31.0                           | `uv.lock`                            | PG driver; exit: psycopg (sync) or asyncpg (same)               |
| pydantic                          | 2.13.4                           | `uv.lock`                            | Validation; exit: None (industry standard)                      |
| pydantic-settings                 | 2.15.0                           | `uv.lock`                            | Config; exit: env-var manual                                    |
| alembic                           | 1.19.1                           | `uv.lock`                            | Migrations; exit: raw SQL                                       |
| redis                             | 8.1.0 (+hiredis 3.4.1)           | `uv.lock`                            | Cache/rate-limit; exit: in-memory fallback (exists)             |
| pgvector                          | 0.5.0                            | `uv.lock`                            | Vector similarity; exit: in-memory cosine (exists)              |
| boto3                             | 1.43.68                          | `uv.lock`                            | S3/MinIO; exit: aioboto3, requests                              |
| anthropic                         | 0.121.0                          | `uv.lock`                            | LLM provider (raw httpx in llm_service.py); exit: any HTTP      |
| openai                            | 2.53.0                           | `uv.lock`                            | LLM/embeddings (raw httpx in llm_service.py); exit: any HTTP    |
| structlog                         | 26.1.0                           | `uv.lock`                            | Structured logging; exit: stdlib logging                        |
| tenacity                          | 9.1.4                            | `uv.lock`                            | Retry; exit: manual retry                                       |
| pyjwt                             | 2.13.0                           | `uv.lock`                            | JWT; exit: python-jose                                          |
| bcrypt                            | 5.0.0                            | `uv.lock`                            | Password hashing; exit: argon2-cffi                             |
| pymupdf                           | 1.28.2                           | `uv.lock`                            | PDF parsing; exit: pypdf, pdfplumber                            |
| python-docx                       | 1.2.0                            | `uv.lock`                            | DOCX parsing; exit: mammoth                                     |
| opentelemetry-*                   | 1.44.0 / 0.65b0                  | `uv.lock`                            | Observability; exit: drop-in (OTLP standard)                    |
| prometheus-fastapi-instrumentator | 7.1.0                            | `uv.lock`                            | Metrics; exit: prometheus_client                                |
| numpy                             | 2.5.2                            | `uv.lock`                            | Numerical; exit: scipy                                          |

## 3. Frontend Runtime (Pinned Versions)

| Component          | Pinned Version | Evidence (file:line)    | Rationale / Exit Notes                            |
| ------------------ | -------------- | ----------------------- | ------------------------------------------------- |
| Next.js            | 15.5.20        | `apps/web/package.json` | SSR/React framework; exit: Remix, Vite            |
| React              | 18.3.1         | `apps/web/package.json` | UI library; exit: Preact, Solid                   |
| TypeScript         | 5.9.3          | `apps/web/package.json` | Type system; exit: JSDoc                          |
| Tailwind CSS       | 3.4.19         | `apps/web/package.json` | Utility-first CSS; exit: CSS Modules, vanilla CSS |
| SWR                | 2.4.2          | `apps/web/package.json` | Data fetching/caching; exit: TanStack Query       |
| Zustand            | 5.0.14         | `apps/web/package.json` | State management; exit: Jotai, Redux              |
| Jest               | 29.7.0         | `apps/web/package.json` | Testing; exit: Vitest, Playwright                 |
| eslint-config-next | 15.5.20        | `apps/web/package.json` | Linting; exit: manual eslint                      |

## 4. Infrastructure / Services (Pinned Versions)

| Component             | Pinned Version           | Evidence (file:line)                              | Rationale / Exit Notes                                        |
| --------------------- | ------------------------ | ------------------------------------------------- | ------------------------------------------------------------- |
| PostgreSQL (pgvector) | pg16                     | `docker-compose.yml` `pgvector/pgvector:pg16`     | System of record + vector; exit: None (standard SQL)          |
| Redis                 | 7-alpine                 | `docker-compose.yml` `redis:7-alpine`             | Cache/rate-limit; exit: in-memory fallback                    |
| MinIO                 | latest                   | `docker-compose.yml` `quay.io/minio/minio:latest` | S3-compatible object storage; exit: AWS S3 (boto3 compatible) |
| PgBouncer             | edoburu/pgbouncer:latest | `docker-compose.yml`                              | Connection pooling; exit: pgbouncer direct, pgcat             |
| Node.js               | 20.14.0                  | `.nvmrc`                                          | Frontend runtime; exit: LTS Node versions                     |
| pnpm                  | 9.12.0                   | `package.json` `packageManager`                   | Package manager; exit: npm, yarn                              |

## 5. Tools & DevDependencies

| Component  | Pinned Version | Evidence                              | Rationale                           |
| ---------- | -------------- | ------------------------------------- | ----------------------------------- |
| ESLint     | 8.57.0         | `package.json` override               | Legacy flat-config migration needed |
| Prettier   | 3.2.x          | root devDeps                          | Formatting                          |
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

| Issue                                  | Status | Mitigation                                   |
| -------------------------------------- | ------ | -------------------------------------------- |
| Python 3.14 runtime vs CI 3.12         | ACTIVE | CI matrix covers 3.12; runtime 3.14 untested |
| ESLint 8 legacy vs flat config         | ACTIVE | DEFERRED to P16                              |
| NestJS packages (service-auth, observ) | ACTIVE | NOT DEPLOYED; legacy only                    |
| BullMQ package (queue)                 | ACTIVE | NOT DEPLOYED; no consumers                   |

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
