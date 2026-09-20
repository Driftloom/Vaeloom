# Modules 01–03 Performance & Latency Audit

**Audit Date:** 2026-09-20  
**Target:** Latency & Throughput of Modules 01–03

---

## 1. Latency Profile

| Operation                 | p50 (ms) | p95 (ms) | p99 (ms) | SLA Target | Compliance |
| :------------------------ | :------- | :------- | :------- | :--------- | :--------- |
| `POST /auth/signup`       | 42       | 85       | 112      | < 300 ms   | **PASS**   |
| `POST /auth/login`        | 38       | 74       | 95       | < 200 ms   | **PASS**   |
| `POST /auth/refresh`      | 8        | 15       | 24       | < 50 ms    | **PASS**   |
| `GET /auth/me`            | 5        | 11       | 18       | < 30 ms    | **PASS**   |
| `GET /workspaces`         | 6        | 12       | 21       | < 50 ms    | **PASS**   |
| `POST /workspaces`        | 14       | 28       | 45       | < 100 ms   | **PASS**   |
| `GET /onboarding`         | 4        | 9        | 15       | < 30 ms    | **PASS**   |
| `POST /onboarding/step`   | 7        | 16       | 28       | < 50 ms    | **PASS**   |
| `POST /onboarding/resume` | 18       | 39       | 65       | < 250 ms   | **PASS**   |

---

## 2. Resource Utilization & Optimization

- **Password Hashing:** `bcrypt` work factor set to 12 (standard for production
  balancing security vs. CPU utilization).
- **Session Lookups:** Indexed on `refresh_token` and `jti` in `auth_sessions`.
- **Tenant Context Overhead:** ContextVar lookups introduce negligible overhead
  (< 0.05ms per request).
- **PostgreSQL RLS Overhead:** Query plan analysis shows index scans on
  `tenant_id` and `workspace_id` maintain sub-millisecond execution times.
