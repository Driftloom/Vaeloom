# MVP-P08 — 03. OpenAPI Contracts (DEL-MVP-P08-01)

> Owner: API Architect · Design = deltas over live snapshot (72 paths). Static
> OpenAPI 3.1 file committed at P11; compat tests from P11.

## 1. Contract conventions

| Convention  | Design                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Version     | `/api/v1` prefix (exists) + `X-API-Version` header pin (api_version middleware exists)                                                                                         |
| OpenAPI     | 3.1 pinned (EXT-08); `openapi.json` generated from FastAPI; static copy at `docs/contracts/openapi.yaml` from P11; CI diff check                                               |
| Errors      | RFC 9457 problem+json: `type, title, status, detail, instance, trace_id` — unified via exception_handler (exists; align envelope)                                              |
| Idempotency | `Idempotency-Key` header on consequential POSTs (approval-execute, application submit, job triggers, gdpr/delete) → 409 on replay of different payload, 200/201 replay of same |
| Async jobs  | 202 + `Job` resource (`/api/v1/jobs/{job_id}` status poll) for: parse, export, erase, watcher sync, embedding rebuild                                                          |
| Pagination  | `limit` (default 25, max 100) + `cursor` opaque; list responses `{items, next_cursor}`                                                                                         |
| Timestamps  | ISO-8601 UTC everywhere                                                                                                                                                        |

## 2. Approval API (NEW — ADR-021, release-blocking)

| Endpoint                                          | Method | Contract                                                                                                                                                                          |
| ------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/workspaces/{ws}/approvals`               | POST   | body: `action_type, payload, scope_claims, ttl_seconds`; computes `payload_hash` (SHA-256); returns `approval_request` w/ `expires_at`                                            |
| `/api/v1/workspaces/{ws}/approvals`               | GET    | filter: status, action_type; list w/ cursor                                                                                                                                       |
| `/api/v1/workspaces/{ws}/approvals/{id}`          | GET    | full record incl. hash + decision                                                                                                                                                 |
| `/api/v1/workspaces/{ws}/approvals/{id}/decision` | POST   | body: `{decision: approved                                                                                                                                                        | rejected, client_context}`; immutable — second post → 409 (replayed) |
| `/api/v1/workspaces/{ws}/approvals/{id}/execute`  | POST   | requires `Idempotency-Key`; verifies: status=approved, not expired (FR-51), payload hash matches, per-user T3 enablement for send-class actions; executes → `agent_action` record |
| `/api/v1/workspaces/{ws}/approvals/{id}/revoke`   | POST   | user revoke of pending approval                                                                                                                                                   |

Status machine: `pending → approved → executed | expired`; `pending → rejected`;
any → `replayed` (guard). Audit event on every transition (audit service).

## 3. Memory API deltas (ADR-022, additive)

| Endpoint                | Delta                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /memories`        | accept `domain: profile                                                                                                                     | document | career | episodic | preference | working`; free-form `type` retained as sub-type; CHECK enforced (P07 0004) |
| `PUT /memories/{id}`    | correction creates supersession: new row `supersedes_id` → old row `status=SUPERSEDED` (FR-68); returns both ids                            |
| `POST /memories/search` | retrieval contract: `query, domains[], limit`; response `{items, hit_metric, model_version, embedding_model}` (provenance — BQ-P02-03 ≥80%) |
| `GET /memories`         | default excludes SUPERSEDED + deleted; `include_superseded=true` opt-in                                                                     |

## 4. Gmail watcher API (NEW — FR-40, DEC-P02-01)

| Endpoint                                         | Contract                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/workspaces/{ws}/gmail/watch`       | start polling watcher; body `{interval_minutes (default 15), scopes}`; returns watcher state                          |
| `GET  /api/v1/workspaces/{ws}/gmail/watch`       | status: last_poll_at, last_history_id, state (active/paused/degraded/error), quota_used_units                         |
| `POST /api/v1/workspaces/{ws}/gmail/watch/pause` | pause (kill-switch path AUTO-01)                                                                                      |
| `POST /api/v1/workspaces/{ws}/gmail/watch/sync`  | manual sync → 202 async job; deadline facts extracted (FR-41 ≥90%) with provenance `{message_id, source, confidence}` |
| Draft contract                                   | `gmail_client.create_draft` only — NO send endpoint without T3 per-user enablement (DEC-P02-05, ADR-021)              |

## 5. Rights endpoints (DPDP — existing, hardened)

| Endpoint                       | Status | Delta                                                                                            |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------ |
| `POST /gdpr/delete`            | exists | idempotency key; erasure job 202; receipt w/ primary-deletion vs backup-expiry semantics (FR-62) |
| `GET /gdpr/export`             | exists | async job → signed URL (NFR-23); archive manifest                                                |
| `POST /consent/grant`          | exists | add `consent_version`; record stored (NFR-17, P07 0006)                                          |
| `POST /consent/revoke/{scope}` | exists | revocation → dependent connectors pause (Gmail watch stops)                                      |

## 6. Error + edge behavior (prompt §13)

Timeout (connector 10s, LLM 30s/embed 10s, DB 5s) · retry exponential+jitter, no
sync storms · cancel path on async jobs · partial failure per-item in batch
ingest · stale/duplicate/out-of-order via idempotency + dedup · provider outage
→ 503 `degraded` + circuit breaker state in `GET /health/ready`.
