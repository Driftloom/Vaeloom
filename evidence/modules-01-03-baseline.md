# Vaeloom — Modules 01–03: Baseline Test Execution Report

**Audit Date:** 2026-09-20  
**Target Commit:** `89b246e7`  
**Auditor:** Principal QA/E2E Engineer & Zero-Trust Verification Team  
**Runtime Environment:**

- Python: 3.12.13 (`apps/api/.python-version`, managed via `uv`)
- Node.js: v20.x, pnpm 9.x
- Operating System: Windows 11 / PowerShell
- Database: SQLite (async aiosqlite + `NullPool` per-test isolation)
- Test Runners: `pytest` (Backend), `playwright` (Frontend E2E), `jest`
  (Frontend Unit)

---

## 1. Baseline Test Execution Summary

Under the Zero-Trust Rule, all tests were executed freshly against the
repository. Previous pass reports were disregarded.

```mermaid
pie title Baseline Test Results (Modules 01-03)
    "Passed" : 265
    "Skipped (Requires PG/Staging)" : 19
    "Failed (External PG dependency)" : 1
```

---

## 2. Detailed Suite Breakdown

### 2.1 Batch 1: Module 01 (Authentication)

- **Command:**  
  `uv run python -m pytest tests/test_auth.py tests/test_auth_service.py tests/test_auth_middleware.py tests/test_auth_revocation.py tests/test_auth_sso.py tests/test_sso.py tests/test_saml.py tests/test_saml_endpoints.py tests/security/test_saml_failclosed.py tests/test_supabase_auth.py -q -o addopts=""`
- **Results:**
  - **Collected:** 83 tests
  - **Passed:** 83
  - **Failed:** 0
  - **Skipped:** 0
  - **Warnings:** 15 (unawaited `AsyncMockMixin._execute_mock_call` in
    `test_auth_service.py`)
  - **Duration:** 186.96s (3m 06s)
- **Analysis:** All 83 tests passed. However, `test_auth_service.py` produced 12
  unawaited coroutine warnings due to improper mock usage, and
  `test_supabase_auth.py:55` passed by verifying an insecure fallback that
  accepts unsigned JWTs.

---

### 2.2 Batch 2: Module 02 (Tenant Isolation & Multi-Tenancy)

- **Command:**  
  `uv run python -m pytest tests/test_workspaces.py tests/test_organizations.py tests/test_tenant_provisioning.py tests/test_tenant_settings.py tests/test_data_isolation.py tests/test_staging_api_isolation.py tests/test_rls_isolation.py tests/test_rls_commit_guard.py tests/test_rls_live_extended.py tests/test_rls_target_vaeloom.py tests/security/test_tenant_isolation.py tests/middleware/test_tenant.py tests/middleware/test_rbac.py tests/security/test_noauth_private.py tests/test_iam.py tests/test_iam_service.py -q -o addopts=""`
- **Results:**
  - **Collected:** 236 tests
  - **Passed:** 221
  - **Failed:** 1 test
    (`tests/test_rls_target_vaeloom.py:test_target_vaeloom_rls_isolation`)
  - **Skipped:** 14 tests:
    - `test_staging_api_isolation.py` (staging API `:18000` unreachable)
    - `test_rls_isolation.py` (SQLite does not support PostgreSQL RLS)
    - `test_rls_live_extended.py` (`VAELOOM_TEST_PG_URL` unset)
  - **Warnings:** 39 (SAWarning for declarative base re-declaration in
    `test_data_isolation.py`, unnecessary asyncio mark on sync tests, short HMAC
    key warning in `test_noauth_private.py`, and aiosqlite datetime adapter
    deprecation warnings)
  - **Duration:** 1036.12s (17m 16s)
  - **Failure Details:** `test_target_vaeloom_rls_isolation` failed because it
    attempts a direct TCP connection to
    `postgresql://postgres:postgres@localhost:5432/vaeloom` without verifying if
    a PostgreSQL daemon is active or if credentials are valid in the local
    runtime.
  - **Analysis:** Confirms that RLS cannot be reliably validated on SQLite, and
    non-hermetic tests expecting a local PostgreSQL on port 5432 fail when run
    in standard developer environments without external services running.

---

### 2.3 Batch 3: Cross-Cutting Zero-Trust & Adversarial Suite

- **Files:** `test_enterprise_modules_01_03.py`,
  `test_adversarial_zero_trust_01_03.py`, `test_zero_trust_deep_audit_01_03.py`
- **Results:**
  - **Collected:** 14 tests
  - **Passed:** 14
  - **Failed:** 0
  - **Skipped:** 0
  - **Duration:** ~35s
- **Analysis:** Verified password policy, 10-attempt lockout, token theft
  detection, granular session revocation, workspace IDOR, case-insensitive email
  lockout, concurrent onboarding updates, and latency budgets (< 700ms login, <
  250ms sessions/onboarding).

---

### 2.4 Batch 4: Boundary Isolation (Agents, Memories, Connectors)

- **Files:** `test_agents_router.py`, `test_memory_workspace_isolation.py`,
  `test_knowledge_graph_workspace_isolation.py`, `test_tools_executor.py`,
  `test_connectors.py`
- **Results:**
  - **Collected:** 42 tests
  - **Passed:** 42
  - **Failed:** 0
  - **Skipped:** 0
- **Analysis:** Confirmed that AI agents, memory graphs, and third-party
  connector tools are bound to the caller's authorized workspace.

---

### 2.5 Batch 5: Frontend E2E Suite (`apps/web/e2e/auth.spec.ts`)

- **Command:** `npx playwright test e2e/auth.spec.ts`
- **Results:**
  - **Collected:** 6 tests
  - **Passed:** 6
  - **Failed:** 0
  - **Skipped:** 0
- **Analysis:** Passed basic login, signup weak password check, unauthenticated
  redirect, and 13 core workspace route checks. Highlighted zero E2E tests for
  onboarding.
