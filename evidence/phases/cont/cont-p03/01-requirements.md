# CONT-P03 — 01 Versioned Requirements — Delta 6→22 / 8→28 / Tenant Cells

**Deliverable:** `DEL-CONT-P03-01` `versioned requirements` | **Owner:** Product
Manager + Business Analyst | **Date:** 2026-08-28 | **Version:** `v1.0`
`78c2d71`

## Invariants Catalog (must preserve, per §6)

| ID     | Invariant                                                                                | Source                                | Provenance                                     |
| ------ | ---------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| INV-01 | User ownership of memory: `user_id` owns `Memory` via `workspace_id` `42/42 RLS`         | `01:179` `Multi-Tenancy tenant cells` | Never guessed                                  |
| INV-02 | Provenance: `source_type/source_id content_hash` carried retrieval→AI output→action      | `04-memory 145`                       | `Memory source_type` `Entity metadata_ source` |
| INV-03 | Approvals: `ApprovalWorkflow wait_condition 3600s` durable truth, graph `forged→pending` | `ADR-039` `Temporal`                  | `nodes:243`                                    |
| INV-04 | IDs: stable `UUID` `durable_run:{ws}:{user}:{req}` `REJECT_DUPLICATE`                    | `temporal/catalog`                    | Never infer migration values                   |
| INV-05 | Audit: `agent_action` append-only + `usage_records` per `slo-dr.md`                      | `mvp-p21`                             | Immutable                                      |
| INV-06 | API behavior: `snake→camel transformKeys` `X-CSRF-Token` `x-correlation-id`              | `api-client 2191`                     | Backward compat                                |

## Delta Requirements (atomic, testable, traceable)

| ID             | Domain    | Requirement (actor/trigger/behavior/condition/failure/acceptance)                                                                                                                                                                                                                                                                            | Priority | Owner           | Evidence Test                                              |
| -------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------- | ---------------------------------------------------------- |
| REQ-CONT-03-01 | Data      | `6→22 memory` expand-contract additive: `MIGRATION` adds `type` values `Learning Relationship Task Goal Project Research Behavior Context Semantic Procedural Timeline Event Decision` without overwriting existing `6` rows; `mapping_version` `v1→v2` preserves `stable IDs UUID`, `provenance` `source_type`, corrections `supersedes_id` | P0       | Data Architect  | `migration 0024` expand `SELECT before INSERT` `test_B`    |
| REQ-CONT-03-02 | Data      | `Memory deletion` distinguishes `primary deleted_at` vs `backup expiry` vs `legal hold` per `mvp-p13 retention 0021`                                                                                                                                                                                                                         | P0       | Privacy         | `gdpr delete` + `retention_runs`                           |
| REQ-CONT-03-03 | Agent     | `8→28` agent via shadow `AGENT_REACT_ENABLED=false` default shadow `mode=shadow` + `permission,quality,cost,safety` evidence before action                                                                                                                                                                                                   | P0       | AI Product Lead | `CONT-P12 eval 12 cases`                                   |
| REQ-CONT-03-04 | Security  | Tenant cells `Tenant isolation pooled→cell` `Regional residency India DPDP` per `Multi-Tenancy.md` tenant cells — `tenant_id` storage-query `app.tenant_id` + `WorkspaceUser` isolation `isolation: cell`                                                                                                                                    | P0       | EntArch + Sec   | `test_J cross-ws 404` `42/42` extends to `isolation: cell` |
| REQ-CONT-03-05 | Platform  | PaaS→K8s service extraction via measured `K8s HPA min3 max10 cpu70` + `Terraform 12 modules` + ops budget `SLO 99.9% 43.2m`                                                                                                                                                                                                                  | P1       | Platform        | `mvp-p16 92.8` `mvp-p19 93.6`                              |
| REQ-CONT-03-06 | Connector | Least-privilege `mcp 2026-07-28` version-pinned `mcp__*` dynamic `mark_approval_gated` non-`readOnly` → approval; GitHub 7 tools `connector.github.read` fine-grained `EXT-13`                                                                                                                                                               | P1       | Integration     | `test_H github scope`                                      |
| REQ-CONT-03-07 | Abuse     | `abuse story: wrong memory overreach missed deadline` negative requirement: `unacceptable` `R-05 old/new divergence` `reconciliation pause/rollback`                                                                                                                                                                                         | P0       | Sec             | `test_hardening 23`                                        |
| REQ-CONT-03-08 | NFR       | `API p99<500ms` `SLO 99.9% 43.2m` `RTO 15m RPO 1h` `p95(langgraph) <3000 disclosed` as stakeholder decision `A-04`                                                                                                                                                                                                                           | P1       | SRE             | `k6 p95 120ms <200`                                        |

_All `CONT-P03-R01..R08` mapped; no `TBD` priority —
`REQUIRES_STAKEHOLDER_DECISION` where absent → `A-05` pilot windows still
UNKNOWN deferred._

---

_Versioned `DEL-CONT-P03-01 v1.0` `78c2d71` owned Product/BA reviewed
Architect/Sec._
