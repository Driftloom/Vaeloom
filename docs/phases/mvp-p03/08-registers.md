# MVP-P03 — 08. Registers (Risks / Decisions / Assumptions)

## 1. Risks

| ID          | Risk                                 | Severity | Impact             | Mitigation                                                      | Owner            | Status |
| ----------- | ------------------------------------ | -------- | ------------------ | --------------------------------------------------------------- | ---------------- | ------ |
| RISK-P03-01 | Docs mistaken for runtime completion | Critical | False readiness    | Runtime evidence at implementation gates                        | Phase owner      | OPEN   |
| RISK-P03-02 | Scope/permission/data assumed        | High     | Leak/loss/rework   | BQ decisions recorded; approved change control                  | Product/Security | OPEN   |
| RISK-P03-03 | External API/model/standard drift    | High     | Regression         | Pins, owners, tests, kill switches (AUTO-01..03)                | Integration/AI   | OPEN   |
| RISK-P03-04 | Evidence incomplete                  | High     | Untrustworthy gate | Evidence plan + immutable reports                               | QA               | OPEN   |
| RISK-P03-05 | MVP scope expansion                  | High     | Delay/complexity   | MoSCoW + release baseline + change control                      | Product          | OPEN   |
| RISK-P03-06 | T3 auto-apply trust/account risk     | High     | Trust/legal        | Review-first default; pacing; audit; AUTO-03; legal review gate | Product/Security | OPEN   |
| RISK-P03-07 | Cohort interviews still pending      | Medium   | Validation gap     | Proxy evidence; VB-07 blocked on user                           | UX               | OPEN   |

## 2. Decisions (P03)

| ID         | Decision                                                                            | Value       | Authority  | Date |
| ---------- | ----------------------------------------------------------------------------------- | ----------- | ---------- | ---- |
| DEC-P03-01 | BQ-P02-01: value prop = memory-first **led by automation** (tiered)                 | User        | 2026-08-07 |
| DEC-P03-02 | BQ-P02-02: launch personas **P1 + P2 together**                                     | User        | 2026-08-07 |
| DEC-P03-03 | BQ-P02-03: thresholds = ≥80% retrieval, ≥90% extraction, 0 data-loss, 100% deletion | User        | 2026-08-07 |
| DEC-P03-04 | BQ-P02-04: load target 100 concurrent / upper bound 1,000                           | User        | 2026-08-07 |
| DEC-P03-05 | CF-P03-01: T1 = MVP; T2/T3 gated per DEC-P02-05                                     | User        | 2026-08-07 |
| DEC-P03-06 | CF-P03-02: repo truth (Next.js/FastAPI) outranks prompt prose                       | Evidence    | 2026-08-07 |
| DEC-P03-07 | Requirements baseline APPROVED_BASELINE pending gate                                | Phase owner | 2026-08-07 |

## 3. Assumptions

| ID         | Assumption                                               | Owner      | Reversible?        | Approval    |
| ---------- | -------------------------------------------------------- | ---------- | ------------------ | ----------- |
| ASP-03     | Draft-only Gmail default; send per-user T3               | Product    | Yes                | P02 amended |
| ASP-04     | No scraping default; T2 opt-in                           | Product    | Yes                | P02 amended |
| ASP-05     | Cohort volunteers free, no incentives                    | UX         | Yes                | P01         |
| ASP-06     | Gmail polling adequate MVP                               | Connector  | Yes — push path    | P02         |
| ASP-07     | Free tiers cover ≤100 users                              | Platform   | Yes — measured P13 | P02         |
| ASP-P03-01 | P1+P2 personas share one MVP surface (no separate flows) | Product    | Yes                | P03         |
| ASP-P03-02 | DPDP full enforcement 13 May 2027 (design-to-both)       | Compliance | No                 | P02/P03     |

## 4. Open unknowns

| ID         | Unknown                        | Category    | Blocks?          | Due     |
| ---------- | ------------------------------ | ----------- | ---------------- | ------- |
| UNK-01     | INT-01 template original       | Input       | No               | —       |
| UNK-02     | Production credentials         | Access      | GO P19           | P19     |
| UNK-03     | Cohort signup/timeline (VB-07) | Stakeholder | Interviews       | P03→P04 |
| UNK-P03-01 | T2/T3 legal review outcome     | Legal       | T2/T3 default-ON | P13     |
