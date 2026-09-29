# ENT-P14 Source Register

**Phase:** ENT-P14 — Testing and Quality Engineering  
**Version:** 1.0.0  
**Owner:** QA Lead  
**Reviewer:** Application Security Engineer + Security Architect  
**Date:** 2026-09-29  
**Status:** ACTIVE

---

## Internal Sources (INT)

| ID     | Source                                                                             | Owner/Authority     | Use                                                                         | Location                       | Verified |
| ------ | ---------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------- | ------------------------------ | -------- |
| INT-01 | Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md                      | Vaeloom source team | Governing 32-section prompt; evidence, DoR/DoD, gate and remediation        | `specs/phase-contracts/`       | ✅       |
| INT-02 | ENT-P13 handoff + gate report                                                      | CISO                | Predecessor authorization baseline; security test expansion requirements    | `evidence/phases/ent/ent-p13/` | ✅       |
| INT-03 | `apps/api/tests/` — full test directory                                            | QA Lead             | 731-test baseline; security 404; live cognitive 31; RLS 5; E2E 46; unit 245 | Repository HEAD                | ✅       |
| INT-04 | `apps/api/src/api/` — full source tree                                             | Engineering         | Backend implementation; routes, services, middleware for contract testing   | Repository HEAD                | ✅       |
| INT-05 | `specs/api/openapi.yaml` — v0.2.0 (241 paths / 294 ops)                            | API Lead            | Contract test anchor; schema validation; regression baseline                | `specs/api/openapi.yaml`       | ✅       |
| INT-06 | `apps/api/tests/conftest.py` — `mock_llm` + `mock_connector_test` autouse fixtures | QA Lead             | Test harness; autouse fixture patterns; SQLite NullPool per-test DB         | `apps/api/tests/conftest.py`   | ✅       |
| INT-07 | `evidence/phases/ent/ent-p13/05-security-test-suite.md`                            | AppSec Engineer     | 124 new security test specifications for ENT-P14 implementation             | `evidence/phases/ent/ent-p13/` | ✅       |
| INT-08 | `.github/workflows/` — CI/CD pipeline definitions                                  | DevOps Lead         | Test automation; matrix strategies; coverage thresholds                     | `.github/workflows/`           | ✅       |
| INT-09 | `apps/web/` — Next.js source + `__tests__/` + `playwright.config.ts`               | Frontend Lead       | 96 web unit tests; 46 Playwright E2E; page coverage                         | Repository HEAD                | ✅       |
| INT-10 | `apps/api/pyproject.toml` — `addopts = "-n 4"`                                     | QA Lead             | pytest-xdist configuration; worker count; dist strategy                     | `apps/api/pyproject.toml`      | ✅       |

---

## External Sources (EXT)

| ID     | Standard/Source                          | Verified Snapshot | Applicability                | Required Use                                               |
| ------ | ---------------------------------------- | ----------------- | ---------------------------- | ---------------------------------------------------------- |
| EXT-01 | OWASP Testing Guide (WSTG) v4.2          | 2023              | All web application tests    | Test case catalog for auth, injection, config, session     |
| EXT-02 | OWASP Agentic Applications Top 10 — 2026 | 2026              | 28-agent test scenarios      | Goal hijack; tool misuse; identity abuse; memory poisoning |
| EXT-03 | OWASP LLM Applications Top 10 — 2025     | 2025              | System 1 + System 2 AI tests | Prompt injection; unsafe output; excessive agency          |
| EXT-04 | NIST AI RMF Measure function             | Official current  | AI quality/eval tests        | Evaluation criteria; bias/fairness; human oversight        |
| EXT-05 | WCAG 2.2 — W3C Recommendation            | 2023-10-05        | Frontend accessibility tests | Level AA test checklist; axe-core integration              |
| EXT-06 | pytest-xdist documentation               | Current           | Parallel test execution      | `--dist loadfile`; `-n auto`; worker isolation             |
| EXT-07 | Playwright documentation — v1.x          | Current           | E2E browser automation       | Page object pattern; trace collection; retry policy        |
| EXT-08 | `pytest-cov` / coverage.py               | Current           | Coverage measurement         | `--cov=api`; `--cov-report=term`; branch coverage          |
| EXT-09 | OpenAPI Specification 3.2.0              | 2024              | Contract tests               | Schema validation; response shape verification             |
| EXT-10 | SLSA v1.2                                | 2024              | Test evidence provenance     | Reproducible test artifacts; artifact integrity            |

---

_Register version: 1.0.0 — QA Lead — 2026-09-29_
