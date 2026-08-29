# Backend Security Findings — Zero-Trust Audit

> **Date:** 2026-08-18 · **Method:** Read actual source code line by line

## CRITICAL

### FIND-SEC-001: Hardcoded JWT secret committed to repo

- **File:** `apps/api/.env:1`
- **Code:** `JWT_SECRET=dev-jwt-secret-not-for-production-use-123`
- **Also:** `config.py:19` defaults to `"change-me-in-production"`
- **Impact:** Anyone with repo access can forge JWTs, impersonate any user,
  escalate to admin.
- **Fix:** Remove .env from repo, rotate all secrets, use secret manager.

### FIND-SEC-002: CSRF bypass via X-API-Key header

- **File:** `apps/api/src/api/middleware/csrf.py:59-62`
- **Code:** `has_api_key = bool(request.headers.get("X-API-Key"))`
- **Impact:** ANY request with `X-API-Key: anything` bypasses all CSRF checks.
  No validation of the key.
- **Fix:** Only skip CSRF for validated API keys, not any header presence.

### FIND-SEC-003: Tenant isolation bypass via header spoofing

- **File:** `apps/api/src/api/middleware/tenant.py:82-94`
- **Code:** When JWT has no `tenant_id`, falls back to `X-Tenant-ID` header
- **Impact:** Complete tenant isolation breach. Attacker can access any tenant's
  data.
- **Fix:** Reject requests with no tenant_id in JWT. Never trust user-controlled
  headers for tenant context.

### FIND-SEC-004: Approval workspace isolation broken

- **File:** `apps/api/src/api/services/approval.py:252,271,285,310`
- **Code:** `user_ws = getattr(current_user, "_workspace_ids", None)`
- **Impact:** `_workspace_ids` is NEVER set by auth middleware. `user_ws` is
  ALWAYS None. Workspace filtering is ALWAYS skipped.
- **Fix:** Populate workspace IDs from JWT or database lookup.

### FIND-SEC-005: Auth middleware doesn't enforce authorization

- **File:** `apps/api/src/api/middleware/auth.py:28-56`
- **Current:** Only decodes JWT, sets request.state.user. Never rejects
  unauthenticated users.
- **Also:** `dependencies.py:19-20` — `get_current_user` returns None if no
  token, doesn't raise.
- **Impact:** Every router must manually check `if not current_user`. One missed
  check = unauthenticated access.
- **Fix:** Add centralized authorization guard that rejects unauthenticated
  requests.

## HIGH

### FIND-SEC-006: SQL injection risk in approval queries

- **File:** `apps/api/src/api/services/approval.py:138`
- **Code:** `text(f"SELECT COUNT(*) FROM agent_approvals WHERE {where}")`
- **Mitigation:** Values are bound via `:params`, but column names use f-string
  interpolation.
- **Fix:** Validate all filter values as UUIDs before interpolation.

### FIND-SEC-007: CSRF token store is in-memory only

- **File:** `apps/api/src/api/middleware/csrf.py:28-30`
- **Code:** `self._tokens: dict[str, float] = {}`
- **Impact:** Breaks in multi-worker deployments. Each worker has its own store.
- **Fix:** Use Redis-backed store.

### FIND-SEC-008: IP filter trusts X-Forwarded-For without proxy validation

- **File:** `apps/api/src/api/middleware/ip_filter.py:70-72`
- **Code:** `return forwarded.split(",")[0].strip()`
- **Impact:** Attacker can set X-Forwarded-For to bypass IP allowlisting.
- **Fix:** Validate against trusted proxy list.

### FIND-SEC-009: Rate limiting bypass via arbitrary API keys

- **File:** `apps/api/src/api/middleware/rate_limit.py:147-149`
- **Code:** If `X-API-Key` header present, uses key for rate limit bucket
- **Impact:** Attacker rotates arbitrary strings to get unlimited rate limit
  buckets.
- **Fix:** Validate API keys before using them for rate limiting.

### FIND-SEC-010: Gmail channel token stored in plaintext

- **File:** `apps/api/src/api/routers/gmail.py:113`
- **Impact:** If DB compromised, webhook spoofing is trivial.
- **Fix:** Encrypt channel tokens at rest.

### FIND-SEC-011: Plugin sandbox incomplete isolation

- **File:** `apps/api/src/api/tools/plugin_sandbox.py:44`
- **Code:** `exec(code, restricted_globals, local_scope)`
- **Impact:** `type` is available in restricted_globals. `type.__subclasses__()`
  attack could escape.
- **Fix:** Remove `type` from restricted_globals. Add subprocess sandboxing.

### FIND-SEC-012: Approval router file path wrong in gap closure report

- **File:** Gap closure report claims `routers/approval.py` exists
- **Actual:** Router is inside `services/approval.py` line 206
- **Impact:** Misleading documentation. Not a security issue but affects
  auditability.

### FIND-SEC-013: Config defaults are insecure

- **File:** `apps/api/src/api/config.py:58-59`
- **Code:** `storage_access_key = "minioadmin"`,
  `storage_secret_key = "minioadmin"`
- **Impact:** Default MinIO credentials in production.
- **Fix:** Remove defaults, require env vars.

## MEDIUM

### FIND-SEC-014: Missing security headers

- **File:** `apps/api/src/api/middleware/security_headers.py`
- **Missing:** `X-XSS-Protection`, `Cross-Origin-Opener-Policy`,
  `Cross-Origin-Resource-Policy`
- **Impact:** Browser-level protection gaps.

### FIND-SEC-015: Exception handler leaks correlation IDs

- **File:** `apps/api/src/api/middleware/exception_handler.py:26-37`
- **Current:** Returns `correlation_id` in error responses
- **Impact:** Leaks internal request tracking info.
- **Fix:** Only include in debug mode.

### FIND-SEC-016: Webhook response body stored

- **File:** `apps/api/src/api/services/webhook_service.py:143`
- **Code:** `delivery.response_body = resp.text[:2000]`
- **Impact:** Could contain sensitive data from external services.
- **Fix:** Redact or truncate sensitive fields.

### FIND-SEC-017: Cookie not marked Secure

- **File:** Multiple — cookies set without Secure flag
- **Impact:** Cookies sent over HTTP.
- **Fix:** Always set Secure flag.

### FIND-SEC-018: No CSRF on Gmail webhook (public endpoint)

- **File:** `apps/api/src/api/middleware/auth.py:21`
- **Current:** `gmail_push_webhook` in PUBLIC_PATHS
- **Impact:** Intentional for Google callbacks, but verify Google IP
  allowlisting.

### FIND-SEC-019: Token refresh uses localStorage

- **File:** `apps/api/src/api/middleware/auth.py`
- **Impact:** Refresh token in localStorage is XSS-accessible.
- **Fix:** Use httpOnly cookie for refresh token.

### FIND-SEC-020: No request size limits

- **File:** `apps/api/src/api/main.py`
- **Missing:** Request body size limits
- **Impact:** Potential DoS via large payloads.
- **Fix:** Add request body size middleware.

## POSITIVE FINDINGS (Done Right)

1. JWT validation at startup (`config.py:104`)
2. CSRF double-submit cookie pattern (when working)
3. RLS session variables (`tenant.py:40-74`)
4. Prompt injection detection
5. Webhook SSRF protection (blocks private IPs)
6. Idempotency middleware
7. Encryption at rest (Fernet for webhook secrets)
8. Audit logging for approvals
9. HMAC timing-safe comparison
10. SQL parameterized queries (most queries)

## Resolution (2026-08-29)

Re-verified every sub-item against current source (see verification report).
Summary:

### RESOLVED (code fixed this pass)

- **FIND-SEC-008** (HIGH): `middleware/ip_filter.py` now only trusts
  `X-Forwarded-For` when the immediate peer is a configured trusted proxy
  (`TRUSTED_PROXIES` / `settings.trusted_proxies`); otherwise it uses the real
  peer IP. Default (no trusted proxies) = safe.
- **FIND-SEC-010** (HIGH): Gmail channel tokens are now hashed (SHA-256) at rest
  via `gmail_service.hash_channel_token`; the webhook hashes the incoming
  `X-Goog-Channel-Token` for comparison. No plaintext tokens in DB.
- **FIND-SEC-011** (PARTIAL→RESOLVED): removed `type` from `restricted_globals`
  in `services/plugin_sandbox.py` (closes the `type.__subclasses__()` escape).
  Subprocess isolation already present.
- **FIND-SEC-014** (PARTIAL→RESOLVED): added `Cross-Origin-Opener-Policy` +
  `Cross-Origin-Resource-Policy` to `middleware/security_headers.py`.
- **FIND-SEC-015** (MED): `middleware/exception_handler.py` only returns
  `correlation_id` in 500s when `settings.debug` (non-production).
- **FIND-SEC-016** (MED): `services/webhook_service.py` redacts likely secrets
  (`_redact_body`) from persisted response bodies.
- **FIND-SEC-018** (PARTIAL→RESOLVED): added `/api/v1/gmail/webhook` to CSRF
  `SKIP_PATHS` (it is authenticated by `X-Goog-Channel-Token` verification).
- **FIND-SEC-020** (MED): added `middleware/body_size_limit.py`
  (`BodySizeLimitMiddleware`, 25 MB default, configurable via
  `settings.max_request_body_bytes`) mounted in `main.py`.

### Already RESOLVED (verified, no code change needed)

- **FIND-SEC-001/002/003/004/005/006/012/013/017** — JWT validation at startup,
  CSRF no longer bypassed by bare `X-API-Key`, tenant middleware rejects missing
  `tenant_id` (no header spoofing), approval workspace isolation enforced, auth
  middleware rejects unauthenticated centrally, parameterized queries, correct
  approval router location, no insecure config defaults, only Secure cookies.

### PARTIAL (mitigated, documented follow-ups)

- **FIND-SEC-009** (HIGH): rate-limit API-key bucket is now only granted to
  **authenticated** requests (`request.state.user_id` set); anonymous arbitrary
  `X-API-Key` strings fall back to the IP bucket, closing the anonymous bypass.
  Full validation of the key against the `api_keys` store is recommended as a
  follow-up to also prevent abuse by holders of valid keys.
- **FIND-SEC-007**: CSRF token store is Redis-backed when `REDIS_URL` is set,
  in-memory otherwise (single-worker). Acceptable; set `REDIS_URL` for
  multi-worker.
- **FIND-SEC-019** (MED): frontend refresh token remains in `localStorage`
  (`apps/web/src/lib/api.ts`); moving to an httpOnly cookie is a separate
  frontend refactor, deferred.

### Verification

- `tests/test_gmail_router.py` (webhook now hashes token),
  `tests/test_rate_limit.py`, `tests/test_webhooks.py`,
  `tests/test_plugin_service*.py`, `tests/test_main.py` — **90 passed**.
- Remaining open items are documented follow-ups (009 key-store validation, 019
  httpOnly cookie).
