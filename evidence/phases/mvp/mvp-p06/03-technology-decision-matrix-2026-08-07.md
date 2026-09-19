# MVP-P06 — 03. Technology Decision Matrix (DEL-MVP-P06-01)

> Owner: Solution Architect · Decision criteria: compatibility, security,
> performance, cost ($0), support, exit. Repo truth basis; phase rule: no
> premature k8s/Kafka/Neo4j/Qdrant/OpenSearch.

## 1. Decisions

| Area | Choice (repo/decision) | Alternatives rejected | Rationale | Owner |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------- | --------------- |
| Frontend | Next.js 15 + React 18 + TS 5.5 | Vue/Svelte | In repo; RSC/SSR; WCAG path | Frontend Lead |
| Backend | FastAPI (Python ≥3.12, runs 3.14) + uvicorn | NestJS (prompt prose — repo has none, CF-P05-01) | In repo; async; Pydantic v2 contracts | Backend Lead |
| ORM/migrations | SQLAlchemy 2 async + alembic | raw SQL ORM | In repo; versioned migrations | Backend Lead |
| System of record | PostgreSQL + pgvector | — | In repo; authoritative; vector projection in-place | Data Architect |
| Queue | Redis + BullMQ-compatible worker (`workers/queue_worker.py`, `packages/queue`) | Kafka (prohibited — no measured need) | In repo; DLQ exists | Platform |
| Object storage | MinIO (dev) / S3-compatible (prod, R2-class free) | — | In repo; $0 path | Platform |
| Search projection | Meilisearch (`SearchIndex` ABC exists) | OpenSearch (prohibited) | In repo; rebuildable | Platform |
| Graph projection | ORM Entity/Relationship (no separate DB) | Neo4j (prohibited) | In repo; relational truth | Data Architect |
| LLM | **Local/free providers preferred (BQ-P06-02)**: Ollama-class local, Groq/Gemini-class free tiers; anthropic/openai retained as configured fallback | paid-only default | $0 cap; mock-first tests | AI Lead |
| Embeddings | provider-dependent dims (repo: 1536 OpenAI) → **flag: local models differ (e.g. 768/3072)** | — | schema `Vector(1536)` may change at P07/P12 | AI Lead |
| Auth | JWT (ADR-007) + rotating refresh + PKCE (RFC 9700) | sessions | In repo | Security |
| OTel/metrics | OpenTelemetry + Prometheus (`infrastructure/opentelemetry`, `metrics`) | vendor APM (cost) | In repo; $0 | SRE |
| CI/CD | GitHub Actions (11 workflows in repo) | paid CI | In repo; $0 | DevOps |
| Deployment | docker-compose dev; PaaS-first MVP (BQ-P05-02 nearest region) | k8s/terraform prod (enterprise path, ADR-026) | $0; phase rule | Cloud Architect |
| Observability logs | structlog JSON + correlation IDs | — | In repo | SRE |

## 2. Evaluated-rejection notes

| Rejected | Reason | Revisit trigger |
| ---------- | ----------------------------------------------------------- | ------------------------------------- |
| Kafka | no measured need at 100/1,000; Redis queue adequate | queue lag sustained > threshold (P15) |
| Neo4j | graph = projection on relational truth (INT-02 §5) | graph queries degrade (measured) |
| Qdrant | pgvector suffices MVP; same constraint as Neo4j | vector recall degradation w/ evidence |
| OpenSearch | Meilisearch adequate; cost/complexity | search quality gap w/ evidence |
| k8s (MVP) | PaaS-first (ADR-026); infra/terraform exists for enterprise | enterprise track |
| NestJS | repo has no NestJS app (CF-P05-01) | never (repo truth) |

## 3. Standards pinned (EXT mapping)

OpenAPI 3.1 (P08 static contract) · RFC 9700 OAuth · WCAG 2.2 AA · OTel
semconv + privacy-aware telemetry · NIST SSDF 800-218 practices (this phase
embeds them) · MCP 2026-07-28 (connectors) · DPDP (P13).
