# MVP-P08 — 06. AuthN / AuthZ Model (DEL-MVP-P08-04)

> Owner: Security Architect · Existing: JWT auth (ADR-007), refresh rotation,
> CSRF, tenant middleware, RBAC, IP filter, service-auth (TS pkg). Deltas per
> RFC 9700 (EXT-06) + NFR-16/h16 + ADR-025.

## 1. Authentication

| Flow                  | Contract                                                                                                                                         | Evidence                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Password signup/login | email+password (bcrypt, exists) → access JWT (15m) + rotating refresh (30d)                                                                      | `/api/v1/auth/*` exists                 |
| Refresh               | single-flight rotation (web client exists); reuse detection → revoke family                                                                      | exists                                  |
| SSO                   | backend `sso.py` (Google/Microsoft) — UI deferred (enterprise); endpoint exists                                                                  | `/auth/sso/{provider}`                  |
| Connector OAuth       | RFC 9700: PKCE (S256), exact redirect match, state binding, least-privilege scopes, refresh-token rotation + reuse detection, constrained tokens | delta P11 on gmail_client + connectors  |
| API keys              | `X-API-Key` for SDK (exists)                                                                                                                     | scope-limited, rotatable (P13 rotation) |

## 2. Authorization

| Layer             | Mechanism                                                                                         | Scope binding                      |
| ----------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Identity claims   | JWT: sub, tenant_id, workspace_id, roles, exp                                                     | set from token, never client input |
| Request authz     | auth middleware → `request.state.tenant_id/workspace_id` (exists)                                 | per request                        |
| Data authz        | app-level filters (exists) + **RLS (P07 0005, fail-closed)**                                      | per row                            |
| RBAC              | rbac middleware (exists); MVP roles: owner only; enterprise roles gated                           | per workspace                      |
| Workload identity | HMAC service tokens (ADR-025) for worker↔API, API↔connectors; no user creds in workers (NFR-16)   | service scope                      |
| Approval gate     | FR-50/51 — consequential endpoints check approval_request state before execute (release-blocking) | per action                         |

## 3. CSRF & transport

- CSRF middleware (exists): token endpoint `/csrf-token`;
  `SKIP_PREFIXES = /api/v1/auth` verified correct — DO NOT widen without review
  (AGENTS.md critical item 4).
- CORS: restricted origins (exists); security headers (exists); CSP adds dev
  localhost URLs conditionally (exists) — no change to prod policy.

## 4. Session & secret handling

- Refresh tokens: hashed at rest; auth_sessions table (exists).
- Secrets: SecretManager protocol (Infisical/env fallback); fail-fast
  `validate_settings()` (exists); no secrets in frontend bundle (NEXT_PUBLIC_*
  only).
- Audit: auth events (login, refresh, oauth grant, approval decisions) → audit
  service; no passwords/tokens in logs (logging redaction at P17).

## 5. Threat-mapped (P05 §6)

Identity/privilege abuse → constrained tokens + rotation + RLS + rate limits ·
approval bypass → ADR-021 persistence + replay guard · token replay → rotation +
single-flight · cross-tenant → composite scope keys + RLS.
