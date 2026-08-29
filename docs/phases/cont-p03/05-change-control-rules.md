# CONT-P03 — 05 Change-Control Rules — Scope/Contract/Permission Gates

**Deliverable:** `DEL-CONT-P03-05` | **Owner:** Solution Architect + Security
Architect

## Rule Matrix (per 146 future-ready template)

| Change Type                              | Required Fields                                                                                                                                                                             | Gate                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Scope `INV-01..06`                       | `rationale/impact/reviewers/migration/tests/rollout/rollback` + compatibility horizon + owner + reconciliation metric + cutover/rollback + legacy-retirement `zero traffic + restore drill` | `CONT-P03-R07` traceability |
| Contract `openapi 110`                   | `approved version + compatibility Arazzo optional + contract tests` `GFX-08`                                                                                                                | `pilot`                     |
| Permission `tenant_id` storage-query     | `least privilege + workload identity ADR-025 + kill switch expiry`                                                                                                                          | `Sec veto`                  |
| Retention `0021`                         | `purpose/basis/classification/scope key/residency/schema/version/quality/retention/deletion` `Data Requirements`                                                                            | `Privacy veto`              |
| Provider `mcp 2026-07-28` version-pinned | `pin + compat/deprecation tests + owner`                                                                                                                                                    | `Integration veto`          |

**Never weaken constraints or tests to create a pass**
(`Technical Requirements`).

---

_Versioned `DEL-CONT-P03-05 v1.0`._
