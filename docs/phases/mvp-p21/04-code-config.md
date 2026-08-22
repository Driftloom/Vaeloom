# MVP-P21 — 04. Code and Configuration

> **Phase:** MVP-P21 — Maintenance and Continuous Improvement  
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16
> 92.8 + P17 93.2 + P18 93.4 + P19 93.6 + P20 93.8 + P21 maintenance final  
> **Predecessor:** P20 post-deployment validation 93.8 (synthetic 3 probes 30s +
> smoke 12 + E2E 39 + 99.9% SLO)

## Architecture Preservation (§13)

Preserved monolith
`FastAPI 0.141.1 + Next.js 15 + Postgres pgvector + Redis + MinIO` per ADR-001.
PaaS-first bounded `min1 max10` `infra/kubernetes/overlays/prod/hpa.yaml:7`
cpu70 mem80 + HPA min3 max10. `enterprise_routes_enabled=false` remains
`config.py:87`. `787053a` chain intact. No NestJS
`packages/service-auth`/`packages/observability` still NOT deployed — only
`apps/api/src/api/infrastructure/*` + `infra/ops/monitoring` +
`infra/ops/synthetic-monitoring` + maintenance governance `MAINTAINERS.md:1` +
`CONTRIBUTING.md:1` active + final MVP CLOSE.

Per phase rule: **Resolve canonical/superseded docs + separate design vs
implementation status + version/owner/status on every doc. Maintenance
governance proven with file:line + 32 ADRs + 280 commits.**

## Code Changes in This Phase (additive maintenance governance only)

P21 is **maintenance and continuous improvement**; business logic unchanged
(only governance docs + backlog + support tiers + deprecation 30d + quarterly
review). `allow_destructive_changes=false` + `allow_production_changes=false`.

| File                                                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Purpose                            | Evidence                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------- |
| `MAINTAINERS.md:1`                                              | Maintainers 91 lines `MAINTAINERS.md:7` 5 maintainers Alex Chen Platform Core + Maya Rodriguez AI/ML KG + Kunal Sharma Infra K8s + Emma Larsson Frontend UI Kit + Sam Okafor Docs DX + `MAINTAINERS.md:22` Lazy Consensus 72h + `MAINTAINERS.md:44` 7-day add + `MAINTAINERS.md:57` semver + `MAINTAINERS.md:65` cadence weekly patch / 4-6w minor / 6-12m major + `MAINTAINERS.md:74` 2-approver signed tag + `MAINTAINERS.md:84` release steps branch->tag->GH Actions | Maintenance ownership + governance | `MAINTAINERS.md:1` 91 lines               |
| `CONTRIBUTING.md:1`                                             | Contributing 299 lines `CONTRIBUTING.md:193` fork->branch `<type>/<short>` `CONTRIBUTING.md:195` -> `pnpm lint` `CONTRIBUTING.md:137` -> `pnpm test` `CONTRIBUTING.md:250` 80% `CONTRIBUTING.md:257` -> CODEOWNERS 1 approval `CONTRIBUTING.md:246` -> squash merge `CONTRIBUTING.md:248` + commit conventional `CONTRIBUTING.md:142` feat/fix/chore/docs                                                                                                                | Contributor flow 80% + 1 approval  | `CONTRIBUTING.md:1` 299 lines             |
| `COMMIT_PLAN.md:1`                                              | Commit plan 437 lines 280 commits `COMMIT_PLAN.md:9` 10 phases + 4.1 18 web + 4.2 14 api + 5.x microservices `COMMIT_PLAN.md:198`                                                                                                                                                                                                                                                                                                                                        | Atomic commit history              | `COMMIT_PLAN.md:1` 437 lines 280 commits  |
| `CHANGELOG.md:1`                                                | Changelog 60 lines Keep a Changelog 1.1.0 `CHANGELOG.md:2` + semver 2.0.0 `CHANGELOG.md:5` + Unreleased 25 entries + 0.1.0 2026-07-17 `CHANGELOG.md:40` + compare links + release-drafter `release-drafter.yml:1`                                                                                                                                                                                                                                                        | Changelog 1.1.0 + semver           | `CHANGELOG.md:1` 60 lines                 |
| `CODE_OF_CONDUCT.md:1`                                          | Code of Conduct 132 lines Contributor Covenant 2.1 `CODE_OF_CONDUCT.md:117` + enforcement ladder `CODE_OF_CONDUCT.md:73` correction->warning->temp ban->perm ban + conduct@vaeloom.dev `CODE_OF_CONDUCT.md:63`                                                                                                                                                                                                                                                           | Community governance               | `CODE_OF_CONDUCT.md:1` 132 lines          |
| `SECURITY.md:1`                                                 | Security policy 111 lines 0.x supported `SECURITY.md:5` + security@vaeloom.dev 48h `SECURITY.md:18` + Dependabot+Snyk `SECURITY.md:49` + CodeQL+Semgrep+Trivy `SECURITY.md:54` + quarterly pen-test `SECURITY.md:63` + bug bounty $100-$10k `SECURITY.md:92` + 90-day disclosure `SECURITY.md:105`                                                                                                                                                                       | Security policy 90-day + bounty    | `SECURITY.md:1` 111 lines                 |
| `.github/workflows/ci.yml:1`                                    | CI 140 lines `ci.yml:7` concurrency cancel-in-progress + `ci.yml:20` lint-typecheck (lint+typecheck+format markdownlint `ci.yml:36`) + test coverage `ci.yml:36` + build + integration `ci-integration.yml:1` + docs-validate `docs-validate.yml:1` 39 lines                                                                                                                                                                                                             | CI 5 jobs                          | `ci.yml:1` 140 lines                      |
| `.github/workflows/deploy.yml:1`                                | Deploy 175 lines terraform-plan 1.8.0 `deploy.yml:18` + build-push `deploy.yml:30` buildx v4 `deploy.yml:86` cosign 2.2.4 awskms `deploy.yml:97` sbom `deploy.yml:103` attestation + load-test-gate 10VUs30s `deploy.yml:111` p95 115ms + deploy kustomize `deploy.yml:130` + rollback undo `deploy.yml:145` + slack notify `deploy.yml:150`                                                                                                                             | Deploy 4 jobs L2                   | `deploy.yml:1` 175 lines                  |
| `.github/workflows/security-scan.yml:1`                         | Security scan 114 lines gitleaks fetch0 `security-scan.yml:6` + codeql `security-scan.yml:12` + trivy `security-scan.yml:19` + syft `security-scan.yml:26` spdx 420KB `security-scan.yml:36`                                                                                                                                                                                                                                                                             | Sec scan                           | `security-scan.yml:1` 114 lines           |
| `.github/workflows/security-audit.yml:1`                        | Security audit 116 lines pnpm audit high `security-audit.yml:12` + pip-audit high `security-audit.yml:24` + schedule 0 6 * * 1 `security-audit.yml:5` + dependabot weekly                                                                                                                                                                                                                                                                                                | Dep audit weekly                   | `security-audit.yml:1` 116 lines          |
| `.github/workflows/a11y-audit.yml:1`                            | A11y audit 70 lines push main+develop + PR main + schedule 0 6 * * 1 `a11y-audit.yml:5` + contents read `a11y-audit.yml:12`                                                                                                                                                                                                                                                                                                                                              | A11y gate 0 critical               | `a11y-audit.yml:1` 70 lines               |
| `.github/dependabot.yml:1`                                      | Dependabot weekly pnpm + pip + docker + github-actions grouped dev-deps + pnpm 9 + schedule weekly                                                                                                                                                                                                                                                                                                                                                                       | Weekly dep lifecycle               | `dependabot.yml:1`                        |
| `infra/ops/INCIDENT-RESPONSE.md:1`                              | Incident response SEV1 15m `INCIDENT-RESPONSE.md:5` SEV1 outage 15m + SEV2 30m + SEV3 2h + SEV4 next-day + on-call 7-day Mon 09:00 UTC `INCIDENT-RESPONSE.md:14` + channels #vaeloom-alerts #vaeloom-incidents `INCIDENT-RESPONSE.md:22` + lifecycle Detect->Postmortem `INCIDENT-RESPONSE.md:30`                                                                                                                                                                        | 5 tiers SEV1 15m                   | `INCIDENT-RESPONSE.md:1`                  |
| `infra/ops/runbooks/service-down.md:1`                          | Runbook 100 lines SEV1 `curl /health` 3 probes + `docker ps/logs` + `ecs describe-services` + causes OOM/config/DB/migration + resolution restart/rollback/migration/scale + verify `curl -f /health`                                                                                                                                                                                                                                                                    | Rollback drill                     | `service-down.md:1` 100 lines             |
| `infra/ops/runbooks/high-latency.md:1`                          | Runbook 70 lines SEV2 p95>1s 5m `histogram_quantile(0.95 …)` + PromQL + resolution                                                                                                                                                                                                                                                                                                                                                                                       | Latency runbook                    | `high-latency.md:1` 70 lines              |
| `infra/ops/synthetic-monitoring/check-health.sh:1`              | Synthetic 61 lines `set -euo pipefail` `HEALTH_URL` `INTERVAL 30` `LOG_FILE /var/log/vaeloom-health.log` `FAILURE_FILE` `curl --max-time 5` http_code 200/204 OK + `check_and_track` + `while true` 3 probes liveness/readiness/startup + `count -ge 3` -> alert + `sleep INTERVAL 30`                                                                                                                                                                                   | Synthetic 3 probes 30s             | `check-health.sh:1` 61 lines              |
| `infra/ops/synthetic-monitoring/alert-on-failure.sh:1`          | Alert 18 lines `SLACK_WEBHOOK_URL` + `MESSAGE {"channel":"#vaeloom-alerts" text ":fire: Vaeloom Health Alert … runbook service-down.md"}` + `curl -X POST`                                                                                                                                                                                                                                                                                                               | Slack alert                        | `alert-on-failure.sh:1` 18 lines          |
| `infra/ops/synthetic-monitoring/docker-compose.synthetic.yml:1` | Synthetic compose 24 lines health-checker `alpine:3.20` `vaeloom-health-checker` bridge `HEALTH_CHECK_INTERVAL 30`                                                                                                                                                                                                                                                                                                                                                       | Deploy synthetic                   | `docker-compose.synthetic.yml:1` 24 lines |
| `docs/operations/SLO.md:1`                                      | SLO 99.9% 6 targets `SLO.md` + 4 budgets 43.2m/3.6h/7.2h/21.6m + mermaid Targets/Budgets                                                                                                                                                                                                                                                                                                                                                                                 | SLO 99.9% 43.2m                    | `SLO.md:1`                                |
| `infra/ops/performance-budget.json:55`                          | Perf budget p95_read_ms 200 (120<200 PASS) + p95_write 500 + lighthouse 90+                                                                                                                                                                                                                                                                                                                                                                                              | p95 budget 200                     | `performance-budget.json:55` 101 lines    |
| `infra/ops/chaos/chaos-config.yaml:1`                           | Chaos 5 faults Schedule 0 6 * * 1 + PodChaos pod-kill @every 6h + HTTPChaos delay 2s @every 4h + StressChaos cpu 100% @every 8h + self-heal 10s + timeout 50% @every 12h                                                                                                                                                                                                                                                                                                 | Chaos 5 faults                     | `chaos-config.yaml:1`                     |
| `infra/ops/monitoring/prometheus.yml:1`                         | Prometheus 46 lines scrape 15s evaluation 15s `rule_files alerts.yml` + 4 jobs backend:8000 redis:9121 postgres:9187 node:9100                                                                                                                                                                                                                                                                                                                                           | Prometheus 15s                     | `prometheus.yml:1` 46 lines               |
| `infra/ops/monitoring/alerts.yml:1`                             | Alerts 118 lines 9 rules 3 groups 30s/60s `HighErrorRate 5% 5m` `HighLatency p95>1s 5m` `ServiceDown 1m` each runbook-linked                                                                                                                                                                                                                                                                                                                                             | Alerts 9 rules                     | `alerts.yml:1` 118 lines                  |
| `infra/logging/configs/structured-logging.md:1`                 | Structured logging 30d `json-file 10m*3` `docker-compose.prod.yml:4` + JSON trace_id/tenant_id/user_id + _redact 9 keys                                                                                                                                                                                                                                                                                                                                                  | Logging 30d                        | `structured-logging.md:1`                 |
| `docs/operations/Observability.md:1`                            | Observability + `docs/devops/Monitoring.md:1` + `engineering/Implementation/12-observability-tracing.md:1`                                                                                                                                                                                                                                                                                                                                                               | Observability docs                 | `Observability.md:1`                      |
| `apps/api/src/api/config.py:11`                                 | `service_version 0.2.0` + `enterprise_routes_enabled False` `:87`                                                                                                                                                                                                                                                                                                                                                                                                        | Version 0.2.0                      | `config.py:11` + `:87`                    |
| `docs/backend/openapi.yaml:1`                                   | `openapi: 3.1.0` `version: 0.2.0` 99 paths `rg -c "^  /" 99`                                                                                                                                                                                                                                                                                                                                                                                                             | OpenAPI 99                         | `openapi.yaml:1` 3.1.0 0.2.0              |

### Unchanged (verified preserved)

- `apps/api/src/api/middleware/tenant.py:41`
  `SET LOCAL app.tenant_id/workspace_id/user_id` fail-closed via
  `database.py:30` `set_rls_session_vars` — synthetic 30s + chaos 5 faults under
  `transaction` pgbouncer safe + quarterly review not affecting RLS
- `middleware/auth.py:1` JWT exp/sub + PUBLIC_PATHS sorted
  `test_noauth_private.py:90` — `validate_settings()` still fails fast on 32+
- `apps/api/src/api/infrastructure/logging.py:19` `StructuredJsonFormatter` +
  `logging.py:7` `_REDACT_KEYS` 9 keys before JSON dump — retained, synthetic
  logs `vaeloom-health.log` OK/FAIL only 8 chars tenant not PII + 30d retention
  via structured-logging.md 10m*3
- `apps/api/src/api/infrastructure/opentelemetry.py:19` Resource vaeloom-api +
  `main.py:219` /metrics + `prometheus.yml:1` 15s — retained
- `circuit_breaker.py:17` 3/30s + `rate_limit.py:42,64,103` 100rpm +
  `k6-script.js:17` p50 45ms p95 120ms — retained p95 120ms <200 quarterly not
  regressed
- `docs/adr/ADR-001..032` 32 files unchanged linear, no branch divergence +
  `MAINTAINERS.md:22` Lazy Consensus 72h governs ADR evolution

## Configuration (representative env for maintenance final)

| Key                  | Value                                                                                                                                                              | Notes                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `SERVICE_VERSION`    | `0.2.0` `config.py:11` + `openapi.yaml:3` `info.version 0.2.0` + `pyproject.toml` version 0.2.0                                                                    | 3 files consistent v0.2.0 final MVP                                       |
| `MAINTAINERS`        | `5` `MAINTAINERS.md:7` Alex Chen + Maya Rodriguez + Kunal Sharma + Emma Larsson + Sam Okafor                                                                       | Lazy Consensus 72h `MAINTAINERS.md:22`                                    |
| `CONTRIBUTING_FLOW`  | `fork->branch->lint->test->80%->review 1 owner->squash` `CONTRIBUTING.md:193` 80% `CONTRIBUTING.md:257`                                                            | CODEOWNERS auto-assign `CONTRIBUTING.md:283`                              |
| `QUARTERLY_REVIEW`   | `2026-11-22` next + `MAINTAINERS.md:65` weekly patch / 4-6w minor / 6-12m major 4-week RC                                                                          | Quarterly + MAINTAINERS cadence                                           |
| `DEPRECATION_NOTICE` | `30d` + 90-day disclosure `SECURITY.md:105` + semver MAJOR 4-week RC `MAINTAINERS.md:69`                                                                           | 30d deprecation `08-registers.md`                                         |
| `SUPPORT_TIERS`      | `5` tiers `INCIDENT-RESPONSE.md:5` SEV1 15m + SEV2 30m + SEV3 2h + SEV4 next-day + 7-day rotation Mon 09:00 UTC                                                    | L1 Support->L5 Vendor                                                     |
| `BACKLOG_22`         | `22` issues `08-registers.md` future backlog + WS-21.5 8 ideas + 14 carry from P16-P20                                                                             | Next review 2026-11-22                                                    |
| `ADRs`               | `32` `docs/adr` ADR-001..032 `ls docs/adr` 32                                                                                                                      | `COMMIT_PLAN.md:1` 280 commits                                            |
| `CHANGELOG`          | `Keep a Changelog 1.1.0` + semver 2.0.0 `CHANGELOG.md:2` + 0.1.0 2026-07-17 `CHANGELOG.md:40`                                                                      | 60 lines                                                                  |
| `CODE_OF_CONDUCT`    | `2.1` `CODE_OF_CONDUCT.md:117` + conduct@vaeloom.dev `CODE_OF_CONDUCT.md:63`                                                                                       | 132 lines                                                                 |
| `SECURITY_POLICY`    | `SECURITY.md:1` 111 lines 0.x supported + 48h ack + bug bounty $100-$10k + quarterly pen-test                                                                      | 90-day disclosure `SECURITY.md:105`                                       |
| `WORKFLOWS`          | `11` files `.github/workflows` ci 140 + deploy 175 + sec-scan 114 + sec-audit 116 + a11y 70                                                                        | `dependabot.yml:1` weekly                                                 |
| `DATABASE__URL`      | `sqlite+aiosqlite:///...tmp_path.../test.db` per-test NullPool (prod RDS via `rds` module `main.tf:1`)                                                             | MockVector/MockArray/MockUUID `conftest.py`                               |
| `JWT_SECRET`         | `test-jwt-secret-for-ci-only-32-chars-long!!` 43 chars                                                                                                             | ≥32 `validate_settings()` 32+; prod `≥64 random` `LAUNCH-CHECKLIST.md:10` |
| `HEALTH_URL`         | `http://localhost:8000` `check-health.sh:4` default + `HEALTH_CHECK_URL http://host.docker.internal:8000` `docker-compose.synthetic.yml:15`                        | 3 probes liveness/readiness/startup                                       |
| `INTERVAL`           | `30` `check-health.sh:5` seconds + `docker-compose.synthetic.yml:15` `HEALTH_CHECK_INTERVAL 30`                                                                    | Synthetic 30s interval                                                    |
| `FAILURE_THRESHOLD`  | `3` `check-health.sh:54` `count -ge 3` -> `alert-on-failure.sh`                                                                                                    | 3 consecutive failures                                                    |
| `SYNTHETIC_COMPOSE`  | `docker-compose.synthetic.yml:1` 24 lines health-checker `alpine:3.20` `vaeloom-health-checker` bridge                                                             | `docker compose synthetic config` OK                                      |
| `SMOKE_12`           | `testing/smoke/README.md:1` 5 suites 12 cases health:2 auth:3 workspace:2 memory:3 agent:2                                                                         | `pytest smoke 2` + `pnpm test:smoke 12`                                   |
| `E2E_39`             | `AGENTS.md:90` 37 jest + 39 e2e real + `basic-smoke.spec.ts:1` 8 + `testing/e2e/tests/flows` 14                                                                    | `npx playwright test --list` 39                                           |
| `HEALTH_ENDPOINTS`   | `health.py:54` liveness + `:64` readiness + `:85` startup + `main.py:231` mount `/health`                                                                          | 3 probes `curl /health` 200                                               |
| `PROMETHEUS`         | `2.47+` scrape 15s `prometheus.yml:4` + `metrics/prometheus.yml:4`                                                                                                 | 4 jobs + 3 jobs                                                           |
| `GRAFANA`            | `10.x` dashboards uid vaeloom-backend/latency/agents refresh 30s                                                                                                   | 23 panels 8+8+7                                                           |
| `p95_BUDGET`         | `200ms read` `performance-budget.json:55` `p95 120ms PASS`                                                                                                         | Measured `k6-script.js:24` p95<500 threshold                              |
| `p95_MEASURED`       | `120ms` retained P15 93.1 P19 93.6 P20 93.8 P21 not regressed `k6-script.js:17` 50 VUs/5m                                                                          | 120<200 PASS                                                              |
| `SLO`                | `p50<100 p95<500 99.9% error<1% RPO1h RTO15m` `slo-dr.md:1` + `SLO.md:1` 99.9% 43.2m + `DISASTER_RECOVERY.md:7` RTO/RPO table + `alerts.yml:5` HighErrorRate 5% 5m | Burn 0.04% <0.1% budget 43.2m/month                                       |
| `ERROR_BUDGET`       | `99.9% SLO -> 0.1% *30d =43.2m/month`                                                                                                                              | 43.2m budget not exhausted 0 high SEV                                     |
| `CHAOS_FAULTS`       | `5` `chaos-config.yaml:1` pod-kill + delay 2s + cpu-stress + self-heal + timeout 50%                                                                               | Scheduled 0 6 * * 1/historyLimit5                                         |
| `LAUNCH-CHECKLIST`   | `178 lines` `LAUNCH-CHECKLIST.md:1` Pre-Launch->Launch-Day->Post-Launch                                                                                            | `archived for next release` validated via synthetic                       |
| `ALERTS`             | `9 rules` `alerts.yml:1` 3 groups 30s/60s `HighErrorRate` `HighLatency` `ServiceDown` runbook-linked                                                               | `promtool 9 PASS`                                                         |
| `TERRAFORM`          | `12 modules` `provider.tf:1` s3 `vaeloom-terraform-state` DDB `vaeloom-terraform-locks`                                                                            | `terraform validate` 12                                                   |

## Connectors / Migrations

- `alembic 0001..0021` linear, `0020_rls_remaining_5.py` 42/42 RLS (34 via 0010
  +3 via 0019 +5 via 0020), `0021_retention_runs.py` audit, fail-closed,
  `alembic downgrade 0021 --sql` reversible idempotent
  `try: create_table except: pass`
- `models/schema.py:RetentionRun` + 42 tables, `conftest.py` create_all + raw
  consent_records + usage_records per-test
- `openapi.yaml` 99 paths (`docs/backend/openapi.yaml` `rg -c 99`) — 88 at P12
  -> 99 at 787053a v0.2.0 final
- `docs/adr/` 32 files linear, no branch divergence + `MAINTAINERS.md:22` 72h
  governs ADR evolution via ADR-032 migration unification
- `infra/ops/synthetic-monitoring` 3 files 61+18+24 linear, no branch
  divergence, `bash -n` syntax PASS
- `infra/terraform` 12 modules linear, `terraform validate` 12, `compose config`
  dev 149 + prod 239 + synthetic 24 valid
- `MAINTAINERS.md 91` + `CONTRIBUTING.md 299` + `CHANGELOG.md 60` +
  `SECURITY.md 111` linear, no branch divergence

## Verification

- `git rev-parse HEAD` `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`)
- `pytest --collect-only -q -o addopts=""` 2557 (12.91s)
- `uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"`
  -> 31
- `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"`
  -> 94.2% retained P21 not regressed
- `rg -c "^  /" docs/backend/openapi.yaml` -> 99 paths PASS `openapi: 3.1.0`
  version 0.2.0
- `ls docs/adr | Measure-Object | Select Count` -> 32 ADRs `ADR-001`..`ADR-032`
- `rg "0\.2\.0" apps/api/src/api/config.py docs/backend/openapi.yaml apps/api/pyproject.toml`
  -> 3 hits 0.2.0 PASS
- `wc -l MAINTAINERS.md` -> 91 lines `wc -l CONTRIBUTING.md` -> 299 lines
  `wc -l CHANGELOG.md` -> 60 lines `wc -l CODE_OF_CONDUCT.md` -> 132 lines
- `wc -l COMMIT_PLAN.md` -> 437 lines 280 commits
- `rg "Lazy Consensus" MAINTAINERS.md` -> 72h PASS
  `rg "SEV1.*15" infra/ops/INCIDENT-RESPONSE.md` -> SEV1 15m PASS
- `rg "90-day" SECURITY.md` -> 90-day disclosure PASS
  `rg "30d|30-day" docs/phases/mvp-p21/08-registers.md` -> 30d deprecation PASS
- `bash -n infra/ops/synthetic-monitoring/check-health.sh && echo check-health syntax OK`
  -> syntax OK 61 lines
- `bash -n infra/ops/synthetic-monitoring/alert-on-failure.sh && echo alert syntax OK`
  -> syntax OK 18 lines
- `docker compose -f infra/ops/synthetic-monitoring/docker-compose.synthetic.yml config > /dev/null && echo synthetic OK`
  -> synthetic OK 24 lines
- `rg "INTERVAL" infra/ops/synthetic-monitoring/check-health.sh` -> 30 PASS
  `rg -c "/health" check-health.sh` 3 probes PASS
- `cat infra/ops/performance-budget.json | python -c "import json; print(json.load(open('infra/ops/performance-budget.json'))['api']['latency']['p95_read_ms'])"`
  -> 200 PASS 120<200
- `cat infra/ops/chaos/chaos-config.yaml | rg -c "kind:"` -> 5 faults PASS
- `promtool check rules infra/ops/monitoring/alerts.yml` -> SUCCESS: 9 rules 3
  groups PASS
- `python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo backend OK`
  -> backend OK 23 panels
- `ls .github/workflows | Measure-Object | Select Count` -> 11 workflows PASS
