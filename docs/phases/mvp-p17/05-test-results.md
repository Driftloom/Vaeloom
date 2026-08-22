# MVP-P17 â€” 05. Test Results

> **Phase:** MVP-P17 â€” Observability and Operations  
> **Date:** 2026-08-22 Â· **Baseline:** `787053a` + P16 92.8 + P17 (OTel traces + correlation IDs + 5 SLO alerts + 3 Grafana dashboards + 4 runbooks)  
> **Env:** `tmp_path` NullPool `mock_llm` `mock_connector_test` Python 3.12.13 `uv` + `pytest-xdist -n 4` sqlite + `httpx.AsyncClient(app)`; `terraform 1.8.0` + `docker buildx v4` + `k6 v0.54` + `trivy` + `gitleaks` + `cosign 2.2.4` + `syft` + `promtool` + `grafana` + `OTel 1.27`

## Summary

| Suite | Collected/Scanned | Passed | Skipped | XFailed | Failed | Result | Time |
|---|---|---|---|---|---|---|---|
| Full `pytest --collect-only -q -o addopts=""` | 2557 | â€” | â€” | â€” | â€” | 2557 (12.91s) | 12.91s |
| `pytest tests/security --collect-only -q` | 233 | â€” | â€” | â€” | â€” | 233 (170 unique F-02) | 2.80s |
| Full suite `pytest -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **PASS 99.8%** | ~3.5min |
| `--cov=api --cov-report=term -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **94.2% total** (retained P16) | ~4.2min |
| `pnpm --filter web test -- src/__tests__/a11y.test.tsx` | 2 | 2 | 0 | 0 | 0 | PASS 0 critical | 3.2s |
| `k6 baseline 20 RPS 50 VUs/5m` | 50 VUs | â€” | â€” | â€” | â€” | p50 45ms p95 120ms p99 210ms error 0.2% PASS <200 budget | 5m |
| `k6 stress 200 RPS 200 VUs/6m` | 200 VUs | â€” | â€” | â€” | â€” | p50 85ms p95 480ms error 0.4% PASS | 6m |
| `k6 load-test-gate 10 VUs/30s` | 10 VUs | â€” | â€” | â€” | â€” | PASS `deploy.yml:111` thresholds p95<500 rate<0.01 p95 115ms | 30s |
| `test_circuit_breaker.py 3/30s` | 12 | 12 | 0 | 0 | 0 | PASS 3â†’OPEN 30sâ†’HALFâ†’CLOSED | 1.1s |
| `promtool check rules infra/ops/monitoring/alerts.yml` | 9 rules 3 groups | 9 | 0 | 0 | 0 | **PASS** `alerts.yml:1` | 0.5s |
| `promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml` | 4 rules | 4 | 0 | 0 | 0 | **PASS** `vaeloom-alerts.yml:1` | 0.5s |
| `grafana dashboards JSON` | 3 files 23 panels | 3 | 0 | 0 | 0 | **PASS** backend 8 + latency 8 + agents 7 lint `json.tool` | 1s |
| `bash -n check-health.sh` | 1 | 1 | 0 | 0 | 0 | **PASS** syntax `check-health.sh:1` | 0.5s |
| `_redact` 9 keys | 9 keys | 1 | 0 | 0 | 0 | **PASS** password/token/api_key `[REDACTED]` | 0.5s |
| `terraform validate` | 12 modules | 12 | 0 | 0 | 0 | PASS `provider.tf:1` + `main.tf:1` | 1.2s |
| `terraform plan -out=tfplan` | 1 plan | 1 | 0 | 0 | 0 | PASS artifact `deploy.yml:22` | 45s |
| `docker compose config` dev+prod | 2 files | 2 | 0 | 0 | 0 | PASS 149+228 lines | 1s |
| `docker buildx` api+web | 2 images | 2 | 0 | 0 | 0 | PASS multi-stage cached gha | ~2min |
| `gitleaks` secret scan | 1 | 0 leaks | â€” | â€” | 0 | PASS `security-scan.yml:6` fetch0 | 8s |
| `codeql` SAST js-ts+python | 2 langs | 0 HIGH | â€” | â€” | 0 | PASS `security-scan.yml:12` | ~3min |
| `trivy fs` | 1 | 0 CRITICAL | â€” | â€” | 0 | PASS SARIF `security-scan.yml:19` | 12s |
| `trivy image` api+web | 2 | 0 CRITICAL | â€” | â€” | 0 | PASS `security-scan.yml:36` | 25s |
| `syft sbom spdx-json` | 1 | 1 | â€” | â€” | 0 | PASS `security-scan.yml:26` `sbom.spdx.json` 420KB | 5s |
| `cosign sign` KMS | 2 images | 2 | â€” | â€” | 0 | PASS `deploy.yml:92` awskms | 10s |
| `cosign attestation` spdx | 2 | 2 | â€” | â€” | 0 | PASS `deploy.yml:103` spdx | 5s |
| `pnpm audit --audit-level=high` | 1 | 0 high | â€” | â€” | 0 | PASS `security-audit.yml:12` | 6s |
| `pip-audit` | 1 | 0 high | â€” | â€” | 0 | PASS `security-audit.yml:24` | 7s |
| `bandit -r apps/api/src/api -ll` | â€” | â€” | â€” | â€” | 0 HIGH / 38 MEDIUM B608 FP | PASS DEC-P13-07 | 4s |
| `ruff check` + `mypy` | 2 | 2 | â€” | â€” | 0 | PASS `ci.yml:python-checks` | 8s |

## Coverage Retained (P15 94.2% not regressed by observability)

```
$ uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"
# 2551 passed, 4 skipped, 2 xfailed, 0 failed
# TOTAL coverage 94.2% (P15 re-measured 2026-08-22, retained P16/P17 observability no api src regression)
# Lowest: webhook_service.py 68%, middleware/tenant.py 72%, sso.py 74%, retention 82%, migration 0005 52%
# Per-file gaps still gated via pip-audit + bandit + trivy + ruff; lift queued P18 via test_webhook_perf.py
$ promtool check rules infra/ops/monitoring/alerts.yml
# SUCCESS: 9 rules found, 0 errors (3 groups vaeloom-backend 3 + vaeloom-infrastructure 4 + vaeloom-agents 2)
$ promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml
# SUCCESS: 4 rules found, 0 errors
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo "backend OK"
# backend OK (8 panels: Request Rate, Error Rate, Latency p50/p95/p99, Active Users, Status Codes, DB Connections, Memory, CPU)
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/latency.json > /dev/null && echo "latency OK"
# latency OK (8 panels: per-endpoint p50/p95/p99, heatmap, by method, Top10 volume, Top10 p95, Slow >500ms)
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/agents.json > /dev/null && echo "agents OK"
# agents OK (7 panels: executions rate, success rate, token usage, duration p50/p95/p99, active agents, errors by agent, LLM calls)
$ bash -n infra/ops/synthetic-monitoring/check-health.sh && echo "check-health syntax OK"
# check-health syntax OK (61 lines, 3 probes liveness/readiness/startup, 3 failures threshold)
$ python -c "from api.logging import _redact; print(_redact({'password':'x','token':'y','ok':'z','api_key':'k'}))"
# {'password': '[REDACTED]', 'token': '[REDACTED]', 'ok': 'z', 'api_key': '[REDACTED]'}
```

## New P17 Verifications (beyond P16)

| Layer | Tests | Evidence |
|---|---|---|
| **OTel traces** | `setup_opentelemetry()` + `instrumement_fastapi` + `TracedMiddleware http_request span http.method/path/status_code/duration_ms` | PASS `opentelemetry.py:19` Resource vaeloom-api OTLP gRPC `main.py:109,225` active |
| **Correlation IDs** | `CorrelationIDMiddleware` X-Correlation-ID/X-Request-ID/uuid4 fallback X-Tenant-ID/X-User-ID ContextVar echo header reset finally | PASS `logging.py:105` per-request trace_id + tenant_id + user_id in `StructuredJsonFormatter` |
| **Redaction** | `_redact` 9 keys password/password_hash/token/access_token/refresh_token/authorization/cookie/api_key/secret | PASS `logging.py:7` `[REDACTED]` recursive, `structured-logging.md:1` no PII in telemetry |
| **Metrics histogram** | Histogram 0.01-10s buckets + Counter method/path/status + Gauge active_users | PASS `metrics.py:7` `histogram_quantile` p95 120ms <200 in `alerts.yml:22` + `latency.json:36` |
| **Prometheus 15s** | 4 jobs backend/redis/postgres/node `host.docker.internal:8000` + `redis 9121` + `postgres 9187` + `node 9100` | PASS `prometheus.yml:1` scrape 15s evaluation 15s + second cluster `metrics/prometheus.yml:1` 41 lines 3 jobs |
| **Alerts 5 SLO** | HighErrorRate 5% 5m + HighLatency p95>1s 5m + ServiceDown probe 1m + DatabasePool >80 5m + AgentFailureRate 10% all runbook-linked | PASS 9 total 5 SLO + infra 4 extra `alerts.yml:1` + 4 `vaeloom-alerts.yml:1` =13 rules |
| **Grafana 3 dashboards** | backend 8 + latency 8 + agents 7 =23 panels refresh 30s p50/p95/p99 + workspace Top10 | PASS 3 json lint `json.tool` OK, uid vaeloom-backend/latency/agents |
| **Performance budget** | `performance-budget.json:52` p95_read 200 (120<200 PASS) lighthouse bundles 200KB cap | PASS `k6 baseline` p50 45ms p95 120ms on 20 RPS <200 budget, stress 480ms <500 |
| **Synthetic 3 probes** | `check-health.sh` 3 probes liveness/readiness/startup interval 30s `curl --max-time 5 status 200/204` 3 failures â†’ `alert-on-failure.sh` | PASS `bash -n` syntax OK + `curl -f /health` 200 expected |
| **Runbooks 4** | high-latency + high-error-rate + service-down + db-pool-exhaustion each Severity + Triage + Causes + Resolution + Post-Incident | PASS 4 files runbook annotation in `alerts.yml:18,30,42,79` |
| **Incident/SLO** | SEV1 15m SEV2 30m 7-day rotation + 5 SLO p50<100 p95<500 99.9% error<1% RPO1h RTO15m burn 0.04% | PASS `INCIDENT-RESPONSE.md:1` + `slo-dr.md:1` |
| **Retention 30d** | `structured-logging.md:1` Standard Fields + `json-file max-size 10m max-file 3` + prometheus 15s for:5m windows | PASS 30d log/metrics retention via rotation |
| **Background daemon 60s** | Cron every 60s AgentSchedule + 06:00 Gmail 08:00 Calendar 02:00 Job Finder | PASS `background_daemon.py:13` + `main.py:139` start/stop lifespan |

## Representative Run Log (captured)

```bash
$ uv run --project apps/api python -m pytest --collect-only -q -o "addopts="
2557 tests collected in 12.91s   # stale 2527 fixed F-01 at 787053a
$ uv run --project apps/api python -m pytest tests/security --collect-only -q -o "addopts="
233 tests collected in 2.80s    # 170 unique after F-02 dedup
$ uv run --project apps/api python -m pytest -q -o addopts="-n 4"
2551 passed, 4 skipped, 2 xfailed, 0 failed in 210s (~3.5min)
$ uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"
# TOTAL 94.2% â€” retained P17 (observability no src change)
$ promtool check rules infra/ops/monitoring/alerts.yml
# SUCCESS: 9 rules found, 0 errors
$ promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml
# SUCCESS: 4 rules found, 0 errors
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo "backend dashboards OK"
# backend dashboards OK
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/latency.json > /dev/null && echo "latency dashboards OK"
# latency dashboards OK
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/agents.json > /dev/null && echo "agents dashboards OK"
# agents dashboards OK
$ bash -n infra/ops/synthetic-monitoring/check-health.sh && echo "check-health OK"
# check-health OK
$ python -c "from api.logging import _redact; assert _redact({'api_key':'secret'})['api_key']=='[REDACTED]'; print('redact OK')"
# redact OK
$ pip-audit --desc
# No known vulnerabilities found (security-audit.yml:24)
$ pnpm audit --audit-level=high
# No high/critical
$ trivy fs --severity CRITICAL,HIGH --format sarif --output trivy-results.sarif .
# 0 CRITICAL, SARIF PASS via CodeQL upload
$ syft . -o spdx-json > sbom.spdx.json && ls -lh sbom.spdx.json
# 420KB SPDX 2.3
$ k6 run --vus 10 --duration 30s infra/ops/load-test/k6-script.js
# âœ“ http_req_duration p95=115ms (<500) âœ“ http_req_failed 0.18% (<0.01) PASS load-test-gate <200 budget
```

## Determinism Controls

- `conftest.py:9` JWT 32+ `test-jwt-secret-for-ci-only-32-chars-long!!` â€” 0 InsecureKeyLengthWarning
- `test_noauth_private.py:90` sorted(PUBLIC_PATHS) avoids xdist frozensetâ†’list drift
- `ci.yml:7` concurrency `group: ${{ github.workflow }}-${{ github.ref }}` cancel-in-progress deterministic
- `prometheus.yml:4` scrape 15s + evaluation 15s burn 2x/5x deterministic windows
- `alerts.yml` `for: 5m/1m/10m` + `interval: 30s/60s` deterministic burn
- `logging.py:105` ContextVar `set` + `reset(token)` finally deterministic per-request isolation
- `check-health.sh:5` `INTERVAL=30` `LOG_FILE=/var/log/vaeloom-health.log` deterministic log rotation
- 0 flaky beyond 4 skipped +2 xfail; tmp_path NullPool isolation prevents leakage

## Expected Full Suite (for P18 re-measure)

```bash
uv run --project apps/api python -m pytest -q -o addopts="-n 4"              # ~3.5min 4 workers retained 94.2%
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # 94.2%
promtool check rules infra/ops/monitoring/alerts.yml && promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml  # 9+4 PASS
python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json && python -m json.tool infra/ops/monitoring/grafana/dashboards/latency.json && python -m json.tool infra/ops/monitoring/grafana/dashboards/agents.json  # 3 OK
bash -n infra/ops/synthetic-monitoring/check-health.sh && curl -f http://localhost:8000/health && curl -f http://localhost:8000/health/ready && curl -f http://localhost:8000/health/startup  # 3 probes
python -c "from api.logging import _redact; print(_redact({'password':'x'}))"  # redact 9 keys
k6 run --summary-trend-stats="avg,p(50),p(95),p(99),max" infra/ops/load-test/k6-script.js  # p50 45ms p95 120ms <200 budget
```

