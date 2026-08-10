# MVP-P08 — 04. Events / Webhooks / Job Schemas (DEL-MVP-P08-02)

> Owner: Integration Engineer · Built on existing: `events`,
> `event_subscriptions`, `dead_letter_events` tables + `event_service` +
> BullMQ-compatible worker.

## 1. Event schema (canonical envelope)

```json
{
  "event_id": "uuid",
  "correlation_id": "uuid",
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

## 2. Event types (MVP)

| Type                                                            | Producer             | Consumers                                            |
| --------------------------------------------------------------- | -------------------- | ---------------------------------------------------- |
| `memory.updated` / `memory.superseded`                          | memory service       | projection jobs, search index, chat RAG invalidation |
| `document.ingested`                                             | ingestion pipeline   | embedding job, memory extraction agent               |
| `application.created` / `application.outcome_changed`           | applications service | memory (episodic), UI notifications                  |
| `approval.requested` / `approval.decided` / `approval.executed` | approval service     | audit, notifications, agent orchestration            |
| `schedule.due`                                                  | scheduler            | notification worker                                  |
| `gmail.watch.degraded` / `gmail.watch.recovered`                | watcher              | alerts, UI banner                                    |
| `job.completed` / `job.failed`                                  | queue worker         | status polling (202 jobs)                            |

## 3. Webhooks (enterprise-gated — CF-P08-01)

`webhooks` + `webhook_deliveries` tables exist; router enterprise-gated. MVP:
subscriptions only. If enabled later (change control): signed payloads (HMAC
`X-Vaeloom-Signature`), dedup by `event_id`, retry w/ backoff, out-of-order
tolerance, `X-Vaeloom-Delivery` id header.

## 4. Job contract (BullMQ-compatible worker)

| Job type             | Queue           | Payload (refs only)          | Idempotency                       |
| -------------------- | --------------- | ---------------------------- | --------------------------------- |
| `ingest.document`    | `bull:ingest`   | doc_id, version              | dedup by content_hash + doc_id    |
| `embed.memory`       | `bull:embed`    | memory_id, model_version     | re-run safe (upsert)              |
| `gmail.poll`         | `bull:mail`     | workspace_id, cursor         | unique per workspace (no overlap) |
| `extract.deadlines`  | `bull:mail`     | message_ids                  | per-message dedup                 |
| `approval.execute`   | `bull:action`   | approval_id, idempotency_key | replay-safe (ADR-021)             |
| `export.user`        | `bull:rights`   | workspace_id, format         | job-scoped                        |
| `erase.user`         | `bull:rights`   | workspace_id, request_id     | receipt                           |
| `projection.rebuild` | `bull:proj`     | projection, scope, trigger   | exclusive lock per scope          |
| `reminder.send`      | `bull:schedule` | schedule_event_id            | due-window dedup                  |

- Worker: concurrency semaphore (exists), DLQ (DeadLetterEvent exists),
  reconciliation replay job, no synchronized retries (P05 §7).
- Queue lag + DLQ depth metrics at P17 (prompt §19).
