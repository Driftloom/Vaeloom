# Modules 01–03 Observability & Telemetry

**Audit Date:** 2026-09-20  
**Scope:** OpenTelemetry, Prometheus Metrics, and Structured Logging

---

## 1. Structured Logging & Correlation IDs

Every incoming request passes through `CorrelationIDMiddleware`, injecting
`X-Correlation-ID` into request state and all emitted log lines:

```json
{
  "timestamp": "2026-09-20T11:32:00Z",
  "level": "INFO",
  "logger": "vaeloom.api.auth",
  "correlation_id": "41d4dc12-f65f-4836-b767-3ff75a030b16",
  "tenant_id": "8f1a23e4-...",
  "workspace_id": "3a7b9c1d-...",
  "user_id": "5c9d2e1f-...",
  "message": "User login succeeded",
  "ip": "192.168.1.50"
}
```

---

## 2. Prometheus Metrics

- `http_requests_total{method, status_code, path}`: Tracks traffic volume and
  HTTP status distribution.
- `http_request_duration_seconds{path}`: Tracks latency percentiles.
- `auth_login_attempts_total{status}`: Tracks successful vs. failed logins.
- `auth_rate_limit_exceeded_total`: Incremented when HTTP 429 is served.
- `onboarding_steps_completed_total{step}`: Tracks user progression through
  wizard steps.
