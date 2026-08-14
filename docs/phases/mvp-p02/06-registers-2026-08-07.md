# MVP-P02 — 06. Registers (Risks / Decisions / Assumptions)

## 1. Risks

| ID          | Risk                                                                                     | Severity | Impact                | Mitigation                                                                                    | Owner              | Status |
| ----------- | ---------------------------------------------------------------------------------------- | -------- | --------------------- | --------------------------------------------------------------------------------------------- | ------------------ | ------ |
| RISK-P02-01 | Research docs mistaken for runtime completion                                            | Critical | False readiness       | Status labels; runtime evidence required at P12+ gates                                        | Phase owner        | OPEN   |
| RISK-P02-02 | Connector permission/data scope assumed                                                  | High     | Leak/loss/rework      | Verify against official docs; draft-only + read-only scope; user consent                      | Security Architect | OPEN   |
| RISK-P02-03 | External API/model/policy drift after research                                           | High     | Regression            | Pin versions, owner, tests, kill switch                                                       | Integration/AI     | OPEN   |
| RISK-P02-04 | Compliance claims made without legal review                                              | High     | Legal exposure        | Never self-claim compliance; professional review before public claims                         | Compliance         | OPEN   |
| RISK-P02-05 | MVP scope expansion during research                                                      | High     | Delay/complexity      | Strict scope gate; enterprise features gated                                                  | Product            | OPEN   |
| RISK-P02-06 | Cohort unavailable → interviews stall                                                    | Medium   | Validation gap        | Founder-network volunteers; proxy = public job-pain evidence                                  | User Researcher    | OPEN   |
| RISK-P02-07 | Platform ToS action from Tier-2 read scraping (bans/demand letters)                      | High     | Account/platform risk | Opt-in flag AUTO-02; pacing; no anti-bot evasion; kill switch; legal review before default-ON | Platform           | OPEN   |
| RISK-P02-08 | Legal exposure from scraping (Proxycurl precedent: Microsoft suit → shutdown 2025-07-04) | High     | Legal exposure        | Documented; read-only only; legal-review gate P13; per-source pause                           | Security Architect | OPEN   |
| RISK-P02-09 | Auto-apply quality/trust damage or account lockouts                                      | Medium   | Trust/retention       | review-first default; pacing caps; audit log; AUTO-03 kill switch                             | Product/Security   | OPEN   |

## 2. Decisions

| ID         | Decision                                                                                                                                                                                                                             | Value                | Authority   | Date       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ----------- | ---------- |
| DEC-P00-06 | INT-02 governing; INT-01 substitute accepted                                                                                                                                                                                         | —                    | User        | 2026-08-06 |
| DEC-P01-01 | 8-agent/6-memory MVP scope lock (INT-02)                                                                                                                                                                                             | —                    | User        | 2026-08-07 |
| DEC-P01-02 | Recommend-mode-first (suggest; no auto-apply)                                                                                                                                                                                        | —                    | User        | 2026-08-07 |
| DEC-P01-03 | Draft-only Gmail (no auto-send)                                                                                                                                                                                                      | —                    | User        | 2026-08-07 |
| DEC-P01-04 | Approved-integration-only (no auto-apply on any platform)                                                                                                                                                                            | —                    | User        | 2026-08-07 |
| DEC-P01-05 | Stop/pivot criteria defined                                                                                                                                                                                                          | —                    | User        | 2026-08-07 |
| DEC-P01-06 | Cohort = India 18+ volunteers, N≈10–20                                                                                                                                                                                               | —                    | User        | 2026-08-07 |
| DEC-P01-07 | $0 budget: OSS + free tiers + volunteer time                                                                                                                                                                                         | —                    | User        | 2026-08-07 |
| DEC-P02-01 | Scope: research-only; no new runtime deps; P01 repo baseline                                                                                                                                                                         | Evidence             | Phase owner | 2026-08-07 |
| DEC-P02-05 | **AUTOMATION BREADTH = ALL TIERS (user "all above")**: T1 lawful orchestration (MVP core) + T2 discovery scraping (flag AUTO-02, opt-in) + T3 auto-apply (approval contract; autopilot gated on legal review). Amends DEC-P01-02/04. | User (sole approver) | User        | 2026-08-07 |

## 3. Assumptions (registered, reversible where noted)

| ID     | Assumption                                                                              | Owner     | Reversible?             | Approval    |
| ------ | --------------------------------------------------------------------------------------- | --------- | ----------------------- | ----------- |
| ASP-01 | Scope lock without time/effort questions (INT-02)                                       | Product   | No                      | P01 ✅      |
| ASP-02 | Suggest-mode-first with kill switch                                                     | Product   | Yes                     | P01 ✅      |
| ASP-03 | Draft-only Gmail by default; send scope enabled only per-user with T3 approval contract | Product   | Yes (DEC-P02-05)        | P02 amended |
| ASP-04 | No scraping by default; Tier-2 read-only behind AUTO-02 opt-in flag                     | Product   | Yes (DEC-P02-05)        | P02 amended |
| ASP-05 | Cohort volunteers onboard free; no incentives                                           | UX        | Yes                     | P01 ✅      |
| ASP-06 | Gmail polling adequate for MVP deadline extraction                                      | Connector | Yes — push upgrade path | P02         |
| ASP-07 | Free-tier APIs cover cohort scale (<100 users)                                          | Platform  | Yes — measured at P13   | P02         |

## 4. Blocking questions (prompt §8) — proposals pending user confirmation

| ID        | Question                                               | Proposed answer                                                                                                                                                                                 | Evidence basis                                    |
| --------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| BQ-P02-01 | What is the value proposition of the MVP?              | "Memory-first personal job-search assistant: never re-enter your career data, never miss a deadline (Gmail extraction), and never act without your approval (suggest-mode + draft-only Gmail)." | P01 PS-01..03; P02 WS-02.2 lawful-surface finding |
| BQ-P02-02 | Who is the primary target customer/persona for launch? | **P1 "The Fresher"** — India, 18–24, first job search (P2 "Urban Switcher" secondary)                                                                                                           | P01 personas; India labor stats (MoSPI/AISHE)     |
| BQ-P02-03 | What MVP memory quality is sufficient to retain users? | Retrieval hit-rate ≥80% on 6 memory types; deadline extraction accuracy ≥90% on eval set; zero data-loss incidents; deletion completeness 100%                                                  | P02 WS-02.3 eval plan + P01 VB-02/06              |
| BQ-P02-04 | Maximum user load for design (target + upper bound)?   | Target **100 concurrent** (cohort scale); upper bound **1,000 concurrent** (design headroom, stateless app + Postgres)                                                                          | ASP-07; Gmail quota analysis (WS-02.2)            |

## 5. Open unknowns

| ID         | Unknown                              | Category    | Blocks?             | Due |
| ---------- | ------------------------------------ | ----------- | ------------------- | --- |
| UNK-01     | INT-01 template original             | Input       | No (substitute)     | —   |
| UNK-02     | Production credentials               | Access      | GO (P19)            | P19 |
| UNK-03     | Cohort size/timeline                 | Stakeholder | Interviews          | P03 |
| UNK-04     | Budget total confirmed               | Stakeholder | No ($0)             | P03 |
| UNK-P02-01 | DPDP Rules 2025 force status final   | Legal       | No (design to both) | P04 |
| UNK-P02-02 | Gmail quota behavior at cohort scale | Technical   | No                  | P07 |
