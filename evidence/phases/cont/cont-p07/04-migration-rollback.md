# CONT-P07 — 04 Migration / Rollback Plan

**Deliverable:** `DEL-CONT-P07-02` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Owners:** Database Engineer + SRE

## Expand–Contract `add_cell_id` Demo

- **Expand:** `ALTER TABLE workspaces ADD COLUMN cell_id TEXT;` nullable,
  `dual-read` control plane routes `workspace_id→cellId` mapping versioned.
- **Contract:** when `cell lag <5m` + `reconciliation 0 divergence` →
  `NOT NULL` + remove monolith reads.

## Idempotent Observable Migration

- Mapping version `v1` `source_id (workspace_id)` → `target_id (cellId)` with
  `checksum(count)` and `result` logged via `migration-control-plane` ledger
  (future, `NOT_IMPLEMENTED` behind `feature_flag` per-cell).
- Forward `add_cell_id` + `reindex` `Vector 1536`, backward `DROP COLUMN` +
  `rollback checkpoint`.

## Rollback

- `alembic downgrade -1` + `restore` `pg_basebackup` per cell `RTO 15m RPO 1h`
  (MVP `787053a`), `reconciliation` ledger `count/checksum`.

**Never infer:** source/target IDs + mapping version + checksum/count + result +
rollback always recorded.

---

_Evidence: `alembic history` 12 migrations `0010→0021` `42/42 RLS`._
