# Disaster Recovery & Service Restoration Report: Modules 01–03

**Date**: 2026-09-20  
**Scope**: Database Restoration, Migration Recovery, Lockout Expiry

---

## 1. Recovery Procedures Verified

1. **Account Lockout Automatic Recovery**:
   - When an account is locked due to 10 failed login attempts,
     `User.locked_until` is set 15 minutes into the future.
   - Once the timestamp passes, the next login attempt with valid credentials
     automatically clears `failed_login_attempts = 0` and `locked_until = None`.
   - Verified via
     `test_enterprise_modules_01_03.py::test_account_lockout_after_10_failed_attempts`.

2. **Session Cleanup & Revocation Persistence**:
   - Revoked sessions persist as `status = 'REVOKED'` in `auth_sessions`.
   - Re-authenticating via login issues a completely new session and refresh
     family without reviving old sessions.

3. **Disaster Recovery Drill Baseline**:
   - Baseline DR drill logged in `evidence/dr-drills/DR-Drill-Log.md`: **48.99s
     RTO / 0.0s RPO** across 67 tables verified.
