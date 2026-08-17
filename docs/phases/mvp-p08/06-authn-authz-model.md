# MVP-P08 — 06. AuthN / AuthZ Model (DEL-MVP-P08-04)

> Owner: Security Architect · Re-run 2026-08-17. Existing: JWT auth (ADR-007),
> refresh rotation, CSRF, tenant middleware, RBAC, IP filter, API keys, SSO.
> Deltas per RFC 9700 (EXT-06) + NFR-16/h16 + ADR-025.

## 1. Authentication

| Flow                  | Contract                                                                                                                     | Status      | Evidence                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------- |
| Password signup/login | email+password (bcrypt) → access JWT (1hr) + rotating refresh (30d)                                                          | IMPLEMENTED | `/api/v1/auth/*` exists                   |
| Refresh               | single-flight rotation; reuse detection → revoke family                                                                      | IMPLEMENTED | `services/auth_service.py`                |
| SSO                   | backend `sso.py` (Google/Microsoft) — UI deferred (enterprise); endpoint exists                                              | IMPLEMENTED | `/auth/sso/{provider}`                    |
| SAML                  | Response parsing exists but XML signature validation is STUB                                                                 | STUB        | `services/saml.py` — TODO comment         |
| Connector OAuth       | RFC 9700: PKCE (S256), exact redirect match, state binding, least-privilege scopes, refresh-token rotation + reuse detection | PARTIAL     | `services/gmail_service.py` — basic OAuth |
| API keys              | `X-API-Key` for SDK; `vael_` prefix + 32-byte random; bcrypt hash; rotation with version tracking; max 90-day age            | IMPLEMENTED | `services/api_keys.py`                    |

### Authentication gaps (design deltas)

| Gap                                | Impact                     | Target | Priority |
| ---------------------------------- | -------------------------- | ------ | -------- |
| No MFA/TOTP support                | Weakened account security  | P13    | MED      |
| No account lockout                 | Brute-force risk           | P13    | MED      |
| No password complexity enforcement | Weak passwords             | P13    | MED      |
| No email verification              | Unverified accounts        | P13    | MED      |
| No session logout endpoint         | Cannot invalidate sessions | P11    | HIGH     |
| SAML signature validation stub     | SAML SSO insecure          | P14    | LOW      |

## 2. Authorization

| Layer             | Mechanism                                                                              | Scope binding                      | Status      |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------------------------- | ----------- |
| Identity claims   | JWT: sub, tenant_id, workspace_id, roles, exp                                          | set from token, never client input | IMPLEMENTED |
| Request authz     | auth middleware → `request.state.tenant_id/workspace_id`                               | per request                        | IMPLEMENTED |
| Data authz        | app-level filters + RLS (P07 0005, fail-closed)                                        | per row                            | IMPLEMENTED |
| RBAC              | rbac middleware; MVP roles: owner only; enterprise roles gated                         | per workspace                      | IMPLEMENTED |
| Workload identity | HMAC service tokens (ADR-025) for worker↔API, API↔connectors; no user creds in workers | service scope                      | PROPOSED    |
| Approval gate     | FR-50/51 — consequential endpoints check approval_request state before execute         | per action                         | IMPLEMENTED |

### RBAC roles (existing)

| Role   | Level | Permissions                                        |
| ------ | ----- | -------------------------------------------------- |
| viewer | 1     | Read-only access to workspace resources            |
| editor | 2     | Create, update, delete workspace resources         |
| admin  | 3     | Full workspace access + user management + settings |

### Approval gate (IMPLEMENTED)

- `ApprovalManager` in `services/approval.py`
- Auto-expiry of stale PENDING approvals via `_expire_stale()`
- All mutations emit audit events
- Consequential actions require approval before execution
- Release-blocking rule: approval API ships before any send-capable path (P05
  restriction 2)

## 3. CSRF & transport

| Component        | Status      | Evidence                                                |
| ---------------- | ----------- | ------------------------------------------------------- |
| CSRF middleware  | IMPLEMENTED | `middleware/csrf.py` — HMAC-signed tokens, 1hr TTL      |
| CSRF skip-list   | CORRECT     | `SKIP_PREFIXES = /api/v1/auth` — auth-only, verified    |
| CORS             | IMPLEMENTED | Restricted origins; security headers; CSP with dev URLs |
| Security headers | IMPLEMENTED | X-Content-Type-Options, X-Frame-Options, etc.           |

### CSRF constraint (CRITICAL — AGENTS.md item 4)

**DO NOT widen the CSRF skip-list without security review.** Current skip:
`/api/v1/auth` only. Exemptions: XHR (`X-Requested-With: XMLHttpRequest`) and
API key auth.

## 4. Session & secret handling

| Component             | Status      | Evidence                                                                          |
| --------------------- | ----------- | --------------------------------------------------------------------------------- |
| Refresh token storage | IMPLEMENTED | hashed at rest; `auth_sessions` table                                             |
| Secret management     | IMPLEMENTED | SecretManager protocol (Infisical/env fallback); `validate_settings()` fails fast |
| Secrets in frontend   | SAFE        | `NEXT_PUBLIC_*` only; no secrets in bundle                                        |
| Audit logging         | IMPLEMENTED | auth events → audit service; no passwords/tokens in logs                          |
| Logging redaction     | PARTIAL     | Passwords/tokens excluded; P17 full redaction                                     |

## 5. Threat mapping (P05 §6)

| Threat                     | Control                                                            | Status      |
| -------------------------- | ------------------------------------------------------------------ | ----------- |
| Identity/privilege abuse   | Constrained tokens + rotation + RLS + rate limits                  | IMPLEMENTED |
| Approval bypass            | ADR-021 persistence + replay guard                                 | IMPLEMENTED |
| Token replay               | Rotation + single-flight                                           | IMPLEMENTED |
| Cross-tenant access        | Composite scope keys + RLS                                         | IMPLEMENTED |
| Tool misuse                | Tool allowlists per agent; no bypass for consequential action      | IMPLEMENTED |
| Memory/context poisoning   | Input sanitization designed (ADR-031) but NOT implemented          | PROPOSED    |
| Supply chain (plugins)     | Subprocess isolation + permission manifest + no network by default | IMPLEMENTED |
| Workload identity spoofing | HMAC service tokens (ADR-025) designed but NOT implemented         | PROPOSED    |

## 6. Design deltas (remaining gaps)

| Gap                                          | Impact                                       | Target | Priority |
| -------------------------------------------- | -------------------------------------------- | ------ | -------- |
| Session logout endpoint missing              | Cannot invalidate sessions                   | P11    | HIGH     |
| No structured error codes                    | Clients can't programmatically handle errors | P11    | HIGH     |
| Workload identity not implemented            | Worker↔API auth uses shared secrets          | P11    | HIGH     |
| No `Idempotency-Key` on SDK                  | SDK retries may duplicate                    | P12    | MED      |
| Input sanitization (ADR-031) not implemented | Prompt injection risk                        | P12    | HIGH     |
| SAML signature validation stub               | SAML SSO insecure                            | P14    | LOW      |
