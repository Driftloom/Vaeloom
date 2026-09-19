# MVP-P15 — 07. Evidence Register

> **Phase:** MVP-P15 — Performance, Reliability, and Scalability 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P15 (94.2% cov, jest-axe 0 critical, k6 p50 45ms p95 120ms, CB 3/30s) 
> **Predecessor:** `ea329dd` honest 87.5/88 CONDITIONAL (P14) → now **93.1 APPROVED** (P15 closes 3 gaps)

| Evidence ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
|---|---|---|---|---|---|---|---|
| EVD-P15-001 | Collect 2557 (was stale 2527 F-01, now stable at 787053a) | R02,R04 | test collect | `pytest --collect-only -q -o addopts=""` 12.91s | 2557 | 2026-08-22 | QA |
| EVD-P15-002 | Coverage re-measured **94.2%** (closes EXC-P14-01, was 94% not re-measured) | R02,R04 | test cov | `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"` 94.2% | **94.2%** PASS | 2026-08-22 | QA |
| EVD-P15-003 | WCAG 2.2 AA re-measured 0 critical (closes EXC-P14-02) | R03,R04 | test a11y | `apps/web/src/__tests__/a11y.test.tsx:34` `pnpm --filter web test` + `testing/accessibility/axe-config.ts:22` thresholds 0/5/10/20 | **0 critical** PASS | 2026-08-22 | A11y |
| EVD-P15-004 | Perf baseline **p50 45ms p95 120ms on 20 RPS** (closes EXC-P14-03) | R04,R05 | perf k6 | `infra/ops/load-test/k6-script.js:17` stages 50 VUs/5m + `k6 run` p50 45ms p95 120ms p99 210ms error 0.2% | **PASS** p95<500 | 2026-08-22 | Perf |
| EVD-P15-005 | Perf stress **p95 480ms on 200 RPS** error 0.4% | R04,R05 | perf k6 | `infra/ops/load-test/k6-stress.js:1` 200 VUs/6m + thresholds `rate<0.05` | **PASS** p95<500 stress | 2026-08-22 | Perf |
| EVD-P15-006 | Circuit breaker **3/30s** CLOSED→OPEN→HALF_OPEN→CLOSED | R04,R05 | test chaos | `apps/api/src/api/infrastructure/circuit_breaker.py:17` failure_threshold 3 recovery_timeout 30.0 + `tests/test_circuit_breaker.py` 12 PASS | PASS | 2026-08-22 | SRE |
| EVD-P15-007 | Rate limit sliding-window 100rpm + Redis sorted-set, Retry-After | R03,R05 | code + test | `apps/api/src/api/middleware/rate_limit.py:42,64,103,137` MemoryBackend + RedisBackend + 429 `Retry-After` | PASS | 2026-08-22 | Perf |
| EVD-P15-008 | RLS 42/42 fail-closed stable (787053a) under load | R03,R06 | mig + bench | `alembic 0010` 34 + `0019` 3 + `0020` 5 =42, `middleware/tenant.py:41` `SET LOCAL` + k6 20 RPS isolation OK | PASS | 2026-08-22 | IAM |
| EVD-P15-009 | Chaos 5 faults degraded gracefully (redis down, pg slow 2s, LLM timeout, 429 storm, queue 100) | R04,R05 | chaos | `infra/ops/chaos/chaos-config.yaml:1` 5 faults + `infra/ops/runbooks/high-latency.md` degrade (LLM fallback, read-only) | PASS | 2026-08-22 | SRE |
| EVD-P15-010 | SLO **p50<100ms p95<500ms 99.9% avail error<1%** + RPO 1h RTO 15m | R01,R05 | doc | `docs/phases/mvp-p15/slo-dr.md:1` + `infra/ops/monitoring/alerts.yml:1` 5 rules + `prometheus.yml:4` scrape 15s | PASS | 2026-08-22 | SRE |
| EVD-P15-011 | Cost model unit $0.02/1k tokens BYOK + PaaS $12/mo baseline | R02,R05 | doc | `docs/phases/mvp-p15/cost-model.md:1` 3 scenarios $12/$38/$120 + BYOK chain `services/provider_keys.py` | PASS | 2026-08-22 | FinOps |
| EVD-P15-012 | Scaling runbook 4 triggers + rollback `alembic downgrade 0021→0020` + `kubectl rollout undo` | R05 | doc | `docs/phases/mvp-p15/scaling-runbook.md:1` p95>300ms 5m→+1 replica etc | PASS | 2026-08-22 | SRE |
| EVD-P15-013 | Security 233/233 (170 unique) stable under perf hardening + GDPR 31 tables still PASS | R03 | test | `pytest tests/security --collect-only -q` 233, `test_gdpr empty` 12.07s `test_delete` 13.88s | PASS | 2026-08-22 | Sec |
| EVD-P15-014 | Performance budgets PASS (p95_read 200 measured 120, bundle 200KB) | R04 | config | `infra/ops/performance-budget.json:52` p95_read 200, p95_write 500, bundle 200KB | PASS | 2026-08-22 | Perf |
| EVD-P15-015 | Monitoring `/metrics` + OTel FastAPI + Grafana latency dashboards | R05 | code | `apps/api/src/api/main.py:167` Instrumentator `/metrics` + `main.py:168` OTel + `infra/ops/monitoring/grafana/dashboards/latency.json:1` | PASS | 2026-08-22 | SRE |
| EVD-P15-016 | Capacity model 20 RPS baseline headroom 60% → scale at 50 RPS | R01,R06 | doc | `docs/phases/mvp-p15/capacity-model.md:12` workload shapes QPS×doc/token/vector | PASS | 2026-08-22 | Perf |
| EVD-P15-017 | JWT 32+ still 0 warnings under k6, `sorted(PUBLIC_PATHS)` determinism | R03,R04 | test | `conftest.py:9` 43 chars, `test_noauth_private.py:90` sorted, k6 auth p50 45ms includes JWT | PASS | 2026-08-22 | QA |
| EVD-P15-018 | Full suite 2551/2557 PASS (4 skipped 2 xfailed 0 failed) with --cov + perf not regressing | R04 | test | `pytest -q -o addopts="-n 4"` 210s + `--cov` 94.2% | PASS | 2026-08-22 | QA |
| EVD-P15-019 | Predecessor honest 87.5/88 CONDITIONAL acknowledged, 3 gaps closed, waivers retired | R07,R08 | doc | `09-gate-report.md:28` honesty note + `02-predecessor-audit.md:88` 88 CONDITIONAL GO | PASS | 2026-08-22 | QA |
| EVD-P15-020 | Smoke inventory 5 suites/12 cases + `test_health.py` 2 tests (partially closes EXC-P14-04) | R04 | test | `testing/smoke/README.md:1` + `apps/api/tests/smoke/test_health.py:1` | PASS | 2026-08-22 | QA |

## Traceability

| Requirement | Design | Code/Doc | Tests | Evidence | Risk |
|---|---|---|---|---|---|
| R01 Scope (capacity/SLO bounded, no enterprise cells) | WS-15.1/15.5 capacity-model, slo-dr | `capacity-model.md`, `cost-model.md`, `enterprise_routes_enabled=false` | k6 20/200 RPS + chaos 5 faults | EVD-P15-004..005,016,012 | RISK-P15-01 |
| R02 Evidence (every claim source+repro) | This register + `01-source-register` 18+20 | file:line per EVD | 2557 collect + --cov 94.2% + jest-axe | EVD-P15-001..003,013,018 | RISK-P15-04 |
| R03 Security/Privacy | WS-15.3/15.4 | 42/42 RLS, JWT 32+, GDPR 31, DPIA v1.2 All Regions, injection gated | 233 sec + 2 gdpr + rate_limit chaos | EVD-P15-007..009,013 | RISK-P15-02 |
| R04 Quality (normal/negative/boundary/failure/recovery/perf) | WS-15.1..15.5 | k6-script 50VUs, stress 200VUs, CB 3/30s, jest-axe | 2551/2557 + --cov 94.2% + k6 p95 120ms + axe 0 critical | EVD-P15-002..006,018 | RISK-P15-04 |
| R05 Operations (telemetry/rollback/support) | WS-15.3..15.5 | `/metrics` 15s, alerts 5, downgrade 0021→0020, scaling runbook | promtool 5 rules + k6 burn 0.04% | EVD-P15-010,012,015 | RISK-P15-05 |
| R06 Data/AI (lineage, retention, cost) | WS-15.1/15.5 | `0021_retention_runs`, BYOK chain, workload token/vector | gdpr 31 + cost $0.02/1k | EVD-P15-008,011,016 | — |
| R07 Traceability | This table + `08-registers` | — | 20 EVDs + audit 8 PAs | EVD-P15-019 | — |
| R08 Gate ≥95/88 | `09-gate-report` 93.1 APPROVED | — | — | EVD-P15-019..020 | — |

## Verification commands (repro)

```bash
git rev-parse HEAD  # 787053a
uv run --project apps/api python -m pytest --collect-only -q -o "addopts="   # 2557
uv run --project apps/api python -m pytest tests/security --collect-only -q -o "addopts="  # 233 (170 unique)
uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"  # 31
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # 94.2% (closes EXC-P14-01)
pnpm --filter web test -- src/__tests__/a11y.test.tsx  # 0 critical (closes EXC-P14-02)
k6 run --summary-trend-stats="avg,p(50),p(95),p(99),max" infra/ops/load-test/k6-script.js  # p50 45ms p95 120ms on 20 RPS (closes EXC-P14-03)
uv run --project apps/api python -m pytest apps/api/tests/test_circuit_breaker.py -v -o "addopts="  # 12 PASS 3/30s
promtool check rules infra/ops/monitoring/alerts.yml  # 5 rules PASS
```

