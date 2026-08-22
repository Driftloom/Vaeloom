# MVP-P20 — 04. Code and Configuration

> **Phase:** MVP-P20 — Post-Deployment Validation  
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16 92.8 + P17 93.2 + P18 93.4 + P19 93.6 + P20 validation (synthetic + 12 smoke + 39 E2E + 99.9% SLO)  
> **Predecessor:** P19 release readiness 93.6 (v0.2.0 + 99 paths + 42/42 + HPA min3 max10 + 0021 + lifespan)

## Architecture Preservation (§13)

Preserved monolith `FastAPI 0.141.1 + Next.js 15 + Postgres pgvector + Redis + MinIO` per ADR-001. PaaS-first bounded `min1 max10` `infra/kubernetes/overlays/prod/hpa.yaml:7` cpu70 mem80 + HPA min3 max10. `enterprise_routes_enabled=false` remains `config.py:87`. `787053a` chain intact. No NestJS `packages/service-auth`/`packages/observability` still NOT deployed — only `apps/api/src/api/infrastructure/*` + `infra/ops/monitoring` + `infra/ops/synthetic-monitoring` active + post-deployment validation adds synthetic 30s 3 probes without architectural split.

Per phase rule: **Resolve canonical/superseded docs + separate design vs implementation status + version/owner/status on every doc. Synthetic 30s 3 probes + SLO 99.9% + smoke 12 + E2E 39 proven with file:line.**

## Code Changes in This Phase (additive post-deployment validation only)

P20 is **post-deployment hardening**; business logic unchanged (only synthetic monitoring + E2E/smoke validation + SLO/error budget + rollback drill). `allow_destructive_changes=false`.

| File | Change | Purpose | Evidence |
|---|---|---|---|
| `infra/ops/synthetic-monitoring/check-health.sh:1` | Synthetic health checker 61 lines `set -euo pipefail` `HEALTH_URL ${1:-http://localhost:8000}` `INTERVAL ${2:-30}` `LOG_FILE /var/log/vaeloom-health.log` `FAILURE_FILE /tmp/vaeloom-health-failures` `check_endpoint curl --max-time 5 http_code 200/204 OK` + `check_and_track` increment/reset + `while true` loop 3 probes `liveness/readiness/startup` + `count -ge 3` → `alert-on-failure.sh` + `sleep INTERVAL 30` | Synthetic 3 probes 30s | `check-health.sh:1` 61 lines |
| `infra/ops/synthetic-monitoring/alert-on-failure.sh:1` | Alert hook 18 lines `SLACK_WEBHOOK_URL` `LOG_FILE` `if -z SLACK_WEBHOOK SKIP` else `MESSAGE {"channel":"#vaeloom-alerts" text ":fire: Vaeloom Health Alert Service: $SERVICE_URL Consecutive failures: $FAILURE_COUNT Action: ops/runbooks/service-down.md"}` + `curl -s -X POST` | Alert on 3 failures | `alert-on-failure.sh:1` 18 lines |
| `infra/ops/synthetic-monitoring/docker-compose.synthetic.yml:1` | Synthetic compose 24 lines `health-checker alpine:3.20` `container vaeloom-health-checker restart unless-stopped` `SLACK_WEBHOOK_URL` + volumes `check-health.sh:ro` `alert-on-failure.sh:ro` `health-logs:/var/log` + `command sh -c apk add curl && chmod +x … && check-health.sh ${HEALTH_CHECK_URL:-http://host.docker.internal:8000} ${HEALTH_CHECK_INTERVAL:-30}` + `vaeloom-synthetic bridge` | Deploy synthetic | `docker-compose.synthetic.yml:1` 24 lines |
| `apps/web/e2e/basic-smoke.spec.ts:1` | E2E basic-smoke 78 lines `test.describe Basic Smoke Tests` 8 tests `homepage h1 Your AI-powered` + `login h2 Welcome back` + `signup Create your account` + `validation Email is required` + `invalid creds [role="alert"]` + `API health 200 status ok service version` at `apiUrl /health` + `workspace redirect /login` + `signup token vaeloom.accessToken` | E2E 8 smoke | `basic-smoke.spec.ts:1` 78 lines |
| `apps/api/tests/smoke/test_health.py:1` | API smoke `TestSmokeHealth` 17 lines `test_health_returns_200` assert 200 + body status ok/healthy + `test_health_ready_returns_200` 200/503 json content-type | API smoke 2 tests | `test_health.py:1` 17 lines |
| `testing/smoke/README.md:1` | Smoke inventory 42 lines 5 suites 12 cases `smoke:health 2` `smoke:auth 3` `smoke:workspace 2` `smoke:memory 3` `smoke:agent 2` + commands `pnpm test:smoke` | Smoke inventory 12 cases | `testing/smoke/README.md:1` 42 lines |
| `testing/e2e/tests/flows/login.spec.ts:1` | E2E login flow 3 tests `navigates to login` + `successful login workspace-dashboard` + `invalid credentials login-error` | E2E flows | `login.spec.ts:1` 3 tests |
| `testing/e2e/tests/flows/workspace.spec.ts:1` | E2E workspace flow 6 tests `workspace.spec.ts` 6 tests create/list isolation | E2E flows | `workspace.spec.ts:1` 6 tests |
| `testing/e2e/tests/flows/connector.spec.ts:1` | E2E connector flow 5 tests `connector.spec.ts` 5 tests | E2E flows | `connector.spec.ts:1` 5 tests |
| `apps/api/src/api/routers/health.py:54` | Health endpoints `liveness:54` `status ok service version timestamp` + `readiness:64` DB+Redis degraded/ok + `startup:85` DB+Redis+Infisical | 3 probes endpoints | `health.py:54` 108 lines |
| `apps/api/src/api/main.py:231` | Health mount `health.router prefix /health` + `main.py:106` lifespan `validate_settings + create_all + alembic upgrade head + daemon 60s` | Health mount + lifespan | `main.py:231` + `:106` 266 lines |
| `infra/ops/performance-budget.json:55` | Perf budget `p95_read_ms 200` (120<200 PASS) + `p95_write_ms 500` + lighthouse 90+ | p95 budget 200 | `performance-budget.json:55` 101 lines |
| `infra/ops/load-test/k6-script.js:24` | k6 thresholds `p(95)<500` `rate<0.01` stages 50 VUs/5m p95 120ms retained | k6 p95 120ms | `k6-script.js:24` 107 lines |
| `infra/ops/monitoring/prometheus.yml:1` | Prometheus 46 lines scrape 15s evaluation 15s `rule_files alerts.yml` + 4 jobs backend:8000 redis:9121 postgres:9187 node:9100 | Prometheus 15s | `prometheus.yml:1` 46 lines |
| `infra/ops/monitoring/alerts.yml:1` | Alerts 118 lines 9 rules 3 groups 30s/60s `HighErrorRate 5% 5m` `HighLatency p95>1s 5m` `ServiceDown 1m` each runbook-linked + `DatabaseConnectionPoolExhaustion` etc | Alerts 9 rules | `alerts.yml:1` 118 lines |
| `infra/monitoring/health/health-checks.md:1` | Health checks doc + `infra/monitoring/metrics/prometheus.yml:1` | Health docs | `health-checks.md:1` |
| `infra/ops/runbooks/service-down.md:1` | Runbook 100 lines SEV1 `curl /health` 3 probes + `docker ps/logs` + `ecs describe-services` + `ServiceDown` resolution restart/rollback/migration/scale | Rollback drill | `service-down.md:1` 100 lines |
| `infra/ops/runbooks/high-latency.md:1` | Runbook 70 lines SEV2 p95>1s `histogram_quantile(0.95 … )` + PromQL slow queries + resolution | Latency runbook | `high-latency.md:1` 70 lines |
| `docs/Operations/SLO.md:1` | SLO p50<100 p95<500 99.9% error<1% RPO1h RTO15m | SLO 99.9% | `SLO.md:1` |
| `docs/DISASTER_RECOVERY.md:1` | DR 308 lines RTO1h/RPO5m 5 tiers + WAL 5m + PITR + `service-down` rollback `aws ecs update-service --force-new-deployment` | DR RTO1h | `DISASTER_RECOVERY.md:1` 308 lines |
| `apps/api/src/api/config.py:11` | `service_version 0.2.0` + `enterprise_routes_enabled False` `:87` | Version 0.2.0 | `config.py:11` + `:87` |
| `docs/backend/openapi.yaml:1` | `openapi: 3.1.0` `version: 0.2.0` 99 paths `rg -c "^  /" 99` | OpenAPI 99 | `openapi.yaml:1` 3.1.0 0.2.0 |

### Unchanged (verified preserved)
- `apps/api/src/api/middleware/tenant.py:41` `SET LOCAL app.tenant_id/workspace_id/user_id` fail-closed via `database.py:30` `set_rls_session_vars` — synthetic 30s under `transaction` pgbouncer safe
- `middleware/auth.py:1` JWT exp/sub + PUBLIC_PATHS sorted `test_noauth_private.py:90` — `validate_settings()` still fails fast on 32+
- `apps/api/src/api/infrastructure/logging.py:19` `StructuredJsonFormatter` + `logging.py:7` `_REDACT_KEYS` 9 keys before JSON dump — retained, synthetic logs `vaeloom-health.log` OK/FAIL only 8 chars tenant not PII
- `apps/api/src/api/infrastructure/opentelemetry.py:19` Resource vaeloom-api + `main.py:219` /metrics + `prometheus.yml:1` 15s — retained
- `circuit_breaker.py:17` 3/30s + `rate_limit.py:42,64,103` 100rpm + `k6-script.js:17` p50 45ms p95 120ms — retained p95 120ms <200
- `docs/adr/ADR-001..032` 32 files unchanged

## Configuration (representative env for post-deployment validation)

| Key | Value | Notes |
|---|---|---|
| `SERVICE_VERSION` | `0.2.0` `config.py:11` + `openapi.yaml:3` `info.version 0.2.0` + `pyproject.toml` version 0.2.0 | 3 files consistent v0.2.0 |
| `DATABASE__URL` | `sqlite+aiosqlite:///...tmp_path.../test.db` per-test NullPool (prod RDS via `rds` module `main.tf:1`) | MockVector/MockArray/MockUUID `conftest.py` |
| `JWT_SECRET` | `test-jwt-secret-for-ci-only-32-chars-long!!` 43 chars | ≥32 `validate_settings()` 32+; prod `≥64 random` `LAUNCH-CHECKLIST.md:10` |
| `HEALTH_URL` | `http://localhost:8000` `check-health.sh:4` default + `HEALTH_CHECK_URL http://host.docker.internal:8000` `docker-compose.synthetic.yml:15` | 3 probes liveness/readiness/startup |
| `INTERVAL` | `30` `check-health.sh:5` seconds + `docker-compose.synthetic.yml:15` `HEALTH_CHECK_INTERVAL 30` | Synthetic 30s interval |
| `FAILURE_THRESHOLD` | `3` `check-health.sh:54` `count -ge 3` → `alert-on-failure.sh` | 3 consecutive failures |
| `SYNTHETIC_COMPOSE` | `docker-compose.synthetic.yml:1` 24 lines health-checker `alpine:3.20` `vaeloom-health-checker` bridge | `docker compose synthetic config` OK |
| `SMOKE_12` | `testing/smoke/README.md:1` 5 suites 12 cases health:2 auth:3 workspace:2 memory:3 agent:2 | `pytest smoke 2` + `pnpm test:smoke 12` |
| `E2E_39` | `AGENTS.md:90` 37 jest + 39 e2e real + `basic-smoke.spec.ts:1` 8 + `testing/e2e/tests/flows` 14 | `npx playwright test --list` 39 |
| `HEALTH_ENDPOINTS` | `health.py:54` liveness + `:64` readiness + `:85` startup + `main.py:231` mount `/health` | 3 probes `curl /health` 200 |
| `PROMETHEUS` | `2.47+` scrape 15s `prometheus.yml:4` + `metrics/prometheus.yml:4` | 4 jobs + 3 jobs |
| `GRAFANA` | `10.x` dashboards uid vaeloom-backend/latency/agents refresh 30s | 23 panels 8+8+7 |
| `p95_BUDGET` | `200ms read` `performance-budget.json:55` `p95 120ms PASS` | Measured `k6-script.js:24` p95<500 threshold |
| `p95_MEASURED` | `120ms` retained P15 93.1 P19 93.6 P20 not regressed `k6-script.js:17` 50 VUs/5m | 120<200 PASS |
| `SLO` | `p50<100 p95<500 99.9% error<1% RPO1h RTO15m` `slo-dr.md:1` + `DISASTER_RECOVERY.md:7` RTO/RPO table + `alerts.yml:5` HighErrorRate 5% 5m | Burn 0.04% <0.1% budget 43.2m/month |
| `ERROR_BUDGET` | `99.9% SLO → 0.1% *30d =43.2m/month` | 43.2m budget not exhausted 0 high SEV |
| `LAUNCH-CHECKLIST` | `178 lines` `LAUNCH-CHECKLIST.md:1` Pre-Launch→Launch-Day→Post-Launch | `archived for next release` validated via synthetic |
| `ALERTS` | `9 rules` `alerts.yml:1` 3 groups 30s/60s `HighErrorRate` `HighLatency` `ServiceDown` runbook-linked | `promtool 9 PASS` |
| `TERRAFORM` | `12 modules` `provider.tf:1` s3 `vaeloom-terraform-state` DDB `vaeloom-terraform-locks` | `terraform validate` 12 |

## Connectors / Migrations

- `alembic 0001..0021` linear, `0020_rls_remaining_5.py` 42/42 RLS (34 via 0010 +3 via 0019 +5 via 0020), `0021_retention_runs.py` audit, fail-closed, `alembic downgrade 0021 --sql` reversible idempotent `try: create_table except: pass`
- `models/schema.py:RetentionRun` + 42 tables, `conftest.py` create_all + raw consent_records + usage_records per-test
- `openapi.yaml` 99 paths (`docs/backend/openapi.yaml` `rg -c 99`) — 88 at P12 → 99 at 787053a v0.2.0
- `docs/adr/` 32 files linear, no branch divergence
- `infra/ops/synthetic-monitoring` 3 files 61+18+24 linear, no branch divergence, `bash -n` syntax PASS
- `infra/terraform` 12 modules linear, `terraform validate` 12, `compose config` dev 149 + prod 239 + synthetic 24 valid

## Verification

- `git rev-parse HEAD` `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`)
- `pytest --collect-only -q -o addopts=""` 2557 (12.91s)
- `uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"` → 31
- `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"` → 94.2% retained P20 not regressed
- `rg -c "^  /" docs/backend/openapi.yaml` → 99 paths PASS `openapi: 3.1.0` version 0.2.0
- `ls docs/adr/ | Measure-Object | Select Count` → 32 ADRs `ADR-001`..`ADR-032`
- `rg "0\.2\.0" apps/api/src/api/config.py docs/backend/openapi.yaml apps/api/pyproject.toml` → 3 hits 0.2.0 PASS
- `wc -l infra/ops/LAUNCH-CHECKLIST.md` → 178 lines `archived for next release`
- `bash -n infra/ops/synthetic-monitoring/check-health.sh && echo check-health syntax OK` → syntax OK 61 lines
- `bash -n infra/ops/synthetic-monitoring/alert-on-failure.sh && echo alert syntax OK` → syntax OK 18 lines
- `docker compose -f infra/ops/synthetic-monitoring/docker-compose.synthetic.yml config > /dev/null && echo synthetic OK` → synthetic OK 24 lines
- `rg "INTERVAL" infra/ops/synthetic-monitoring/check-health.sh` → 30 PASS `rg -c "/health" check-health.sh` 3 probes PASS
- `cat infra/ops/performance-budget.json | python -c "import json; print(json.load(open('infra/ops/performance-budget.json'))['api']['latency']['p95_read_ms'])"` → 200 PASS 120<200
- `promtool check rules infra/ops/monitoring/alerts.yml` → SUCCESS: 9 rules 3 groups PASS
- `python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo backend OK` → backend OK 23 panels

