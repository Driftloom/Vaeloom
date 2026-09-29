# ENT-P14 Risk / Decision / Assumption / Traceability Registers

**Phase:** ENT-P14 — Testing and Quality Engineering  
**Version:** 1.0.0  
**Owner:** QA Lead  
**Date:** 2026-09-29

---

## Risk Register

| ID              | Risk                                                          | Severity | Likelihood | Impact | Mitigation                                                                | Owner          | Status             | Expiry  |
| --------------- | ------------------------------------------------------------- | -------- | ---------- | ------ | ------------------------------------------------------------------------- | -------------- | ------------------ | ------- |
| RISK-ENT-P14-01 | 264 new tests specified but not all implemented in this phase | MEDIUM   | HIGH       | MEDIUM | Tracked in defect register; implementation continues in parallel          | QA Lead        | OPEN — IN PROGRESS | ENT-P15 |
| RISK-ENT-P14-02 | Prompt injection detection depth (inherited from ENT-P13)     | HIGH     | MEDIUM     | HIGH   | Enhanced classifier specified in DEF-P14-01; XML fencing active           | AI Safety Lead | OPEN — TRACKED     | ENT-P15 |
| RISK-ENT-P14-03 | Trivy HIGH CVE in base image (inherited from ENT-P13)         | HIGH     | MEDIUM     | HIGH   | Dev phase only; base image pin scheduled ENT-P16                          | DevOps         | OPEN — TRACKED     | ENT-P16 |
| RISK-ENT-P14-04 | Test determinism under -n auto (16 workers)                   | MEDIUM   | LOW        | MEDIUM | Resolved: sorted(PUBLIC_PATHS); stable under -n 4; -n auto needs 32GB RAM | QA Lead        | MITIGATED          | Ongoing |
| RISK-ENT-P14-05 | Coverage regression from future feature additions             | LOW      | MEDIUM     | LOW    | `--fail-under=94` gate in CI; security-path coverage 100% enforced        | QA Lead        | MITIGATED          | Ongoing |

---

## Decision Register

| ID             | Decision                                                              | Rationale                                                                              | Alternatives                                        | Owner           | Date       | Impact               |
| -------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------- | ---------- | -------------------- |
| DEC-ENT-P14-01 | de-duplicated test count = 731 (not 3640)                             | Middleware/test_csrf duplicates security/test_csrf; de-dup per F-02 finding 2026-08-22 | Report 3640 (rejected: misleading)                  | QA Lead         | 2026-09-29 | Test count baseline  |
| DEC-ENT-P14-02 | Total test count includes all layers: 1022 (backend + frontend + E2E) | Complete quality picture requires all layers                                           | Backend-only count (rejected: incomplete)           | QA Lead         | 2026-09-29 | Quality dashboard    |
| DEC-ENT-P14-03 | `--dist loadfile` groups tests by file for xdist stability            | Prevents DB isolation issues; stable under 4 workers                                   | `--dist worksteal` (rejected: less predictable)     | QA Lead         | 2026-09-29 | CI configuration     |
| DEC-ENT-P14-04 | Loose assertion ban (`in (200, 201, ...)`) enforced via Semgrep       | Zero-tolerance policy per Honesty Mandate                                              | Allow with review (rejected: honeypot risk)         | AppSec Engineer | 2026-09-29 | All test files       |
| DEC-ENT-P14-05 | Flaky test quarantine max 5 days                                      | Forces root cause fix; prevents permanent skip rot                                     | 30-day quarantine (rejected: too lenient)           | QA Lead         | 2026-09-29 | Test governance      |
| DEC-ENT-P14-06 | Live integration suites use ZERO mocks                                | Enterprise Honesty Mandate; INV-QA-02                                                  | Allow mock fallback (rejected: masks real failures) | CISO + QA Lead  | 2026-09-29 | `tests/integration/` |

---

## Assumption Register

| ID             | Assumption                                                               | Basis                                                           | Risk if wrong                       | Owner                | Review date |
| -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------- | -------------------- | ----------- |
| ASM-ENT-P14-01 | SQLite NullPool per-test DB provides sufficient isolation for unit tests | Verified: no cross-test state leakage observed in 731 test runs | Test contamination; false positives | QA Lead              | 2026-10-31  |
| ASM-ENT-P14-02 | 4 xdist workers is optimal for memory/stability tradeoff                 | 4 workers ≈ 1.2GB; 16 workers ≈ 4-5GB (noted in AGENTS.md)      | OOM on constrained CI runners       | QA Lead              | Ongoing     |
| ASM-ENT-P14-03 | Playwright headless Chromium tests are stable on local dev (port 3000)   | 46/46 E2E passing; no flakiness observed                        | E2E flake rate increase             | Frontend Lead        | 2026-10-31  |
| ASM-ENT-P14-04 | TypeSafe AI Jev S1 latency ≤50ms p95 will hold in production             | 32ms measured in dev; production may differ under load          | SLO violation at scale              | Performance Engineer | ENT-P15     |

---

## Traceability Register

| Req ID      | Requirement                                           | Design                            | Implementation                | Test                   | Evidence         | Risk    | Handoff            |
| ----------- | ----------------------------------------------------- | --------------------------------- | ----------------------------- | ---------------------- | ---------------- | ------- | ------------------ |
| ENT-P14-R01 | Test strategy and governance                          | 7-layer pyramid; ownership matrix | `01-test-strategy.md`         | All test suites        | EVD-001..003     | RISK-01 | ENT-P15 entry      |
| ENT-P14-R02 | Evidence-only claims                                  | INV-QA-01..05                     | Exact assertions; -fail-under | Semgrep detection      | EVD-020          | —       | ENT-P15 entry      |
| ENT-P14-R03 | Security/privacy/AI tests                             | Negative controls; INV-SEC-01..05 | `tests/security/` 334 tests   | Negative control table | EVD-018..019     | RISK-02 | ENT-P15 entry      |
| ENT-P14-R04 | Validation covers normal, negative, boundary, failure | Test pyramid; RTM                 | All 7 layers                  | 1022/1022 pass         | EVD-014..017     | RISK-04 | ENT-P15 entry      |
| ENT-P14-R05 | Operations: ownership, telemetry, rollback            | Defect/waiver register            | 8 defects; 4 waivers          | Gate evidence          | EVD-008..010     | RISK-03 | ENT-P15 entry      |
| ENT-P14-R06 | Data lineage and AI lineage                           | RTM + test data strategy          | Synthetic data; no PII        | Coverage + gate        | EVD-004..007     | —       | ENT-P15 entry      |
| ENT-P14-R07 | Traceability                                          | RTM 27 requirements traced        | All DELs cross-referenced     | Gate scorecard         | EVD-004, EVD-007 | —       | ENT-P15 entry      |
| ENT-P14-R08 | Gate score ≥95 + zero blockers                        | §28 gate protocol                 | Gate report                   | 97.3/100; 0 blockers   | EVD-011          | —       | ENT-P15 authorized |

---

_Registers v1.0.0 — QA Lead — 2026-09-29_
