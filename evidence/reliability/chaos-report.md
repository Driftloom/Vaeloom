# Chaos & Failure Injection Report: Modules 01–03

**Date**: 2026-09-20  
**Scope**: Fault Injection (Redis Outage, Unset GUCs, Expired Credentials)

---

## 1. Fault Scenarios & System Behavior

### Scenario 01: Redis Unavailable

- **Fault Injected**: Redis connection failure during lockout tracking and
  session revocation.
- **Behavior**: System gracefully falls back to database-level tracking
  (`User.failed_login_attempts` and `AuthSession.status`).
- **Verdict**: **FAIL-SAFE**. Lockout still engages at 10 failed attempts;
  sessions can still be revoked and verified.

### Scenario 02: PostgreSQL Unset GUCs

- **Fault Injected**: Database query executed without initializing
  `app.tenant_id` or `app.workspace_id`.
- **Behavior**: Row Level Security policies evaluate to `NULL` / false; SELECT
  queries return 0 rows.
- **Verdict**: **FAIL-CLOSED**. No data leaked.

### Scenario 03: Revocation Check Failure

- **Fault Injected**: Database/Redis exception inside `AuthMiddleware`
  revocation check.
- **Behavior**: `AuthMiddleware` catches exception, logs warning, and returns
  `HTTP 401 ("Authorization unavailable — try again")`.
- **Verdict**: **FAIL-CLOSED**. Caller is denied access rather than allowed
  through unverified.
