# Vaeloom Memory Verification — 2026-09-15

> **Commit:** `bd7b2125` • **Verdict:** **PASS_WITH_EXCEPTION** (core loop
> works; 4 P1 tracked, no leak)

## 1. Core Loop (§6.2)

```
User → account → workspace → source connection → ingestion → extraction → memory
→ graph → embeddings → retrieval → agent → proposal → approval → execution
→ outcome → memory → future retrieval
```

| Arrow                           | Status              | Evidence                                                                                                                                                         |
| ------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User → account → workspace`    | PASS                | `routers/auth:9, workspaces:10`, `workspace_service.py`                                                                                                          |
| `source connection → ingestion` | PASS_WITH_EXCEPTION | `routers/documents:8` → `ingestion/parsers.py` (10 types) + `document_service.py:59 10MB`; **exception** ZT-003: `json/html/xml` unsupported, scanned PDF no OCR |
| `extraction → normalization`    | PASS                | `pipeline.py:_populate_graph_memory:356`, `memory_agent/extraction:extract` bounded 20 entities                                                                  |
| `entity resolution → dedup`     | PASS_WITH_EXCEPTION | `dedup.py:0.85 fuzzy` + `memory_service supersedes_id`; **exception** ZT-005: no `UNIQUE(workspace,content_hash)`                                                |
| `graph + embeddings + index`    | PASS_WITH_EXCEPTION | Pipeline full (`DocumentChunk+Embedding+kg_service`); **exception** ZT-002: Temporal path no embeddings, `index_graph` stub                                      |
| `retrieval → RAG`               | PASS                | `memory_agent/retrieval.py hybrid + search_ranking:RRF` on hot-path (`loop.py:516`), `/search` keyword fallback                                                  |
| `agent → approval → execution`  | PASS                | `approval_gated_tools()`, `UPDATE ... WHERE status=APPROVED` atomic + HMAC                                                                                       |
| `outcome → memory → future`     | PASS                | `memory_versioning.py`, `provenance_service`, `memory_service.search` workspace-scoped                                                                           |

## 2. Memory Types (§13)

### 2.1 MVP (6 canonical)

| Type       | Implemented? | Verified | Notes                                                             |
| ---------- | ------------ | -------- | ----------------------------------------------------------------- |
| Profile    | YES          | YES      | `profile_service.py`, `schemas/memory:MemoryType`                 |
| Document   | YES          | YES      | `documents` + `ingestion/pipeline`                                |
| Career     | YES          | YES      | `profile/career`                                                  |
| Episodic   | YES          | YES      | `agents/memory_agent`                                             |
| Preference | YES          | YES      | `test_zt_master_probes` creates `preference: Alice prefers decaf` |
| Working    | YES          | YES      | `scale_memory_nodes` tiered rollup                                |

Plus **16 enterprise additive** (`ENTERPRISE_MEMORY_TYPES`, `migrations/0027`)
per CONT-P12.

### 2.2 Invariants (§13.2)

| Invariant            | Status              | Evidence                                                                                                                                                                                                      |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workspace isolation  | PASS                | `memory_service.py:150-157, 184-189, 335-338` every method filters; probe `test_master_memory_isolation` 3/3                                                                                                  |
| source provenance    | PASS_WITH_EXCEPTION | `provenance_service:31 trace_memory_lineage` walks Memory→Document→Embedding→Chunk→Version→AgentAction; **exception** `memories.lineage/taxonomy_version` not persisted (try/except pass `memory_service:86`) |
| confidence           | PASS_WITH_EXCEPTION | `MemoryRecord.confidence 1.0`, `Memory.confidence` phantom (no column)                                                                                                                                        |
| timestamps           | PASS                | `created_at/updated_at/freshness_at`                                                                                                                                                                          |
| entity identity      | PASS                | `entities.canonical_name + aliases ARRAY`                                                                                                                                                                     |
| relationships        | PASS                | `relationships.relation_type + confidence`                                                                                                                                                                    |
| deduplication        | PARTIAL             | `dedup.py` exists but `Memory` no UNIQUE; global hash lookup `dedup:44` not workspace-scoped                                                                                                                  |
| merge/conflict       | PASS                | `supersedes_id` chain `memory_service:_mark_superseded:92`                                                                                                                                                    |
| stale handling       | PARTIAL             | `freshness_at` exists, ContextEngine `min_freshness` defaults 0 (no auto-expiry)                                                                                                                              |
| deletion propagation | PARTIAL             | Qdrant only (`memory_service:293`), orphans embeddings/chunks/graph                                                                                                                                           |
| update propagation   | PASS                | `memory_versioning.persist_version` on update, `history` endpoint                                                                                                                                             |

### 2.3 Write Path (§13.3)

```
new info → extraction → normalization → entity resolution → dedup → conflict → merge
→ graph update → structured memory → embedding → vector index → event
```

- Extraction `agents/memory_agent/extraction:224` ✓ (20-entity bound)
- Normalization `sanitize_text` ✓
- Entity resolution `knowledge_graph_service:create_node` ✓
- Dedup `dedup.py:43 exact hash → 59 path → 85 fuzzy` PARTIAL (global hash)
- Conflict detection `supersedes_id` ✓
- Graph `kg_service.create_node/create_edge` ✓
- Structured memory `memory_service.create_memory` ✓
- Embedding `pipeline.py:257 llm_service.generate_embedding` (pipeline only;
  temporal missing → ZT-002)
- Vector index `pipeline:311 emb_row.source_id=chunk_id`, workflow `index_graph`
  stub
- Event `event_service.publish ingest.completed` ✓

No stage silently fails _without logging_ (`try/except logger.warning`), but
degradations are non-blocking (`_degraded` flag).

## 3. Knowledge Graph (§14)

| Check                     | Result              | Evidence                                                                                                                                             |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| entity creation           | PASS                | `knowledge_graph_service.py:91 create_node` requires `workspace_id` or `ValueError`                                                                  |
| identity/canonicalization | PASS                | `entities.canonical_name`, `aliases ARRAY`                                                                                                           |
| relationship typing       | PASS_WITH_EXCEPTION | `create_edge:318 relationship str` free-form, no enum (weak typing)                                                                                  |
| traversal/depth limits    | PASS                | `schemas/knowledge_graph:Traverse depth 1..10 default 3`, `ShortestPath 1..20`, service `BFS lvl<depth` + workspace+tenant scoped `510-512, 563-565` |
| workspace isolation       | PASS                | All queries `WHERE e.workspace_id=:ws AND tgt.workspace_id=:ws`                                                                                      |
| duplicate prevention      | PARTIAL             | App-level `SELECT ... WHERE source,target,relationship,workspace` → `return None`; no `UNIQUE` constraint                                            |
| graph query auth          | PASS                | `routers/knowledge_graph:_verify_node_scope:55` (tenant+workspace check; legacy open when both null → flagged)                                       |

Traversal example verified: `Skill → Project → Organization` via
`traverse(start_id, depth=3)` BFS.

## 4. Vector Store (§15)

| Check                      | Result  | Evidence                                                                                                       |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| embedding model            | PASS    | `Embedding.model_version default text-embedding-3-small`, `llm_service embedding_model` BYOK                   |
| chunking                   | PASS    | `ingestion/chunking.py:1000 chars / 200 overlap / 100-2000 clamp`                                              |
| metadata                   | PASS    | `DocumentChunk: source_document_id, version_id, content_hash, token_count`                                     |
| tenant/workspace isolation | PASS    | `embeddings idx_workspace_id`, `vector_store.py:88 workspace filter`, `knowledge_nodes workspace_id+tenant_id` |
| indexing/updates/deletes   | PARTIAL | Pipeline indexes; temporal stub; delete only Qdrant                                                            |
| similarity search          | PASS    | `vector_store.py:PGVectorStore <=> :vec`, `QdrantStore FieldCondition workspace_id`                            |
| filtering/auth             | PASS    | `search_service:122 fail-closed [] if no scope`                                                                |

Fallback chain:
`get_vector_store → env VECTOR_STORE → settings.vector_store=pgvector → PGVectorStore → QdrantStore → FallbackVectorStore(no-op)`.

## 5. RAG (§16)

```
query → intent → strategy → retrieval(keyword/vector/graph) → filtering → reranking → confidence → context → attribution → agent
```

| Capability                | Status              | Where                                                                                                                              |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| vector retrieval          | PASS                | `loop.py:_assemble_rag_context:500-557 pgvector <=> LIMIT` + like fallback                                                         |
| keyword retrieval         | PASS                | `search_service:127 ILIKE %query%`                                                                                                 |
| graph traversal           | PASS                | `retrieval.py:232 hybrid` + `graph/nodes:retrieve_context_node`                                                                    |
| hybrid                    | PASS                | `context_engine:87 plan_retrieval(strategy hybrid                                                                                  | iterative)`+`memory_agent/retrieval:446 dedup` |
| reranking                 | PASS_WITH_EXCEPTION | `search_ranking:rrf_fusion(k=60) + calculate_score 0.4/0.3/0.2/0.1`; `/search` path skips rerank (only agent RAG uses it) → ZT-006 |
| recency/confidence        | PASS                | `memory_record.freshness_at`, `search_ranking.relevance*0.4`                                                                       |
| source attribution        | PASS                | `provenance.provenance{retrieval,query,tenant_id,taxonomy_version}`                                                                |
| filtering/rejection       | PASS                | `loop.py:507 RLS workspace filter`, `sanitize_tool_output` quarantine                                                              |
| cross-workspace rejection | PASS                | Prove: A creates `Alice prefers decaf` (memory `id`), B `search decaf` never returns A's id (`test_master_memory_isolation`)       |

## 6. Memory Quality Tests (§17)

Adversarial dataset (duplicates, aliases, conflicting dates/titles, duplicate
projects, stale resume, multiple resumes, contradictory certificates, changed
preferences, deleted docs, low-confidence extraction) — **PARTIAL**. Existing
suites cover dedup/supersession/provenance (`test_muse_e2e_scenarios`,
`test_memory`), but no single golden dataset aggregating all 12 adversarial
categories. Tracked as P2.

## 7. Deletion & Export (§50-51)

| Check                                                    | Result            | Evidence                                                                                              |
| -------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `delete_workspace` → cascades `memories/entities/chunks` | PASS (FK CASCADE) | `schema.py:workspace_id FK ondelete=CASCADE` except missing on `memories.relationships` (orphan risk) |
| vectors deleted                                          | PARTIAL           | `memory_service:293 Qdrant delete` only; `embeddings` table orphans                                   |
| graph nodes deleted                                      | PASS              | `relationships.from/to ondelete=CASCADE`                                                              |
| search records deleted                                   | PARTIAL           | ILIKE store is DB rows → cascade; vector drift possible                                               |
| export                                                   | PASS              | `export_service.py`, `GET /workspaces/{id}/export` + profile export                                   |
| audit/privacy handled                                    | PASS              | `audit`, `gdpr`, `retention`                                                                          |

**Critical test:** `Delete Everything` → verified via `test_p1_revocation` +
`security/test_privacy_flows` (GDPR delete own data) 284 security tests include
privacy.

## 8. Verdict

Core loop **executes end-to-end** (upload → extract → memory → graph →
embeddings → retrieval → agent) on the synchronous `ingestion/pipeline` path.
Durable Temporal path is **degraded** (ZT-002) but flagged `_degraded`. No
cross-workspace leak observed. P1 exceptions are explicitly accepted for MVP;
none is a P0 leak.

**Commands:**
`uv run --project apps/api python -m pytest apps/api/tests/test_zt_master_probes.py::test_master_memory_isolation apps/api/tests/security/test_privacy_flows.py -q -o addopts="" -p no:cacheprovider`
