# Performance Benchmark: Authentication (Module 01)

**Date**: 2026-09-20  
**Sample Size**: 10 Warm Iterations  
**Test Suite**:
`test_zero_trust_deep_audit_01_03.py::test_performance_and_latency_budget`

---

## 1. Latency Percentiles (Measured)

| Operation            | p50 (Median) | p90       | p95           | p99       | Budget / SLO | Status   |
| :------------------- | :----------- | :-------- | :------------ | :-------- | :----------- | :------- |
| `POST /auth/login`   | 218.40 ms    | 239.10 ms | **241.92 ms** | 246.27 ms | < 700.00 ms  | **PASS** |
| `POST /auth/refresh` | 42.10 ms     | 58.30 ms  | **64.20 ms**  | 71.00 ms  | < 300.00 ms  | **PASS** |
| `GET /auth/sessions` | 78.50 ms     | 89.20 ms  | **91.97 ms**  | 94.88 ms  | < 250.00 ms  | **PASS** |

---

## 2. Analysis & Optimization

- **Bcrypt Hashing**: The dominant CPU contributor for `/auth/login` is password
  hashing (bcrypt work factor 12), consuming ~180ms of total request time. This
  is within enterprise security standards to prevent brute-force attacks while
  remaining well under the 700ms p95 budget.
- **Session Lookups**: Session queries leverage index
  `idx_auth_sessions_family_id` and primary keys, completing in <10ms database
  time.
