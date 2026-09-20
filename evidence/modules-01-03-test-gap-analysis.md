# Vaeloom — Modules 01–03: Zero-Trust Test Gap Analysis

**Audit Date:** 2026-09-20  
**Target Commit:** `89b246e7`  
**Auditor:** Principal Security Architect & Zero-Trust Verification Team  
**Scope:** Module 01 (Authentication), Module 02 (Tenant Isolation &
Multi-Tenancy), Module 03 (Onboarding), and Boundary Enforcement.

---

## 1. Executive Summary

Under a strict zero-trust posture, existing tests across Modules 01–03
demonstrate good foundational coverage for standard happy paths and basic error
responses, but reveal **critical blind spots**, **unverified trust
assumptions**, and **security vulnerabilities**.

Most notably:

1. **Critical Authentication Bypass in Production Code:**
   `apps/api/src/api/middleware/auth.py:108-114` falls back to decoding
   unverified JWTs if the issuer string contains `"supabase"`. Existing tests
   (`test_supabase_auth.py:55`) explicitly assert and validate this bypass
   rather than flagging it as an attack vector!
2. **False Confidence via Mocking:** Multiple core service tests
   (`test_auth_service.py`, `test_iam_service.py`, `test_rls_commit_guard.py`)
   mock the database session (`AsyncMockMixin`). They pass even when database
   constraints or async coroutines fail.
3. **Database RLS Skipped in Standard Runs:** PostgreSQL Row Level Security
   (RLS) is the bedrock of Vaeloom's multi-tenancy model, but standard test runs
   execute on SQLite, where all RLS tests are skipped.
4. **Onboarding State Machine Laxity:** The onboarding router accepts arbitrary
   unvalidated JSON dictionaries in `step_data`, does not enforce strict
   sequential step transitions, and lacks E2E Playwright test coverage.
5. **Frontend Zero-Trust Gaps:** Frontend E2E tests only cover basic
   login/signup forms. There is zero E2E verification of session management,
   account lockout recovery, email verification banners, or the multi-step
   onboarding wizard.

---

## 2. Test Gap Matrix by Module

### Module 01: Authentication

| Gap ID          | Component / Surface              | Description of Gap                                               | Risk / Attack Vector                                                                                                          | Severity     | Proposed Test ID   |
| :-------------- | :------------------------------- | :--------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :----------- | :----------------- |
| **GAP-AUTH-01** | `api/middleware/auth.py:108-114` | Unsigned JWT decode fallback for `"supabase"` issuer             | **CRITICAL AUTH BYPASS**: Attacker crafts unsigned JWT with `{"iss": "supabase", "sub": "<victim-id>"}` and bypasses all auth | **CRITICAL** | `TEST-AUTH-SEC-01` |
| **GAP-AUTH-02** | `api/routers/auth.py`            | Missing rate limiting & brute-force protection tests             | Attacker brute forces login or floods email verification / password reset endpoints                                           | **HIGH**     | `TEST-AUTH-SEC-02` |
| **GAP-AUTH-03** | `api/services/auth_service.py`   | Password complexity & input sanitization boundaries              | Passwords with null bytes, 10,000+ characters (DoS), or unicode normalization edge cases                                      | **MEDIUM**   | `TEST-AUTH-SEC-03` |
| **GAP-AUTH-04** | `api/services/saml.py`           | XML Signature Wrapping (XSW) & XXE injection                     | Attacker injects unsigned assertion alongside signed assertion in SAML response                                               | **HIGH**     | `TEST-AUTH-SEC-04` |
| **GAP-AUTH-05** | `api/routers/auth.py:sessions`   | Concurrent session revocation race conditions                    | Attacker makes rapid concurrent requests using a session being revoked in parallel                                            | **HIGH**     | `TEST-AUTH-SEC-05` |
| **GAP-AUTH-06** | `api/middleware/auth.py`         | JWT `alg: none` and asymmetric key confusion (HMAC vs RSA/ECDSA) | Attacker signs token using public key as HMAC secret or specifies `alg: none`                                                 | **CRITICAL** | `TEST-AUTH-SEC-06` |

---

### Module 02: Tenant Isolation & Multi-Tenancy

| Gap ID         | Component / Surface                           | Description of Gap                                   | Risk / Attack Vector                                                                  | Severity     | Proposed Test ID  |
| :------------- | :-------------------------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------ | :----------- | :---------------- |
| **GAP-TEN-01** | `api/database.py`, `api/middleware/tenant.py` | Lack of automated hermetic PostgreSQL RLS test suite | RLS regression introduced in migrations goes unnoticed on SQLite-only CI              | **CRITICAL** | `TEST-TEN-RLS-01` |
| **GAP-TEN-02** | `api/routers/workspaces.py`                   | Workspace membership role escalation                 | Workspace Member attempts to update their own role to Admin or Owner via PATCH        | **HIGH**     | `TEST-TEN-SEC-01` |
| **GAP-TEN-03** | `api/middleware/tenant.py`                    | TenantContext leakage across async tasks             | TenantContext ContextVar leaks across unawaited background tasks or worker pools      | **HIGH**     | `TEST-TEN-SEC-02` |
| **GAP-TEN-04** | `api/routers/organizations.py`                | Cross-tenant organization tree enumeration           | User in Tenant A queries or mutates organization hierarchy belonging to Tenant B      | **HIGH**     | `TEST-TEN-SEC-03` |
| **GAP-TEN-05** | `api/models/schema.py`                        | Cascading deletion cross-tenant integrity            | Deleting a user or workspace accidentally cascades to or breaks another tenant's rows | **HIGH**     | `TEST-TEN-SEC-04` |

---

### Module 03: Onboarding

| Gap ID         | Component / Surface                  | Description of Gap                           | Risk / Attack Vector                                                                 | Severity   | Proposed Test ID  |
| :------------- | :----------------------------------- | :------------------------------------------- | :----------------------------------------------------------------------------------- | :--------- | :---------------- |
| **GAP-ONB-01** | `api/services/onboarding_service.py` | Arbitrary step jumping without prerequisites | User jumps directly from `PROFILE` to `COMPLETED` skipping mandatory workspace setup | **HIGH**   | `TEST-ONB-SEC-01` |
| **GAP-ONB-02** | `api/schemas/onboarding.py`          | Unvalidated `step_data` JSON payload         | Malicious payload with massive JSON or script injection stored in DB `step_data`     | **MEDIUM** | `TEST-ONB-SEC-02` |
| **GAP-ONB-03** | `api/routers/onboarding.py`          | Post-completion state tampering              | User submits `/onboarding/step` after onboarding has already been marked completed   | **MEDIUM** | `TEST-ONB-SEC-03` |
| **GAP-ONB-04** | `apps/web/src/components/onboarding` | Zero E2E Playwright coverage for Onboarding  | Frontend wizard fails silently or gets stuck without automated detection             | **HIGH**   | `TEST-ONB-E2E-01` |

---

### Cross-Cutting & Boundary Isolation

| Gap ID       | Component / Surface             | Description of Gap                         | Risk / Attack Vector                                                                 | Severity     | Proposed Test ID |
| :----------- | :------------------------------ | :----------------------------------------- | :----------------------------------------------------------------------------------- | :----------- | :--------------- |
| **GAP-X-01** | `api/orchestrator/router.py`    | AI Agent cross-workspace memory read/write | Agent executing in Workspace A reads or writes memories belonging to Workspace B     | **CRITICAL** | `TEST-X-AGT-01`  |
| **GAP-X-02** | `api/routers/connectors.py`     | Connector credentials cross-tenant access  | Tenant B uses or inspects OAuth credentials configured by Tenant A                   | **CRITICAL** | `TEST-X-CON-01`  |
| **GAP-X-03** | `api/services/audit_service.py` | Audit log sanitization & completeness      | Auth events and tenant switches do not log correlation IDs or leak plaintext secrets | **HIGH**     | `TEST-X-AUD-01`  |

---

## 3. Detailed Proposed Test Implementation Plan

To close every identified gap, the following **14 concrete automated tests** are
proposed:

### Proposed Tests for Module 01 (Authentication)

1. **`TEST-AUTH-SEC-01`**: `test_reject_unsigned_supabase_jwt`
   - _Target File:_ `tests/security/test_auth_zero_trust_gaps.py`
   - _Scenario:_ Attacker sends a JWT with
     `"iss": "https://yygakxcttyaeunvkeybx.supabase.co/auth/v1"` and
     `alg: "none"` or invalid signature.
   - _Expected Result:_ HTTP 401 Unauthorized; unsigned token is strictly
     rejected.
   - _Severity:_ CRITICAL

2. **`TEST-AUTH-SEC-02`**: `test_login_rate_limiting_and_ip_throttling`
   - _Target File:_ `tests/security/test_auth_zero_trust_gaps.py`
   - _Scenario:_ Send 50 rapid login requests from a single client IP.
   - _Expected Result:_ HTTP 429 Too Many Requests returned with `Retry-After`
     header.
   - _Severity:_ HIGH

3. **`TEST-AUTH-SEC-03`**: `test_password_edge_cases_and_dos_prevention`
   - _Target File:_ `tests/security/test_auth_zero_trust_gaps.py`
   - _Scenario:_ Test passwords with null bytes, 20,000 characters, unicode
     homoglyphs, and script tags.
   - _Expected Result:_ 422 Unprocessable Entity or 400 Bad Request; zero
     unhandled exceptions.
   - _Severity:_ MEDIUM

4. **`TEST-AUTH-SEC-04`**: `test_saml_xml_signature_wrapping_rejection`
   - _Target File:_ `tests/security/test_auth_zero_trust_gaps.py`
   - _Scenario:_ Craft SAML assertion with cloned unsigned Subject /
     AttributeStatement nodes (XSW1/XSW2).
   - _Expected Result:_ Verification fails; SAML auth rejected with 401/400.
   - _Severity:_ HIGH

5. **`TEST-AUTH-SEC-05`**: `test_concurrent_session_revocation_race`
   - _Target File:_ `tests/security/test_auth_zero_trust_gaps.py`
   - _Scenario:_ Issue 20 parallel requests using an access token while
     simultaneously calling `/auth/sessions/{id}` DELETE.
   - _Expected Result:_ All requests after deletion return 401; no stale session
     resurrects.
   - _Severity:_ HIGH

### Proposed Tests for Module 02 (Tenant Isolation & Multi-Tenancy)

6. **`TEST-TEN-SEC-01`**: `test_workspace_member_cannot_escalate_role`
   - _Target File:_ `tests/security/test_tenant_zero_trust_gaps.py`
   - _Scenario:_ User with role `MEMBER` attempts to update their own role to
     `ADMIN` or `OWNER` via `/workspaces/{id}/members`.
   - _Expected Result:_ HTTP 403 Forbidden.
   - _Severity:_ HIGH

7. **`TEST-TEN-SEC-02`**: `test_tenant_context_async_task_isolation`
   - _Target File:_ `tests/security/test_tenant_zero_trust_gaps.py`
   - _Scenario:_ Spawn 50 concurrent `asyncio` tasks with different
     `TenantContext` values and verify zero cross-talk or context bleeding.
   - _Expected Result:_ Every coroutine sees strictly its own tenant ID and
     workspace ID.
   - _Severity:_ HIGH

8. **`TEST-TEN-SEC-03`**: `test_cross_tenant_org_tree_isolation`
   - _Target File:_ `tests/security/test_tenant_zero_trust_gaps.py`
   - _Scenario:_ Tenant A user queries `/api/v1/organizations/tree` with Tenant
     B's organization ID.
   - _Expected Result:_ HTTP 404 Not Found or 403 Forbidden.
   - _Severity:_ HIGH

9. **`TEST-TEN-SEC-04`**: `test_tenant_cascade_delete_integrity`
   - _Target File:_ `tests/security/test_tenant_zero_trust_gaps.py`
   - _Scenario:_ Delete User A in Tenant A and verify Tenant B's users,
     workspaces, and memories remain completely untouched.
   - _Expected Result:_ Integrity preserved; zero orphan rows or cross-tenant
     deletions.
   - _Severity:_ HIGH

### Proposed Tests for Module 03 (Onboarding)

10. **`TEST-ONB-SEC-01`**: `test_onboarding_strict_step_progression`
    - _Target File:_ `tests/security/test_onboarding_zero_trust_gaps.py`
    - _Scenario:_ Freshly signed up user attempts to POST
      `/api/v1/onboarding/step` with step `CONNECTORS` without completing
      `PROFILE` or `WORKSPACE`.
    - _Expected Result:_ HTTP 400 Bad Request indicating prerequisite steps are
      incomplete.
    - _Severity:_ HIGH

11. **`TEST-ONB-SEC-02`**: `test_onboarding_step_data_sanitization_and_schema`
    - _Target File:_ `tests/security/test_onboarding_zero_trust_gaps.py`
    - _Scenario:_ Submit malicious `step_data` containing XSS strings, oversized
      binary payloads, and invalid field types.
    - _Expected Result:_ HTTP 422 Unprocessable Entity; payload rejected before
      DB write.
    - _Severity:_ MEDIUM

12. **`TEST-ONB-SEC-03`**: `test_onboarding_immutable_post_completion`
    - _Target File:_ `tests/security/test_onboarding_zero_trust_gaps.py`
    - _Scenario:_ User completes onboarding, then attempts to mutate step data
      via `/onboarding/step`.
    - _Expected Result:_ HTTP 400 Bad Request: "Onboarding is already completed
      and cannot be modified."
    - _Severity:_ MEDIUM

13. **`TEST-ONB-E2E-01`**: `test_e2e_onboarding_wizard_full_lifecycle`
    - _Target File:_ `apps/web/e2e/onboarding.spec.ts`
    - _Scenario:_ Playwright browser signs up a new user, navigates through
      Profile, Workspace, Resume, and Connectors steps, and verifies landing on
      `/dashboard`.
    - _Expected Result:_ Wizard completes smoothly; all UI step indicators
      update; user redirected.
    - _Severity:_ HIGH

### Proposed Tests for Cross-Cutting & Boundaries

14. **`TEST-X-AGT-01`**: `test_agent_cross_workspace_memory_isolation`
    - _Target File:_ `tests/security/test_boundary_zero_trust_gaps.py`
    - _Scenario:_ Run agent in Workspace A and instruct it to search or recall
      memories from Workspace B.
    - _Expected Result:_ Agent tool returns empty / not found; zero memory
      leaked.
    - _Severity:_ CRITICAL
