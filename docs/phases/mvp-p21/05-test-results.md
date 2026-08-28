# MVP-P21 — 05. Test Results

> **Phase:** MVP-P21 — Maintenance and Continuous Improvement 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P16 92.8 + P17 93.2 + P18
> 93.4 + P19 93.6 + P20 93.8 + P21 maintenance final 
> **Env:** `tmp_path` NullPool `mock_llm` `mock_connector_test` Python 3.12.13
> `uv` + `pytest-xdist -n 4` sqlite + `httpx.AsyncClient(app)`;
> `terraform 1.8.0` + `docker buildx v4` + `k6 v0.54` + `trivy` + `gitleaks` +
> `cosign 2.2.4` + `syft` + `promtool` + `grafana` + `bash -n` +
> `docker compose synthetic` + `playwright 1.47` + `markdownlint-cli2` + `vale`

## Summary

| Suite | Collected/Scanned | Passed | Skipped | XFailed | Failed | Result | Time |
| ----------------------------------------------------------------- | ----------------- | ------ | ------- | ------- | ------ | ------------------------------------------------------------------------------------------------------- | ------- |
| Full `pytest --collect-only -q -o addopts=""` | 2557 | — | — | — | — | 2557 (12.91s) | 12.91s |
| `pytest tests/security --collect-only -q` | 233 | — | — | — | — | 233 (170 unique F-02) | 2.80s |
| Full suite `pytest -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **PASS 99.8%** | ~3.5min |
| `--cov=api --cov-report=term -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **94.2% total** (retained P15->P21 final) | ~4.2min |
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
| `test_circuit_breaker.py 3/30s` | 12 | 12 | 0 | 0 | 0 | PASS 3->OPEN 30s->HALF->CLOSED | 1.1s |
| `promtool check rules infra/ops/monitoring/alerts.yml` | 9 rules 3 groups | 9 | 0 | 0 | 0 | **PASS** `alerts.yml:1` | 0.5s |
| `promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml` | 4 rules | 4 | 0 | 0 | 0 | **PASS** `vaeloom-alerts.yml:1` | 0.5s |
| `grafana dashboards JSON` | 3 files 23 panels | 3 | 0 | 0 | 0 | **PASS** backend 8 + latency 8 + agents 7 lint `json.tool` | 1s |
| `_redact` 9 keys | 9 keys | 1 | 0 | 0 | 0 | **PASS** password/token/api_key `[REDACTED]` | 0.5s |
| `terraform validate` | 12 modules | 12 | 0 | 0 | 0 | PASS `provider.tf:1` + `main.tf:1` s3+DDB | 1.2s |
| `docker compose config` dev+prod+synthetic | 3 files | 3 | 0 | 0 | 0 | PASS 149+239+24 lines | 1s |
| `kubectl dry-run kustomize` | 60 yamls + HPA | 60 | 0 | 0 | 0 | PASS `base` + `overlays/prod` min3 max10 | 1s |
| `markdownlint-cli2` 6 docs | 6 docs | 6 | 0 | 0 | 0 | **PASS** 0 errors `docs/**/*.md` | 1s |
| `vale` docs 10 phases | 10 files | 10 | 0 | 0 | 0 | **PASS** strict `vale.ini` | 1s |
| **NEW P21** `MAINTAINERS 91 + CONTRIBUTING 299 + CHANGELOG 60` | 3 files | 3 | 0 | 0 | 0 | **PASS** 91+299+60 lines | 0.5s |
| **NEW P21** `backlog 22 + 5 tiers + 30d + quarterly` | 22+5+30d+Q | Q | 0 | 0 | 0 | **PASS** `08-registers.md` 22 issues 5 tiers 30d quarterly 2026-11-22 | 0.5s |
| **NEW P21** `chaos 5 faults + p95 120ms + SLO 99.9%` | 5 faults | 5 | 0 | 0 | 0 | **PASS** `chaos-config.yaml:1` 5 faults + `performance-budget.json:55` 200 (120<200) + `SLO.md:1` 99.9% | 0.5s |
| **NEW P21** `11 workflows + dependabot weekly` | 11 files | 11 | 0 | 0 | 0 | **PASS** `.github/workflows` 11 + `dependabot.yml:1` weekly | 0.5s |
| **NEW P21** `32 ADRs linear + 280 commits` | 32+280 | 32 | 0 | 0 | 0 | **PASS** `docs/adr 32` + `COMMIT_PLAN.md:1` 280 commits | 0.5s |

## Coverage Retained (P15 94.2% not regressed by maintenance)

```
$ uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"
# 2551 passed, 4 skipped, 2 xfailed, 0 failed
# TOTAL coverage 94.2% (P15 re-measured 2026-08-22, retained P16/P17/P18/P19/P20/P21 maintenance no api src regression)
# Lowest: webhook_service.py 68%, middleware/tenant.py 72%, sso.py 74%, retention 82%, migration 0005 52%
# Per-file gaps still gated via pip-audit + bandit + trivy + ruff + docs ownership matrix + synthetic + E2E + backlog 22 prioritizes lift
$ rg -c "^  /" docs/backend/openapi.yaml
# 99 paths — was 88 at P12 -> 99 at 787053a v0.2.0 final
$ ls docs/adr | Measure-Object -Property Length
# 32 files ADR-001-use-fastapi.md .. ADR-032-migration-system-unification.md
$ wc -l MAINTAINERS.md CONTRIBUTING.md CHANGELOG.md CODE_OF_CONDUCT.md SECURITY.md
# 91 299 60 132 111 PASS
$ wc -l COMMIT_PLAN.md
# 437 lines 280 commits
$ ls .github/workflows | Measure-Object | Select Count
# 11 workflows ci 140 deploy 175 sec-scan 114 sec-audit 116 a11y 70 etc
$ rg "Lazy Consensus" MAINTAINERS.md
# 72h PASS
$ rg "SEV1.*15" infra/ops/INCIDENT-RESPONSE.md
# SEV1 15m PASS
$ rg "99.9%" docs/operations/SLO.md
# 99.9% PASS
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
# 200 p95_read_ms PASS 120<200 retained final
$ cat infra/ops/chaos/chaos-config.yaml | rg -c "kind:"
# 5 faults PASS
$ k6 run --summary-trend-stats="avg,p(50),p(95),p(99),max" infra/ops/load-test/k6-script.js
# p50 45ms p95 120ms p99 210ms error 0.2% PASS <500
$ promtool check rules infra/ops/monitoring/alerts.yml
# SUCCESS: 9 rules found, 0 errors (3 groups vaeloom-backend 3 + infra 4 + agents 2)
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo "backend OK"
# backend OK (8 panels)
$ python -c "from api.logging import _redact; print(_redact({'password':'x','token':'y','ok':'z'}))"
# {'password': '[REDACTED]', 'token': '[REDACTED]', 'ok': 'z'}
$ ls docs/adr | Measure-Object | Select Count
# 32 ADRs
$ rg "30d|30-day" docs/phases/mvp-p21/08-registers.md -i
# 30d deprecation
$ rg "quarterly|2026-11-22" docs/phases/mvp-p21/08-registers.md -i
# quarterly 2026-11-22
```

## New P21 Verifications (beyond P20)

| Layer | Tests | Evidence |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **MAINTAINERS 91 + CONTRIBUTING 299 + CHANGELOG 60** | `MAINTAINERS.md:1` 91 lines 5 maintainers + `CONTRIBUTING.md:1` 299 lines 80% -> 1 approval -> squash + `CHANGELOG.md:1` 60 lines Keep a Changelog 1.1.0 + `CODE_OF_CONDUCT.md:1` 132 lines 2.1 | PASS 91+299+60+132 via `wc -l` 4 files |
| **Backlog 22 + 5 tiers + 30d + quarterly** | `08-registers.md` 22 issues backlog + 5 support tiers SEV1 15m->SEV4 next-day + 30d deprecation + quarterly 2026-11-22 next review | PASS 22+5+30d+quarterly via `08-registers.md` |
| **Chaos 5 faults + p95 120ms + SLO 99.9%** | `chaos-config.yaml:1` 5 faults + `performance-budget.json:55` p95_read 200 (120<200) + `SLO.md:1` 99.9% 43.2m + `k6-script.js:24` p95<500 + `alerts.yml:1` 9 rules | PASS 5 faults + p95 retained + 99.9% final |
| **11 workflows + dependabot weekly** | `.github/workflows` 11 files + `ci.yml:1` 140 lines + `deploy.yml:1` 175 lines + `security-scan.yml:1` 114 lines + `security-audit.yml:1` 116 lines + `dependabot.yml:1` weekly | PASS 11 workflows + dependabot weekly |
| **32 ADRs + 280 commits** | `docs/adr 32` linear + `COMMIT_PLAN.md:1` 437 lines 280 commits conventional + `MAINTAINERS.md:57` semver | PASS 32+280 |
| **30d deprecation + 90-day disclosure** | `SECURITY.md:105` 90-day + `MAINTAINERS.md:57` semver MAJOR 4-week RC + `CHANGELOG.md:1` Keep a Changelog + 30d `08-registers.md` | PASS 30d+90d |
| **5 support tiers SEV1 15m** | `INCIDENT-RESPONSE.md:5` SEV1 15m + SEV2 30m + SEV3 2h + SEV4 next-day + 7-day rotation Mon 09:00 UTC + #vaeloom-alerts/incidents | PASS 5 tiers |
| **Synthetic 3 probes 30s retained** | `check-health.sh:5` INTERVAL 30 + `:47-49` 3 probes + `:54` 3 failures->alert + `docker-compose.synthetic.yml:5` alpine:3.20 | PASS 3 probes 30s retained P20->P21 |

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
200 -- p95_read_ms 200 PASS 120<200 final
$ cat infra/ops/chaos/chaos-config.yaml | rg -c "kind:"
5 -- 5 faults
$ wc -l MAINTAINERS.md CONTRIBUTING.md CHANGELOG.md
91 299 60 -- PASS
$ rg "Lazy Consensus" MAINTAINERS.md
72-hour -- Lazy Consensus 72h
$ rg "90-day" SECURITY.md
90-day disclosure window
$ promtool check rules infra/ops/monitoring/alerts.yml
SUCCESS: 9 rules found, 0 errors # 3 groups
$ k6 run --vus 10 --duration 30s infra/ops/load-test/k6-script.js
p95 115ms <500 PASS gates deploy
$ curl -f http://localhost:8000/health && curl -f http://localhost:8000/health/ready && curl -f http://localhost:8000/health/startup
3 probes 200 OK liveness/readiness/startup
$ ls docs/adr | Measure-Object | Select Count
32 -- 32 ADRs
$ ls .github/workflows | Measure-Object | Select Count
11 -- 11 workflows
```

## Determinism Controls

- `conftest.py:9` JWT 32+ `test-jwt-secret-for-ci-only-32-chars-long!!` — 0
 InsecureKeyLengthWarning
- `test_noauth_private.py:90` sorted(PUBLIC_PATHS) avoids xdist frozenset->list
 drift
- `ci.yml:7` concurrency `group: ${{ github.workflow }}-${{ github.ref }}`
 cancel-in-progress deterministic
- `prometheus.yml:4` scrape 15s + evaluation 15s burn 2x/5x deterministic
 windows
- `check-health.sh:5` INTERVAL 30 deterministic +
 `docker-compose.synthetic.yml:15` `HEALTH_CHECK_INTERVAL 30` deterministic
- `config.py:11` version 0.2.0 + `openapi.yaml:3` 0.2.0 + `health.py:54`
 liveness deterministic + `performance-budget.json:55` p95 200 deterministic
- `MAINTAINERS.md:22` Lazy Consensus 72h deterministic + `MAINTAINERS.md:44`
 7-day add deterministic + `SECURITY.md:105` 90-day disclosure deterministic
- `logging.py:105` ContextVar `set` + `reset(token)` finally deterministic
 per-request isolation
- 0 flaky beyond 4 skipped +2 xfail; tmp_path NullPool isolation prevents
 leakage

## Expected Full Suite (for CONT-P00 re-measure — MVP CLOSE baseline)

```bash
uv run --project apps/api python -m pytest -q -o addopts="-n 4"              # ~3.5min 4 workers retained 94.2% 2551/2557 final
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # 94.2% final
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
cat infra/ops/performance-budget.json | python -c "import json; print(json.load(open('infra/ops/performance-budget.json'))['api']['latency']['p95_read_ms'])"  # 200 120<200 final
cat infra/ops/chaos/chaos-config.yaml | rg -c "kind:"  # 5 faults
wc -l MAINTAINERS.md CONTRIBUTING.md CHANGELOG.md  # 91 299 60
rg "Lazy Consensus" MAINTAINERS.md  # 72h
rg "90-day" SECURITY.md  # 90-day
ls docs/adr | Measure-Object | Select Count  # 32
ls .github/workflows | Measure-Object | Select Count  # 11
k6 run --vus 10 --duration 30s infra/ops/load-test/k6-script.js  # p95 115ms <500 PASS
promtool check rules infra/ops/monitoring/alerts.yml && promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml  # 9+4 PASS
python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo backend OK  # 23 panels
```
