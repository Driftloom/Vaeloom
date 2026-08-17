# Zero-Trust Audit Findings — Vaeloom Codebase

> **Audit date:** 2026-08-17 **Auditor:** Manual code review (zero trust — no
> reliance on prior reports) **Scope:** `apps/api/src/api/` — all routers,
> services, middleware, config **Baseline:** `7a5434a`

---

## CRITICAL Findings

### FINDING-001: SQL Injection Risk in GDPR Service (CRITICAL)

**File:** `services/gdpr.py:51,56,88,93` **Severity:** CRITICAL **OWASP:**
A03:2021-Injection

The GDPR export and delete operations use f-string interpolation to build SQL
queries with table names and column names:

```python
# Line 51 — table name interpolated into SQL
text(f"SELECT * FROM {table} WHERE {fk_col} IN (SELECT id FROM workspaces WHERE user_id = :uid)")

# Line 88 — same pattern for DELETE
text(f"DELETE FROM {table} WHERE {fk_col} IN (SELECT id FROM workspaces WHERE user_id = :uid)")
```

While `table` and `fk_col` currently come from a hardcoded `USER_TABLES` list,
this pattern is dangerous because:

1. If anyone adds a user-controlled value to `USER_TABLES`, it becomes
   exploitable
2. The `fk_col` values (e.g., `user_id`, `workspace_id`) are also interpolated —
   if any are attacker-controllable, full SQL injection is possible
3. The `user_id` parameter IS properly parameterized (`:uid`), but the
   table/column names are not

**Recommendation:** Use a whitelist validation function that checks `table` and
`column` against `information_schema` before interpolation, or switch to
SQLAlchemy Core expression language.

---

### FINDING-002: SQL Injection Risk in Retention Service (CRITICAL)

**File:** `services/retention.py:55,64,70-74,78` **Severity:** CRITICAL
**OWASP:** A03:2021-Injection

Same pattern as FINDING-001. Table names interpolated via f-strings:

```python
# Line 55
text(f"DELETE FROM {table} WHERE created_at < :cutoff{tenant_clause}")

# Lines 70-74 — archive operation
text(f"INSERT INTO {table}_archive SELECT * FROM {table} WHERE created_at < :cutoff{tenant_clause}")
```

The `table` value comes from `resource_map` which is hardcoded, but the pattern
is unsafe.

**Recommendation:** Same as FINDING-001.

---

### FINDING-003: SQL Injection Risk in Approval Service (HIGH)

**File:** `services/approval.py:127,133` **Severity:** HIGH

```python
# Line 127 — condition string interpolated into SQL
text(f"SELECT COUNT(*) FROM agent_approvals WHERE {where}")

# Line 133
text(f"SELECT ... FROM agent_approvals WHERE {where} ORDER BY created_at DESC ...")
```

The `where` clause is built from internal conditions (`"1=1"`,
`"status = :status"`, `"workspace_id = :workspace_id"`), so it's not directly
exploitable. But the pattern is fragile — any future modification that adds user
input to `conditions` would create an injection vector.

**Recommendation:** Use SQLAlchemy Core `and_()` / `select()` instead of raw
f-string SQL.

---

### FINDING-004: Tenant ID Spoofing via Headers (CRITICAL)

**File:** `middleware/tenant.py:78-86` **Severity:** CRITICAL **OWASP:**
A01:2021-Broken Access Control

```python
class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tenant_id = request.headers.get("X-Tenant-ID", "")
        workspace_id = request.headers.get("X-Workspace-ID", "")
        if tenant_id:
            request.state.tenant_id = tenant_id
        if workspace_id:
            request.state.workspace_id = workspace_id
        TenantContext.set(tenant_id or None, workspace_id or None)
```

**The tenant_id and workspace_id are read directly from request headers without
any validation against the JWT token.** An attacker can:

1. Authenticate as User A (JWT with tenant_id=X)
2. Send a request with `X-Tenant-ID: <attacker-controlled-UUID>`
3. The middleware sets the tenant context to the attacker's value
4. RLS policies use this context — but the JWT `tenant_id` is not cross-checked

The auth middleware sets `request.state.tenant_id = payload.get("tenant_id")`
(line 50), but the tenant middleware **overwrites** it with the header value
(line 82). This means the JWT's tenant_id is discarded.

**Recommendation:** TenantMiddleware should either:

1. Read tenant_id from the JWT (not headers), or
2. Validate that the header value matches the JWT's tenant_id

---

### FINDING-005: CSRF Bypass via XHR Header (HIGH)

**File:** `middleware/csrf.py:59-63` **Severity:** HIGH **OWASP:**
A01:2021-Broken Access Control

```python
is_xhr = request.headers.get("X-Requested-With") == "XMLHttpRequest"
has_api_key = bool(request.headers.get("X-API-Key"))
if is_xhr or has_api_key:
    return await call_next(request)
```

Any request with `X-Requested-With: XMLHttpRequest` header completely bypasses
CSRF protection. This header is trivially set by an attacker from a cross-origin
form submission. The `XMLHttpRequest` check is an outdated anti-pattern — modern
CSRF attacks use `fetch()` or `navigator.sendBeacon()` which can set this
header.

**Recommendation:** Remove the XHR bypass. CSRF tokens should be required for
all mutating requests regardless of the X-Requested-With header. The API key
bypass is acceptable since API keys represent programmatic access.

---

### FINDING-006: GDPR Export Exposes Sensitive Columns (HIGH)

**File:** `services/gdpr.py:44-72` **Severity:** HIGH

The `export_user_data` method does `SELECT * FROM {table}` for every table,
which means:

- `users` table: exports `password_hash`, `email`, `display_name`
- `api_keys` table: exports hashed API keys
- `connectors` table: exports `access_token`, `refresh_token` (OAuth tokens)
- `subscriptions` table: exports `stripe_*` fields

This violates the principle of data minimization (GDPR Art. 5(1)(c)) and could
expose credentials/tokens in the export.

**Recommendation:** Use column whitelists per table instead of `SELECT *`.

---

### FINDING-007: No Session Logout Endpoint (MEDIUM)

**File:** N/A — missing **Severity:** MEDIUM

There is no `/api/v1/auth/logout` endpoint. Once a JWT is issued, it remains
valid until expiry (1 hour). The `auth_sessions` table tracks sessions, but
there's no way to:

- Invalidate a specific session
- Invalidate all sessions for a user (e.g., on password change)
- Log out (client-side token deletion only)

**Recommendation:** Add logout endpoint that marks the session as revoked in
`auth_sessions`.

---

### FINDING-008: Hardcoded Default Secrets (MEDIUM)

**File:** `config.py:19,59` **Severity:** MEDIUM

```python
jwt_secret: str = "change-me-in-production"
storage_secret_key: str = "minioadmin"
```

While `validate_settings()` catches the JWT secret default, it does NOT catch
the storage secret key default (`minioadmin`). An attacker with access to the
database and object storage could use the default MinIO credentials to access
stored files.

**Recommendation:** Add validation for `storage_secret_key != "minioadmin"` in
`validate_settings()`.

---

### FINDING-009: Alembic Migration Runs on Every Startup (MEDIUM)

**File:** `main.py:80-99` **Severity:** MEDIUM

```python
async def lifespan(app: FastAPI):
    ...
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        from alembic.config import Config
        from alembic import command
        alembic_cfg = Config(alembic_ini)
        command.upgrade(alembic_cfg, "head")
```

Both `Base.metadata.create_all` AND `alembic upgrade head` run on every startup.
This is problematic because:

1. `create_all` can create tables that Alembic doesn't know about (schema drift)
2. Running migrations on startup in production is risky — a bad migration kills
   the service
3. If Alembic fails, it falls through to the custom migration runner (line 95),
   which could create conflicting schema

**Recommendation:** Remove `create_all` from production startup. Run Alembic
separately as a deployment step. Only use `create_all` in test setup.

---

### FINDING-010: Generic Exception Handler Swallows Errors (MEDIUM)

**File:** `middleware/exception_handler.py:20-31` **Severity:** MEDIUM

```python
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {"code": 500, "message": "Internal server error", "details": None},
        },
    )
```

This catches ALL unhandled exceptions and returns a generic 500. The actual
exception is:

1. Not logged (no `logger.exception()` call)
2. Not included in the response (even in debug mode)
3. Not correlated with the request (no trace_id in response body)

**Recommendation:** Add `logger.exception("Unhandled exception")` and include
`trace_id` from correlation middleware in the response.

---

### FINDING-011: CSRF Token Store is In-Memory Only (MEDIUM)

**File:** `middleware/csrf.py:27-46` **Severity:** MEDIUM

```python
class CSRFTokenStore:
    def __init__(self):
        self._tokens: dict[str, float] = {}
```

The CSRF token store is a Python dict in memory. In a multi-worker deployment
(e.g., multiple uvicorn workers), tokens generated by one worker are invisible
to other workers. This means:

1. Token generated by Worker A → client sends CSRF token → request routed to
   Worker B → CSRF validation fails

**Recommendation:** Use Redis-backed token store (similar to rate limiting) or
accept that CSRF only works in single-worker mode.

---

### FINDING-012: SAML Signature Validation Not Implemented (LOW)

**File:** `services/saml.py:58` **Severity:** LOW (MVP scope: SAML is
enterprise)

```python
# TODO: Add real SAML signature validation when library configured (e.g. signxml)
```

SAML responses are parsed but signatures are not validated. This is acceptable
for MVP since SAML is enterprise-gated, but must be fixed before SAML is
enabled.

---

### FINDING-013: CORS Allows Localhost in All Environments (LOW)

**File:** `config.py:48` **Severity:** LOW

```python
allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
```

The default CORS origins include localhost. While `validate_settings()` doesn't
check this, the origins are used directly. In production, these should be
replaced with the actual domain.

**Recommendation:** Add a production check in `validate_settings()` that warns
if `localhost` is in `allowed_origins` when `service_environment != "local"`.

---

### FINDING-014: Approval Endpoint Missing Workspace Isolation (MEDIUM)

**File:** `services/approval.py:107-148` **Severity:** MEDIUM

The `list_approvals` endpoint accepts an optional `workspace_id` parameter but
doesn't enforce it against the authenticated user's workspace access. A user
could list approvals for any workspace by passing an arbitrary `workspace_id`.

The `get_approval` endpoint (line 249-257) also doesn't check workspace
membership — any authenticated user can view any approval by ID.

**Recommendation:** Filter approvals by the authenticated user's workspace(s) or
validate workspace access before returning results.

---

### FINDING-015: Gmail Webhook Has No Signature Verification (MEDIUM)

**File:** `routers/gmail.py:97-112` **Severity:** MEDIUM

The Gmail push webhook endpoint accepts notifications based on
`X-Goog-Channel-ID` header only. It does NOT verify:

1. That the notification actually came from Google (no signature verification)
2. The `X-Goog-Signature` header (Google sends this for verification)
3. The `X-Goog-Channel-Token` (for additional verification)

An attacker could forge Gmail push notifications to trigger processing of fake
messages.

**Recommendation:** Implement Google's push notification verification
(HMAC-SHA256 of notification body with channel token).

---

### FINDING-016: No Input Validation on Agent Execute (MEDIUM)

**File:** `routers/agents.py` (not fully read, but pattern observed)
**Severity:** MEDIUM

The agent execute endpoint accepts user input that gets passed to LLM prompts.
While `PromptInjectionMiddleware` exists, it's a basic pattern-matching check.
The OWASP Agentic Top 10 (ASI01-ASI10) identifies agent goal hijack and tool
misuse as critical risks.

**Recommendation:** Implement ADR-031 (Input Sanitization for Retrieved Content)
and add structured output validation for agent responses.

---

### FINDING-017: SDK Coverage at 10% (LOW)

**File:** `sdk/typescript/`, `sdk/python/` **Severity:** LOW (design gap, not
security)

The TypeScript and Python SDKs cover only ~8 of 79 API endpoints (10%). This
means:

1. Most API consumers must use raw HTTP calls
2. No type safety for most operations
3. No automatic idempotency key handling
4. No automatic retry on 429

**Recommendation:** Generate SDKs from OpenAPI spec at P10-P12.

---

### FINDING-018: No Rate Limiting on Auth Endpoints (MEDIUM)

**File:** `middleware/rate_limit.py:15` **Severity:** MEDIUM

```python
SKIP_PATHS = frozenset({"/health", "/health/ready", "/docs", "/openapi.json", "/redoc", "/metrics", "/csrf-token"})
```

Auth endpoints (`/api/v1/auth/login`, `/api/v1/auth/signup`) are NOT in
`SKIP_PATHS`, so they ARE rate-limited. However, the default limit is 100
requests/60s per client IP, which is generous for auth endpoints. An attacker
could attempt 100 password guesses per minute.

**Recommendation:** Add stricter rate limits for auth endpoints (e.g., 10
requests/60s for login, 5 requests/hour for signup).

---

### FINDING-019: Database Connection Pool Configuration (LOW)

**File:** `database.py:8-14` **Severity:** LOW

```python
engine = create_async_engine(
    settings.database__url,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=10,
    echo=settings.service_environment == "local",
)
```

The pool size (20) and max overflow (10) are hardcoded. For a PaaS deployment
with connection limits, this could exhaust the database connection pool under
load.

**Recommendation:** Make pool_size and max_overflow configurable via settings.

---

### FINDING-020: Retention Auto-Deletes Conflict with User-Driven Policy (MEDIUM)

**File:** `services/retention.py` **Severity:** MEDIUM

The retention scheduler auto-deletes records from `events`, `audit_events`,
`usage_records`, and `agent_executions` based on configured `max_age_days`. This
conflicts with the user-driven "indefinite grace" policy documented in P07
(BQ-P07-01). Users may expect their data to be retained until they explicitly
delete it.

**Recommendation:** Align retention policies with user-facing data retention
promises. Add user notification before auto-deletion.

---

## Summary

| Severity  | Count  | Key Issues                                                                                                                            |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL  | 4      | SQL injection patterns, tenant spoofing                                                                                               |
| HIGH      | 3      | CSRF bypass, GDPR data exposure, SQL injection in approval                                                                            |
| MEDIUM    | 9      | No logout, hardcoded secrets, Alembic on startup, no workspace isolation, Gmail webhook, agent input, rate limits, retention conflict |
| LOW       | 4      | SAML stub, CORS localhost, SDK coverage, pool config                                                                                  |
| **Total** | **20** |                                                                                                                                       |

## Priority Remediation Order

1. **Immediate (P11):** FINDING-004 (tenant spoofing), FINDING-001/002 (SQL
   injection patterns), FINDING-005 (CSRF bypass)
2. **Before production (P13):** FINDING-006 (GDPR export), FINDING-007 (logout),
   FINDING-008 (secret validation), FINDING-010 (error logging), FINDING-014
   (workspace isolation)
3. **Before release (P15):** FINDING-009 (Alembic startup), FINDING-011 (CSRF
   store), FINDING-015 (Gmail webhook), FINDING-018 (auth rate limits)
4. **Deferred:** FINDING-012 (SAML), FINDING-013 (CORS), FINDING-016 (agent
   input), FINDING-017 (SDK), FINDING-019 (pool config), FINDING-020 (retention)
