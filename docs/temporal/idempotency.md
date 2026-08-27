# Idempotency & Consistency (Phase 12 — ADR-038 §7, §33, §45)

**This page is the normative idempotency contract. All handlers must satisfy
it.**

## Deterministic Workflow IDs (§7)

Every Temporal start uses a content-derived, workspace-scoped ID. Duplicate
requests with same logical key hit `WorkflowExecutionAlreadyStarted` → safe
`AlreadyStarted` → `already_started` JSON, not a second execution.

| Operation         | ID formula                                                  | Duplicate effect                                                                                        |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Ingest            | `ingest:{workspace_id}:{content_hash}:{document_id}`        | Second upload of same bytes returns same workflow, not second memory batch                              |
| Connector sync    | `connector_sync:{workspace_id}:{connector_id}:{sync_token}` | Token = first 8 of connector_id or caller-provided; same token within dedup window is idempotent        |
| Event             | `event:{workspace_id}:{event_type}:{event_id}`              | Publishing same event twice (retry) starts workflow once; second gets `AlreadyStarted`                  |
| Approval          | `approval:{workspace_id}:{approval_id}`                     | One human decision → one wait; second `approve` signals same workflow (no second execution)             |
| Durable agent run | `durable_run:{workspace_id}:{user_id}:{request_id}`         | `request_id` is caller-supplied UUID → dedup per chat turn                                              |
| Schedule          | `sched:{workspace_id}:{schedule_id}`                        | Temporal Schedule ID, not workflow ID; `create` with same ID → `AlreadyExists` → `handle.update()` path |

All IDs include `workspace_id`, so cross-workspace replay cannot collide.

## DB idempotency keys (external side effects §33)

Temporal gives **at-least-once** activity execution. Every non-idempotent
external write is double-guarded:

- **Memory writes** (`write_memory` / `executor.create_entity`):
  `SELECT Entity WHERE workspace_id=:ws AND canonical_name=:name` before
  `INSERT` (§7). Double-merge → `already exists` error → activity returns 0 new,
  no duplicate row.
- **Documents**: PK `documents.id` UUID; activity `parse_document` does
  `SELECT ... WHERE id AND workspace_id` before any derived write.
- **Connectors sync**: `connector_ext_service.trigger_sync` is timestamp-only
  stub today; real provider calls are `GET` (idempotent) or carry
  `Idempotency-Key: {workflow_id}:{activity_id}` header when `POST` (provider
  respects it). Schedule dedup key `sched_job:{job_id}:{slot_minute}` via
  `SETNX vaeloom:daemon:claim:{key} EX 120` while daemon legacy still runs.
- **Approvals**: `agent_approvals` `UNIQUE(workspace_id, idempotency_key)` is
  commented ready; current dedup is workflow ID + `SELECT before INSERT` on
  decision.

If you add a new activity that writes externally, you **must** add a
`SELECT before INSERT/UPSERT` with a workspace-scoped unique key, and make the
activity return `already_exists` as success (0 diff) rather than throwing
non-retryable.

## Payload size (§16)

Workflow inputs are **IDs/refs only** — `document_id`, `workspace_id`,
`content_hash`, `connector_id`, `approval_id`, `event_id`. Secrets, OAuth
tokens, file bytes, full email bodies, huge model contexts never enter history.
Activities resolve secrets via `SecretManager` / `provider_key_service` inside
the worker process.

## Consistency — domain vs workflow state (§45)

| Store                                 | Owns                                     | Example                                                                                  |
| ------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| **App Postgres** (domain state)       | Business truth that outlives executions  | `application.status`, `memory.status`, `document.path`, `agent_approval.status`, `audit` |
| **Temporal history** (workflow state) | Execution lifecycle that can be replayed | `current step`, `pending signal`, `retry count`, `timer`, `approval wait`                |

Never mix them:

- Do not `SELECT` workflow status from Postgres (use
  `handle.query("getStatus")`).
- Do not `UPDATE` domain rows from workflow history replay (activities own
  writes).
- No distributed transaction: workflow may retry activity while DB already
  committed. Hence every DB write must be **idempotent** as above.

### Outbox

Where a DB transaction + external side effect must be atomically visible (e.g.,
schedule created + Temporal Schedule created), use the **outbox** already in
`scheduler_service.create_job`: DB `INSERT` commits first, then Temporal
`create_or_update_schedule` is fire-and-forget `create_task`. If Temporal was
down, the next `update` or a reconciliation job re-creates the schedule from the
DB row. No two-phase commit, no silent loss.

## Exactly-once claims (§33 — precise language)

We **never** claim "exactly once" execution. We deliver:

- **At-least-once** Temporal execution (retries until `maximumAttempts`).
- **Idempotent** domain side effects (duplicate retries yield 0 diff).
- **Deduplicated** domain operations (deterministic workflow ID collapses
  duplicate requests).

UIs show `queued→running→retrying→completed/failed/cancelled` from real
`query.getStatus`, never a fake spinner.
