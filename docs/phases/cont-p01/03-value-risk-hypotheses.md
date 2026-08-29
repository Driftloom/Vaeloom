# CONT-P01 — 03 Value / Risk Hypotheses — Enterprise-Readiness

**Deliverable:** `DEL-CONT-P01-03` | **Owner:** AI Product Lead + Product
Manager | **Date:** 2026-08-28

## 1. Value Hypotheses (falsifiable, per overlay 143)

| ID    | Hypothesis                                                                                                                                                                                | Evidence Needed to Validate                                                                                                | Invalidate → Stop Criteria                                                        | Owner           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------- |
| VH-01 | 8→28 agent expansion in shadow `AGENT_REACT_ENABLED=false` then `requires_tool` improves job-fit ranking `8 → picks 3/8` trust                                                            | `CONT-P12` eval 12 cases `mvp-p12 88.4` → `CONT-P12` re-eval; shadow `mode=shadow` metrics `langgraph_run_completed_total` | If `pending approvals` overwhelm user or quality not ↑ with `rag_status` proven   | AI Product Lead |
| VH-02 | 6→22 memory additive without overwriting provenance enables cross-program career graph                                                                                                    | `knowledge_graph_service traverse BFS` + `write_memory dual-write` `test_B` `persist_version`                              | If `Entity canonical_name` collisions guess fields or `supersedes` not stable IDs | Data            |
| VH-03 | Tenant cells (`isolation pooled → cell`) + `tenant_id` storage-query + `SAML` workload identity unblocks enterprise buyer (university provisioning `EFR`) without leaking aggregated data | `CONT-P13` SAML workload identity `ADR-025`                                                                                | If `42/42 RLS` cannot extend to cells without `NOT_APPLICABLE` big-bang           | EntArch/Sec     |

## 2. Risk Hypotheses (trust failures, not happy-path)

| ID    | Risk Hypothesis                                                                  | Trust Failure                                       | Validation Counterexample                                                 |
| ----- | -------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| RH-01 | Wrong memory (`React.js` vs `React` merged incorrectly)                          | Overreach: auto-merge without `merge_check`         | `mem_merge.py merge_check` + `write_memory SELECT before INSERT` `test_B` |
| RH-02 | Overreach: `create_github_issue` without `waiting_approval`                      | Unapproved consequential action                     | `policy_check forged→pending` `test_F`                                    |
| RH-03 | Missed deadline: Gmail push not renewed                                          | `Gmail API Push` renewal/reconciliation `EXT-12`    | `gmail_agent handler 8760` push-watch renewal (verify at CONT-P02)        |
| RH-04 | Confusing approval: user cannot distinguish `approval_gated` vs `suggest`        | `ChatWindow` `ApprovalCard` least-privilege unclear | `frontend-audit 2026-08-21`                                               |
| RH-05 | Difficult deletion: `Memory status deleted` not purged per `retention_runs 0021` | GDPR 31 `retention 0021` + legal hold               | `mvp-p13 retention purge 4.6`                                             |

**Stop/pivot criteria (overlay 144):** Product-market `candidate 62% applied`
not reached in pilot; trust `cross-ws 404` fails; operational `p95 120ms`
degrades beyond `200` with `+0.71s LangGraph` not bounded → `CONDITIONAL GO`
only non-dependent planning.

---

_Evidence: `06 900+ enterprise vision` + `test_F pending` +
`mvp-p17 93.2 observability 23 panels` → `CONT-P01-R03/R04`._
