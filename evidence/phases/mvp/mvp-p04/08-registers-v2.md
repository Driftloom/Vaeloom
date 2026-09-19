# MVP-P04 — 08. Registers (Risks / Decisions / Assumptions / BQ / UNK) — V2

> **Version:** 2.0 (supersedes `08-registers.md` dated 2026-08-15) **Baseline:**
> repo `master` @ `dac2630` (P03 CLOSED — ACCEPTED BY USER 2026-08-14,
> DEC-P03-01..05) · **Phase type:** DOCS-ONLY PLANNING. **Supersedes:** prior
> P04 run 2026-08-07 (`08-registers-2026-08-07.md`).

**V2 improvements:** Added traceability links, evidence IDs, phase-specific
entries, and expanded register entries with status tracking.

## 1. Risks

| ID | Risk | Severity | Impact | Mitigation | Owner | Status | Due Phase | Evidence |
| --------------- | ------------------------------------------------------------------------------- | -------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------ | ---------- | --------------- |
| RISK-MVP-P04-01 | Docs mistaken for runtime completion | Critical | False readiness | Docs carry no runtime claims (`NOT_EXECUTED` kept honest); runtime evidence + status labels mandatory at every implementation gate (P05+) | Phase owner | OPEN | All phases | EVD-MVP-P04-011 |
| RISK-MVP-P04-02 | Scope/permission/data/compatibility assumed | High | Leak/loss/rework | BQ records; block or reversible validated decision; change control; no silent scope growth (P03 §7) | Product/Architecture/Security | OPEN | All phases | EVD-MVP-P04-012 |
| RISK-MVP-P04-03 | External API/model/standard changes | High | Regression | Pin versions (source register EXT); tests; owner per integration; kill switch AUTO-01..03 | Integration/AI | OPEN | P08+ | EVD-MVP-P04-013 |
| RISK-MVP-P04-04 | Evidence incomplete | High | Untrustworthy gate | Immutable reports + baseline; evidence plan; reconciliations visible with sources (RISK-MVP-P02-10/11 CLOSED stay closed) | QA/Release | OPEN | All phases | EVD-MVP-P04-014 |
| RISK-MVP-P04-05 | MVP scope expansion | High | Delay/complexity | Strict scope gate; MoSCoW + release baseline P0+P1 (73); T2/T3 proposals-only (DEC-P03-01) | Product | OPEN | All phases | EVD-MVP-P04-015 |
| RISK-MVP-P03-01 | Docs mistaken for runtime completion (carried) | Critical | False readiness | Carried from `../mvp-p03/08-registers.md`; same mitigation | Phase owner | OPEN | All phases | EVD-MVP-P04-011 |
| RISK-MVP-P03-02 | Scope/permission/data assumed (carried) | High | Leak/loss/rework | Carried; change control; BQ records | Product/Security | OPEN | All phases | EVD-MVP-P04-012 |
| RISK-MVP-P03-03 | External API/model/standard drift (carried) | High | Regression | Carried; pins, tests, kill switches | Integration/AI | OPEN | P08+ | EVD-MVP-P04-013 |
| RISK-MVP-P03-04 | Evidence incomplete (carried) | High | Untrustworthy gate | Carried; evidence plan + immutable reports | QA | OPEN | All phases | EVD-MVP-P04-014 |
| RISK-MVP-P03-05 | MVP scope expansion (carried) | High | Delay/complexity | Carried; MoSCoW + change control | Product | OPEN | All phases | EVD-MVP-P04-015 |
| RISK-MVP-P03-06 | T3 auto-apply trust/account risk (carried) | High | Trust/legal | Carried; review-first default; AUTO-03; legal review P13 | Product/Security | OPEN | P13 | EVD-MVP-P04-041 |
| RISK-MVP-P03-07 | Cohort interviews still pending (carried) | Medium | Validation gap | Carried; proxy evidence; design-partner protocol (DEC-P03-05); VB-07 blocked on USER | UX | OPEN | P20 | EVD-MVP-P04-042 |
| RISK-MVP-P02-12 | Google OAuth verification cost/limit at $0 budget (carried) | High | Launch blocker | Carried; mock/polling + limited scopes; real verification deferred P19 (UNK-P02-03) | Product/Platform | OPEN | P19 | EVD-MVP-P04-043 |
| RISK-MVP-P02-13 | Naukri partner program gate — no public apply API (carried) | High | Job surface | Carried; MVP tracks via Gmail + manual entry (UNK-P02-05) | Product/Platform | OPEN | P19 | EVD-MVP-P04-044 |
| RISK-MVP-P02-06 | Cohort unavailable → interviews stall (carried) | Medium | Validation gap | Carried; founder-network volunteers; design-partner protocol | User Researcher | OPEN | P20 | EVD-MVP-P04-045 |
| RISK-MVP-P02-07 | Platform ToS action from Tier-2 read scraping (carried) | High | Platform risk | Carried; AUTO-02 opt-in; pacing; legal review P13; kill switch | Platform | OPEN | P13 | EVD-MVP-P04-041 |
| RISK-MVP-P02-08 | Legal exposure from scraping — Proxycurl precedent settled (carried) | High | Legal exposure | Carried; read-only; legal-review gate P13; per-source pause | Security Architect | OPEN | P13 | EVD-MVP-P04-041 |
| RISK-MVP-P02-09 | Auto-apply quality/trust damage or lockouts (carried) | Medium | Trust/retention | Carried; review-first; pacing; audit; AUTO-03 | Product/Security | OPEN | P13 | EVD-MVP-P04-041 |
| RISK-MVP-P02-15 | DPDP Rules 2025 in-force — professional review required for any claim (carried) | High | Compliance risk | Carried; design-to-both (ASP-P03-02); P13 legal gate; no self-claims (DEC-P02-04) | Legal/Compliance | OPEN | P13 | EVD-MVP-P04-041 |
| RISK-MVP-P02-10 | Coverage 94% vs 97% — of record 94% (carried) | Medium | Evidence integrity | CLOSED/VERIFIED at P03 (DEC-P03-04) — not reopened; re-anchor at P13/P14 | QA/Release | CLOSED | — | EVD-MVP-P04-014 |
| RISK-MVP-P02-11 | EVD row count stale (22 vs 25) (carried) | Low | Cosmetic | CLOSED at P03 (DEC-P03-04) — not reopened | QA/Release | CLOSED | — | EVD-MVP-P04-014 |

## 2. Decisions

| ID | Decision | Value | Authority | Date | Expiry | Status |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | --------------------------- | ---------- | ------------------ | ------ |
| DEC-P04-01 | Baseline pinned `master` @ `dac2630` (P03 CLOSED 2026-08-14) for all P04 evidence (USER Q&A-3) | Baseline pin | User | 2026-08-15 | P05 gate review | ACTIVE |
| DEC-P04-02 | Ship window = scenario-based (Best/Expected/Conservative), no fabricated date; commit when cohort exists (USER Q&A-4; resolves ASP-02/BQ-05 for P04) | Planning posture | User | 2026-08-15 | When cohort exists | ACTIVE |
| DEC-P04-03 | Prior P04 evidence (2026-08-07) preserved via date renames; refreshed at new baseline (USER Q&A-1/5) | History retention | User | 2026-08-15 | Never | ACTIVE |
| DEC-P04-04 | Repo truth (Next.js/FastAPI, 25 pkgs) outranks prompt prose (NestJS) — CF-P04-01 carried | Evidence | Phase owner (repo-verified) | 2026-08-15 | Never | ACTIVE |
| DEC-P04-05 | T2/T3 = PROPOSALS ONLY (flag-gated AUTO-02/03, legal review P13 before default-ON); T1 = MVP core (carried DEC-P02-05/DEC-P03-01) | Scope baseline | User (sole approver) | 2026-08-15 | P13 legal gate | ACTIVE |
| DEC-P04-06 | P0+P1 (73 requirements, MoSCoW 57/16/2/1) = MVP release baseline contract; P2/P3 gated (carried `../mvp-p03/06-priority-release-baseline.md`) | Release contract | Product | 2026-08-15 | Change control | ACTIVE |
| DEC-P04-07 | Gates = rollback points; feature flags/kill switches AUTO-01 (ON)/02 (OFF)/03 (OFF); connector outage isolation (NFR-15/h15); no enterprise work on MVP critical path | Governance | Phase owner | 2026-08-15 | All phases | ACTIVE |
| DEC-P04-08 | Milestones M1..M8 (M1 arch, M2 data, M3 UX, M4 alpha, M5 hardened, M6 beta, M7 production, M8 iterate); USER = approver per milestone (roadmap contract `03-roadmap.md`) | Roadmap contract | User | 2026-08-15 | M8 completion | ACTIVE |
| DEC-P03-01 | T2/T3 proposals-only (carried) | Scope | User | 2026-08-14 | P13 legal gate | ACTIVE |
| DEC-P03-02 | Repo truth outranks prompt prose (carried) | Evidence | Phase owner | 2026-08-14 | Never | ACTIVE |
| DEC-P03-03 | Requirements baseline = APPROVED_BASELINE pending gate; binds P04+ via change control (carried) | Baseline | Phase owner | 2026-08-14 | Change control | ACTIVE |
| DEC-P03-04 | Coverage 94%-of-record + EVD reconciliations CLOSED (carried) | Evidence | QA/Release | 2026-08-14 | P13/P14 re-anchor | ACTIVE |
| DEC-P03-05 | Design-partner protocol until cohort signs up (carried) | Plan | Phase owner | 2026-08-14 | Cohort signup | ACTIVE |
| DEC-P02-01 | Gmail polling (MVP); push = P15+ upgrade path (carried) | Evidence | Phase owner | 2026-08-07 | P15+ review | ACTIVE |
| DEC-P02-04 | Regulatory professional-review gate (P13); no compliance self-claims (carried) | Plan | Compliance Reviewer | 2026-08-13 | P13 gate | ACTIVE |
| DEC-P02-06 | BQ-P02-01..04 confirmed by USER (carried) | Value/scope/metrics basis | User | 2026-08-13 | Never | ACTIVE |
| DEC-P01-01 | 8-agent/6-memory MVP scope lock (carried) | — | User | 2026-08-07 | Never | ACTIVE |
| DEC-P01-03 | Draft-only Gmail (no auto-send) (carried) | — | User | 2026-08-07 | Never | ACTIVE |
| DEC-P01-04 | Approved-integration-only (no auto-apply) (carried) | — | User | 2026-08-07 | Never | ACTIVE |
| DEC-P01-07 | Cohort = India 18+ volunteers, N≈10–20, zero-budget (carried) | — | User | 2026-08-07 | Never | ACTIVE |
| DEC-P01-08 | $0 budget: OSS + free tiers + volunteer time (carried) | — | User | 2026-08-07 | Never | ACTIVE |

## 3. Assumptions

| ID | Assumption | Owner | Reversible? | Approval | Status |
| ---------- | ----------------------------------------------------------------------------------------- | ---------- | -------------------- | ---------------- | ------ |
| ASP-P04-01 | Ship window scenario-based until cohort exists; no date committed (DEC-P04-02) | Program | Yes | P04 (USER Q&A-4) | ACTIVE |
| ASP-P04-02 | $0 budget + free tiers + volunteer cohort N≈10–20 hold for MVP (DEC-P01-07/08) | FinOps | Yes | P01/P04 | ACTIVE |
| ASP-P04-03 | Milestone schedule is effort-sequenced, not date-committed (DEC-P04-02) | Program | Yes | P04 | ACTIVE |
| ASP-P04-04 | Free-tier APIs cover cohort scale (<100 users) — ASSUMPTION pending P15 (ASP-07) | Platform | Yes | P02/P04 | ACTIVE |
| ASP-P04-05 | AI/provider spend = $0 (mock mode) until FinOps + USER approval of any paid provider | FinOps | Yes | P01/P04 | ACTIVE |
| ASP-P02-01 | Google OAuth verification cost absorbed at $0 via mock/polling + limited scopes (carried) | Product | Yes | P02/P04 | ACTIVE |
| ASP-P03-02 | DPDP full enforcement 13-May-2027 — design-to-both (carried) | Compliance | No | P02/P03 | ACTIVE |
| ASP-P03-03 | Requirements baseline (APPROVED_BASELINE) binds P04+ pending gate (carried) | Product | Yes — change control | P03 | ACTIVE |

## 4. Blocking Questions (prompt §8)

| ID | Question | Answer (P04) | Evidence Basis | Status | Resolution Date |
| --------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------- | --------------- |
| BQ-01 | Approver + backup | USER (sole gate authority); backup = none (single founder, documented in 07) | P01/P03 registers; EXECUTION-STATUS | RESOLVED (carried P00–P03) | 2026-08-07 |
| BQ-02 | Repo/env/evidence baseline | Baseline `dac2630` (master, P03 CLOSED 2026-08-14); local dev; production deferred P19 | `02-predecessor-audit.md`; git status | RESOLVED 2026-08-15 (DEC-P04-01) | 2026-08-15 |
| BQ-03 | Entities/ages/regions/use cases | India, 18+, individuals, single-user workspace-scoped, P1+P2 personas | P01/P02 re-runs (DEC-P01-02/07/08, BQ-P02-02) | RESOLVED (carried) | 2026-08-13 |
| BQ-04 | Launch region + min age | India, 18+; child controls N/A (excluded) | P01 re-run | RESOLVED (carried) | 2026-08-07 |
| BQ-05 | Team/budget/cohort/window | Founder + AI agents; $0 (DEC-P01-08); volunteer cohort N≈10–20; ship window = scenario-based (DEC-P04-02) | P01 re-run + USER Q&A-4 2026-08-15 | RESOLVED 2026-08-15 (DEC-P04-02) | 2026-08-15 |
| BQ-06 | Stop/pivot criteria | DEC-P01-05 carried (stop on trust-driven churn; pivot on no memory value/deadline-accuracy miss) | P01 re-run | RESOLVED (carried) | 2026-08-07 |
| BQ-P02-01 | Value proposition | Memory-first personal job-search assistant (carried) | DEC-P02-06 | CONFIRMED (USER 2026-08-13) | 2026-08-13 |
| BQ-P02-02 | Primary persona | P1 "The Fresher" (P2 secondary) (carried) | DEC-P02-06 | CONFIRMED (USER 2026-08-13) | 2026-08-13 |
| BQ-P02-03 | Memory quality thresholds | ≥80% retrieval hit-rate, ≥90% deadline extraction, zero data-loss, 100% deletion (carried) | DEC-P02-06 | CONFIRMED (USER 2026-08-13) | 2026-08-13 |
| BQ-P02-04 | Maximum user load | 100 concurrent target / 1,000 upper bound (carried) | DEC-P02-06 | CONFIRMED (USER 2026-08-13) | 2026-08-13 |

## 5. Open Unknowns

| ID | Unknown | Category | Blocks? | Due | Owner | Verification |
| ---------- | ------------------------------------ | ----------- | ------------------- | ------- | ---------------- | -------------------- |
| UNK-01 | INT-01 template original | Input | No (substitute) | — | Program | Document location |
| UNK-02 | Production credentials | Access | GO (P19) | P19 | Access/Founder | Credential checklist |
| UNK-03 | Cohort size/timeline | Stakeholder | Interviews (VB-07) | P04→P20 | USER | Cohort tracking |
| UNK-P02-01 | DPDP Rules 2025 force status final | Legal | No (design-to-both) | P13 | Legal/Compliance | Legal review |
| UNK-P02-02 | Gmail quota behavior at cohort scale | Technical | No | P07 | Technical | Gmail API test |
| UNK-P02-03 | Google OAuth verification timeline | Access | No (mock P02–P18) | P19 | Product/Platform | OAuth console |
| UNK-P02-04 | Naukri partner program cost/access | Access | No (Gmail + manual) | P19 | Product/Platform | Partner inquiry |
| UNK-P02-05 | Groq/free-tier LLM quota | Technical | No (mock mode) | P12 | AI | Quota check |

## 6. Evidence

| ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
| --------------- | --------------------------------------------- | ----------- | -------------- | ------------ | ------------------------------ | ---------- | --------------- |
| EVD-MVP-P04-061 | Risk register with 20 OPEN + 2 CLOSED entries | MVP-P04-R03 | SOURCE_DERIVED | this file §1 | APPROVED_BASELINE pending gate | 2026-08-15 | Risk Owner |
| EVD-MVP-P04-062 | Decision register with 21 ACTIVE entries | MVP-P04-R01 | SOURCE_DERIVED | this file §2 | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-063 | Assumption register with 8 ACTIVE entries | MVP-P04-R02 | SOURCE_DERIVED | this file §3 | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-064 | Blocking Questions with 10 RESOLVED entries | MVP-P04-R01 | SOURCE_DERIVED | this file §4 | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-065 | Open Unknowns with 8 entries (0 blocking MVP) | MVP-P04-R02 | SOURCE_DERIVED | this file §5 | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
