# MVP-P03 — 08. Registers (Risks / Decisions / Assumptions / BQ / UNK)

> **MVP-P03 re-run 2026-08-14.** Baseline: repo `master` @ `23cc0b4` (P02 CLOSED
> — ACCEPTED BY USER 2026-08-13, DEC-P02-06). Phase type: DOCS-ONLY. Supersedes
> prior P03 run 2026-08-07 (`08-registers-2026-08-07.md`) — refreshed with P02
> re-run carry-forward (DEC-P02-_, RISK-MVP-P02-_, BQ-P02-01..04) and
> reconciliations closed at P03 (DEC-P03-04).

## 1. Risks

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
| --------------- | --------------------------------------------------------------------------------------------------- | -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------- |
| RISK-MVP-P03-01 | Docs mistaken for runtime completion | Critical | False readiness | Docs-only phase; runtime evidence mandatory at implementation gates; requirements docs carry no runtime claims | Phase owner | OPEN |
| RISK-MVP-P03-02 | Scope/permission/data assumed | High | Leak/loss/rework | BQ-P02-01..04 user-confirmed (DEC-P02-06); approved change control (07-change-control) | Product/Security | OPEN |
| RISK-MVP-P03-03 | External API/model/standard drift | High | Regression | Pins, owners, tests, kill switches (AUTO-01..03); carried from RISK-MVP-P02-03 | Integration/AI | OPEN |
| RISK-MVP-P03-04 | Evidence incomplete | High | Untrustworthy gate | Evidence plan + immutable reports; coverage/EVD reconciliations closed (DEC-P03-04) | QA | OPEN |
| RISK-MVP-P03-05 | MVP scope expansion | High | Delay/complexity | MoSCoW + release baseline + change control; enterprise scope (T2/T3) proposals-only (DEC-P03-01) | Product | OPEN |
| RISK-MVP-P03-06 | T3 auto-apply trust/account risk | High | Trust/legal | Review-first default; pacing; audit; AUTO-03; legal review gate P13; T3 proposals-only (DEC-P03-01) | Product/Security | OPEN |
| RISK-MVP-P03-07 | Cohort interviews still pending | Medium | Validation gap | Proxy evidence; design-partner protocol (DEC-P03-05); VB-07 blocked on user (UNK-P03-02) | UX | OPEN |
| RISK-MVP-P02-01 | Research docs mistaken for runtime completion | Critical | False readiness | Runtime evidence/status labels mandatory (`NOT_EXECUTED` kept honest); discovery owns no runtime claims; gate requires line-by-line math | Phase owner | OPEN |
| RISK-MVP-P02-02 | Connector permission/data scope assumed (Gmail draft-only, approved-integration-only submission) | High | Leak/loss/rework | Verify against official docs (13-platform-research.md §1, §2); draft-only enforcement + immutable payload-bound expiring approval + idempotency tests owned by P13 | Security Architect | OPEN |
| RISK-MVP-P02-03 | External API/model/policy drift after research (Gmail, LinkedIn, Naukri, LLM, MCP, OAuth, WCAG) | High | Connector/compliance | Pin versions in 11-evidence-plan.md §4; compatibility tests; owner per integration; kill switch (P05+) | Integration/AI | OPEN |
| RISK-MVP-P02-04 | Compliance claims made without legal review | High | Legal exposure | Never self-claim compliance; professional review before public claims (DEC-P02-04); P13 legal gate hard dependency | Compliance | OPEN |
| RISK-MVP-P02-05 | MVP scope expansion during research | High | Delay/complexity | Strict scope gate at every phase; explicit non-goals (11-evidence-plan.md §8); enterprise routes gated off (FB-05); DEC-P01-08 re-affirmed | Product | OPEN |
| RISK-MVP-P02-06 | Cohort unavailable → interviews stall | Medium | Validation gap | Founder-network volunteers; proxy = public job-pain evidence; design-partner protocol passed to P03 (DEC-P03-05); VB-07 still blocked on user | User Researcher | OPEN |
| RISK-MVP-P02-07 | Platform ToS action from Tier-2 read scraping (bans/demand letters) | High | Account/platform risk | Opt-in flag AUTO-02; pacing (≤1 req/2s); no anti-bot evasion; kill switch AUTO-02 (per-source pause); legal review P13 before default-ON | Platform | OPEN |
| RISK-MVP-P02-08 | Legal exposure from scraping (Proxycurl precedent: Microsoft suit 2023, settled 2024 — no shutdown) | High | Legal exposure | Documented in 13-platform-research.md §3 (resolution); read-only only; legal-review gate P13; per-source pause | Security Architect | OPEN |
| RISK-MVP-P02-09 | Auto-apply quality/trust damage or account lockouts | Medium | Trust/retention | Review-first default; pacing caps; audit log; AUTO-03 kill switch | Product/Security | OPEN |
| RISK-MVP-P02-10 | Coverage discrepancy: 94% (P00 matrix) vs 97% (AGENTS.md) — of record = 94% | Medium | Evidence integrity | RESOLVED: 94%-of-record (P00 matrix 2026-08-12) is the gate-verified figure; 97% = separate re-measurement (AGENTS.md 2026-08-13) re-verified at P02 re-run; delta documented in 05-traceability-matrix.md; both figures visible with sources | QA/Release | CLOSED/VERIFIED |
| RISK-MVP-P02-11 | EVD row count stale in P01 gate/verification (22 vs 25) | Low | Cosmetic; no gate impact | RESOLVED: true counts 22→25 recorded in 05-traceability-matrix.md reconciliation note; P01 gate re-verified | QA/Release | CLOSED |
| RISK-MVP-P02-12 | Google OAuth verification cost/limit at $0 budget | High | Launch blocker | 13-platform-research.md §1: unverified apps limited to 100 users; polling + limited scopes; mock mode for dev; real verification deferred P19 (ASP-04) | Product/Platform | OPEN |
| RISK-MVP-P02-13 | Naukri partner program gate — no public API, commercial agreement required | High | Job platform surface | 13-platform-research.md §2: Naukri B2B-only; MVP tracks via Gmail read + manual entry; no sanctioned apply API for individuals | Product/Platform | OPEN |
| RISK-MVP-P02-14 | Proxycurl operational (not shutdown) — legal risk persists for T2 scraping | Medium | T2 scraping risk | 13-platform-research.md §3: Proxycurl operational, lawsuit settled; T2 remains opt-in + legal review; no default-ON | Security Architect | OPEN |
| RISK-MVP-P02-15 | DPDP Rules 2025 in-force status verified but professional review required for any claim | High | Compliance claim risk | 15-regulatory-analysis.md §1: DPDP Act + Rules verified 2026-08-13; consent protocol designed to both; professional review gate P13 before any claim | Legal/Compliance | OPEN |
| RISK-MVP-P03-08 | TenantMiddleware NOT mounted — no tenant context set on requests; RLS receives NULL | Critical | Cross-tenant data leak | FR-71: mount TenantMiddleware in main.py; verify SET app.tenant_id called; isolation suite against PostgreSQL (FR-73/74) | Security Architect | OPEN |
| RISK-MVP-P03-09 | RLS on 4/13 tenant_id tables — 9 tables rely on app-level filtering only | Critical | Cross-tenant data leak | FR-73: extend RLS migration to all 13 tenant_id tables; coverage test; composite constraints (FR-82) | Security Architect | OPEN |
| RISK-MVP-P03-10 | Workload identity not implemented — service-to-service auth uses shared secrets or user creds | High | Credential exposure | FR-81: implement HMAC/bearer service tokens per ADR-025; workers carry no user creds | Security Architect | OPEN |
| RISK-MVP-P03-11 | 5 frontend pages use hardcoded mock data — billing, admin, marketplace show fake data | Medium | Misleading demo | FR-79: document pages as T2/T3 scope or wire to real API; no runtime claims for mock pages | Frontend Lead | OPEN |
| RISK-MVP-P03-12 | SAML SSO has no signature validation — assertions could be forged | Medium | Auth bypass (enterprise) | FR-78: implement XML signature validation; wire to auth flow; enterprise-scope (OUT_OF_SCOPE MVP) | Security Architect | OPEN |
| RISK-MVP-P03-13 | testing/ directories empty — no smoke, security, chaos, fuzz, visual-regression tests | Medium | Test coverage gap | FR-80: populate testing/ dirs with initial tests; CI integration | QA Lead | OPEN |

## 2. Decisions

| ID | Decision | Value | Authority | Date |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------- | ----------------------------------------------- |
| DEC-P00-06 | INT-02 governing; INT-01 substitute accepted | — | User | 2026-08-06 |
| DEC-P01-01 | 8-agent/6-memory MVP scope lock (INT-02) | — | User | 2026-08-07 |
| DEC-P01-02 | Recommend-mode-first (suggest; no auto-apply) — **amended by DEC-P02-05 T2/T3** | — | User | 2026-08-07 |
| DEC-P01-03 | Draft-only Gmail (no auto-send) | — | User | 2026-08-07 |
| DEC-P01-04 | Approved-integration-only (no auto-apply on any platform) — **amended by DEC-P02-05 T2** | — | User | 2026-08-07 |
| DEC-P01-05 | Stop/pivot criteria defined | — | User | 2026-08-07 |
| DEC-P01-07 | Cohort = India 18+ volunteers, N≈10–20, zero-budget, no incentives | — | User | 2026-08-07 |
| DEC-P01-08 | $0 budget: OSS + free tiers + volunteer time | — | User | 2026-08-07 |
| DEC-P02-01 | Gmail polling (MVP); push = P15+ upgrade path documented (watch renewal cron, Pub/Sub, historyId persistence, 404 full-resync fallback) | Evidence | Phase owner | 2026-08-07 |
| DEC-P02-02 | Platform lawful surface: Naukri B2B-only, LinkedIn open perms only + Talent Solutions partners, Indeed Publisher Program — no consumer job-search/apply APIs for individuals | Evidence | Phase owner (web-verified) | 2026-08-13 |
| DEC-P02-03 | Eval dataset plan: 9 datasets (MIT/CC-BY/Apache-2.0), synthetic email corpus blocked on user (VB-08), no PII, contamination controls | Plan | Data Architect | 2026-08-13 |
| DEC-P02-04 | Regulatory professional-review gate (P13); no compliance self-claims; DPDP + EU AI Act verified 2026-08-13 | Plan | Compliance Reviewer | 2026-08-13 |
| DEC-P02-05 | **AUTOMATION BREADTH = ALL TIERS (user "all above" 2026-08-07)**: T1 lawful orchestration (MVP core, ON) + T2 discovery scraping (AUTO-02, opt-in) + T3 auto-apply (AUTO-03, approval contract, legal review + per-plan consent). **P02 gate 2026-08-13: USER kept T2/T3 as PROPOSALS ONLY (no amendment to DEC-P01-02/04); T1 = MVP core, stands.** | User (sole approver) | User | 2026-08-07; re-confirmed at P02 gate 2026-08-13 |
| DEC-P02-06 | **BQ-P02-01..04 confirmed by USER at P02 gate (2026-08-13)**: value prop = memory-first assistant; primary persona P1 "The Fresher"; thresholds ≥80% hit-rate / ≥90% deadline extraction / zero data-loss / 100% deletion; design load 100–1,000 concurrent | Value/scope/metrics basis for P03 | User | 2026-08-13 |
| DEC-P03-01 | **T2/T3 = PROPOSALS ONLY (flag-gated AUTO-02/03, legal review P13 before default-ON); T1 = MVP core** — CF-P03-01, re-affirms DEC-P02-05 at P03 | Scope baseline for P03 | User (sole approver) | 2026-08-14 |
| DEC-P03-02 | Repo truth (Next.js/FastAPI) outranks prompt prose (NestJS) — CF-P03-02 | Evidence | Phase owner (repo-verified) | 2026-08-14 |
| DEC-P03-03 | Requirements baseline = APPROVED_BASELINE pending gate; binds P04+ via change control | — | Phase owner | 2026-08-14 |
| DEC-P03-04 | Coverage (94%-of-record) + EVD count (22→25) reconciliations CLOSED; both figures remain visible with sources (RISK-MVP-P02-10/11) | Evidence | QA/Release | 2026-08-14 |
| DEC-P03-05 | Design-partner protocol (P02 11-evidence-plan.md §5) until cohort signs up; R-2 interviews proceed on signup | Plan | Phase owner | 2026-08-14 |
| DEC-P03-06 | **Zero-trust codebase audit 2026-08-16** identified 15 implementation gaps; new requirements FR-71..FR-85 added to 03-requirements.md §8; gate re-scored; risks RISK-MVP-P03-08..13 registered. Full details in `12-implementation-gap-requirements.md`. | Evidence | Phase owner | 2026-08-16 |
| DEC-P03-07 | **P0 gap requirements FR-71..75, FR-82, FR-85 are release-blocking** — must be fixed before any MVP release claim. P1 gaps (FR-76..80, FR-81, FR-84) required for MVP but not release-blocking. | Scope baseline | User (sole approver) | 2026-08-16 |

## 3. Assumptions

| ID | Assumption | Owner | Reversible? | Approval |
| ---------- | --------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------- | ----------- |
| ASP-01 | Scope lock without time/effort questions (INT-02) | Product | No | P01 ✅ |
| ASP-02 | Suggest-mode-first with kill switch | Product | Yes | P01 ✅ |
| ASP-03 | Draft-only Gmail by default; send scope enabled only per-user with T3 approval contract | Product | Yes (DEC-P02-05) | P02 amended |
| ASP-04 | No scraping by default; Tier-2 read-only behind AUTO-02 opt-in flag | Product | Yes (DEC-P02-05) | P02 amended |
| ASP-05 | Cohort volunteers onboard free; no incentives | UX | Yes | P01 ✅ |
| ASP-06 | Gmail polling adequate for MVP deadline extraction | Connector | Yes — push upgrade path | P02 |
| ASP-07 | Free-tier APIs cover cohort scale (<100 users) | Platform | Yes — measured at P13 | P02 |
| ASP-P02-01 | Google OAuth verification cost absorbed at $0 via mock/polling + limited scopes | Product | Yes — real auth P19 | P02 |
| ASP-P02-02 | Proxycurl operational — legal risk persists but no shutdown | Platform | Yes — T2 opt-in only | P02 |
| ASP-P02-03 | LinkedIn scraping never default-ON; hiQ v. LinkedIn precedent stands | Platform | Yes — T2 legal review | P02 |
| ASP-P02-04 | Synthetic email corpus quality ceiling UNKNOWN until cohort consent (VB-08) | Data | Yes — not required for MVP eval (public datasets suffice) | P02/P03 |
| ASP-P03-01 | P1+P2 personas share one MVP surface (no separate flows) | Product | Yes | P03 |
| ASP-P03-02 | DPDP full enforcement 13 May 2027 — design-to-both | Compliance | No | P02/P03 |
| ASP-P03-03 | Requirements baseline (APPROVED_BASELINE) binds P04+ pending gate | Product | Yes — change control | P03 |

## 4. Blocking Questions (prompt §8)

| ID | Question | Proposed Answer | Evidence Basis | Status at Gate |
| --------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| BQ-01 | Approver + backup | USER (sole gate authority); backup not named yet | P01 re-run 2026-08-13; EXECUTION-STATUS.md | RESOLVED 2026-08-13; carried P03 2026-08-14 |
| BQ-02 | Repo/env/evidence baseline | Baseline `23cc0b4` (master, P02 gate accepted 2026-08-13); production environments deferred P19 | EXECUTION-STATUS.md; git status | RESOLVED 2026-08-13; carried P03 2026-08-14 |
| BQ-03 | Entities/ages/regions/use cases | India, 18+, individual job seekers, single-user, workspace-scoped | P01 re-run 2026-08-13 (DEC-P01-02/07/08 re-affirmed) | RESOLVED 2026-08-13; carried P03 2026-08-14 |
| BQ-04 | Launch region + min age | India, 18+ | P01 re-run 2026-08-13 | RESOLVED 2026-08-13; carried P03 2026-08-14 |
| BQ-05 | Team/budget/cohort/window | Founder-led team, $0 budget, closed invite-only cohort; **ship window TBD → P04** (ASP-02) | P01 re-run 2026-08-13 | RESOLVED 2026-08-13; carried P03 2026-08-14 |
| BQ-06 | Stop/pivot criteria | DEC-P01-05 carried + re-affirmed (stop on trust-driven churn; pivot on no memory value or deadline-accuracy miss) | P01 re-run 2026-08-13 | RESOLVED 2026-08-13; carried P03 2026-08-14 |
| BQ-P02-01 | Value proposition of MVP | "Memory-first personal job-search assistant: never re-enter career data, never miss a deadline (Gmail extraction), never act without approval (suggest-mode + draft-only)." | 17-decision-implications.md §1 | ✅ RESOLVED 2026-08-13 (USER confirmed at P02 gate); carried P03 |
| BQ-P02-02 | Primary target customer/persona | P1 "The Fresher" — India, 18–24, first job search (P2 "Urban Switcher" secondary) | 17-decision-implications.md §1 | ✅ RESOLVED 2026-08-13 (USER confirmed at P02 gate); carried P03 |
| BQ-P02-03 | MVP memory quality sufficient | Retrieval hit-rate ≥80% on 6 memory types; deadline extraction ≥90%; zero data-loss; deletion completeness 100% | 17-decision-implications.md §1 | ✅ RESOLVED 2026-08-13 (USER confirmed at P02 gate); carried P03 |
| BQ-P02-04 | Maximum user load for design | Target 100 concurrent (cohort); upper bound 1,000 concurrent (stateless + Postgres) | 17-decision-implications.md §1 | ✅ RESOLVED 2026-08-13 (USER confirmed at P02 gate); carried P03 |

## 5. Open Unknowns

| ID | Unknown | Category | Blocks? | Due |
| ---------- | -------------------------------------------------------------- | ----------- | ------------------------- | ------- |
| UNK-01 | INT-01 template original | Input | No (substitute) | — |
| UNK-02 | Production credentials | Access | GO (P19) | P19 |
| UNK-03 | Cohort size/timeline | Stakeholder | Interviews (VB-07) | P03→P04 |
| UNK-04 | Budget total confirmed | Stakeholder | No ($0) | P03→P04 |
| UNK-P02-01 | DPDP Rules 2025 force status final | Legal | No (design to both) | P04 |
| UNK-P02-02 | Gmail quota behavior at cohort scale | Technical | No | P07 |
| UNK-P02-03 | Google OAuth verification timeline | Access | No (mock P02-P18) | P19 |
| UNK-P02-04 | Synthetic email corpus quality ceiling | Data | Eval completeness (VB-08) | P03→P04 |
| UNK-P02-05 | Naukri partner program cost/access | Product | Job platform surface | P04 |
| UNK-P02-06 | Actual deadline extraction accuracy on synthetic + real cohort | Data | BQ-P02-03 threshold | P12 |
| UNK-P03-01 | T2/T3 legal review outcome | Legal | T2/T3 default-ON | P13 |
| UNK-P03-02 | Cohort availability timeline | Stakeholder | Interviews (VB-07, R-2) | P04 |
