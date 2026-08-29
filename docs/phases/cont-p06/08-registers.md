# CONT-P06 — 08 Registers

**Version:** 1.0 | **Date:** 2026-08-29 | **Commit:** `3f61cfa`+`cont-p06`

## Risk Register

| ID               | Risk                                        | Severity | Impact               | Mitigation                             | Owner            | Status |
| ---------------- | ------------------------------------------- | -------- | -------------------- | -------------------------------------- | ---------------- | ------ |
| RISK-CONT-P06-01 | Docs mistaken for runtime completion        | Critical | False readiness      | Require runtime evidence/status labels | Phase owner      | OPEN   |
| RISK-CONT-P06-02 | Scope/permission/data/compatibility assumed | High     | Leak/loss/rework     | Block or reversible decision           | Product/Arch/Sec | OPEN   |
| RISK-CONT-P06-03 | External API/model/standard changes         | High     | Regression           | Pin versions, tests, kill switch       | Integration/AI   | OPEN   |
| RISK-CONT-P06-04 | Evidence incomplete                         | High     | Untrustworthy gate   | Immutable 06-gate + EVD bundle         | QA/Release       | OPEN   |
| RISK-CONT-P06-05 | Old/new divergence                          | Critical | Data/permission harm | Reconciliation ledger, pause/rollback  | Migration        | OPEN   |

## Decision Register

| ID              | Decision                                                           | Date       | Owner            | Status   |
| --------------- | ------------------------------------------------------------------ | ---------- | ---------------- | -------- |
| DEC-CONT-P06-01 | Pin FastAPI 0.141.1 + Next 15.5 + langgraph 0.2.39 + Temporal 1.26 | 2026-08-29 | Solution Arch    | Accepted |
| DEC-CONT-P06-02 | Version policy frozen lock + EOL weekly via dependabot + deps.dev  | 2026-08-29 | Platform         | Accepted |
| DEC-CONT-P06-03 | Engineering standards ruff/mypy/nx + expand–contract 12 migrations | 2026-08-29 | Backend/Frontend | Accepted |
| DEC-CONT-P06-04 | Supply-chain SLSA L2 cosign KMS + Trivy 0 CRIT                     | 2026-08-29 | Security         | Accepted |
| DEC-CONT-P06-05 | Cost PaaS-first deferred (ADR-026) + per-tech exit W2→P19          | 2026-08-29 | FinOps           | Accepted |

## Assumption Register

| ID              | Assumption                                    | Owner             | Expiry   |
| --------------- | --------------------------------------------- | ----------------- | -------- |
| ASM-CONT-P06-01 | BQ-05 design partners deferred until CONT-P19 | Business/Program  | CONT-P19 |
| ASM-CONT-P06-02 | BQ-06 procurement deferred, no invented cost  | Accountable owner | CONT-P16 |

## Traceability

`R01→01` `R02→01,02,04` `R03→04` `R04→64+40` `R05→05` `R06→01,02` `R07→EVD`
`R08→06-gate` — no gap.

## Change Register

No scope/contract/permission/retention change — additive pin only.
