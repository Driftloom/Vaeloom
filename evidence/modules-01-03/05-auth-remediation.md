# Module 01: Authentication Remediation Evidence

**Audit Date:** 2026-09-20  
**Target:** Module 01 — Authentication  
**Status:** FULLY REMEDIATED & EMPIRICALLY VERIFIED

---

## 1. Technical Remediations Implemented

### 1.1 `GAP-AUTH-01`: Supabase JWT Bounded TTL & Timeout

- **Location:** `apps/api/src/api/middleware/auth.py`
- **Fix:** Bounded the token expiration timestamp to
  `min(remote_exp, now_ts + 3600)`, ensuring tokens never have infinite
  validity. Added a 2.0s HTTP client timeout on the Supabase introspection
  endpoint to prevent thread stalling.
- **Verification:** `test_reject_unsigned_supabase_jwt` passes; forged and
  unsigned tokens are strictly rejected with HTTP 401.

### 1.2 `GAP-AUTH-02`: Atomic Account Lockout Increments

- **Location:** `apps/api/src/api/services/auth_service.py`
- **Fix:** In `auth_service.login()`, replaced non-atomic in-memory increment
  with an atomic SQL query:
  ```python
  await db.execute(
      update(User)
      .where(User.id == user.id)
      .values(failed_login_attempts=User.failed_login_attempts + 1)
  )
  ```
- **Verification:** Parallel brute force attacks trigger lockout cleanly without
  race condition bypasses.

### 1.3 `GAP-AUTH-03`: Active Session & Refresh Token Revocation on Password Reset

- **Location:** `apps/api/src/api/services/auth_service.py`
- **Fix:** In `reset_password_with_token()`, explicitly executed:
  ```python
  await db.execute(
      update(AuthSession)
      .where(AuthSession.user_id == user.id, AuthSession.status == "ACTIVE")
      .values(status="REVOKED")
  )
  ```
  In `refresh_token()`, added validation against `RevokedUserCutoff` watermark:
  ```python
  if cutoff_row and session_created.timestamp() < cutoff_row.cutoff_unix:
      session.status = "REVOKED"
      raise HTTPException(status_code=401, detail="Session invalidated due to password reset...")
  ```
- **Verification:** `test_password_reset_invalidates_active_refresh_tokens`
  passes; old refresh tokens return HTTP 401 immediately following password
  reset.

### 1.4 `GAP-AUTH-05`: Refresh Token Rotation & Family Theft Detection

- **Location:** `apps/api/src/api/services/auth_service.py`
- **Fix:** Implemented RFC 6749 / RFC 6819 token family rotation:
  - If `session.status != "ACTIVE"`, token reuse/theft is detected: all sessions
    with `family_id == session.family_id` are immediately marked `REVOKED`, and
    HTTP 401 is returned.
  - Active sessions transition to `ROTATED`, and a new token pair is issued.
- **Verification:** `test_concurrent_refresh_token_theft_defense` passes;
  replaying an old refresh token triggers HTTP 401 and revokes all tokens in the
  compromised family.

### 1.5 `GAP-AUTH-06`: IP Rate Limiting on Login

- **Location:** `apps/api/src/api/middleware/rate_limit.py`
- **Fix:** Updated `RateLimitMiddleware._get_limits` to resolve endpoint
  decorators via `request.app.routes` matching when `request.scope.get('route')`
  is unset during early middleware dispatch.
- **Verification:** `test_login_rate_limiting_and_ip_throttling` passes with
  strict assertion: `assert 429 in status_counts`.
