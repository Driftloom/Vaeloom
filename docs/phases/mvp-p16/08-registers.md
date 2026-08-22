# MVP-P16 — 08. Registers

> **Phase:** MVP-P16 — DevOps, Infrastructure, and CI/CD  
> **Date:** 2026-08-22 · **Baseline:** `787053a` + P15 93.1 + P16 (12 TF 22 K8s 4 workflows green SLSA L2 cosign KMS SBOM spdx)

## Risk Register

| ID | Risk | Severity | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| RISK-P16-01 | Docs mistaken for runtime (IaC not applied) | Critical | False prod readiness, TF drift | Require `terraform validate` + `plan -out=tfplan` artifact `deploy.yml:14` + `docker compose config` + `k6 load-test-gate` as gate | Platform/QA | OPEN (mitigated by 12 modules valid + compose parity + gate, but docs≠runtime stays) |
| RISK-P16-02 | Scope/permission/data assumed under IaC/rollout | High | Leak/loss under surge/rollout | 42/42 RLS fail-closed `tenant.py:41` under k6 20 RPS + RollingUpdate 3/1/0 `deployment.yaml:12` + rate_limit 100rpm + OIDC `id-token: write` + KMS sign | Sec/Arch/SRE | OPEN |
| RISK-P16-03 | External API/model/standard drift (MCP 2026-07-28, OWASP ASI01-10 v2.01, SLSA1.2, terraform aws ~>5.40, cosign 2.2.4) | High | Regression, supply-chain bypass | Pin in `01-source-register` 32+24, websearch verified 2026-08-22, `circuit_breaker.py:17` 3/30s isolates provider, `pip-audit` weekly | Integration | OPEN |
| RISK-P16-04 | Evidence incomplete (pip-audit/trivy not blocking) | High | Untrustworthy gate | 20 EVDs repro via `05-test-results.md` + `terraform validate` + `compose config` + gitleaks/codeql/trivy/pip-audit/pnpm audit + cosign/SBOM; `bandit` DEC-P13-07 retains | QA/Release | OPEN (mitigated but RLS per-file evidence partial) |
| RISK-P16-05 | Scope expansion (enterprise multi-region cells, multi-az auto) | High | Delay cost blowout | `enterprise_routes_enabled=false` + `packages/service-auth` not deployed + PaaS autoscale max5 `main.tf:1` + protected `environments` tfvars | Product | OPEN |
| RISK-P16-06 | IaC not prod-representative (sqlite mock vs RDS + ElastiCache + EKS) | Medium | Stale headroom, TF not applied to live | MockVector SQLite + `httpx.AsyncClient(app)` fallback bench representative for API latency; RDS/ElastiCache/EKS verified via `main.tf:1` modules + `terraform plan` artifact; staging `apply` queued P17 requires `apply` evidence | Platform/SRE | OPEN |
| RISK-P16-07 | Secrets in CI/registry leak | High | Credential replay, supply-chain poisoning | OIDC `role-to-assume` `deploy.yml:34` + `COSIGN_EXPERIMENTAL false` + `secrets.ECR_REGISTRY/KMS_KEY_ID` scoped + gitleaks fetch0 `security-scan.yml:6` | Sec | OPEN (mitigated but needs `gitleaks` pre-commit hook) |

## Decision Register

| ID | Decision | Rationale | Alternatives | Owner | Date |
|---|---|---|---|---|---|
| DEC-P16-01 | Keep PaaS-first bounded `min1 max5` + 12 modules vpc/kms/s3/iam/eks/rds/elasticache/ecr/waf/cloudfront/route53/monitoring `main.tf:1` | MVP operability not enterprise scale; s3 backend + DDB locks proven PaaS path | Full enterprise multi-region cells (rejected per §5 out of scope) | Cloud Arch | 2026-08-22 |
| DEC-P16-02 | 4 workflows green as umbrella: `ci.yml` (lint→test→python→build→docker) + `ci-backend` pytest cov + `ci-frontend` build/lint + `security-scan` gitleaks/codeql/trivy/sbom (actual 6+ but DEL claims 4) | Branch protection requires single umbrella; docker-build + deploy add signed promotion separately | 1 monolith workflow (rejected — isolates backend/frontend/security) | Platform | 2026-08-22 |
| DEC-P16-03 | Multi-stage Docker `api.Dockerfile:1` 4 stages `node:20-bookworm-slim` `deps` cache mount `/pnpm/store` + `web.Dockerfile:1` standalone; build context `apps/api` vs `services/api` fallback `deploy.yml:34` | Small prod image, cached deps, standalone web output: standalone `next.config.js` CI gated | Single-stage (rejected — no cache, large) | Platform | 2026-08-22 |
| DEC-P16-04 | SLSA L2 provenance note via `deploy.yml:86` cosign 2.2.4 `awskms` + `anchore/sbom-action v0` spdx + `cosign attach attestation --type spdx` `COSIGN_EXPERIMENTAL false` | Verifiable signed promotion before `kubectl apply -k base`; builder L3 needs hermetic + builder identity queued P17 | Unsigned `latest` push (rejected — violates SLSA 1.2) | Sec/Platform | 2026-08-22 |
| DEC-P16-05 | Supply chain 4 layers: gitleaks fetch0 `security-scan.yml:6` + codeql js-ts+python `security-scan.yml:12` + trivy fs/image CRITICAL,HIGH `security-scan.yml:19,36` + pip-audit `security-audit.yml:24` + pnpm audit `security-audit.yml:12` + syft sbom `security-scan.yml:26` | Defense-in-depth; pnpm/pip audit block HIGH, trivy SARIF upload codeql | Bandit only (rejected — needs fs+image) | Sec | 2026-08-22 |
| DEC-P16-06 | Progressive rollout `deployment.yaml:12` `replicas:3 RollingUpdate maxSurge1 maxUnavailable0` `imagePullPolicy Always` + `deploy.yml:125` `kubectl rollout undo` + `load-test-gate` k6 10VUs30s `deploy.yml:103` gates deploy | Zero-downtime, gate blocks bad deploy, rollback automated slack-notify | Recreate strategy (rejected — downtime) | SRE | 2026-08-22 |
| DEC-P16-07 | Env parity `docker-compose.yml:1` 149 dev + `docker-compose.prod.yml:1` 228 prod nginx 1.27-alpine healthchecks 10-30s resources 0.5-2cpu 128m-2g + `environments/dev|staging|prod/terraform.tfvars` | Reproducible dev→prod, healthchecks + resources limit noisy-neighbor | Prod-only compose (rejected — drift) | Platform | 2026-08-22 |
| DEC-P16-08 | Secrets OIDC `id-token: write` `deploy.yml:30` + `configure-aws-credentials v4` `role-to-assume` + `REDIS_PASSWORD:?err` `STORAGE_* :?err` fail-closed compose + gitleaks pre-scan | No long-lived key in CI, fail-closed missing secret | Static `AWS_ACCESS_KEY` in secrets (rejected) | Sec | 2026-08-22 |

## Assumption Register

| ID | Assumption | Risk if Wrong | Validation Plan | Status |
|---|---|---|---|---|
| ASM-P16-01 | 2557 collected stable after IaC (no api src change) | Flaky xdist | Re-collect each gate + `sorted(PUBLIC_PATHS)` `test_noauth_private.py:90` | ACTIVE |
| ASM-P16-02 | `terraform validate` + `plan` artifact proves 12 modules correct without `apply` to live | TF drift, apply fails | Staging `terraform apply` + `kubectl apply -k base --dry-run` + PG EKS live probe P17 | ACTIVE |
| ASM-P16-03 | `docker compose config` valid = runtime healthy (needs `up --wait` on prod) | Compose valid but up fails healthcheck | `docker compose -f docker-compose.prod.yml up --wait` nginx healthcheck `nginx -t` P17 | ACTIVE |
| ASM-P16-04 | `syft`/`anchore` spdx + `cosign` KMS = SLSA L2 sufficient for MVP (L3 needs builder hermetic) | Claim L3 prematurely | `cosign verify --key awskms` + `cosign verify-attestation --type spdx` staging `deploy.yml:92` P17 | ACTIVE |
| ASM-P16-05 | `trivy` 0 CRITICAL + `pip-audit` 0 HIGH + `pnpm audit` 0 HIGH = supply chain clean (bandit MEDIUM B608 FP accepted DEC-P13-07) | MEDIUM becomes HIGH | Weekly `security-audit.yml:5` schedule Mon6am + `pip-audit` `--desc` monitor `starlette 0.50 Keep 0.50` | ACTIVE |
| ASM-P16-06 | `load-test-gate` 10VUs 30s `p95 115ms` representative of 20 RPS SLI `p95 120ms` | Gate not production load | P17 staging 20 RPS `k6-script.js` 50VUs5m live + `RedisBackend` vs Memory delta | ACTIVE |
| ASM-P16-07 | `Deployment replicas:3 maxSurge1 maxUnavailable0` + `kubectl wait 300s` proves rollout (no chaos of EKS nodes) | Rollout hangs on resource quota | Staging `kubectl rollout status` + `chaos-config.yaml` fault EKS node drain P17 | ACTIVE |
| ASM-P16-08 | `gitleaks` fetch-depth0 + `GITHUB_TOKEN` scoped sufficient (no pre-commit hook yet) | Secret pushed between scans | Add `pre-commit gitleaks` + `security-audit.yml:28` diff check queued P17 | ACTIVE |

## Exception Register

| ID | Exception | Owner | Controls | Approvers | Expiry | Monitoring | Prohibited |
|---|---|---|---|---|---|---|---|
| EXC-P16-01 | Coverage per-file `webhook_service.py` 68% `middleware/tenant.py` 72% `migration 0005` 52% below 94.2% avg — total retained 94.2% | QA | Total 94.2% via `--cov` + `bandit 0 HIGH/38 MED` B608 FP + `ruff` + `trivy` 0 CRIT + per-file report `05-test-results.md` | QA | P17 | `pytest --cov` per-file | Claim 100% per-file |
| EXC-P16-02 | Starlette 0.50.0 `<0.51` per `fastapi 0.141.1` not `≥1.3.1` (P13 carry Keep 0.50) | AppSec | `fastapi 0.141.1` pins `starlette<0.51` + CSP+rate-limit mitigations + `pip-audit` weekly `security-audit.yml:5` `0 6 * * 1` + `trivy` not yet HIGH for starlette | AppSec | When `fastapi≥0.142` | `pip-audit` + `trivy` SARIF | Claim SLSA L3/hermetic |
| EXC-P16-03 | `testing/chaos/, fuzz/, visual-regression/` still EMPTY per `AGENTS.md:90` but `smoke` 5/12 + `performance/k6-script.js:17` + `security-scan` trivy + `deploy load-test-gate` mitigate — partially closed | QA/SRE | Partially closed `testing/smoke/README.md` 5 suites/12 cases + `k6 20 RPS p95 120ms` + `trivy fs/image` + `k6 gate 10VUs` + `k8s 22 apps` rollout | QA/SRE | P17 (inventory chaos 10 faults) | Inventory + k6 + trivy + k8s | Claim full QA without smoke/fuzz |
| EXC-P16-04 | SLSA L2 note only (L3 builder hermetic + attest not yet), WCAG `playwright-axe` not yet all routes (only jest-axe 0 critical + a11y-audit.yml + 5 pages spot-check) | Sec/A11y | L2 via `deploy.yml:86` cosign 2.2.4 KMS + SBOM spdx `syft` + attestation; `jest-axe` 0 critical `a11y.test.tsx:34` + `axe-config.ts` 0/5/10/20 + `audit-pages.ts:1` 5 pages manual — L3 + full playwright deferred P17 | Sec/A11y | P17 | `cosign verify` + `pnpm --filter web test -- a11y` + `syft` | Claim SLSA L3 or WCAG all routes |

## Change Register

| ID | Change | Rationale | Impact | Reviewers | Migration | Tests | Rollback |
|---|---|---|---|---|---|---|---|
| CHG-P16-01 | Harden `ci.yml:1` 5-job chain + concurrency `cancel-in-progress` + PNPM 9.12 Node20 PY3.12 `ruff+mypy` `markdownlint` | P15 had no unified CI; P16 adds quality gate branch protection | Lint/type/test gates PR | Platform/QA | N/A | `ci.yml` green | Revert workflow |
| CHG-P16-02 | Keep `ci-backend.yml:1` + `ci-frontend.yml:1` as focused jobs for backend/frontend (P15 had only `ci.yml` umbrella) | Fast feedback, cache pip/pnpm separate | 554+378b workflows, xdist -n4 94.2% | Platform | N/A | pytest 94.2% + pnpm build | Delete workflows |
| CHG-P16-03 | Harden `security-scan.yml:1` 5 jobs gitleaks/codeql/trivy/sbom/docker-scan + `security-audit.yml:1` pnpm/pip-audit/gitleaks/diff weekly Mon6am | Supply chain had only `bandit` DEC-P13-07; P16 adds L2 provenance foundation | gitleaks fetch0 + trivy SARIF + syft spdx | Sec | N/A | 0 leaks/crit/high | Disable schedule |
| CHG-P16-04 | Add `deploy.yml:86` cosign 2.2.4 KMS sign + sbom spdx `anchore` + attestation `awskms` `COSIGN_EXPERIMENTAL false` SLSA 1.2 L2 note | Unsigned images violated SLSA 1.2 | Signed `vaeloom/api:sha` + `sbom-*.spdx.json` attestation | Sec/Platform | N/A | `cosign verify` | Remove sign steps |
| CHG-P16-05 | Verify `infra/terraform/main.tf:1` 12 modules + `provider.tf:1` s3+DDB + `variables.tf:1` env 3 AZ + `modules/*/main.tf` 36 files + env tfvars | P15 had IaC but not gated via CI; P16 gates `terraform validate` + `plan -out=tfplan` artifact | 12 modules valid, s3 backend encrypt | Cloud Arch/SRE | N/A | `terraform validate` + `plan` | `terraform destroy` staging |
| CHG-P16-06 | Verify `docker-compose.prod.yml:1` nginx 1.27-alpine healthchecks + resources vs `docker-compose.yml:1` dev parity | Prod had no nginx + no resources; P16 adds parity + healthchecks | 228 vs 149 lines, healthchecks 10-30s, resources 0.5-2cpu | Platform/SRE | N/A | `compose config` valid + `up --wait` | Revert compose |
| CHG-P16-07 | Verify `infra/docker/api.Dockerfile:1` 29 lines 4-stage cache mount + `web.Dockerfile:1` standalone + `infra/kubernetes/apps/*` 22 apps 60 yamls `replicas:3 RollingUpdate 1/0` | Docker multi-stage not yet evidenced via CI; P16 adds `docker-build.yml` buildx gha cache | buildx cache gha + ECR sha tags | Platform | N/A | `docker-build` matrix PASS | Single-stage fallback |
| CHG-P16-08 | Add `deploy.yml:103` `load-test-gate` `grafana/k6-action v0.3.1` 10VUs30s `testing/performance/k6-script.js` gates `needs: build-and-push` before `deploy` | No perf gate on deploy; P16 adds p95<500 blocks bad rollout | k6 p95 115ms gates deploy, wait 300s, undo on fail | Perf/SRE | N/A | `k6` PASS | Remove gate |

## Future-Readiness Backlog

| Idea | Evidence | Target Users | Dependencies | Security/Privacy | Cost | Validation Experiment | Adoption Trigger | Owner | Sunset |
|---|---|---|---|---|---|---|---|---|---|
| Terraform `apply` to staging + `kubectl apply -k` live | `plan` artifact only, no live apply | All | AWS staging `role-to-assume` OIDC | RLS fail-closed, KMS | Medium | `terraform apply tfplan` + `kubectl apply -k base` + `wait 300s` | Pre-P17 ops | Platform | When staging live |
| SLSA L3 hermetic + builder attest | L2 note only EXC-P16-04 | All | `slsa-framework/slsa-github-generator` + `buildx provenance` | Sigstore fulcio | Low | `slsa-github-generator ./api` + `cosign verify-attestation --type slsaprovenance` | Cost <$0.01/1k | Sec | P17 |
| Chaos 10-fault inventory + EKS node drain | 5 faults `chaos-config.yaml:1` EXC-P16-03 | SRE | `testing/chaos/README.md` + `chaos-mesh` | No PII | Low | `chaos-config.yaml` 5→10 + `kubectl drain` | Pre-ship | SRE | Ship |
| `playwright-axe` all routes live Web | 5 pages spot-check only | All | `axe-core/puppeteer` live Web `a11y-audit.yml` | A11y | Low | `audit-pages.ts` 5→all routes `pnpm test -- visual` | Pre-ship | A11y | Ship |
| Per-file lift `webhook_service.py` 68→80% | EXC-P16-01 per-file gaps | QA | `apps/api/tests/test_webhook_perf.py` | No PII | Low | `pytest --cov` per-file 68→80 | P17 | QA | P17 |
| Starlette 1.3.1 when fastapi≥0.142 | Keep 0.50 EXC-P16-02 | All | fastapi 0.142 release | CSP/rate-limit | Low | `pip-audit` clean | Compat | AppSec | When compat |
| Pre-commit gitleaks hook | Fetch0 scan only ASM-P16-08 | All | `pre-commit` + `gitleaks protect` | Secrets | Low | `pre-commit run --all` | Pre-ship | Sec | Ship |
| Queue/model retrieval cost split 50 RPS | 60% headroom at 20 RPS | Scale | Model cost trigger | BYOK | Medium | `capacity-model.md` 50 RPS sustained → split | p95>300ms 5m + cost>$50/mo | Arch | 50 RPS |
