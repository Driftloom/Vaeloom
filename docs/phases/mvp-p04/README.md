# MVP-P04 — Project Planning & Delivery Governance

> **Prompt:** `MVP-P04` (66-prompt pack, validated) — planning phase, no runtime
> execution · **Governing sources:** INT-02 (SHA-256 `2FA8966F…69640`) · INT-05
> · INT-07/08/09 · gatekeeper compendiums · **Predecessor:** MVP-P03 ✅ CLOSED
> 2026-08-14 (gate 89.7/100, DEC-P03-01..05) · **Status:** ✅ V2 RE-RUN
> 2026-08-15 — docs 01–11 written at baseline `dac2630`; gate **97.0/100**
> APPROVED — PROCEED (recommendation), pending user ratification; handoff to P05
> ready. Prior V1 run 2026-08-15 preserved as `*-2026-08-15.md` (88.5/100,
> CONDITIONAL GO superseded). Prior run 2026-08-07 preserved as
> `*-2026-08-07.md` (88/100, never ratified).

## Blocking questions (prompt §8) — resolved, carried from P00–P03 + P04

| ID    | Question                        | Decision                                                                             | Owner                 | Effect                  |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------ | --------------------- | ----------------------- |
| BQ-01 | Accountable approver + backup   | User = sole approver; backup = none (solo)                                           | Program/Product       | Gate blocks             |
| BQ-02 | Baseline/repo/env/evidence      | `master` @ `dac2630`; repo = repo; env = local dev; no production                    | Engineering           | Execution blocks        |
| BQ-03 | Entities/ages/regions/use cases | India; 18+; individuals; P1+P2 personas (BQ-P02-02)                                  | Legal/Privacy/Product | Release blocks          |
| BQ-04 | Launch region/min age           | India; 18+; child controls N/A (excluded)                                            | Product/Legal         | P13/19 blocks           |
| BQ-05 | Team/budget/cohort/ship window  | Founder + AI agents; $0; cohort N≈10–20; **ship window scenario-based (DEC-P04-02)** | Founder/Program       | Commitment blocks       |
| BQ-06 | Resource/date/procurement       | $0 hard cap (DEC-P01-08); free tiers; cohort signup open                             | Accountable owner     | Blocks where unresolved |

## Register index (V2 — Current)

| #   | Document                           | Purpose                                                                                                                        |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 00  | `00-audit-findings-v2.md`          | **NEW** — Zero-trust audit findings with corrected counts                                                                      |
| 01  | `01-source-register.md`            | Sources + standards re-verified 2026-08-15 + conflicts CF-P04-01..04                                                           |
| 02  | `02-predecessor-audit.md`          | Forensic audit of P03 → entry CONDITIONAL GO                                                                                   |
| 03  | `03-roadmap-v2.md`                 | **DEL-MVP-P04-01** — integrated roadmap P05→P21 (V2: acceptance criteria, evidence owners, test commands, rollback procedures) |
| 04  | `04-dependency-graph-v2.md`        | **DEL-MVP-P04-02** — dependency/critical path (V2: slack analysis, risk-adjusted timelines, kill-switch procedures)            |
| 05  | `05-raci-approvals-v2.md`          | **DEL-MVP-P04-03** — RACI/approval matrix (V2: escalation matrix, approval workflows, decision log template)                   |
| 06  | `06-risk-governance-v2.md`         | **DEL-MVP-P04-04** — risk burndown + calendars (V2: burndown chart, kill-switch procedures, risk metrics)                      |
| 07  | `07-resource-cost-scenarios-v2.md` | **DEL-MVP-P04-05** — resource/cost scenarios (V2: per-phase allocation, verification plans, cost optimization)                 |
| 08  | `08-registers-v2.md`               | Risks/decisions/assumptions/unknowns (V2: traceability links, evidence IDs)                                                    |
| 09  | `09-gate-v2.md`                    | End-of-phase gate (**97.0/100** APPROVED — PROCEED)                                                                            |
| 10  | `10-handoff-to-p05-v2.md`          | Next-phase handoff (Solution Architecture)                                                                                     |
| 11  | `11-completion-response-v2.md`     | §30 A–P completion response                                                                                                    |

## Register index (V1 — Historical, Superseded)

| #   | Document                               | Purpose                                                              |
| --- | -------------------------------------- | -------------------------------------------------------------------- |
| 03  | `03-roadmap.md`                        | DEL-MVP-P04-01 V1 (superseded by `03-roadmap-v2.md`)                 |
| 04  | `04-dependency-graph.md`               | DEL-MVP-P04-02 V1 (superseded by `04-dependency-graph-v2.md`)        |
| 05  | `05-raci-approvals.md`                 | DEL-MVP-P04-03 V1 (superseded by `05-raci-approvals-v2.md`)          |
| 06  | `06-risk-governance.md`                | DEL-MVP-P04-04 V1 (superseded by `06-risk-governance-v2.md`)         |
| 07  | `07-resource-cost-scenarios.md`        | DEL-MVP-P04-05 V1 (superseded by `07-resource-cost-scenarios-v2.md`) |
| 08  | `08-registers.md`                      | Registers V1 (superseded by `08-registers-v2.md`)                    |
| 09  | `09-gate-2026-08-15.md`                | Gate V1 88.5/100 (superseded by `09-gate-v2.md`)                     |
| 10  | `10-handoff-to-p05.md`                 | Handoff V1 (superseded by `10-handoff-to-p05-v2.md`)                 |
| 11  | `11-completion-response-2026-08-15.md` | Completion V1 (superseded by `11-completion-response-v2.md`)         |

## Workstreams

| WS      | Workstream                       | Owner               | Output (V2)                        |
| ------- | -------------------------------- | ------------------- | ---------------------------------- |
| WS-04.1 | Delivery decomposition           | Program Manager     | `03-roadmap-v2.md`                 |
| WS-04.2 | Dependency/critical path         | Engineering Manager | `04-dependency-graph-v2.md`        |
| WS-04.3 | Governance/RACI/approvals        | Program Manager     | `05-raci-approvals-v2.md`          |
| WS-04.4 | Risk/issue/decision control      | Risk Owner          | `06-risk-governance-v2.md`         |
| WS-04.5 | Capacity/cost/schedule scenarios | FinOps Specialist   | `07-resource-cost-scenarios-v2.md` |

## Scope note

- **In:** decomposition, critical path, governance, risk/decision control,
  capacity/cost scenarios.
- **Out:** runtime implementation; production changes; enterprise features;
  T2/T3 enablement.
- **Repo truth:** repo is NOT greenfield — **26 packages** (verified), 2333
  backend tests passing (plausible with parametrize expansion), 11 GitHub
  Actions workflows, CI/CD, OTel, RBAC, multi-tenancy exist. P04 plan treats
  repo as existing implementation to reconcile + harden, not build from scratch
  (CF-P04-01/03). See `00-audit-findings-v2.md` for full verification.
