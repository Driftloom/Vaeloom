# HA Gaps — Honest Single-Point Register

> **Status:** Active register | **Created:** 2026-09-21 | **Owner:** SRE /
> Architecture Team **Scope:** single points in the _shipped runtime_ (dev
> compose topology + API defaults). Every row is grounded in a `file:line` cite
> verified 2026-09-21 — no row may claim a mitigation that is not in code or
> committed config. Related:
> [ADR-028](../adr/ADR-028-event-driven-architecture-bullmq.md),
> [ADR-040](../adr/ADR-040-tenant-cells-control-plane.md),
> [NFR reconciliation](../../specs/product/Non-Functional-Requirements.md#load-evidence-reconciliation-2026-09-21-unproven-at-platform-scale),
> [Disaster-Recovery](../architecture/Disaster-Recovery.md).

## How to read this register

| Column             | Meaning                                                     |
| ------------------ | ----------------------------------------------------------- |
| Blast radius       | What breaks when this single point fails                    |
| Current mitigation | What _actually_ exists in code/config today (cited)         |
| Path to close      | Concrete change that removes the single point               |
| Owner / effort     | Suggested owner and rough size (S < 1wk, M 1–4wks, L > 1mo) |

## Register

### HG-01 — Single PostgreSQL (one service, one volume, one engine)

- **Cite:** one `postgres` service + one `postgres-data` volume
  (`../../docker-compose.yml:31-47`); one engine,
  `pool_size 20 / max_overflow 10` (`../../apps/api/src/api/database.py:28-31`).
- **Blast radius:** total — API, queue worker, Temporal activities, and all
  RLS-scoped reads/writes stop; data loss exposure bounded only by volume
  snapshots/backups.
- **Current mitigation:** (a) logical isolation only — 42/42 RLS via
  transaction-scoped GUCs, re-applied after commit
  (`../../apps/api/src/api/database.py:33-54`) — this is a _security_ boundary,
  not availability; (b) PgBouncer transaction pooling in front of the same
  single backend (`../../docker-compose.yml:160-178`); (c) volume persistence +
  DR runbook ([Disaster-Recovery](../architecture/Disaster-Recovery.md),
  [db-failover runbook](Runbooks/db-failover.md)).
- **Path to close:** managed PG with standby + PITR; satisfy NFR-SCALE-006 (≥2
  read replicas — currently unmet, zero replica config in compose); per-cell
  databases per [ADR-040](../adr/ADR-040-tenant-cells-control-plane.md)
  preconditions.
- **Owner / effort:** SRE / **M**.

### HG-02 — Single Redis (jobs, rate limits, quota, daemon claims share one node)

- **Cite:** one `redis:7-alpine`, no AOF flag in dev
  (`../../docker-compose.yml:49-61`); single `redis__url` default
  (`../../apps/api/src/api/config.py:35`); prod compose enables AOF on the _same
  single instance_ (`../../docker-compose.prod.yml:207`
  `redis-server --appendonly yes`).
- **Blast radius:** job processing halts (worker `BLPOP`s on `bull:*:wait`,
  `../../apps/api/src/api/workers/queue_worker.py:101`); rate-limit and quota
  Lua counters degrade (fail-open locally, fail-closed in prod); daemon slot
  claims (`SETNX … EX120`) stop de-duplicating.
- **Current mitigation:** (a) prod AOF persistence (above — durability, not
  availability); (b) graceful degradation paths: Trigger.dev native fallback
  records `accepted_inline` when Redis is unreachable
  (`../../apps/api/src/api/trigger/client.py:186-195`); (c) logical DB
  separation already in use (`REDIS__URL …/0`, `RATE_LIMIT_REDIS_URL …/1`,
  `../../docker-compose.yml:86-87`) — blast-radius _partitioning_, not
  redundancy.
- **Path to close:** Redis Sentinel or managed Redis with replica + failover
  (the mitigation ADR-028 named but never implemented); separate
  rate-limit/quota Redis from job-queue Redis so one eviction policy cannot take
  both.
- **Owner / effort:** SRE / **S–M**.

### HG-03 — Single MinIO (one instance, one volume)

- **Cite:** one `minio` service + one `minio-data` volume
  (`../../docker-compose.yml:139-157`); default endpoint is local
  (`../../apps/api/src/api/config.py:133`
  `storage_endpoint = "http://localhost:9000"`).
- **Blast radius:** document artifacts, resume PDFs/DOCX, and any object writes
  unavailable; uploads fail closed (non-localhost endpoint is a startup warning,
  not HA — `../../apps/api/src/api/config.py:361-362`).
- **Current mitigation:** volume persistence; S3-compatible API means the
  endpoint can be repointed at S3 without code change (config-only).
- **Path to close:** point prod at S3 (or MinIO erasure-coding distributed
  mode); add bucket versioning + cross-region replication for the RPO story.
- **Owner / effort:** SRE / **S**.

### HG-04 — Temporal off by default (durable execution absent unless opted in)

- **Cite:** `temporal_enabled: bool = False`
  (`../../apps/api/src/api/config.py:211`);
  `TEMPORAL_ENABLED: '${TEMPORAL_ENABLED:-false}'`
  (`../../docker-compose.yml:98`); every Temporal service (`temporal-db`,
  `temporal-visibility-db`, `temporal`, `temporal-ui`, `temporal-worker`) behind
  `profiles: ['temporal']` (`../../docker-compose.yml:196,213,247,261,289`).
- **Blast radius (when off):** no durable workflows — approvals, agent runs, and
  ingest fall back to non-durable paths (queue worker / inline); a worker crash
  loses in-flight multi-step state that Temporal history would have kept.
  Conversely, enabling it without the server fails **closed**
  (`TemporalUnavailableError`, no silent fallback —
  `../../apps/api/src/api/temporal/client.py:79-85`), so a half-enabled deploy
  surfaces as 503s rather than fake durability (good, but still an outage mode
  to plan for).
- **Current mitigation:** custom worker covers ephemeral dispatch (`events`,
  `schedules` — `../../apps/api/src/api/workers/queue_worker.py:377-388`); three
  Temporal queues remain `[PLANNED]`/inactive (`documents`, `schedules`,
  `memory` — `../../apps/api/src/api/temporal/queues.py:27-32,45-49,57-62`), so
  the non-durable surface is explicit.
- **Path to close:** enable the `temporal` profile in staging/prod, run
  `temporal-worker` supervised, gate deploys on Temporal reachability; activate
  the three planned queues or remove them from the catalogue.
- **Owner / effort:** Backend + SRE / **S**.

### HG-05 — MemorySaver default (LangGraph checkpointer is process-local)

- **Cite:** `langgraph_checkpoint_backend: str = "memory"`
  (`../../apps/api/src/api/config.py:240`); `MemorySaver()` with "no
  postgres/redis persistence v1"
  (`../../apps/api/src/api/graph/__init__.py:96-97`); "process-local, not
  durable — Temporal owns durability"
  (`../../apps/api/src/api/graph/__init__.py:197-198`).
- **Blast radius:** graph routing/topology state (and any future interrupt
  resume) is lost on worker restart and incoherent across replicas; today
  contained because interrupts are compiled out (`interrupt_before=… if False`,
  `../../apps/api/src/api/graph/__init__.py:201`) and retries are Temporal-owned
  (`graph_retry = 0`).
- **Current mitigation:** Temporal owns durability/retry by design
  ([ADR-039](../adr/ADR-039-langgraph-durable-integration.md)); approval truth
  lives in `ApprovalWorkflow`, not graph state
  (`../../apps/api/src/api/graph/__init__.py:199`).
- **Path to close:** switch `langgraph_checkpoint_backend` to `postgres|redis`
  (the config enum already anticipates this) _before_ enabling
  `interrupt_before=["tool_execute"]`; until then, enabling interrupts without a
  durable checkpointer re-opens this gap.
- **Owner / effort:** Backend / **S–M**.

### HG-06 — Single API / queue-worker replica in compose topology

- **Cite:** one `api` instance (`../../docker-compose.yml:77-113`), one
  `queue-worker` instance (`../../docker-compose.yml:115-136`); delayed-retry
  promotion is safe under concurrency (atomic `zrem` gate,
  `../../apps/api/src/api/workers/queue_worker.py:119-133`) but throughput and
  availability do not scale horizontally in this topology.
- **Blast radius:** API deploy/restart = full control-plane outage; worker
  restart = delayed retries and watcher scans stall until it returns (jobs
  persist in Redis, so this is delay, not loss — modulo HG-02).
- **Current mitigation:** healthchecks gate startup ordering
  (`../../docker-compose.yml:109-112,131-135`); graceful drain on shutdown
  (`_drain`, `../../apps/api/src/api/workers/queue_worker.py:198-202`).
- **Path to close:** k8s HPA replicas (NFR-SCALE-005 wants 2–20 API pods — unmet
  in compose); ≥2 queue-worker replicas (promotion gate is already
  concurrency-safe); load evidence for the scaled shape, not just one replica
  ([NFR reconciliation](../../specs/product/Non-Functional-Requirements.md#load-evidence-reconciliation-2026-09-21-unproven-at-platform-scale)).
- **Owner / effort:** SRE / **M**.

## Non-gaps (claimed elsewhere, verified present)

- **Queue retry/DLQ-maker split-brain:** none — one worker owns the keyspace;
  Node `packages/queue` only produces. No second consumer mutates `bull:*:wait`
  (`queue_worker.py:379,385` are the only consumers in `apps/api/src`).
- **Silent non-durable fallback:** absent by construction — Temporal
  connect-failure raises instead of degrading
  (`../../apps/api/src/api/temporal/client.py:79-85`).

## Maintenance

- Re-verify each cite on every release; a row closes only with a config/code
  cite proving redundancy (replica count, standby lag, failover drill log), not
  with a plan reference.
