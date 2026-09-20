# Modules 01–03 Incident Response & Threat Mitigation Guide

**Audit Date:** 2026-09-20  
**Scope:** Security Incident Response Procedures for Auth, Multi-Tenancy, and
Onboarding

---

## 1. Incident Playbooks

### Playbook 1: Token Theft / Compromised Refresh Token

1. **Detection:** Prometheus alert `auth_refresh_theft_detected_total > 0` or
   log event `"Suspicious activity detected: refresh token reused"`.
2. **Automated Action:** The system immediately revokes all sessions belonging
   to that token family (`family_id`).
3. **Manual Operator Action:**
   - Execute `POST /api/v1/auth/sessions/revoke-all` for the impacted `user_id`.
   - Force password reset if credentials may have been breached.

### Playbook 2: Cross-Tenant Access Attempt

1. **Detection:** Log event with HTTP 403 / 404 on cross-workspace access
   attempts.
2. **Automated Action:** Starlette exception handler logs correlation ID and
   client IP; access is denied.
3. **Investigation:** Query audit logs for `actor_id` and `resource_id` to
   determine intent (misconfiguration vs. penetration attempt).
