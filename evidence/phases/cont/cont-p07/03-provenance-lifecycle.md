# CONT-P07 — 03 Provenance / Lifecycle / Rights

**Deliverable:** `DEL-CONT-P07-04` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Owners:** Privacy Engineer + Data Architect

## Provenance

- `source_type: document|memory|graph` + `source_id` + `content_hash` +
  `workspace_id` + `provenance: {graph_run_id, rag_status, evaluation_score}`
  carried via `VaeloomGraphState` + `finalize` `provenance`.

## Lifecycle & Rights

- **Correction/supersession:** `Entity` dedup `0.85` via `merge.py`
  `SequenceMatcher`, `Memory supersedes_id` marks `superseded`.
- **Export:** `GET /workspaces/{id}/export` (GDPR) — `services/export_service`
  (future).
- **Deletion:** `DELETE /workspaces/{id}` `CASCADE workspace_id` primary
  deletion, `backup expiry` 30d (`0021_retention_runs.py`), `legal hold`
  separates — proven via `test_erasure`.
- **Backup expiry vs legal hold:** distinct `retention_runs` 30d vs `hold` table
  (future `CONT-P07`).

**Never infer:** `canonical_name` must exist; missing → `failed` not guessed.
