# MVP-P17 — 08. Registers

> **Phase:** MVP-P17 — Observability and Operations 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P16 92.8 + P17 (OTel traces + correlation IDs + 5 SLO alerts + 3 Grafana dashboards + 4 runbooks retention 30d)

## Risk Register

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| RISK-P17-01 | Docs mistaken for runtime (observability not live) | Critical | False operational readiness, missing traces/alerts | Require `promtool check rules` 9+4 PASS + `json.tool` 3 dashboards + `check-health.sh` 3 probes + `python -c _redact` + `k6 p95 120<200` + `setup_logging` + `setup_opentelemetry` logs; staging must run `curl /health` 3 live | SRE/QA | OPEN (mitigated by 9+4 rules + 3 dashboards + 30d retention, but live cluster not yet probed) |
| RISK-P17-02 | Scope/permission/data assumed under observability | High | Leak/loss under load via log/trace PII, metric cardinality | `_redact` 9 keys before JSON dump `logging.py:7` + OTel span only http.method/path/status `opentelemetry.py:19` + metric labels low-cardinality `metrics.py:7` method/path/status + `tenant.py:41` fail-closed still under k6 20 RPS + `_redact` unit test | Sec/Arch/SRE | OPEN |
| RISK-P17-03 | External API/model/standard drift (OTel 1.27, prometheus 2.47, Grafana 10) | High | Regression, telemetry break, alert misfire | Pin in `01-source-register` 33+20, websearch verified 2026-08-22, `circuit_breaker.py:17` 3/30s isolates provider, `pip-audit` weekly `security-audit.yml:5` + `opentelemetry-config.ts:1` OTLP env var | Integration | OPEN |
| RISK-P17-04 | Evidence incomplete (promtool/json.tool not blocking live) | High | Untrustworthy gate | 20 EVDs repro via `05-test-results.md` + `terraform validate` + `compose config` + `promtool` + `json.tool` + `bash -n` + `k6` + `redact` + `gitleaks/trivy/pip-audit` 0 leaks/crit/high + `bandit` 0 HIGH | QA/Release | OPEN (mitigated but live /health 3 probes not yet run on staging) |
| RISK-P17-05 | Scope expansion (enterprise multi-region cells) | High | Delay cost blowout | `enterprise_routes_enabled=false` + PaaS autoscale max5 `main.tf:1` + protected tfvars + dashboards workspace Top10 not cross-user | Product | OPEN |
| RISK-P17-06 | Observability not prod-representative (sqlite mock vs RDS + live OTLP) | Medium | Stale headroom 60% at 20RPS not proven on live, OTLP localhost:4318 absent | MockVector SQLite + `httpx.AsyncClient(app)` fallback bench p95 120ms <200 representative; live staging must run `check-health.sh` 3 probes + `prometheus.yml:15` scrape OTLP + grafana 30s | SRE | OPEN |
| RISK-P17-07 | Secrets in telemetry (logs/traces/metrics) | High | Credential replay, PII leak | `_redact` 9 keys `logging.py:7` + OTel allowlist `opentelemetry.py:19` http.* only + metric labels `method/path/status` only + gitleaks fetch0 `security-scan.yml:6` | Sec | OPEN (mitigated but needs audit extra_data paths) |

## Decision Register

| ID | Decision | Rationale | Alternatives | Owner | Date |
|---|---|---|---|---|---|
| DEC-P17-01 | StructuredJsonFormatter JSON `level/time/service/environment/version/message/trace_id/tenant_id/user_id/logger/data/error` + PrettyFormatter `logging.py:19` + ContextVar 3 correlation/tenant/user `logging.py:7` | Per-request correlation trace_id without secrets, tenant-isolated for support | Plain text logs (rejected — no trace_id) | SRE | 2026-08-22 |
| DEC-P17-02 | OTel Resource vaeloom-api BatchSpanProcessor OTLP gRPC `opentelemetry.py:19` + `main.py:109,225` + NodeSDK `opentelemetry-config.ts:1` | Distributed traces without secrets, 60s export, SIGTERM shutdown; Python + Node parity | No OTel (rejected — no distributed trace) | SRE | 2026-08-22 |
| DEC-P17-03 | Metrics Counter http_requests_total method/path/status + Histogram buckets 0.01-10s + Gauge active_users `metrics.py:7` | Histogram captures p50/p95/p99 for SLO p95<500 burn, low-cardinality prevents PII | High-cardinality labels user_id (rejected — PII) | SRE | 2026-08-22 |
| DEC-P17-04 | Prometheus 15s 4 jobs backend/redis/postgres/node `prometheus.yml:1` + second cluster `metrics/prometheus.yml:1` + Alerts 9 rules `alerts.yml:1` 5 SLO +4 infra runbook-linked + vaeloom-alerts 4 | 15s scrape for burn 2x/5x, 5 SLO alerts cover HighErrorRate/HighLatency/ServiceDown/DBPool/AgentFailure | 60s scrape (rejected — burn slow) | SRE | 2026-08-22 |
| DEC-P17-05 | Grafana 3 dashboards backend 8 + latency 8 + agents 7 =23 panels refresh 30s `backend.json:1` `latency.json:1` `agents.json:1` | SLI visibility p50/p95/p99 + workspace + agent token/cost, slow endpoint table | Single dashboard (rejected — overwhelms) | SRE | 2026-08-22 |
| DEC-P17-06 | Retention 30d via `structured-logging.md:1` + `docker-compose.prod.yml` `x-logging json-file max-size 10m max-file 3` + prometheus 15s | 30d forensic history for postmortem, rotation prevents disk exhaustion at $12/mo PaaS | Infinite retention (rejected — disk DoS) | SRE | 2026-08-22 |
| DEC-P17-07 | 4 runbooks high-latency/high-error-rate/service-down/db-pool-exhaustion `runbooks/*.md` + `INCIDENT-RESPONSE.md:1` SEV1 15m SEV2 30m 7-day rotation | Actionable on-call linked from alerts `runbook:` annotation | Undocumented runbook (rejected) | SRE/Operations | 2026-08-22 |
| DEC-P17-08 | Synthetic monitoring `check-health.sh:1` 3 probes `curl --max-time 5` 200/204 interval 30s LOG + 3 failures → `alert-on-failure.sh` + `background_daemon.py:13` 60s poll | Proactive liveness beyond prometheus, 30s interval 2,880 entries/day 30d retained | Only prometheus up check (rejected) | SRE | 2026-08-22 |

## Assumption Register

| ID | Assumption | Risk if Wrong | Validation Plan | Status |
|---|---|---|---|---|
| ASM-P17-01 | 2557 collected stable after observability (no business logic change) | Flaky xdist | Re-collect each gate + `sorted(PUBLIC_PATHS)` `test_noauth_private.py:90` | ACTIVE |
| ASM-P17-02 | `promtool check rules` 9+4 PASS + `json.tool` 3 OK proves alerts/dashboards correct without live prometheus dry-run | PromQL typo only at runtime, dashboard malformed on import | Staging `promtool check rules` + `curl /metrics` labels `http_requests_total` `http_request_duration_seconds_bucket` | ACTIVE |
| ASM-P17-03 | `_redact` 9 keys before `StructuredJsonFormatter:40` sufficient for PII minimization | Nested secret under custom object not redacted | Unit test `redact_nested_object` + audit `extra_data` call sites `executor.py:1100` | ACTIVE |
| ASM-P17-04 | Metric labels `method/path/status` sufficient for SLO burn 5% 5m + `histogram_quantile` p95 120ms <200 proves SLO without live 30d burn 0.04% re-measure | Burn drift on live PG vs SQLite 20% delta | P18 staging 20 RPS live `k6-script.js` 50VUs 5m + 30d burn 2x/5x | ACTIVE |
| ASM-P17-05 | `check-health.sh` 3 probes `liveness/readiness/startup` every 30s representative of uptime SLO 99.9% without PagerDuty wiring | Synthetic log not wired to PagerDuty, manual `alert-on-failure.sh` not tested | Staging `check-health.sh http://staging:8000 30` + mocked PagerDuty 3 failures → page | ACTIVE |
| ASM-P17-06 | `background_daemon` 60s `AgentSchedule` + daily 06:00 Gmail + 08:00 Calendar + 02:00 Job Finder via `_is_cron_due` minute precision + `croniter` fallback sufficient for queue lag <100 | Cron due drift 60s off, `croniter` missing fallback misses `*/5` | Unit `test_background_daemon.py` + `test_cron_due` + staging logs `Background daemon started` `main.py:140` | ACTIVE |
| ASM-P17-07 | `StructuredJsonFormatter` trace_id from `correlation_id_var` + OTel span http.* only + 30d rotation gives forensic boundary without tenant content leak | OTel missing tenant_id for support correlation | Audit `tenant_id` in `StructuredJsonFormatter` vs `TenantMiddleware app.workspace_id` + `X-Tenant-ID` delta review P18 | ACTIVE |
| ASM-P17-08 | `fastapi 0.141.1` pin starlette `<0.51` Keep 0.50 still not exploited via `pip-audit` weekly + `trivy` not HIGH + `_redact` mitigates token replay | Starlette Keep DoS still possible despite 100rpm | Upgrade `fastapi>=0.142` when stable + `pip-audit` clean + `rate_limit 100rpm` | ACTIVE |

## Exception Register

| ID | Exception | Owner | Controls | Approvers | Expiry | Monitoring | Prohibited |
|---|---|---|---|---|---|---|---|
| EXC-P17-01 | Coverage per-file `webhook_service.py` 68% `middleware/tenant.py` 72% `migration 0005` 52% below 94.2% avg — total retained 94.2% | QA | Total 94.2% via `--cov` + `bandit 0 HIGH/38 MED` + `ruff` + `trivy` 0 CRIT + per-file report `05-test-results.md` + `_redact` unit + promtool 13 PASS | QA | P18 | `pytest --cov` per-file | Claim 100% per-file |
| EXC-P17-02 | Starlette 0.50.0 `<0.51` per `fastapi 0.141.1` not `≥1.3.1` (P13 carry Keep 0.50) | AppSec | `fastapi 0.141.1` pins `starlette<0.51` + CSP+rate-limit + `pip-audit` weekly `security-audit.yml:5` + `trivy` not yet HIGH | AppSec | When `fastapi≥0.142` | `pip-audit` + `trivy` SARIF | Claim starlette fixed |
| EXC-P17-03 | `testing/chaos/, fuzz/, visual-regression/` still EMPTY but `smoke` 5/12 + `k6 p95 120ms` + `security-scan` trivy + `k8s 22` + `check-health.sh` + `alerts.yml` 9 rules + `grafana 3` = partially closed | QA/SRE | Partially closed `smoke` 5 suites/12 cases + `k6` + `trivy` + `k8s` + `check-health.sh` + `promtool` 13 PASS | QA/SRE | P18 (inventory chaos 10 faults) | Inventory + k6 + trivy | Claim full QA without smoke/fuzz/chaos full |
| EXC-P17-04 | SLSA L2 note only + WCAG `playwright-axe` not yet all routes (only `jest-axe` 0 critical) | Sec/A11y | L2 via `deploy.yml:86` cosign 2.2.4 KMS + SBOM spdx; `jest-axe` 0 critical + `axe-config.ts` 0/5/10/20 + 5 pages manual — L3 + full playwright deferred P18 | Sec/A11y | P18 | `cosign verify` + `pnpm test a11y` | Claim SLSA L3 or WCAG all routes |

## Change Register

| ID | Change | Rationale | Impact | Reviewers | Migration | Tests | Rollback |
|---|---|---|---|---|---|---|---|
| CHG-P17-01 | Harden `infrastructure/logging.py:19` JSON trace_id/tenant_id/user_id + PrettyFormatter + CorrelationIDMiddleware + RequestLoggingMiddleware | P16 had /metrics + OTel but not per-request correlation logs; P17 adds trace_id per request | JSON logs per request with trace_id | SRE/QA | N/A | `python -c _redact` + promtool | Revert middleware |
| CHG-P17-02 | Verify `opentelemetry.py:19` Resource vaeloom-api OTLP gRPC + FastAPIInstrumentor + `opentelemetry-config.ts:1` NodeSDK | OTel required §20 but not evidenced beyond `main.py:168`; P17 evidences Resource + BatchSpanProcessor | Traces without secrets, 60s export | SRE | N/A | `setup_opentelemetry()` log | Disable OTel |
| CHG-P17-03 | Verify `metrics.py:7` Counter/Histogram 0.01-10s + Gauge + MetricsMiddleware | Histogram needed for p50/p95/p99 SLO p95<500 burn; P17 evidences bucket boundaries | Metrics for burn 2x/5x | SRE | N/A | `/metrics` bucket present | Remove MetricsMiddleware |
| CHG-P17-04 | Verify `prometheus.yml:1` 15s 4 jobs + `alerts.yml:1` 9 rules + `metrics/prometheus.yml:1` + `vaeloom-alerts.yml:1` + `grafana dashboards 3` 23 panels | SLOs required 5 alerts + 3 dashboards not yet evidenced via `promtool` + `json.tool`; P17 gates them | 13 rules PASS, 23 panels lint OK | SRE | N/A | `promtool check rules` 9+4 + `json.tool` 3 OK | Revert prometheus.yml |
| CHG-P17-05 | Verify `check-health.sh:1` 3 probes + `runbooks 4` + `INCIDENT-RESPONSE.md:1` SEV1-4 + `background_daemon.py:13` 60s poll | Runbooks/on-call required §20 but only `INCIDENT-RESPONSE.md` existed; P17 links alerts `runbook:` → 4 runbooks + synthetic 30s | 4 runbooks runbook-linked 5 SLO alerts | SRE/Operations | N/A | `bash -n check-health.sh` + `curl /health` | Remove check-health.sh |
| CHG-P17-06 | Verify `structured-logging.md:1` Standard Fields + retention 30d via `x-logging json-file 10m*3` | Retention 30d required §20 but not documented; P17 documents trace_id/span_id + 30d rotation | Forensic 30d boundary audited | SRE | N/A | `structured-logging.md` 28 lines | Reduce retention |
| CHG-P17-07 | Retain `security-audit.yml:1` weekly Mon6 + pnpm/pip audit + gitleaks + `performance-budget.json:52` p95_read 200 (120<200) | Cost/security ops required; P17 evidences `agents.json` token usage + `k6` p95 120<200 retains | 0 high retained, SLO budget enforced | Sec/FinOps | N/A | `pip-audit` 0 high + `k6` p95 120<200 | Disable schedule |
| CHG-P17-08 | Retain `terraform/main.tf:1` 12 modules + `main.py:106` lifespan `create_all` + `background_daemon` 60s + K8s 22 SLSA L2 | P16 IaC retained; P17 adds observability on top without breaking IaC parity | IaC + observability co-verified | SRE/Platform | N/A | `terraform validate` 12 + `compose config` + `k6` + `promtool` | `terraform destroy` staging not needed |

## Future-Readiness Backlog

| Idea | Evidence | Target Users | Dependencies | Security/Privacy | Cost | Validation Experiment | Adoption Trigger | Owner | Sunset |
|---|---|---|---|---|---|---|---|---|---|
| OTel traces live export to Tempo/Jaeger + sampling 10% | `BatchSpanProcessor` localhost:4318 `opentelemetry.py:19` not yet live | SRE | OTLP endpoint Tempo Helm + sampler | No secret in span allowlist only | Medium | `OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318 k6 20RPS` + trace_id vs Jaeger UI | p95>300ms 5m + error>1% | SRE | When live |
| Prometheus storage 30d `storage.tsdb.retention.time=30d` | 15s scrape `prometheus.yml:4` but retention not explicit | SRE | `prometheus.yml:1` storage args + PVC 20Gi | No PII in metrics labels | Low | `prometheus --storage.tsdb.retention.time=30d` + `promtool` + 30d range query | Before 50RPS | SRE | 30d proven |
| Loki 30d log aggregation via Grafana Loki | `json-file 10m*3` rotation but no centralized Loki | Support | Loki Helm `docker-compose.monitoring.yml` | `_redact` 9 keys before Loki shipper | Medium | `docker-compose.monitoring.yml` loki + promtail `trace_id` label filter | Support >20/mo | Support | When Loki live |
| SLSA L3 hermetic `slsa-github-generator` + buildx provenance max | L2 note only `deploy.yml:86` cosign KMS EXC-P17-04 | All | `slsa-framework/slsa-github-generator` | Sigstore fulcio | Low | `slsa-github-generator ./api` + `cosign verify-attestation` | Cost <$0.01/1k | Sec | P18 |
| Chaos 10-fault inventory + EKS node drain | 5 faults `chaos-config.yaml:1` EXC-P17-03 partial + new `check-health.sh` mitigates but not faults | SRE | `testing/chaos/README.md` + `chaos-mesh` | No PII | Low | `chaos-config.yaml` 5→10 + `kubectl drain` + `check-health.sh` 3 failures still alert | Pre-ship | SRE | Ship |
| `playwright-axe` all routes live Web | 5 pages spot-check only | All | `axe-core/puppeteer` live Web `a11y-audit.yml` | A11y | Low | `audit-pages.ts` 5→all routes `pnpm test visual` | Pre-ship | A11y | Ship |
| Per-file lift `webhook_service.py` 68→80% | EXC-P17-01 per-file gaps | QA | `apps/api/tests/test_webhook_perf.py` | No PII | Low | `pytest --cov` per-file 68→80 | P18 | QA | P18 |
| Starlette 1.3.1 when fastapi≥0.142 | Keep 0.50 EXC-P17-02 | All | fastapi 0.142 | CSP/rate-limit `_redact` remains | Low | `pip-audit` clean | Compat | AppSec | When compat |

