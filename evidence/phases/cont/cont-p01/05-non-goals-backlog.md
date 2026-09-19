# CONT-P01 — 05 Non-Goals / Research Backlog — Contradiction Resolution

**Deliverable:** `DEL-CONT-P01-05` | **Owner:** Product Manager (approver) |
**Date:** 2026-08-28

## 1. Explicit Non-Goals (approved, with owner/date)

| #     | Non-Goal                                                                      | Reason                                      | Owner    | Impact if Attempted                 |
| ----- | ----------------------------------------------------------------------------- | ------------------------------------------- | -------- | ----------------------------------- |
| NG-01 | Big-bang rewrite (not Strangler)                                              | `Track Mission 06` expand→contract only     | EntArch  | Blocks via gate `mandatory blocker` |
| NG-02 | Silent permission expansion (new tools without approval gate)                 | `06 458` plugin/MCP governance `5.3`        | SecArch  | `cross-scope access` block          |
| NG-03 | Unverified dual writes (`write_memory` twice without `SELECT canonical_name`) | `Risk R-05` divergence                      | Data     | `0 diff` idempotency required       |
| NG-04 | All-tenant cutover without design-partner canary/pause/rollback               | `Track-wide fixed decision` per tenant/cell | Program  | Gate `NO-GO`                        |
| NG-05 | Enterprise launch without `CONT-P19/20` pilot evidence (U-01)                 | `BQ-05` no window                           | Business | `BLOCKING` pilot                    |
| NG-06 | Mobile native app (MVP out-of-scope)                                          | `PRD 52` responsive web only                | Product  | `NOT_APPLICABLE` deferred ENT       |

**Contradiction `CONT-P01 145` (segment by age/region/institution vs generic)
resolved:** MVP `01` generic student persona is **baseline for MVP**;
`CONT-P01 02-persona-jtbd` explicitly segments by age/region/institution/data
sensitivity (8 rows) with distinct `GDPR/WCAG/DPDP` controls — no silent expand
of MVP scope, new segments require `CONT-P02` design-partner validation per
`A-01`.

## 2. Research Backlog (future-ready improvements per 109)

| Idea                                 | Problem/Evidence                               | Target Users         | Deps                                   | Sec/Privacy/Data        | Cost                 | Compat/Migration Impact                                                             | Validation Experiment                          | Adoption Trigger            | Owner       | Sunset                    |
| ------------------------------------ | ---------------------------------------------- | -------------------- | -------------------------------------- | ----------------------- | -------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------- | ----------- | ------------------------- |
| 6→22 memory via shadow reads         | `PS-03` tenant cohort leak                     | Enterprise employee  | `CONT-P07` cells                       | `stable IDs` provenance | `P07` mapping        | expand-contract per-phase flags, reconciliation ledger per-wave, `counts/checksums` | Shadow `R-05` `rag_status`                     | `CONT-P12` eval pass        | Data        | Reject if provenance loss |
| 8→28 agent via shadow                | `PS-04` MVP 8 insufficient for coding/research | Developer/researcher | `AGENT_REACT_ENABLED` gated `CONT-P12` | `OWASP Top10 agentic`   | `AGENT_RPM 30` quota | `MCP 2026-07-28` pinned, kill-switch                                                | `CONT-P12` eval 12 cases                       | `AGENT_REACT_ENABLED` gated | AI          | Sunset if quality not ↑   |
| OAuth least-privilege GitHub 7 tools | `PS-02` token refresh                          | All                  | `EXT-13` fine-grained perms            | `RFC 9700` PKCE         | `0.02/1k`            | Least-privilege scopes                                                              | `test_H github scope github in required_scope` | `CONT-P02`                  | Integration | `CONT-P08`                |
| Regional residency                   | `U-04`                                         | EU India             | `CONT-P07` cell                        | `DPDP Rules 2025`       | `+infra`             | `tenant_id` residency `Multi-Tenancy.md`                                            | `CONT-P15` capacity                            | Design partner window       | EntArch     | `CONT-P15`                |

Each deferred idea records `compatibility horizon = per-wave flag`,
`migration owner`, `reconciliation metric = counts/checksums tenant-scoped`,
`cutover trigger = partner canary 0 error`,
`rollback = SETNX/REJECT_DUPLICATE revert`,
`legacy-retirement = zero traffic + restore drill + owner approval` per 107.

## 3. Validation Backlog (`WS-01.5`)

| Validation                            | Owner       | When       | Evidence                     |
| ------------------------------------- | ----------- | ---------- | ---------------------------- |
| User `wrong memory` overreach         | Product     | `CONT-P02` | Counterexample `merge_check` |
| Missed deadlines `Gmail push` renewal | Integration | `CONT-P02` | `EXT-12` verification        |
| Confusing approvals                   | UX          | `CONT-P09` | `frontend-audit` a11y        |
| Difficult deletion `Memory deleted`   | Privacy     | `CONT-P13` | `retention_runs 0021`        |

_Trace: `CONT-P01 overlay 149` → `DEL-CONT-P01-05 v1.0`._
