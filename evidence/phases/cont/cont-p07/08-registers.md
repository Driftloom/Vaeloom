# CONT-P07 — 08 Registers

**Version:** 1.0 | **Date:** 2026-08-29 | **Commit:** `0dc782d`+`cont-p07`

## Risk Register

| ID               | Risk                                        | Severity | Impact               | Mitigation                             | Owner            | Status |
| ---------------- | ------------------------------------------- | -------- | -------------------- | -------------------------------------- | ---------------- | ------ |
| RISK-CONT-P07-01 | Docs mistaken for runtime completion        | Critical | False readiness      | Require runtime evidence/status labels | Phase owner      | OPEN   |
| RISK-CONT-P07-02 | Scope/permission/data/compatibility assumed | High     | Leak/loss/rework     | Block or reversible decision           | Product/Arch/Sec | OPEN   |
| RISK-CONT-P07-03 | External API/model/standard changes         | High     | Regression           | Pin versions, kill switch              | Integration/AI   | OPEN   |
| RISK-CONT-P07-04 | Evidence incomplete                         | High     | Untrustworthy gate   | Immutable 06-gate + EVD bundle         | QA/Release       | OPEN   |
| RISK-CONT-P07-05 | Old/new divergence                          | Critical | Data/permission harm | Reconciliation ledger, pause/rollback  | Migration        | OPEN   |

## Decision Register

| ID              | Decision                                                             | Date       | Owner          | Status   |
| --------------- | -------------------------------------------------------------------- | ---------- | -------------- | -------- |
| DEC-CONT-P07-01 | Data model v1 mapping cell_id nullable expand–contract               | 2026-08-29 | Data Architect | Accepted |
| DEC-CONT-P07-02 | Isolation via TenantContext + 42/42 RLS + validate_workspace_binding | 2026-08-29 | Security Arch  | Accepted |
| DEC-CONT-P07-03 | Provenance content_hash + supersession + rights 30d                  | 2026-08-29 | Privacy        | Accepted |
| DEC-CONT-P07-04 | Migration ledger source/target IDs + checksum never infer            | 2026-08-29 | SRE            | Accepted |
| DEC-CONT-P07-05 | Indexes Vector 1536 ivfflat + k6 p95 120ms capacity                  | 2026-08-29 | SRE            | Accepted |

## Assumption Register

| ID              | Assumption                                        | Owner            | Expiry   |
| --------------- | ------------------------------------------------- | ---------------- | -------- |
| ASM-CONT-P07-01 | BQ-05 design partners deferred until CONT-P19     | Business/Program | CONT-P19 |
| ASM-CONT-P07-02 | Backup restore drill deferred to staging CONT-P15 | SRE              | CONT-P15 |

## Traceability

`R01→01` `R02→all DELs` `R03→02,03` `R04→64+40` `R05→04,05` `R06→01,03`
`R07→EVD` `R08→06-gate` — no gap.

## Change Register

No scope/contract/permission change — additive data model + ledger only.
