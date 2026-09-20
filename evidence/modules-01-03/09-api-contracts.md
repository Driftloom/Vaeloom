# Modules 01–03 API Contracts & Schema Validation

**Audit Date:** 2026-09-20  
**Scope:** OpenAPI 3.1 & Pydantic V2 Contract Verification

---

## 1. Verified Endpoints & Contracts

### 1.1 Module 01: Authentication Endpoints

- `POST /api/v1/auth/signup`: Validates email format, password complexity (min 8
  chars, max 128 chars, uppercase/lowercase/number/symbol),
  `terms_accepted: bool` affirmative consent. Rate limit: 5 req/h.
- `POST /api/v1/auth/login`: Validates credentials, executes atomic failed
  attempt increment, issues access token (TTL 15m) + refresh token (TTL 7d).
  Rate limit: 10 req/min per IP.
- `POST /api/v1/auth/refresh`: Accepts `refresh_token`, verifies session status
  `ACTIVE`, executes token family rotation, detects reuse/theft. Rate limit: 20
  req/min.
- `POST /api/v1/auth/reset-password`: Accepts `token` + `new_password`, revokes
  all active sessions for user, invalidates all existing refresh tokens. Rate
  limit: 5 req/15m.
- `POST /api/v1/auth/mfa/setup`: Generates RFC 6238 TOTP secret + 8 recovery
  codes.
- `POST /api/v1/auth/mfa/enable`: Verifies TOTP code before activating MFA flag.
- `POST /api/v1/auth/mfa/verify`: Exchanges MFA temporary challenge token + TOTP
  code for full access token.

### 1.2 Module 02: Workspaces & Multi-Tenancy Endpoints

- `GET /api/v1/workspaces`: Lists workspaces where caller is member or owner.
- `POST /api/v1/workspaces`: Creates new workspace bound to caller's tenant.
- `GET /api/v1/workspaces/{id}`: Returns workspace details (403/404 if not a
  member).
- `PATCH /api/v1/workspaces/{id}`: Requires workspace `OWNER` role.
- `DELETE /api/v1/workspaces/{id}`: Requires workspace `OWNER` role; cascades
  safely.
- `POST /api/v1/workspaces/{id}/invites`: Requires `ADMIN` or `OWNER` role
  (`GAP-TEN-03`).

### 1.3 Module 03: Onboarding Pipeline Endpoints

- `GET /api/v1/onboarding`: Retrieves caller's onboarding state (creates initial
  `PROFILE` state if missing).
- `POST /api/v1/onboarding/step`: Advances onboarding step (`step: str`,
  `step_data: dict`). Enforces `STEP_SEQUENCE` prerequisites (`GAP-ONB-01`) and
  immutability once completed (`GAP-ONB-02`).
- `POST /api/v1/onboarding/resume`: Multipart file upload with magic byte
  inspection (`GAP-ONB-03`).
- `POST /api/v1/onboarding/join`: Requires caller to be owner or have existing
  invitation (`GAP-TEN-02`).
- `POST /api/v1/onboarding/complete`: Finalizes onboarding, marks
  `is_completed=True`.
- `POST /api/v1/onboarding/reset`: Clears onboarding state back to `PROFILE`.
