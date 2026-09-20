# Modules 01–03 Operational Runbook

**Audit Date:** 2026-09-20  
**Scope:** Day-2 Operations for Authentication, Tenant Isolation, and Onboarding

---

## 1. Routine Maintenance Procedures

### 1.1 Managing Expired Sessions

- Run the session cleanup task (or background daemon cron):
  ```sql
  DELETE FROM auth_sessions WHERE expires_at < NOW() AND status IN ('ROTATED', 'REVOKED');
  ```

### 1.2 Rotating JWT Secrets

- Follow ADR-007 JWT key rotation:
  1. Generate new 32+ byte secret string: `openssl rand -hex 32`.
  2. Deploy new secret as primary signing key.
  3. Keep prior secret in `JWT_SECRET_FALLBACK` for 24 hours to allow seamless
     token expiration.

### 1.3 Verifying RLS Enforcement

- Execute PostgreSQL sanity check:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
  ```
  Ensure all multi-tenant tables show `rowsecurity = true`.
