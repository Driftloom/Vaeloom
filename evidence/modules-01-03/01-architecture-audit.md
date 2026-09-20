# Modules 01–03 Architecture & Forensic Audit

**Audit Date:** 2026-09-20  
**Scope:** Architecture of Modules 01, 02, and 03  
**Status:** COMPLETE — HARDENED

---

## 1. Architectural Architecture Review

### 1.1 Module 01: Authentication Architecture

- **JWT & Session Strategy:** Hybrid JWT + server-side session store
  (`AuthSession`).
  - Access tokens are short-lived HMAC-SHA256 JWTs signed with `JWT_SECRET`
    (enforced 32+ characters minimum length).
  - Refresh tokens are 64-character URL-safe random strings tracked in
    `auth_sessions` with family-based rotation and theft detection.
  - Revocation is multi-layered: individual session deletion via
    `/api/v1/auth/sessions/{id}`, global user cutoff via `RevokedUserCutoff`
    watermark table, and Redis-backed JTI blacklisting.
- **MFA Architecture:** RFC 6238 TOTP with cryptographic secret generation
  (`totp_service.py`), encrypted storage via AES-256-GCM, and single-use
  recovery code hashes.
- **Third-Party / SSO / SAML:**
  - Supabase Auth: Token signature verified against Supabase JWKS or strict API
    introspection with 2.0s bounded timeout.
  - SAML 2.0: XML Signature verification using `signxml` strictly guarding
    against XML Signature Wrapping (XSW) and XML External Entity (XXE) attacks.

### 1.2 Module 02: Tenant Isolation & Multi-Tenancy Architecture

- **ContextVar Tenant Context:** `TenantContext` maintains async-local
  `tenant_id`, `workspace_id`, and `user_id`.
  - Middleware dispatch sets context variables on request ingress and clears
    them on exit.
  - High-concurrency async tasks maintain strict task isolation without
    cross-talk.
- **Database Multi-Tenancy:**
  - PostgreSQL Row-Level Security (RLS) enabled across all multi-tenant tables.
  - Runtime GUC parameters (`app.tenant_id`, `app.workspace_id`, `app.user_id`)
    set per connection transaction via `set_rls_session_vars()`.
  - Fail-closed behavior: When GUCs are unset or empty, policies evaluate to
    false, denying row access.

### 1.3 Module 03: Onboarding Pipeline Architecture

- **State Machine:** Deterministic five-step progression:
  1. `PROFILE` — Display name, job title, initial user configuration.
  2. `WORKSPACE` — Primary workspace provisioning and domain binding.
  3. `RESUME` — Resume upload, magic byte content inspection, and skills
     extraction.
  4. `CONNECTORS` — Integration tool selection (Google Drive, Gmail, GitHub).
  5. `COMPLETED` — Final launch state, marking onboarding immutable.
- **Security Invariants:**
  - Strict step prerequisite enforcement: skipping intermediate steps is
    rejected with HTTP 400.
  - Immutability: Once `is_completed=True`, any update attempt is rejected with
    HTTP 400.
  - Anti-hijacking: `/onboarding/join` requires caller to be workspace owner or
    have an existing invitation.
