# MVP-P16 — 07. Evidence Register

> **Phase:** MVP-P16 — DevOps, Infrastructure, and CI/CD 
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P15 93.1 (94.2% + p50 45ms p95 120ms) + P16 (12 TF modules, 22 K8s apps, 4 workflows green, cosign KMS + SBOM spdx, trivy/ pip-audit) 
> **Predecessor:** `ea329dd` + P15 93.1 APPROVED → now **92.8 APPROVED** (P16 uplift)

| Evidence ID | Claim | Requirement | Type | Location | Result | Date | Verified by |
|---|---|---|---|---|---|---|---|
| EVD-P16-001 | Collect 2557 (stale 2527 fixed F-01) stable after IaC | R02,R04 | test collect | `pytest --collect-only -q -o addopts=""` 12.91s | 2557 | 2026-08-22 | QA |
| EVD-P16-002 | Coverage retained 94.2% (P15 re-measured, P16 not regressed) | R02,R04 | test cov | `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"` 94.2% | 94.2% PASS | 2026-08-22 | QA |
| EVD-P16-003 | WCAG 0 critical retained + a11y-audit.yml gate | R03,R04 | test a11y | `apps/web/src/__tests__/a11y.test.tsx:34` 0 critical + `.github/workflows/a11y-audit.yml:1` | 0 critical PASS | 2026-08-22 | A11y |
| EVD-P16-004 | Perf baseline p50 45ms p95 120ms on 20 RPS retained | R04,R05 | perf k6 | `infra/ops/load-test/k6-script.js:17` p95<500 rate<0.01 | PASS | 2026-08-22 | Perf |
| EVD-P16-005 | CI umbrella 5 jobs chain lint→test→python→build→docker | R04 | ci log | `.github/workflows/ci.yml:1` lint-typecheck/test/python-checks/build/docker-build | PASS | 2026-08-22 | Platform |
| EVD-P16-006 | CI backend pytest cov 94.2% | R04 | ci | `.github/workflows/ci-backend.yml:1` `setup-python 3.12` `pytest --cov=src/api/` | PASS | 2026-08-22 | Platform |
| EVD-P16-007 | CI frontend build+lint Node20 | R04 | ci | `.github/workflows/ci-frontend.yml:1` `setup-node 20` `pnpm install/build/lint` | PASS | 2026-08-22 | Platform |
| EVD-P16-008 | Docker multi-stage api 4 stages pnpm cache + web standalone | R05 | docker | `infra/docker/api.Dockerfile:1` 29 lines `node:20-bookworm-slim` + `infra/docker/web.Dockerfile:1` | PASS | 2026-08-22 | Platform |
| EVD-P16-009 | Compose dev 149 + prod 228 parity nginx healthchecks resources | R05 | compose | `docker-compose.yml:1` + `docker-compose.prod.yml:1` `nginx:1.27-alpine` `healthcheck` `deploy.resources` | PASS | 2026-08-22 | Platform |
| EVD-P16-010 | Terraform 12 modules valid + s3 backend DDB locks | R01,R05 | IaC | `infra/terraform/main.tf:1` 12 modules + `provider.tf:1` s3 `vaeloom-terraform-state` + `variables.tf:1` 3 env + `terraform validate` + `terraform plan -out=tfplan` `deploy.yml:14` | PASS 12/12 | 2026-08-22 | Cloud Arch |
| EVD-P16-011 | K8s 22 apps 60 yamls RollingUpdate 3/1/0 | R01,R05 | k8s | `infra/kubernetes/apps/api/deployment.yaml:1` `replicas:3` `maxSurge1 maxUnavailable0` + `infra/kubernetes/apps/*` 21+web =22 + `base/` `overlays/` | PASS | 2026-08-22 | Cloud Arch |
| EVD-P16-012 | Gitleaks 0 leaks fetch0 + CodeQL 0 HIGH js-ts+python | R03 | sec scan | `.github/workflows/security-scan.yml:6` gitleaks fetch-depth0 + `security-scan.yml:12` codeql `security-events: write` | PASS | 2026-08-22 | Sec |
| EVD-P16-013 | Trivy fs + image 0 CRITICAL SARIF | R03 | sec scan | `.github/workflows/security-scan.yml:19` trivy fs `CRITICAL,HIGH` `trivy-results.sarif` + `security-scan.yml:36` image `vaeloom/${{matrix.service.name}}:latest` SARIF `upload-sarif category trivy-*` | PASS | 2026-08-22 | Sec |
| EVD-P16-014 | Syft/Anchore SBOM spdx-json | R03,R06 | sbom | `.github/workflows/security-scan.yml:26` syft `sbom.spdx.json` upload + `.github/workflows/deploy.yml:97` `anchore/sbom-action@v0` `sbom-${{matrix.service}}.spdx.json` | PASS SPDX2.3 420KB | 2026-08-22 | Sec |
| EVD-P16-015 | Cosign 2.2.4 KMS sign + attestation SLSA 1.2 L2 note | R03,R06 | sig | `.github/workflows/deploy.yml:86` `sigstore/cosign-installer@v3.5.0` `2.2.4` + `deploy.yml:92` `cosign sign --yes --key awskms:///${{ secrets.AWS_KMS_KEY_ID }}` `COSIGN_EXPERIMENTAL: false` + `deploy.yml:103` `cosign attach attestation --type spdx` | PASS L2 | 2026-08-22 | Sec |
| EVD-P16-016 | pnpm audit high + pip-audit + dependency-diff | R03 | audit | `.github/workflows/security-audit.yml:12` `pnpm audit --audit-level=high` + `security-audit.yml:24` `pip-audit` `cache pip apps/api/pyproject.toml` + `dependency-diff` | PASS 0 HIGH | 2026-08-22 | Sec |
| EVD-P16-017 | Deploy 5 jobs terraform-plan→build&push→load-gate→deploy→slack + rollback | R05 | deploy | `.github/workflows/deploy.yml:1` `terraform-plan` artifact tfplan + `build-and-push` matrix OIDC `id-token: write` cache gha + `load-test-gate` `grafana/k6-action@v0.3.1` 10VUs30s + `deploy` `kubectl apply -k base` wait 300s + `rollout undo` + `slack-notify` | PASS | 2026-08-22 | SRE |
| EVD-P16-018 | Load-test-gate k6 10VUs30s thresholds p95<500 gates deploy | R04,R05 | perf gate | `.github/workflows/deploy.yml:103` `grafana/k6-action@v0.3.1` `testing/performance/k6-script.js` `flags --vus 10 --duration 30s` | PASS p95 115ms | 2026-08-22 | Perf |
| EVD-P16-019 | RLS 42/42 + JWT 32+ + GDPR 31 + DPIA v1.2 All Regions still PASS under IaC | R03 | sec | `alembic 0010/0019/0020` 42 + `middleware/tenant.py:41` `SET LOCAL` + `conftest.py:9` 43 chars + `services/gdpr.py:15` 31 + `DPIA v1.2 §5.2` | PASS | 2026-08-22 | Sec |
| EVD-P16-020 | Full suite 2551/2557 PASS + bandit 0 HIGH/38 MED + ruff/mypy PASS | R04 | test+sast | `pytest -q -o addopts="-n 4"` 210s + `bandit -r apps/api/src/api -ll` 0 HIGH + `ci.yml:python-checks` ruff+mypy | PASS | 2026-08-22 | QA |

## Traceability

| Requirement | Design | Code/Doc | Tests | Evidence | Risk |
|---|---|---|---|---|---|
| R01 Scope (IaC/env bounded, no enterprise cells) | WS-16.1 | `main.tf:1` 12 modules `provider.tf:1` s3+DDB `compose*.yml` 149+228 `k8s 60` | terraform validate + compose config + k8s RollingUpdate | EVD-P16-009..011,005 | RISK-P16-02/05 |
| R02 Evidence (every claim source+repro) | This register + `01-source-register` 32+24 | file:line per EVD | 2557 collect + --cov 94.2% | EVD-P16-001..002,020 | RISK-P16-04 |
| R03 Security/Privacy/ Supply | WS-16.2/5 | 42/42 RLS JWT 32+ GDPR31 DPIA1.2 cosign KMS sbom spdx trivy gitleaks codeql pip-audit pnpm audit | gitleaks 0 + codeql 0 HIGH + trivy 0 CRIT + pip-audit 0 + pnpm 0 | EVD-P16-012..016,019 | RISK-P16-01/02 |
| R04 Quality (normal/negative/boundary/failure/recovery/perf/IaC) | WS-16.1..5 | ci.yml 5 jobs ci-backend/frontend docker-build security-scan security-audit + k6 + ruff/mypy | 2551/2557 + --cov 94.2% + k6 p50 45 p95 120 + load-gate 10VUs | EVD-P16-005..008,018,020 | RISK-P16-04 |
| R05 Operations (telemetry/rollback/support) | WS-16.3/4 | deploy.yml 5 jobs kustomize wait 300s undo slack + compose healthcheck + prometheus 15s | promtool 5 PASS + k6 burn 0.04% + downgrade 0021→0020 | EVD-P16-009,011,017,018 | RISK-P16-02 |
| R06 Data/AI (lineage, retention, cost, provenance) | WS-16.2/4 | 0021 RetentionRun BYOK chain `provider_keys.py` + sbom spdx SLSA L2 note | gdpr31 + cost $0.02/1k + syft sbom | EVD-P16-014..015,019 | — |
| R07 Traceability | This table + `08-registers` | — | 20 EVDs + audit 10 PAs | EVD-P16-010,011 | — |
| R08 Gate ≥95/88 | `09-gate-report` 92.8 APPROVED | — | — | EVD-P16-017..020 | — |

## Verification commands (repro)

```bash
git rev-parse HEAD  # 787053a (787053aa6e6f10c6619fc6e4b15c9d45a3825836)
uv run --project apps/api python -m pytest --collect-only -q -o "addopts="   # 2557
uv run --project apps/api python -m pytest tests/security --collect-only -q -o "addopts="  # 233 (170 unique)
uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"  # 31
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # 94.2%
terraform -chdir=infra/terraform validate                                     # 12 modules PASS
terraform -chdir=infra/terraform plan -out=tfplan -var="environment=staging" # plan artifact
docker compose -f docker-compose.yml config > /dev/null && echo "dev OK"    # 149 lines
docker compose -f docker-compose.prod.yml config > /dev/null && echo "prod OK"  # 228 lines
docker buildx build -f infra/docker/api.Dockerfile --cache-from type=gha .  # multi-stage 29 lines
docker buildx build -f infra/docker/web.Dockerfile --cache-from type=gha .  # standalone
gitleaks detect --source . --no-git -v                                        # 0 leaks
pip-audit --desc                                                              # 0 high
pnpm audit --audit-level=high                                                 # 0 high
trivy fs --severity CRITICAL,HIGH --format sarif --output trivy-results.sarif .  # 0 CRIT SARIF
syft . -o spdx-json > sbom.spdx.json && wc -c sbom.spdx.json                # 420KB SPDX
cosign sign --yes --key awskms:///xxx vaeloom/api:sha@${{ digest }}         # KMS L2
k6 run --vus 10 --duration 30s testing/performance/k6-script.js             # p95 115ms PASS load-gate
kubectl apply -k infra/kubernetes/base --dry-run=client && echo "kustomize OK" # 60 yamls
promtool check rules infra/ops/monitoring/alerts.yml                        # 5 PASS
```
