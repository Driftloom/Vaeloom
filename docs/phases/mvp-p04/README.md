# MVP-P04 — Project Planning & Delivery Governance

> **Prompt:** `MVP-P04` (66-prompt pack, validated) — planning phase, no runtime
> execution **Governing sources:** INT-02 (SHA-256 `2FA8966F…69640`) · INT-05 ·
> INT-07/08/09 · gatekeeper compendiums · **Predecessor:** MVP-P03 ✅
> CONDITIONAL GO 88/100, ratified by user 2026-08-07 **Status:** ✅ COMPLETE —
> docs 01–10 written 2026-08-07; gate 89/100 CONDITIONAL GO, pending user
> ratification; handoff to P05 ready

## Blocking questions (prompt §8) — resolved, carried from P00–P03

| ID    | Question                        | Decision                                                       | Owner                 | Effect                  |
| ----- | ------------------------------- | -------------------------------------------------------------- | --------------------- | ----------------------- |
| BQ-01 | Accountable approver + backup   | User = sole approver; backup = none (solo)                     | Program/Product       | Gate blocks             |
| BQ-02 | Baseline/repo/env/evidence      | `master`; repo = repo; env = local dev; no production          | Engineering           | Execution blocks        |
| BQ-03 | Entities/ages/regions/use cases | India; 18+; individuals; P1+P2 personas (BQ-P02-02)            | Legal/Privacy/Product | Release blocks          |
| BQ-04 | Launch region/min age           | India; 18+; child controls N/A (excluded)                      | Product/Legal         | P13/19 blocks           |
| BQ-05 | Team/budget/cohort/ship window  | Founder + AI agents; $0; volunteer cohort N≈10–20; no deadline | Founder/Program       | Commitment blocks       |
| BQ-06 | Resource/date/procurement       | $0 hard cap (DEC-P01-07); free tiers; cohort signup open       | Accountable owner     | Blocks where unresolved |

## Register index

| #   | Document                        | Purpose                                         |
| --- | ------------------------------- | ----------------------------------------------- |
| 01  | `01-source-register.md`         | Sources + conflict log (CF-P04-01)              |
| 02  | `02-predecessor-audit.md`       | Forensic audit of P03 → entry GO                |
| 03  | `03-roadmap.md`                 | **DEL-MVP-P04-01** — integrated roadmap P05→P21 |
| 04  | `04-dependency-graph.md`        | **DEL-MVP-P04-02** — dependency/critical path   |
| 05  | `05-raci-approvals.md`          | **DEL-MVP-P04-03** — RACI/approval matrix       |
| 06  | `06-risk-governance.md`         | **DEL-MVP-P04-04** — risk burndown + calendars  |
| 07  | `07-resource-cost-scenarios.md` | **DEL-MVP-P04-05** — resource/cost scenarios    |
| 08  | `08-registers.md`               | Risks/decisions/assumptions/unknowns            |
| 09  | `09-gate-report.md`             | End-of-phase gate                               |
| 10  | `10-handoff-to-p05.md`          | Next-phase handoff (Solution Architecture)      |

## Workstreams

| WS      | Workstream                       | Owner               | Output                          |
| ------- | -------------------------------- | ------------------- | ------------------------------- |
| WS-04.1 | Delivery decomposition           | Program Manager     | `03-roadmap.md`                 |
| WS-04.2 | Dependency/critical path         | Engineering Manager | `04-dependency-graph.md`        |
| WS-04.3 | Governance/RACI/approvals        | Program Manager     | `05-raci-approvals.md`          |
| WS-04.4 | Risk/issue/decision control      | Risk Owner          | `06-risk-governance.md`         |
| WS-04.5 | Capacity/cost/schedule scenarios | FinOps Specialist   | `07-resource-cost-scenarios.md` |

## Scope note

- **In:** decomposition, critical path, governance, risk/decision control,
  capacity/cost scenarios.
- **Out:** runtime implementation; production changes; enterprise features;
  T2/T3 enablement.
- **Repo truth:** repo is NOT greenfield — 25 packages, 1626 backend tests
  passing, CI/CD, OTel, RBAC, multi-tenancy exist. P04 plan treats repo as
  existing implementation to reconcile + harden, not build from scratch
  (CF-P04-01).
