# MVP-P08 — 03. OpenAPI Contracts (DEL-MVP-P08-01)

> Owner: API Architect · Re-run 2026-08-17. Design = gaps over live 79-path
> surface. Static OpenAPI 3.1 file committed; compat tests from P11.

## 1. Contract conventions

| Convention  | Current state + delta                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Version     | `/api/v1` prefix (exists) + `X-API-Version: 1` header (exists, hardcoded). **Delta:** add `Accept` header version negotiation + `Sunset` header for deprecation                      |
| OpenAPI     | 3.1 pinned (EXT-08); `docs/backend/openapi.yaml` (5630 lines, 79 paths). **Delta:** CI drift check (openapi-diff), generated from FastAPI at build time                              |
| Errors      | Custom format `{success, error: {code, message, details}}`. **Delta:** migrate to RFC 9457 `application/problem+json` with `type, title, status, detail, instance, trace_id`         |
| Idempotency | `Idempotency-Key` header on 4 prefix groups (consent/grant, consent/revoke, gdpr/delete, approvals). **Delta:** extend to application submit, agent execute                          |
| Async jobs  | Scheduler CRUD at `/api/v1/scheduler/jobs/{job_id}` (cron-based). **Delta:** add general-purpose `/api/v1/jobs/{job_id}` for one-off async operations (export, erase, embed rebuild) |
| Pagination  | Not implemented on most list endpoints. **Delta:** `limit` (default 25, max 100) + `cursor` opaque; list responses `{items, next_cursor, has_more}`                                  |
| Timestamps  | ISO-8601 UTC everywhere (verified in schemas)                                                                                                                                        |

## 2. Approval API — IMPLEMENTED (5 endpoints)

> ADR-021. Approval API was "design-only, release-blocking" in prior P08 run.
> **Now fully implemented** with DB persistence, audit logging, auto-expiry, and
> idempotency.

| Endpoint                                  | Method | Status      | Implementation                                             |
| ----------------------------------------- | ------ | ----------- | ---------------------------------------------------------- |
| `/api/v1/approvals`                       | POST   | IMPLEMENTED | `services/approval.py:197` — creates pending, audit logged |
| `/api/v1/approvals`                       | GET    | IMPLEMENTED | `services/approval.py:229` — paginated, auto-expires stale |
| `/api/v1/approvals/{approval_id}`         | GET    | IMPLEMENTED | `services/approval.py:249` — single fetch with auto-expiry |
| `/api/v1/approvals/{approval_id}/approve` | POST   | IMPLEMENTED | `services/approval.py:260` — approve, 409 on duplicate     |
| `/api/v1/approvals/{approval_id}/reject`  | POST   | IMPLEMENTED | `services/approval.py:284` — reject, 409 on duplicate      |

Status machine: `PENDING → APPROVED → EXECUTED | EXPIRED`; `PENDING → REJECTED`.
Auto-expiry via `_expire_stale()` on get/list. All mutations emit audit events.
Idempotency middleware covers POST/PUT/PATCH to `/api/v1/approvals`.

### Remaining gap (design delta)

- No `/api/v1/approvals/{id}/execute` endpoint — execution is handled by agent
  orchestrator after approval, not via a separate execute endpoint. This is a
  design simplification: approval → agent action is internal, not user-facing.
- No `/api/v1/approvals/{id}/revoke` endpoint — user can reject but not revoke a
  pending approval after submission. **Delta:** add revoke endpoint for UX.

## 3. Memory API deltas (ADR-022, additive)

| Endpoint                | Current state + delta                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /memories`        | Accepts free-form `type` string. **Delta:** accept `domain` enum (profile/document/career/episodic/preference/working); free-form `type` retained as sub-type |
| `PUT /memories/{id}`    | In-place update. **Delta:** correction creates supersession: new row `supersedes_id` → old row `status=SUPERSEDED`; returns both ids                          |
| `POST /memories/search` | Basic search. **Delta:** response includes `model_version`, `embedding_model` for provenance (BQ-P02-03 ≥80%)                                                 |
| `GET /memories`         | Returns all. **Delta:** default excludes SUPERSEDED + deleted; `include_superseded=true` opt-in                                                               |

## 4. Gmail API — IMPLEMENTED (6 endpoints)

> Prior P08: "draft-only, design-only". **Now implemented with 6 endpoints.**

| Endpoint                | Method | Status      | Implementation                                           |
| ----------------------- | ------ | ----------- | -------------------------------------------------------- |
| `/api/v1/gmail/watch`   | POST   | IMPLEMENTED | `routers/gmail.py:27` — starts push notification watch   |
| `/api/v1/gmail/watch`   | GET    | IMPLEMENTED | `routers/gmail.py:40` — watch status                     |
| `/api/v1/gmail/watch`   | DELETE | IMPLEMENTED | `routers/gmail.py:51` — stops watch                      |
| `/api/v1/gmail/drafts`  | POST   | IMPLEMENTED | `routers/gmail.py:64` — creates draft                    |
| `/api/v1/gmail/drafts`  | GET    | IMPLEMENTED | `routers/gmail.py:80` — lists drafts                     |
| `/api/v1/gmail/webhook` | POST   | IMPLEMENTED | `routers/gmail.py:97` — Google push notification handler |

**No send endpoint** — draft-only constraint (DEC-P02-05) honored. Webhook
validates `X-Goog-Channel-ID` and `X-Goog-Resource-State` headers.

### Remaining gap (design delta)

- No `/api/v1/gmail/watch/pause` endpoint — pause is via DELETE (stop).
  **Delta:** add explicit pause endpoint for kill-switch UX without full stop.
- No manual sync trigger. **Delta:** add `POST /api/v1/gmail/watch/sync` → 202
  async job for on-demand deadline extraction.

## 5. Rights endpoints (DPDP — IMPLEMENTED, gaps below)

| Endpoint                       | Status      | Delta                                                                             |
| ------------------------------ | ----------- | --------------------------------------------------------------------------------- |
| `POST /gdpr/delete`            | IMPLEMENTED | Idempotency key covered; erasure covers 12/38 tables. **Delta:** expand coverage  |
| `GET /gdpr/export`             | IMPLEMENTED | Returns inline JSON. **Delta:** async job → signed URL for large exports (NFR-23) |
| `POST /consent/grant`          | IMPLEMENTED | Idempotency key covered. **Delta:** add `consent_version` field                   |
| `POST /consent/revoke/{scope}` | IMPLEMENTED | Revokes consent. **Delta:** dependent connectors auto-pause (Gmail watch stops)   |
| `GET /consent/me`              | IMPLEMENTED | Lists consent records. No delta needed                                            |
| `GET /consent/scopes`          | IMPLEMENTED | Returns available scopes. No delta needed                                         |

## 6. Error + edge behavior (prompt §13)

| Concern         | Current state + delta                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Timeout         | Not configured per-endpoint. **Delta:** connector 10s, LLM 30s/embed 10s, DB 5s                      |
| Retry           | Webhook retry exists (exponential). **Delta:** apply same pattern to connector calls                 |
| Cancel path     | Missing for async operations. **Delta:** `DELETE /api/v1/jobs/{job_id}` cancels running job          |
| Partial failure | Not handled in batch operations. **Delta:** per-item error array in batch ingest response            |
| Stale/duplicate | Idempotency covers 4 prefixes. **Delta:** extend to all consequential POSTs                          |
| Provider outage | Circuit breaker exists (ADR-017). **Delta:** expose state in `GET /health/ready` response            |
| Backpressure    | Rate limiting exists (ADR-012). **Delta:** 429 responses include `Retry-After` (already implemented) |

## 7. New endpoints to design (gaps identified)

| Endpoint                             | Purpose                         | Priority | Target phase |
| ------------------------------------ | ------------------------------- | -------- | ------------ |
| `POST /api/v1/jobs`                  | Submit async job (export/erase) | HIGH     | P11          |
| `GET /api/v1/jobs/{job_id}`          | Poll async job status           | HIGH     | P11          |
| `DELETE /api/v1/jobs/{job_id}`       | Cancel running job              | HIGH     | P11          |
| `POST /api/v1/approvals/{id}/revoke` | Revoke pending approval         | HIGH     | P11          |
| `POST /api/v1/gmail/watch/pause`     | Pause watcher (kill-switch)     | MED      | P11          |
| `POST /api/v1/gmail/watch/sync`      | Manual sync → 202 async job     | MED      | P11          |
| `GET /api/v1/dead-letter-events`     | List/manage DLQ entries         | MED      | P12          |
| `POST /api/v1/webhooks/{id}/verify`  | Verify webhook signature        | MED      | P12          |
| `PATCH /api/v1/memories/{id}`        | Supersession-aware correction   | HIGH     | P11          |
