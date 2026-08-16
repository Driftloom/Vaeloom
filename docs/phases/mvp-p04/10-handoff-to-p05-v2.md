# MVP-P04 — 10. Handoff to MVP-P05 (Solution Architecture) — V2

> **Version:** 2.0 (supersedes `10-handoff-to-p05.md` dated 2026-08-15)
> **Phase:** MVP-P04 → MVP-P05 · **Date:** 2026-08-15 (V2 re-run) ·
> **Baseline:** repo `master` @ `dac2630` (pushed 0/0) · **Gate state:**
> APPROVED — PROCEED (97.0/100, `09-gate-v2.md`); **USER verdict pending** (sole
> gate authority, BQ-01). **P05 starts ONLY on user command.** Prior V1 run
> (2026-08-15, CONDITIONAL GO 88.5/100) superseded; history preserved
> (`*-2026-08-15.md`).

## 1. What P05 receives (validated — do not assume, re-verify)

| Item                                                                                                                                                                                  | Where                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Source register + standards re-verified 2026-08-15 + conflicts CF-P04-01..04                                                                                                          | `01-source-register.md`                                                      |
| P03 forensic audit + entry decision (CONDITIONAL GO — NON-DEPENDENT WORK ONLY)                                                                                                        | `02-predecessor-audit.md` (PA-MVP-P04-011..011; 10 PASS / 1 PARTIAL carried) |
| Integrated roadmap P05→P21, milestones M1..M8, WPs WP-01..18, ship-window scenarios (DEC-P04-02), acceptance criteria per WP, evidence owners, test commands, rollback procedures     | `03-roadmap-v2.md` (DEL-MVP-P04-01)                                          |
| Dependency graph + critical path + kill switches/rollback points + blocking-dependency honesty + slack analysis + risk-adjusted timelines + operable kill-switch procedures           | `04-dependency-graph-v2.md` (DEL-MVP-P04-02)                                 |
| RACI + approval matrix (USER sole approver; reviewer veto; FR-50/51 approval contract) + escalation matrix + approval workflows per gate + decision log template                      | `05-raci-approvals-v2.md` (DEL-MVP-P04-03)                                   |
| Risk/governance model: risk burndown, decision-expiry + assumption/UNK calendars, exception governance + risk burndown chart data + kill-switch procedures + risk metrics dashboard   | `06-risk-governance-v2.md` (DEL-MVP-P04-04)                                  |
| Resource/cost scenarios: $0, cohort N≈10–20, load 100/1,000, FinOps guardrails, AI/provider spend + per-phase resource allocation + verification plans + cost optimization strategies | `07-resource-cost-scenarios-v2.md` (DEL-MVP-P04-05)                          |
| Registers: 21 risks OPEN (+2 CLOSED carried), 25 decisions (DEC-P04-01..08), 8 assumptions, 14 BQ, 12 UNK + traceability links + evidence IDs                                         | `08-registers-v2.md`                                                         |
| Gate (97.0/100) + this handoff + §30 completion response                                                                                                                              | `09-gate-v2.md`, `10-handoff-to-p05-v2.md`, `11-completion-response-v2.md`   |
| P00–P03 chain (requirements baseline 76 rows, stories, matrix, release baseline P0+P1 = 73)                                                                                           | `../mvp-p00/`, `../mvp-p01/`, `../mvp-p02/`, `../mvp-p03/`                   |

## 2. P05 focus (per MVP-P05 prompt — Solution Architecture)

1. Reconcile repo reality (Next.js `apps/web` + FastAPI `apps/api`, 25 packages,
   CI/CD, OTel, RBAC, multi-tenancy) against INT-02 architecture intent; produce
   ADRs (CF-P04-01/03: no NestJS, no `core-api`/`ai-service` split in repo).
2. Map the 76-row requirements baseline (FR/NFR/hardened) to concrete
   components/services; carry FR-50/51 approval contract, FR-61/62 erasure,
   NFR-15/h15 isolation, NFR-16 OAuth RFC 9700.
3. Define trust/approval UX dataflow, 6-memory model ownership, projections
   (relational = system of record), connector boundaries (Gmail polling
   DEC-P02-01), kill switches AUTO-01..03.
4. Entry/exit gates + evidence owners per M1 (P05+P06) per `03-roadmap-v2.md`.

## 3. Constraints carried into P05

- $0 budget (DEC-P01-08); volunteer cohort N≈10–20 (DEC-P01-07); India 18+; P1
  "The Fresher" (P2 secondary); single-user, workspace-scoped.
- P0+P1 release baseline = 73 requirements (MoSCoW 57/16/2/1); T2/T3 = PROPOSALS
  ONLY — flag-gated AUTO-02/03, legal review (P13) + USER re-confirmation before
  any default-ON; no amendment to DEC-P01-02/04.
- Gmail draft-only (DEC-P01-03); approved-integration-only submissions
  (DEC-P01-04); no unsupported scraping, anti-bot circumvention, credential
  replay (S-02/S-03).
- No compliance/security/a11y/scale claims without evidence + professional legal
  review (DEC-P02-04, P13); no product-market-fit claim.
- Ship window scenario-based (DEC-P04-02) — no committed date until cohort.
- Coverage of record = 94% (RISK-MVP-P02-10 CLOSED; re-anchor P13/P14).
- Enterprise features (SSO/SCIM, admin, billing, marketplace, multi-region,
  cross-user memory) stay disabled/unimplemented (NG-01..09); keep off MVP
  critical path (prompt §12.6).
- No code/config/runtime implementation from planning phase (owned P10+ design
  P05–P09); no dependent work, migration, release or production changes without
  a user command.

## 4. Blocked-on-USER items carried into P05

| Item                      | Needed from USER                                  | Impact if unresolved                          |
| ------------------------- | ------------------------------------------------- | --------------------------------------------- |
| VB-07 (cohort signup)     | Founder-network cohort access                     | Interviews UNKNOWN; proxy evidence stands     |
| VB-08 (synthetic resumes) | Consent for synthetic corpus generation           | Eval corpus NOT_EXECUTED; public sets suffice |
| Ship-window date          | Cohort existence + external blockers (DEC-P04-02) | Window stays scenario-based                   |
| Gate verdict (this phase) | Approve / amend 97.0/100                          | P05 blocked until verdict recorded            |

## 5. Prohibited work (P05 may NOT)

- No requirements changes outside approved change control
  (`../mvp-p03/07-change-control.md`).
- No T2/T3 runtime activation without USER re-confirmation + legal review (P13).
- No compliance/security/accessibility/scale claims without evidence +
  professional review.
- No scope expansion into enterprise features; no fabricated user research.
- No production/dependent implementation without authority, backup, rollback,
  monitoring and named approver; code implementation owned P10+.

## 6. Evidence

| ID              | Claim                                                       | Requirement | Type           | Location         | Result                         | Date       | Verified by     |
| --------------- | ----------------------------------------------------------- | ----------- | -------------- | ---------------- | ------------------------------ | ---------- | --------------- |
| EVD-MVP-P04-071 | Handoff prepared with V2 deliverables and validated content | MVP-P04-R07 | SOURCE_DERIVED | this file        | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-072 | P05 receives all required inputs with evidence paths        | MVP-P04-R07 | SOURCE_DERIVED | this file §1     | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-073 | Constraints and prohibited work documented for P05          | MVP-P04-R03 | SOURCE_DERIVED | this file §3, §5 | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
