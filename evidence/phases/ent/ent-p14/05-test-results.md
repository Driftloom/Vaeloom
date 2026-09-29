# ENT-P14 Test Results Bundle

**Phase:** ENT-P14 — Testing and Quality Engineering  
**Version:** 1.0.0  
**Owner:** QA Lead  
**Date:** 2026-09-29  
**Environment:** API :8000 · Web :3000 · PostgreSQL 16.4 · MinIO :9000

---

## 1. Live Infrastructure Health

| Service         | Endpoint                               | Result                                                      | Timestamp            |
| --------------- | -------------------------------------- | ----------------------------------------------------------- | -------------------- |
| FastAPI backend | `http://127.0.0.1:8000/health`         | `{"status":"ok","service":"vaeloom-api","version":"0.2.0"}` | 2026-09-29T22:00:00Z |
| Next.js web     | `http://localhost:3000/api/health`     | `{"status":"ok"}`                                           | 2026-09-29T22:00:05Z |
| PostgreSQL 16.4 | `localhost:5432`                       | `accepting connections`                                     | 2026-09-29T22:00:10Z |
| MinIO S3        | `localhost:9000`                       | `200 OK`                                                    | 2026-09-29T22:00:12Z |
| TypeSafe AI Jev | `https://api.typesafe.ai/v1/systemone` | `32ms p95`                                                  | 2026-09-29T22:00:15Z |

---

## 2. Complete Test Run Summary

| Suite                    | Count    | Passed   | Failed | Time   | Status      |
| ------------------------ | -------- | -------- | ------ | ------ | ----------- |
| Backend security         | 334      | 334      | 0      | 48.3s  | ✅          |
| Live PostgreSQL RLS      | 5        | 5        | 0      | 3.1s   | ✅          |
| Module 05 live cognitive | 22       | 22       | 0      | 31.8s  | ✅          |
| Module 05 adversarial    | 9        | 9        | 0      | 14.1s  | ✅          |
| Core regression smoke    | 9        | 9        | 0      | 8.2s   | ✅          |
| Other backend tests      | 352      | 352      | 0      | 381.8s | ✅          |
| Web unit tests           | 96       | 96       | 0      | 12.4s  | ✅          |
| UI-kit unit tests        | 149      | 149      | 0      | 8.1s   | ✅          |
| Playwright E2E           | 46       | 46       | 0      | 192s   | ✅          |
| **TOTAL**                | **1022** | **1022** | **0**  | —      | **✅ 100%** |

> [!NOTE] The 1022 total includes 731 backend + 96 web + 149 UI-kit + 46 E2E.
> The 731 backend count deduplicates overlapping test files (same as prior
> phases). The 1022 is the accurate total when counting all test processes run
> as part of ENT-P14 verification.

---

## 3. Performance Benchmarks

| Metric                       | P50     | P95     | P99     | SLO          | Status |
| ---------------------------- | ------- | ------- | ------- | ------------ | ------ |
| JWT validation               | 0.8ms   | 2.1ms   | 3.4ms   | ≤5ms p95     | ✅     |
| pgvector HNSW retrieval      | 6.2ms   | 14.2ms  | 18.7ms  | ≤15ms p95    | ✅     |
| S1 Jev action routing        | 12ms    | 32ms    | 41ms    | ≤50ms p95    | ✅     |
| S2 Gemma 4 synthesis         | 1,200ms | 3,200ms | 4,100ms | ≤5,000ms p95 | ✅     |
| Rate limiter response        | 0.3ms   | 0.8ms   | 1.2ms   | ≤1ms p95     | ✅     |
| Resume PDF render (Chromium) | 1,800ms | 3,200ms | 4,500ms | ≤5,000ms p95 | ✅     |

---

## 4. Accessibility Audit Results

| Criterion                           | WCAG Level | Test Method       | Result                     |
| ----------------------------------- | ---------- | ----------------- | -------------------------- |
| Text contrast ratio                 | AA (4.5:1) | Manual + axe-core | ✅ All pass                |
| Interactive element keyboard access | AA         | Manual            | ✅ All pass                |
| ARIA labels on form inputs          | AA         | axe-core          | ✅ All pass                |
| Skip navigation links               | AA         | Manual            | ✅ Present on all pages    |
| Alt text on images                  | A          | axe-core          | ✅ All pass                |
| Error identification                | AA         | Manual            | ✅ Form errors descriptive |

---

_Test results v1.0.0 — QA Lead — 2026-09-29_
