# MVP-P02 — 21. Handoff to MVP-P03 (Requirements Engineering)

> **Phase:** MVP-P02 → MVP-P03 **Date:** 2026-08-13 (re-run) **Baseline:** repo
> `master` @ `4aa6c71` (pushed 0/0) **Gate state:** 🟡 **RECOMMENDED
> `PHASE CONDITIONALLY APPROVED — RESTRICTIONS APPLY`** (88.20/100,
> `19-gate-2026-08-13.md`); **USER verdict pending** (sole gate authority,
> BQ-01). **P03 starts ONLY on user command** (Q&A-4). Prior run (2026-08-07,
> CONDITIONAL GO 88/100) superseded; history preserved
> (`01-..09-*-2026-08-07.md`).

## 1. What P03 receives (validated — do not assume, re-verify)

| Item | Where |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Predecessor audit + entry decision (CONDITIONAL GO — NON-DEPENDENT WORK ONLY) | `10-predecessor-audit.md` |
| Research plan: RQ-02-01..10, WS plan, EVD-MVP-P02-001..016, design-partner protocol, VB carry, stopping criteria | `11-evidence-plan.md` |
| Domain/competitor analysis (DEL-02): India ATS mechanics, journey map, 13-product landscape | `12-domain-competitor-analysis.md` |
| Platform/standards (DEL-02): Gmail push/poll/quota/draft re-verified 2026-08-13, job-platform lawful surface, MCP rules, dependency radar | `13-platform-research.md` |
| Data feasibility (DEL-03): 22-memory inventory, retention/deletion, eval-set plan (9 datasets, no PII) | `14-data-feasibility.md` |
| Regulatory analysis (DEL-04): DPDP/EU AI Act/student privacy; no compliance self-claims | `15-regulatory-analysis.md` |
| Build-buy (DEL-05): $0 matrix, exit/portability | `16-build-buy.md` |
| Decision implications (DEL-05): BQ-P02-01..04 proposals, DEC-P02-05 tiers, decision→implication matrix | `17-decision-implications.md` |
| Registers: 15 risks, 11 decisions, 11 assumptions, 10 BQ, 10 UNK | `18-registers.md` |
| Gate (88.20/100) + completion (A–P) + this handoff | `19-gate-2026-08-13.md`, `20-completion-response.md`, `21-handoff-to-p03.md` |
| Prior-run history (untouched) | `01-..09-*-2026-08-07.md` |

## 2. P03 focus (per MVP-P03 prompt — Requirements Engineering)

1. Convert **USER-confirmed BQ-P02-01..04** answers into requirement IDs with
 acceptance criteria (value proposition, primary persona P1 "The Fresher",
 memory quality thresholds ≥80% hit-rate / ≥90% deadline extraction / 100%
 deletion completeness, design load 100–1,000 concurrent).
2. Convert **DEC-P02-05 verdicts** into requirements: T1 (MVP core, ON) is the
 baseline; T2/T3 (if re-confirmed) become flag-gated opt-in capabilities with
 legal-review gates (P13), kill switches AUTO-02/03.
3. Reconcile the **coverage delta** (94% of record in P00 matrix vs 97% in
 AGENTS.md — RISK-MVP-P02-10) and fix stale EVD counts (RISK-MVP-P02-11).
4. Translate the decision→implication matrix (17 §3) into architecture/contract
 requirements (approval middleware, Gmail polling design, eval harness).
5. Activate the **design-partner protocol** (11 §5) when USER supplies cohort
 access (VB-07/08); until then keep interviews UNKNOWN — no fabrication.
6. Refresh registers; gate ≥88 with zero mandatory blockers (or USER acceptance
 per BQ-01).

## 3. Constraints carried into P03

- $0 budget (DEC-P01-08); volunteer invite-only cohort N≈10–20 via founder
 network, no incentives (DEC-P01-07); user is sole approver (BQ-01).
- India/18+/individual job seekers, single-user, workspace-scoped (BQ-03/04);
 ship window TBD → P04 (BQ-05, ASP-02).
- Gmail draft-only (DEC-P01-03); approved-integration-only submissions
 (DEC-P01-04, amended by DEC-P02-05 T2 if re-confirmed); no unsupported
 scraping, anti-bot circumvention, credential replay (S-02/S-03).
- Stop/pivot criteria active (DEC-P01-05/BQ-06): stop on trust-driven churn;
 pivot on no memory value or deadline-accuracy miss.
- No compliance/security/a11y/scale self-claims; professional legal review
 required before any claim (DEC-P02-04, P13 gate).
- No product-market-fit claim; research outputs are plans/hypotheses, not
 runtime proof.
- Enterprise features (SSO/SCIM, admin, billing, marketplace, multi-region,
 cross-user memory) stay disabled/unimplemented (NG-01..09).

## 4. Blocked-on-USER items — resolved at gate; remaining carry into P03

**Resolved by USER at the P02 gate (2026-08-13):**

| Item | Verdict | Impact |
| ---------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| BQ-P02-01..04 | ✅ CONFIRMED (DEC-P02-06) — value prop, persona P1, thresholds, load | P03 scope/metrics basis approved |
| DEC-P02-05 T2/T3 | ✅ Kept as PROPOSALS ONLY — T1 = MVP core; no amendment to DEC-P01-02/04 | P03 requirements = T1 baseline only |

**Remaining blocked-on-USER (carry into P03):**

| Item | Needed from USER | Impact if unresolved |
| ------------------------- | --------------------------------------- | --------------------------------------------- |
| VB-07 (cohort signup) | Founder-network cohort access | Interviews UNKNOWN; proxy evidence stands |
| VB-08 (synthetic resumes) | Consent for synthetic corpus generation | Eval corpus NOT_EXECUTED; public sets suffice |
| ASP-02 (ship window) | Window decision (deferred to P04) | Release planning blocked |

## 5. Prohibited work (P03 may NOT)

- No code/config/runtime implementation (owned P05+); no dependent
 implementation, migration, release, or production changes without a user
 command (restriction 1 per P00 `13-readiness-and-done.md`; Q&A-4).
- No compliance/security/accessibility/scale claims without evidence +
 professional review.
- No T2/T3 runtime activation without USER re-confirmation + legal review (P13).
- No scope expansion into enterprise features; no fabricated user research.

## 6. Entry criteria for P03 (to validate, not assume)

1. P02 gate accepted by USER (verdict + restrictions acknowledged) —
 `20-completion-response.md` §N updated with the USER verdict.
2. BQ-P02-01..04 statused (confirmed/rejected) in `18-registers.md`.
3. Baseline pinned; commits since `4aa6c71` reviewed for regression.
4. Coverage delta reconciled; stale counts fixed.
5. Owners/reviewers/approver named; evidence plan for P03 drafted.
