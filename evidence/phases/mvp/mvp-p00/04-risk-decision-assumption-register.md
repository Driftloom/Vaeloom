# MVP-P00 — 04. Risk, Decision, Assumption Register

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Status:** OPEN —
> owned register; updated at every phase gate (last refresh 2026-08-12,
> **re-audited 2026-08-16**) **Rule:** assumptions are blocked by default unless
> approved + reversible + owned. Unknowns are never invented. **Register root:**
> `docs/phases/mvp-p00/`

## 1. Risks

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------ |
| RISK-P00-01 | Docs mistaken for runtime completion | Critical | False readiness, wrong priorities | Maturity matrix (03) separates docs vs code vs tests; status labels everywhere; fresh re-run 2026-08-12 | Phase owner | OPEN |
| RISK-P00-02 | protobuf 4.25.9 x Python 3.14.6 breaks OTEL + full-app tests (47 fails) | High | Unverified middleware/router/otel paths; blocked security attestation | **RESOLVED/MITIGATED 2026-08-12** - test env sets `OTEL_SDK_DISABLED=true`; full suite green (2333/0/2xf); OTEL itself remains import-blocked on Py 3.14 unless disabled - carry to P17 | Platform | RESOLVED (residual: OTEL on Py 3.14) |
| RISK-P00-03 | Frontend unit tests failing (6/20) + e2e not runnable | High | UI behaviors unverified; connectors page render-blocking bug masked | **RESOLVED 2026-08-12** - jest 37/37 (connectors + sidebar specs green); @playwright/test at root; e2e **39/39 across 3 browsers** | Web | RESOLVED |
| RISK-P00-04 | 23 agents vs 8-agent MVP scope | High | Scope creep; enterprise features ship in MVP | Scope gate in P01-P05; feature flags/kill switches; disable enterprise-only agents/routes in MVP builds; scope-lock tests green in full suite | Product | OPEN (CF-05/06) |
| RISK-P00-05 | Evidence incomplete / unpushed baseline (ahead 4) | High | Untrustworthy gate, unreproducible results | **RESOLVED 2026-08-12** - baseline `3ad6bca` pushed (0/0); canonical docs + pack SHA-256 re-verified; evidence files immutable | QA/Release | RESOLVED |
| RISK-P00-06 | External API/model/standard drift (Gmail, LLM, MCP, OAuth) | High | Connector regressions | Version pinning, compatibility tests, owner, kill switch | Integration/AI | OPEN |
| RISK-P00-07 | No production credentials/env; deploy target unknown | High | Cannot validate runtime, release blocked | BQ-02 gate; approved environment provisioning before P19 | Platform/Release | OPEN - blocking |
| RISK-P00-08 | Compliance claims without legal review (GDPR, DPDP, FERPA, COPPA, EU AI Act) | High | Legal exposure | Professional legal review before any claim; no self-claimed compliance in P00 | Legal/Privacy | OPEN |
| RISK-P00-09 | Gmail draft-only / approval contract not verified | High | Unauthorized consequential action | Draft-only enforcement test, payload-bound expiring approval, idempotency tests in P13 | Security/AI | OPEN |
| RISK-P00-10 | MVP scope expansion pressure (enterprise features already in repo) | High | Delay/complexity | Strict scope gate at every phase; explicit NO-GO on out-of-scope code promotion | Product | OPEN |
| RISK-P00-11 | Prettier `format:check` FAIL on 5 committed files (sdk/typescript/src/types.ts, SECURITY.md, testing/accessibility x2, testing/integration/test-containers.ts) - CI `lint-typecheck` job would be red | Medium | CI red; style drift accumulates | Run `pnpm format` on a PR to auto-fix; add prettier check to local pre-push; re-run `format:check` | Web/QA | OPEN (2026-08-12) |
| RISK-P00-12 | CI-scope ruff FAIL (18 errors, UP007 style) on packages/python-common + apps/ai-service - CI `python-checks` job would be red | Medium | CI red; python lint drift | `ruff check --fix` those two trees on a PR; add ruff to pre-commit; re-run | Backend/QA | OPEN (2026-08-12) |
| RISK-P00-13 | Coverage claim "100%" in AGENTS.md vs measured 94% (641 missing lines; lowest: webhook_service 64%, middleware/tenant 68%, admin_console 72%, sso 74%, retention 79%) | Medium | False assurance; untested error paths (webhooks, tenant isolation) | Retire 100% claim; add coverage gates per-file (target >=90% excluding migrations); close top offenders in P11-P14 | QA | OPEN (2026-08-12) |
| RISK-P00-14 | External-standard drift since P00 snapshot (OWASP LLM Top 10 2026, EU AI Act high-risk delay, DPDP Rules 2025-11-13, COPPA fully in force 2026-04-22, Gmail quota model 2026-05-01, GitHub user tokens, SLSA v1.2 Source Track, SSDF v1.2 draft) | High | Outdated compliance/security design if standards not re-applied | ★ rows in 01 §3 web-verified 2026-08-16; re-verify at every phase start; legal review before claims (P13) | Legal/Security/Platform | OPEN (2026-08-16) |
| RISK-P00-15 | Baseline drift + uncommitted P06/P07 work (HEAD moved `3ad6bca`→`2f12d94`; migrations 0003–0006, erasure/export/provenance services, schema fields uncommitted) | Medium | P00 evidence misread as current HEAD truth; mixed-tree evidence | P00 pin `3ad6bca` stays immutable; current-tree changes P06/P07-owned; full-suite re-run at P07 gate; collection verified 2335 @ HEAD (2026-08-16) | Phase owner/Platform | OPEN (2026-08-16) |
| RISK-P00-NEW-01 | **Approval gate inert** — `has_approval=False` hardcoded in send paths (resume submission, job application). Approval flow exists in UI (ApprovalCard) but backend never enforces it. | **Critical** | **Release blocker for all send paths** — any automated action bypasses human approval | Wire approval middleware into send routes; make `has_approval` configurable per-endpoint; gate P11 handoff | Product/Security | **OPEN — release blocker** |
| RISK-P00-NEW-02 | **RLS covers 4/36 tables, GUC app.tenant_id never SET** — cross-tenant isolation relies entirely on app-level workspace filtering; no database-enforced tenant boundary on 32/36 tables | **Critical** | Data leakage across tenants if app-level filter has a bug; compliance failure | Expand RLS to all multi-tenant tables; SET app.tenant_id via TenantMiddleware; P07 must prove coverage | Platform/Security | **OPEN — security blocker** |
| RISK-P00-NEW-03 | **3 middleware layers exist but NOT MOUNTED** — IP allowlist (`ip_filter.py`), tenant (`tenant.py`), SCIM router — all present in code but never registered in `main.py` | **High** | IP filtering, tenant isolation, SCIM provisioning are dead code | Mount middleware in `main.py`; add startup assertions; verify in integration tests | Platform | **OPEN** |
| RISK-P00-NEW-04 | **7 frontend pages use hardcoded mock data** — pages exist but return static JSON instead of calling the typed API client | **Medium** | User sees stale/fake data; no backend integration proof | Wire remaining 7 pages to real API; remove mock data imports | Frontend | **OPEN** |
| RISK-P00-NEW-05 | **Dual migration systems** — Alembic (0001–0006) and custom runner (0002–0007) coexist with overlapping scope | **Medium** | Migration conflicts, double-applied schema changes, unclear source of truth | Consolidate to single Alembic system; deprecate runner; document which is canonical | Backend/Platform | **OPEN** |

## 2. Decisions

| ID | Decision | Status | Owner | Date |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------- | ---------- |
| DEC-P00-01 | Deliverables live under `docs/phases/mvp-p00/` | APPROVED (user) | Phase owner | 2026-08-06 |
| DEC-P00-02 | Repo layout (FastAPI-only backend, ADR-001/009) governs over prompt skeleton dirs | OPEN - confirm P05 | Enterprise Architect | - |
| DEC-P00-03 | INT-01 (Universal gatekeeper) MISSING - user supplied INT-02 (`vaeloom-mvp-e2e-enterprise-hardened.md`, hash-verified) as the governing authority for MVP execution | APPROVED (DEC-P00-06) | User/Phase owner | 2026-08-06 |
| DEC-P00-04 | Measured evidence (2026-08-06 run) outranks stale docs claims (AGENTS.md 1626, IMPLEMENTATION-CHECKLIST complete) | APPROVED | Phase owner | 2026-08-06 |
| DEC-P00-05 | MVP verdict per honest evidence - NOT a rubber-stamp GO | APPROVED (user) | Phase owner | 2026-08-06 |
| DEC-P00-06 | User supplied INT-02 as governing authority (INT-01 not found); INT-02 §0.2 authority order + §2/§5/§6/§7/§8/§16 bindings now apply to MVP | APPROVED (user) | Phase owner | 2026-08-06 |
| DEC-P00-07 | Full re-run 2026-08-12 @ `3ad6bca` (user-approved scope): fresh evidence supersedes earlier measured numbers wherever they differ; fixes limited to P00-owned blockers | APPROVED (user) | Phase owner | 2026-08-12 |
| DEC-P00-08 | Completion pass 2026-08-12: docs-only closure of remaining P00 prompt items (§10 completeness, §23 EVD table, future-readiness backlog, DoR/DoD, §30 response, gate re-score) — plan at `.agents/plans/completed/mvp-p00-completion-2026-08-12.md`, user-approved "proceed" | APPROVED (user) | Phase owner | 2026-08-12 |
| DEC-P00-09 | Zero-trust re-audit 2026-08-16: P00 docs + standards overlay re-verified against current repo (HEAD `2f12d94`) and web-researched standards; no source changes; P00 pin `3ad6bca` remains the immutable evidence baseline | APPROVED (phase owner; user notified) | Phase owner | 2026-08-16 |

## 3. Assumptions (all blocked/reversible until approved)

| ID | Assumption | Blocked? | Reversible? | Owner | Approval needed |
| ------ | --------------------------------------------------------------------- | -------- | ----------- | ---------------- | ---------------- |
| ASP-01 | Launch region + min. age + entity set (BQ-03/04) | YES | - | Legal/Product | BQ-03/04 gate |
| ASP-02 | Team, budget, cohort, ship window (BQ-05) | YES | - | Founder | P04 |
| ASP-03 | Accountable approver + backup (BQ-01) | YES | - | Founder/PM | P01 gate |
| ASP-04 | Deploy target / environment / credentials (BQ-02) | YES | - | Platform | P19 |
| ASP-05 | Gmail draft-only + approved job submission contract stays as designed | NO | Yes | Product/Security | P05 confirmation |

## 4. Blocking questions status (prompt §8)

| ID | Question | Status |
| ----- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| BQ-01 | Accountable approver + backup | **RESOLVED 2026-08-07 - USER (sole approver, no backup named yet)** |
| BQ-02 | Repo version / environment / evidence baseline | Repo pinned (`3ad6bca`, pushed to origin 0/0 verified 2026-08-12); production environments UNKNOWN - deferred to P19 (ASP-04) |
| BQ-03 | Entities, ages, regions, use cases | **RESOLVED 2026-08-07 - India launch, min age 18, individual job seekers** |
| BQ-04 | Launch region + min age | **RESOLVED 2026-08-07 - India, 18+** |
| BQ-05 | Team/budget/cohort/window | **RESOLVED 2026-08-07 - founder-led team, budget TBD, closed invite-only cohort, no ship deadline** |
| BQ-06 | Canonical vs superseded sources | RESOLVED for in-repo docs (see 01-source-register) |

## 5. Open unknowns

| ID | Unknown | Category | Blocks? | Due |
| ------ | ---------------------------------------------- | -------- | -------------- | --------- |
| UNK-01 | Where is INT-01 governing file? | Input | Gate signature | Immediate |
| UNK-02 | Production DB/object-storage/queue credentials | Access | GO | P19 |
| UNK-03 | LLM/Gmail/job-board provider accounts | Access | GO | P12/P13 |
| UNK-04 | Intended deploy platform (PaaS target) | Decision | GO | P05 |
| UNK-05 | Real user/data cohort for validation | Data | GO | P02/P03 |
