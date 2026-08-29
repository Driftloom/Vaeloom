# CONT-P08 — 08 Registers

**Version:** 1.0 | **Date:** 2026-08-29 | **Commit:** `e255d63`+`cont-p08`

## Risk Register

| ID               | Risk                                        | Severity | Impact               | Mitigation                             | Owner            | Status |
| ---------------- | ------------------------------------------- | -------- | -------------------- | -------------------------------------- | ---------------- | ------ |
| RISK-CONT-P08-01 | Docs mistaken for runtime completion        | Critical | False readiness      | Require runtime evidence/status labels | Phase owner      | OPEN   |
| RISK-CONT-P08-02 | Scope/permission/data/compatibility assumed | High     | Leak/loss/rework     | Block or reversible decision           | Product/Arch/Sec | OPEN   |
| RISK-CONT-P08-03 | External API/model/standard changes         | High     | Regression           | Pin versions, consumer inventory       | Integration/AI   | OPEN   |
| RISK-CONT-P08-04 | Evidence incomplete                         | High     | Untrustworthy gate   | Immutable 06-gate + EVD bundle         | QA/Release       | OPEN   |
| RISK-CONT-P08-05 | Old/new divergence                          | Critical | Data/permission harm | Reconciliation ledger, pause/rollback  | Migration        | OPEN   |

## Decision Register

| ID              | Decision                                     | Date       | Owner         | Status   |
| --------------- | -------------------------------------------- | ---------- | ------------- | -------- |
| DEC-CONT-P08-01 | Additive OpenAPI 110 v1 + idempotency sha256 | 2026-08-29 | API Architect | Accepted |
| DEC-CONT-P08-02 | Async job Temporal 8 queues + webhook DLQ    | 2026-08-29 | Integration   | Accepted |
| DEC-CONT-P08-03 | Scope from verified identity + 42/42 RLS     | 2026-08-29 | Security      | Accepted |
| DEC-CONT-P08-04 | SDK mcp 2026-07-28 + readOnlyHint            | 2026-08-29 | Integration   | Accepted |
| DEC-CONT-P08-05 | Compatibility shadow 20 + Sunset header      | 2026-08-29 | API Architect | Accepted |

## Assumption Register

| ID              | Assumption                                         | Owner            | Expiry   |
| --------------- | -------------------------------------------------- | ---------------- | -------- |
| ASM-CONT-P08-01 | BQ-05 design partners deferred until CONT-P19      | Business/Program | CONT-P19 |
| ASM-CONT-P08-02 | BQ-06 consumers shadow not measured until CONT-P19 | Integration      | CONT-P19 |

## Traceability

`R01→01` `R02→all DELs` `R03→03` `R04→64+40` `R05→02` `R06→01,03` `R07→EVD`
`R08→06-gate` — no gap.

## Change Register

No scope/contract/permission change — additive contracts only.
