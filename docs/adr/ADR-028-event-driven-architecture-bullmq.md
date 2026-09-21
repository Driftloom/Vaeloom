# ADR-028: Event-Driven Architecture with BullMQ

| Metadata     | Value                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Status**   | Partially superseded — see addendum 2026-09-21 (ephemeral dispatch retained; durable paths moved to ADR-038/039) |
| **Date**     | 2026-08-16                                                                                                       |
| **Deciders** | Solution Architect, Backend Lead                                                                                 |
| **Owner**    | Backend Team                                                                                                     |
| **Tags**     | architecture, events, queue, redis                                                                               |

## Context

Vaeloom's agent orchestration requires asynchronous processing for document
ingestion, email sync, job search, and memory consolidation. Currently, BullMQ
is installed (`pip install bullmq`) but **zero consumers are deployed**. All
agent execution is synchronous in the FastAPI process. This creates:

- No background job processing
- No retry/backoff for failed operations
- No dead-letter handling
- No queue-based load leveling

## Decision

We will adopt BullMQ as the sole job queue for Vaeloom with the following
topology:

### Queue Topology

| Queue                  | Purpose                                            | Concurrency | Priority   | Retry          |
| ---------------------- | -------------------------------------------------- | ----------- | ---------- | -------------- |
| `document-ingestion`   | PDF/DOCX parsing, OCR, entity extraction           | 5           | Normal     | 3x exponential |
| `agent-execution`      | Orchestrator dispatches to specialist agents       | 10          | Normal     | 3x exponential |
| `email-sync`           | Gmail polling, classification, deadline extraction | 3           | Low        | 5x exponential |
| `job-search`           | Periodic job scraping and ranking                  | 2           | Low        | 3x exponential |
| `memory-consolidation` | Stale memory compression/archival                  | 1           | Background | 3x linear      |
| `audit-log-batch`      | Batch writes to audit log                          | 5           | High       | 5x exponential |

### Dead-Letter Queue (DLQ)

Each queue has a companion `*-dlq` queue. After max retries, jobs move to DLQ
with:

- Full error context (exception, traceback, input payload)
- 30-day retention
- Manual review required before replay or discard

### Event Bus (Redis Pub/Sub)

For real-time, fire-and-forget notifications (NOT job processing):

- Agent completion events → WebSocket push to frontend
- Cache invalidation signals
- Orchestrator coordination messages

**Key distinction:** BullMQ = durable job processing. Redis Pub/Sub = ephemeral
notifications.

## Rationale

| Alternative            | Pros                                               | Cons                                          | Why Not                        |
| ---------------------- | -------------------------------------------------- | --------------------------------------------- | ------------------------------ |
| Celery                 | Mature, large ecosystem                            | Heavy (RabbitMQ/Redis broker), complex config | Overkill for MVP               |
| Redis Queue (rq)       | Simple                                             | No priority, no DLQ, limited retry            | Insufficient features          |
| PostgreSQL-based queue | No extra infra                                     | Polling overhead, no priority                 | Performance concerns           |
| BullMQ (chosen)        | Priority, retry, DLQ, Redis-native, Python support | Newer, smaller ecosystem                      | Best fit for Redis-based stack |

## Consequences

**Positive:**

- Document ingestion becomes async (no request timeout)
- Agent execution can be retried with exponential backoff
- Failed jobs are preserved in DLQ for investigation
- Queue depth metrics enable capacity planning

**Negative:**

- Requires Redis AOF persistence in production (data durability)
- Worker processes must be deployed and monitored separately
- Current synchronous agent execution must be migrated

**Risks:**

- Redis failure blocks all job processing (mitigate with Redis Sentinel/Cluster)
- Queue depth can grow unbounded if workers are slow (mitigate with rate limits)

## Verification

1. `pip show bullmq` — package installed
2. Verify worker processes exist and consume from queues
3. Test retry behavior: inject failing job, verify DLQ placement
4. Monitor queue depth via BullMQ events or Redis CLI

## Related ADRs

- ADR-003: pgvector (embedding storage, not queue)
- ADR-017: Circuit Breaker (agent failure handling)
- ADR-024: Rebuildable Projections (queue-triggered rebuilds)

## Reversibility

Moderate — BullMQ is already installed. Removing it requires:

1. Converting async jobs back to synchronous calls
2. Removing worker processes
3. No data migration needed (jobs are ephemeral)

---

## Addendum 2026-09-21 — As-built reconciliation (doc-drift closure)

**Verdict: the mandate was never implemented as written.** The runtime is a
custom Python Redis worker plus opt-in Temporal. Every claim below was verified
against code on 2026-09-21; file:line cites are normative.

### 1. As-built reality

- **No `bullmq` in the Python runtime.** `apps/api/pyproject.toml:22,47` depends
  on `redis[hiredis]` and `temporalio` only — there is no Python `bullmq`
  package, so this ADR's own verification step ("`pip show bullmq`",
  Verification §1) fails. BullMQ exists only as a Node library: `packages/queue`
  pins `bullmq@6.1.1` (`packages/queue/package.json:15`) with producer defaults
  `attempts: 3`, exponential backoff `delay: 2000ms`, `removeOnComplete 3d`,
  `removeOnFail 7d` (`packages/queue/src/queue.service.ts:33-38`).
- **The Python worker is custom but wire-compatible.** `BullMQWorker`
  (`apps/api/src/api/workers/queue_worker.py:35-53`) speaks the BullMQ Redis
  keyspace — `bull:{queue}:wait/active/completed/failed/delayed` plus job hash
  `bull:{queue}:{job_id}` (`queue_worker.py:56-76`) — so Node BullMQ producers
  and the Python consumer interoperate on the same keys.
- **`run_worker()` consumes exactly two queues, neither of them mandated.**
  `events` (`event.publish`, `subscription.create`) and `schedules`
  (`schedule.agent_run`, `schedule.job_run`, `daemon.watcher`)
  (`queue_worker.py:377-388`). None of the six mandated queues
  (`document-ingestion`, `agent-execution`, `email-sync`, `job-search`,
  `memory-consolidation`, `audit-log-batch`) has a Python consumer; the mandated
  per-queue concurrency tiers (10/5/3/2/1/5) do not exist at runtime.
- **Temporal is the durable substrate and is opt-in.** Disabled by default
  (`apps/api/src/api/config.py:211` `temporal_enabled: bool = False`;
  `docker-compose.yml:98` `TEMPORAL_ENABLED: '${TEMPORAL_ENABLED:-false}'`; all
  Temporal services behind `profiles: ['temporal']`,
  `docker-compose.yml:196,213,247,261,289`). Eight task queues are catalogued
  with per-queue activity concurrency, three marked `[PLANNED]`/inactive
  (`documents`, `schedules`, `memory`)
  (`apps/api/src/api/temporal/queues.py:20-68`); the worker wires six pools
  (`apps/api/src/api/temporal/worker.py:79-96`).
- **Known producer/consumer gap.** The Trigger.dev native fallback enqueues to
  `bull:tasks:wait` (`apps/api/src/api/trigger/client.py:175-177`), but
  `run_worker()` starts no `tasks` consumer (`queue_worker.py:377-388`) — such
  jobs wait until a consumer for that queue exists.

### 2. Retry / DLQ / backpressure semantics the custom worker ACTUALLY provides

- **Retry:** `maxAttempts` read from the job hash, default `3`
  (`queue_worker.py:177-179`). On failure `attempts` increments; while
  `attempts < max_attempts` the job is requeued onto the delayed zset with
  backoff `min(300_000ms, 2^attempts × 5_000ms)` (`queue_worker.py:181-189`),
  promoted back by an atomic `zrem` gate, max 20 promotions per poll
  (`queue_worker.py:119-133`). With the default `maxAttempts=3` this yields **3
  total executions (1 initial + 2 retries)** — not "3× retries". Delays: ~10s,
  ~20s (cap 300s).
- **Dead-letter:** there is **no companion `*-dlq` queue, no 30-day retention,
  no manual-review gate.** A terminally failed job is recorded in the
  `bull:{queue}:failed` **sorted set** with `failedReason` on the job hash
  (`queue_worker.py:190-196`). Unknown job names land in the same failed set
  (`queue_worker.py:156-161`). Retention is whatever Redis eviction/persistence
  is configured to — nothing in code enforces 30 days.
- **Backpressure:** `asyncio.Semaphore(concurrency)` (default 5;
  `queue_worker.py:47,91,107`) plus `BLPOP` polling (`queue_worker.py:101`).
  There is **no max queue-depth bound, no priority lanes, no per-queue rate
  limit** inside the worker. Queue depth is observable only via Redis
  (`LLEN bull:{queue}:wait`, `ZCARD` on delayed/failed).

### 3. Why it diverged

ADR-038 (2026-08-27) explicitly superseded the ADR-033 execution model while
keeping `queue-worker` until its §43 gate passes
(`docs/adr/ADR-038-temporal-durable-execution.md:9`). Durable human-in-the-loop
approvals (signals), idempotent workflow IDs, replay, and per-class retry
policies cannot be expressed in the BullMQ hash keyspace, so durable paths moved
to Temporal; LangGraph was then layered _inside_ Temporal activities with
`graph_retry=0` (ADR-039). The custom worker survived because ephemeral dispatch
(events, cron-slot claims, watcher scans) does not need durability — and
rewriting it onto literal BullMQ would not add any.

### 4. Decision: KEEP-CUSTOM (recommendation, rationale)

- **Keep** the Python `BullMQWorker` for ephemeral/high-throughput dispatch
  (`events`, `schedules`, daemon claims). Rationale: (a) wire-compatibility
  preserves interop with Node BullMQ producers with zero migration; (b) Temporal
  already covers every durability property the mandate wanted (retry classes,
  signals, history, visibility) for the paths that need it; (c) a literal BullMQ
  migration would create a Node/Python split-brain and close no row in
  `docs/operations/HA-GAPS.md`.
- **Do not** treat the six-queue topology, `*-dlq` queues, or 30-day retention
  as requirements — mark them superseded by this addendum.
- **Follow-ups (docs only):** reconcile `docs/architecture/Queue.md`, which
  mandates a _third_, different topology (Ingestion/Memory/Org/Gmail/Resume/
  JobSearch + DLQ→Alert); rewrite this ADR's Verification §1-4 against the real
  keyspace (`LLEN bull:events:wait`, `ZCARD bull:schedules:delayed`,
  delayed-promotion and failed-set drills); decide the fate of the unconsumed
  `bull:tasks` fallback queue (add a consumer or change the fallback target).

### 5. Related

- ADR-038 (Temporal durable execution), ADR-039 (LangGraph inside Temporal),
  ADR-033 (durable scheduling), `docs/operations/HA-GAPS.md` (single Redis row),
  `docs/architecture/Queue.md` (conflicting topology — needs reconciliation).
