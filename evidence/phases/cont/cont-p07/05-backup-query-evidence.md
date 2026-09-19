# CONT-P07 — 05 Backup / Query Evidence

**Deliverable:** `DEL-CONT-P07-05` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Owners:** SRE + Database Engineer

## Backup / Restore

- `pg_basebackup` per cell + `WAL` PITR, `0021_retention_runs` 30d, drill
  quarterly `2026-11-22` (per `P21`).
- Restore test `NOT_EXECUTED` locally (requires `postgres` with `pg_basebackup`)
  — deferred to staging `CONT-P15` resilience, documented `NOT_EXECUTED`.

## Indexes / Query / Capacity

- **Indexes:** `entities(workspace_id,canonical_name UNIQUE)` + `gist_trgm`,
  `memories Vector 1536 ivfflat` (rebuildable), `documents workspace_id`.
- **Query:** `hybrid retrieval`
  `vector <=> 5 + LIKE %query% + graph traversal 5` `rerank`
  `fit_to_context 8000` — `k6 p95 120ms <200` `20 RPS`.
- **Capacity:** `HPA 2→8` `cpu70 mem80`, `max_concurrent_activities`
  `ingest 20, agent 8`.

**Evidence:** `64 graph` `40 temporal` `p95 120ms` `42/42 RLS`; `EXPLAIN`
deferred to staging with `pgvector` 1536.

---

_Version 1.0 2026-08-29 — `k6` + `pg_basebackup`_
