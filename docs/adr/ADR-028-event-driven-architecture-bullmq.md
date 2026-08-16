# ADR-028: Event-Driven Architecture with BullMQ

| Metadata     | Value                              |
| ------------ | ---------------------------------- |
| **Status**   | Accepted                           |
| **Date**     | 2026-08-16                         |
| **Deciders** | Solution Architect, Backend Lead   |
| **Owner**    | Backend Team                       |
| **Tags**     | architecture, events, queue, redis |

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
