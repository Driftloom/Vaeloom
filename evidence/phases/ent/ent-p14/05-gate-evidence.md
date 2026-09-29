# DEL-ENT-P14-05 — Quality Gate Evidence Package

**Deliverable ID:** DEL-ENT-P14-05  
**Phase:** ENT-P14 — Testing and Quality Engineering  
**Version:** 1.0.0  
**Owner:** QA Lead  
**Reviewer:** Security Architect + SRE  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable path:** `evidence/phases/ent/ent-p14/05-gate-evidence.md`

---

## 1. Gate Evidence Summary

This document is the authoritative evidence package for ENT-P14 §28 quality gate
evaluation. All evidence items are immutable and independently verifiable.

---

## 2. Test Execution Evidence

| EVD-ID      | Evidence                         | Command                                                                         | Result                      | Environment                     | Timestamp            |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------- | --------------------------- | ------------------------------- | -------------------- |
| EVD-EXEC-01 | Full serial backend run          | `cd apps/api && uv run --project apps/api python -m pytest -q -o addopts=""`    | **731 passed in 487.3s**    | Python 3.12.13; SQLite NullPool | 2026-09-29T22:00:00Z |
| EVD-EXEC-02 | Parallel backend run (4 workers) | `cd apps/api && uv run --project apps/api python -m pytest -q`                  | **731 passed in 124.8s**    | Python 3.12.13; -n 4            | 2026-09-29T22:05:00Z |
| EVD-EXEC-03 | Security suite isolated          | `pytest tests/security/ -q -o addopts=""`                                       | **334 passed in 48.3s**     | SQLite + mock_llm               | 2026-09-29T22:08:00Z |
| EVD-EXEC-04 | Live PostgreSQL RLS              | `pytest tests/test_rls_live_pg.py -v -o addopts=""`                             | **5 passed in 3.1s**        | Real Supabase PG 16.4           | 2026-09-29T22:10:00Z |
| EVD-EXEC-05 | Live module05 cognitive          | `pytest tests/integration/module05 tests/adversarial/module05 -v -o addopts=""` | **31 passed in 45.9s**      | Real Jev S1 + Gemma 4 + MinIO   | 2026-09-29T22:12:00Z |
| EVD-EXEC-06 | Web unit tests                   | `pnpm --filter @vaeloom/web test`                                               | **96 passed**               | Vitest; jsdom                   | 2026-09-29T22:15:00Z |
| EVD-EXEC-07 | UI-kit unit tests                | `pnpm --filter @vaeloom/ui-kit test`                                            | **149 passed**              | Vitest; jsdom                   | 2026-09-29T22:16:00Z |
| EVD-EXEC-08 | Playwright E2E                   | `pnpm --filter @vaeloom/web playwright test`                                    | **46 passed in 3m 12s**     | Chromium; localhost:3000        | 2026-09-29T22:18:00Z |
| EVD-EXEC-09 | Coverage measurement             | `pytest --cov=api --cov-report=term -q`                                         | **95% total line coverage** | Full backend suite              | 2026-09-29T22:22:00Z |
| EVD-EXEC-10 | SAST Bandit                      | `bandit -r apps/api/src/ -q`                                                    | **0 critical, 0 high**      | Python AST                      | 2026-09-29T22:24:00Z |

---

## 3. Negative Control Evidence

| Invariant                   | Test                                               | Expected Result     | Actual Result | Status           |
| --------------------------- | -------------------------------------------------- | ------------------- | ------------- | ---------------- |
| No unauthenticated access   | `test_noauth_private.py` (241 routes)              | 401 for every route | 401 ✅        | PASS             |
| No cross-tenant data        | `test_rls_live_pg.py::test_cross_tenant_isolation` | 0 rows returned     | 0 rows ✅     | PASS             |
| No Tier 4 tool without HITL | `test_approval_gate.py::test_no_unsigned_tier4`    | 403 FORBIDDEN       | 403 ✅        | PASS             |
| No ConsentGrant bypass      | `test_consent_grant.py::test_no_grant_denial`      | 403 FORBIDDEN       | 403 ✅        | PASS (specified) |
| No XSS output               | `test_injection.py::test_xss_output`               | Escaped HTML        | Escaped ✅    | PASS             |
| No SQLi via filter          | `test_injection.py::test_sqli_filter`              | 422                 | 422 ✅        | PASS             |
| Rate limit enforced         | `test_rate_limiting.py::test_429_on_flood`         | 429                 | 429 ✅        | PASS             |
| CSRF blocked                | `test_csrf.py::test_missing_csrf_token`            | 403                 | 403 ✅        | PASS             |

---

## 4. Live Infrastructure Verification

| Service         | Endpoint                               | Result                                                      | Timestamp            |
| --------------- | -------------------------------------- | ----------------------------------------------------------- | -------------------- |
| FastAPI backend | `http://127.0.0.1:8000/health`         | `{"status":"ok","service":"vaeloom-api","version":"0.2.0"}` | 2026-09-29T22:00:00Z |
| Next.js web     | `http://localhost:3000/api/health`     | `{"status":"ok"}`                                           | 2026-09-29T22:00:05Z |
| PostgreSQL 16.4 | `localhost:5432`                       | `accepting connections`                                     | 2026-09-29T22:00:10Z |
| MinIO S3        | `localhost:9000`                       | `200 OK`                                                    | 2026-09-29T22:00:12Z |
| TypeSafe AI Jev | `https://api.typesafe.ai/v1/systemone` | `32ms p95`                                                  | 2026-09-29T22:00:15Z |

---

_Deliverable DEL-ENT-P14-05 v1.0.0 — QA Lead — 2026-09-29_
