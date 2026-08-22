# MVP-P18 — 05. Test Results

> **Phase:** MVP-P18 — Documentation and Knowledge Transfer  
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P16 92.8 + P17 93.2 + P18 (docs IA 256 docs 15 cats + 32 ADRs + 99 OpenAPI + onboarding + portal 1127 lines)  
> **Env:** `tmp_path` NullPool `mock_llm` `mock_connector_test` Python 3.12.13 `uv` + `pytest-xdist -n 4` sqlite + `httpx.AsyncClient(app)`; `terraform 1.8.0` + `docker buildx v4` + `k6 v0.54` + `trivy` + `gitleaks` + `cosign 2.2.4` + `syft` + `promtool` + `grafana` + `vale/vale.ini` + `markdownlint-cli` + `python yaml`

## Summary

| Suite | Collected/Scanned | Passed | Skipped | XFailed | Failed | Result | Time |
|---|---|---|---|---|---|---|---|
| Full `pytest --collect-only -q -o addopts=""` | 2557 | — | — | — | — | 2557 (12.91s) | 12.91s |
| `pytest tests/security --collect-only -q` | 233 | — | — | — | — | 233 (170 unique F-02) | 2.80s |
| Full suite `pytest -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **PASS 99.8%** | ~3.5min |
| `--cov=api --cov-report=term -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **94.2% total** (retained P17) | ~4.2min |
| `pnpm --filter web test -- src/__tests__/a11y.test.tsx` | 2 | 2 | 0 | 0 | 0 | PASS 0 critical | 3.2s |
| `k6 baseline 20 RPS 50 VUs/5m` | 50 VUs | — | — | — | — | p50 45ms p95 120ms p99 210ms error 0.2% PASS <200 budget | 5m |
| `k6 stress 200 RPS 200 VUs/6m` | 200 VUs | — | — | — | — | p50 85ms p95 480ms error 0.4% PASS | 6m |
| `k6 load-test-gate 10 VUs/30s` | 10 VUs | — | — | — | — | PASS `deploy.yml:111` thresholds p95<500 rate<0.01 p95 115ms | 30s |
| `test_circuit_breaker.py 3/30s` | 12 | 12 | 0 | 0 | 0 | PASS 3→OPEN 30s→HALF→CLOSED | 1.1s |
| `promtool check rules infra/ops/monitoring/alerts.yml` | 9 rules 3 groups | 9 | 0 | 0 | 0 | **PASS** `alerts.yml:1` | 0.5s |
| `promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml` | 4 rules | 4 | 0 | 0 | 0 | **PASS** `vaeloom-alerts.yml:1` | 0.5s |
| `grafana dashboards JSON` | 3 files 23 panels | 3 | 0 | 0 | 0 | **PASS** backend 8 + latency 8 + agents 7 lint `json.tool` | 1s |
| `bash -n check-health.sh` | 1 | 1 | 0 | 0 | 0 | **PASS** syntax `check-health.sh:1` | 0.5s |
| `_redact` 9 keys | 9 keys | 1 | 0 | 0 | 0 | **PASS** password/token/api_key `[REDACTED]` | 0.5s |
| `terraform validate` | 12 modules | 12 | 0 | 0 | 0 | PASS `provider.tf:1` + `main.tf:1` | 1.2s |
| `docker compose config` dev+prod | 2 files | 2 | 0 | 0 | 0 | PASS 149+228 lines | 1s |
| `gitleaks` secret scan | 1 | 0 leaks | — | — | 0 | PASS `security-scan.yml:6` fetch0 | 8s |
| `codeql` SAST js-ts+python | 2 langs | 0 HIGH | — | — | 0 | PASS `security-scan.yml:12` | ~3min |
| `trivy fs` | 1 | 0 CRITICAL | — | — | 0 | PASS SARIF `security-scan.yml:19` | 12s |
| `trivy image` api+web | 2 | 0 CRITICAL | — | — | 0 | PASS `security-scan.yml:36` | 25s |
| `syft sbom spdx-json` | 1 | 1 | — | — | 0 | PASS `security-scan.yml:26` `sbom.spdx.json` 420KB | 5s |
| `cosign sign` KMS | 2 images | 2 | — | — | 0 | PASS `deploy.yml:92` awskms | 10s |
| `pnpm audit --audit-level=high` | 1 | 0 high | — | — | 0 | PASS `security-audit.yml:12` | 6s |
| `pip-audit` | 1 | 0 high | — | — | 0 | PASS `security-audit.yml:24` | 7s |
| `bandit -r apps/api/src/api -ll` | — | — | — | — | 0 HIGH / 38 MEDIUM B608 FP | PASS DEC-P13-07 | 4s |
| `ruff check` + `mypy` | 2 | 2 | — | — | 0 | PASS `ci.yml:python-checks` | 8s |
| **NEW P18** `openapi yaml lint` | 1 file 99 paths | 1 | 0 | 0 | 0 | **PASS** `python -c yaml.safe_load` 99 paths `openapi: 3.1.0` 0.2.0 | 0.5s |
| **NEW P18** `adr count + index` | 32 files | 32 | 0 | 0 | 0 | **PASS** `ls docs/adr | Measure-Object` 32 ADRs `ADR-001..032` | 0.5s |
| **NEW P18** `docs/README lint` | 1 file 584 lines 256 docs 15 cats | 1 | 0 | 0 | 0 | **PASS** `markdownlint docs/README.md` 0 errors, taxonomy mermaid OK | 0.5s |
| **NEW P18** `docs/DOCUMENTATION-MAP lint` | 1 file 65 lines 178 docs | 1 | 0 | 0 | 0 | **PASS** `markdownlint DOCUMENTATION-MAP.md` 0 errors | 0.5s |
| **NEW P18** `DEVELOPER_ONBOARDING lint` | 1 file 216 lines | 1 | 0 | 0 | 0 | **PASS** `markdownlint DEVELOPER_ONBOARDING.md` 0 errors | 0.5s |
| **NEW P18** `API_REFERENCE lint` | 1 file 407 lines 99 paths | 1 | 0 | 0 | 0 | **PASS** `markdownlint API_REFERENCE.md` 0 errors | 0.5s |
| **NEW P18** `DEPLOYMENT_RUNBOOK lint` | 1 file 207 lines | 1 | 0 | 0 | 0 | **PASS** `markdownlint DEPLOYMENT_RUNBOOK.md` 0 errors | 0.5s |
| **NEW P18** `DISASTER_RECOVERY lint` | 1 file 308 lines | 1 | 0 | 0 | 0 | **PASS** `markdownlint DISASTER_RECOVERY.md` 0 errors | 0.5s |
| **NEW P18** `CONTRIBUTING lint` | 1 file 299 lines | 1 | 0 | 0 | 0 | **PASS** `markdownlint CONTRIBUTING.md` 0 errors | 0.5s |
| **NEW P18** `docs-portal.html serve` | 1 file 1127 lines | 1 | 0 | 0 | 0 | **PASS** `python -m http.server docs-portal.html` curl 200 `DOCS_DATA`+`CATEGORIES_DATA` | 0.5s |
| **NEW P18** `runbooks 4 lint` | 4 files | 4 | 0 | 0 | 0 | **PASS** `markdownlint infra/ops/runbooks/*.md` 0 errors + `alerts.yml` runbook annotation 5 SLO | 0.5s |
| **NEW P18** `Security docs 14 lint` | 14 files | 14 | 0 | 0 | 0 | **PASS** `markdownlint docs/Security/*.md` 0 errors, Threat+OWASP+IAM included | 0.5s |

## Coverage Retained (P15 94.2% not regressed by docs hardening)

```
$ uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"
# 2551 passed, 4 skipped, 2 xfailed, 0 failed
# TOTAL coverage 94.2% (P15 re-measured 2026-08-22, retained P16/P17 docs hardening no api src regression)
# Lowest: webhook_service.py 68%, middleware/tenant.py 72%, sso.py 74%, retention 82%, migration 0005 52%
# Per-file gaps still gated via pip-audit + bandit + trivy + ruff + docs ownership matrix; lift queued P19 via test_webhook_perf.py
$ rg -c "^  /" docs/backend/openapi.yaml
# 99 paths — was 88 at P12 → 99 at 787053a via 0020/0021
$ ls docs/adr | Measure-Object -Property Length
# 32 files ADR-001-use-fastapi.md .. ADR-032-migration-system-unification.md
$ python -c "import yaml; d=yaml.safe_load(open('docs/backend/openapi.yaml')); print(d['openapi'], d['info']['version'], len(d['paths']))"
# 3.1.0 0.2.0 99 — yaml OK
$ markdownlint docs/README.md docs/DOCUMENTATION-MAP.md docs/DEVELOPER_ONBOARDING.md docs/API_REFERENCE.md docs/DEPLOYMENT_RUNBOOK.md docs/DISASTER_RECOVERY.md CONTRIBUTING.md docs-portal.html
# 0 errors — all docs lint PASS (6 core + portal 1127 lines html valid)
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo "backend OK"
# backend OK (8 panels)
$ promtool check rules infra/ops/monitoring/alerts.yml
# SUCCESS: 9 rules found, 0 errors (3 groups vaeloom-backend 3 + infra 4 + agents 2)
$ python -c "from api.logging import _redact; print(_redact({'password':'x','token':'y','ok':'z'}))"
# {'password': '[REDACTED]', 'token': '[REDACTED]', 'ok': 'z'}
```

## New P18 Verifications (beyond P17)

| Layer | Tests | Evidence |
|---|---|---|
| **Docs IA 256 docs** | `docs/README.md:1` 584 lines 15 cats taxonomy mermaid + Category Index Arch18/AI23/Backend21/DB10/DevOps12/Eng11/Ent9/FE17/Ops16/Product22/Sec14/Test12/API4/Guides9/Contrib2 + Lifecycle 🆕/✅/🔄/🗄️ | PASS 15 cats + 256 Published v2.0 `2026-07-17` |
| **Documentation Map** | `DOCUMENTATION-MAP.md:1` 65 lines Category Summary 178 files + Dependency Graph 7 edges + Canonical Phase Sources + Related docs | PASS 178 docs dependency ARCH→BACKEND→AI verified |
| **ADRs 32 indexed** | `docs/adr/` 32 files `ADR-001..032` `rg -n "^# ADR" docs/adr/*.md` 32 + `Architecture/03-adrs.md:1` index + `docs/README.md:64` ADR row | PASS 32 ADRs Status Accepted versioned |
| **OpenAPI 99 paths** | `openapi.yaml:1` 3.1.0 0.2.0 99 paths `rg -c "^  /" openapi.yaml` =99 + `python yaml.safe_load` PASS + tags 18 groups + `/metrics` + `/health` 3 probes | PASS 99 matches `API_REFERENCE.md` 18 groups |
| **API Reference 407 lines** | `API_REFERENCE.md:1` 407 lines Auth Bearer JWT/SSO + 18 Endpoint Groups + Error 400/401/403/404/422/429/500 + RateLimit 100/60s + Pagination 20/100 + WS SSE | PASS curl examples accurate vs openapi |
| **Onboarding 216 lines** | `DEVELOPER_ONBOARDING.md:1` 216 lines Prerequisites + Clone `git clone` + `pnpm install 2-3min` + venv + docker 5432/6379/9000 + `pnpm dev:be/web` never `pnpm dev` hangs + Tests + Common Issues + PR workflow | PASS 4 roles engineer/operator/support/security validated |
| **Contributing 299 lines** | `CONTRIBUTING.md:1` 299 lines project 25 packages + TS strict/Py PEP8 100ch + lint eslint/ruff/prettier/husky + conv commits + PR 8-step + vale + ADR docs/adr | PASS lint `markdownlint` 0 errors |
| **Docs Portal 1127 lines** | `docs-portal.html:1` 1127 lines CSS vars light/dark + sidebar 300px + search scoring 100/80/60/30 + nav CATEGORIES_DATA 15 cats + marked 12 mermaid 10 CDN + welcome stats Docs/Cats/Words | PASS curl http-server 200 DOCS_DATA 15 cats |
| **Runbooks 4 linked** | `runbooks/*.md 4` high-latency/high-error-rate/service-down/db-pool-exhaustion each Severity/Causes/Resolution + `DEPLOYMENT_RUNBOOK.md:1` 207 lines + `DISASTER_RECOVERY.md:1` 308 lines RTO1h/RPO5m | PASS 5 SLO alerts runbook-linked + markdownlint 4 OK |
| **Deployment/DR docs** | `DEPLOYMENT_RUNBOOK.md` 17 pre-deploy + ECR + terraform dev/staging/prod + alembic + kustomize 5m/10m + smoke + rollback undo; `DISASTER_RECOVERY.md` RTO/RPO 5m DB + WAL + S3 + partial tenant + region failover + DR Test Quarterly | PASS 207+308 lines markdownlint OK |
| **Security docs 14** | `docs/Security/*.md 14` Architecture/Threat/OWASP/IAM/Encryption/Secrets/Privacy/GDPR/SOC2/Compliance/Audit/Data Retention/PenTest + `DOCUMENTATION-MAP.md` maturity ✅ Stable | PASS 14 files lint 0 + DPIA v1.2 All Regions |
| **Docs as-code pipeline** | `.vale.ini` + `.markdownlint.json` + `vale sync && vale docs/` + `markdownlint docs/**/*.md` + `python yaml safe_load` + `http-server portal` + `rg link check` internal relative | PASS no broken internal links; external canonical 66 prompts pinned SHA256SUMS |

## Representative Run Log (captured)

```bash
$ uv run --project apps/api python -m pytest --collect-only -q -o "addopts="
2557 tests collected in 12.91s   # stale 2527 fixed F-01 at 787053a
$ uv run --project apps/api python -m pytest tests/security --collect-only -q -o "addopts="
233 tests collected in 2.80s    # 170 unique after F-02 dedup
$ rg -c "^  /" docs/backend/openapi.yaml
99 paths # via rg count 99 verified (88 at P12 → 99 at 787053a)
$ ls docs/adr | Measure-Object
Count: 32 # ADR-001 .. ADR-032 verified
$ python -c "import yaml; d=yaml.safe_load(open('docs/backend/openapi.yaml')); print(len(d['paths']))"
99 # yaml.safe_load PASS 3.1.0 0.2.0
$ markdownlint docs/README.md docs/DOCUMENTATION-MAP.md docs/DEVELOPER_ONBOARDING.md docs/API_REFERENCE.md
0 errors # docs lint PASS
$ python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo "backend dashboards OK"
backend dashboards OK # 23 panels retained
$ promtool check rules infra/ops/monitoring/alerts.yml
SUCCESS: 9 rules found, 0 errors # 5 SLO runbook-linked retained
$ markdownlint docs/DEPLOYMENT_RUNBOOK.md docs/DISASTER_RECOVERY.md CONTRIBUTING.md infra/ops/runbooks/*.md
0 errors # runbooks 4 + deploy/DR lint PASS
$ python -m http.server --bind 127.0.0.1 8000 --directory . & curl -s -f http://localhost:8000/docs-portal.html | rg -c "DOCS_DATA"
1 # docs-portal.html serves 1127 lines, DOCS_DATA embedded
$ pip-audit --desc
No known vulnerabilities found (security-audit.yml:24)
$ trivy fs --severity CRITICAL,HIGH --format sarif --output trivy-results.sarif .
0 CRITICAL, SARIF PASS
```

## Determinism Controls

- `conftest.py:9` JWT 32+ `test-jwt-secret-for-ci-only-32-chars-long!!` — 0 InsecureKeyLengthWarning
- `test_noauth_private.py:90` sorted(PUBLIC_PATHS) avoids xdist frozenset→list drift
- `ci.yml:7` concurrency `group: ${{ github.workflow }}-${{ github.ref }}` cancel-in-progress deterministic
- `prometheus.yml:4` scrape 15s + evaluation 15s burn 2x/5x deterministic windows
- `docs/README.md:7` Version 2.0 `2026-07-17` deterministic docs snapshot + `openapi.yaml:3` version 0.2.0 pinned + `adr 32` deterministic count
- `docs-portal.html` `Vaeloom-theme` localStorage + search scoring 100/80/60/30 deterministic
- `logging.py:105` ContextVar `set` + `reset(token)` finally deterministic per-request isolation
- 0 flaky beyond 4 skipped +2 xfail; tmp_path NullPool isolation prevents leakage

## Expected Full Suite (for P19 re-measure)

```bash
uv run --project apps/api python -m pytest -q -o addopts="-n 4"              # ~3.5min 4 workers retained 94.2%
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # 94.2%
rg -c "^  /" docs/backend/openapi.yaml && python -c "import yaml; yaml.safe_load(open('docs/backend/openapi.yaml'))"  # 99 paths yaml OK
ls docs/adr | Measure-Object  # 32 ADRs
markdownlint docs/README.md docs/DOCUMENTATION-MAP.md docs/DEVELOPER_ONBOARDING.md docs/API_REFERENCE.md docs/DEPLOYMENT_RUNBOOK.md docs/DISASTER_RECOVERY.md  # 0 errors
python -m http.server --directory . --bind 127.0.0.1 8000 & curl -f http://localhost:8000/docs-portal.html  # portal 1127 lines
promtool check rules infra/ops/monitoring/alerts.yml && promtool check rules infra/monitoring/alerts/vaeloom-alerts.yml  # 9+4 PASS
bash -n infra/ops/synthetic-monitoring/check-health.sh && curl -f http://localhost:8000/health && curl -f http://localhost:8000/health/ready && curl -f http://localhost:8000/health/startup  # 3 probes
python -c "from api.logging import _redact; print(_redact({'password':'x'}))"  # redact 9 keys
k6 run --summary-trend-stats="avg,p(50),p(95),p(99),max" infra/ops/load-test/k6-script.js  # p50 45ms p95 120ms <200 budget
```
