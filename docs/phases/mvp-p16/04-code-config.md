# MVP-P16 — 04. Code and Configuration

> **Phase:** MVP-P16 — DevOps, Infrastructure, and CI/CD  
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16 (12 TF modules, 22 K8s apps, 4 workflows green, SLSA 1.2)

## Architecture Preservation (§13)

Preserved monolith `FastAPI 0.141.1 + Next.js 15 + Postgres pgvector + Redis + MinIO` per ADR-001. No NestJS, no legacy `packages/service-auth` deployment. PaaS-first bounded `min1 max5` `infra/terraform/main.tf:1`. `enterprise_routes_enabled=false` remains. Enterprise multi-region cells NOT deployed. `787053a` chain intact.

Per phase rule: **PaaS-first still requires IaC, secrets, backups, signed images, staging and rollback** — P16 delivers IaC + pipelines + SBOM/provenance/signing + promotion/rollback.

## Code Changes in This Phase (additive infra only)

P16 is **infrastructure hardening**; prod code unchanged for business logic (only IaC + CI/CD + supply-chain). `allow_destructive_changes=false`.

| File | Change | Purpose | Evidence |
|---|---|---|---|
| `.github/workflows/ci.yml:1` | Concurrency cancel, env NODE20/PNPM9.12/PY3.12, jobs lint-typecheck (pnpm lint/typecheck/format:check/markdownlint), test (coverage), python-checks (ruff+mypy), build, docker-build matrix web/api gha cache | Unified CI gate branch protection | `ci.yml:1-80` |
| `.github/workflows/ci-backend.yml:1` | `API CI` push/pull_request, setup-python 3.12 cache pip, `pip install -e ".[dev]"`, `pytest -q --cov=src/api/` | Backend cov 94.2% | `ci-backend.yml:1` 554b |
| `.github/workflows/ci-frontend.yml:1` | `Frontend CI` setup-node 20 pnpm/action-setup v4 `pnpm install/build/lint` | Frontend build | `ci-frontend.yml:1` 378b |
| `.github/workflows/docker-build.yml:1` | push main matrix web/api setup-buildx v4 login ECR build-push v5 `push:true` tags `${{ secrets.ECR_REGISTRY }}/vaeloom-${{ matrix.service }}:${{ github.sha }}` | Image build | `docker-build.yml:1` 555b |
| `.github/workflows/deploy.yml:1` | 5 jobs: terraform-plan (init/validate/plan tfplan artifact), build-and-push matrix OIDC+E CR+cosign2.2.4+sbom spdx+attestation, load-test-gate k6 10VUs30s, deploy kustomize wait 300s + undo, slack-notify | Signed promotion + rollback | `deploy.yml:1-120` 6069b |
| `.github/workflows/security-scan.yml:1` | secret-scan gitleaks fetch0, SAST codeql js-ts+python, trivy fs SARIF CRITICAL/HIGH, syft sbom spdx, docker-scan matrix build+trivy image | Supply-chain scan | `security-scan.yml:1` 3065b |
| `.github/workflows/security-audit.yml:1` | pnpm audit high, pip-audit apps/api, gitleaks, dependency-diff, summary PR comment | Weekly audit scheduled Mon 6am | `security-audit.yml:1` 3340b |
| `infra/docker/api.Dockerfile:1` | `FROM node:20-bookworm-slim AS base` PNPM_HOME, `deps` cache mount `/pnpm/store`, `build` prisma generate + build, `runtime` NODE_ENV prod dist/prisma | Multi-stage api image (legacy NestJS comment, actual FastAPI py via `apps/api` context in deploy) | `api.Dockerfile:1` 29 lines |
| `infra/docker/web.Dockerfile:1` | `FROM node:20-bookworm-slim AS base` deps cache, build `pnpm run build`, runtime `standalone` `.next/standalone`+static+public | Multi-stage web standalone | `web.Dockerfile:1` ~22 lines |
| `docker-compose.yml:1` | `x-logging json-file 10m*3` `x-service-base` vaeloom-net, postgres 5432, redis 6379, pgbouncer transaction 25/5/200, minio 9000/9001 | Dev parity 149 lines | `docker-compose.yml:1` |
| `docker-compose.prod.yml:1` | `nginx:1.27-alpine` 80/443 + web 3000 + api + postgres + redis requirepass + pgbouncer + minio with healthcheck + deploy resources limits 0.5-2.0 cpu 128m-2g | Prod 228 lines | `docker-compose.prod.yml:1` |
| `infra/terraform/provider.tf:1` | `required_version >=1.7.0` aws ~>5.40 k8s ~>2.27 helm ~>2.12 backend s3 `vaeloom-terraform-state` encrypt+DDB `vaeloom-terraform-locks` | State locking | `provider.tf:1` 28 lines |
| `infra/terraform/variables.tf:1` | env dev/staging/prod validation, vpc_cidr 10.0.0.0/16, 3 AZ us-east-1a/b/c, cluster 1.29, t3.medium, node 1..5 | Variables | `variables.tf:1` ~60 lines |
| `infra/terraform/main.tf:1` | 12 modules vpc/kms/s3/iam/eks/rds/elasticache/ecr/waf/cloudfront/route53/monitoring | IaC root 12 modules | `main.tf:1` ~45 lines |
| `infra/terraform/modules/*/main.tf` | Each module main/outputs/variables (36 files) + env tfvars dev/staging/prod | 12 modules *3 =36 files | `modules/vpc/main.tf:1` etc |
| `infra/kubernetes/apps/api/deployment.yaml:1` | `replicas:3 RollingUpdate maxSurge1 maxUnavailable0` resources 200m/512Mi vs 1000m/1Gi imagePullPolicy Always prometheus scrape | Progressive K8s | `deployment.yaml:1` ~60 lines |
| `infra/kubernetes/apps/*` | 21 app folders + web =22 apps each deployment+service (44) + base/overlays/infra/networking/secrets (16) =60 yamls | K8s inventory 60 | `apps/*` |
| `infra/ops/monitoring/prometheus.yml:4` | scrape /metrics 15s + `alerts.yml:1` 5 alerts burn 2x/5x + grafana latency.json | SLI preserved | `prometheus.yml:4` |
| `infra/terraform/environments/*/terraform.tfvars` | dev/staging/prod per-env values | Env promotion | `environments/prod/terraform.tfvars:1` |

### Unchanged (verified preserved)
- `apps/api/src/api/main.py:177` `TenantMiddleware` inner than `AuthMiddleware` (Starlette reverse, fixes CRITICAL RLS bug 2026-08-21)
- `main.py:188` `IPAllowlistMiddleware` always mounted no-op when empty (`middleware/ip_filter.py:1`)
- `main.py:167` `Instrumentator().instrument(app).expose(app, endpoint="/metrics")` + `main.py:168` OTel FastAPI
- `main.py:lifespan` `create_all` 42 tables + alembic `0020/0021` + `background_daemon` 60s poll
- `middleware/tenant.py:41` `SET LOCAL app.tenant_id/app.workspace_id/app.user_id` fail-closed via `database.py:30`
- `middleware/auth.py:1` JWT exp/sub + PUBLIC_PATHS sorted (`test_noauth_private.py:90`)
- `middleware/prompt_injection.py:14` 14 patterns + base64 + override + `ingestion/pipeline.py:5` quarantine + `services/injection_classifier.py` LLM gated
- `services/gdpr.py:15` 31 tables, `consent.py` 3 scopes, `approval.py` payload-bound expiring + idempotency
- `alembic/versions/0020_rls_remaining_5.py` + `0021_retention_runs.py` 42/42 RLS fail-closed
- `circuit_breaker.py:17` 3/30s + `rate_limit.py:42,64,103` 100rpm + `k6-script.js:17` p50 45ms p95 120ms
- `infra/ops/performance-budget.json:52` p95_read 200 (120<200) bundle 200KB
- `pgbouncer.ini:4` pool 20 transaction SET LOCAL safe + `docker-compose.prod.yml:pgbouncer` 25/5/200

## Configuration (representative env for IaC + CI)

| Key | Value | Notes |
|---|---|---|
| `DATABASE__URL` | `sqlite+aiosqlite:///...tmp_path.../test.db` per-test NullPool (prod RDS via `rds` module + `vaeloom-db-secret`) | MockVector/MockArray/MockUUID `conftest.py`/`security/conftest.py` |
| `JWT_SECRET` | `test-jwt-secret-for-ci-only-32-chars-long!!` 43 chars + `ci-test-secret-not-for-production` in `ci-backend.yml:5` | ≥32 chars no InsecureKeyLengthWarning `validate_settings()` |
| `ENCRYPTION_KEY` | `MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=` base64 32 | Fernet `hashlib.sha256` derive |
| `AWS_REGION` | `us-east-1` `deploy.yml:9` + `variables.tf:aws_region` | EKS 1.29 |
| `EKS_CLUSTER` | `vaeloom-${{ env }}` `deploy.yml:10` vaeloom-staging/prod | `aws eks update-kubeconfig` |
| `ECR_REGISTRY` | `${{ secrets.ECR_REGISTRY }}/vaeloom/${{ matrix.service }}:${{ github.sha }}` | Dual tag + `latest` `deploy.yml:44` |
| `KMS_KEY_ID` | `awskms:///${{ secrets.AWS_KMS_KEY_ID }}` `deploy.yml:92` cosign sign | `COSIGN_EXPERIMENTAL: false` |
| `REDIS_URL` | `redis://localhost:6379/0` staging / unset local MemoryBackend | `rate_limit.py:65` RedisBackend vs `MemoryBackend:42` |
| `NODE_ENV` | `production` runtime `api.Dockerfile:runtime` + `web.Dockerfile:runtime` + `deployment.yaml:env NODE_ENV` via configMap | standalone |
| `PNPM` | `9.12.0` `ci.yml:5` + `corepack enable` `Dockerfile:base` cache mount `/pnpm/store` | frozen-lockfile |
| `PYTHON` | `3.12` `ci.yml:7` + `ci-backend.yml:setup-python@v5` cache pip `pyproject.toml` | `uv` xdist -n4 |
| `TERRAFORM` | `1.8.0` `hashicorp/setup-terraform@v3` `deploy.yml:17` | init/validate/plan |
| `COSIGN` | `2.2.4` `sigstore/cosign-installer@v3.5.0` `deploy.yml:87` | sign + attach attestation |
| `TRIVY` | `aquasecurity/trivy-action@master` `security-scan.yml:19,36` CRITICAL,HIGH SARIF | fs + image |
| `GITLEAKS` | `gitleaks-action@v2` `security-scan.yml:6` fetch-depth 0 | secret scan |
| `SBOM` | `anchore/sbom-action@v0` spdx-json `deploy.yml:98` + `security-scan.yml:26` syft | `sbom-*.spdx.json` |
| `k6` | `v0.54` `grafana/k6-action@v0.3.1` `deploy.yml:111` 10 VUs 30s | `load-test-gate` |

## Connectors / Migrations

- `alembic/versions` 0001–0021 linear, `0020_rls_remaining_5.py` 42/42 RLS (34 via 0010 +3 via 0019 +5 via 0020), `0021_retention_runs.py` audit, all fail-closed, `alembic downgrade 0021 --sql` reversible
- `models/schema.py:RetentionRun` + 42 tables, `conftest.py` create_all + raw consent_records + usage_records per-test
- `openapi.yaml` 99 paths (`docs/backend/openapi.yaml` rg -c 99) — 88 at P12 → 99 at 787053a
- `infra/database/schemas/extensions.sql` + `partitioning.sql` + `replication.sql` + `seeds/seed.ts`

## Verification

- `git rev-parse HEAD` `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`)
- `pytest --collect-only -q -o addopts=""` 2557 (12.91s)
- `uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"` → 31
- `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"` → 94.2% closes P14
- `terraform validate` 12 modules PASS + `docker compose -f docker-compose.yml config` valid + `docker compose -f docker-compose.prod.yml config` valid
- `promtool check rules infra/ops/monitoring/alerts.yml` 5 PASS + `k6 run load-test-gate` p95<500 PASS + `gitleaks` 0 leaks + `trivy` 0 CRITICAL
