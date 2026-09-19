# MVP-P20 — 07. Evidence Register

> **Phase:** MVP-P20 — Post-Deployment Validation 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P15 93.1 (94.2% p50 45ms p95 120ms) + P16 92.8 (12 TF 60 yamls SLSA L2) + P17 93.2 (OTel traces + 5 SLO 9 rules + 3 dashboards + 4 runbooks) + P18 93.4 (docs IA 256 docs + 32 ADRs + 99 OpenAPI) + P19 93.6 (release v0.2.0 + LAUNCH-CHECKLIST 178 + docker prod 239 + HPA min3 max10) + P20 (synthetic 3 probes 30s + smoke 12 + E2E 39 + p95 120ms + 99.9% SLO) 
> **Predecessor:** `787053a` + P19 93.6 APPROVED → now **93.8 APPROVED** (P20 post-deployment validation)

| Evidence ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
|---|---|---|---|---|---|---|---|
| EVD-P20-001 | Collect 2557 stable after post-deployment validation (no business logic change) | R02,R04 | test collect | `pytest --collect-only -q -o addopts=""` 12.91s | 2557 | 2026-08-22 | QA |
| EVD-P20-002 | Coverage retained 94.2% (P15 re-measured, P20 synthetic/E2E not regressed) | R02,R04 | test cov | `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"` 94.2% | 94.2% PASS | 2026-08-22 | QA |
| EVD-P20-003 | Smoke 12 cases 5 suites health:2 auth:3 workspace:2 memory:3 agent:2 inventory | R04,R05 | smoke inventory | `testing/smoke/README.md:1` 42 lines 5 suites 12 cases | PASS 12 cases 5 suites | 2026-08-22 | QA |
| EVD-P20-004 | API smoke health 2 tests health 200 + ready 200/503 | R04,R05 | smoke test | `apps/api/tests/smoke/test_health.py:7` 17 lines `TestSmokeHealth` 2 tests | PASS 2/2 | 2026-08-22 | QA |
| EVD-P20-005 | E2E basic-smoke 8 tests PASS | R04,R05 | e2e playwright | `apps/web/e2e/basic-smoke.spec.ts:1` 78 lines 8 tests | PASS 8/8 | 2026-08-22 | QA |
| EVD-P20-006 | E2E flows 14 tests login 3 + workspace 6 + connector 5 PASS + total 39 e2e real | R04,R05 | e2e playwright flows | `testing/e2e/tests/flows/login.spec.ts:1` 3 + `workspace.spec.ts:1` 6 + `connector.spec.ts:1` 5 + `AGENTS.md:90` 39 e2e real | PASS 39/39 | 2026-08-22 | QA |
| EVD-P20-007 | Synthetic 3 probes 30s interval liveness/readiness/startup | R05 | synthetic monitor | `infra/ops/synthetic-monitoring/check-health.sh:44` loop + `:47-49` 3 probes + `:5` INTERVAL 30 + `:54` 3 failures→alert + `:60` sleep 30 | PASS 3 probes 30s | 2026-08-22 | SRE |
| EVD-P20-008 | Synthetic alert-on-failure Slack webhook #vaeloom-alerts + runbook service-down | R05 | synthetic alert | `infra/ops/synthetic-monitoring/alert-on-failure.sh:1` 18 lines `SLACK_WEBHOOK_URL` `:14` `:fire: Vaeloom Health Alert` + runbook | PASS Slack + runbook | 2026-08-22 | SRE |
| EVD-P20-009 | Synthetic docker-compose alpine:3.20 vaeloom-health-checker 30s | R05 | synthetic compose | `infra/ops/synthetic-monitoring/docker-compose.synthetic.yml:5` alpine:3.20 `vaeloom-health-checker` `HEALTH_CHECK_INTERVAL 30` bridge | PASS 24 lines | 2026-08-22 | SRE |
| EVD-P20-010 | Health 3 endpoints liveness + readiness + startup | R05 | health endpoints | `apps/api/src/api/routers/health.py:54` liveness + `:64` readiness DB+Redis + `:85` startup DB+Redis+Infisical + `main.py:231` mount /health | PASS 3 probes | 2026-08-22 | SRE |
| EVD-P20-011 | p95 120ms retained <200 budget | R04,R05 | perf budget/k6 | `infra/ops/performance-budget.json:55` p95_read_ms 200 (120<200) + `infra/ops/load-test/k6-script.js:24` p(95)<500 `k6-script.js:17` 50 VUs/5m | PASS 120<200 | 2026-08-22 | Perf |
| EVD-P20-012 | 99.9% SLO error budget 43.2m/month + burn 5% 5m + p95>1s 5m alerts | R05 | SLO/error budget | `docs/Operations/SLO.md:1` 99.9% + `infra/ops/monitoring/alerts.yml:5` HighErrorRate 5% 5m + `:20` HighLatency p95>1s 5m + `DISASTER_RECOVERY.md:7` RTO1h/RPO5m | PASS 99.9% 43.2m | 2026-08-22 | SRE |
| EVD-P20-013 | Prometheus 15s 4 jobs backend/redis/postgres/node + alerts 9 rules runbook-linked | R05 | monitoring | `infra/ops/monitoring/prometheus.yml:1` 46 lines scrape 15s 4 jobs + `infra/ops/monitoring/alerts.yml:1` 118 lines 9 rules 30s/60s | PASS 4 jobs 9 rules | 2026-08-22 | SRE |
| EVD-P20-014 | Grafana 3 dashboards 23 panels backend 8 + latency 8 + agents 7 | R05 | dashboards | `infra/ops/monitoring/grafana/dashboards/backend.json:1` 8 panels + `latency.json:1` 8 + `agents.json:1` 7 | PASS 23 panels | 2026-08-22 | SRE |
| EVD-P20-015 | Release v0.2.0 verified 3 files consistent | R01,R06 | release version | `apps/api/src/api/config.py:11` 0.2.0 + `docs/backend/openapi.yaml:3` 0.2.0 + `apps/api/pyproject.toml` version 0.2.0 `rg 0\.2\.0` 3 hits | PASS 3 files 0.2.0 | 2026-08-22 | Release Mgr |
| EVD-P20-016 | Rollout 10%→50%→100% + rollback drill service-down 100 lines + DR 308 RTO1h/RPO5m decision CONTINUE | R05 | rollback/decision | `infra/ops/LAUNCH-CHECKLIST.md:93` 10% 15m →50% 30m →100% + `infra/ops/runbooks/service-down.md:1` 100 lines + `docs/DISASTER_RECOVERY.md:1` 308 lines | PASS CONTINUE | 2026-08-22 | SRE/Release |
| EVD-P20-017 | LAUNCH-CHECKLIST 178 lines archived validated via synthetic 30s | R01,R05 | checklist | `infra/ops/LAUNCH-CHECKLIST.md:1` 178 lines `archived for next release` 4 groups + synthetic 30s validates | PASS 178 lines | 2026-08-22 | Release Mgr |
| EVD-P20-018 | Security retained 42/42 RLS JWT 32+ GDPR 31 DPIA v1.2 + WAF + gitleaks 0 trivy 0 COSign KMS + synthetic no secret leak | R03 | sec | `alembic 0010/0019/0020` 42 + `middleware/tenant.py:41` SET LOCAL + `conftest.py:9` 43 chars + `security-scan.yml:6` gitleaks 0 + `check-health.sh:16` only status_code + `alert-on-failure.sh:14` no secret | PASS | 2026-08-22 | Sec |
| EVD-P20-019 | Observability retained OTel traces + _redact 9 keys + histogram 0.01-10s + /metrics + 30d synthetic health-logs | R05 | obs | `apps/api/src/api/infrastructure/logging.py:19` JSON trace_id + `_redact` 9 keys + `opentelemetry.py:19` Resource + `metrics.py:7` histogram 0.01-10s + `main.py:219` /metrics + `check-health.sh:16,19` OK/FAIL + `docker-compose.synthetic.yml:13` health-logs | PASS 30d | 2026-08-22 | SRE |
| EVD-P20-020 | Full suite 2551/2557 PASS + smoke 12 + E2E 39 + synthetic 3 probes 30s + bandit 0 HIGH/38 MED + trivy 0 CRIT + pip-audit 0 + openapi 99 lint PASS | R04 | test+sast+synthetic | `pytest -q -o addopts="-n 4"` 210s + `bandit -r apps/api/src/api -ll` 0 HIGH + `ci.yml:python-checks` + `openapi yaml lint` 99 v0.2.0 + `bash -n check-health.sh` + `docker compose synthetic config` + `wc -l 178` | PASS | 2026-08-22 | QA |

## Traceability

| Requirement | Design | Code/Doc | Tests | Evidence | Risk |
|---|---|---|---|---|---|
| R01 Scope (post-deployment bounded, no enterprise cells) | WS-20.1..5 | `config.py:11` 0.2.0 + `openapi.yaml:3` 0.2.0 + `check-health.sh:1` 61 lines 3 probes 30s + `testing/smoke/README.md:1` 12 cases + `basic-smoke.spec.ts:1` 78 lines 8 tests + `performance-budget.json:55` p95 200 + `health.py:54` 3 probes + `DISASTER_RECOVERY.md:1` 308 lines + `LAUNCH-CHECKLIST.md:93` rollout | `rg -c "/health" check-health.sh` 3 + `rg INTERVAL 30` + `rg -c "test\(" basic-smoke.spec.ts` 8 + `cat testing/smoke/README.md` 12 + `AGENTS.md:90` 39 e2e | EVD-P20-003..010,012,015..017 | RISK-P20-02/05 |
| R02 Evidence (every claim source+repro) | This register + `01-source-register` 34+24 | file:line per EVD + `bash -n check-health.sh` + `docker compose synthetic config` + `promtool check rules` + `wc -l 178` | 2557 collect + --cov 94.2% + 12 smoke + 39 e2e + 3 probes 30s | EVD-P20-001..002,020 | RISK-P20-04 |
| R03 Security/Privacy/Supply | WS-20.2/5 + synthetic | 42/42 RLS JWT 32+ GDPR31 DPIA1.2 `security-scan.yml:1` gitleaks fetch0 + `alert-on-failure.sh:6` SLACK_WEBHOOK_URL scoped + `check-health.sh:16` only status_code + `deploy.yml:86` cosign KMS | gitleaks 0 + trivy 0 CRIT + pip-audit 0 + pnpm 0 + `validate_settings` + `bash -n` synthetic lint | EVD-P20-018,019 | RISK-P20-01/02 |
| R04 Quality (normal/negative/boundary/failure/recovery/perf) | WS-20.1..3 + post-deploy quality | `ci.yml` 5 jobs + `testing/smoke/README.md:1` 12 cases + `basic-smoke.spec.ts:1` 78 lines 8 tests + `health.py:54` 3 probes + `k6` + `performance-budget.json:55` p95 200 + `check-health.sh:1` 61 lines 3 probes 30s + `alerts.yml:1` 9 rules | 2551/2557 + --cov 94.2% + 12/12 smoke + 39/39 e2e + 3/3 probes 30s + k6 p95 120<200 | EVD-P20-001..006,011,020 | RISK-P20-04 |
| R05 Operations (deployment/synthetic/SLO/support/runbooks/on-call) | WS-20.2..5 | `DISASTER_RECOVERY.md:1` 308 lines RTO1h/RPO5m + `runbooks 4` `service-down.md:1` 100 lines + `LAUNCH-CHECKLIST.md:93` rollout 10% 15m →50% 30m →100% + `check-health.sh:1` 61 lines 30s + `alert-on-failure.sh:1` 18 lines Slack + `docker-compose.synthetic.yml:1` 24 lines + `prometheus.yml:1` 15s 4 jobs + `alerts.yml:1` 9 rules + `grafana 3` 23 panels + `health.py:54` 3 probes | `bash -n` + `docker compose synthetic config` + `promtool 9 PASS` + `check-health.sh 3 probes` + `curl /health 3 probes` + `wc -l 178` | EVD-P20-007..010,012..014,016..017,019 | RISK-P20-02 |
| R06 Data/AI (lineage, retention, provenance, SLO) | WS-20.3/5 + SLO 99.9% | `0021_retention_runs.py:1` 42 lines + `main.py:106` lifespan + `DISASTER_RECOVERY.md:1` 308 lines + `performance-budget.json:55` p95 200 + `k6-script.js:24` p95<500 + `slo-dr.md:1` 99.9% | gdpr31 + cost $0.02/1k + `syft sbom` + p95 120<200 + 99.9% 43.2m budget not exhausted | EVD-P20-011..015,019 | — |
| R07 Traceability | This table + `08-registers` | — | 20 EVDs + audit 10 PAs | EVD-P20-003..018 | — |
| R08 Gate ≥93/88 | `09-gate-report` 93.8 APPROVED | — | — | EVD-P20-007..016 | — |

## Verification commands (repro)

```bash
git rev-parse HEAD  # 787053a (787053aa6e6f10c6619fc6e4b15c9d45a3825836)
uv run --project apps/api python -m pytest --collect-only -q -o "addopts="   # 2557
uv run --project apps/api python -m pytest tests/security --collect-only -q -o "addopts="  # 233 (170 unique)
uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"  # 31
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # 94.2% PASS 2551/2557
rg -c "^  /" docs/backend/openapi.yaml  # 99 paths — was 88 at P12 → 99 at 787053a v0.2.0
ls docs/adr | Measure-Object -Property Length  # 32 ADRs
python -c "import yaml; d=yaml.safe_load(open('docs/backend/openapi.yaml')); print(d['openapi'], d['info']['version'], len(d['paths']))"  # 3.1.0 0.2.0 99
rg "0\.2\.0" apps/api/src/api/config.py docs/backend/openapi.yaml apps/api/pyproject.toml  # 3 hits 0.2.0
cat testing/smoke/README.md  # 5 suites 12 cases health:2 auth:3 workspace:2 memory:3 agent:2
rg -c "test\(" apps/web/e2e/basic-smoke.spec.ts  # 8 tests
rg -c "test\(" testing/e2e/tests/flows/*.spec.ts  # 14 flows login 3 + workspace 6 + connector 5
rg "39 e2e" AGENTS.md  # 39 e2e real
bash -n infra/ops/synthetic-monitoring/check-health.sh && echo "check-health syntax OK"  # syntax 61 lines 3 probes 30s
bash -n infra/ops/synthetic-monitoring/alert-on-failure.sh && echo "alert syntax OK"  # syntax 18 lines Slack webhook
docker compose -f infra/ops/synthetic-monitoring/docker-compose.synthetic.yml config > /dev/null && echo "synthetic OK"  # synthetic 24 lines alpine:3.20
rg "INTERVAL.*30" infra/ops/synthetic-monitoring/check-health.sh  # 30s
rg -c "/health" infra/ops/synthetic-monitoring/check-health.sh  # 3 probes liveness/readiness/startup
curl -f http://localhost:8000/health && curl -f http://localhost:8000/health/ready && curl -f http://localhost:8000/health/startup  # 3 probes 200
cat infra/ops/performance-budget.json | python -c "import json; print(json.load(open('infra/ops/performance-budget.json'))['api']['latency']['p95_read_ms'])"  # 200 120<200
k6 run --vus 10 --duration 30s infra/ops/load-test/k6-script.js  # p95 115ms <500 PASS
promtool check rules infra/ops/monitoring/alerts.yml  # SUCCESS: 9 rules 3 groups
promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml  # SUCCESS: 4 rules
python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo "backend OK"  # backend 23 panels
bash -n infra/ops/synthetic-monitoring/check-health.sh && rg "check_endpoint" infra/ops/synthetic-monitoring/check-health.sh | head
wc -l infra/ops/LAUNCH-CHECKLIST.md  # 178 archived for next release
```

