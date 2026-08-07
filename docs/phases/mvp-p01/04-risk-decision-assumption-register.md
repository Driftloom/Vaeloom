# MVP-P01 — 04. Risk / Decision / Assumption Register (phase-level)

## 1. Risks (carried + new)

| ID          | Risk                                            | Severity | Mitigation                                                                         | Owner         | Status            |
| ----------- | ----------------------------------------------- | -------- | ---------------------------------------------------------------------------------- | ------------- | ----------------- |
| RISK-P00-07 | No production credentials/env (BQ-02)           | High     | Deferred to P19 (ASP-04); discovery phase unaffected                               | Platform      | OPEN — deferred   |
| RISK-P00-08 | Compliance claims without legal review          | High     | No compliance claim without professional legal review; DPDP/Legal owner            | Legal/Privacy | OPEN              |
| RISK-P00-09 | Gmail draft-only / approval contract unverified | High     | Draft-only enforcement + payload-bound expiring approval + idempotency tests (P13) | Security/AI   | OPEN              |
| RISK-P00-10 | MVP scope expansion pressure                    | High     | Scope gate at every phase; enterprise routes gated off (R6)                        | Product       | OPEN — controlled |
| RISK-P01-01 | Research becomes unverified anecdotes           | Medium   | Evidence plan §4 sources-only; design-partner protocol prevents anecdote override  | UX Research   | OPEN              |
| RISK-P01-02 | Cohort privacy leak during interviews           | Medium   | Consent-first, workspace-scoped, no PII in synthesis                               | Privacy       | OPEN              |
| RISK-P01-03 | Persona conflation (one generic "student")      | Medium   | Age/region/employment segmentation per overlay                                     | UX Research   | OPEN              |

## 2. Decisions

| ID         | Decision                                                                                                                                                                                                                                                                                                                                                                                                                     | Value             | Authority                     | Date          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------- | ------------- |
| DEC-P00-06 | INT-02 governing for MVP; INT-01 substitute (gatekeeper compendiums) governing                                                                                                                                                                                                                                                                                                                                               | —                 | User                          | 2026-08-06/07 |
| DEC-P01-01 | P00 approved; proceed to P01                                                                                                                                                                                                                                                                                                                                                                                                 | —                 | User (sole approver, BQ-01)   | 2026-08-07    |
| DEC-P01-02 | BQ-03/04: India, 18+, individual job seekers                                                                                                                                                                                                                                                                                                                                                                                 | Region/age/entity | User                          | 2026-08-07    |
| DEC-P01-03 | BQ-05: founder-led, closed cohort, budget TBD, no ship deadline                                                                                                                                                                                                                                                                                                                                                              | Team/cohort       | User                          | 2026-08-07    |
| DEC-P01-04 | Predecessor audit verdict: 92/100 CONDITIONAL GO (non-dependent work only)                                                                                                                                                                                                                                                                                                                                                   | Gate              | Phase owner (evidence-driven) | 2026-08-07    |
| DEC-P01-05 | **BQ-06 stop/pivot criteria** — approved (user directive "complete the remaining things", 2026-08-07): (a) **STOP** if cohort trust events (unclear approvals, hard deletion) drive churn without fix within 2 releases; (b) **PIVOT** if no repeat-input reduction after adoption (memory value absent) → narrow wedge; (c) **PIVOT** if Gmail deadline-extraction accuracy below agreed threshold → document-focused wedge | Gate              | User                          | 2026-08-07    |
| DEC-P01-06 | **D-P01-01 cohort:** zero-budget volunteer invite-only cohort via founder's network, N≈10–20, no incentives; consent-first protocol                                                                                                                                                                                                                                                                                          | Research          | User                          | 2026-08-07    |
| DEC-P01-07 | **D-P01-02 budget:** $0 — free tooling only (official/free sources, OS tools, no paid surveys/panels)                                                                                                                                                                                                                                                                                                                        | Research          | User                          | 2026-08-07    |

## 3. Assumptions

| ID         | Assumption                                                                         | Reversible?                | Owner            | Approval                                                                          |
| ---------- | ---------------------------------------------------------------------------------- | -------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| ASP-01     | Launch region/min age/entity (BQ-03/04)                                            | No (baked into compliance) | Legal/Product    | BQ-03/04 gate ✅                                                                  |
| ASP-02     | Team/budget/cohort/window (BQ-05)                                                  | Yes                        | Founder          | ✅ RESOLVED — founder-led, closed cohort, **$0 budget** (DEC-P01-07), no deadline |
| ASP-03     | Approver + backup (BQ-01)                                                          | Yes                        | Founder/PM       | ✅ user sole approver (backup TBD)                                                |
| ASP-04     | Deploy target/env/credentials (BQ-02)                                              | —                          | Platform         | P19                                                                               |
| ASP-05     | Gmail draft-only + approved job submission contract as designed                    | Yes                        | Product/Security | P05 confirmation                                                                  |
| ASP-01-P01 | Students + early-career professionals in India have the disconnected-input problem | Yes                        | Product          | R-1/R-2 validation                                                                |

## 4. Blocking questions status

| ID    | Question                        | Status                                                                                                               |
| ----- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| BQ-01 | Approver + backup               | ✅ RESOLVED — user sole approver; backup TBD                                                                         |
| BQ-02 | Repo/env/evidence baseline      | Repo pinned (`bea5fe8`+`8b143d5`); environments deferred P19                                                         |
| BQ-03 | Entities/ages/regions/use cases | ✅ RESOLVED — India, 18+, individuals                                                                                |
| BQ-04 | Launch region + min age         | ✅ RESOLVED — India, 18+                                                                                             |
| BQ-05 | Team/budget/cohort/window       | ✅ RESOLVED — founder-led, closed cohort, budget TBD, no deadline                                                    |
| BQ-06 | Stop/pivot criteria             | ✅ RESOLVED 2026-08-07 — DEC-P01-05 (stop on trust-driven churn; pivot on no memory value or deadline-accuracy miss) |

## 5. Open unknowns

| ID     | Unknown                                                                   | Category         | Blocks?                                                                      | Due |
| ------ | ------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------- | --- |
| UNK-01 | INT-01 template original file                                             | Input            | No (substitute governing)                                                    | —   |
| UNK-02 | Production credentials (DB/object-storage/queue)                          | Access           | GO (P19)                                                                     | P19 |
| UNK-03 | BQ-06 stop criteria                                                       | Stakeholder      | ✅ RESOLVED 2026-08-07 (DEC-P01-05)                                          | —   |
| UNK-04 | Cohort size + research budget                                             | Stakeholder      | ✅ RESOLVED 2026-08-07 — volunteer cohort N≈10–20, $0 budget (DEC-P01-06/07) | —   |
| UNK-05 | Gmail deadline-extraction accuracy threshold (feeds BQ-06c pivot trigger) | Product/Security | P12 eval design                                                              | P12 |
