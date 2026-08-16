# Finding 01 — Middleware Stack Audit

**Verified:** `apps/api/src/api/main.py:93-114` **Date:** 2026-08-16

## Mounted Middleware (11)

Order in `main.py` (reverse execution — last added runs first):

| #   | Middleware                  | File                                | Line |
| --- | --------------------------- | ----------------------------------- | ---- |
| 1   | `CORSMiddleware`            | fastapi built-in                    | 93   |
| 2   | `RateLimitMiddleware`       | `middleware/rate_limit.py:105`      | 100  |
| 3   | `AuthMiddleware`            | `middleware/auth.py:28`             | 106  |
| 4   | `CSRFMiddleware`            | `middleware/csrf.py:52`             | 107  |
| 5   | `SecurityHeadersMiddleware` | `middleware/security_headers.py:8`  | 108  |
| 6   | `CorrelationIDMiddleware`   | `infrastructure/logging.py`         | 109  |
| 7   | `RequestLoggingMiddleware`  | `infrastructure/logging.py`         | 110  |
| 8   | `APIVersionMiddleware`      | `middleware/api_version.py:6`       | 111  |
| 9   | `PromptInjectionMiddleware` | `middleware/prompt_injection.py:43` | 112  |
| 10  | `IdempotencyMiddleware`     | `middleware/idempotency.py:49`      | 113  |
| 11  | `MetricsMiddleware`         | `infrastructure/metrics.py`         | 114  |

## NOT Mounted (3)

| Middleware              | File                         | Why not mounted                                                                              |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `TenantMiddleware`      | `middleware/tenant.py:62`    | Never imported in `main.py`                                                                  |
| `IPAllowlistMiddleware` | `middleware/ip_filter.py:42` | Never imported in `main.py`                                                                  |
| RBAC (not a class)      | `middleware/rbac.py`         | Only DI helpers (`require_role()`, `require_permission()`), no `BaseHTTPMiddleware` subclass |

## Commented Out (2)

| Line | Code                                                                  | Status                                      |
| ---- | --------------------------------------------------------------------- | ------------------------------------------- |
| 135  | `# Instrumentator().instrument(app).expose(app, endpoint="/metrics")` | Commented out                               |
| 136  | `# instrumement_fastapi(app)`                                         | Commented out (note typo: "instru**me**nt") |

## Exception Handlers (2)

| Handler                                              | Line |
| ---------------------------------------------------- | ---- |
| `unified_exception_handler` (StarletteHTTPException) | 116  |
| `generic_exception_handler` (Exception)              | 117  |

## Impact

- **TenantMiddleware not mounted:** No automatic tenant context extraction from
  headers. All tenant isolation is application-level (manual `Depends`).
- **IPAllowlistMiddleware not mounted:** No IP filtering. The middleware exists,
  parses CIDR allowlists, bypasses health/auth paths — but never runs.
- **Prometheus/OTel off:** No `/metrics` endpoint, no distributed tracing on
  FastAPI routes.
