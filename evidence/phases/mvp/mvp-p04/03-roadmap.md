# MVP-P04 — 03. Integrated Roadmap (DEL-MVP-P04-01)

> Owner: Program Manager · Baseline: master @ dac2630 (P03 CLOSED 2026-08-14) ·
> Status: APPROVED_BASELINE pending gate · Mission: prove ingest → organize →
> remember → assist, trust/approval UX, memory quality, resume/ATS value, lawful
> opportunity assistance, Gmail deadlines, reminders, export/deletion, bounded
> ops — with runtime evidence.

## 1. Roadmap overview

Repo is NOT greenfield: 25 packages, **2333 backend tests (2333 pass / 2
xfail)**, security suite **172/172**, coverage **94%-of-record** (P00 matrix
2026-08-12), CI/CD, OTel, RBAC, multi-tenancy exist. Phases therefore
**reconcile + harden + close gaps**, not build from scratch. This roadmap is
reconciled to the new P03 baseline: **76 requirement rows** (FR-01..62,
NFR-01..22, FR-h52..h70, NFR-h15..h22, AUTO-01..03), stories **US-01..22**,
**58-row traceability matrix**, MoSCoW **57/16/2/1** = **P0+P1 = 73 MVP
requirements** (release contract from
`../mvp-p03/06-priority-release-baseline.md`). Corrections vs the 2026-08-07
roadmap: the "1626 backend tests" figure is STALE — carried evidence is now 2333
pass / 2 xfail (AGENTS.md re-measurement 2026-08-13), security 172/172, coverage
94%-of-record; each phase below carries entry/exit gates and an evidence owner,
and each ties to owning requirement rows in the P0+P1 release baseline.

## 2. Phase plan (P05 → P21)

| Phase | Name | Type | Focus | Milestone |
| ----- | ------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| P05 | Solution Architecture | DESIGN | Repo-vs-INT-02 architecture reconciliation, ADRs, sequence diagrams; trust/approval UX (FR-50/51), erasure (FR-61/62) mapped to baseline | M1: Architecture baseline |
| P06 | Tech Stack & Engineering Standards | DESIGN | Stack pins, standards, contracts baseline, tooling; pins used to own hardened rows FR-h52..h70/NFR-h15..h22 | M1 |
| P07 | Data Architecture & Database Design | DESIGN | 6-memory model (FR-10..13), RLS + projections (NFR-10/13), Gmail watcher design (FR-40/41) | M2: Data baseline |
| P08 | API Integration & Contract Design | DESIGN | OpenAPI contracts, OAuth RFC 9700 (NFR-16), connectors, approval API (FR-50/51), async jobs (FR-h57) | M2 |
| P09 | UI/UX & Design System | DESIGN | WCAG 2.2 AA (NFR-20/NFR-h21), tokens/components, journey maps (FR-02/05/20) | M3: UX baseline |
| P10 | Frontend Implementation | IMPLEMENT | Next.js pages, typed client, a11y; FR-01..05 onboarding/ingest, FR-50/51 approval UX, FR-60/61 export/erasure UI (FR-h69) | M4: Web alpha |
| P11 | Backend Implementation | IMPLEMENT | FastAPI services, agents, approvals, erasure; FR-30/31/35 tracker + FR-62 deletion receipts, jobs (FR-h57) | M4 |
| P12 | AI/Agent/Memory Pipeline | IMPLEMENT | 8 agents, 6 memories (FR-10..13), LLM orchestration, eval harness; owns AUTO-01..03 tiered automation (AUTO-02/03 flag-gated) | M4 |
| P13 | Security/Privacy/Compliance | HARDEN | DPDP (NFR-17), threat model, injection (NFR-18/FR-h70), OAuth verification (RISK-MVP-P02-12), T2/T3 legal review gate | M5: Hardened alpha |
| P14 | Testing & QA Engineering | QUALITY | Eval suite ≥90% / retrieval ≥80% (FR-03/41/10), isolation suites (NFR-h15), negative/replay/erasure matrix | M5 |
| P15 | Performance/Reliability/Scalability | QUALITY | Load 100 concurrent / 1,000 upper bound (NFR-02/03), SLOs, failure domains (NFR-04/05) | M6: Beta |
| P16 | DevOps/CI-CD | OPS | Pipeline, provenance/SBOM/signed images (NFR-21/NFR-h19), env promotion | M6 |
| P17 | Observability & Operations | OPS | Dashboards, alerts, runbooks, kill switches (AUTO-02/03 operable) | M6 |
| P18 | Documentation & KT | OPS | Runbooks, ops docs, training, API reference | M6 |
| P19 | Release Readiness & Production | RELEASE | Go-live authority, credentials/backups, OAuth verification resolution (RISK-MVP-P02-12), change control | M7: Production |
| P20 | Post-Deployment Validation | RELEASE | Cohort validation (VB-07/08), SLO verification, ship-window review | M7 |
| P21 | Maintenance & Continuous Improvement | OPS | Retro, backlog, kill-switch reviews, coverage re-anchor (94% of record) | M8: Iterate |

## 3. Milestones (M1..M8)

| Milestone | Definition | Exit evidence | Approver |
| ------------------------ | ------------------------ | -------------------------------------------------------------------------- | -------- |
| M1 Architecture baseline | P05+P06 gates GO | ADRs, stack pins, contracts baseline tied to P0+P1 (73) rows | USER |
| M2 Data baseline | P07+P08 gates GO | 6-memory schema/RLS design, Gmail watcher design, OpenAPI + OAuth RFC 9700 | USER |
| M3 UX baseline | P09 gate GO | Tokens, components, journeys, WCAG 2.2 AA plan | USER |
| M4 Web+backend alpha | P10+P11+P12 gates GO | Working app with runtime evidence + tests (2333 baseline retained) | USER |
| M5 Hardened alpha | P13+P14 gates GO | Threat/DPDP evidence, legal review T2/T3 verdict, eval suite results | USER |
| M6 Beta | P15+P16+P17+P18 gates GO | Load/SLO results, SBOM/provenance, runbooks, dashboards | USER |
| M7 Production | P19+P20 gates GO | Live cohort, SLO verified, ship-window committed | USER |
| M8 Iterate | P21 gate GO | Retro actions, backlog, kill-switch review | USER |

## 4. Work packages (WP-01..WP-18)

| WP | Work | Phase(s) | Owner | Depends on |
| ----- | ------------------------------------------ | -------- | ---------------- | ----------------- |
| WP-01 | Architecture reconciliation + ADRs | P05 | Architecture | P03 baseline |
| WP-02 | Stack/standards pins | P06 | Engineering | P05 |
| WP-03 | Data model: 6 memories + RLS + projections | P07 | Data | P05 |
| WP-04 | Gmail connector design (polling MVP) | P07 | Integration | P05, P02 evidence |
| WP-05 | OpenAPI contracts + OAuth (RFC 9700) | P08 | API | P05, P07 |
| WP-06 | Design system + WCAG AA | P09 | UX | P05 |
| WP-07 | Web implementation | P10 | Frontend | P08, P09 |
| WP-08 | Backend implementation | P11 | Backend | P07, P08 |
| WP-09 | Agents/memory/LLM pipeline + evals | P12 | AI | P07, P08 |
| WP-10 | Security/DPDP/compliance hardening | P13 | Security/Privacy | P10–P12 |
| WP-11 | QA + eval certification | P14 | QA | P10–P12 |
| WP-12 | Load/perf/reliability | P15 | Platform | P10–P12 |
| WP-13 | CI/CD + provenance | P16 | DevOps | P10–P12 |
| WP-14 | Observability/ops/runbooks | P17 | SRE | P15 |
| WP-15 | Docs/KT | P18 | Program | P10–P17 |
| WP-16 | Release readiness + go-live | P19 | Release | P13–P18 |
| WP-17 | Post-deploy validation | P20 | Program | P19 |
| WP-18 | Maintenance/improvement | P21 | Program | P20 |

## 5. Delivery decomposition principle (prompt §12)

- **Entry/exit gates per milestone** (M1..M8): each phase defines entry criteria
 (predecessor gate GO + dependencies landed) and exit criteria (evidence rows +
 tests attached). Only the USER approves a gate; unverified work cannot pass.
- **Evidence owners** (WP table): one named owner per work package; owner signs
 the exit evidence, not the work output alone.
- **Exception expiry**: any gate exception/deferral carries an explicit expiry —
 it lapses into BLOCKED or requires re-confirmation at the next milestone.
- **Feature flags / kill switches**: AUTO-02/03 default OFF; kill switches
 operable for Gmail watcher, scraper, and auto-apply paths (P12/P17).
- **Rollback points = gates**: each milestone is a rollback/re-plan boundary; no
 forward commit beyond an unpassed gate.
- **Dependency stages**: WP dependency graph (column above) enforces DESIGN →
 IMPLEMENT → HARDEN/QUALITY → OPS → RELEASE ordering; no skipping.
- **Enterprise work outside MVP critical path**: NG-01..09 features (SSO/SCIM,
 admin, billing, marketplace, multi-region, cross-user memory) stay
 disabled/unimplemented and do not gate any milestone.

## 6. Ship-window scenarios (Q&A-4, 2026-08-15)

Scenario-based planning only — **no date is committed**. The window decision
revisits once a cohort exists (VB-07/08) and external blockers are resolved.

| Scenario | Basis | Schedule posture | Gate dependency | Commitment |
| ------------ | ---------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Best | Cohort signs up early; no external blocker | Sequential effort sequencing, no waits | M1→M8 unbroken | Phases run back-to-back; earliest credible path |
| Expected | Cohort VB-07/08 signs up mid-program | Interviews + eval corpus unlock at M5/M6 | M5/M6 dependent on VB-07/08 activation | Dates slip only by cohort-activation lag; proxy evidence stands until then |
| Conservative | Cohort + OAuth verification (RISK-MVP-P02-12) + Naukri (UNK-P02-05) remain blocked | Slip risk concentrated at M4/M7 | M4 (Gmail/agents runtime) and M7 (go-live) gated on blockers | Go-live postponed until OAuth verification and cohort confirmed |

No date, week, or quarter is stated in this roadmap. Schedule posture is
sequential (Best) → cohort-gated (Expected) → blocker-gated (Conservative); the
window decision (ASP-02, BQ-05) is revisited when cohort existence and external
blocker status are known.

## 7. Phase status tracking

Every phase will be statused `NOT_STARTED` → `IN_PROGRESS` →
`IMPLEMENTED_UNVERIFIED` → `VERIFIED` (or `BLOCKED`/`NOT_APPLICABLE`).
Unverified work cannot pass a gate. This roadmap is a plan — it becomes evidence
only when phase gates attach runtime results, tests, and commits. A plan is not
evidence it ran.

## 8. Evidence

| ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------- | --------- | ------------------------------ | ---------- | --------------- |
| EVD-MVP-P04-011 | Roadmap reconciled to P03 baseline: 76 req rows, US-01..22, 58-row matrix, MoSCoW 57/16/2/1 = 73 MVP | MVP-P04-R01 | SOURCE_DERIVED | This file | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-012 | Carried evidence refreshed: 2333 pass / 2 xfail, security 172/172, coverage 94%-of-record (P00 2026-08-12); stale "1626" corrected | MVP-P04-R02 | SOURCE_DERIVED | This file | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-013 | Phase plan P05..P21, milestones M1..M8, WPs WP-01..18 with entry/exit gates tied to P0+P1 (73) baseline | MVP-P04-R01 | NEW_DESIGN | This file | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-014 | Ship-window scenarios (Best/Expected/Conservative) with no committed date; revisit on cohort existence | MVP-P04-R02 | NEW_DESIGN | This file | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
| EVD-MVP-P04-015 | Phase status protocol defined (NOT_STARTED → VERIFIED; unverified cannot pass a gate) | MVP-P04-R01 | NEW_DESIGN | This file | APPROVED_BASELINE pending gate | 2026-08-15 | Program Manager |
