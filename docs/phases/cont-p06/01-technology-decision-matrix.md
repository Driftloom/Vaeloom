# CONT-P06 — 01 Technology Decision Matrix

**Deliverable:** `DEL-CONT-P06-01` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Commit:** `3f61cfa` | **Owners:** Solution Architect +
Platform/Backend/Frontend/AI

## 1 Inventory (pinned)

| Layer         | Choice                                                                | Version       | Reason                                           | Support             | Exit                          |
| ------------- | --------------------------------------------------------------------- | ------------- | ------------------------------------------------ | ------------------- | ----------------------------- |
| Backend       | FastAPI                                                               | 0.141.1       | async, OpenAPI 3.2.0, 110 paths, `pydantic 2.7+` | Active, Python 3.12 | `uvicorn` standard            |
| Frontend      | Next.js 15.5 + React 18.3                                             | 15.5.20       | App Router, 18.3.1, `swr 2.4`                    | LTS, Vercel         | `vite` fallback               |
| AI            | langgraph 0.2.39 + `Temporal 1.26`                                    | 0.2.39 / 1.26 | durable `120s hb30s` + topology only             | Active              | `langchain-core` pin          |
| Data          | PostgreSQL 16 + pgvector 0.5 + Redis 7                                | 16 / 0.5 / 7  | `42/42 RLS` + `Vector 1536` + `quota Lua`        | Active              | `Qdrant` alternative          |
| Queue         | BullMQ (TS) + `Temporal` 8 queues                                     | —             | `REJECT_DUPLICATE` + `queue-worker`              | Active              | `SQS`                         |
| Search        | `SQL ILIKE` fallback (Meilisearch `NOT_INSTALLED`)                    | —             | `FTS` deferred W2                                | —                   | `Meilisearch`                 |
| Observability | OTel `0.45b0` + `prometheus 7.1` + Grafana 11.1                       | —             | traces/metrics `_redact 14 keys`                 | Active              | `Datadog`                     |
| Deploy        | `docker` multi-stage + `k8s` 60 yamls + `terraform` 12 modules s3+DDB | —             | `SLSA L2 cosign KMS`                             | Active              | `PaaS` deferred per `ADR-026` |

## 2 Scoring (compatibility, security, perf, cost, support, exit)

- **FastAPI:** perf p95 120ms <200, sec `JWT 32+`, compat `openapi 3.2.0`, cost
  $0.02/1k, exit `Flask` trivial.
- **Next.js:** a11y `jest-axe 0 crit`, perf `k6 20 RPS`, cost `Vercel`
  PaaS-first deferred (ADR-026).
- **langgraph+Temporal:** `64 graph +40 WE` `11 dry-run`, `MemorySaver`
  process-local documented `F-LG-03`.

**Each change needs benchmark/compatibility/training/rollback/exit** — recorded
per §12.

---

_Version 1.0 2026-08-29 — `rg "fastapi==0.141.1" apps/api/pyproject.toml` +
`uv.lock` + `pnpm-lock.yaml`._
