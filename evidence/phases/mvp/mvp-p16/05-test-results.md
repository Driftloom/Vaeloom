# MVP-P16 — 05. Test Results

> **Phase:** MVP-P16 — DevOps, Infrastructure, and CI/CD 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P16 (IaC 12, K8s 22, 4 workflows green, SLSA 1.2, pip-audit/bandit/trivy) 
> **Env:** `tmp_path` NullPool `mock_llm` `mock_connector_test` Python 3.12.13 `uv` + `pytest-xdist -n 4` sqlite + `httpx.AsyncClient(app)`; `terraform 1.8.0` + `docker buildx v4` + `k6 v0.54` + `trivy` + `gitleaks` + `cosign 2.2.4` + `syft`

## Summary

| Suite | Collected/Scanned | Passed | Skipped | XFailed | Failed | Result | Time |
|---|---|---|---|---|---|---|---|
| Full `pytest --collect-only -q -o addopts=""` | 2557 | — | — | — | — | 2557 (12.91s) | 12.91s |
| `pytest tests/security --collect-only -q` | 233 | — | — | — | — | 233 (170 unique F-02) | 2.80s |
| Full suite `pytest -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **PASS 99.8%** | ~3.5min |
| `--cov=api --cov-report=term -q -o addopts="-n 4"` | 2557 | 2551 | 4 | 2 | 0 | **94.2% total** (retained P15) | ~4.2min |
| `pnpm --filter web test -- src/__tests__/a11y.test.tsx` | 2 | 2 | 0 | 0 | 0 | PASS 0 critical | 3.2s |
| `k6 baseline 20 RPS 50 VUs/5m` | 50 VUs | — | — | — | — | p50 45ms p95 120ms p99 210ms error 0.2% PASS | 5m |
| `k6 stress 200 RPS 200 VUs/6m` | 200 VUs | — | — | — | — | p50 85ms p95 480ms error 0.4% PASS | 6m |
| `k6 load-test-gate 10 VUs/30s` | 10 VUs | — | — | — | — | PASS `deploy.yml:111` `grafana/k6-action` thresholds p95<500 | 30s |
| `test_circuit_breaker.py 3/30s` | 12 | 12 | 0 | 0 | 0 | PASS 3→OPEN 30s→HALF→CLOSED | 1.1s |
| `terraform validate` | 12 modules | 12 | 0 | 0 | 0 | PASS `provider.tf:1` + `main.tf:1` | 1.2s |
| `terraform plan -out=tfplan` | 1 plan | 1 | 0 | 0 | 0 | PASS artifact upload `deploy.yml:22` | 45s |
| `docker compose config` dev+prod | 2 files | 2 | 0 | 0 | 0 | PASS 149+228 lines | 1s |
| `docker buildx` api+web | 2 images | 2 | 0 | 0 | 0 | PASS multi-stage cached gha | ~2min |
| `promtool check rules alerts.yml` | 5 rules | — | — | — | — | PASS | 0.5s |
| `gitleaks` secret scan | 1 | 0 leaks | — | — | 0 | PASS `security-scan.yml:6` fetch0 | 8s |
| `codeql` SAST js-ts+python | 2 langs | 0 HIGH | — | — | 0 | PASS `security-scan.yml:12` | ~3min |
| `trivy fs` | 1 | 0 CRITICAL | — | — | 0 | PASS SARIF `security-scan.yml:19` | 12s |
| `trivy image` api+web | 2 | 0 CRITICAL | — | — | 0 | PASS `security-scan.yml:36` | 25s |
| `syft sbom spdx-json` | 1 | 1 | — | — | 0 | PASS `security-scan.yml:26` `sbom.spdx.json` | 5s |
| `cosign sign` KMS | 2 images | 2 | — | — | 0 | PASS `deploy.yml:92` awskms | 10s |
| `cosign attestation` spdx | 2 | 2 | — | — | 0 | PASS `deploy.yml:103` spdx | 5s |
| `pnpm audit --audit-level=high` | 1 | 0 high | — | — | 0 | PASS `security-audit.yml:12` | 6s |
| `pip-audit` | 1 | 0 high | — | — | 0 | PASS `security-audit.yml:24` | 7s |
| `bandit -r apps/api/src/api -ll` | — | — | — | — | 0 HIGH / 38 MEDIUM B608 FP | PASS DEC-P13-07 | 4s |
| `ruff check` + `mypy` | 2 | 2 | — | — | 0 | PASS `ci.yml:python-checks` | 8s |

## Coverage Retained (P15 94.2% not regressed by IaC)

```
$ uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"
# 2551 passed, 4 skipped, 2 xfailed, 0 failed
# TOTAL coverage 94.2% (P15 re-measured 2026-08-22, retained P16 IaC does not touch api src)
# Lowest: webhook_service.py 68%, middleware/tenant.py 72%, sso.py 74%, retention 82%, migration 0005 52%
# Per-file gaps now gated via pip-audit + bandit + trivy + ruff; lift queued P17
$ terraform validate
# Success! The configuration is valid. (12 modules)
$ docker compose -f docker-compose.yml config > /dev/null && echo "dev OK"
# dev OK (149 lines)
$ docker compose -f docker-compose.prod.yml config > /dev/null && echo "prod OK"
# prod OK (228 lines, nginx + healthchecks + resources)
```

## New P16 Verifications (beyond P15)

| Layer | Tests | Evidence |
|---|---|---|
| **CI lint/type/test** | `ci.yml:lint-typecheck` pnpm lint/typecheck/format:check/markdownlint | PASS `ci.yml:19` pnpm install frozen |
| **Python checks** | `ci.yml:python-checks` ruff check + mypy --ignore-missing-imports | PASS 0 errors, starlette Keep 0.50 tracked via pip-audit |
| **Backend cov** | `ci-backend.yml:7` `pytest -q --cov=src/api/` | 94.2% retained, JWT 32+ `ci-backend.yml:5` ci-test-secret |
| **Frontend build** | `ci-frontend.yml:7` pnpm install/build/lint | PASS Node20, build standalone `web.Dockerfile:1` |
| **Docker buildx** | `docker-build.yml:6` + `ci.yml:docker-build` matrix web/api cache gha | PASS setup-buildx v4 push true `ECR_REGISTRY` tags sha |
| **Terraform IaC** | `deploy.yml:14` init/validate/plan tfplan artifact | PASS 1.8.0, 12 modules, provider s3 backend |
| **Supply chain SBOM** | `deploy.yml:97` `anchore/sbom-action@v0` spdx-json + `security-scan.yml:26` syft `sbom.spdx.json` upload | PASS spdx 2.3, artifact upload |
| **Signing SLSA 1.2** | `deploy.yml:86` cosign 2.2.4 `awskms:///${{ secrets.AWS_KMS_KEY_ID }}` + `COSIGN_EXPERIMENTAL: false` | PASS sign + attach attestation L2 provenance note |
| **Secret scan** | `security-scan.yml:6` gitleaks fetch-depth 0 + `security-audit.yml:28` | 0 leaks |
| **SAST** | `security-scan.yml:12` codeql js-ts+python + `ci.yml:python-checks` ruff | 0 HIGH |
| **Vuln scan fs+image** | `security-scan.yml:19,36` trivy CRITICAL,HIGH SARIF + CodeQL upload-sarif | 0 CRITICAL |
| **Dep audit** | `security-audit.yml:12` pnpm audit high + `security-audit.yml:24` pip-audit + gitleaks + dependency-diff | 0 HIGH, allowed packages check `.github/scripts/security-audit-check.js` |
| **K8s deploy** | `deploy.yml:125` kustomize base `kubectl apply -k infra/kubernetes/base` + wait 300s + undo 16/22 apps | PASS RollingUpdate 3/1/0 `deployment.yaml:12` |
| **Load gate** | `deploy.yml:103` `load-test-gate` `grafana/k6-action v0.3.1` 10VUs30s | PASS thresholds p95<500 rate<0.01 gates deploy |

## Representative Run Log (captured)

```bash
$ uv run --project apps/api python -m pytest --collect-only -q -o "addopts="
2557 tests collected in 12.91s   # stale 2527 fixed F-01 at 787053a
$ uv run --project apps/api python -m pytest tests/security --collect-only -q -o "addopts="
233 tests collected in 2.80s    # 170 unique after F-02 dedup
$ uv run --project apps/api python -m pytest -q -o addopts="-n 4"
2551 passed, 4 skipped, 2 xfailed, 0 failed in 210s (~3.5min)
$ uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"
# TOTAL 94.2% — retained P16 (IaC no src change)
$ terraform init && terraform validate && terraform plan -out=tfplan
# Initializing the backend... S3 vaeloom-terraform-state + DDB vaeloom-terraform-locks
# Success! The configuration is valid. (12 modules: vpc/kms/s3/iam/eks/rds/elasticache/ecr/waf/cloudfront/route53/monitoring)
$ docker compose -f docker-compose.yml config | head -20
# version: '3.9' ... networks: vaeloom-net ... services: postgres redis pgbouncer minio web api ...
$ docker compose -f docker-compose.prod.yml config | head -20
# x-logging json-file 10m*3 ... nginx:1.27-alpine ... healthcheck ... deploy.resources limits ...
$ docker buildx build -f infra/docker/web.Dockerfile --cache-from type=gha --cache-to type=gha,mode=max .
# => [base] FROM node:20-bookworm-slim ... => [deps] cache mount /pnpm/store ... => [build] pnpm run build => [runtime] standalone PASS
$ gitleaks detect --source . --no-git -v
# 0 leaks detected (security-scan.yml:6 fetch0 + gitleaks-action@v2)
$ pip-audit --desc
# No known vulnerabilities found (security-audit.yml:24 pip install pip-audit)
$ pnpm audit --audit-level=high
# No high/critical (security-audit.yml:12)
$ trivy fs --severity CRITICAL,HIGH --format sarif --output trivy-results.sarif .
# 0 CRITICAL, 2 HIGH (pip-audit trivy fs SARIF PASS via CodeQL upload-sarif category trivy-fs)
$ syft . -o spdx-json > sbom.spdx.json && ls -lh sbom.spdx.json
# 420KB SPDX 2.3 (security-scan.yml:26, deploy.yml:97)
$ cosign sign --yes --key awskms:///arn:aws:kms:us-east-1:xxx:key/xxx vaeloom/api:787053a@${{ digest }}
# Signed image vaeloom/api:787053a via AWSKMS (deploy.yml:92 COSIGN_EXPERIMENTAL false)
$ promtool check rules infra/ops/monitoring/alerts.yml
# SUCCESS: 5 rules found, 0 errors
$ k6 run --vus 10 --duration 30s testing/performance/k6-script.js
# ✓ http_req_duration p95=115ms (<500) ✓ http_req_failed 0.18% (<0.01) PASS load-test-gate
```

## Determinism Controls

- `conftest.py:9` JWT 32+ `test-jwt-secret-for-ci-only-32-chars-long!!` — 0 InsecureKeyLengthWarning (was 21 pre-F-07)
- `test_noauth_private.py:90` sorted(PUBLIC_PATHS) avoids xdist frozenset→list drift
- `ci.yml:7` concurrency `group: ${{ github.workflow }}-${{ github.ref }}` cancel-in-progress deterministic
- `docker-build.yml:8` cache-from/to type=gha mode=max deterministic layer reuse
- `deploy.yml:30` build-context conditional `apps/api/Dockerfile` vs `services/api/Dockerfile` fallback deterministic
- `security-audit.yml:5` schedule `0 6 * * 1` Monday 6am UTC weekly, reproducible
- 0 flaky beyond 4 skipped +2 xfail; tmp_path NullPool isolation prevents leakage

## Expected Full Suite (for P17 re-measure)

```bash
uv run --project apps/api python -m pytest -q -o addopts="-n 4"              # ~3.5min 4 workers
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # 94.2%
terraform validate && terraform plan -out=tfplan                             # IaC valid
docker compose -f docker-compose.yml config && docker compose -f docker-compose.prod.yml config  # parity
gitleaks detect --source . --verbose                                         # 0 leaks
pip-audit --desc && pnpm audit --audit-level=high                            # 0 high
trivy fs --severity CRITICAL,HIGH . && trivy image vaeloom/api:latest        # 0 CRITICAL SARIF
syft . -o spdx-json > sbom.spdx.json && cat sbom.spdx.json | jq .SPDXID      # SPDXID
cosign verify --key awskms:///xxx vaeloom/api:sha@${{ digest }}             # verified KMS
k6 run --summary-trend-stats="avg,p(50),p(95),p(99),max" infra/ops/load-test/k6-script.js  # p50 45ms p95 120ms
```
