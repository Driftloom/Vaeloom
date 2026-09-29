# ENT-P14 Architecture Framing — Testing and Quality Engineering

**Phase:** ENT-P14 — Testing and Quality Engineering  
**Version:** 1.0.0  
**Owner:** QA Lead  
**Reviewer:** Security Architect + Performance Engineer  
**Date:** 2026-09-29

---

## 1. Quality Architecture Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     VAELOOM QUALITY ARCHITECTURE                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   CONTINUOUS INTEGRATION GATE                    │   │
│  │  PR Push: Lint → SAST → Unit → Security → Coverage → E2E        │   │
│  │  Main merge: Integration → Performance → Release gate            │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│  ┌────────────────────────────▼────────────────────────────────────┐   │
│  │                     TEST ORCHESTRATION                           │   │
│  │  pytest-xdist (-n 4 default; -n auto fast; serial reliable)     │   │
│  │  Playwright (headless Chromium; trace-on-retry)                  │   │
│  │  Vitest (component; hook; schema)                                │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│  ┌────────────────────────────▼────────────────────────────────────┐   │
│  │               TEST DATA ISOLATION LAYER                          │   │
│  │  SQLite NullPool (per-test; tmp_path)                            │   │
│  │  mock_llm + mock_connector_test autouse fixtures                 │   │
│  │  Synthetic/redacted datasets (no real PII in CI)                 │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│  ┌────────────────────────────▼────────────────────────────────────┐   │
│  │                 LIVE INTEGRATION LAYER                           │   │
│  │  Real PostgreSQL 16.4 + migration 0061                           │   │
│  │  Real MinIO (vaeloom-test-bucket)                                │   │
│  │  Real TypeSafe AI Jev S1 + Ollama Cloud Gemma 4 31B             │   │
│  │  ZERO mocks in integration/ and adversarial/                     │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
│                               │                                         │
│  ┌────────────────────────────▼────────────────────────────────────┐   │
│  │              EVIDENCE AND TRACEABILITY LAYER                     │   │
│  │  Immutable test reports → S3 WORM                                │   │
│  │  Coverage deltas tracked per phase                               │   │
│  │  Defect register → waiver → gate scorecard                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Five Quality Invariants

### INV-QA-01: Exact Assertion Mandate

> **Every test must assert the exact expected status code and response body
> shape. Broad status checks like
> `assert res.status_code in (200, 201, 401, 403)` are banned. Violating tests
> are blocked from merge.**

**Enforcement:** ESLint security rule + Semgrep custom rule detect broad
assertions; pre-commit hook blocks.

### INV-QA-02: Zero Mock in Live Suites

> **`tests/integration/` and `tests/adversarial/` suites must use real services.
> No mock_llm, no mock_connector_test, no httpretty in these directories.
> Violations are a CRITICAL gate blocker.**

**Enforcement:** `conftest.py` at `tests/integration/` directory level disables
global autouse mocks.

### INV-QA-03: Negative Control for Every Security Flow

> **Every security-sensitive endpoint must have at least one test that proves
> the protection works by confirming the expected DENY response (401, 403, 422)
> on a violation attempt — not just a successful pass.**

**Enforcement:** Security suite design checklist; AppSec Engineer reviews every
new security test PR.

### INV-QA-04: Test Failure Stays Visible

> **No test may be silently skipped to improve pass rate. `@pytest.mark.skip`
> requires `reason=` with a JIRA/GitHub issue ID and maximum 5-day expiry.
> Quarantined tests appear in the defect register.**

**Enforcement:** Pre-commit hook validates all `@pytest.mark.skip` have
`reason=` and issue ID.

### INV-QA-05: Coverage Regression Blocked

> **Backend line coverage must not drop below 94%. Security-critical path
> coverage must remain 100%. Any PR that causes a coverage drop fails the CI
> gate.**

**Enforcement:** `pytest-cov --fail-under=94` in CI; security-path coverage
reported separately.

---

## 3. Test Data Strategy

| Data Category        | In CI                        | In Live Integration            | Governance                            |
| -------------------- | ---------------------------- | ------------------------------ | ------------------------------------- |
| User PII             | Synthetic only               | Synthetic realistic data       | Never real PII in test fixtures       |
| Memory content       | Template-generated           | Synthetic career scenarios     | No real user memories                 |
| Resume content       | Template-based               | Synthetic resume blobs         | No real personal documents            |
| API keys             | Test-only keys (short-lived) | Infisical-managed (test vault) | Separate from production vault        |
| LLM responses (unit) | mock_llm fixture             | Real Jev S1 / Gemma 4          | No golden-file coupling in unit tests |

---

## 4. Quality Gate Integration

The §28 quality gate is the terminal control gate that verifies:

1. **Requirement coverage** — RTM shows every FR and NFR has ≥1 test
2. **Pass rate** — 100% required; 0 failures; 0 unexplained skips
3. **Coverage** — Backend ≥94%; security-critical 100%
4. **Defects** — No critical/high unmitigated defects
5. **Waivers** — All waivers owned, time-bounded, and not expired
6. **Evidence** — All EVD items link to immutable artifacts

---

_Architecture framing v1.0.0 — QA Lead — 2026-09-29_
