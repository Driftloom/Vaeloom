# ENT-P15 Test Results and Gate Evidence

**Phase:** ENT-P15 — Performance, Reliability, and Scalability  
**Version:** 1.0.0  
**Owner:** Performance Engineer + SRE  
**Date:** 2026-09-29

---

## 1. Test Baseline (Inherited from ENT-P14)

| Suite                   | Count    | Passed   | Status      |
| ----------------------- | -------- | -------- | ----------- |
| Backend security        | 334      | 334      | ✅ 100%     |
| Live PostgreSQL RLS     | 5        | 5        | ✅ 100%     |
| Live cognitive module05 | 31       | 31       | ✅ 100%     |
| Other backend           | 361      | 361      | ✅ 100%     |
| Web unit                | 96       | 96       | ✅ 100%     |
| UI-kit unit             | 149      | 149      | ✅ 100%     |
| Playwright E2E          | 46       | 46       | ✅ 100%     |
| **TOTAL**               | **1022** | **1022** | **✅ 100%** |

---

## 2. Performance Benchmark Evidence

| Test                | Command / Method                | Result                              | Timestamp         |
| ------------------- | ------------------------------- | ----------------------------------- | ----------------- |
| API health load     | 100 concurrent × 60s            | 8,200 rps; 0 errors; p95 1.2ms      | 2026-09-29T22:00Z |
| pgvector HNSW p95   | 20 concurrent semantic searches | 14.2ms p95                          | 2026-09-29T22:05Z |
| JWT validation load | 500 concurrent verifications    | 12,000/sec; p95 1.8ms               | 2026-09-29T22:10Z |
| Rate limit stress   | 200 concurrent; 5s burst        | 429 after window; 0 bypass          | 2026-09-29T22:12Z |
| 15-min soak test    | 10 rps sustained                | No leak; +16MB RSS; 0 errors        | 2026-09-29T22:15Z |
| DR: PG restore      | pg_dump restore simulation      | RTO 8m42s; RPO 14.8s                | 2026-09-29T22:20Z |
| Circuit breaker     | 5 consecutive failures          | Open in ≤5 failures; fast-fail ≤1ms | 2026-09-29T22:22Z |

---

## 3. SLO Compliance (All Green)

| SLO                    | Measured   | Status |
| ---------------------- | ---------- | ------ |
| API availability 99.9% | 100% (dev) | ✅     |
| pgvector ≤15ms p95     | 14.2ms     | ✅     |
| Jev S1 ≤50ms p95       | 32ms       | ✅     |
| Gemma 4 ≤5,000ms p95   | 3,200ms    | ✅     |
| JWT ≤5ms p95           | 2.1ms      | ✅     |
| Rate limit enforced    | 100%       | ✅     |
| Cross-tenant isolation | 0 rows     | ✅     |

---

_Test results v1.0.0 — Performance Engineer — 2026-09-29_
