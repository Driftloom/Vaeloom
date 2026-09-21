# ADR-045: Transactional Outbox for DB+Broker Dual-Write Safety

| Metadata     | Value                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| **Status**   | Accepted (slice 1)                                                                                    |
| **Date**     | 2026-09-22                                                                                            |
| **Deciders** | Backend Lead                                                                                          |
| **Owner**    | Backend Team                                                                                          |
| **Tags**     | architecture, events, queue, redis, durability                                                        |
| **Related**  | ADR-028 (BullMQ event topology), ADR-033 (daemon claim/enqueue), ADR-038 (Temporal durable execution) |

## Context

Publishers today commit a domain row to Postgres and then enqueue to Redis
(BullMQ hashes `bull:{queue}:{wait|delayed|failed}`, `queue_worker.py:55`) in
**two separate steps**. A crash between them produces either:

- a **ghost job** — Redis holds a job whose DB truth never committed, or
- a **lost job** — the DB row committed but the enqueue never happened.

The durable-scheduling work (ADR-033 daemon `SETNX` claim + enqueue) narrowed
this window for cron slots but did not close it for general event publishers
(`EventService.publish` commits the `events` row, then fire-and-forget Temporal
dispatch — same two-step hazard).

## Decision

Adopt the **transactional outbox pattern**, in two loops:

**Slice 1 (this ADR — implemented):**

- `outbox_events` table (migration `0051`, PG DDL + SQLite-compatible): `id`
  UUID PK, `tenant_id` / `workspace_id` scoping, `event_type`, `payload` JSON,
  `status` (`pending`/`claimed`/`published`/`failed`), `attempts`,
  `next_attempt_at`, `last_error`, timestamps; index on
  `(status, next_attempt_at)` for the relay scan.
- Writer `services/outbox.record_outbox_event(db, ...)` — stages the row on the
  **caller's transaction**, never commits. Same commit covers domain row
  - outbox row; rollback removes both.
- Atomic claim `claim_outbox_event(db)` — oldest-due `pending` row, guarded
  `UPDATE ... WHERE id AND status='pending'` as the single atomic gate (portable
  PG + SQLite; one code path, no `FOR UPDATE` dialect split).
- Stub relay `publish_due_events(db, publisher=None)` — claims due rows and,
  with no publisher, marks them `published` to exercise the full cycle.
  Publisher exceptions → `pending` with backoff, or `failed` after
  `max_attempts`. Default-off via `settings.outbox_relay_enabled`
  (`OUTBOX_RELAY_ENABLED`, default `False`).
- ORM model `OutboxEvent` in `models/schema.py`, exported from `api.models`.

**Loop 2 (explicitly NOT this slice):** rewire existing publishers to write via
`record_outbox_event` instead of direct enqueue; pass a real BullMQ/Redis
publisher into `publish_due_events`; run it on a timer (daemon or Temporal
workflow); dead-letter triage for `failed` rows; RLS policy for the new table.

## Rationale

| Alternative                                 | Why not                                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Direct DB→Redis in one request (status quo) | The hazard this ADR closes                                                                                              |
| PG `LISTEN/NOTIFY` as the broker            | Ephemeral — missed notifications on relay downtime; still needs a table                                                 |
| `SELECT ... FOR UPDATE SKIP LOCKED` claim   | PG-only; slice 1 keeps one portable path. Revisit if relay throughput demands it                                        |
| Appending to ADR-028                        | ADR-028 is `Accepted` and describes BullMQ topology; outbox is a separate durability mechanism deserving its own record |

## Consequences

**Positive:**

- Dual-write window closed at the source: no ghost jobs, no lost jobs for
  rewired publishers.
- At-least-once delivery with bounded retries and a visible `failed` state (vs
  today's silent loss).
- Relay scan is index-backed; writer adds one INSERT to an existing txn.

**Negative / risks:**

- At-least-once means consumers MUST be idempotent (key on `outbox_events.id`).
  Crash between broker publish and the `published` mark redelivers.
- New table has no RLS policy yet (relay runs as service role; Loop 2 adds the
  policy alongside publisher rewiring).
- Until Loop 2 rewires publishers, the table is write-only infrastructure — no
  production traffic flows through it.

## Verification

1. `pytest tests/test_outbox.py` — writer persists in-txn / vanishes on
   rollback; two claimants → one winner; stub relay marks published; failure →
   backoff retry → `failed`; disabled relay no-ops.
2. `alembic upgrade head` on PG + `Base.metadata.create_all` on SQLite both
   create `outbox_events` (migration `0051` guards types per dialect).
3. Loop 2 gate: at least one production publisher writing via
   `record_outbox_event` + relay enabled + `failed`-row alert.

## Reversibility

High — slice 1 adds a table, a service module, and a default-off flag. No
existing publisher behavior changes. Dropping = migration `0051` downgrade +
delete three files.
