# MVP-P01 — 17. Input Readiness Matrix (prompt §7)

> **Prompt reference:** `MVP-P01` §7 — "Input Readiness Matrix" — every input
> statused with required evidence, owner and impact. **Date:** 2026-08-13
> (re-run, closed by USER) **Rule applied (prompt §8):** use `UNKNOWN`,
> `TO_BE_VERIFIED`, `REQUIRES_STAKEHOLDER_DECISION` or
> `REQUIRES_PROFESSIONAL_REVIEW`; never invent values. This is the discovery
> phase — runtime validation inputs are `BLOCKING_ACCESS_UNKNOWN` and owned by
> later phases, never silently claimed.

| Input              | Status                  | Required evidence                                                                                                                                                | Owner               | Impact                                                                          |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| Requirements       | VERIFIED                | INT-02/INT-05 canonical; MVP-P01-R01..R08 mapped (03 EVD table); BQ-01..06 statused (04)                                                                         | Product/BA          | Blocks implementation (none in discovery)                                       |
| Previous handoff   | VERIFIED                | P00 CLOSED 2026-08-13 (gate 75.69/100, restrictions); audit PA-MVP-P01-001..012, scorecard 92/100 (02)                                                           | Previous owner      | Blocks execution — satisfied (entry = CONDITIONAL GO — NON-DEPENDENT WORK ONLY) |
| Repository         | VERIFIED                | Baseline `1def16d` pinned, pushed 0/0; docs-only re-run; no code change (02 PA-010/012, 14 §2)                                                                   | Engineering         | Blocks changes — satisfied (docs-only phase)                                    |
| Environment        | BLOCKING_ACCESS_UNKNOWN | Reproducible representative setup for runtime validation (no env/credentials; BQ-02 deferred P19, ASP-04)                                                        | Platform/QA         | Blocks runtime validation — none claimed; owned P15/P17/P19                     |
| Data               | BLOCKING_ACCESS_UNKNOWN | Representative/licensed/consented cohort data (no cohort access; REQUIRES_STAKEHOLDER_DECISION EVD-014, RB-04)                                                   | Data/Privacy        | Blocks data/AI tests — eval-set plan owned P02/P12                              |
| Security/privacy   | PARTIAL                 | Threat/classification/retention/consent design done (03 §4, S-01..09); live consent activation REQUIRES_STAKEHOLDER_DECISION; legal review P13 (RISK-MVP-P01-03) | Security/Privacy    | Blocks high-risk live work — cohort launch needs USER                           |
| Contracts/design   | PARTIAL                 | Approval contract + draft-only + provenance designs recorded (S-01..05); certification P08/P13 (VB-03)                                                           | Architecture/API/UX | Blocks dependent work — implementation owned P05+                               |
| Operations/release | NOT_APPLICABLE (P01)    | No runtime/release in discovery; runbook/rollback/telemetry evidence owned P15/P17/P19 (M-14..18)                                                                | SRE/Release         | Blocks release work — no release in P01                                         |

## Summary

- **VERIFIED / usable now:** Requirements, Previous handoff, Repository.
- **PARTIAL (design complete; activation needs people):** Security/privacy,
  Contracts/design.
- **BLOCKING_ACCESS_UNKNOWN:** Environment, Data — both owned by later phases
  (P02 cohort activation, P15/P17/P19 environments); none blocks P01's discovery
  outputs.
- **NOT_APPLICABLE:** Operations/release (discovery phase).

## Follow-up contract

1. Each BLOCKING_ACCESS_UNKNOWN row converts to VERIFIED only when its owning
   phase attaches evidence (P02 cohort/eval set; P15/P17 runs; P19 env).
2. Cohort activation and BQ-06 numeric thresholds remain
   REQUIRES_STAKEHOLDER_DECISION (USER) — nothing in this matrix claims them
   closed.
3. This matrix is refreshed at every subsequent phase entry using its prompt §7
   equivalent.
