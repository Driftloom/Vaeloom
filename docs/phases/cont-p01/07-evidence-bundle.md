# CONT-P01 — 07 Evidence Bundle & Registers

**Commit:** `78c2d71` | **Date:** `2026-08-28`

## Evidence Inventory

| ID               | Location                      | Hash      | Claim                                    |
| ---------------- | ----------------------------- | --------- | ---------------------------------------- |
| EVD-CONT-P01-001 | `01-problem-statement.md`     | `78c2d71` | 6 PS `PS-01..06` falsifiable 20 RPS      |
| EVD-CONT-P01-002 | `02-persona-jtbd.md`          | `78c2d71` | 8 segments `BQ-03` JTBD 5                |
| EVD-CONT-P01-003 | `03-value-risk-hypotheses.md` | `78c2d71` | 3 VH +5 RH stop `62%`                    |
| EVD-CONT-P01-004 | `04-success-metrics.md`       | `78c2d71` | 10 metrics aha <5 vs signup <15 resolved |
| EVD-CONT-P01-005 | `05-non-goals-backlog.md`     | `78c2d71` | 6 non-goals 4 backlog per 109            |
| EVD-CONT-P01-006 | `00-predecessor-audit.md`     | `98.2 GO` | `CONT-P00 95.47` forensic                |
| EVD-CONT-P01-007 | `test_product_closure_e2e 10` | `32s`     | `cross-ws 404` `rag_status`              |

## Registers (consolidated)

| Register     | File                                                | Owner       |
| ------------ | --------------------------------------------------- | ----------- |
| Risk         | `08-registers.md`                                   | Product/Sec |
| Decision     | `01..05 DEC-CONT-P01-01..`                          | EntArch     |
| Assumption   | `A-01..A-06`                                        | Program     |
| Traceability | `01..05 → CONT-P01-R01..R08 → EVD → gate → handoff` | Program     |

## Risk Register

| ID               | Risk                | Sev      | Mitigation                          | Owner       | Status    |
| ---------------- | ------------------- | -------- | ----------------------------------- | ----------- | --------- |
| RISK-CONT-P01-01 | Docs as runtime     | Critical | `01` falsifiable PS 20 RPS headroom | Phase owner | MITIGATED |
| RISK-CONT-P01-02 | Scope assumed       | High     | `05 horizon/owner/reconciliation`   | Arch        | MITIGATED |
| RISK-CONT-P01-03 | External API drift  | High     | Pin MCP 2026-07-28                  | Integration | OPEN      |
| RISK-CONT-P01-04 | Evidence incomplete | High     | `10 metrics` `7.5s cross-ws`        | QA          | MITIGATED |
| RISK-CONT-P01-05 | Old/new divergence  | Critical | `SETNX EX120` per-wave              | Migration   | MITIGATED |

## Decision Register

| ID              | Decision                                                     | Owner      | Date       |
| --------------- | ------------------------------------------------------------ | ---------- | ---------- |
| DEC-CONT-P01-01 | aha <5 design target vs signup <15 outer bound separate SLIs | Product+UX | 2026-08-28 |
| DEC-CONT-P01-02 | 8 MVP canonical vs 20 via shadow, no big-bang                | Product    | 2026-08-28 |
| DEC-CONT-P01-03 | 6→22 stable IDs never guessed                                | Data       | 2026-08-28 |
| DEC-CONT-P01-04 | Pilot `62% applied` deferred `CONT-P19`                      | Business   | 2026-08-28 |
| DEC-CONT-P01-05 | Desktop/VSCode NOT_APPLICABLE                                | Product    | 2026-08-28 |

## Handoff Register

`09-handoff-to-cont-p02.md` `v1.0 95.15 APPROVED PROCEED` authorizes `CONT-P02`.
