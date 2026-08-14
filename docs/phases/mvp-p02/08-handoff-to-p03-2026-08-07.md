# MVP-P02 — 08. Handoff to MVP-P03 (Requirements Engineering)

> **Phase:** MVP-P02 → MVP-P03 · **Date:** 2026-08-07 · **Gate state:** ✅
> CONDITIONAL GO (88/100) — restrictions in `07-gate-report.md`. P03 must
> validate, not assume, this handoff (prompt §31).

## 1. What P03 receives

| Item                                                                | Where                                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Research knowledge base (platform/policy/data/regulatory/build-buy) | `02-platform-research.md` … `05-build-buy.md`                    |
| Evidence chain (claims → sources → dates → reproducibility)         | per-doc "Evidence links" sections + `01-evidence-plan.md` §3     |
| Eval-set plan + licensing                                           | `03-data-feasibility.md` §3                                      |
| DPDP/EU-AI design inputs                                            | `04-regulatory-analysis.md`                                      |
| BQ-P02-01..04 proposed answers                                      | `06-registers.md` §5 (pending user confirmation)                 |
| Personas P1–P3 + JTBD + PS-01..03                                   | `../mvp-p01/03-evidence-plan.md`                                 |
| Validation backlog VB-01..08                                        | `../mvp-p01/05-validation-backlog.md` + `01-evidence-plan.md` §4 |
| Registers + P00/P01 chain                                           | `../mvp-p00/`, `../mvp-p01/`                                     |

## 2. P03 focus (per MVP-P03 prompt — requirements engineering)

1. Turn PS-01..03 + confirmed BQ-P02 answers into functional/non-functional
   requirements (locked scope: 8 agents, 6 memories, suggest-mode-first,
   draft-only Gmail, approved-integration-only).
2. Elicit connector requirements: Gmail read (polling) + draft; Sign In with
   LinkedIn (optional); user-performed search/apply with assistant tracking.
3. Specify data requirements: extract-don't-retain, deletion lifecycle, consent
   - notice (DPDP §5/§6), provenance per fact, eval-data licensing.
4. Define acceptance criteria traceable to evidence (memory quality ≥ thresholds
   from BQ-P02-03; deadline extraction accuracy).
5. Non-goals: no scraping, no auto-apply, no send, no compliance claims.

## 3. Constraints carried into P03

- $0 budget (DEC-P01-07); volunteer cohort (DEC-P01-06); user sole approver;
  India/18+/individuals; closed cohort; no deadline.
- Stop/pivot criteria active (DEC-P01-05).
- Platform ToS boundary: no scraping/automated submission (Proxycurl precedent).
- DPDP Rules 2025 phased (full enforcement 13 May 2027) — design-to-both
  posture.
- No new runtime dependencies in research phase; P03 requirements must be
  implementation-feasible on existing stack.

## 4. Prohibited work in P03 until further notice

- No production/dependent authorization; no paid research; no compliance claims
  without legal review; no cohort PII in CI/eval.

## 5. Automation requirements for P03 (DEC-P02-05 � user ""all above"", 2026-08-07)

Requirements engineering must cover the tiered automation surface:

1. **Tier 1 (MVP core):** Gmail polling watcher (deadline extraction),
   application auto-track, auto-draft generation, reminder/follow-up scheduler,
   URL job ingest, interview prep assembler. Official Gmail API only (readonly +
   compose); no send scope by default.
2. **Tier 2 (flag AUTO-02, default OFF, opt-in):** read-only discovery scraping
   of public job listings (Apify-style); normalized job records; pacing + kill
   switch
   - no anti-bot evasion; legal review before default-ON at P13.
3. **Tier 3 (approval contract, default OFF):** auto-apply engine � review-first
   mode (draft -> user edits -> send) is the default; autopilot mode requires
   per-plan consent, pacing caps, audit, AUTO-03 kill switch, and legal/platform
   review. gmail.send only with per-user Tier-3 enablement.
4. **Cross-cutting:** kill-switch matrix (AUTO-01/02/03), per-user
   opt-in/consent (DPDP s5/s6), immutable audit log, stop/pivot hooks.
5. Full blueprint: 09-automation-blueprint.md. Risks RISK-P02-07..09 carried.
