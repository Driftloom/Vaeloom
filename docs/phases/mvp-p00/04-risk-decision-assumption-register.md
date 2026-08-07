# MVP-P00 — 04. Risk, Decision, Assumption Register

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Status:** OPEN —
> owned register; updated at every phase gate **Rule:** assumptions are blocked
> by default unless approved + reversible + owned. Unknowns are never invented.
> **Register root:** `docs/phases/mvp-p00/`

## 1. Risks

| ID          | Risk                                                                         | Severity | Impact                                                                | Mitigation                                                                                                                | Owner            | Status                        |
| ----------- | ---------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------- |
| RISK-P00-01 | Docs mistaken for runtime completion                                         | Critical | False readiness, wrong priorities                                     | Maturity matrix (03) separates docs vs code vs tests; status labels everywhere                                            | Phase owner      | OPEN                          |
| RISK-P00-02 | protobuf 4.25.9 × Python 3.14.6 breaks OTEL + full-app tests (47 fails)      | High     | Unverified middleware/router/otel paths; blocked security attestation | Pin compatible protobuf (≥5.29 / <6) or use Python ≤3.13 in CI + local; rerun suite; record evidence                      | Platform         | OPEN — blocks full test green |
| RISK-P00-03 | Frontend unit tests failing (6/20) + e2e not runnable                        | High     | UI behaviors unverified; connectors page render-blocking bug masked   | Fix `connectors/page.spec.tsx` (loading state handling), install @playwright/test, exclude e2e/ from jest (config defect) | Web              | OPEN                          |
| RISK-P00-04 | 23 agents vs 8-agent MVP scope                                               | High     | Scope creep; enterprise features ship in MVP                          | Scope gate in P01–P05; feature flags/kill switches; disable enterprise-only agents/routes in MVP builds                   | Product          | OPEN (CF-05/06)               |
| RISK-P00-05 | Evidence incomplete / unpushed baseline (ahead 4)                            | High     | Untrustworthy gate, unreproducible results                            | Push baseline, hash sources, immutable evidence files                                                                     | QA/Release       | OPEN                          |
| RISK-P00-06 | External API/model/standard drift (Gmail, LLM, MCP, OAuth)                   | High     | Connector regressions                                                 | Version pinning, compatibility tests, owner, kill switch                                                                  | Integration/AI   | OPEN                          |
| RISK-P00-07 | No production credentials/env; deploy target unknown                         | High     | Cannot validate runtime, release blocked                              | BQ-02 gate; approved environment provisioning before P19                                                                  | Platform/Release | OPEN — blocking               |
| RISK-P00-08 | Compliance claims without legal review (GDPR, DPDP, FERPA, COPPA, EU AI Act) | High     | Legal exposure                                                        | Professional legal review before any claim; no self-claimed compliance in P00                                             | Legal/Privacy    | OPEN                          |
| RISK-P00-09 | Gmail draft-only / approval contract not verified                            | High     | Unauthorized consequential action                                     | Draft-only enforcement test, payload-bound expiring approval, idempotency tests in P13                                    | Security/AI      | OPEN                          |
| RISK-P00-10 | MVP scope expansion pressure (enterprise features already in repo)           | High     | Delay/complexity                                                      | Strict scope gate at every phase; explicit NO-GO on out-of-scope code promotion                                           | Product          | OPEN                          |

## 2. Decisions

| ID         | Decision                                                                                                                                                            | Status                | Owner                | Date       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------- | ---------- |
| DEC-P00-01 | Deliverables live under `docs/phases/mvp-p00/`                                                                                                                      | APPROVED (user)       | Phase owner          | 2026-08-06 |
| DEC-P00-02 | Repo layout (FastAPI-only backend, ADR-001/009) governs over prompt skeleton dirs                                                                                   | OPEN — confirm P05    | Enterprise Architect | —          |
| DEC-P00-03 | INT-01 (Universal gatekeeper) MISSING — user supplied INT-02 (`vaeloom-mvp-e2e-enterprise-hardened.md`, hash-verified) as the governing authority for MVP execution | APPROVED (DEC-P00-06) | User/Phase owner     | 2026-08-06 |
| DEC-P00-04 | Measured evidence (2026-08-06 run) outranks stale docs claims (AGENTS.md 1626, IMPLEMENTATION-CHECKLIST complete)                                                   | APPROVED              | Phase owner          | 2026-08-06 |
| DEC-P00-05 | MVP verdict per honest evidence — NOT a rubber-stamp GO                                                                                                             | APPROVED (user)       | Phase owner          | 2026-08-06 |
| DEC-P00-06 | User supplied INT-02 as governing authority (INT-01 not found); INT-02 §0.2 authority order + §2/§5/§6/§7/§8/§16 bindings now apply to MVP                          | APPROVED (user)       | Phase owner          | 2026-08-06 |

## 3. Assumptions (all blocked/reversible until approved)

| ID     | Assumption                                                            | Blocked? | Reversible? | Owner            | Approval needed  |
| ------ | --------------------------------------------------------------------- | -------- | ----------- | ---------------- | ---------------- |
| ASP-01 | Launch region + min. age + entity set (BQ-03/04)                      | YES      | —           | Legal/Product    | BQ-03/04 gate    |
| ASP-02 | Team, budget, cohort, ship window (BQ-05)                             | YES      | —           | Founder          | P04              |
| ASP-03 | Accountable approver + backup (BQ-01)                                 | YES      | —           | Founder/PM       | P01 gate         |
| ASP-04 | Deploy target / environment / credentials (BQ-02)                     | YES      | —           | Platform         | P19              |
| ASP-05 | Gmail draft-only + approved job submission contract stays as designed | NO       | Yes         | Product/Security | P05 confirmation |

## 4. Blocking questions status (prompt §8)

| ID    | Question                                       | Status                                                                                                |
| ----- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| BQ-01 | Accountable approver + backup                  | **RESOLVED 2026-08-07 — USER (sole approver, no backup named yet)**                                   |
| BQ-02 | Repo version / environment / evidence baseline | Repo pinned (`bea5fe8`, pushed to origin); production environments UNKNOWN — deferred to P19 (ASP-04) |
| BQ-03 | Entities, ages, regions, use cases             | **RESOLVED 2026-08-07 — India launch, min age 18, individual job seekers**                            |
| BQ-04 | Launch region + min age                        | **RESOLVED 2026-08-07 — India, 18+**                                                                  |
| BQ-05 | Team/budget/cohort/window                      | **RESOLVED 2026-08-07 — founder-led team, budget TBD, closed invite-only cohort, no ship deadline**   |
| BQ-06 | Canonical vs superseded sources                | RESOLVED for in-repo docs (see 01-source-register)                                                    |

## 5. Open unknowns

| ID     | Unknown                                        | Category | Blocks?        | Due       |
| ------ | ---------------------------------------------- | -------- | -------------- | --------- |
| UNK-01 | Where is INT-01 governing file?                | Input    | Gate signature | Immediate |
| UNK-02 | Production DB/object-storage/queue credentials | Access   | GO             | P19       |
| UNK-03 | LLM/Gmail/job-board provider accounts          | Access   | GO             | P12/P13   |
| UNK-04 | Intended deploy platform (PaaS target)         | Decision | GO             | P05       |
| UNK-05 | Real user/data cohort for validation           | Data     | GO             | P02/P03   |
