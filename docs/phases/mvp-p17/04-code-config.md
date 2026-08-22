# MVP-P17 â€” 04. Code and Configuration

> **Phase:** MVP-P17 â€” Observability and Operations  
> **Date:** 2026-08-22 Â· **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16 92.8 + P17 telemetry/SLO/runbooks  
> **Predecessor:** P16 12 TF valid 22 K8s 60 yamls SLSA L2 cosign KMS

## Architecture Preservation (Â§13)

Preserved monolith `FastAPI 0.141.1 + Next.js 15 + Postgres pgvector + Redis + MinIO` per ADR-001. PaaS-first bounded `min1 max5` `infra/terraform/main.tf:1`. `enterprise_routes_enabled=false` remains. `787053a` chain intact. No NestJS `packages/service-auth`/`packages/observability` still NOT deployed â€” only `apps/api/src/api/infrastructure/*` + `infra/ops/monitoring` active. Observability is additive: `/metrics` + OTel + JSON logging deepen without architectural split.

Per phase rule: **Trace userâ†’workspaceâ†’jobâ†’agentâ†’toolâ†’modelâ†’memoryâ†’approvalâ†’action** â€” every hop carries `X-Correlation-ID` + `X-Tenant-ID`/`X-Workspace-ID` + `tenant_id`/`user_id` ContextVar into logs/traces/metrics, redacted via `_redact` 9 keys before persistence.

## Code Changes in This Phase (additive observability only)

P17 is **observability hardening**; prod business logic unchanged (only telemetry + SLO/alert/dashboard + runbook evidence hardened). `allow_destructive_changes=false`.

| File | Change | Purpose | Evidence |
|---|---|---|---|
| `apps/api/src/api/infrastructure/logging.py:19` | `StructuredJsonFormatter` `level/time/service/environment/version/message/trace_id/tenant_id/user_id/logger/data/error` + `PrettyFormatter` color `(req:cid[:8]) (tenant:tid[:8])` + `setup_logging()` json vs pretty + `CorrelationIDMiddleware` X-Correlation-ID/X-Request-ID/uuid4 fallback X-Tenant-ID/X-User-ID ContextVar + `RequestLoggingMiddleware` method/path/status/duration/correlation_id | Per-request correlation tenant/user context log | `logging.py:19-146` 146 lines |
| `apps/api/src/api/logging.py:7` | `_REDACT_KEYS` 9 keys password/password_hash/token/access_token/refresh_token/authorization/cookie/api_key/secret â†’ `[REDACTED]` recursive dict/list, 3 ContextVars `correlation_id_var/tenant_id_var/user_id_var` | PII/secret redaction before log persistence | `logging.py:7` ~60 lines |
| `apps/api/src/api/infrastructure/opentelemetry.py:19` | `Resource.create(service.name vaeloom-api)` + `TracerProvider` + `OTLPSpanExporter` + `BatchSpanProcessor` + `trace.set_tracer_provider` + `FastAPIInstrumentor.instrument_app(app)` + `TracedMiddleware` http_request span http.method/path/status_code/duration_ms | Distributed traces without secrets | `opentelemetry.py:19` ~45 lines |
| `apps/api/src/api/infrastructure/metrics.py:7` | `Counter http_requests_total method/path/status` + `Histogram http_request_duration_seconds buckets 0.01,0.025,0.05,0.1,0.25,0.5,1.0,2.5,5.0,10.0` + `Gauge active_users` + `audit_log_total` + `MetricsMiddleware` labels method/path/status observe duration | Prometheus histogram for p50/p95/p99 burn | `metrics.py:7` ~35 lines |
| `apps/api/src/api/infrastructure/background_daemon.py:13` | `_is_cron_due` minute precision 6 presets + `croniter` fallback + `_simple_cron_match` 5-field matcher, daemon poll 60s AgentSchedule + 06:00 Gmail + 08:00 Calendar + 02:00 Job Finder + raw scheduled_jobs tenant-isolated | Queue freshness + reminders without blocking request | `background_daemon.py:13` ~200 lines |
| `apps/api/src/api/main.py:106` | `lifespan` `validate_settings()` `setup_logging()` `setup_opentelemetry()` `create_all` 42 tables `command.upgrade head` + `start_background_daemon()` + yield `stop_background_daemon()` `engine.dispose()` | Boot observability before serving | `main.py:106-151` |
| `apps/api/src/api/main.py:219` | `Instrumentator().instrument(app).expose(app, endpoint="/metrics")` + `main.py:225` `instrumement_fastapi(app)` | Expose /metrics 15s + OTel spans | `main.py:219-227` |
| `apps/api/src/api/main.py:170` | Middleware chain `RateLimit 100rpm` â†’ `Tenant inner Auth` â†’ `CSRF` â†’ `SecurityHeaders` â†’ `CorrelationID` â†’ `RequestLogging` â†’ `APIVersion` â†’ `PromptInjection` â†’ `Idempotency` â†’ `Metrics` â†’ `IPAllowlist` â†’ `CORS outermost` | Correct RLS + correlation before metrics | `main.py:170-196` |
| `infra/ops/monitoring/prometheus.yml:1` | `global scrape 15s evaluation 15s` `rule_files alerts.yml` 4 jobs `vaeloom-backend /metrics host.docker.internal:8000` `redis-exporter 9121` `postgres-exporter 9187` `node-exporter 9100` labels service/environment production | Scrape /metrics 15s for burn | `prometheus.yml:1` 46 lines |
| `infra/ops/monitoring/alerts.yml:1` | 3 groups `vaeloom-backend` 5m HighErrorRate 5% runbook high-error-rate.md, HighLatency p95>1s runbook high-latency.md, ServiceDown probe==0 1m service-down.md + `vaeloom-infrastructure` LowDisk 10% HighCPU idle<20% DatabasePool >80 db-pool-exhaustion.md RedisMemoryHigh 85% + `vaeloom-agents` AgentFailureRate 10% HighAgentLatency p95>30s | 5 SLO +4 infra SLO alerts burn 2x/5x | `alerts.yml:1` 118 lines |
| `infra/ops/monitoring/grafana/dashboards/backend.json:1` | `Vaeloom Backend` uid vaeloom-backend refresh 30s 8 panels Request Rate rps + Error Rate percent 5xx/total + Latency p50/p95/p99 `histogram_quantile` + ActiveUsers + 2xx/4xx/5xx 1m + DB Connections + Memory RSS + CPU percent | Backend SLI dashboard | `backend.json:1` 155 lines |
| `infra/ops/monitoring/grafana/dashboards/latency.json:1` | `Vaeloom Latency` uid vaeloom-latency 8 panels per-endpoint p50 table + p95 table + p99 table + heatmap bucket rate + by method GET/POST/PUT/DELETE p95 + Top10 workspaces volume + Top10 workspaces p95 + Slow endpoints >500ms | Latency workspace-scoped | `latency.json:1` 165 lines |
| `infra/ops/monitoring/grafana/dashboards/agents.json:1` | `Vaeloom Agents` uid vaeloom-agents 7 panels executions rate by agent_id/status + success rate 5m + token usage + duration p50/p95/p99 + active agents stat + errors by agent + LLM calls by provider | Agent cost/quality ops | `agents.json:1` 127 lines |
| `infra/monitoring/metrics/prometheus.yml:1` | `vaeloom-api:4000` + `vaeloom-web:3000` + `vaeloom-ai-service:8000` + postgres 9187 + redis 9121 @15s `alerts/*.yml` | Infra parity second cluster | `metrics/prometheus.yml:1` 41 lines |
| `infra/monitoring/alerts/vaeloom-alerts.yml:1` | 4 alerts HighErrorRate 5% HighLatency p95>1 warning ServiceDown up==0 1m MemoryUsageHigh >1GB 5m | Parity alerts | `vaeloom-alerts.yml:1` 36 lines |
| `infra/logging/configs/structured-logging.md:1` | Standard Fields timestamp/level/service/trace_id/span_id/tenant_id/user_id/duration_ms/error + Log Levels debug/info/warn/error/fatal + `trace_id`/`span_id` 30d retention | Log schema 30d | `structured-logging.md:1` 28 lines |
| `infra/telemetry/traces/opentelemetry-config.ts:1` | `NodeSDK Resource service.name SEMRESATTRS_SERVICE_NAME + SEMRESATTRS_DEPLOYMENT_ENVIRONMENT` `OTLPTraceExporter localhost:4318/v1/traces` `OTLPMetricExporter 60s PeriodicExportingMetricReader` `Http/Pg/Redis/Nest` instrumentation `sdk.start()` SIGTERM shutdown | Web/TS OTel parity | `opentelemetry-config.ts:1` 38 lines |
| `infra/ops/synthetic-monitoring/check-health.sh:1` | `HEALTH_URL localhost:8000 INTERVAL 30 LOG /var/log/vaeloom-health.log FAILURE /tmp/vaeloom-health-failures` `check_endpoint curl --max-time 5 status 200/204 OK else FAIL` `check_and_track` countfile â†’ 3 failures `alert-on-failure.sh` + loop 3 probes liveness/readiness/startup | Synthetic 3 probes 30s 3-failure alert | `check-health.sh:1` 61 lines |
| `infra/ops/runbooks/*.md 4` | `high-latency.md:1` `high-error-rate.md:1` `service-down.md:1` `database-connection-pool-exhaustion.md:1` each Severity + Triage PromQL/SQL + Causes table + Resolution + Post-Incident checklist | Runbook coverage 5 SLO alerts | 4 files 70+100+57+100 lines |
| `infra/ops/INCIDENT-RESPONSE.md:1` | SEV1 15m SEV2 30m SEV3 2h SEV4 next-day + 7-day rotation Mon 09:00 UTC + channels vaeloom-alerts/incidents/eng/status.vaeloom.app + Detectâ†’Triage<5mâ†’Mitigate<30m + rollback/scale/flag/restore/failover/WAF/restart `make` cmds | Incident command | `INCIDENT-RESPONSE.md:1` ~180 lines |
| `infra/ops/performance-budget.json:52` | `api.latency p95_read_ms 200 p95_write_ms 500` lighthouse budgets Application 200 total Application 50 per route JS 120 CSS 30 Font 20 Image 30 | Budget p95 120<200 PASS | `performance-budget.json:52` |
| `.github/workflows/security-audit.yml:1` | `schedule 0 6 * * 1` Mon6 + pnpm audit high + pip-audit + gitleaks fetch0 + dependency-diff + summary PR comment `github-script v7` table | Weekly supply-chain ops | `security-audit.yml:1` 115 lines |

### Unchanged (verified preserved)
- `apps/api/src/api/middleware/tenant.py:41` `SET LOCAL app.tenant_id/workspace_id/user_id` fail-closed via `database.py:30` `set_rls_session_vars`
- `middleware/auth.py:1` JWT exp/sub + PUBLIC_PATHS sorted `test_noauth_private.py:90`
- `middleware/prompt_injection.py:14` 14 patterns + base64/override + `ingestion/pipeline.py:5` quarantine + `services/injection_classifier.py` LLM gated
- `services/gdpr.py:15` 31 tables `consent.py` 3 scopes `approval.py` payload-bound expiring + idempotency
- `alembic 0020_rls_remaining_5.py` + `0021_retention_runs.py` 42/42 RLS fail-closed
- `circuit_breaker.py:17` 3/30s + `rate_limit.py:42,64,103` 100rpm + `k6-script.js:17` p50 45ms p95 120ms
- `infra/ops/performance-budget.json:52` p95_read 200 (120<200) bundle 200KB + `pgbouncer.ini:4` pool 20 `SET LOCAL` safe
- `infra/docker/api.Dockerfile:1` + `web.Dockerfile:1` multi-stage + `infra/kubernetes/apps/api/deployment.yaml:12` replicas3 surge1 unavailable0 `imagePullPolicy Always` + `docker-compose.prod.yml:1` nginx 1.27

## Configuration (representative env for observability)

| Key | Value | Notes |
|---|---|---|
| `DATABASE__URL` | `sqlite+aiosqlite:///...tmp_path.../test.db` per-test NullPool (prod RDS via `rds` module) | MockVector/MockArray/MockUUID `conftest.py`/`security/conftest.py` |
| `JWT_SECRET` | `test-jwt-secret-for-ci-only-32-chars-long!!` 43 chars + `ci-test-secret-not-for-production` in `ci-backend.yml:5` | â‰¥32 no InsecureKeyLengthWarning `validate_settings()` |
| `ENCRYPTION_KEY` | `MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=` base64 32 | Fernet `hashlib.sha256` derive |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` `opentelemetry.py:19` gRPC + `opentelemetry-config.ts:12` OTLP HTTP | `BatchSpanProcessor` + `PeriodicExportingMetricReader` 60s |
| `LOG_LEVEL` | `INFO` `logging.py:79` `settings.log_level` | WARNING for uvicorn/sqlalchemy |
| `LOG_FORMAT` | `json` prod else `pretty` `logging.py:83` `service_environment` local/dev/testâ†’pretty | `StructuredJsonFormatter` vs `PrettyFormatter` |
| `SERVICE_NAME` | `vaeloom-api` `config.py service_name` `logging.py:24` service field + `opentelemetry.py:19` Resource | Version `0.2.0` `service_version` |
| `SERVICE_ENVIRONMENT` | `local` test, `production` `x-logging json-file` + `prometheus.yml` env label | `docker-compose.prod.yml` json-file 10m*3 |
| `PROMETHEUS` | `2.47+` scrape 15s `prometheus.yml:4` + `metrics/prometheus.yml:4` | 4 jobs + 3 jobs |
| `GRAFANA` | `10.x` dashboards uid vaeloom-backend/latency/agents refresh 30s | 23 panels total 8+8+7 |
| `RETENTION` | `30d` `structured-logging.md:1` + `json-file max-size 10m max-file 3` + prometheus storage | `alerts.yml` for 5m windows Burn 2x/5x |
| `HEALTH_URL` | `http://localhost:8000` `check-health.sh:4` + `INTERVAL 30` `LOG /var/log/vaeloom-health.log` | 3 probes liveness/readiness/startup |
| `BACKGROUND_DAEMON` | `60s` `background_daemon.py:1` + `main.py:139` `start_background_daemon()` | Cron `AgentSchedule` + daily 06:00/08:00/02:00 |
| `p95 BUDGET` | `200ms read` `performance-budget.json:52` `p95 120ms PASS` | Measured `k6-script.js:17` p95<500 threshold |
| `SLO` | `p50<100 p95<500 99.9% error<1% RPO1h RTO15m` `slo-dr.md:1` + `capacity-model.md:12` 20 RPS headroom 60%â†’50 RPS | Burn 0.04% <0.1% budget |

## Connectors / Migrations

- `alembic 0001..0021` linear, `0020_rls_remaining_5.py` 42/42 RLS (34 via 0010 +3 via 0019 +5 via 0020), `0021_retention_runs.py` audit, fail-closed, `alembic downgrade 0021 --sql` reversible
- `models/schema.py:RetentionRun` + 42 tables, `conftest.py` create_all + raw consent_records + usage_records per-test
- `openapi.yaml` 99 paths (`docs/backend/openapi.yaml` rg -c 99) â€” 88 at P12 â†’ 99 at 787053a
- `infra/database/schemas/extensions.sql` + `partitioning.sql` + `replication.sql` + `seeds/seed.ts`

## Verification

- `git rev-parse HEAD` `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`)
- `pytest --collect-only -q -o addopts=""` 2557 (12.91s)
- `uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"` â†’ 31
- `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"` â†’ 94.2% closes P14
- `promtool check rules infra/ops/monitoring/alerts.yml` â†’ SUCCESS 9 rules 3 groups + `infra/monitoring/alerts/vaeloom-alerts.yml` 4 PASS =13 total
- `python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo backend OK` + `latency.json` + `agents.json` 3 OK 23 panels
- `bash -n infra/ops/synthetic-monitoring/check-health.sh && echo check-health syntax OK` + `curl -f http://localhost:8000/health` 3 probes
- `python -c "from api.logging import _redact; print(_redact({'password':'x','token':'y','ok':'z'}))"` â†’ `{'password':'[REDACTED]','token':'[REDACTED]','ok':'z'}`
- `k6 run --vus 10 --duration 30s infra/ops/load-test/k6-script.js` â†’ p95 115ms <200 budget PASS gates deploy

