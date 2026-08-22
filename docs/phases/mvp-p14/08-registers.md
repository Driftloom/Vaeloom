# MVP-P14 — 08. Registers

> **Phase:** MVP-P14 — Testing and Quality Engineering  
> **Date:** 2026-08-22 · **Baseline:** `a69d7d7` + P14

## Risk Register

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| RISK-P14-01 | Docs mistaken for runtime completion | Critical | False readiness | Require `pytest --collect-only` + single-test PASS per claim | QA | OPEN |
| RISK-P14-02 | Scope/permission/data assumed | High | Leak/loss | 7 EXCs owned/expiring P14/P15 (RLS 5 gap, CSRF single, sanitize, injection JSON-only) | Sec/Arch | OPEN |
| RISK-P14-03 | External API/model/standard drift | High | Regression (MCP 2026-07-28 stateless, OWASP ASI01-10 v2.01 Jun2026, RFC9700) | Pin in `01-source-register` 13+19, verify via websearch ses_fda | Integration | OPEN |
| RISK-P14-04 | Evidence incomplete (94% not re-measured, WCAG not re-measured, perf not benched) | High | Untrustworthy gate | 5-step collect + 2 gdpr single PASS this phase; full `--cov` deferred to P15 | QA/Release | OPEN |
| RISK-P14-05 | Scope expansion (enterprise) | High | Delay | `enterprise_routes_enabled=false`, mocked `legacy packages` not deployed | Product | OPEN |

## Decision Register

| ID | Decision | Rationale | Alternatives | Owner | Date |
|---|---|---|---|---|---|
| DEC-P14-01 | Keep honest gate 84.4 + waiver (user chose Keep dual) | §28 strict 84.4 is FAILED <88; waiver 89 needs signature | Pure FAILED block P14 | QA + User waiver | 2026-08-22 |
| DEC-P14-02 | Expand GDPR 12→31 (user chose Expand) | Art.20 portability requires `consent_records`, `document_chunks`, `provider_keys` etc | Justify as cache (rejected per UX rights) | Privacy Eng | 2026-08-22 |
| DEC-P14-03 | Leave DPIA region open DRAFT (user chose) | Region TBD until launch decision; DPIA neutral until DPO | Pick EU/US/India now (rejected) | Privacy Eng | 2026-08-22 |
| DEC-P14-04 | Test env `tmp_path` NullPool SQLite representative, not PG | Fast, deterministic, 2555 collect in 12.91s; PG RLS verified via `0010/0019` migration code not runtime | Real PG per test (slow, 42 tables × 2555) | Platform/QA | 2026-08-22 |

## Assumption Register

| ID | Assumption | Risk if Wrong | Validation Plan | Status |
|---|---|---|---|---|
| ASM-P14-01 | 2555 collected stays deterministic after debug_test removal | Flaky xdist | Re-collect each gate + `sorted(PUBLIC_PATHS)` | ACTIVE |
| ASM-P14-02 | 31-table GDPR via workspace subquery covers all user-tied rows | Orphan rows in non-standard FK | Staging PG + `DELETE` + `SELECT` count check | ACTIVE |
| ASM-P14-03 | 2 quick gdpr tests + collects represent 233/2555 health | Full suite regresses | Run `-n 4` full suite in P15 before ship | ACTIVE |
| ASM-P14-04 | WCAG 2.2 AA still covered by P10 96/100 frontend (no re-measure) | a11y drift | Add `jest-axe` in P15 | ACTIVE |

## Exception Register

| ID | Exception | Owner | Controls | Approvers | Expiry | Monitoring | Prohibited |
|---|---|---|---|---|---|---|---|
| EXC-P14-01 | Coverage 94% not re-measured this phase (2 singles only) | QA | Collect 2555 green, 2 gdpr PASS | QA | P15 | `pytest --cov` before ship | Claim 94% as re-measured |
| EXC-P14-02 | WCAG 2.2 AA not re-measured (apps/web jest 37 but no axe) | A11y Spec | P10 96/100 prior | A11y | P15 | `testing/smoke` etc EMPTY | Claim AA |
| EXC-P14-03 | Perf p50/p95 not benched this phase | Perf Eng | Rate limiter + circuit breaker verified via code | Perf | P15 | `wrk/k6` | Claim scalable |
| EXC-P14-04 | `testing/smoke/, security/, chaos/, fuzz/, visual-regression/` EMPTY per AGENTS.md:87 | QA | Unit+integ exist (152 files), missing dirs are scope | QA | Post-MVP | Inventory | Claim full QA |

## Change Register

| ID | Change | Rationale | Impact | Reviewers | Migration | Tests | Rollback |
|---|---|---|---|---|---|---|---|
| CHG-P14-01 | JWT 32+ via conftest (carried P13 F-07) | Zero warning | 0 warnings on 2 runs | QA | N/A | 2 singles | Revert 27-char |
| CHG-P14-02 | GDPR 12→31 via services/gdpr.py (carried P13 F-09) | Art.20 | 31 ALLOWED, 31 USER_TABLES | Privacy | N/A | `test_export`/`test_delete` PASS | Revert 12 |
| CHG-P14-03 | RLS 37/42 fail-closed via 0019 (carried F-05) | Tenant isolation | Missing GUC=>0 rows | IAM | `downgrade 0019` | Collect | Add OR'' back |
| CHG-P14-04 | DPIA COMPLETE→DRAFT + Threat-Model BYOK assets (carried F-10/17) | Honest | Region TBD | Privacy/Sec | N/A | DPIA header | Revert |
| CHG-P14-05 | No new production code this phase (test-hardening only) | Bounded scope §13 | Additive only | QA Lead | N/A | Collect 2555 | N/A |

## Future-Readiness Backlog

| Idea | Evidence | Target Users | Dependencies | Security/Privacy | Cost | Validation Experiment | Adoption Trigger | Owner | Sunset |
|---|---|---|---|---|---|---|---|---|---|
| Collect determinism | 2555 verified | All | xdist | None | Low | Re-collect each gate | Always | QA | — |
| Perf benchmarks | Gap F-15 | Scale users | Perf env | Rate limiter | Medium | `wrk` p50/p95 | Pre-ship | Perf | Ship |
| WCAG AA re-measure | Gap | All | jest-axe | A11y | Low | `axe` scan | Pre-ship | A11y | Ship |
| LLM classifier for injection + ingestion scan | F-08 P14 | All | Agent RAG | Memory poisoning | Medium | PDF/EML red-team | Pre-prod | AI Safety | Prod |
