# MVP-P01 - 03. Evidence Plan (WS-01.1 / WS-01.2)

> **MVP-P01 re-run 2026-08-13.** Baseline: repo `master` @ `1def16d` (pushed
> 2026-08-13; P00 CLOSED - conditionally approved by USER, restrictions apply).
> Phase type: DISCOVERY - docs/research/planning ONLY, no code, no
> production/dependent authorization. Supersedes the prior P01 run gated
> 2026-08-07 (CONDITIONAL GO 88/100, commit `7128e4d`) - historical record at
> `06-gate-2026-08-07.md` and `07-research-brief-2026-08-07.md`. This file
> refreshes the evidence plan at the new baseline and re-gates. The evidence
> plan is P01's entry criterion (P00 handoff section 4). It defines what P01
> must prove, the cohort, and the research plan. All claims require sources;
> nothing here is asserted as fact without a citation or an approved stakeholder
> decision.

## 1. Evidence strategy (prompt section 18)

1. **Triangulate user evidence** - a claim is validated only when at least two
   independent channels agree (e.g., cohort usage telemetry + design-partner
   interview + deletion/approval exercise records). A single-channel anecdote is
   a note, not evidence.
2. **Test counterexamples** - every hypothesis carries a falsifier, and the
   trust failure scenarios (wrong memory, overreach, missed deadlines, confusing
   approvals, difficult deletion) are exercised, not only happy-path value.
3. **Verify metrics are measurable** - every metric has a formula, an owner and
   a data source before it may enter a gate; metrics without a measurement path
   stay `NOT_EXECUTED` or `UNKNOWN`.

Evidence rows follow prompt section 23: claim -> requirement (R01-R08) -> type
-> location -> result -> date -> verified by. Status labels used here:
`NOT_EXECUTED` (planned, not run), `SOURCE_DERIVED` (derived from the approved
spec corpus + research brief + BQ decisions, no fabrication), and
`REQUIRES_STAKEHOLDER_DECISION` (live-user work or owner decision absent - held
honestly, never invented). A plan is not evidence it ran.

## 2. Evidence register (prompt section 23)

| Evidence ID     | Claim                                                                                                                                        | Requirement | Type    | Location                                                                                          | Result                        | Date       | Verified by                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------- | ------------------------------------------------------------------------------------------------- | ----------------------------- | ---------- | ------------------------------------------- |
| EVD-MVP-P01-001 | P00 predecessor forensic audit refreshed at baseline `1def16d`; entry decision CONDITIONAL GO - NON-DEPENDENT WORK ONLY                      | R02, R07    | report  | `docs/phases/mvp-p01/02-predecessor-audit.md`                                                     | SOURCE_DERIVED                | 2026-08-13 | PM / Agent A                                |
| EVD-MVP-P01-002 | Problem statement DEL-MVP-P01-01: falsifiable statements, current journeys, JTBD, trust boundaries, unacceptable outcomes                    | R01, R02    | file    | `docs/phases/mvp-p01/09-problem-statement.md`                                                     | SOURCE_DERIVED                | 2026-08-13 | PM                                          |
| EVD-MVP-P01-003 | Persona/JTBD evidence DEL-MVP-P01-02: three spec-derived personas segmented by age/region/institution/data sensitivity, JTBD + agent mapping | R01, R02    | file    | `docs/phases/mvp-p01/10-persona-jtbd-evidence.md`                                                 | SOURCE_DERIVED                | 2026-08-13 | UX Researcher                               |
| EVD-MVP-P01-004 | Persona claims validated live with real users (interviews, closed invite-only cohort)                                                        | R02, R04    | plan    | cohort + design-partner protocol, this file section 4                                             | REQUIRES_STAKEHOLDER_DECISION | 2026-08-13 | UX Researcher                               |
| EVD-MVP-P01-005 | Value/risk hypotheses DEL-MVP-P01-03: falsifiable, with tests and validation experiment                                                      | R01, R04    | file    | `docs/phases/mvp-p01/11-value-risk-hypotheses.md`                                                 | SOURCE_DERIVED                | 2026-08-13 | AI Product Lead                             |
| EVD-MVP-P01-006 | Success metrics DEL-MVP-P01-04: outcome/trust/quality/safety/ops/business metrics with formulas + owners                                     | R01, R05    | file    | `docs/phases/mvp-p01/12-success-metrics.md`                                                       | SOURCE_DERIVED                | 2026-08-13 | PM                                          |
| EVD-MVP-P01-007 | Non-goals + research backlog DEL-MVP-P01-05 with adoption triggers                                                                           | R01         | file    | `docs/phases/mvp-p01/13-non-goals-research-backlog.md`                                            | SOURCE_DERIVED                | 2026-08-13 | PM                                          |
| EVD-MVP-P01-008 | Validation backlog: 8 items, each with experiment, adoption trigger, owner, sunset/rejection condition                                       | R01, R04    | file    | `docs/phases/mvp-p01/05-validation-backlog.md`                                                    | SOURCE_DERIVED                | 2026-08-13 | PM                                          |
| EVD-MVP-P01-009 | Trust failure scenarios enumerated: wrong memory, overreach, missed deadlines, confusing approvals, difficult deletion                       | R01, R03    | file    | `docs/phases/mvp-p01/05-validation-backlog.md` section 2 + `09-problem-statement.md`              | SOURCE_DERIVED                | 2026-08-13 | Privacy / UX                                |
| EVD-MVP-P01-010 | Segmentation by age band, region, institution relationship, data sensitivity (no single generic student persona)                             | R01         | file    | `docs/phases/mvp-p01/10-persona-jtbd-evidence.md` section 2                                       | SOURCE_DERIVED                | 2026-08-13 | UX Researcher                               |
| EVD-MVP-P01-011 | Standards overlay registered: 11 standards with version/applicability/owner/control mapping                                                  | R03         | file    | `docs/phases/mvp-p01/01-source-register.md` section 3                                             | SOURCE_DERIVED                | 2026-08-13 | Security                                    |
| EVD-MVP-P01-012 | Standards overlay live revision re-check against official URLs at phase start                                                                | R03         | UNKNOWN | official standard URLs (per source register)                                                      | NOT_EXECUTED                  | 2026-08-13 | Security (re-check at each use point, P02+) |
| EVD-MVP-P01-013 | Cohort plan: closed invite-only (BQ-05), design-partner protocol, DPDP consent/notice design                                                 | R02, R03    | plan    | this file section 4                                                                               | SOURCE_DERIVED                | 2026-08-13 | UX Researcher                               |
| EVD-MVP-P01-014 | Cohort recruitment + consent activation (no live users available yet)                                                                        | R03         | plan    | this file section 4                                                                               | REQUIRES_STAKEHOLDER_DECISION | 2026-08-13 | UX Researcher                               |
| EVD-MVP-P01-015 | Design-partner evidence plan prevents anecdotal feedback from overriding measured outcomes                                                   | R02         | plan    | this file section 4.4                                                                             | REQUIRES_STAKEHOLDER_DECISION | 2026-08-13 | UX Researcher                               |
| EVD-MVP-P01-016 | R-1 desk research: India market, ATS reality, competitive landscape, regulatory overlay (carried from prior run)                             | R02         | report  | `docs/phases/mvp-p01/07-research-brief-2026-08-07.md`                                             | SOURCE_DERIVED                | 2026-08-07 | Business Analyst                            |
| EVD-MVP-P01-017 | Metrics measurable: formulas, owners, data sources recorded before gate use                                                                  | R05, R06    | file    | `docs/phases/mvp-p01/12-success-metrics.md`                                                       | SOURCE_DERIVED                | 2026-08-13 | PM                                          |
| EVD-MVP-P01-018 | Metric baseline measurement from live users (telemetry)                                                                                      | R05         | UNKNOWN | no environment/cohort yet (BQ-05)                                                                 | NOT_EXECUTED                  | 2026-08-13 | Platform (P02+)                             |
| EVD-MVP-P01-019 | Out-of-scope boundaries verified: enterprise SSO/SCIM, admin, billing, marketplace, multi-region, cross-user memory, unsupported automation  | R01         | file    | `docs/phases/mvp-p01/13-non-goals-research-backlog.md` + `docs/01-vaeloom-mvp-spec.md` section 14 | SOURCE_DERIVED                | 2026-08-13 | PM                                          |
| EVD-MVP-P01-020 | BQ-01..06 statuses recorded in the risk/decision register (BQ-01..05 resolved 2026-08-07/13; BQ-06 carried forward)                          | R07         | file    | `docs/phases/mvp-p01/04-risk-decision-assumption-register.md` section 4                           | SOURCE_DERIVED                | 2026-08-13 | PM                                          |
| EVD-MVP-P01-021 | Stop/pivot leading indicators drafted (feed BQ-06; DEC-P01-05 re-affirmed 2026-08-13)                                                        | R01         | file    | `docs/phases/mvp-p01/05-validation-backlog.md` section 4                                          | SOURCE_DERIVED                | 2026-08-13 | PM                                          |
| EVD-MVP-P01-022 | Stop/pivot numeric thresholds approved (churn %, accuracy floor, deadline-miss ceiling)                                                      | R01         | UNKNOWN | threshold values undefined                                                                        | REQUIRES_STAKEHOLDER_DECISION | 2026-08-13 | USER (BQ-06)                                |

## 3. Problem statements (PS-01..03 - refreshed for re-run baseline)

| #     | Statement (falsifiable, draft)                                                                                                                                                                      | Falsifier                                                                                                                                        | Evidence needed                                                       | Status                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| PS-01 | Early-career job seekers and students lose time and miss deadlines because job-search inputs (resumes, applications, emails) live in disconnected places and must be re-curated manually each time. | If the closed cohort reports no measurable time saving or no deadline-miss reduction after N weeks, the statement fails.                         | Cohort diary/usage data (P14+ eval); INT-05 scope check               | DRAFT - requires design-partner cohort (EVD-MVP-P01-004/014) |
| PS-02 | Memory-first assist (ingest -> organize -> remember -> assist) reduces repeat-answer effort (rewriting resume sections, re-entering application data, re-finding documents).                        | If users' repeat-input events do not decline after adoption, statement fails.                                                                    | Telemetry + user-verified logs (workspace-scoped, privacy-preserving) | DRAFT - measurement NOT_EXECUTED (EVD-MVP-P01-018)           |
| PS-03 | Trust concerns (what the assistant sends, when it acts, deletion) block adoption of AI job-search helpers more than feature gaps do.                                                                | If cohort drop-off correlates with trust events (unsent drafts, unclear approvals, hard deletion) rather than missing features, statement holds. | Approval UX study + drop-off analysis (VB-03)                         | DRAFT - needs design-partner evidence plan (EVD-MVP-P01-015) |

## 4. User cohort + design-partner protocol

### 4.1 Cohort definition (BQ-03/04/05, approved)

- **Launch segment:** India, 18+, individual job seekers (students +
  early-career professionals), single-user workspace experience.
- **Validation cohort:** closed invite-only cohort (BQ-05, approved 2026-08-07,
  re-affirmed 2026-08-13) - small N (10-20), zero-budget volunteer cohort via
  founder's network, no incentives (DEC-P01-06/07, prior run - carried),
  workspace-scoped, no cross-user data. **No live users available yet** - all
  live-user work is `REQUIRES_STAKEHOLDER_DECISION`.
- **Segmentation for research:** age band (18-24, 25-30), employment state
  (student, fresher, 1-3 y), region (urban metro, peri-urban/tier-2),
  institution relationship (enrolled, alumnus, independent learner), data
  sensitivity (education records vs. general work history vs. employer-linked
  data). See `10-persona-jtbd-evidence.md` section 2.

### 4.2 Design-partner selection criteria

1. Member of the target segment (India, 18+, individual job seeker - BQ-03),
   matching at least one persona in `10-persona-jtbd-evidence.md` section 3-5.
2. Spread across the segmentation axes (age band, employment state, region, data
   sensitivity), not a single homogeneous group.
3. Willing to use the product in a real job-search loop (not a one-session
   reviewer) and to complete structured measurement exercises.
4. No direct financial stake, founder-family or vendor relationship that creates
   answer bias; conflicts recorded.

### 4.3 Consent and notice (India DPDP Act 2023 + DPDP Rules 2025)

- Pre-enrollment notice: what data is collected, purpose (product validation),
  retention, deletion rights, and right to withdraw consent - in plain language
  (English; regional-language option for tier-2/peri-urban participants).
- Explicit, granular consent per data class (documents, email metadata,
  telemetry) before any collection; no dark patterns.
- Cohort data is workspace-scoped and never cross-used; export/delete exercise
  available to every participant (VB-05).
- Professional legal review before any compliance claim (RISK-P00-08).

### 4.4 Measurement protocol (anti-anecdote guard)

1. **Pre-registered outcomes** - every experiment defines its metric, formula
   and decision threshold before data collection (this plan section 7, backlog
   section 3).
2. **Measured > anecdotal** - a design-partner anecdote is logged as a
   qualitative note but never scores a validation result by itself; results
   require the measured instrument (VB-01..08).
3. **Dual channel minimum** - a claim is marked validated only when at least two
   channels agree (telemetry + exercise record + interview synthesis).
4. **Sample size guidance** - minimum 10 participants for qualitative saturation
   per segment; quantitative claims additionally require a stated N per
   experiment with the threshold pre-committed; N below guidance is reported as
   `REQUIRES_STAKEHOLDER_DECISION`, never padded.
5. **Owner:** UX Researcher. **Status:** `REQUIRES_STAKEHOLDER_DECISION`
   (protocol exists; activation needs cohort recruitment approval - EVD-014).

## 5. Personas and JTBD (WS-01.1)

- Full persona/JTBD evidence: `docs/phases/mvp-p01/10-persona-jtbd-evidence.md`
  (DEL-MVP-P01-02) - three personas, JTBD per persona (functional/emotional/
  social), agent mapping, data sensitivity, evidence status per claim.
- Personas are `SOURCE_DERIVED` hypotheses grounded in
  `docs/01-vaeloom-mvp-spec.md` + BQ-03 + `07-research-brief-2026-08-07.md`;
  prevalence claims are not asserted without interview data (EVD-MVP-P01-004).

## 6. Research plan (WS-01.2 - refreshed)

| Step | Method                                                                                | Sources                                                                                | Owner            | Output                             | Status                                                           |
| ---- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------- | ---------------------------------- | ---------------------------------------------------------------- |
| R-1  | Desk research: domain statistics + competitor capabilities (official/observable only) | MoSPI/AISHE (India employment/education), official job-platform programs, product docs | Business Analyst | Research brief w/ citations        | DONE 2026-08-07 -> `07-research-brief-2026-08-07.md`             |
| R-2  | Problem interviews (closed cohort, consent-first)                                     | Design-partner cohort (section 4)                                                      | UX Researcher    | Interview synthesis (privacy-safe) | BLOCKED - `REQUIRES_STAKEHOLDER_DECISION` (EVD-MVP-P01-014)      |
| R-3  | Journey mapping (current state) from R-1/R-2 evidence                                 | Synthesis                                                                              | BA / UX          | Journey map                        | Planned (R-2 dependency)                                         |
| R-4  | Trust/safety constraint elicitation                                                   | OWASP agentic/LLM, NIST AI RMF, INT-02 section 3                                       | Privacy Engineer | Constraint register                | DONE 2026-08-07 (research brief section 4 + this file section 9) |
| R-5  | Metrics definition (formulas + owners)                                                | This plan section 7 + P00 register 04                                                  | PM               | Metrics sheet (DEL-MVP-P01-04)     | DONE 2026-08-13 -> `12-success-metrics.md`                       |
| R-6  | Validation backlog (experiments, triggers)                                            | Synthesis                                                                              | PM               | `05-validation-backlog.md`         | DONE 2026-08-13                                                  |

## 7. Outcome metrics (headline - full set with formulas in `12-success-metrics.md`)

| Metric                    | Formula                                                                        | Owner      | Gate use                |
| ------------------------- | ------------------------------------------------------------------------------ | ---------- | ----------------------- |
| Time-to-ready-application | Sigma(application prep time) / applications, cohort-reported                   | Product    | P01 evidence (baseline) |
| Deadline miss rate        | missed deadlines / tracked deadlines                                           | Product    | P03+                    |
| Repeat-input reduction    | duplicate-entry events per user per week                                       | Product    | P12+                    |
| Trust retention           | cohort retention at N weeks by trust-event exposure                            | Trust / PM | P13                     |
| Deletion completeness     | % of user-requested deletions verified complete (export + purge + projections) | Privacy    | P13                     |
| Operation readiness       | rollback/recovery/observability evidence exists                                | Platform   | P19                     |

## 8. Non-goals (explicit - full list in `13-non-goals-research-backlog.md`)

- No product-market-fit claim from P01 research.
- No enterprise capabilities (SSO/SCIM, institution admin, billing, marketplace,
  multi-region, cross-user memory).
- No unsupported job-platform automation; Gmail draft-only; payload-bound
  expiring approval + idempotency only.
- No FERPA/COPPA applicability claims - NOT_APPLICABLE for India 18+ launch
  (CF-P01-02); re-verify on any region/age expansion.

## 9. Trust/safety/business constraints (WS-01.3 - draft from INT-02 + overlays)

- Consequential actions require immutable payload-bound expiring approval +
  idempotency (INT-02 fixed decisions); Gmail is draft-only; job submission only
  through an approved official integration with payload-bound user approval.
- Relational data is authoritative; graph/vector/search/cache are
  provenance-carrying rebuildable projections - deletion must cover all
  projections (VB-05).
- **R-1 market evidence for the trust wedge:** auto-apply tools carry a
  measurable trust deficit (LazyApply ~52% 1-star reviews; "recruiters reject
  sloppy AI auto-filled applications" - Scale.jobs 2026). Vaeloom's
  suggest-mode-first + draft-only + approved-integration-only submission is a
  deliberate differentiator (PS-03).
- Under-13 excluded (BQ-04: 18+); WCAG 2.2 AA target; age verification approach
  TBD in P13.
- India DPDP notice/consent, rights, breach duties - designed into data flows
  from P03 onward; professional legal review before any compliance claim.
- EU AI Act resume-screening classification - NOT_APPLICABLE to India launch;
  re-verify on EU expansion (research brief section 4).

## 10. Open decisions needing stakeholder input

| ID       | Decision                                                                                                                              | Needed from | Blocks                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| BQ-06    | Stop/pivot numeric thresholds (churn %, deadline-miss ceiling, accuracy floor) - DEC-P01-05 re-affirmed 2026-08-13, values still open | USER        | P01 gate (recorded as REQUIRES_STAKEHOLDER_DECISION, EVD-MVP-P01-022) |
| D-P01-01 | Design-partner cohort size + incentive approach (prior run DEC-P01-06/07: zero-budget volunteer, no incentives)                       | USER        | R-2                                                                   |
| D-P01-02 | Budget envelope for research tooling/cohort                                                                                           | USER        | R-2 (BQ-05 budget TBD)                                                |
