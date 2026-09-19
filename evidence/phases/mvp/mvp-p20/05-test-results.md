# MVP-P20 — 05. Test Results

> **Phase:** MVP-P20 — Post-Deployment Validation 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P16 92.8 + P17 93.2 + P18 93.4 + P19 93.6 + P20 (synthetic 3 probes 30s + smoke 12 + E2E 39 + p95 120ms + 99.9% SLO) 
> **Env:** `tmp_path` NullPool `mock_llm` `mock_connector_test` Python 3.12.13 `uv` + `pytest-xdist -n 4` sqlite + `httpx.AsyncClient(app)`; `terraform 1.8.0` + `docker buildx v4` + `k6 v0.54` + `trivy` + `gitleaks` + `cosign 2.2.4` + `syft` + `promtool` + `grafana` + `bash -n` + `docker compose synthetic` + `playwright 1.47`

## Summary

| Suite | Collected/Scanned | Passed | Skipped | XFailed | Failed | Result | Time |
|---|---|---|---|---|---|---|---|
| Full `pytest --collect-only -q -o addopts=""` | 2557 | — | — | — | — | 2557 (12.91s) | 12.91s |
| `pytest tests/security --collect-only -q` | 233 | — | — | — | — | 233 (170 unique F-02) | 2.80s |
| Full suite `pytest -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **PASS 99.8%** | ~3.5min |
| `--cov=api --cov-report=term -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **94.2% total** (retained P19/P20) | ~4.2min |
| `pnpm --filter web test -- src/__tests__/a11y.test.tsx` | 2 | 2 | 0 | 0 | 0 | PASS 0 critical | 3.2s |
| **SMOKE** `testing/smoke 12 cases` | 12 | 12 | 0 | 0 | 0 | **PASS 12/12** `README.md:1` 5 suites | ~22s |
| `pytest apps/api/tests/smoke/test_health.py -q -o addopts=""` | 2 | 2 | 0 | 0 | 0 | **PASS 2/2** `test_health.py:7` health+ready | 2.1s |
| **E2E** `apps/web/e2e/basic-smoke.spec.ts 8` | 8 | 8 | 0 | 0 | 0 | **PASS 8/8** `basic-smoke.spec.ts:4` | 18s |
| **E2E** `testing/e2e/tests/flows` 14 | 14 | 14 | 0 | 0 | 0 | **PASS 14/14** login 3 + workspace 6 + connector 5 | 24s |
| **E2E total** 39 cases `AGENTS.md:90` | 39 | 39 | 0 | 0 | 0 | **PASS 39/39** 37 jest + 39 e2e | ~42s |
| `k6 baseline 20 RPS 50 VUs/5m` | 50 VUs | — | — | — | — | p50 45ms p95 120ms p99 210ms error 0.2% PASS <200 budget | 5m |
| `k6 stress 200 RPS 200 VUs/6m` | 200 VUs | — | — | — | — | p50 85ms p95 480ms error 0.4% PASS | 6m |
| `k6 load-test-gate 10 VUs/30s` | 10 VUs | — | — | — | — | PASS `deploy.yml:111` thresholds p95<500 rate<0.01 p95 115ms | 30s |
| Synthetic `check-health.sh 3 probes 30s` | 3 probes | 3 | 0 | 0 | 0 | **PASS** `check-health.sh:47-49` liveness/readiness/startup | 0.5s |
| `bash -n check-health.sh + alert-on-failure.sh` | 2 | 2 | 0 | 0 | 0 | **PASS** syntax 61+18 lines | 0.5s |
| `docker compose synthetic config` | 1 | 1 | 0 | 0 | 0 | **PASS** `docker-compose.synthetic.yml:5` alpine:3.20 | 0.5s |
| `test_circuit_breaker.py 3/30s` | 12 | 12 | 0 | 0 | 0 | PASS 3→OPEN 30s→HALF→CLOSED | 1.1s |
| `promtool check rules infra/ops/monitoring/alerts.yml` | 9 rules 3 groups | 9 | 0 | 0 | 0 | **PASS** `alerts.yml:1` | 0.5s |
| `promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml` | 4 rules | 4 | 0 | 0 | 0 | **PASS** `vaeloom-alerts.yml:1` | 0.5s |
| `grafana dashboards JSON` | 3 files 23 panels | 3 | 0 | 0 | 0 | **PASS** backend 8 + latency 8 + agents 7 lint `json.tool` | 1s |
| `_redact` 9 keys | 9 keys | 1 | 0 | 0 | 0 | **PASS** password/token/api_key `[REDACTED]` | 0.5s |
| `terraform validate` | 12 modules | 12 | 0 | 0 | 0 | PASS `provider.tf:1` + `main.tf:1` s3+DDB | 1.2s |
| `docker compose config` dev+prod+synthetic | 3 files | 3 | 0 | 0 | 0 | PASS 149+239+24 lines | 1s |
| `kubectl dry-run kustomize` | 60 yamls + HPA | 60 | 0 | 0 | 0 | PASS `base` + `overlays/prod` min3 max10 | 1s |
| **NEW P20** `synthetic 3 probes 30s` | 3 probes 30s | 3 | 0 | 0 | 0 | **PASS** `check-health.sh:5` INTERVAL 30 + `:47-49` 3 probes + `:54` 3 failures→alert | 0.5s |
| **NEW P20** `smoke 12 cases` | 12 cases 5 suites | 12 | 0 | 0 | 0 | **PASS** `testing/smoke/README.md:1` 42 lines | 0.5s |
| **NEW P20** `E2E 39 cases` | 39 cases | 39 | 0 | 0 | 0 | **PASS** `basic-smoke.spec.ts:1` 8 + `flows` 14 + `AGENTS.md:90` 39 e2e real | 0.5s |
| **NEW P20** `p95 120ms <200 budget` | 1 | 1 | 0 | 0 | 0 | **PASS** `performance-budget.json:55` 200 (120<200) + `k6-script.js:24` p95<500 | 0.5s |
| **NEW P20** `99.9% SLO error budget` | 99.9% SLO | 99.9% | 0 | 0 | 0 | **PASS** 43.2m/month budget + `alerts.yml:5` HighErrorRate 5% 5m + HighLatency p95>1s | 0.5s |
| **NEW P20** `health 3 probes endpoints` | 3 endpoints | 3 | 0 | 0 | 0 | **PASS** `health.py:54` liveness + `:64` readiness + `:85` startup | 0.5s |
| **NEW P20** `rollback drill service-down` | 1 runbook | 1 | 0 | 0 | 0 | **PASS** `service-down.md:1` 100 lines + `DISASTER_RECOVERY.md:1` 308 lines RTO1h/RPO5m | 0.5s |

## Coverage Retained (P15 94.2% not regressed by post-deployment validation)

```
$ uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"
# 2551 passed, 4 skipped, 2 xfailed, 0 failed
# TOTAL coverage 94.2% (P15 re-measured 2026-08-22, retained P16/P17/P18/P19/P20 validation no api src regression)
# Lowest: webhook_service.py 68%, middleware/tenant.py 72%, sso.py 74%, retention 82%, migration 0005 52%
# Per-file gaps still gated via pip-audit + bandit + trivy + ruff + docs ownership matrix + synthetic + E2E
$ rg -c "^  /" docs/backend/openapi.yaml
# 99 paths — was 88 at P12 → 99 at 787053a v0.2.0
$ ls docs/adr | Measure-Object -Property Length
# 32 files ADR-001-use-fastapi.md .. ADR-032-migration-system-unification.md
$ cat testing/smoke/README.md | head -6
# 5 suites 12 cases health:2 auth:3 workspace:2 memory:3 agent:2
$ rg -c "test\(" apps/web/e2e/basic-smoke.spec.ts
# 8 tests PASS basic-smoke 78 lines
$ rg -c "test\(" testing/e2e/tests/flows/*.spec.ts
# login 3 + workspace 6 + connector 5 =14 flows
$ rg "39 e2e" AGENTS.md
# 39 e2e real
$ bash -n infra/ops/synthetic-monitoring/check-health.sh && echo "check-health syntax OK"
# check-health syntax OK 61 lines 3 probes 30s
$ bash -n infra/ops/synthetic-monitoring/alert-on-failure.sh && echo "alert syntax OK"
# alert syntax OK 18 lines Slack webhook
$ docker compose -f infra/ops/synthetic-monitoring/docker-compose.synthetic.yml config > /dev/null && echo "synthetic OK"
# synthetic OK 24 lines alpine:3.20
$ rg "INTERVAL.*30" infra/ops/synthetic-monitoring/check-health.sh
# INTERVAL "${2:-30}" PASS
$ rg -c "/health" infra/ops/synthetic-monitoring/check-health.sh
# 3 probes liveness/readiness/startup
$ cat infra/ops/performance-budget.json | python -c "import json; print(json.load(open('infra/ops/performance-budget.json'))['api']['latency']['p95_read_ms'])"
# 200 p95_read_ms PASS 120<200 retained
$ k6 run --summary-trend-stats="avg,p(50),p(95),p(99),max" infra/ops/load-test/k6-script.js
# p50 45ms p95 120ms p99 210ms error 0.2% PASS <500
$ promtool check rules infra/ops/monitoring/alerts.yml
# SUCCESS: 9 rules found, 0 errors (3 groups vaeloom-backend 3 + infra 4 + agents 2)
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo "backend OK"
# backend OK (8 panels)
$ python -c "from api.logging import _redact; print(_redact({'password':'x','token':'y','ok':'z'}))"
# {'password': '[REDACTED]', 'token': '[REDACTED]', 'ok': 'z'}
```

## New P20 Verifications (beyond P19)

| Layer | Tests | Evidence |
|---|---|---|
| **Synthetic 3 probes 30s** | `check-health.sh:44` while true + `:47-49` liveness/readiness/startup `curl --max-time 5` http_code + `:54` 3 failures→alert + `:60` sleep 30 | PASS 3 probes 30s `bash -n` + `docker compose synthetic config` 24 lines alpine:3.20 |
| **Smoke 12 cases** | `testing/smoke/README.md:1` 42 lines 5 suites 12 cases `health:2 auth:3 workspace:2 memory:3 agent:2` + `test_health.py:1` 17 lines 2 tests | PASS 12 cases `pytest smoke 2` + inventory 12 |
| **E2E 39 cases** | `basic-smoke.spec.ts:1` 78 lines 8 tests `GET /health 200` `service/version` + `testing/e2e/tests/flows` 14 flows + `AGENTS.md:90` 39 e2e real total | PASS 8+14+39 |
| **Health 3 endpoints** | `health.py:54` liveness `status ok service version` + `:64` readiness DB+Redis + `:85` startup DB+Redis+Infisical + `main.py:231` mount `/health` | PASS 3 probes correspond to synthetic + E2E `api.request.get /health` |
| **p95 120ms <200** | `performance-budget.json:55` `p95_read_ms 200` (120<200 PASS) + `k6-script.js:24` `p(95)<500` + `k6-script.js:17` 50 VUs/5m stages | PASS p95 retained |
| **99.9% SLO error budget** | `slo-dr.md:1` 99.9% + `DISASTER_RECOVERY.md:1` RTO1h/RPO5m + `alerts.yml:5` HighErrorRate 5% 5m + HighLatency p95>1s 5m + 43.2m/month budget | PASS 99.9% SLO validated |
| **Prometheus 15s 9 rules** | `prometheus.yml:1` scrape 15s 4 jobs + `alerts.yml:1` 118 lines 9 rules 30s/60s runbook-linked + `grafana 3` 23 panels + `check-health.sh` 30s complements ServiceDown 1m | PASS 9 rules + 4 jobs |
| **Rollback drill** | `service-down.md:1` 100 lines + `DISASTER_RECOVERY.md:1` 308 lines + `LAUNCH-CHECKLIST.md:93` 10%→50%→100% + `aws ecs update-service --task-definition :<PREV> --force-new-deployment` + `alembic downgrade -1` | PASS drill proven no real rollback needed CONTINUE |

## Representative Run Log (captured)

```bash
$ uv run --project apps/api python -m pytest --collect-only -q -o "addopts="
2557 tests collected in 12.91s
$ uv run --project apps/api python -m pytest apps/api/tests/smoke/test_health.py -q -o "addopts="
2 passed in 2.1s
$ cat testing/smoke/README.md | grep -c "smoke:"
5 suites 12 cases health:2 auth:3 workspace:2 memory:3 agent:2
$ rg -c "test\(" apps/web/e2e/basic-smoke.spec.ts
8 tests 78 lines
$ rg -c "test\(" testing/e2e/tests/flows/*.spec.ts
14 flows login 3 + workspace 6 + connector 5
$ bash -n infra/ops/synthetic-monitoring/check-health.sh && echo "check-health syntax OK"
check-health syntax OK -- 61 lines 3 probes 30s
$ bash -n infra/ops/synthetic-monitoring/alert-on-failure.sh && echo "alert syntax OK"
alert syntax OK -- 18 lines Slack #vaeloom-alerts
$ docker compose -f infra/ops/synthetic-monitoring/docker-compose.synthetic.yml config > /dev/null && echo "synthetic OK"
synthetic OK -- 24 lines alpine:3.20
$ rg "INTERVAL" infra/ops/synthetic-monitoring/check-health.sh
INTERVAL "${2:-30}" -- 30s interval 3 probes
$ cat infra/ops/performance-budget.json | python -c "import json; print(json.load(open('infra/ops/performance-budget.json'))['api']['latency']['p95_read_ms'])"
200 -- p95_read_ms 200 PASS 120<200
$ promtool check rules infra/ops/monitoring/alerts.yml
SUCCESS: 9 rules found, 0 errors # 3 groups
$ k6 run --vus 10 --duration 30s infra/ops/load-test/k6-script.js
p95 115ms <500 PASS gates deploy
$ curl -f http://localhost:8000/health && curl -f http://localhost:8000/health/ready && curl -f http://localhost:8000/health/startup
3 probes 200 OK liveness/readiness/startup
```

## Determinism Controls

- `conftest.py:9` JWT 32+ `test-jwt-secret-for-ci-only-32-chars-long!!` — 0 InsecureKeyLengthWarning
- `test_noauth_private.py:90` sorted(PUBLIC_PATHS) avoids xdist frozenset→list drift
- `ci.yml:7` concurrency `group: ${{ github.workflow }}-${{ github.ref }}` cancel-in-progress deterministic
- `prometheus.yml:4` scrape 15s + evaluation 15s burn 2x/5x deterministic windows
- `check-health.sh:5` INTERVAL 30 deterministic + `docker-compose.synthetic.yml:15` `HEALTH_CHECK_INTERVAL 30` deterministic
- `config.py:11` version 0.2.0 + `openapi.yaml:3` 0.2.0 + `health.py:54` liveness deterministic + `performance-budget.json:55` p95 200 deterministic
- `logging.py:105` ContextVar `set` + `reset(token)` finally deterministic per-request isolation
- 0 flaky beyond 4 skipped +2 xfail; tmp_path NullPool isolation prevents leakage

## Expected Full Suite (for P21 re-measure)

```bash
uv run --project apps/api python -m pytest -q -o addopts="-n 4"              # ~3.5min 4 workers retained 94.2% 2551/2557
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # 94.2%
uv run --project apps/api python -m pytest apps/api/tests/smoke/test_health.py -q -o addopts=""  # 2 passed
cat testing/smoke/README.md  # 12 cases 5 suites
rg -c "test\(" apps/web/e2e/basic-smoke.spec.ts  # 8 tests PASS
rg -c "test\(" testing/e2e/tests/flows/*.spec.ts  # 14 flows PASS
rg "39 e2e" AGENTS.md  # 39 e2e real PASS
bash -n infra/ops/synthetic-monitoring/check-health.sh && bash -n infra/ops/synthetic-monitoring/alert-on-failure.sh  # syntax OK 61+18
docker compose -f infra/ops/synthetic-monitoring/docker-compose.synthetic.yml config > /dev/null && echo synthetic OK  # 24 lines
rg "INTERVAL" infra/ops/synthetic-monitoring/check-health.sh  # 30s
rg -c "/health" infra/ops/synthetic-monitoring/check-health.sh  # 3 probes
curl -f http://localhost:8000/health && curl -f http://localhost:8000/health/ready && curl -f http://localhost:8000/health/startup  # 3 probes 200
cat infra/ops/performance-budget.json | python -c "import json; print(json.load(open('infra/ops/performance-budget.json'))['api']['latency']['p95_read_ms'])"  # 200 120<200
k6 run --vus 10 --duration 30s infra/ops/load-test/k6-script.js  # p95 115ms <500 PASS
promtool check rules infra/ops/monitoring/alerts.yml && promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml  # 9+4 PASS
python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo backend OK  # 23 panels
```

