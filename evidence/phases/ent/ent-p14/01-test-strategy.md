# DEL-ENT-P14-01 — Enterprise Test Strategy & Unified Test Suite Architecture

**Deliverable ID:** DEL-ENT-P14-01  
**Phase:** ENT-P14 — Testing and Quality Engineering  
**Version:** 1.0.0  
**Owner:** QA Lead  
**Reviewer:** Application Security Engineer + Performance Engineer  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable path:** `evidence/phases/ent/ent-p14/01-test-strategy.md`

---

## 1. Test Strategy Vision

Vaeloom's enterprise test strategy implements a **7-layer test pyramid** that
validates correctness, isolation, security, AI safety, performance, and
compliance from unit-level through full live integration. Every layer is
deterministic, evidence-producing, and tied to a requirement.

**Non-negotiable invariants for all tests:**

1. No `assert res.status_code in (200, 201, 401, 403)` loose assertions — exact
   status required
2. No mocks in live integration suites (`tests/integration/`,
   `tests/adversarial/`)
3. No skipping failures to increase pass rate
4. Negative controls mandatory for every security-sensitive flow
5. Test failure stays visible in evidence bundle — never masked

---

## 2. Test Pyramid Architecture

```
                        ┌───────────────────────┐
                        │   LIVE INTEGRATION    │  (12 tests)
                        │  Real Jev S1 + Gemma  │
                        │  Real S3 + real PG    │
                        └───────────┬───────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │   PLAYWRIGHT E2E BROWSER      │  (46 tests)
                    │   Full user flow automation   │
                    └───────────────┬───────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          │         SECURITY / ADVERSARIAL SUITE              │  (528 tests)
          │  Auth; RLS; injection; HITL; consent; red team    │
          └─────────────────────────┬─────────────────────────┘
                                    │
      ┌──────────────────────────── ┴ ────────────────────────────┐
      │              CONTRACT / API SCHEMA TESTS                  │  (241 paths)
      │    OpenAPI 3.2.0 schema validation; response shapes       │
      └──────────────────────────── ┬ ────────────────────────────┘
                                    │
   ┌──────────────────────────────── ┴ ──────────────────────────────────┐
   │                FUNCTIONAL / INTEGRATION TESTS                       │  (280+ tests)
   │   Route-level; service-level; DB; agents; memory; billing; plugins  │
   └──────────────────────────────── ┬ ──────────────────────────────────┘
                                     │
 ┌──────────────────────────────────── ┴ ──────────────────────────────────────┐
 │                     UNIT TESTS (Backend + Frontend)                         │  (245 tests)
 │   Pure function; service; schema validation; tool call; component render    │
 └──────────────────────────────────── ┴ ──────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┴─────────────────────────────────────────┐
│                         STATIC ANALYSIS (SAST/SCA/Lint)                       │  (continuous)
│   Bandit; Semgrep; ESLint; pnpm audit; uv audit; Trivy                        │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Test Suite Inventory (Complete ENT-P14 Target)

### 3.1 Backend Tests (`apps/api/tests/`)

| Suite Path                                         | Tests (Baseline) | Tests (ENT-P14 Target) | Domain                                      |
| -------------------------------------------------- | ---------------- | ---------------------- | ------------------------------------------- |
| `tests/security/test_auth.py`                      | 38               | 38                     | JWT; OIDC callback; token refresh           |
| `tests/security/test_csrf.py`                      | 22               | 22                     | CSRF enforcement; SameSite                  |
| `tests/security/test_rate_limiting.py`             | 18               | 18                     | Sliding window; Retry-After                 |
| `tests/security/test_cors.py`                      | 15               | 15                     | Origin whitelist; preflight                 |
| `tests/security/test_noauth_private.py`            | 21               | 21                     | 241 private routes → 401                    |
| `tests/security/test_rls_isolation.py`             | 48               | 48                     | Cross-tenant; workspace scope               |
| `tests/security/test_tenant_isolation.py`          | 41               | 41                     | Tenant ID derivation; GUC                   |
| `tests/security/test_injection.py`                 | 33               | 33                     | SQLi; XSS; command injection                |
| `tests/security/test_mcp_sandbox.py`               | 28               | 28                     | Plugin scope; path traversal                |
| `tests/security/test_approval_gate.py`             | 24               | 24                     | Tier 4 HMAC; replay; TTL                    |
| `tests/security/test_security_headers.py`          | 31               | 31                     | CSP; HSTS; nosniff; frame                   |
| `tests/security/test_secrets.py`                   | 15               | 15                     | validate_settings; default secret fail-fast |
| `tests/security/test_crypto_erasure.py`            | 0                | **12**                 | DEK rotation; inaccessibility proof         |
| `tests/security/test_consent_grant.py`             | 0                | **18**                 | ConsentGrant enforcement; scope             |
| `tests/security/test_iam_rbac.py`                  | 0                | **22**                 | RBAC matrix; escalation denial              |
| `tests/security/test_scim_provisioning.py`         | 0                | **14**                 | SCIM CRUD; JIT; deprovisioning              |
| `tests/security/test_break_glass.py`               | 0                | **10**                 | Dual-approval; TTL; audit log               |
| `tests/security/test_privacy_rights.py`            | 0                | **16**                 | Portability; erasure; restriction           |
| `tests/security/test_prompt_injection_enhanced.py` | 0                | **20**                 | Goal hijacking; XML fence bypass            |
| `tests/security/test_multi_region_residency.py`    | 0                | **12**                 | Cell routing; cross-region denial           |
| `tests/integration/module05/`                      | 22               | 22                     | Live cognitive; real S3; real Jev/Gemma     |
| `tests/adversarial/module05/`                      | 9                | 9                      | Red team; privilege escalation              |
| `tests/test_rls_live_pg.py`                        | 5                | 5                      | Real PostgreSQL RLS                         |
| `tests/test_module05_*.py`                         | 9                | 9                      | Core regression smoke                       |
| `tests/functional/` (new)                          | 0                | **80**                 | Route-level functional; agent; billing      |
| `tests/contract/` (new)                            | 0                | **40**                 | OpenAPI schema validation                   |
| **BACKEND TOTAL**                                  | **379**          | **~583**               |                                             |

### 3.2 Frontend Tests (`apps/web/`)

| Suite                          | Tests (Baseline) | Tests (ENT-P14 Target) | Domain                          |
| ------------------------------ | ---------------- | ---------------------- | ------------------------------- |
| Web unit tests (`__tests__/`)  | 96               | 96                     | Component render; hook behavior |
| Playwright E2E (`playwright/`) | 46               | **60**                 | User flows; auth; navigation    |
| Accessibility (axe-core)       | 0                | **20**                 | WCAG 2.2 Level AA automated     |
| **FRONTEND TOTAL**             | **142**          | **~176**               |                                 |

### 3.3 UI-Kit Tests (`packages/ui-kit/`)

| Suite      | Tests | Status                 |
| ---------- | ----- | ---------------------- |
| Unit tests | 149   | ✅ Baseline maintained |

---

## 4. Test Environment Specification

### 4.1 Unit / Integration (CI)

```yaml
environment:
  python: '3.12.13'
  db: 'SQLite (NullPool; per-test; tmp_path)'
  llm: mock_llm autouse fixture
  connector: mock_connector_test autouse fixture
  runner: 'uv run --project apps/api python -m pytest'
  workers: '-n 4 --dist loadfile'
  addopts: '-n 4' # pyproject.toml default
```

### 4.2 Live Integration

```yaml
environment:
  python: '3.12.13'
  db: 'Real Supabase PostgreSQL 16.4 (migration 0061 HEAD)'
  s3: 'MinIO vaeloom-test-bucket (port 9000)'
  llm_s1: 'TypeSafe AI Jev (https://api.typesafe.ai/v1/systemone)'
  llm_s2: 'Ollama Cloud Gemma 4 31B (https://ollama.com/v1)'
  runner: "uv run --project apps/api python -m pytest -o addopts=''"
  mocks: ZERO
```

### 4.3 E2E Browser

```yaml
environment:
  browser: 'Chromium (Playwright)'
  frontend: 'http://localhost:3000 (Next.js dev server)'
  backend: 'http://127.0.0.1:8000 (Uvicorn)'
  trace: 'on-first-retry'
  reporter: 'html'
```

---

## 5. Test Governance

### 5.1 Flaky Test Policy

- Flaky tests are quarantined in `.pytest.ini` `[flaky]` section within 24h of
  detection
- Quarantine waiver requires: symptom, root cause hypothesis, owner, expiry (max
  5 days)
- Zero tolerance for silent skips — `@pytest.mark.skip` requires `reason=` and
  issue ID

### 5.2 Coverage Targets

| Layer                       | Target | Current | Gap              |
| --------------------------- | ------ | ------- | ---------------- |
| Backend line coverage       | ≥94%   | 94%     | 0 — maintain     |
| Backend branch coverage     | ≥85%   | 87%     | +2% above target |
| Frontend component coverage | ≥80%   | 82%     | +2% above target |
| Security-critical paths     | 100%   | 100%    | Maintain         |

### 5.3 Test Ownership Matrix

| Domain               | Owner                | Reviewer               |
| -------------------- | -------------------- | ---------------------- |
| Security suite       | AppSec Engineer      | Security Architect     |
| Live cognitive suite | AI Safety Lead       | QA Lead                |
| E2E browser tests    | Frontend Lead        | QA Lead                |
| Contract tests       | API Lead             | QA Lead                |
| Performance tests    | Performance Engineer | SRE                    |
| Accessibility tests  | Frontend Lead        | Accessibility Reviewer |

---

_Deliverable DEL-ENT-P14-01 v1.0.0 — QA Lead — 2026-09-29_
