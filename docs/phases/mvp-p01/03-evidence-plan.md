# MVP-P01 — 03. Evidence Plan (WS-01.1 / WS-01.2)

> The evidence plan is P01's entry criterion (P00 handoff §4). It defines what
> P01 must prove, the cohort, and the research plan. All claims require sources;
> nothing here is asserted as fact without a citation or an approved stakeholder
> decision.

## 1. Problem statements (falsifiable, draft)

| #     | Statement                                                                                                                                                                                           | Falsifier                                                                                                                                        | Evidence needed                                                       | Status                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------- |
| PS-01 | Early-career job seekers and students lose time and miss deadlines because job-search inputs (resumes, applications, emails) live in disconnected places and must be re-curated manually each time. | If a closed cohort reports no measurable time saving or no deadline miss reduction after N weeks, the statement fails.                           | Cohort diary/usage data (P14+ eval); INT-05 scope check               | DRAFT — requires design-partner cohort (ASP-05) |
| PS-02 | Memory-first assist (ingest → organize → remember → assist) reduces repeat-answer effort (rewriting resume sections, re-entering application data, re-finding documents).                           | If users' repeat-input events do not decline after adoption, statement fails.                                                                    | Telemetry + user-verified logs (workspace-scoped, privacy-preserving) | DRAFT                                           |
| PS-03 | Trust concerns (what the assistant sends, when it acts, deletion) block adoption of AI job-search helpers more than feature gaps do.                                                                | If cohort drop-off correlates with trust events (unsent drafts, unclear approvals, hard deletion) rather than missing features, statement holds. | Approval UX study + drop-off analysis                                 | DRAFT — needs design-partner evidence plan      |

## 2. User cohort (approved decisions + research target)

- **Launch segment (BQ-03/04, approved 2026-08-07):** India, 18+, individual job
  seekers (students + early-career professionals), single-user workspace
  experience.
- **Cohort for validation:** closed invite-only cohort (BQ-05, approved) — small
  N, workspace-scoped, no cross-user data. Design-partner evidence plan prevents
  anecdote over measurement (prompt future-readiness overlay).
- **Segmentation for research (not personas-in-one):** by age band (18–24,
  25–30), employment state (student, fresher, 1–3 y), data sensitivity
  (education records vs. general work history), device/connectivity.

## 3. Jobs-to-be-done (JTBD — to be validated, not asserted)

| JTBD                                         | Current approach (to research)          | Vaeloom wedge                                                       | Validation method                |
| -------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| Keep career documents current without effort | Manual re-edits before each application | Organization + Resume agents; memory reuse                          | Cohort task-completion study     |
| Never miss a deadline or follow-up           | Spreadsheets, alarms, email flagging    | Gmail deadline extraction + Scheduler reminders (draft-only)        | Deadline-miss logs               |
| Apply only where it is worth it              | Manual tracking of applications/status  | ATS + Job Search & Application tracking                             | Application-status completeness  |
| Know my data is safe and deletable           | Avoids AI helpers                       | Draft-only Gmail, payload-bound approval, export/deletion lifecycle | Trust survey + deletion exercise |

## 4. Research plan (WS-01.2)

| Step | Method                                                                                | Sources                                                                                        | Owner            | Output                             |
| ---- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------- |
| R-1  | Desk research: domain statistics + competitor capabilities (official/observable only) | MoSPI/AISHE (India employment/education), official job-platform partner programs, product docs | Business Analyst | Research brief w/ citations        |
| R-2  | Problem interviews (closed cohort, consent-first)                                     | Design-partner cohort                                                                          | UX Researcher    | Interview synthesis (privacy-safe) |
| R-3  | Journey mapping (current state) from R-1/R-2 evidence                                 | Synthesis                                                                                      | BA/UX            | Journey map                        |
| R-4  | Trust/safety constraint elicitation                                                   | OWASP agentic/LLM, NIST AI RMF, INT-02 §3                                                      | Privacy Engineer | Constraint register (WS-01.3)      |
| R-5  | Metrics definition (formulas + owners)                                                | This plan §6 + P00 register 04                                                                 | PM               | Metrics sheet (WS-01.4)            |
| R-6  | Validation backlog (experiments, triggers)                                            | Synthesis                                                                                      | PM               | `05-validation-backlog.md`         |

## 5. Outcome metrics (WS-01.4 — formulas, owners)

| Metric                    | Formula                                                                        | Owner    | Gate use     |
| ------------------------- | ------------------------------------------------------------------------------ | -------- | ------------ |
| Time-to-ready-application | Σ(application prep time) / applications, cohort-reported                       | Product  | P01 evidence |
| Deadline miss rate        | missed deadlines / tracked deadlines                                           | Product  | P03+         |
| Repeat-input reduction    | duplicate-entry events per user per week                                       | Product  | P12+         |
| Trust retention           | cohort retention at N weeks by trust-event exposure                            | Trust/PM | P13          |
| Deletion completeness     | % of user-requested deletions verified complete (export + purge + projections) | Privacy  | P13          |
| Operation readiness       | rollback/recovery/observability evidence exists                                | Platform | P19          |

## 6. Non-goals (explicit)

- No product-market-fit claim from P01 research.
- No enterprise capabilities (SSO/SCIM, institution admin, billing, marketplace,
  multi-region, cross-user memory).
- No unsupported job-platform automation; Gmail draft-only; payload-bound
  expiring approval only.
- No FERPA/COPPA applicability claims — record NOT_APPLICABLE for India-18+
  launch; re-verify on any region/age expansion (CF-P01-02).

## 7. Trust/safety/business constraints (WS-01.3 — draft from INT-02 + overlays)

- Consequential actions require immutable payload-bound expiring approval +
  idempotency (INT-02 §fixed decisions).
- Under-13 excluded; age verification approach TBD in P13 (COPPA revised rule
  trigger).
- India DPDP notice/consent, rights, breach duties — design into data flows from
  P03 onward; professional legal review before any compliance claim.
- Deletion lifecycle must cover system of record + vector/graph/search/cache
  projections (authoritative relational data rule).

## 8. Open decisions needing stakeholder input

| ID       | Decision                                                   | Needed from | Blocks                 |
| -------- | ---------------------------------------------------------- | ----------- | ---------------------- |
| BQ-06    | Stop/pivot criteria (which outcome would stop the project) | User        | P01 gate               |
| D-P01-01 | Design-partner cohort size + incentive approach            | User        | R-2                    |
| D-P01-02 | Budget envelope for research tooling/cohort                | User        | R-2 (BQ-05 budget TBD) |
