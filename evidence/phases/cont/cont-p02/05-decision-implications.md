# CONT-P02 — 05 Decision Implications — Build-Buy with Portability & Exit

**Deliverable:** `DEL-CONT-P02-05` | **Owner:** Domain Specialist + AI/ML
Engineer | **Date:** 2026-08-28

## 1. Build vs Buy (not feature-count)

| Decision                                                | Build                                                               | Buy                                                      | Choice                                                                                       | Portability                                | Exit Cost                                           | Privacy                                | Reliability                     | Unit Econ  |
| ------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- | -------------------------------------- | ------------------------------- | ---------- |
| **Vector store** `pgvector` vs `QDRANT_URL` vs Pinecone | `loop _assemble 236 vector <=> LIMIT 8` `42/42 RLS` pooled          | Qdrant optional `has_vector_store` `ENABLE_VECTOR_RAG=1` | **Keep pgvector primary, Qdrant optional flag**                                              | `pgvector` pooled `Text` `MockVector` test | Exit via `QDRANT_URL` flag (swap `_assemble` check) | `tenant_id` isolation pooled           | `p95 120ms <200` `headroom 60%` | `$0.02/1k` |
| **Auth SSO** `Google/Microsoft` vs `SAML` `signxml`     | `services/sso 43` `MS_GRAPH refresh`                                | `services/saml 12 real signxml` not wired                | **Keep sso `Google/Microsoft` MVP, SAML deferred `CONT-P13` ENT**                            | SAML via `ADR-025 workload identity`       | —                                                   | Least-privilege `RFC9700`              | `test_auth_sso`                 | —          |
| **MCP dynamic** `mcp__server__tool` bridging            | `services/mcp_client_service one-shot sessions stdio+http 300s TTL` | Official `mcp SDK v2`                                    | **Keep official `mcp 2` + `register_dynamic_tool` `mark_approval_gated`** `TOOL_TIMEOUT 30s` | `register_dynamic_tool 30s default`        | Unregister `prefix` dynamic                         | `mcp__` non-`readOnly` → approval gate | `hardening 96.6`                | —          |
| **SaaS billing** `stripe` vs internal                   | `services/billing 39`                                               | —                                                        | **Build** minimal `invoices` per `billing page 47` wired                                     | —                                          | —                                                   | —                                      | —                               | —          |

**Global rule per 146:** Every future-ready improvement specifies
`horizon/migration owner/reconciliation metric/cutover/rollback/legacy-retirement`.

## 2. Compatibility Horizon & Vendor-Dependency Radar

| Dependency                 | Horizon                                      | Migration Owner | Reconciliation Metric                                           | Cutover Trigger                                                       | Rollback Trigger                       | Legacy-Retirement                                               |
| -------------------------- | -------------------------------------------- | --------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| 6→22 memories `stable IDs` | `CONT-P07..P12` per-tenant flag              | Data Architect  | `counts/checksums` tenant-scoped `Entity/Relationship` per wave | `CONT-P12 eval pass` `shadow reads` ok                                | `migrate rollback` per `CONT-P07` spec | `zero traffic + restore drill + owner approval` `Track Mission` |
| 8→28 agents `shadow mode`  | `CONT-P12` shadow                            | AI Product Lead | `pending approvals not overwhelming` `rag_status` proven        | `permission,quality,cost,safety evidence` per `Track Mission` `25,26` | `LANGGRAPH_ENABLED=false` precedent    | `zero required traffic` `Risk R-05`                             |
| `pgvector ↔ QDRANT_URL`    | Per tenant `has_vector_store`                | Data            | `p95 120ms`                                                     | `p95 <200` measured                                                   | `flag off` → `pgvector LIKE`           | `QDRANT_URL` optional flag only                                 |
| `MCP 2026-07-28`           | Version-pinned profile + deprecation testing | Integration     | `mcp__server__tool` compat                                      | `SLSA L2` pinned                                                      | `register_dynamic_tool` idempotent     | `mcp SDK v2` pinned                                             |
| `Gmail push`               | `EXT-12` verification                        | Integration     | `push-watch renewal/reconciliation` `quota`                     | `gmail_agent handler`                                                 | Polling fallback 3 mock                | `RFC9700`                                                       |

**External radar living:** Connector terms (ToS `01:228` official API where
exists, else deep-link), API quotas (`Jobs Board client`), model changes
(`Anthropic` `embedding_model text-embedding-3-small`), security advisories,
regulatory milestones (`DPDP Rules 2025` staged).

## 3. Decision Record

| ID              | Decision                                   | Owner       | Implication                                |
| --------------- | ------------------------------------------ | ----------- | ------------------------------------------ |
| DEC-CONT-P02-01 | Keep pgvector primary, Qdrant optional     | Data        | `CONT-P07` additive schema expand-contract |
| DEC-CONT-P02-02 | SAML deferred `CONT-P13`                   | Sec         | `sso.py 43` MVP sso sufficient             |
| DEC-CONT-P02-03 | Design-partner evidence prevents anecdotal | Business    | `03-value-risk 62% applied` pilot required |
| DEC-CONT-P02-04 | Radar owned by Integration/AI              | Integration | Per-wave `horizon` table 146               |

---

_Trace: `01 INT-05 364 → CONT-P02-R01 → 05 table → mcp_client_service → gate`_
