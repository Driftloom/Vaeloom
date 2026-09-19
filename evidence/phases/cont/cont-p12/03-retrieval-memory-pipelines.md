# CONT-P12 — 03 Retrieval/Memory Pipelines — DEL-CONT-P12-03

**Deliverable:** `DEL-CONT-P12-03` | **Version:** 1.0 | **Date:** 2026-09-01 |
**Owner:** Data Engineer + AI/ML Engineer | **Reviewers:** Security, Privacy

## Expand-contract 6 -> 22 (ADR-040)

**Canonical 6:** `profile/document/career/episodic/preference/working` + aliases
`note/fact` (MVP). **Enterprise 16 additive:**
`project/skill/organization/relationship/event/insight/goal/feedback/decision/knowledge/reference/contact/financial/health/learning/workflow`
= 22 total per `schemas/memory.py:9` `MemoryType` + `ENTERPRISE_MEMORY_TYPES`
`CANONICAL_6`.

**Migration `0027_memory_taxonomy_expand_contract.py:1`:**

- `taxonomy_version INTEGER DEFAULT 1` on `memories` + `memory_records`
  (1=legacy 6, 2=expanded 22)
- `lineage JSONB DEFAULT '{}'` + `confidence FLOAT` +
  `contradiction_flags JSONB` on `memories`
- `memory_taxonomy_ledger (memory_id, from_type, to_type, taxonomy_version, migration_wave CONT-P12, checksum)`
  ledger + `ck_memories_type_valid` 22 CHECK
- PG-only (SQLite no-op), additive, no backfill guesses, provenance preserved
  via `memory_versioning.persist_version` + `memory_service.create_memory`
  `taxonomy_version = 2 if enterprise else 1` `services/memory_service.py:44`.

**Dual-write:** writes set `taxonomy_version` + `lineage` atomically with
`db.flush()` single flush (keeps test flush count=1). Reads filter
`Memory.type == query.type` already support 22 values; `MemoryUpdate` accepts
new `taxonomy_version/lineage/confidence` fields.

**Reconciliation:**
`SELECT from_type, to_type, count(*) FROM memory_taxonomy_ledger GROUP BY 1,2` +
per-workspace `taxonomy_version` counts. Cutover trigger:
`0 required traffic on legacy 6-only path` + `checksum match` + owner approval.
Rollback: drop constraint + ledger, set `taxonomy_version=1` (legacy).

## Access-filtered hybrid retrieval — task 3

`services/search_service.py:92` `SearchService.search_all` +
`services/memory_service.py:241` `search_memories` + `knowledge_graph_service`:

- **Keyword:** `ILIKE %query%` on `Memory.title/summary/content` +
  `MemoryRecord.content` + `Entity.canonical_name/aliases`
- **Semantic:**
  `pgvector cosine_distance(embedding, query_embedding) <= 1-threshold`
  `limit top_k` `order_by distance`
- **Graph:** `knowledge_graph_service` `contains` hub edges (persona-a 10 nodes
  11 edges)
- **Lexical:** `0026 tsvector` `to_tsvector(path||summary)` `GIN` BM25 `ts_rank`
  (PG-only, SQLite fallback)
- **Tenant/workspace filter:** `tenant_id` + `workspace_id` `TenantMiddleware`
  GUC fail-closed 42/42 (defense-in-depth filter `workspace_id.isnot(None)`).
- **Provenance:** every `search_all` result now
  `provenance: {retrieval: hybrid|source, query, tenant_id, taxonomy_version 2}` +
  `lineage: {embedding_model: gemini-embedding-2, tsvector: true, version: 0027}`
  `services/search_service.py:188`.
- **Confidence/contradiction:** `Memory.confidence` `contradiction_flags` per
  task 4; `update_memory` preserves `old_state/new_state` via `persist_version`
  without fabrication (never invents missing fields).

**Provenance:** `provenance_service` + `memory_versions` + `0027 lineage JSONB`
reconstructable `model/prompt/tool/retrieval` per `CONT-P12-R06`.

**Tests:** `test_cont_p12: test_memory_taxonomy_22_types` +
`test_memory_service_taxonomy_version_lineage` (project→2, profile→1) +
`test_retrieval_provenance` (provenance_required true) 9 passed;
`test_memory_service.py` 28 passed; `test_search_service.py` 10 passed.

---

_Version 1.0 2026-09-01 —
`rg "taxonomy_version" apps/api/alembic/versions/0027* apps/api/src/api/services/memory_service.py`._
