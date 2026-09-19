# CONT-P02 — 03 Data / Source Feasibility — Licensed/Synthetic & Contamination

**Deliverable:** `DEL-CONT-P02-03` | **Owner:** Data Architect | **Date:**
2026-08-28

## 1. Data Sources / Datasets / Licenses

| Source                             | Owner                                       | Purpose/Basis                 | Classification          | Scope Key                  | Residency                                     | Schema / Version           | Quality                    | Retention                 | Consumers                         | License                            |
| ---------------------------------- | ------------------------------------------- | ----------------------------- | ----------------------- | -------------------------- | --------------------------------------------- | -------------------------- | -------------------------- | ------------------------- | --------------------------------- | ---------------------------------- |
| `01-vaeloom-mvp-spec 364`          | Product                                     | MVP scope 8 agents 6 memories | Internal                | `workspace_id`             | `tenant_id pooled` (cell deferred `CONT-P07`) | `01 v.364` `05 superseded` | `approved`                 | `PER support`             | `agents/mvp`                      | Internal                           |
| `06-vaeloom-enterprise-paper 900+` | Product                                     | 28 agents 22 memories         | Internal                | `tenant_id` cell           | Pooled→cell `isolation` `CONT-P07`            | `06 v.900+`                | `approved`                 | `P21 backlog quarterly`   | `enterprise`                      | Internal                           |
| `Memory Entity/Relationship`       | `memory_service 225` `Entity Vector(1536)`  | Career graph 6→22 additive    | User PII `workspace_id` | `workspace_id` `42/42 RLS` | Pooled (cell deferred)                        | `schema 30+ tables` `0023` | `p95 120ms` `0 fabricated` | `PER support 30d`         | `agents/memory` `knowledge_graph` | Internal                           |
| `eval datasets 12 cases`           | `docs/ai/Eval-Datasets.md` + `mvp-p12 88.4` | `orchestrator eval`           | Test only               | `request_id`               | —                                             | `12 cases`                 | mock only                  | `CONT-P12 re-eval`        | `qa_agent`                        | MIT/Test                           |
| `Gmail API`                        | Google `EXT-12`                             | Push deadline                 | User email (untrusted)  | `connector_id`             | N/A                                           | `Gmail API current`        | polling fallback 3 mock    | `RFC9700` least-privilege | `gmail_agent`                     | Google ToS licensed per user token |

**Contamination controls:** `test_product_closure_e2e 10` uses
`mock_llm 0.1*1536` + `MockVector Text` + `cosine_distance 0.0 SQLITE` — no
licensed data leakage into eval; `knowledge_graph_service traverse`
`knowledge_nodes TEXT embedding` compatible SQLite vs pgvector.

## 2. Volume & Deletion

- **Volume:** Day1 10-50 docs 20-100 entities → Month6 500-5000 docs 1k-10k
  entities (`06:398`) — `94.2% --cov` retained, `load 20 RPS SLI` `headroom 60%`
  `RPO 1h RTO 15m`
- **Deletion:** `Memory status deleted superseded` `persist_version` `mvp-p13` +
  `retention_runs 0021` `30d` + legal hold distinguish
  `primary deletion vs backup expiry` — _prove_ via `persist_version` snapshot
  old→new + restore drill `docs/phases/mvp-p21 chaos 5 faults`

## 3. Quality / Provenance

- Carry `source_type/source_id` `source_uri` `content_hash SHA256`
  `provenance tag [from:X untrusted]` `rag_status` through
  `transformations → retrieval → AI output → action` (`04` RAG refs only)
- `stable IDs UUID` never infer missing `canonical_name` —
  `write_memory SELECT workspace+canonical_name` `4091`

---

_Verified: `schema.py 30+` `Entity 500` `Memory embedding Vector(1536)`
`docs/phases/mvp-p07 93.4` `test_B  PASS`._
