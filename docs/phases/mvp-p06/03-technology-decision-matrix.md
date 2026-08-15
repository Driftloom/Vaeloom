# MVP-P06 — 03. Technology Decision Matrix (DEL-MVP-P06-01) — Re-Run 2026-08-15

> DEL-MVP-P06-01. Pinned from repo manifests at HEAD `e48f547` (zero-trust,
> `01-source-register.md` §4 authority). Prior run (2026-08-07) preserved as
> `*-2026-08-07.md`.

## 1. Backend Runtime

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

## 2. Frontend Runtime

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

## 3. Infrastructure / Services

| Component             | Pinned Version           | Evidence (file:line)                              | Rationale / Exit Notes                                        |
| --------------------- | ------------------------ | ------------------------------------------------- | ------------------------------------------------------------- |
| PostgreSQL (pgvector) | pg16                     | `docker-compose.yml` `pgvector/pgvector:pg16`     | System of record + vector; exit: None (standard SQL)          |
| Redis                 | 7-alpine                 | `docker-compose.yml` `redis:7-alpine`             | Cache/rate-limit; exit: in-memory fallback                    |
| MinIO                 | latest                   | `docker-compose.yml` `quay.io/minio/minio:latest` | S3-compatible object storage; exit: AWS S3 (boto3 compatible) |
| PgBouncer             | edoburu/pgbouncer:latest | `docker-compose.yml`                              | Connection pooling; exit: pgbouncer direct, pgcat             |
| Node.js               | 20.14.0                  | `.nvmrc`                                          | Frontend runtime; exit: LTS Node versions                     |
| pnpm                  | 9.12.0                   | `package.json` `packageManager`                   | Package manager; exit: npm, yarn                              |

## 4. Tools & DevDependencies

| Component  | Pinned Version   | Evidence                                | Rationale                           |
| ---------- | ---------------- | --------------------------------------- | ----------------------------------- |
| ESLint     | 8.57.0           | `package.json` override                 | Legacy flat-config migration needed |
| Prettier   | 3.2.x            | root devDeps                            | Formatting                          |
| Husky      | 9.x              | root devDeps                            | Git hooks                           |
| Commitlint | 21.2.x           | root devDeps                            | Conventional commits                |
| Playwright | 1.62.1           | root devDeps                            | E2E + a11y                          |
| Nx         | 20.0.0           | root devDeps                            | Monorepo task runner                |
| ruff       | (NOT IN BACKEND) | `apps/backend/pyproject.toml` — MISSING | GAP: needs adding (Q&A-2)           |
| mypy       | (NOT IN BACKEND) | `apps/backend/pyproject.toml` — MISSING | GAP: needs adding (Q&A-2)           |

## 5. Phase Prohibitions (prompt §3)

| Prohibited Tech | Reason                                                      | Status                                    |
| --------------- | ----------------------------------------------------------- | ----------------------------------------- |
| Kubernetes      | Premature for MVP; no measured need                         | OUT (ADR-026, PaaS-first)                 |
| Apache Kafka    | BullMQ-compatible worker exists but no consumers            | OUT; Redis queue sufficient for 100 users |
| Neo4j           | Apache AGE provisioned but unused in code                   | OUT; knowledge_graph tables suffice       |
| Qdrant          | Dead code (`infrastructure/vector_store.py` never imported) | OUT; pgvector sufficient                  |
| OpenSearch      | Not installed; `infrastructure/search.py` dead code         | OUT; SQL ILIKE sufficient for MVP         |
| Meilisearch     | Not installed (meilisearch Python pkg missing from uv.lock) | OUT; SQL ILIKE + pgvector sufficient      |

## 6. Contradictions & Stale Claims (CF-P06-01..N)

| ID        | Claim in docs                          | Reality at HEAD `e48f547`                                             | Impact                                |
| --------- | -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| CF-P06-01 | "shadcn/ui" in ADR-009, developer docs | ui-kit = 5 hand-written Tailwind primitives; no @radix-ui in lockfile | Docs must be corrected                |
| CF-P06-02 | "All 16 pages wired" in ADR-002        | 23 page routes; ~10 are static mockups with zero API wiring           | Docs must be corrected                |
| CF-P06-3  | "NestJS" in prompt §3                  | No NestJS app; only TS library packages (service-auth, observability) | Repo truth: single FastAPI service    |
| CF-P06-4  | "Meilisearch" in search docs           | Not installed; actual = SQL ILIKE                                     | Dead code in infrastructure/search.py |
| CF-P06-5  | "BullMQ queue" in architecture docs    | No consumers; worker not deployed; Redis rate-limit/cache only        | Queue layer declared, not running     |

## 7. Evidence (EVD)

| ID              | Claim                                   | Requirement     | Type          | Location                                 | Result | Date       | Verified by |
| --------------- | --------------------------------------- | --------------- | ------------- | ---------------------------------------- | ------ | ---------- | ----------- |
| EVD-MVP-P06-001 | Backend version pins from uv.lock       | MVP-P06-R01/R02 | REPO_VERIFIED | `apps/backend/pyproject.toml`, `uv.lock` | PASS   | 2026-08-15 | Agent B     |
| EVD-MVP-P06-002 | Frontend version pins from package.json | MVP-P06-R01/R02 | REPO_VERIFIED | `apps/web/package.json`                  | PASS   | 2026-08-15 | Agent B     |
| EVD-MVP-P06-003 | Infrastructure pins from docker-compose | MVP-P06-R01/R02 | REPO_VERIFIED | `docker-compose.yml`                     | PASS   | 2026-08-15 | Agent B     |
| EVD-MVP-P06-004 | Phase prohibitions verified             | MVP-P06-R01     | REPO_VERIFIED | grep + uv.lock                           | PASS   | 2026-08-15 | Agent B     |
