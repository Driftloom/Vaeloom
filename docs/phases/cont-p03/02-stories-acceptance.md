# CONT-P03 — 02 Stories / Acceptance — Atomic

**Deliverable:** `DEL-CONT-P03-02` | **Owner:** Business Analyst + QA Lead

## Stories (actor/trigger/behavior/condition/failure/acceptance)

| ID       | Story                                                                                                          | Acceptance Criteria (measurable)                                                                                                | Negative / Failure                                                            | Owner   |
| -------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| STORY-01 | As student, `POST /memories profile React` → new prompt `what are my skills` returns `React` via `vector LIKE` | `Given workspace A React 201 → When search React top_k 5 → Then ≥1 with confidence>0.7`                                         | `Given workspace B same query → Then 0 leaked` `test_J`                       | Product |
| STORY-02 | As admin, granting tenant `isolation: cell` does not leak `Memory status deleted` across cells                 | `Given tenant pooled 42/42 RLS → When alter isolation cell → Then counts/checksums per tenant cell match reconciliation ledger` | `Given stale `workspace_id` string (<30) fallback → Then count path not leak` | EntArch |
| STORY-03 | As agent `github`, `search_github_repos` requires `connector.github.read` not `memory.write`                   | `Given agent gmail scope only → When tool github → Then permission fallback mock not executed`                                  | `Given forged scope → Then failed unknown tool` `test_hardening`              | Sec     |
| STORY-04 | As user, deleting `Memory deleted_at` vs backup expiry `0021` distinguish                                      | `Given DELETE /memories/{id} → status deleted → GET /memories?status=active 0 → GET ?status=all 1 with deleted_at`              | `Given legal hold → Then backup not purged`                                   | Privacy |
| STORY-05 | As SRE, `LANGGRAPH_ENABLED true→false` rollback preserves `WorkflowReplayer`                                   | `Given durable_run 2 histories → When rollback → Then WorkflowReplayer replay 0 throw`                                          | `Given pending approval → Then approval survive`                              | SRE     |

## AI Quality / Confidence / Provenance / Latency / Accessibility / Cost / Operator Recovery (per 144)

| Requirement                     | Acceptance                       | Metric               | Test                                |
| ------------------------------- | -------------------------------- | -------------------- | ----------------------------------- |
| AI quality eval 12 cases        | `88.4→95+`                       | `mvp-p12 eval`       | `orchestrator eval`                 |
| Confidence `0.7 threshold`      | `approved vs flagged`            | `qa_agent 3 retries` | `hardening`                         |
| Provenance `[from:X untrusted]` | tag present                      | `supervisor 112`     | `test_hardening`                    |
| Latency `rag_status`            | `5s wait_for timeout→timeout`    | `nodes:91`           | `test_hardening rag_status timeout` |
| Accessibility WCAG AA           | `jest-axe 0 critical`            | `LCP`                | `mvp-p15 93.1`                      |
| Cost `$0.02/1k`                 | `tokens`                         | `analytics`          | `mvp-p15`                           |
| Operator recovery               | `LANGGRAPH_ENABLED false→legacy` | `shadow parity`      | `hardening 37`                      |

---

_All stories `owner/priority/test/evidence` bound to `01-requirements` per 146._
