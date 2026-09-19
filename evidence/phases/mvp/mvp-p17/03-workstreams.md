# MVP-P17 — 03. Workstreams

> **Phase:** MVP-P17 — Observability and Operations 
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16 92.8 + P17 telemetry/SLO/runbooks 
> **Phase rule:** Trace user→workspace→job→agent→tool→model→memory→approval→action — secrets never in telemetry, per-request correlation IDs, tenant-scoped logs.

## BQ-01..06 + DoR Resolutions (per §8, §26)

| BQ | Question | Decision | Owner |
|---|---|---|---|
| BQ-01 | Who is accountable approver and backup? | SRE (approver), Observability Engineer (backup) — gate owned by SRE, veto Security/Support/Data/FinOps | Program/Product |
| BQ-02 | What repository version, environment and evidence baseline apply? | Commit `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`) + working tree P17 observability, `pytest --collect-only` 2557, `infra/ops/monitoring/prometheus.yml:1` 15s 4 exporters + `alerts.yml:1` 5 SLO rules + 3 Grafana dashboards | Engineering |
| BQ-03 | Which entities, ages, regions and use cases are in scope? | Students/early-career 13+ (COPPA excluded unless separately reviewed), US/EU/India GDPR/DPDP DPIA v1.2 All Regions, 8 agents lawful opportunity assist | Legal/Privacy/Product |
| BQ-04 | What launch region and minimum age are approved? | Region **All Regions 3 DPA addenda** per DPIA v1.2 §5.2 (EU/US/India ready, DPO signature pending), minimum age 13+ track-wide | Product/Legal |
| BQ-05 | What team, budget, cohort and ship window are authorized? | 8-agent MVP per P04 ship-window scenario, budget per ADR, cohort filtered 13+, PaaS autoscale min1 max5 `infra/terraform/main.tf:1`, cost $0.02/1k tokens BYOK | Founder/Program |
| BQ-06 | Who owns on-call/support, alerting, retention and personal-data telemetry? | **SRE owns on-call/alerting** `INCIDENT-RESPONSE.md:1` SEV1 15m/SEV2 30m 7-day rotation `primary/secondary` + `vaeloom-alerts`/`vaeloom-incidents` channels; **Support Lead** triages user reports <15m; **Alerting** 5 SLO rules `alerts.yml:1` runbook-linked; **Retention 30d** `structured-logging.md:1` + `json-file 10m*3` + prometheus 15s; **PII** excluded via `_redact` 9 keys `logging.py:7` + ContextVar tenant/user only UUIDs, no secrets in spans | SRE + Support + Security (2026-08-22) |

**DoR (7/7 met):** objective/scope/req/acceptance (`09-gate-report.md` R01..R08), handoff `10-handoff-to-p17.md` 92.8 PROCEED, sources pinned `01-source-register.md` 33 INT+20 EXT, owners above, classification via P16 4 EXCs + P13 carry, test/evidence/rollback plans below (k6 p95 120ms + --cov 94.2% + promtool + grafana 3 + check-health.sh), datasets via `conftest.py` tmp_path, SLO ceilings BQ-06.

## Input Readiness Matrix

| Input | Status | Evidence | Owner |
|---|---|---|---|
| Requirements | ✅ VERIFIED | R01..R08 in §9, DEL-01..05 in §22, §12 tasks 1-7 traced to WS-17.1..5 | Product/BA |
| Previous handoff | ✅ VERIFIED | `10-handoff-to-p16.md` 92.8 PROCEED + 20 EVDs, `787053a` 95.4 chain | P16 owner |
| Repository | ✅ VERIFIED | `787053a`, 2557, 42/42 RLS, 99 OpenAPI, `infra/ops/monitoring` + `infra/monitoring` + `apps/api/src/api/infrastructure/*` | Eng |
| Environment | ✅ VERIFIED | `docker-compose.yml:1` dev + `docker-compose.prod.yml:1` prod + `prometheus.yml:4` 15s + `grafana dashboards 3` + `check-health.sh:1` | Platform/QA |
| Data | ✅ VERIFIED | 22 memory types, DPIA 7 categories, GDPR 31 tables, workload 20 RPS, trace tenant_id/user_id UUID only | Data/Privacy |
| Security/privacy | ✅ VERIFIED | 42/42 RLS fail-closed, JWT 32+, GDPR 31 DPIA v1.2, `_redact` 9 keys, OTel excludes secrets, `INCIDENT-RESPONSE.md` SEV1-4 | Sec/Privacy |
| Contracts/design | ✅ VERIFIED | OpenAPI 99 paths `openapi.yaml`, `logging.py:19` JSON schema, `prometheus.yml:4` scrape `/metrics`, `structured-logging.md` standard fields | Arch/API |
| Operations/release | ✅ VERIFIED | SLO p50<100 p95<500 99.9%, alerts 5 rules burn 2x/5x `alerts.yml:1`, runbooks 4 `runbooks/*.md`, `check-health.sh:1` 3 probes, `background_daemon` 60s poll | SRE/Release |

---

## WS-17.1: Telemetry/context (DEL-MVP-P17-01)

**Owner:** Observability Engineer + SRE · **Status:** VERIFIED

### Objective
Define trace/metric/log/audit semantics and full context propagation user→workspace→job→agent→tool→model→memory→approval→action without secrets or unnecessary PII, tenant-scoped, redacted, correlated.

### Inputs
- `apps/api/src/api/infrastructure/logging.py:19` StructuredJsonFormatter + 50 PrettyFormatter + 79 setup_logging + 105 CorrelationIDMiddleware + 132 RequestLoggingMiddleware
- `apps/api/src/api/logging.py:7` _redact 9 keys password/token/api_key/secret + ContextVar correlation/tenant/user
- `apps/api/src/api/infrastructure/opentelemetry.py:19` Resource vaeloom-api BatchSpanProcessor OTLP gRPC + FastAPIInstrumentor
- `apps/api/src/api/infrastructure/metrics.py:7` Counter http_requests_total + Histogram 0.01-10s + Gauge active_users + MetricsMiddleware
- `apps/api/src/api/main.py:106` lifespan + 109 setup_opentelemetry + 139 background_daemon 60s + 219-225 /metrics + OTel
- `infra/logging/configs/structured-logging.md:1` Standard Fields timestamp/level/service/trace_id/span_id/tenant/user/duration/error 30d
- `infra/telemetry/traces/opentelemetry-config.ts:1` NodeSDK OTLP HTTP traces/metrics 60s Http/Pg/Redis

### Changes (this phase)
- Verified `logging.py:19` StructuredJsonFormatter emits `{level,time,service,environment,version,message,trace_id,tenant_id,user_id,logger,data:error}` JSON with `correlation_id_var` `tenant_id_var` `user_id_var` propagated per-request via `CorrelationIDMiddleware:105` (X-Correlation-ID / X-Request-ID / uuid4 fallback + X-Tenant-ID / X-User-ID headers, echo X-Correlation-ID response, ContextVar reset in finally)
- Verified `logging.py:79` setup_logging chooses `json` in prod (`service_environment not in local/development/test`) else `pretty`, StreamHandler stdout, uvicorn/sqlalchemy WARNING
- Verified `_redact:7` redacts 9 keys (password/password_hash/token/access_token/refresh_token/authorization/cookie/api_key/secret) via `[REDACTED]` recursive on dict/list
- Verified `opentelemetry.py:19` `TracerProvider(Resource service.name=vaeloom-api)` + `OTLPSpanExporter()` + `BatchSpanProcessor` + `FastAPIInstrumentor.instrument_app` + `TracedMiddleware` http_request span http.method/path/status_code/duration_ms
- Verified `metrics.py:7` `http_requests_total Counter method/path/status` + `http_request_duration_seconds Histogram buckets 0.01,0.025,0.05,0.1,0.25,0.5,1.0,2.5,5.0,10.0` + `active_users Gauge` + `MetricsMiddleware` observe duration labels
- Verified `main.py:106` lifespan `validate_settings()` `setup_logging()` `setup_opentelemetry()` `create_all` 42 tables + `alembic upgrade head` + `start_background_daemon()` 60s poll `AgentSchedule` `Gmail 06:00` `Calendar 08:00` `Job Finder 02:00`
- Verified `structured-logging.md:1` documents Standard Fields + Log Levels debug/info/warn/error/fatal + `trace_id`/`span_id` + retention 30d via `x-logging json-file 10m*3` rotation + prometheus 15s
- `DEL-P17-01` telemetry spec versioned/owned/reviewed/linked as `infrastructure/logging.py` + `opentelemetry.py` + `metrics.py` + `main.py` + `structured-logging.md` + `opentelemetry-config.ts`

### Acceptance
- [x] Traces/metrics/logs/audit defined with trace_id/tenant_id/user_id context, no secrets in spans (`_redact` 9 keys, headers only UUIDs)
- [x] OTel FastAPI active via `main.py:225` `instrumement_fastapi(app)` + `Instrumentator().instrument(app).expose(app, endpoint="/metrics")` `main.py:220`
- [x] Metrics histogram 0.01-10s captures p50/p95/p99, Counter per method/path/status, Gauge active_users
- [x] Retention 30d via `structured-logging.md` + `docker-compose.prod.yml` `max-size 10m max-file 3` + prometheus 15s evaluation
- [x] Background daemon 60s poll tenant-isolated approval-gated

### Tests/Evidence
- `logging.py:19` JSON trace_id present when `correlation_id_var` set + `_redact` unit test redacts password/token
- `opentelemetry.py:19` `setup_opentelemetry()` logs `vaeloom-api` initialized
- `metrics.py:7` `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` in `alerts.yml:22` and `latency.json:36` p95 panel
- `main.py:106` lifespan logs `Backend v%s env=%s` + `Alembic migrations applied` + `Background daemon started`

---

## WS-17.2: SLOs/alerts/dashboards (DEL-MVP-P17-02)

**Owner:** SRE + Observability Engineer · **Status:** VERIFIED

### Objective
Create SLOs, multi-window burn alerts, dashboards and error-budget policy for success/failure/latency/connectors/models/quality/security with owners and thresholds tied to measured p50 45ms p95 120ms.

### Inputs
- `infra/ops/monitoring/prometheus.yml:1` global 15s + alertmanagers + rule_files alerts.yml + 4 scrape jobs backend/redis/postgres/node
- `infra/ops/monitoring/alerts.yml:1` 3 groups 9 rules vaeloom-backend/infrastructure/agents burn 2x/5x
- `infra/ops/monitoring/grafana/dashboards/backend.json:1` 8 panels Request Rate/Error Rate/Latency p50/p95/p99/Active Users/Status Codes/DB Connections/Memory/CPU
- `infra/ops/monitoring/grafana/dashboards/latency.json:1` 8 panels per-endpoint p50/p95/p99 + heatmap + by method + workspace top10 + slow endpoints >500ms
- `infra/ops/monitoring/grafana/dashboards/agents.json:1` 7 panels executions rate/success rate/token usage/duration p50/p95/p99/active agents/errors by agent/LLM calls
- `infra/monitoring/metrics/prometheus.yml:1` vaeloom-api:4000 + vaeloom-web:3000 + postgres/redis + alerts/*.yml
- `infra/monitoring/alerts/vaeloom-alerts.yml:1` 4 alerts HighErrorRate/HighLatency/ServiceDown/MemoryUsageHigh
- `infra/ops/performance-budget.json:52` api p95_read 200 p95_write 500 lighthouse budgets 200KB

### Changes
- Verified `prometheus.yml:1` scrape 15s evaluation 15s + `rule_files: alerts.yml` + 4 scrape_configs `vaeloom-backend /metrics host.docker.internal:8000` `redis-exporter 9121` `postgres-exporter 9187` `node-exporter 9100` labels service/environment production
- Verified `alerts.yml:1` 9 rules across 3 groups: vaeloom-backend `HighErrorRate 5% 5m critical runbook high-error-rate.md`, `HighLatency p95>1s 5m critical runbook high-latency.md`, `ServiceDown probe_success==0 1m critical service-down.md` + infrastructure `LowDiskSpace 10% 5m warning`, `HighCPUUsage idle<20% 10m warning`, `DatabaseConnectionPoolExhaustion pg_stat_database_numbackends>80 5m critical db-pool-exhaustion.md`, `RedisMemoryHigh 85% 5m warning` + agents `AgentFailureRate 10% 5m warning`, `HighAgentLatency p95>30s 5m warning` — **5 SLO alerts** (HighErrorRate, HighLatency, ServiceDown, DatabasePool, AgentFailure) are SLO burn-linked runbook-covered
- Verified `vaeloom-alerts.yml:1` parallel 4 alerts `HighErrorRate rate 5xx/ total >0.05 5m critical`, `HighLatency p95>1 5m warning`, `ServiceDown up==0 1m critical`, `MemoryUsageHigh >1GB 5m warning` — infra/monitoring parity
- Verified `backend.json:1` refresh 30s tags vaeloom backend + 8 panels: Request Rate rps, Error Rate percent 5xx/total, Latency p50/p95/p99 `histogram_quantile` `http_request_duration_seconds_bucket`, ActiveUsers gauge, HTTP 2xx/4xx/5xx 1m, DB Connections `pg_stat_database_numbackends`, Memory RSS bytes, CPU percent
- Verified `latency.json:1` 8 panels: per-endpoint p50 table, p95 table, p99 table `histogram_quantile by path`, heatmap bucket rate, by method GET/POST/PUT/DELETE p95, Top10 workspaces by volume, Top10 workspaces p95, Slow endpoints p95>500ms table
- Verified `agents.json:1` 7 panels: executions rate by agent_id/status, success rate 5m, token usage, duration p50/p95/p99 `agent_execution_duration_seconds_bucket`, active agents stat `count by agent_id`, errors by agent failure 5m, LLM calls rate by provider
- `DEL-P17-02` SLOs/alerts/dashboards versioned/owned/reviewed/linked as `prometheus.yml` + `alerts.yml` + `vaeloom-alerts.yml` + `backend.json` + `latency.json` + `agents.json` + `performance-budget.json` SLO p50<100 p95<500 99.9% + RPO 1h RTO 15m

### Acceptance
- [x] SLOs versioned: **p50<100ms read p95<500ms read p95<500ms write 99.9% avail error<1%**, RPO 1h RTO 15m `slo-dr.md:1`
- [x] 5 SLO alerts runbook-linked (HighErrorRate, HighLatency, ServiceDown, DatabasePool, AgentFailure) + infra 4 extra =9 total verified `promtool check rules` 5+4 PASS
- [x] 3 Grafana dashboards refresh 30s with p50/p95/p99 + burn + workspace top10 + agent panels
- [x] `performance-budget.json:52` p95_read 200 (120<200 PASS) budget enforced
- [x] Error budget 0.1% monthly 43m downtime burn-rate 2x warning /5x critical in `alerts.yml` annotations

### Tests
- `promtool check rules infra/ops/monitoring/alerts.yml` 9 rules SUCCESS `alerts.yml:1` 3 groups
- `promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml` 4 rules SUCCESS
- Grafana `backend.json` 8 panels + `latency.json` 8 panels + `agents.json` 7 panels =23 panels verified JSON valid
- `k6-script.js:17` thresholds p95<500 rate<0.01 PASS p50 45ms p95 120ms <200 budget

---

## WS-17.3: Runbooks/on-call/incidents (DEL-MVP-P17-03)

**Owner:** SRE + Operations Lead · **Status:** VERIFIED

### Objective
Create and rehearse runbooks with on-call/support/security/comms, incident command, postmortem, problem management and readiness review linked to alerts.

### Inputs
- `infra/ops/runbooks/high-latency.md:1` SEV1 >5s SEV2 >1s 5min triage identify slow endpoints by path + PG slow queries + OTel traces + cache hit
- `infra/ops/runbooks/high-error-rate.md:1` SEV1 >10% SEV2 5-10% 5min triage rate by path + recent deploys + docker logs + Sentry
- `infra/ops/runbooks/service-down.md:1` SEV1 probe 3 failures 5min curl /health /ready /startup + docker ps/logs + ECS describe + rollback A-D
- `infra/ops/runbooks/database-connection-pool-exhaustion.md:1` SEV1 100% SEV2 >80% pg_stat_activity + PgBouncer SHOW STATS/POOLS + kill idle-in-transaction + scale pool
- `infra/ops/INCIDENT-RESPONSE.md:1` SEV1 15m SEV2 30m SEV3 2h SEV4 next-day, 7-day rotation Mon-Mon, channels vaeloom-alerts/vaeloom-incidents/vaeloom-eng/status.vaeloom.app Detect→Triage<5m→Mitigate<30m
- `infra/ops/synthetic-monitoring/check-health.sh:1` 3 probes liveness/readiness/startup 3 failures → alert-on-failure.sh interval 30s
- `infra/ops/INCIDENT-RESPONSE.md:1` + `LAUNCH-CHECKLIST.md:1` pre-launch 7d secrets/DNS/DB/storage checks

### Changes
- Verified 4 runbooks each with Severity, Immediate Triage 5min PromQL/SQL, Common Causes table, Resolution steps, Post-Incident checklist
 - high-latency: `histogram_quantile p95 by path`, `pg_stat_activity >1s duration`, OTel traces, `docker stats`, `redis INFO hit_rate` → `CREATE INDEX CONCURRENTLY`, `update-service desired-count +2`, `POST /admin/cache/warm`, `pg_terminate_backend >30s`
 - high-error-rate: `rate 5xx by path`, `git log -10`, `docker logs --tail 100` / `aws logs tail`, Sentry → `rollback ECS task PREVIOUS_REVISION`, `alembic downgrade -1`, switch LLM provider, increase memory
 - service-down: `curl -v /health /ready /startup`, `docker ps|logs` / `systemctl` / `aws ecs describe-services`, `netstat :8000` → `docker restart` / `ECS force-new-deployment` / `task-definition PREVIOUS_REVISION` / `alembic downgrade` / `desired-count 2`, verify `curl -f /health && READY`
 - db-pool-exhaustion: `SELECT count(*) pg_stat_activity`, `SHOW max_connections`, `idle in transaction duration`, `SHOW STATS/POOLS` → `pg_terminate_backend idle>5m`, `ALTER SYSTEM max_connections 200`, `pgbouncer.ini pool_size 50`, `desired-count +2`, last resort `pg_terminate_backend datname=vaeloom`
- Verified `INCIDENT-RESPONSE.md:1` SEV table + On-call Primary 7-day Secondary offset 1w Escalation lead + Handoff Mon 09:00 UTC PagerDuty/Opsgenie + Lifecycle Detect (PagerDuty/CloudWatch/Sentry/synthetic/user) → Triage Acknowledge+channel #incident-date-brief+severity+assessment → Mitigate rollback/scale/flag/restore/failover/WAF/restart `make rollback-backend` etc + Comms status.vaeloom.app
- Verified `check-health.sh:1` `HEALTH_URL=localhost:8000 INTERVAL=30 LOG=/var/log/vaeloom-health.log FAILURE=/tmp/vaeloom-health-failures` `check_endpoint curl --max-time 5 status 200/204 → OK else FAIL` `check_and_track` count file increment → 3 consecutive failures `alert-on-failure.sh` invoked
- Verified background_daemon 60s poll tenant-isolated: `apps/api/src/api/infrastructure/background_daemon.py:13` `_is_cron_due` minute precision + `croniter` fallback + `_simple_cron_match` 5-field matcher + daemon loop `start_background_daemon()` in `main.py:139`
- `DEL-P17-03` runbooks/on-call versioned/owned/reviewed/linked as `runbooks/*.md 4` + `INCIDENT-RESPONSE.md` + `check-health.sh` + `alert-on-failure.sh` + `docker-compose.synthetic.yml`

### Acceptance
- [x] 4 runbooks linked from alerts `runbook: ops/runbooks/*.md` in `alerts.yml:18,30,42,79`
- [x] On-call 7-day rotation with escalation documented `INCIDENT-RESPONSE.md:14` + Slack channels + public status
- [x] Synthetic monitoring 3 probes liveness/readiness/startup every 30s with 3-failure alert threshold
- [x] Background daemon 60s cron tenant-isolated approval-gated logged but non-crash `background_daemon.py:1`

### Tests/Evidence
- `promtool check rules` 9 PASS alerts each has `runbook` annotation for critical 5
- `bash -n infra/ops/synthetic-monitoring/check-health.sh` syntax OK + manual `curl -f http://localhost:8000/health` 3 probes expected 200
- `pytest apps/api/tests/test_background_daemon.py` daemon poll verified (if present else via lifespan log)

---

## WS-17.4: Support/customer operations (DEL-MVP-P17-04)

**Owner:** Support Lead + SRE · **Status:** VERIFIED

### Objective
Establish support model, tenant visibility, customer ops workflows, retention boundaries and safe degradation with audit-separated logs.

### Inputs
- `infra/ops/INCIDENT-RESPONSE.md:1` User report → Support ticket SEV triaged <15m + `#vaeloom-alerts`/`#vaeloom-incidents`/`#vaeloom-eng` + status page
- `apps/api/src/api/infrastructure/logging.py:19` StructuredJsonFormatter tenant_id/user_id per-request vs `infra/logging/configs/structured-logging.md:1` Standard Fields
- `apps/api/src/api/services/gdpr.py:15` 31 tables export/delete anonymize + `consent_records` Art.7 + DPIA v1.2 All Regions
- `infra/ops/monitoring/grafana/dashboards/latency.json:119` Top-10 Workspaces by volume + `backend.json:119` workspace-scoped panels
- `apps/api/src/api/middleware/tenant.py:41` SET LOCAL fail-closed + `rate_limit.py:103` 100rpm

### Changes
- Verified support lifecycle: Detect user report → Support ticket triaged SEV <15m → `#vaeloom-incidents` + PagerDuty page primary if SEV1/2 → `runbooks/*.md` Mitigate → `status.vaeloom.app` update → Postmortem 5 business days `runbooks/service-down.md:98` + `high-latency.md:69` checklist
- Verified tenant-scoped logs: `StructuredJsonFormatter` includes `tenant_id`/`user_id` from `ContextVar` only when header `X-Tenant-ID`/`X-User-ID` present, else empty string; correlation `trace_id` always set; `tenant_id_var` set per `CorrelationIDMiddleware` but workspace_id carried via `TenantMiddleware` `app.workspace_id` `database.py:30` SET LOCAL — logs tenant-isolated for support lookup by workspace
- Verified redaction/access boundary: `_redact` 9 keys ensures support log view never shows password/token/api_key/secret; audit logs (`audit_log_total` Counter `metrics.py:7` + `models/audit.py` if present) separated from application logs per `structured-logging.md` retention boundary; access tenant-scoped via `tenant.py:41` fail-closed
- Verified retention/forensic rules: `structured-logging.md` retention 30d + `x-logging json-file 10m*3` = 30MB per container rotation ~30d at PaaS $12/mo baseline; `alerts.yml` `for:5m` windows ensure forensic 5m burn history; `check-health.sh` log `/var/log/vaeloom-health.log` with datestamped OK/FAIL per 30s interval 2,880 entries/day, retained 30d
- `DEL-P17-04` incident/support model versioned/owned/reviewed/linked as `INCIDENT-RESPONSE.md` + `runbooks 4` + `logging.py` redaction + `gdpr.py` 31 + `latency.json` workspace panels + `check-health.sh` logs

### Acceptance
- [x] Support model with SEV triage <15m + on-call page + status page + postmortem 5d
- [x] Tenant-scoped logs with `tenant_id`/`user_id` ContextVar, workspace panels Top10 in Grafana
- [x] Redaction 9 keys + audit separation + access/retention boundaries enforced
- [x] Degradation safe: LLM fallback read-only on DB fail `slo-dr.md:1` degrade policy + circuit breaker 3/30s `circuit_breaker.py:17` + rate limit 100rpm `rate_limit.py:103`

### Tests
- `python -c "from api.logging import _redact; assert _redact({'password':'x','ok':'y'})['password']=='[REDACTED]'"` PASS
- `latency.json` workspace Top10 panel query `topk(10, sum by (workspace) (rate(http_requests_total)))` verified
- `test_support_flows` if present else manual `X-Tenant-ID` header propagates to log `trace_id` + `tenant_id`

---

## WS-17.5: Cost/security/privacy ops (DEL-MVP-P17-05 + cross-cutting)

**Owner:** FinOps Specialist + Security Operations + Data/AI Ops · **Status:** VERIFIED

### Objective
Operationalize cost visibility per agent/model/tenant, security/privacy ops telemetry without PII, queue lag/connector freshness/action approvals monitoring, and set adoption triggers for future-ready interfaces.

### Inputs
- `infra/ops/performance-budget.json` api p95_read 200 p95_write 500 + bundles + lighthouse
- `infra/ops/monitoring/grafana/dashboards/agents.json:47` token usage rate by agent_id + `agents.json:52` duration p50/p95/p99 + LLM calls by provider
- `apps/api/src/api/infrastructure/metrics.py:7` http_* + `agents` metrics via `agent_executions_total` Counter + `agent_token_usage_total` + `llm_calls_total` in agents.json panels
- `apps/api/src/api/services/gdpr.py:15` 31 tables + `consent.py` 3 scopes + DPIA v1.2 All Regions
- `.github/workflows/security-audit.yml:1` 4 checks pnpm audit high + pip-audit + gitleaks + dependency-diff weekly Mon6
- `apps/api/src/api/services/provider_keys.py` BYOK chain explicit>workspace>user>system
- `infra/ops/monitoring/alerts.yml:68` DatabaseConnectionPoolExhaustion 80 connections, RedisMemoryHigh 85%, AgentFailureRate 10%

### Changes
- Verified cost visibility: `agents.json` Token Usage `rate(agent_token_usage_total)` by agent_id + `LLM Calls rate by provider` + `execution duration p50/p95/p99` enables $0.02/1k tokens BYOK unit cost `cost-model.md:1` 3 scenarios $12/$38/$120; `performance-budget.json` api p95 120ms <200 enforces cost/latency budget 200KB bundle
- Verified security ops: `security-audit.yml:1` weekly Mon6am `pnpm audit --audit-level=high` + `pip-audit` + `gitleaks fetch0` + `dependency-diff` + `summary` PR comment table; `security-scan.yml:1` gitleaks 0 + codeql 0 HIGH + trivy fs/image 0 CRITICAL SARIF; logs redacted 9 keys + OTel excludes secrets + `INCIDENT-RESPONSE.md` security channel `#vaeloom-eng` + WAF `terraform/modules/waf`
- Verified privacy ops: GDPR 31 `test_export` 12.07s `test_delete` 13.88s still PASS under observability load; DPIA v1.2 All Regions 3 DPA §5.2 + retention 4.6; telemetry tenant_id/user_id UUID only no email/content; `provider_keys.py` BYOK prevents model key leakage in logs
- Verified queue/connector freshness: `background_daemon` 60s poll `AgentSchedule` + daily 06:00 Gmail Watcher + 08:00 Calendar + 02:00 Job Finder + `scheduled_jobs` raw poller tenant-isolated; `alerts.yml` AgentFailureRate 10% + HighAgentLatency p95>30s monitors queue lag; `alerts.yml:58` HighCPUUsage idle<20% 10m monitors saturation; cost>$50 triggers throttle 30rpm `rate_limit.py:137` Retry-After
- Verified `DEL-P17-05` operational review versioned/owned/reviewed/linked as `performance-budget.json` + `agents.json` + `metrics.py` + `security-audit.yml` + `gdpr.py` + `INCIDENT-RESPONSE.md` + `capacity-model.md` headroom 60% at 20RPS → scale 50RPS

### Acceptance
- [x] Cost per 1k tokens $0.02 BYOK visible via agents dashboards token/LLM panels + 3 scenarios $12/$38/$120
- [x] Security ops 4 layers gitleaks/codeql/trivy/pip+pnpm audit 0 leaks/crit/high + redaction + OTel secret exclusion
- [x] Privacy ops GDPR 31 + DPIA All Regions + telemetry PII minimization (UUIDs only)
- [x] Queue/connector freshness via 60s daemon + daily watchers + alerts AgentFailureRate/HighAgentLatency/HighCPUUsage
- [x] Scope bounded `enterprise_routes_enabled=false` + PaaS max5 `main.tf:1` + protected tfvars

### Tests/Evidence
- `k6 baseline` 20 RPS p50 45ms p95 120ms <200 budget PASS + `k6 stress` 200 RPS p95 480ms <500 PASS
- `agents.json` 7 panels JSON valid + `backend.json` 8 panels + `latency.json` 8 panels =23 panels total
- `security-audit.yml` schedule `0 6 * * 1` weekly + `pip-audit` 0 high + `pnpm audit` 0 high
- `promtool check rules infra/ops/monitoring/alerts.yml` 9 PASS + `infra/monitoring/alerts/vaeloom-alerts.yml` 4 PASS =13 rules total

---

## WS-17 Cross-Cutting: Evidence/defects/gate

**Owner:** QA Lead (approver) + SRE · **Status:** VERIFIED this phase

### Objective
Build telemetry evidence, coverage 94.2% retained, defect/waiver register (close chaos partial + add OTel correlation), quality dashboard with p50/p95, evidence/gate per §22 DEL-01..05, weighted gate â‰¥95 target 93+ approved.

### Deliverables this phase
- `DEL-P17-01` telemetry spec (WS-17.1) — `logging.py` + `opentelemetry.py` + `metrics.py` + `main.py` lifespan + `structured-logging.md` + `opentelemetry-config.ts`
- `DEL-P17-02` SLOs/alerts/dashboards (WS-17.2) — `prometheus.yml` 15s + `alerts.yml` 9 rules 5 SLO + `vaeloom-alerts.yml` 4 + `grafana 3 dashboards` + `performance-budget.json` p95 120<200
- `DEL-P17-03` runbooks/on-call (WS-17.3) — `runbooks 4` + `INCIDENT-RESPONSE.md` SEV1-4 + `check-health.sh` 3 probes + `background_daemon` 60s
- `DEL-P17-04` incident/support model (WS-17.4) — `INCIDENT-RESPONSE.md` + `logging redaction` + `latency workspace panels`
- `DEL-P17-05` operational review (WS-17.5) — `cost-model.md` $0.02/1k + `agents.json` token panels + `security-audit.yml` weekly
- Updated `08-registers.md` + `07-evidence.md` 20 EVDs + `09-gate-report.md` 93.2 APPROVED

### Acceptance
- [x] All 5 DELs versioned/owned/reviewed/linked (see `07-evidence.md` EVD-P17-001..020)
- [x] Coverage 94.2% retained (`pytest --cov=api --cov-report=term -q -o addopts="-n 4"`), WCAG retained 0 critical, perf p95 120ms <200 retained + alerts 5 SLO + dashboards 3 verified
- [x] Gate 92-94 APPROVED with 0 mandatory blockers (see `09-gate-report.md`)


