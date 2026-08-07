# MVP-P01 — Discovery and Problem Definition

> **Prompt:** `MVP-P01` (66-prompt pack, 2026-08-04, validated) — governing
> execution contract **Governing sources:** INT-02 (canonical for MVP,
> DEC-P00-06) · INT-05 (MVP scope) · gatekeeper compendiums (INT-01 substitute,
> user decision 2026-08-07) **Phase type:** DISCOVERY (docs/research/planning
> only — no production/dependent authorization) **Status:** ✅ GATED 2026-08-07
> — CONDITIONAL GO **88/100** (non-dependent work only) → `08-handoff-to-p02.md`

## Entry criteria (P00 handoff §4)

- [x] User approval to proceed — granted 2026-08-07
- [x] BQ-01/03/04/05 answered (register 04); BQ-06 stop/pivot approved
      (DEC-P01-05)
- [x] Baseline pushed / pinned (`bea5fe8`, origin/master)
- [x] INT-01 substitute recorded as governing; INT-02 canonical
- [x] Evidence plan defined — `03-evidence-plan.md` (PS-01..03, cohort,
      personas, JTBD, metrics, non-goals)

## Register index

| #   | Document                                  | Purpose                                                         |
| --- | ----------------------------------------- | --------------------------------------------------------------- |
| 01  | `01-source-register.md`                   | INT/EXT sources + standards overlay (versions verified)         |
| 02  | `02-predecessor-audit.md`                 | Forensic re-audit of P00 deliverables (PA-MVP-P01, 92/100)      |
| 03  | `03-evidence-plan.md`                     | Problem statements, cohort, personas P1–P3, JTBD, research plan |
| 04  | `04-risk-decision-assumption-register.md` | Risks, decisions (BQ-06, $0 budget), assumptions                |
| 05  | `05-validation-backlog.md`                | JTBD + validation experiments VB-01..06                         |
| 06  | `06-gate-report.md`                       | **CONDITIONAL GO 88/100, 2026-08-07**                           |
| 07  | `07-research-brief.md`                    | R-1 desk research with citations (MoSPI/AISHE/ATS/competitors)  |
| 08  | `08-handoff-to-p02.md`                    | Next-phase handoff                                              |

## Workstreams (prompt §11)

| WS      | Workstream                        | Owner               | Status                                                        |
| ------- | --------------------------------- | ------------------- | ------------------------------------------------------------- |
| WS-01.1 | Stakeholder/persona evidence      | Product/UX Research | ✅ Personas P1–P3 (hypotheses; R-2 validation pending cohort) |
| WS-01.2 | Problem/outcome framing           | Business Analyst    | ✅ PS-01..03 + wedge statement (research brief §5)            |
| WS-01.3 | Trust/safety/business constraints | Privacy/AI Product  | ✅ Constraint register (evidence plan §7)                     |
| WS-01.4 | Metrics and non-goals             | Product Manager     | ✅ Outcome metrics + non-goals (evidence plan §5–6)           |
| WS-01.5 | Validation backlog                | Product Manager     | ✅ VB-01..06 (05-validation-backlog.md)                       |

## Hard rules (prompt §5/§7)

- No invented user/customer facts — every claim needs source or approved
  stakeholder decision.
- No production/dependent authorization; no scope expansion; enterprise features
  stay disabled.
- Claims of secure/compliant/accessible require evidence, never prose.
