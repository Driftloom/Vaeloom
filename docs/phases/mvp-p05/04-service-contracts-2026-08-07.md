# MVP-P05 — 04. Service Contracts (DEL-MVP-P05-02)

> Owner: Solution Architect · Contracts to be pinned/implemented at P08 (OpenAPI
> 3.x). Repo truth: FastAPI dynamic spec today; no static file.

## 1. API contracts

| Contract           | Current state                       | Target (P08)                                                                    |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------- |
| Base path          | `/api/v1` (24 routers)              | Keep; version pin in URL (api_version middleware exists)                        |
| OpenAPI            | dynamic `/openapi.json` only        | Static pinned OpenAPI 3.1 file + compatibility test (EXT-08)                    |
| Error envelope     | per-router                          | Uniform RFC 9457 problem+json: type, title, status, detail, instance, trace_id  |
| Auth               | Bearer JWT + refresh                | Keep (ADR-007); refresh rotation + single-flight already in web client          |
| Pagination/filters | varied                              | Standard query params: `limit`, `cursor`, `sort`                                |
| Idempotency        | **absent**                          | `Idempotency-Key` header on consequential mutations (ADR-021)                   |
| CSRF               | token endpoint + SKIP_PREFIXES auth | Keep; verify skip list covers only auth prefixes (critical: it does)            |
| Connector auth     | OAuth2 refresh flow in gmail_client | RFC 9700: PKCE, exact redirect match, constrained tokens, refresh rotation (B3) |

## 2. Events & queue contracts

| Topic/queue              | Producer                              | Consumer                  | Payload contract                                                        |
| ------------------------ | ------------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `bull:ingest:*`          | API                                   | BullMQWorker (exists)     | job_type, payload_ref (doc_id), idempotency key, tenant/workspace scope |
| `bull:mail:*`            | polling watcher (NEW)                 | worker → extraction agent | message_id, history payload, scopes                                     |
| `bull:schedule:*`        | Scheduler agent                       | worker                    | schedule_event_id, due_at, recurrence                                   |
| `dead-letter`            | BullMQWorker (DeadLetterEvent exists) | reconciliation job        | original job, error, attempts, payload_ref                              |
| Event/event_subscription | event_service (exists)                | subscribers               | typed events; audit on emit                                             |

- Events carry tenant/workspace scope + correlation_id; never raw secrets or
  personal payloads beyond referenced IDs (prompt §20).

## 3. Approval contract (ADR-021 — new)

| Field                   | Type                                       | Notes                                            |
| ----------------------- | ------------------------------------------ | ------------------------------------------------ |
| id, workspace_id        | UUID                                       | scoped                                           |
| action_type             | enum                                       | e.g. `gmail_send`, `job_submit`, `reminder_send` |
| payload                 | JSONB                                      | the exact intended action (immutable)            |
| payload_hash            | SHA-256                                    | binding; tamper detection                        |
| scope                   | JSONB                                      | read/write scopes claimed                        |
| ttl_seconds             | int                                        | expiry (FR-51)                                   |
| status                  | pending/approved/rejected/expired/replayed | transitions recorded                             |
| decision_by, decided_at | user id + ts                               | immutable audit                                  |
| idempotency_key         | string                                     | replay guard on execution                        |
| created_at              | ts                                         |                                                  |

Flow: propose (persist) → user decision (immutable) → execute with idempotency
key → audit (audit service exists).

## 4. Projection contracts (ADR-024)

| Projection                 | Source (authoritative) | Rebuild trigger           | Provenance                           |
| -------------------------- | ---------------------- | ------------------------- | ------------------------------------ |
| Embeddings (pgvector 1536) | Document/Memory rows   | change event, rebuild job | source_id, model_version, created_at |
| Entity/Relationship graph  | Memory rows            | change event              | source_id, version                   |
| Meilisearch index          | Document/Memory rows   | change event              | source_id, schema_version            |

- All projections carry provenance (INT-02 §5); rebuild = delete + replay from
  relational truth; never the reverse.

## 5. Connector contracts

| Connector                          | Scope                          | Mode                                         | Contract                                                                   |
| ---------------------------------- | ------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------- |
| Gmail                              | read-only + drafts             | polling MVP (DEC-P02-01); push path reserved | OAuth2 PKCE; quota pacing (15,000 units/min/user; list=5, watch=100 units) |
| Calendar/Drive/Notion/Slack/GitHub | enterprise-gated               | disabled                                     | out of MVP critical path                                                   |
| Job sources T1                     | lawful official endpoints only | read                                         | no scraping (ASP-04); T2 gated AUTO-02                                     |
| MCP/GraphQL/REST connectors        | SDK/extension surface          | enabled per workspace                        | EXT-01 pinned 2026-07-28                                                   |

## 6. Data & lifecycle contract (prompt §17)

Owner/source/purpose/classification/scope/residency/schema-version/quality/
retention/deletion/consumers recorded per dataset at P07 (data dictionary).
Stable IDs + versioned mappings; correction/supersession history; primary
deletion vs backup expiry vs legal hold distinct (FR-62).
