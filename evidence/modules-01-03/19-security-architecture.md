# Modules 01–03 Zero-Trust Security Architecture

**Audit Date:** 2026-09-20  
**Framework:** NIST SP 800-207 Zero-Trust Architecture

---

## 1. Zero-Trust Principles Enforced

1. **Explicit Verification:**
   - Every request is authenticated and authorized; no request is trusted based
     on network origin or prior requests.
   - JWT signatures are validated cryptographically against local secrets or
     verified JWKS providers.

2. **Least Privilege Access:**
   - RBAC enforced on sensitive administrative endpoints
     (`POST /workspaces/{id}/invites`).
   - PostgreSQL RLS restricts database access to only the tenant/workspace rows
     belonging to the current caller.

3. **Assume Breach:**
   - Token family rotation immediately isolates and revokes compromised refresh
     tokens upon reuse detection.
   - Password reset instantly revokes all active sessions across all devices.
   - Polyglot and malicious files are inspected via magic bytes rather than
     trusting client-supplied MIME types or filename extensions.
