# MVP-P07 — 07. Backup / Query / Capacity (DEL-MVP-P07-05)

> Owner: Data Engineer + SRE · BQ-P07-02: RPO ≤24h, RTO ≤24h best-effort.
> Targets: 100 concurrent, upper bound 1,000 verified P15 (BQ-P02-04).

## 1. Backup & recovery

| Item              | Design                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| Schedule          | Daily `pg_dump` (logical) + object storage sync (S3-compatible)        |
| RPO               | ≤ 24h (BQ-P07-02)                                                      |
| RTO               | ≤ 24h best-effort restore (runbook; DR doc exists — extend at P14/P19) |
| Retention         | backups kept 30 days (BQ-P07-01)                                       |
| Restore test      | restore-to-scratch job in CI integration (P14 executes; P19 rehearses) |
| Failure           | backup failure → alert (P17); no silent gap                            |
| Recovery ordering | DB → queue replay (DLQ) → projection rebuild (ADR-024)                 |

## 2. Query patterns & indexes

| Pattern                             | Index (existing → add)                                                   |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Memory by workspace+type            | idx (tenant,type) ✅ → + (workspace_id, type, deleted_at)                |
| Memory supersession lookup          | → + (workspace_id, supersedes_id)                                        |
| Approval by workspace+status+expiry | → + (workspace_id, status, expires_at) (0003)                            |
| Idempotency check                   | → unique partial (workspace_id, idempotency_key) (0003)                  |
| Scheduler due scan                  | → + (workspace_id, due_at) where not present on schedule_events          |
| Deadline facts                      | → + (workspace_id, deadline_at)                                          |
| Recent documents/versions           | (workspace, created_at) partial                                          |
| Vector recall                       | pgvector HNSW index on embeddings (dimension per provider, 0007-guarded) |
| Search                              | Meilisearch index (rebuildable) — not relational                         |

## 3. Capacity model (100 target / 1,000 bound)

| Dimension      | Estimate basis                    | Trigger to act (P15-measured)                 |
| -------------- | --------------------------------- | --------------------------------------------- |
| Rows/workspace | memories ~1k–5k, events ~10k      | partition by workspace range when > threshold |
| Vector index   | pgvector HNSW; 1536-dim           | recall/latency regression measured            |
| Queue          | BullMQ-compatible; semaphore      | lag alert (P17)                               |
| Storage        | docs few MB/user                  | free-tier R2 10GB → alert at 70%              |
| DB connections | pgbouncer pool                    | pool exhaustion runbook exists                |
| Embedding jobs | provider rate limits (free/local) | queue backpressure; pacing                    |

No scaling change without measured trigger + residual risk/headroom/cost
documented (prompt §19); no premature partitioning (100–1,000 scale).

## 4. Query discipline

- All queries scope by workspace (invariant §05); EXPLAIN on hot paths at P15.
- Projection reads never write; rebuild jobs exclusive to avoid torn indexes.
- No N+1 in workspace views (memory list + applications); batch preload.
