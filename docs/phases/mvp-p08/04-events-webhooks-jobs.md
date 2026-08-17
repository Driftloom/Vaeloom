# MVP-P08 — 04. Events / Webhooks / Job Schemas (DEL-MVP-P08-02)

> Owner: Integration Engineer · Re-run 2026-08-17. Built on existing: `events`,
> `event_subscriptions`, `dead_letter_events` tables + `event_service` +
> BullMQ-compatible worker + webhook service.

## 1. Event schema (canonical envelope)

```json
{
  "event_id": "uuid",
  "correlation_id": "uuid",
  "causation_id": "uuid | null",
  "type": "vaeloom.memory.updated",
  "version": "1",
  "scope": { "tenant_id": "uuid", "workspace_id": "uuid" },
  "subject": { "id": "uuid", "kind": "memory" },
  "payload_ref": { "table": "memories", "row_id": "uuid", "version": 3 },
  "occurred_at": "ISO-8601",
  "producer": "memory_service"
}
```

- No raw personal content in event payloads — references only (prompt §20).
- `correlation_id` propagated from request via middleware (exists).
- `causation_id` links to the event that triggered this event (chained
  causation).

## 2. Event types (MVP)

| Type                                                            | Producer             | Consumers                                            | Status      |
| --------------------------------------------------------------- | -------------------- | ---------------------------------------------------- | ----------- |
| `memory.updated` / `memory.superseded`                          | memory service       | projection jobs, search index, chat RAG invalidation | PARTIAL     |
| `document.ingested`                                             | ingestion pipeline   | embedding job, memory extraction agent               | PARTIAL     |
| `application.created` / `application.outcome_changed`           | applications service | memory (episodic), UI notifications                  | PARTIAL     |
| `approval.requested` / `approval.decided` / `approval.executed` | approval service     | audit, notifications, agent orchestration            | IMPLEMENTED |
| `schedule.due`                                                  | scheduler            | notification worker                                  | PARTIAL     |
| `gmail.watch.degraded` / `gmail.watch.recovered`                | watcher              | alerts, UI banner                                    | MISSING     |
| `job.completed` / `job.failed`                                  | queue worker         | status polling (202 jobs)                            | MISSING     |

**Status meanings:**

- IMPLEMENTED: event type + producer + consumers all wired
- PARTIAL: event type defined but producer or consumer not fully wired
- MISSING: no producer or consumer implementation

## 3. Existing event system (IMPLEMENTED)

### What exists

| Component               | File                        | Status      | Notes                                                             |
| ----------------------- | --------------------------- | ----------- | ----------------------------------------------------------------- |
| Event model             | `models/schema.py:590-615`  | IMPLEMENTED | type, source, category, status, priority, payload, correlation_id |
| EventSubscription model | `models/schema.py:617-628`  | IMPLEMENTED | event_type, handler_id, handler_type, config                      |
| DeadLetterEvent model   | `models/schema.py:629-638`  | IMPLEMENTED | original_event_id, error, error_count, payload                    |
| Event router            | `routers/events.py`         | IMPLEMENTED | publish, list, subscriptions                                      |
| Event service           | `services/event_service.py` | IMPLEMENTED | publish + subscription management                                 |
| Queue worker            | `workers/queue_worker.py`   | IMPLEMENTED | BullMQ-compatible, concurrency semaphore                          |

### What's missing

| Gap                                | Impact                           | Target |
| ---------------------------------- | -------------------------------- | ------ |
| No event filtering by type/version | Consumers get all events         | P12    |
| No event replay API                | DLQ recovery manual              | P12    |
| No dead letter management API      | DLQ entries invisible            | P12    |
| No event archival/retention policy | Events accumulate forever        | P14    |
| No event versioning semantics      | Breaking event schema undetected | P12    |

## 4. Webhooks (enterprise-gated — CF-P08-01)

### What exists

| Component             | File                          | Status           |
| --------------------- | ----------------------------- | ---------------- |
| Webhook model         | `models/schema.py:659-673`    | IMPLEMENTED      |
| WebhookDelivery model | `models/schema.py:675-690`    | IMPLEMENTED      |
| Webhook router        | `routers/webhooks.py`         | ENTERPRISE-GATED |
| Webhook service       | `services/webhook_service.py` | IMPLEMENTED      |

### Webhook delivery contract

```json
{
  "event_type": "vaeloom.memory.updated",
  "payload": { "event_id": "uuid", "type": "...", "payload_ref": "..." },
  "delivery_id": "uuid",
  "timestamp": "ISO-8601"
}
```

**Headers sent:**

- `X-Webhook-Signature`: HMAC-SHA256 hex digest of payload using webhook secret
- `X-Webhook-Event`: event type string
- `X-Webhook-Delivery`: delivery UUID

### What's missing (design deltas)

| Gap                                | Impact                            | Target |
| ---------------------------------- | --------------------------------- | ------ |
| No consumer-facing verify endpoint | Consumers can't verify signatures | P12    |
| No per-webhook event filtering     | All events delivered to all hooks | P12    |
| No configurable retry policy       | Hardcoded exponential backoff     | P12    |
| No webhook rate limiting           | Destination could be overwhelmed  | P12    |
| No payload encryption/TLS pinning  | Plaintext over TLS only           | P14    |

## 5. Job contract (design delta — no general async job queue exists)

> Current state: scheduler module at `/api/v1/scheduler/jobs` is cron-based
> (active/paused/disabled), NOT a general-purpose async job queue.

### Proposed job types

| Job type             | Queue           | Payload (refs only)          | Idempotency                    | Status  |
| -------------------- | --------------- | ---------------------------- | ------------------------------ | ------- |
| `ingest.document`    | `bull:ingest`   | doc_id, version              | dedup by content_hash + doc_id | MISSING |
| `embed.memory`       | `bull:embed`    | memory_id, model_version     | re-run safe (upsert)           | MISSING |
| `gmail.poll`         | `bull:mail`     | workspace_id, cursor         | unique per workspace           | MISSING |
| `extract.deadlines`  | `bull:mail`     | message_ids                  | per-message dedup              | MISSING |
| `approval.execute`   | `bull:action`   | approval_id, idempotency_key | replay-safe (ADR-021)          | MISSING |
| `export.user`        | `bull:rights`   | workspace_id, format         | job-scoped                     | MISSING |
| `erase.user`         | `bull:rights`   | workspace_id, request_id     | receipt                        | MISSING |
| `projection.rebuild` | `bull:proj`     | projection, scope, trigger   | exclusive lock per scope       | MISSING |
| `reminder.send`      | `bull:schedule` | schedule_event_id            | due-window dedup               | PARTIAL |

### Job resource schema (proposed)

```json
{
  "job_id": "uuid",
  "type": "export.user",
  "status": "queued | running | completed | failed | cancelled",
  "progress": { "current": 0, "total": 100 },
  "result_ref": { "table": "...", "row_id": "..." },
  "error": null,
  "created_at": "ISO-8601",
  "started_at": "ISO-8601 | null",
  "completed_at": "ISO-8601 | null"
}
```

### Queue worker status

| Component           | File                      | Status      |
| ------------------- | ------------------------- | ----------- |
| Worker              | `workers/queue_worker.py` | IMPLEMENTED |
| Concurrency control | `asyncio.Semaphore`       | IMPLEMENTED |
| Graceful shutdown   | Signal handlers           | IMPLEMENTED |
| DLQ                 | `DeadLetterEvent` model   | MODEL ONLY  |
| Reconciliation      | Not implemented           | MISSING     |
| Queue lag metrics   | Not implemented           | MISSING     |
