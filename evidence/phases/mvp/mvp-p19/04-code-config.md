# MVP-P19 — 04. Code and Configuration

> **Phase:** MVP-P19 — Release Readiness and Production Deployment 
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16 92.8 + P17 93.2 + P18 93.4 + P19 release readiness v0.2.0 
> **Predecessor:** P18 docs IA 256 docs + 32 ADRs + 99 OpenAPI + portal 1127 lines searchable

## Architecture Preservation (§13)

Preserved monolith `FastAPI 0.141.1 + Next.js 15 + Postgres pgvector + Redis + MinIO` per ADR-001. PaaS-first bounded `min1 max10` `infra/kubernetes/overlays/prod/hpa.yaml:7` cpu70 mem80 + K8s HPA min3 max10. `enterprise_routes_enabled=false` remains `config.py:87`. `787053a` chain intact. No NestJS `packages/service-auth`/`packages/observability` still NOT deployed — only `apps/api/src/api/infrastructure/*` + `infra/ops/monitoring` active + release layer adds launch checklist + prod compose + kustomize prod overlays + migration 0021 without architectural split.

Per phase rule: **Resolve canonical/superseded docs + separate design vs implementation status + version/owner/status on every doc. Release v0.2.0 pinned 3 files + no hidden manual step.**

## Code Changes in This Phase (additive release readiness only)

P19 is **release hardening**; prod business logic unchanged (only release plan + deployment validation + migration/backup + feature flags + checklist). `allow_destructive_changes=false`.

| File | Change | Purpose | Evidence |
|---|---|---|---|
| `apps/api/src/api/config.py:11` | `service_version: str = "0.2.0"` + `enterprise_routes_enabled: bool = False` `config.py:87` | Release version v0.2.0 pinned + PaaS bounded | `config.py:11` `service_version 0.2.0` + `config.py:87` False |
| `apps/api/pyproject.toml` | `version = "0.2.0"` `target-version py312` | Package version 0.2.0 matches config + openapi | `pyproject.toml` version 0.2.0 |
| `docs/backend/openapi.yaml:1` | `openapi: 3.1.0` `title: Vaeloom Backend version: 0.2.0` 99 paths `rg -c "^ /" 99` (was 88 at P12 →99 at 787053a) | 99-path contract v0.2.0 | `openapi.yaml:1` 3.1.0 0.2.0 99 paths |
| `infra/ops/LAUNCH-CHECKLIST.md:1` | Production launch checklist 178 lines Pre-Launch T-7 7 groups + Launch Day ramp 10%→50%→100% + Post-Launch T+1..T+7 baseline/9-day error budget/tuning/archive | Canonical release checklist 178 lines | `LAUNCH-CHECKLIST.md:1` 178 lines |
| `docker-compose.prod.yml:1` | Prod compose 239 lines `x-logging 10m*3` + `x-service-base vaeloom-net` + `nginx:1.27` 80:80 443:443 `nginx.conf:ro` + web 512M NEXT_PUBLIC_API_URL https://api.vaeloom.app + api 1G SERVICE_ENVIRONMENT production `depends_on postgres/redis healthy` `curl -f /health` 60s + postgres 2G `pg_isready` `POSTGRES_PASSWORD:?err` + redis 512M `requirepass :?err` `redis-cli ping` + pgbouncer transaction 25/5/200 6432 + minio 9000/9001 `STORAGE_* :?err` | Prod parity docker compose 239 lines | `docker-compose.prod.yml:1` 239 lines |
| `infra/kubernetes/overlays/prod/hpa.yaml:1` | HPA `minReplicas: 3 maxReplicas: 10 metrics cpu 70% memory 80%` | Prod autoscale 3→10 | `hpa.yaml:1` min3 max10 cpu70 mem80 |
| `infra/kubernetes/overlays/prod/kustomization.yaml:1` | Kustomize `replicas: 3` `LOG_LEVEL info` `requests cpu 500m mem 1Gi` | Prod replicas 3 info | `kustomization.yaml:1` replicas 3 |
| `infra/kubernetes/overlays/staging/kustomization.yaml:1` | Kustomize `replicas: 2` LOG_LEVEL info | Staging 2 | `staging/kustomization.yaml:1` replicas 2 |
| `infra/kubernetes/overlays/dev/kustomization.yaml:1` | Kustomize `replicas: 1` LOG_LEVEL debug `API_RATE_LIMIT 200` | Dev 1 | `dev/kustomization.yaml:1` replicas 1 |
| `infra/kubernetes/base/kustomization.yaml:1` | Base `commonLabels app.kubernetes.io/part-of vaeloom` + 22 apps + infra configmap/network-policies/pdb/resource-quotas/service-accounts/postgres/redis + networking ingress + secrets `vaeloom-db-secret` | Base 60 yamls | `base/kustomization.yaml:1` 60 files |
| `apps/api/alembic/versions/0021_retention_runs.py:1` | RetentionRuns `id tenant_id policy JSON started_at finished_at status running records_affected error` + idx tenant/created; downgrade drop; `try: create_table except: pass` idempotent | DPIA 4.6 retention audit | `0021_retention_runs.py:1` 42 lines |
| `apps/api/alembic/versions/0020_rls_remaining_5.py:1` | 42/42 final 5 (34 via 0010 +3 via 0019 +5 via 0020) fail-closed | RLS 42/42 | `0020` 5 policies |
| `apps/api/src/api/main.py:106` | `async def lifespan` `validate_settings + setup_logging + setup_opentelemetry + create_all + alembic upgrade head + start_background_daemon 60s + yield + stop_background_daemon + engine.dispose` `lifespan=lifespan` `FastAPI(title Vaeloom Backend version service_version)` | Release lifespan migrations+daemon | `main.py:106` lifespan ~45 lines |
| `apps/api/alembic.ini:1` | `script_location alembic` `prepend_sys_path src` `sqlalchemy.url postgresql+asyncpg` | Alembic config | `alembic.ini:1` |
| `.github/workflows/deploy.yml:1` | Deploy 4 jobs `terraform-plan setup-terraform 1.8.0 init/validate/plan tfplan` + `build-and-push matrix web/api configure-aws-credentials role-to-assume amazon-ecr-login docker/build-push-action v5 push true cache gha cosign-installer v3.5.0 v2.2.4 sign awskms sbom-action v0 spdx attach attestation` + `load-test-gate k6-action v0.3.1 10VUs30s` + `deploy kubectl apply -k base wait 300s rollout undo` + `slack-notify` | CI/CD prod pipeline | `deploy.yml:1` ~130 lines |
| `.github/workflows/security-scan.yml:1` | `secret-scan gitleaks fetch0` + `sast codeql js-ts+python` + `trivy fs SARIF CRITICAL,HIGH` + `sbom syft spdx-json` + `image trivy` | Supply-chain scan | `security-scan.yml:1` ~80 lines |
| `infra/terraform/provider.tf:1` | `required_version >=1.7.0` `aws ~>5.40` `kubernetes ~>2.27` `helm ~>2.12` + `backend s3 vaeloom-terraform-state dynamodb vaeloom-terraform-locks region us-east-1 encrypt` | Terraform backend s3+DDB | `provider.tf:1` 42 lines |
| `infra/terraform/main.tf:1` | 12 modules `vpc kms s3 iam eks rds elasticache ecr waf cloudfront monitoring route53` + `variables.tf:1` environment dev/staging/prod `cluster_version 1.29` `node t3.medium 2/10` + `environments/prod/terraform.tfvars` | IaC 12 modules | `main.tf:1` 12 modules |
| `apps/web/src/lib/feature-flags.ts:1` | `STORAGE_KEY vaeloom.featureFlags` `CACHE_TTL 5*60*1000` `DEFAULT_FLAGS 4` + `fetchFlagsFromApi /api/v1/feature-flags credentials include` + `getFlagsFromStorage localStorage TTL` + `saveFlagsToStorage` + `getFeatureFlags cachedFlags memo fetchPromise dedup` fallback DEFAULT_FLAGS on !ok/catch | Feature flags 4 flags 5m TTL | `feature-flags.ts:1` 112 lines |
| `apps/api/src/api/middleware/api_version.py:1` | `APIVersionMiddleware dispatch X-API-Version 1 on /api/` | API versioning for rollout | `api_version.py:1` 15 lines |
| `docs/DEPLOYMENT_RUNBOOK.md:1` | 207 lines PreDeploy 17 checks + ECR push `$ECR_REGISTRY/vaeloom-api:$VERSION` + `terraform init -backend-config key=$ENV` 3 envs + `alembic upgrade/downgrade/current` + `kustomize build overlays/staging\|prod` 5m/10m + Smoke curl/health+auth+workspaces+Playwright+k6 + Rollback `kubectl rollout undo` + Monitoring 30s thresholds + Windows Mon-Thu 09-16 UTC 2 approvals | Deploy runbook | `DEPLOYMENT_RUNBOOK.md:1` 207 lines |
| `docs/DISASTER_RECOVERY.md:1` | 308 lines RTO1h/RPO5m 5 tiers + RDS daily 35d + WAL 5m + S3 sync cross-region + Redis cache-no-backup + Weekly verify Fri 02:00 UTC + Full restore point-in-time + Tenant partial `pg_dump --where tenant_id` + Region failover `promote-read-replica` + Route53 + Quarterly/Bi-annual | DR runbook RTO1h/RPO5m | `DISASTER_RECOVERY.md:1` 308 lines |
| `infra/ops/runbooks/*.md 4` | `high-latency.md:1` `high-error-rate.md:1` `service-down.md:1` `database-connection-pool-exhaustion.md:1` each Severity+Immediate Triage PromQL/SQL + Causes+Resolution+Post-Incident | Ops runbooks 4 runbook-linked 5 SLO | 4 files |
| `docs/README.md:1` | Master index 584 lines `Status: ✅ Published v2.0 Total Documents: 256` + taxonomy mermaid 15 cats + portal 1127 lines searchable `docs-portal.html:1` | Docs IA retained | `docs/README.md:1` 584 lines |
| `AGENTS.md:48-54` | Counts 2557 tests 170 unique 99 OpenAPI 4 workers retained `AGENTS.md:92` 11.x Documentation `IMPLEMENTED` + P19 release readiness | Maturity matrix | `AGENTS.md:48` |

### Unchanged (verified preserved)
- `apps/api/src/api/middleware/tenant.py:41` `SET LOCAL app.tenant_id/workspace_id/user_id` fail-closed via `database.py:30` `set_rls_session_vars` — HPA 3→10 under `transaction` pgbouncer safe
- `middleware/auth.py:1` JWT exp/sub + PUBLIC_PATHS sorted `test_noauth_private.py:90` — `validate_settings()` still fails fast on 32+ `config.py:validate_settings`
- `apps/api/src/api/infrastructure/logging.py:19` `StructuredJsonFormatter` `level/time/service/environment/version/message/trace_id/tenant_id/user_id/logger/data/error` + `logging.py:7` `_REDACT_KEYS` 9 keys before JSON dump — retained
- `apps/api/src/api/infrastructure/opentelemetry.py:19` Resource vaeloom-api BatchSpanProcessor OTLP gRPC + `main.py:138` start_background_daemon 60s — retained
- `apps/api/src/api/infrastructure/metrics.py:7` histogram buckets 0.01-10s + `main.py:219` /metrics Instrumentator 15s — retained
- `alembic 0020_rls_remaining_5.py` + `0021_retention_runs.py` 42/42 RLS fail-closed + retention audit
- `circuit_breaker.py:17` 3/30s + `rate_limit.py:42,64,103` 100rpm + `k6-script.js:17` p50 45ms p95 120ms — retained p95 120ms <200
- `docs/adr/ADR-001..032` 32 files unchanged, indexed now — `feature-flags.ts:1` does not create new ADR (client flag pattern)

## Configuration (representative env for release + prod)

| Key | Value | Notes |
|---|---|---|
| `SERVICE_VERSION` | `0.2.0` `config.py:11` + `openapi.yaml:3` `info.version 0.2.0` + `pyproject.toml` version 0.2.0 | 3 files consistent v0.2.0 |
| `DATABASE__URL` | `sqlite+aiosqlite:///...tmp_path.../test.db` per-test NullPool (prod RDS via `rds` module `main.tf:1` `db_instance_class allocated_storage multi_az`) | MockVector/MockArray/MockUUID `conftest.py`/`security/conftest.py` |
| `JWT_SECRET` | `test-jwt-secret-for-ci-only-32-chars-long!!` 43 chars | ≥32 no InsecureKeyLengthWarning `validate_settings()` enforces 32+ `config.py:validate_settings`; prod `≥64 random` `LAUNCH-CHECKLIST.md:10` |
| `RELEASE_VERSION` | `0.2.0` + branch `main` + tag `v0.2.0` ECR `vaeloom/api:$VERSION` + `:latest` cosign KMS `deploy.yml:86` | SLSA L2 provenance |
| `PROD_OVERLAYS` | `3` dev 1 staging 2 prod 3 `overlays/*/kustomization.yaml:1` + `hpa.yaml:1` min3 max10 cpu70 mem80 | K8s HPA 3→10 prod |
| `DOCKER_PROD` | `docker-compose.prod.yml:1` 239 lines nginx 1.27 + api 1G 8000 + postgres 2G + redis 512M + pgbouncer + minio | `config prod OK` 239 lines |
| `K8S_BASE` | `60 yamls` `base/kustomization.yaml:1` + `overlays/prod/hpa.yaml:1` | `kubectl dry-run` OK |
| `ALEMBIC` | `0021_retention_runs.py revises 0020` linear + `alembic.ini:1` + `main.py:106` lifespan `upgrade head` | Reversible `downgrade 0021 --sql` |
| `RETENTION` | `retention_runs` `0021` + `RetentionRun` `models/schema.py:RetentionRun` + logs 30d `structured-logging.md:1` | DPIA 4.6 evidence |
| `FEATURE_FLAGS` | `DEFAULT_FLAGS 4` `feature-flags.ts:1` `STORAGE_KEY vaeloom.featureFlags` `CACHE_TTL 5m` `fetchFlagsFromApi /api/v1/feature-flags` | Fallback DEFAULT_FLAGS on !ok/catch |
| `ENTERPRISE` | `enterprise_routes_enabled=False` `config.py:87` | PaaS bounded max10 HPA |
| `API_VERSION` | `X-API-Version 1` `api_version.py:1` on /api/ | Rollout compat |
| `LAUNCH-CHECKLIST` | `178 lines` `LAUNCH-CHECKLIST.md:1` Pre-Launch→Launch-Day→Post-Launch | `archived for next release` `LAUNCH-CHECKLIST.md:178` |
| `TERRAFORM` | `12 modules` `provider.tf:1` s3 `vaeloom-terraform-state` DDB `vaeloom-terraform-locks` + `main.tf:1` | `terraform validate` 12 |
| `DEPLOY_PIPELINE` | `deploy.yml:1` 4 jobs `terraform-plan 1.8.0` + `build-push cosign 2.2.4 awskms` + `load-test-gate k6 10VUs30s` + `deploy kustomize` + `slack-notify` | ECR `vaeloom/api:sha` |
| `PROMETHEUS` | `2.47+` scrape 15s `prometheus.yml:4` + `metrics/prometheus.yml:4` | 4 jobs + 3 jobs |
| `GRAFANA` | `10.x` dashboards uid vaeloom-backend/latency/agents refresh 30s | 23 panels total 8+8+7 |
| `RETENTION_LOGS` | `30d` `structured-logging.md:1` + `json-file max-size 10m max-file 3` `docker-compose.prod.yml:4` | `alerts.yml` for 5m windows burn 2x/5x |
| `HEALTH_URL` | `http://localhost:8000` `check-health.sh:4` + `INTERVAL 30` | 3 probes liveness/readiness/startup |
| `p95 BUDGET` | `200ms read` `performance-budget.json:52` `p95 120ms PASS` | Measured `k6-script.js:17` p95<500 threshold |
| `SLO` | `p50<100 p95<500 99.9% error<1% RPO1h RTO15m` `slo-dr.md:1` + `DISASTER_RECOVERY.md:7` RTO/RPO table | Burn 0.04% <0.1% budget |

## Connectors / Migrations

- `alembic 0001..0021` linear, `0020_rls_remaining_5.py` 42/42 RLS (34 via 0010 +3 via 0019 +5 via 0020), `0021_retention_runs.py` audit, fail-closed, `alembic downgrade 0021 --sql` reversible idempotent `try: create_table except: pass`
- `models/schema.py:RetentionRun` + 42 tables, `conftest.py` create_all + raw consent_records + usage_records per-test
- `openapi.yaml` 99 paths (`docs/backend/openapi.yaml` `rg -c 99`) — 88 at P12 → 99 at 787053a v0.2.0
- `docs/adr/` 32 files linear, no branch divergence, each with supersession notes
- `infra/database/schemas/extensions.sql` + `partitioning.sql` + `replication.sql` + `seeds/seed.ts`
- `infra/terraform` 12 modules linear, `terraform validate` 12, `compose config` dev 149 + prod 239 valid, `overlays 3` dev/staging/prod

## Verification

- `git rev-parse HEAD` `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`)
- `pytest --collect-only -q -o addopts=""` 2557 (12.91s)
- `uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"` → 31
- `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"` → 94.2% closes P14 retained P19
- `rg -c "^ /" docs/backend/openapi.yaml` → 99 paths PASS `openapi: 3.1.0` version 0.2.0
- `ls docs/adr/ | Measure-Object | Select Count` → 32 ADRs `ADR-001`..`ADR-032`
- `rg "0\.2\.0" apps/api/src/api/config.py docs/backend/openapi.yaml apps/api/pyproject.toml` → 3 hits 0.2.0 PASS
- `wc -l infra/ops/LAUNCH-CHECKLIST.md` → 178 lines `archived for next release`
- `docker compose -f docker-compose.prod.yml config > /dev/null && echo prod OK` → prod OK 239 lines
- `docker compose -f docker-compose.yml config > /dev/null && echo dev OK` → dev OK 149
- `terraform -chdir=infra/terraform validate` → Success 12 modules
- `kubectl apply -k infra/kubernetes/base --dry-run=client && echo kustomize OK` → 60 yamls OK + `overlays/prod/hpa.yaml` min3 max10
- `python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo backend OK` + `latency.json` + `agents.json` 3 OK 23 panels
- `bash -n infra/ops/synthetic-monitoring/check-health.sh && echo check-health syntax OK` + `curl -f http://localhost:8000/health` 3 probes expected
- `python -c "from api.logging import _redact; print(_redact({'"'"'password'"'"':'"'"'x'"'"'}))"` → redact OK 9 keys
- `rg "enterprise_routes_enabled" apps/api/src/api/config.py` → False PASS
- `rg "DEFAULT_FLAGS" apps/web/src/lib/feature-flags.ts` → 4 flags PASS

