# Verification Report 05: Security & Zero-Trust Audit

**Target Scope:** Modules 01–03 (Authentication, Tenant Isolation &
Multi-Tenancy, Onboarding)  
**Audit Timestamp:** 2026-09-20  
**Source of Truth Commit:** `89b246e7`  
**Auditor:** Principal Zero-Trust Security Architect

---

## 1. Zero-Trust STRIDE Threat Model

Every component across Modules 01–03 was subjected to STRIDE threat modeling
under zero-trust assumptions.

| Threat Category            | Target Surface      | Specific Threat Vector                              | Existing Defense                                             | Zero-Trust Verification Finding                                                                  |
| :------------------------- | :------------------ | :-------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| **Spoofing**               | `AuthMiddleware`    | Forged JWT with `"iss": "supabase"`                 | Signature verification fallback (`auth.py:108-114`)          | **CRITICAL DEFECT**: Unsigned tokens accepted if `iss` contains "supabase".                      |
| **Spoofing**               | `TenantMiddleware`  | Client supplies `X-Tenant-ID: evil-tenant`          | `TenantMiddleware:45` ignores client-supplied tenant headers | **SECURE**: Client headers are completely ignored; tenant is derived from auth.                  |
| **Tampering**              | `workspaces.py`     | User B updates User A's workspace name              | `workspace_service.find_by_id` checks `user_id == caller`    | **SECURE**: Unauthorized PATCH returns 404 (IDOR blocked).                                       |
| **Tampering**              | `onboarding.py`     | Tampering with onboarding state post-completion     | None; `update_step` allows writing after completion          | **GAPPED**: Onboarding state is mutable even when `is_completed: true`.                          |
| **Repudiation**            | Auth & Tenancy      | Actions performed without audit trail               | Structured logging + `correlation_id` middleware             | **PARTIAL**: Authentication events logged, but fine-grained session revocations lack audit rows. |
| **Information Disclosure** | Auth Login/Reset    | Email enumeration via differentiated error messages | Constant 401 on login; constant 200 on reset/resend          | **SECURE**: Anti-enumeration implemented across all public auth endpoints.                       |
| **Information Disclosure** | Multi-Tenancy       | Cross-tenant data leakage via SQL queries           | PostgreSQL RLS policies (`p_workspaces_tenant`, etc.)        | **SECURE on PG / GAPPED on SQLite**: Robust on PG, but unverified in SQLite test suite.          |
| **Denial of Service**      | Login Endpoint      | Credential stuffing & brute-force                   | Account lockout (10 failed attempts -> 15 min lock)          | **SECURE**: Durable DB lockout engages at 10 failed attempts; immune to casing bypass.           |
| **Denial of Service**      | Verification Resend | Email flooding / spamming                           | None; lacks IP-based rate limiting                           | **GAPPED**: Missing IP-level sliding window rate limiting on resend endpoints.                   |
| **Elevation of Privilege** | Workspaces          | Workspace member elevates role to admin             | `WorkspaceUser` role checked in service layer                | **GAPPED**: Missing explicit negative test for member self-escalation.                           |

---

## 2. Forensic Analysis of Critical Security Defect (F-AUTH-01)

### Code Location: `apps/api/src/api/middleware/auth.py:108-115`

```python
# 3. Fallback: unverified decode for Supabase-issued tokens
if not verified:
    unverified = jwt.decode(token, options={"verify_signature": False})
    if "supabase" in unverified.get("iss", ""):
        payload = unverified
    else:
        raise
```

### Vulnerability Mechanism:

1. When an incoming request contains `Authorization: Bearer <token>`,
   `AuthMiddleware` attempts to decode the token with `settings.jwt_secret`.
2. If decoding fails (e.g. invalid signature), the exception handler attempts
   Supabase secret decoding and JWKS decoding.
3. If both fail or are unconfigured, **step 3 executes**: it decodes the token
   with `verify_signature: False`.
4. If the string `"supabase"` is anywhere in the unverified token's `"iss"`
   claim (e.g. `"iss": "supabase"` or
   `"iss": "https://attacker-controlled.supabase.co"`), the middleware accepts
   the payload as valid, trusted identity claims!
5. Lines 116–135 extract `user_id = payload.get("sub")` and look up or
   auto-provision the user.

### Impact:

- **Complete Authentication Bypass:** Any unauthenticated remote attacker can
  forge an unsigned JWT containing
  `{"iss": "supabase", "sub": "<target_user_uuid>"}` and immediately take over
  any account or workspace in the deployment.
- **Flawed Test Assertion:** In `tests/test_supabase_auth.py:55`:
  ```python
  async def test_supabase_token_without_secret_fallback(self, client: AsyncClient, monkeypatch):
      """Verify that in dev mode, a Supabase token with 'supabase' in iss can pass fallback."""
  ```
  The existing test suite explicitly enshrines this vulnerability as expected
  behavior rather than an exploit. Under Zero-Trust principles, signature
  verification can **never** be bypassed in production code.

---

## 3. Cryptographic & Session Hardening Verification

### 3.1 Password Hashing & Policy

- **Algorithm:** Passlib with `bcrypt` (or Argon2 fallback).
- **Minimum Length:** 8 characters enforced at Pydantic schema level
  (`SignupRequest`).
- **Timing Attack Resistance:** Credential lookup and verification use
  constant-time comparisons.

### 3.2 Refresh Token Rotation & Theft Detection

- Refresh tokens are single-use.
- When exchanged via `/api/v1/auth/refresh`, the used token is marked `ROTATED`
  in `auth_sessions`, and a new token is issued under the same `family_id`.
- If an attacker attempts to replay a `ROTATED` refresh token:
  1. The system detects token reuse.
  2. The entire token family (`family_id`) is instantly transitioned to
     `REVOKED`.
  3. All active access and refresh tokens belonging to that session family are
     invalidated.

### 3.3 Account Lockout Mechanism

- Account lockout is durable (stored in `users.failed_login_attempts` and
  `users.locked_until`).
- Threshold: Exactly 10 consecutive failed attempts (verified via
  `test_enterprise_modules_01_03.py`).
- Lockout Duration: 15 minutes.
- HTTP Status: Returns `423 Locked`.
- Casing Immunity: User email is normalized to lowercase before lookup
  (`test_case_insensitive_lockout_bypass_attack`), preventing attackers from
  evading lockout by varying email casing.
