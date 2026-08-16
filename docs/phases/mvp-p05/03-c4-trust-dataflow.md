# MVP-P05 — 03. C4 / Trust / Data-Flow Architecture (Re-Run 2026-08-15)

> DEL-MVP-P05-01 · ARCHITECTURE (design-only). Baseline `master` @ `6e8a7b4`.
> Ground truth: `01-source-register.md` §4 (zero-trust inventory) +
> `02-predecessor-audit.md`. **Evidence classes:** `REPO_VERIFIED` (path) =
> inspected at HEAD · `SOURCE_DERIVED` = carried from source docs · `NEW_DESIGN`
> = this phase's design decision · `STAKEHOLDER_DECISION` = user/prior gate
> decision · `NOT_EXECUTED` / `UNVERIFIED` = honest gap. No runtime changes made
> (design-only). Scope: MVP only — enterprise features marked OUT-OF-MVP.

## 1. Context diagram

```mermaid
graph LR
    U["P1 'The Fresher' — user<br/>18+, India · BQ-02"]
    W["Web App<br/>Next.js 15 · apps/web"]
    API["Backend API<br/>FastAPI unified · apps/api/src/backend/main.py<br/>22 MVP routers under /api/v1<br/>(+8 enterprise routers gated off)"]
    GM["Gmail API<br/>draft-only, no send<br/>DEC-P01-03"]
    LLM["LLM Provider<br/>(mock LLM in dev/tests)"]
    JS["Job Sources<br/>T1 lawful only · DEC-P02-05<br/>clients/job_board_client.py"]
    QW["Queue Worker<br/>apps/api/src/backend/workers/queue_worker.py"]
    U -->|HTTPS · JWT bearer| W
    W -->|"JSON over HTTPS<br/>snake↔camel transform (lib/api.ts)"| API
    API -->|OAuth read + draft create| GM
    API -->|completions| LLM
    API -->|lawful job search (no scraping)| JS
    QW -->|reads Redis BullMQ queues| API
    API -->|submits jobs to queue| QW
    classDef ext fill:#fff0f0,stroke:#b00020,color:#000
    class GM,LLM,JS ext
```

**Notes (REPO_VERIFIED):** 30 `include_router` calls in
`apps/api/src/backend/main.py:143-173`; 22 are MVP (auth, workspaces, memory,
agents, events, search, integrations, documents, resumes, applications,
notifications, connectors, scheduler, chat, knowledge-graph, gdpr, consent,
approvals, agent-costs, gmail + `/health` + encryption); 8 (billing, plugins,
analytics, audit, iam, recommendations, webhooks, admin) are gated behind
`settings.enterprise_routes_enabled` (default off) — `main.py:164-173`. Gmail
client has **no `send`** method — `clients/gmail_client.py:84-189`
(`fetch_emails`, `create_draft`, `list_drafts`, `start_watch`, `stop_watch`,
`check_health`). Job submission happens only via the approval contract
(FR-50/51). T2 scraping / T3 auto-apply remain **PROPOSALS ONLY** (gated
AUTO-02/AUTO-03) — `STAKEHOLDER_DECISION` DEC-P02-05, P02 gate 2026-08-13.

## 2. Container diagram

```mermaid
graph TB
    W["Web App<br/>Next.js 15 · apps/web<br/>src/app (auth, status, workspace)<br/>middleware.ts · lib/api.ts"]
    API["Backend API (unified)<br/>FastAPI · main.py<br/>22 MVP routers + worker entry"]
    QW["Queue Worker<br/>workers/queue_worker.py<br/>BullMQ-compatible Redis consumer"]
    PG[("Postgres 16 + pgvector<br/>36 __tablename__ in models/schema.py<br/>+ migration-created tables")]
    RD[("Redis<br/>queue + cache")]
    MO[("MinIO / S3 object store<br/>services/storage_service.py")]
    MS["Meilisearch<br/>infrastructure/search.py<br/>(+ pgvector embeddings = projections)"]
    LLM["LLM Provider"]
    GM["Gmail Connector<br/>clients/gmail_client.py"]
    W -->|HTTPS| API
    API -->|jobs (BullMQ)| RD
    QW -->|consume| RD
    QW -->|execute| API
    API -->|SQLAlchemy async · RLS| PG
    API -->|objects · encryption| MO
    API -->|index/search| MS
    API -->|read/search| PG
    API -->|drafts · OAuth| GM
    API -->|completions| LLM
    QW -->|completions| LLM
```

**Repo reality (REPO_VERIFIED):** 36 `__tablename__` incl.
`idempotency_records`, `agent_approvals`, `gmail_watches`, `embeddings`,
`entities`, `relationships`, `memory_records`, `notifications`,
`schedule_events`, `agent_schedules` — `models/schema.py`. Dev
`docker-compose.yml` services: postgres, redis, web, backend, minio, pgbouncer,
pgadmin. `SearchIndex` ABC + `MeilisearchIndex` + `PostgresFallbackIndex` —
`infrastructure/search.py`. **Dual migration systems** (`alembic/versions`
0001-0002 AND `src/backend/migrations` 0002-0007 + `runner.py`) — `CF-P05-04`,
unify at P07. Meilisearch is a **rebuildable projection** (ADR-024), pgvector
embeddings are the authoritative vector store (ADR-003). PaaS-first MVP target
(ADR-026) — `NEW_DESIGN` carried.

## 3. Trust boundaries (B1–B7) mapped to actual middleware

Middleware set (REPO_VERIFIED — `apps/api/src/backend/middleware/`): `auth.py`,
`csrf.py`, `tenant.py`, `rate_limit.py`, `ip_filter.py`, `security_headers.py`,
`prompt_injection.py`, `api_version.py`, `idempotency.py`,
`exception_handler.py`, `rbac.py`.

| B   | Boundary                     | Control(s)                                                                                                                                                                                                                                      | Status                                                                                                                                                                                                                                    |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Browser → Web (TLS, CSP)     | Next.js `middleware.ts` + security headers (CSP `connect-src`, dev localhost:8000)                                                                                                                                                              | REPO_VERIFIED (`apps/web/src/middleware.ts`)                                                                                                                                                                                              |
| B2  | Web → Backend API            | JWT authN (`middleware/auth.py`, ADR-007), CSRF (`middleware/csrf.py`, SKIP_PREFIXES `/api/v1/auth`), rate limit (`middleware/rate_limit.py`, sliding window), IP filter (`middleware/ip_filter.py`), API version (`middleware/api_version.py`) | REPO_VERIFIED (paths as listed)                                                                                                                                                                                                           |
| B3  | API → Postgres               | Tenant scoping (`middleware/tenant.py`) + RLS (`infrastructure/data_isolation.py` `TenantAwareBase(RowLevelSecurityMixin)`; `migrations/0005_rls.py`)                                                                                           | REPO_VERIFIED; **GAP**: RLS applies to only 4 tables (`memories, events, usage_records, api_keys`) of 36 — coverage breadth UNVERIFIED                                                                                                    |
| B4  | API → Gmail                  | OAuth, draft-only scope (no send scope), no auto-send (DEC-P01-03)                                                                                                                                                                              | REPO_VERIFIED (`clients/gmail_client.py`)                                                                                                                                                                                                 |
| B5  | API → LLM                    | Prompt-injection guard (`middleware/prompt_injection.py`), QA gate (`agents/qa_validator.py`), retry + circuit breaker                                                                                                                          | REPO_VERIFIED (paths)                                                                                                                                                                                                                     |
| B6  | Worker → API/LLM             | Queue auth + LLM retry; **no workload identity**                                                                                                                                                                                                | **GAP** — ADR-025 service-token mechanism NOT found (no HMAC/service-token in backend; only `csrf.py` + `webhook_service.py` signing) — design-only                                                                                       |
| B7  | Agent → consequential action | Approval + idempotency (FR-50/51, ADR-021): `services/approval.py` + `agent_approvals` table (`migrations/0003_approvals.py`) + `middleware/idempotency.py`                                                                                     | REPO_VERIFIED (persistence now exists); **GAP**: payload-**hash** binding absent (no hash column in 0003), immutable decisions not structurally enforced, idempotency coverage limited to consent/gdpr prefixes — completeness UNVERIFIED |

## 4. Identity & authorization architecture

- **AuthN:** JWT access token issued by backend, validated in
  `middleware/auth.py` (ADR-007); sessions persisted in `auth_sessions`;
  optional SSO (`services/sso.py`, `saml.py`) — OUT-OF-MVP.
- **AuthZ:** workspace/tenant scoping in `middleware/tenant.py` + app-level
  `TenantScopedQuery` (`infrastructure/data_isolation.py`); RLS defense-in-depth
  (`migrations/0005_rls.py`). RBAC: `middleware/rbac.py` + `permissions` table +
  `services/permission_service.py` / `services/iam_service.py` (IAM router is
  enterprise-gated, `main.py:170`).
- **Workload identity (ADR-025):** `NEW_DESIGN` only — **no service-token/HMAC
  mechanism found** in backend (searched; only CSRF + outbound webhook signing).
  Worker↔API auth is a P07/P11 GAP.
- **Proposal/action separation (FR-50/51):** agents emit proposals;
  consequential actions call `request_approval` → `agent_approvals` row (status
  PENDING, `expires_at` default +60 min,
  `REPO_VERIFIED services/approval.py:20-56`) → user `decide()` → action.
  Payload-hash binding and immutable decisions: NOT implemented structurally —
  UNVERIFIED (owning phase P07/P11).

## 5. Core data flows (F1–F5)

### F1 — Ingest (documents / Gmail / job links)

`parsers.py` (PDF/Markdown/DOCX/Image + `parse_document`, REPO_VERIFIED
`apps/api/src/backend/ingestion/parsers.py`) → dedup (`ingestion/dedup.py`,
sha256 hash) → **Document authoritative** (`documents` + `document_versions`
tables) → embeddings projection (`embeddings` table, pgvector ADR-003) → memory
extraction (`services/memory_service.py`) → QA gate (`agents/qa_validator.py` +
memory subagents `agents/memory/*`). **Honesty:** `ingestion/pipeline.py:23-28`
still writes a **mocked** document row (`"new_doc_id_456"`) — real DB wiring
UNVERIFIED; QA-gate enforcement in the pipeline path UNVERIFIED.

### F2 — Organize → Remember

6-memory taxonomy (ADR-022, `STAKEHOLDER_DECISION` carried; `SOURCE_DERIVED`
from `05-adrs-2026-08-07.md`) implemented as typed `Memory` rows +
`supersedes_id` supersession / `domain` facet / soft-delete
(`migrations/0004_memory_taxonomy.py`) — **completeness of all 6 types + FR-68
supersession UNVERIFIED** (schema has a broader 22-type enum in
`schemas/memory_types.py`). Projections (ADR-024): Entity/Relationship graph
(`entities`, `relationships`, `services/knowledge_graph_service.py`) + vector
(`embeddings`) — both **rebuildable, never authoritative** (NEW_DESIGN).
Retrieval RAG: `services/search_service.py` + `search_ranking.py` over
pgvector + Meilisearch.

### F3 — Assist: proposal → approval → action

`request_approval` (FR-50/51) → `agent_approvals` persisted with `expires_at`
(REPO_VERIFIED `services/approval.py` + `migrations/0003_approvals.py`) → user
approve/reject (immutable — **UNVERIFIED**, no structural guard) → idempotent
action via `middleware/idempotency.py` (`Idempotency-Key`, 24h retention;
breadth limited to consent/gdpr prefixes) → audit (`services/audit_service.py`).
Gmail outcome is **draft-only** (no send) per DEC-P01-03.

### F4 — Reminders & deadlines

Scheduler agent + reminder agent (`agents/scheduler_agent/`,
`agents/reminder_agent/`, tables `schedule_events`, `agent_schedules`) →
notifications (`services/notification_service.py`, `notifications` table).
**Gmail watch reconciliation:** polling-first remains the MVP trigger
(`STAKEHOLDER_DECISION` DEC-P02-01); however `start_watch`/`stop_watch` +
`gmail_watches` state (status, expiration, last_reconciled_at) now EXIST
(REPO_VERIFIED `clients/gmail_client.py:160-174`,
`migrations/0007_gmail_watch.py`) — watch state is persisted for the P15+ push
path / proactive refresh, NOT wired as the authoritative MVP ingest trigger
(NEW_DESIGN).

### F5 — Export / erasure

GDPR + consent routers (`services/gdpr.py`, `services/consent.py`, mounted under
`/api/v1`) → JSON archive export; erasure across
relational/vector/search/object/cache/queue (FR-61); deletion receipt
distinguishes primary vs backup expiry (FR-62) via `services/retention.py`
(`RetentionPolicy`, `RetentionScheduler`). **Legal hold (FR-61/62 nuance): no
hold flag found — UNVERIFIED**; full erasure matrix is P13 (design-only here).

## 6. Degradation model — BQ-P05-01: 99% best-effort, NO SLA (`STAKEHOLDER_DECISION`)

| Component down          | Degraded mode                                                                                                                                                                                                                | Recovery / evidence                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| LLM provider            | Ingest/RAG/assist degrade to "unavailable"; retries (tenacity, `services/llm_service.py:22-53`); mock LLM in dev; circuit breaker (`infrastructure/circuit_breaker.py`), agent fallback (`infrastructure/agent_fallback.py`) | Re-queue on recovery; `qa_validator` gates partial output                                                       |
| Gmail (down / quota)    | Poll fails → marked skipped; drafts unavailable; watch renewal deferred                                                                                                                                                      | Retry with backoff (gmail client retry wiring UNVERIFIED); polling-first tolerates outage                       |
| Redis down              | Queue/worker stall; **no work processed** (BullMQ worker, `workers/queue_worker.py`)                                                                                                                                         | Restart Redis → re-drive queues; cache miss tolerated (`services/cache_service.py`)                             |
| Postgres down           | All reads/writes fail; RLS/tenant scoping unavailable                                                                                                                                                                        | 99%-class PaaS HA (ADR-026, NEW_DESIGN); no local read replica in MVP                                           |
| Object store (MinIO/S3) | Upload/download fail; documents stored elsewhere (DB) remain                                                                                                                                                                 | Retry (`services/storage_service.py`); no object mirror in MVP                                                  |
| Search/vector stale     | Projections lag → retrieval returns stale results                                                                                                                                                                            | Rebuild jobs (ADR-024) re-index from relational rows; Meilisearch + pgvector are non-authoritative (NEW_DESIGN) |

All degraded modes preserve the approval/draft-only invariants: **no send, no
auto-apply, no unsupervised consequential action** under any component failure
(FR-51).
