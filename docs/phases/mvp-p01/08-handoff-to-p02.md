# MVP-P01 — 08. Handoff to MVP-P02 (Research, Domain Analysis & Data Discovery)

> **Phase:** MVP-P01 → MVP-P02 **Date:** 2026-08-07 **Baseline:** repo `master`
> @ `8b143d5` + `75fc6aa` (+ P01 research commit) **Gate state:** ✅ CONDITIONAL
> GO (88/100) — non-dependent research work only; expiry at P02 gate

## 1. What P02 receives (validated)

| Item                                                        | Where                                     |
| ----------------------------------------------------------- | ----------------------------------------- |
| Evidence plan (PS-01..03, cohort, JTBD, metrics, non-goals) | `03-evidence-plan.md`                     |
| Research brief with citations (R-1 done)                    | `07-research-brief.md`                    |
| Personas P1–P3 (hypotheses, pending R-2 validation)         | `03-evidence-plan.md` §2                  |
| Validation backlog VB-01..06 + governed enterprise backlog  | `05-validation-backlog.md`                |
| Trust/safety constraints + R-1 trust evidence               | `03-evidence-plan.md` §7                  |
| Registers (risks/decisions/assumptions, BQ-01..06 resolved) | `04-risk-decision-assumption-register.md` |
| P00 registers + source hashes                               | `../mvp-p00/01-source-register.md` etc.   |

## 2. P02 focus (per MVP-P02 prompt)

1. **Domain research deep-dive:** India recruitment/ATS mechanics, official
   job-platform partner programs (which have sanctioned APIs vs. scraping —
   determines Job Search & Application agent's legal integration surface), Gmail
   push-watch constraints.
2. **Data discovery:** build the eval set plan for memory quality (6 memory
   types), deadline extraction, ATS matching — from public/official sources only
   ($0 budget).
3. **R-2 interviews** with volunteer cohort (N≈10–20, consent-first, no
   incentives) — validate personas P1–P3 and PS-01..03.
4. **Journey mapping (R-3)** from R-1/R-2.
5. Refresh registers; gate at end (≥88, zero blockers).

## 3. Constraints carried into P02

- $0 budget (DEC-P01-07); volunteer cohort only (DEC-P01-06); user is sole
  approver (BQ-01).
- India/18+/individuals (BQ-03/04); founder-led, closed cohort, no deadline
  (BQ-05).
- Stop/pivot criteria active (DEC-P01-05): stop on trust-driven churn; pivot on
  no memory value or deadline-accuracy miss.
- No compliance claims without legal review; no product-market-fit claims; no
  auto-apply automation.
