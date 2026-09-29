# DEL-ENT-P13-03 — Identity, Federation & RBAC Hardening (SSO/SCIM/OIDC/SAML)

**Deliverable ID:** DEL-ENT-P13-03  
**Phase:** ENT-P13 — Security, Privacy, and Compliance  
**Version:** 1.0.0  
**Owner:** IAM Engineer  
**Reviewer:** Security Architect + Application Security Engineer  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable path:** `evidence/phases/ent/ent-p13/03-iam-rbac-hardening.md`

---

## 1. Identity Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                     GLOBAL CONTROL PLANE                          │
│                                                                   │
│  ┌──────────┐   OIDC/SAML   ┌──────────────┐   SCIM   ┌───────┐ │
│  │ External  │ ──────────►  │  Vaeloom IAM  │ ◄──────  │  IdP  │ │
│  │   IdP     │              │  (SSO service)│          │ Okta/ │ │
│  │ Google/MS │ ◄──────────  │  + JWKS       │          │ Azure │ │
│  └──────────┘   ID Token    └──────┬───────┘          └───────┘ │
│                                    │                              │
│                             JWT (RS256)                           │
│                                    ▼                              │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │         FastAPI Auth Middleware Stack                      │   │
│  │  CORS → CSRF → Rate-limit → JWT validate → Tenant → RLS   │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. SSO / OIDC Implementation

### 2.1 Google OAuth 2.0 + OIDC

| Control                         | Implementation                                                        | Standard       | Status      |
| ------------------------------- | --------------------------------------------------------------------- | -------------- | ----------- |
| Authorization code flow         | `GET /auth/google/login` → `/auth/google/callback`                    | RFC 9700 BCP   | IMPLEMENTED |
| PKCE (S256)                     | `code_challenge_method=S256` enforced                                 | RFC 9700 §2.1  | IMPLEMENTED |
| State parameter CSRF protection | Random 32-byte state stored in HTTP-only session cookie               | RFC 9700 §4.3  | IMPLEMENTED |
| Exact redirect URI matching     | `GOOGLE_REDIRECT_URI` env var; no wildcard                            | RFC 9700 §4.1  | IMPLEMENTED |
| ID token validation             | `iss`, `aud`, `exp`, `nonce` checked; `validate_settings()` fail-fast | OIDC Core      | IMPLEMENTED |
| Access token scoped minimally   | `openid profile email` only; no broad Google scopes                   | RFC 9700 §2.3  | IMPLEMENTED |
| Refresh token rotation          | Sliding 90-day refresh; one-time-use rotation                         | RFC 9700 §4.14 | IMPLEMENTED |

### 2.2 Microsoft Azure AD / Entra OIDC

| Control                | Implementation                                                         | Status      |
| ---------------------- | ---------------------------------------------------------------------- | ----------- |
| Multi-tenant Azure app | Tenant-restricted to organization domain                               | IMPLEMENTED |
| Admin consent for SCIM | `Directory.Read.All` requires admin consent; scoped to institution org | IMPLEMENTED |
| Group-to-role mapping  | Azure AD groups → Vaeloom RBAC roles via OIDC `groups` claim           | IMPLEMENTED |

### 2.3 SAML 2.0 (Enterprise Add-on)

| Control                 | Implementation                                                              | Status                |
| ----------------------- | --------------------------------------------------------------------------- | --------------------- |
| SP-initiated SSO        | `services/saml.py` — real `signxml` library; not wired to router (MVP dead) | DESIGNED — NOT_ACTIVE |
| IdP metadata validation | SAML response signature verified with IdP cert                              | DESIGNED — NOT_ACTIVE |
| Audience restriction    | `Audience` element checked against Vaeloom SP entity ID                     | DESIGNED — NOT_ACTIVE |
| Replay prevention       | Assertion ID cache (5-min window)                                           | DESIGNED — NOT_ACTIVE |

> [!NOTE] SAML router wiring is an enterprise track deliverable for ENT-P16.
> `services/saml.py` exists with real `signxml` implementation; it is not yet
> exposed via a live route.

---

## 3. SCIM 2.0 Provisioning

### 3.1 SCIM Endpoint Map

| SCIM Operation  | Endpoint                    | HTTP Method          | Status      |
| --------------- | --------------------------- | -------------------- | ----------- |
| Create user     | `/scim/v2/Users`            | POST                 | IMPLEMENTED |
| Get user        | `/scim/v2/Users/{id}`       | GET                  | IMPLEMENTED |
| Update user     | `/scim/v2/Users/{id}`       | PUT/PATCH            | IMPLEMENTED |
| Deactivate user | `/scim/v2/Users/{id}`       | PATCH `active=false` | IMPLEMENTED |
| Delete user     | `/scim/v2/Users/{id}`       | DELETE               | IMPLEMENTED |
| List users      | `/scim/v2/Users?filter=...` | GET                  | IMPLEMENTED |
| Group sync      | `/scim/v2/Groups`           | GET/POST/PATCH       | IMPLEMENTED |

### 3.2 JIT Provisioning

When SCIM is not used, JIT (Just-In-Time) provisioning creates user accounts on
first successful SSO:

```
SSO callback → validate ID token → lookup user by email
  → if NOT found: auto-create with SSO-provided name/email/IdP sub
  → assign default role: MEMBER
  → assign to institution if domain matches org roster
  → emit USER_JIT_PROVISIONED audit event
```

### 3.3 Deprovisioning

- SCIM `active=false` → `account.status = suspended` within 2 hours
- Refresh tokens revoked immediately on suspension
- Data retained per retention policy; not deleted on deprovisioning
- Agent access suspended immediately (agent JWT validation checks account
  status)

---

## 4. RBAC Model

### 4.1 Role Hierarchy

```
PLATFORM_ADMIN (super)
  └── ORG_ADMIN (institution)
        ├── WORKSPACE_ADMIN (workspace)
        │     ├── MEMBER (regular user)
        │     └── VIEWER (read-only)
        └── BILLING_MANAGER (subscription)

SUPPORT_ESCALATED (break-glass; time-bounded)
```

### 4.2 Permission Matrix

| Resource                           | PLATFORM_ADMIN     | ORG_ADMIN | WORKSPACE_ADMIN | MEMBER | VIEWER |
| ---------------------------------- | ------------------ | --------- | --------------- | ------ | ------ |
| Global tenant config               | RW                 | R         | —               | —      | —      |
| Institution roster                 | RW                 | RW        | —               | —      | —      |
| Workspace config                   | RW                 | RW        | RW              | —      | —      |
| Memory (own)                       | RW                 | RW        | RW              | RW     | R      |
| Memory (others, with ConsentGrant) | R                  | R         | R               | —      | —      |
| Agent execution                    | RW                 | RW        | RW              | RW     | —      |
| Billing                            | RW                 | R         | —               | —      | —      |
| Plugin/MCP install                 | RW                 | RW        | RW              | —      | —      |
| Audit log read                     | R                  | R         | —               | —      | —      |
| Break-glass                        | RW (dual-approval) | —         | —               | —      | —      |

### 4.3 RBAC Enforcement

- **API layer:** `Depends(require_role(roles=[...]))` — FastAPI dependency
  injection per endpoint
- **Database layer:** PostgreSQL RLS policies check
  `current_setting('app.user_id')` and `current_setting('app.workspace_id')` →
  42/42 FORCE RLS
- **Agent layer:** Agent JWT carries `role` claim; `approval_gated_tools()`
  checks role + Tier

### 4.4 Attribute-Based Access Control (ABAC) Extensions

| Attribute           | Use                                                    | Enforcement                                                  |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `purpose_code`      | Limits institutional memory access to declared purpose | `ConsentGrant.purpose_code` checked in query                 |
| `region`            | Restricts data residency                               | Middleware routes to region cell; cross-cell queries blocked |
| `memory_type_scope` | Limits which memory types institution can access       | ConsentGrant scoped to specific types                        |
| `time_bound`        | Expires institutional access automatically             | `ConsentGrant.time_bound` checked at query time              |

---

## 5. Break-Glass Access Protocol

| Step | Control                                                                                                       | Owner           | Evidence                       |
| ---- | ------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------ |
| BG-1 | SRE initiates break-glass request with incident ID                                                            | SRE on-call     | PAM system ticket              |
| BG-2 | Dual approval required (CISO + one of: VP Eng or CTO)                                                         | Approvers       | Signed approval in PAM         |
| BG-3 | Time-bounded credential issued (4h TTL)                                                                       | PAM system      | Credential with `exp` embedded |
| BG-4 | Access logged in append-only audit stream: `actor_id`, `target_tenant`, `incident_id`, `purpose`, `timestamp` | SIEM            | S3 WORM audit log              |
| BG-5 | Credential auto-expires; session terminated                                                                   | PAM + Redis TTL | Redis key expiry               |
| BG-6 | Post-access review required within 24h                                                                        | CISO            | Incident postmortem            |

---

## 6. Cryptographic Standards

| Algorithm   | Use                             | Key size                    | Rotation                                  | Status      |
| ----------- | ------------------------------- | --------------------------- | ----------------------------------------- | ----------- |
| RS256       | JWT signing                     | 2048-bit RSA                | Monthly JWKS rotation                     | IMPLEMENTED |
| AES-256-GCM | Memory DEK encryption at rest   | 256-bit                     | Per-workspace; rotated on erasure request | IMPLEMENTED |
| HMAC-SHA256 | HITL approval token signing     | 256-bit key from Infisical  | Per-approval; one-time-use                | IMPLEMENTED |
| TLS 1.3     | All transport                   | 256-bit ECDH                | TLS session; cert 90-day rotation         | IMPLEMENTED |
| Argon2id    | Password hashing (SSO fallback) | Memory:64MB; iter:3; para:2 | N/A                                       | IMPLEMENTED |
| SHA-256     | Content hash for memory records | 256-bit                     | N/A                                       | IMPLEMENTED |

---

## 7. Secrets Management (Infisical)

| Secret                                     | Storage                   | Rotation  | Access                           | Audit                |
| ------------------------------------------ | ------------------------- | --------- | -------------------------------- | -------------------- |
| JWT signing key                            | Infisical vault           | Monthly   | API process only (env injection) | Infisical access log |
| System 1 Jev API key (`JEV_API_KEY`)       | Infisical vault           | Quarterly | API process only                 | Infisical access log |
| System 2 Ollama API key (`OLLAMA_API_KEY`) | Infisical vault           | Quarterly | API process only                 | Infisical access log |
| Google OAuth client secret                 | Infisical vault           | On breach | Auth service only                | Infisical access log |
| Supabase service role key                  | Infisical vault           | Quarterly | API process only                 | Infisical access log |
| SCIM bearer token                          | Infisical vault (per-org) | 90 days   | SCIM endpoint only               | Infisical + SIEM     |
| MinIO access/secret key                    | Infisical vault           | Quarterly | Storage service only             | Infisical access log |

### SecretManager Protocol

`services/secret_manager.py` implements `SecretManager` protocol with Infisical
backend and env-var fallback. `validate_settings()` on startup fails fast if
`JWT_SECRET_KEY` equals default value.

---

## 8. Zero-Trust Architecture Enforcement

| Layer    | Zero-Trust Control                                | Verification                        |
| -------- | ------------------------------------------------- | ----------------------------------- |
| Network  | TLS 1.3 everywhere; no plaintext internal         | `tests/security/test_tls.py`        |
| Identity | Every request validates JWT; no implicit trust    | Auth middleware 100% coverage       |
| Workload | Agent JWT ≠ User JWT; no scope overlap            | `tests/security/test_agent_auth.py` |
| Data     | RLS on every query; GUC fail-closed               | `tests/test_rls_live_pg.py`         |
| Plugin   | Signed manifest + runtime scope check             | `services/mcp_client_service.py`    |
| Admin    | ConsentGrant required; no implicit admin override | `routes/consent.py`                 |

---

_Deliverable DEL-ENT-P13-03 v1.0.0 — IAM Engineer — 2026-09-29_
