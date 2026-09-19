# CONT-P11 — 03 Authorization & Audit

**Deliverable:** `DEL-CONT-P11-03` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** Security Architect

## AuthZ

| Layer | File | Enforcement |
|-------|------|-------------|
| `AuthMiddleware` | `middleware/auth.py` `PUBLIC_PATHS` + `verify_jwt` | `Bearer` binds `workspace_id + user_id + tenant_id` |
| `TenantMiddleware` | `middleware/tenant.py` `set_rls_session_vars` `database.py:30` | `app.workspace_id` GUC fail-closed `42/42` |
| `RBAC` | `middleware/rbac.py` `require_role` DI `injectable dependency` per `F-11` | `admin/iam` `roles` check server-authoritative, UI `StatusBadge` only display `admin/page.tsx:150` |
| `SSO/SAML` | `services/saml.py` `signxml` real `EVD-MVP-P11` + `services/sso.py` not `silently passed` per `F-20` | `POST /auth/sso/{provider}` `GET /auth/sso/{provider}/callback` |

## Audit / Rights

| Feature | Route/Service | RLS |
|---------|---------------|-----|
| `audit log` | `GET /audit/events` `admin/page.tsx:85` `auditApi.queryEvents` `POST /audit/events` + `resource_id` | `audit_events tenant_id` RLS |
| `consent` | `POST /consent/grant {scope}` `POST /consent/revoke/{scope}` `GET /consent/me` `GET /consent/scopes` `consentApi` `api-client.ts:1152` | `consents user_id tenant_id scope granted_at` RLS |
| `gdpr export/delete` | `GET /gdpr/export` `POST /gdpr/delete` `gdprApi` | `erasure_service` anonymize + backup expiry 30d |
| `approval` | `GET /approvals?status=PENDING` `POST /approvals/{id}/approve|reject` `approvalApi:1202` `TEMPORAL approval queue` | `approvals workspace_id` RLS + `approval_gated_tools()` |

**Threat:** `OWASP Agentic 2026` `tool misuse` → `MaxSteps 10 + Human-in-loop` + `prompt_injection_classifier` `services/injection_classifier.py` gated.

---
_Version 1.0 2026-08-31 — `rg "approval_gated_tools" apps/api/src/api 120`._
