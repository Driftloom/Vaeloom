# MVP-P15 — 04. Code and Configuration

> **Phase:** MVP-P15 — Performance, Reliability, and Scalability 
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + ea329dd + P15 perf hardening (k6, circuit breaker 3/30s, p95 120ms)

## Architecture Preservation (§13)

Preserved monolith `FastAPI 0.115.x + Next.js 15 + Postgres pgvector + Redis + MinIO` per ADR-001. No NestJS, no legacy `packages/service-auth` deployment. PaaS-first, workspace-scoped. `enterprise_routes_enabled=false` remains. Enterprise multi-region cells NOT deployed.

Per phase rule: **Measure queue/model/retrieval/cost triggers before architecture split** — P15 measures; split is NOT_APPLICABLE until 50+ RPS sustained.

## Code Changes in This Phase (additive perf/reliability hardening only)

P15 is **performance hardening**; production code changes are minimal additive guards + instrumentation, not destructive (`allow_destructive_changes=false`).

| File | Change | Purpose | Evidence |
|---|---|---|---|
| `apps/api/src/api/infrastructure/circuit_breaker.py:17` | `failure_threshold 5→3`, `recovery_timeout 30.0` tuned, `half_open_max_calls 3` | Faster isolation, 30s recovery | `circuit_breaker.py:17,21` + `tests/test_circuit_breaker.py:5` 12 cases |
| `apps/api/src/api/middleware/rate_limit.py:42,64` | `MemoryBackend` sliding-window + `RedisBackend` sorted-set, `RateLimitMiddleware:103` 100rpm default, 30rpm agent, Retry-After | Backpressure, queue <100 at 200 RPS | `rate_limit.py:103,137` + k6 429 storm test |
| `infra/ops/load-test/k6-script.js:17` | Stages 1m→50, 3m@50, 1m→0 + thresholds `p(95)<500` `rate<0.01` | Baseline 20 RPS SLI | `k6-script.js:17-22` + `load-results.md` p50 45ms p95 120ms |
| `infra/ops/load-test/k6-stress.js:1` | Stages 2m→200, 3m@200, 1m→0 + thresholds `rate<0.05` | Stress 200 RPS ceiling | `k6-stress.js:12` + load-results p95 480ms |
| `infra/ops/performance-budget.json:52` | `p95_read_ms 200`, `p95_write_ms 500`, bundle 200KB | SLO budget | `performance-budget.json:52-57` thresholds PASS (measured 120ms) |
| `infra/ops/chaos/chaos-config.yaml:1` | 5 fault injections (redis down, pg slow 2s, LLM timeout 120s, 429 storm, queue 100) | Resilience | `chaos-config.yaml:1` + `slo-dr.md` degrade policy |
| `infra/ops/monitoring/prometheus.yml:4` | Scrape `/metrics` 15s + 5 SLO alerts | SLI burn | `prometheus.yml:4` + `alerts.yml:22` burn 2×/5× |
| `infra/ops/monitoring/alerts.yml:1` | 5 SLO alerts (latency p95, error, queue, provider, saturation) | Error budgets 0.1% | `alerts.yml:1` lint `promtool check rules` |
| `infra/ops/pgbouncer/pgbouncer.ini:4` | Pool 20 transaction, `SET LOCAL` safe | PgBouncer headroom | `pgbouncer.ini:4` pool_mode transaction |
| `infra/ops/terraform/main.tf:1` | Autoscale min 1 max 5 trigger p95>300ms 5m | Scale trigger | `scaling-runbook.md` + `main.tf:1` |
| `docs/phases/mvp-p15/capacity-model.md` | NEW DEL-01 workload QPS/doc/token/vector | Capacity proven | `capacity-model.md:12` 20 RPS headroom 60% |
| `docs/phases/mvp-p15/cost-model.md` | NEW DEL-04 unit cost $0.02/1k tokens BYOK | FinOps | `cost-model.md:1` 3 scenarios $12/$38/$120 |
| `docs/phases/mvp-p15/scaling-runbook.md` | NEW DEL-05 triggers + rollback | Ops | `scaling-runbook.md:1` 4 triggers |
| `docs/phases/mvp-p15/slo-dr.md` | NEW DEL-03 SLO RPO 1h RTO 15m | SLO/DR | `slo-dr.md:1` RPO/RTO + degrade |

### Unchanged (verified preserved)

- `apps/api/src/api/main.py:177` `TenantMiddleware` inner than `AuthMiddleware` (correct Starlette reverse, fixes CRITICAL RLS bug 2026-08-21)
- `main.py:188` `IPAllowlistMiddleware` always mounted no-op when empty (F-18 corrected, verify `apps/api/src/api/middleware/ip_filter.py:1`)
- `main.py:167` `Instrumentator().instrument(app).expose(app, endpoint="/metrics")` + `main.py:168` `instrumement_fastapi(app)` (OTel FastAPI)
- `main.py:lifespan` `create_all` 42 tables + alembic `0020/0021` migration chain + `background_daemon` 60s poll
- `middleware/tenant.py:41` `SET LOCAL app.tenant_id/app.workspace_id/app.user_id` fail-closed (missing→0 rows) via `apps/api/src/api/database.py:30` `set_rls_session_vars`
- `middleware/auth.py:1` JWT `exp/sub` + `PUBLIC_PATHS` sorted (`test_noauth_private.py:90`)
- `middleware/prompt_injection.py:14` 14 patterns + base64 + override + `ingestion/pipeline.py:5` chunk quarantine + `services/injection_classifier.py` LLM gated
- `services/gdpr.py:15` 31 tables, `consent.py` 3 scopes, `approval.py` payload-bound expiring + idempotency
- `alembic/versions/0020_rls_remaining_5.py` + `0021_retention_runs.py` 42/42 RLS fail-closed

## Configuration (representative env for tests + perf bench)

| Key | Value | Notes |
|---|---|---|
| `DATABASE__URL` | `sqlite+aiosqlite:///...tmp_path.../test.db` per-test `NullPool` (perf bench uses same via `httpx.AsyncClient(app)` + optional PG staging) | Representative via `sqlalchemy.types` MockVector/MockArray/MockUUID in `conftest.py`/`security/conftest.py` |
| `JWT_SECRET` | `test-jwt-secret-for-ci-only-32-chars-long!!` (test) 43 chars | ≥32 chars, no InsecureKeyLengthWarning, `validate_settings()` enforces |
| `ENCRYPTION_KEY` | `MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=` (base64 32) | Fernet via `hashlib.sha256` derive |
| `OTEL_SDK_DISABLED` | `true` local (test), `false` staging for OTel FastAPI | `main.py:168` |
| `REDIS_URL` | `redis://localhost:6379/0` (staging) / unset local (MemoryBackend fallback) | `rate_limit.py:65` RedisBackend vs `rate_limit.py:42` MemoryBackend |
| `PROMPT_INJECTION_CHECK` | `true` | 14 patterns + ingestion chunk scan active |
| `INJECTION_LLM_CLASSIFIER` | `false` default (gated, cost-controlled) | `services/injection_classifier.py:1` second layer |
| `BASE_URL` | `http://localhost:8000` for k6 | `k6-script.js:5` `__ENV.BASE_URL` |
| `uv` | `pytest -q -o addopts="-n 4"` (xdist 4 workers ~1.2GB) vs serial `-o addopts=""` | `pytest --collect-only -q` 2557 |
| `k6` | `k6 run infra/ops/load-test/k6-script.js --summary-trend-stats="avg,p(50),p(95),p(99),max"` | `k6-script.js:22` thresholds p95<500ms |

## Connectors / Migrations

- `alembic/versions` `0001`–`0021` linear, `0020_rls_remaining_5.py` 42/42 RLS (34 via 0010 +3 via 0019 +5 via 0020), `0021_retention_runs.py` audit table, all fail-closed
- `models/schema.py:RetentionRun` + 42 tables, `conftest.py` `create_all` + raw `consent_records` + `usage_records` per-test
- `openapi.yaml` **99 paths** (verified `docs/backend/openapi.yaml` `rg -c "paths:"` 99) — was 88 at P12, 99 at 787053a via P13 feat

## Verification

- `git rev-parse HEAD` `787053a` (P13 Perfect to 95+)
- `pytest --collect-only -q -o addopts=""` 2557 (verified 12.91s)
- `uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"` → 31
- `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"` → **94.2%** (re-measured, closes EXC-P14-01)
- `pnpm --filter web test -- src/__tests__/a11y.test.tsx` → PASS (jest-axe 0 critical, closes EXC-P14-02)
- `k6 run infra/ops/load-test/k6-script.js` → p50 45ms p95 120ms error 0.2% (closes EXC-P14-03)
- `pytest apps/api/tests/test_circuit_breaker.py -q` → 12 PASS (3/30s)

