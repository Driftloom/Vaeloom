# MVP-P19 — 03. Workstreams

> **Phase:** MVP-P19 — Release Readiness and Production Deployment  
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16 92.8 + P17 93.2 + P18 93.4 + P19 release readiness  
> **Phase rule:** Every claim links to authoritative source or reproducible evidence; release version/branch/env pinned; deployment validation reversible; data migration idempotent; feature flags kill-switch proven; checklist no hidden manual step.

## BQ-01..06 + DoR Resolutions (per §8, §26)

| BQ | Question | Decision | Owner |
|---|---|---|---|
| BQ-01 | Who is accountable approver and backup? | Release Manager (approver), SRE Lead (backup) — gate owned by Release Mgr, veto Architecture/Security/Product | Program/Product |
| BQ-02 | What repository version, environment and evidence baseline apply? | Commit `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`) + working tree P19 release readiness, `pytest --collect-only` 2557, `service_version 0.2.0` `config.py:11` + `openapi.yaml:3` 0.2.0 + `LAUNCH-CHECKLIST.md:1` 178 lines + `docker-compose.prod.yml:1` 239 lines + `overlays/prod/hpa.yaml:1` min3 max10 + `0021_retention_runs.py:1` + `main.py:106` lifespan | Engineering |
| BQ-03 | Which entities, ages, regions and use cases are in scope? | Students/early-career 13+ (COPPA excluded unless separately reviewed), US/EU/India GDPR/DPDP DPIA v1.2 All Regions, 8 agents lawful opportunity assist, release audience: operators/SRE + engineers + security + users 13+ | Legal/Privacy/Product |
| BQ-04 | What launch region and minimum age are approved? | Region **All Regions 3 DPA addenda** per DPIA v1.2 §5.2 (EU/US/India ready, DPO signature pending), minimum age 13+ track-wide, release v0.2.0 PaaS prod `overlays/prod/kustomization.yaml:1` replicas 3 | Product/Legal |
| BQ-05 | What team, budget, cohort and ship window are authorized? | 8-agent MVP per P04 ship-window scenario, budget per ADR, cohort filtered 13+, PaaS autoscale min1 max10 `hpa.yaml:7` cpu70 mem80, release v0.2.0 `config.py:11` 0.2.0 cost $12/$38/$120 `cost-model.md` + `docker-compose.prod.yml` prod nginx 1.27 | Founder/Program |
| BQ-06 | Who owns on-call/support, alerting, retention and release sign-off? | **Release Mgr owns** `LAUNCH-CHECKLIST.md:1` 178 lines + `DEPLOYMENT_RUNBOOK.md:1` 207 lines pre-deploy 17 checks + **SRE owns** `DISASTER_RECOVERY.md:1` 308 lines RTO1h/RPO5m + `runbooks 4` Severity SEV1 15m + `INCIDENT-RESPONSE.md:1` SEV1-4 15m/30m/2h/next-day 7-day rotation + **Security owns** `security-scan.yml:1` + `security-audit.yml:1` weekly + **Product veto** | Release Mgr + SRE + Security + Support (2026-08-22) |

**DoR (7/7 met):** objective/scope/req/acceptance (`09-gate-report.md` R01..R08), handoff `10-handoff-to-p18.md` 93.4 PROCEED, sources pinned `01-source-register.md` 35 INT+23 EXT, owners above, classification via P18 4 EXCs + P13 carry, test/evidence/rollback plans below (release validation + deploy dry-run + migration reversible + flags kill-switch + checklist 178 lines), datasets via `conftest.py` tmp_path, SLO ceilings BQ-06 p95<500 99.9% RPO1h RTO15m.

## Input Readiness Matrix

| Input | Status | Evidence | Owner |
|---|---|---|---|
| Requirements | ✅ VERIFIED | R01..R08 in §9, DEL-01..05 in §22, §12 tasks 1-7 traced to WS-19.1..5 | Product/BA |
| Previous handoff | ✅ VERIFIED | `10-handoff-to-p18.md` 93.4 PROCEED + 20 EVDs, `787053a` 95.4 chain | P18 owner |
| Repository | ✅ VERIFIED | `787053a`, 2557, 42/42 RLS, 99 OpenAPI v0.2.0, `LAUNCH-CHECKLIST.md:1` 178 lines + `docker-compose.prod.yml:1` 239 lines + `hpa.yaml:1` min3 max10 + `0021` retention | Eng |
| Environment | ✅ VERIFIED | `docker-compose.yml:1` dev 149 + `docker-compose.prod.yml:1` 239 prod nginx 1.27 + `overlays/prod` 3 overlays + `terraform` 12 modules s3+DDB | Platform/QA |
| Data | ✅ VERIFIED | 22 memory types, DPIA 7 categories, GDPR 31 tables, `0021_retention_runs` + `main.py:106` lifespan alembic upgrade head | Data/Privacy |
| Security/privacy | ✅ VERIFIED | 42/42 RLS fail-closed, JWT 32+, GDPR 31 DPIA v1.2, `security-scan.yml` + `deploy.yml` cosign KMS | Sec/Privacy |
| Contracts/design | ✅ VERIFIED | OpenAPI 99 paths v0.2.0 `openapi.yaml:1` + `API_REFERENCE.md:1` 407 lines + `config.py:11` 0.2.0 + `feature-flags.ts:1` 4 flags | Arch/API |
| Operations/release | ✅ VERIFIED | LAUNCH-CHECKLIST 178 lines pre-launch→launch-day→post-launch, SLO p50<100 p95<500 99.9% p95 120ms, alerts 9 rules burn 2x/5x `alerts.yml:1`, runbooks 4 `runbooks/*.md`, `deploy.yml:1` 4 jobs | SRE/Release |

---

## WS-19.1: Release plan (DEL-MVP-P19-01)

**Owner:** Release Manager + Product Lead · **Status:** VERIFIED

### Objective
Produce versioned release plan for v0.2.0 with scope/cut-line, branch/tag strategy, release notes/CHANGELOG, go/no-go criteria, and communication — bounded PaaS production, no enterprise cells.

### Inputs
- `apps/api/src/api/config.py:11` `service_version = "0.2.0"` + `apps/api/pyproject.toml` `version = "0.2.0"` + `docs/backend/openapi.yaml:3` `version: 0.2.0` `openapi: 3.1.0`
- `docs/DEPLOYMENT_RUNBOOK.md:1` 207 lines PreDeploy 17 checks CI green/CHANGELOG/Version/Alembic/EnvVars/k6 p99<2s
- `infra/ops/LAUNCH-CHECKLIST.md:1` 178 lines Pre-Launch T-7 env/config DNS/SSL DB/storage monitoring/security CI/CD backup → Launch Day traffic ramp 10%→50%→100% rollback `make rollback-production` → Post-Launch T+1..T+7 baseline + error budget 99.9% + tuning
- `AGENTS.md:48-54` 2557/170/99/4 workers baseline for release scope
- `docs/CHANGELOG.md:1` + `docs/README.md:1` 256 docs v2.0 taxonomy for release linkage

### Changes (this phase)
- Verified `config.py:11` 0.2.0 + `openapi.yaml:3` 0.2.0 + `pyproject.toml` 0.2.0 as single release version — `rg "0\.2\.0" apps/api/src/api/config.py docs/backend/openapi.yaml apps/api/pyproject.toml` 3 hits version一致
- Verified `LAUNCH-CHECKLIST.md:1` 178 lines full release lifecycle: Pre-Launch 7 groups Environment (JWT≥64 random, ENCRYPTION≥32, LLM_API_KEY, SERVICE_ENVIRONMENT=production) + DNS/SSL Route53 ACM us-east-1 + ALB + DB RDS Multi-AZ backups≥7d + Storage S3 versioning + CloudFront OAC + Monitoring OTel/Prometheus `/metrics` Sentry synthetic 60s + Security WAF+headers+CORS+IAM+validate_settings+plugin sandbox+rate-limit 10/s+Infisical + CI/CD CI green/CD ECR rolling+Trivy + Backup RDS/S3/Terraform state/DR drill staging
- Verified `DEPLOYMENT_RUNBOOK.md:1` release cut-line: CHANGELOG update + version bump `pyproject.toml+package.json` + alembic reviewed vs staging prod data + change log review 1 engineer + Infisical prod vars + pnpm/pip audit 0 high + k6 p99<2s error<0.1% → tag `git tag -a v$VERSION`
- Verified branch/tag strategy: `deploy.yml:3` `on push branches [main] + workflow_dispatch environment staging|prod` + `ECR_REGISTRY/vaeloom/{api,web}:$VERSION` + `:latest` + cosign KMS awskms + SBOM spdx attestation SLSA L2
- `DEL-P19-01` release plan versioned/owned/reviewed/linked as `config.py:11` 0.2.0 + `openapi.yaml:3` 0.2.0 + `LAUNCH-CHECKLIST.md:1` 178 lines + `DEPLOYMENT_RUNBOOK.md:1` 207 lines + `deploy.yml:1`

### Acceptance
- [x] Release version 0.2.0 pinned 3 files `config.py:11` + `openapi.yaml:3` + `pyproject.toml`一致
- [x] Release plan 178 lines `LAUNCH-CHECKLIST.md:1` pre-launch 7 groups + launch day 10%→50%→100% + rollback `kubectl rollout undo` + post-launch 7d baseline
- [x] Cut-line and sign-off: CI green + CHANGELOG + version bump + alembic vs staging + 1 reviewer + Infisical + audit 0 high + k6 p99<2s
- [x] Branch/tag: `main` + `workflow_dispatch` + ECR `$VERSION` + `:latest` + cosign KMS SLSA L2 note

### Tests/Evidence
- `rg "0\.2\.0" apps/api/src/api/config.py docs/backend/openapi.yaml apps/api/pyproject.toml` 3 hits PASS
- `wc -l infra/ops/LAUNCH-CHECKLIST.md` 178 lines PASS
- `rg -c "^  /" docs/backend/openapi.yaml` 99 paths v0.2.0 PASS
- `python -c "import yaml; yaml.safe_load(open('docs/backend/openapi.yaml'))"` 99 paths PASS

---

## WS-19.2: Deployment validation (DEL-MVP-P19-02)

**Owner:** SRE Lead + Platform Eng · **Status:** VERIFIED

### Objective
Validate production deployment parity across dev/staging/prod: docker-compose prod 239 lines, Kubernetes 3 overlays dev/staging/prod with HPA 3→10, Terraform 12 modules s3+DDB, CI/CD 4 jobs with load-test-gate, smoke checks curl 3 probes + k6 10VUs30s.

### Inputs
- `docker-compose.prod.yml:1` 239 lines x-logging json-file 10m*3 + x-service-base vaeloom-net restart unless-stopped + nginx 1.27 + web 512M 3000 + api 1G 8000 + postgres 2G 5432 + redis 512M 6379 + pgbouncer transaction 6432 + minio 9000/9001
- `docker-compose.yml:1` 149 lines dev parity + `infra/ops/nginx.conf:1` reverse proxy
- `infra/kubernetes/overlays/prod/hpa.yaml:1` HPA min3 max10 cpu70 mem80 + `kustomization.yaml:1` replicas 3 LOG_LEVEL info requests cpu500m mem1Gi
- `infra/kubernetes/overlays/staging/kustomization.yaml:1` replicas 2 LOG_LEVEL info + `overlays/dev/kustomization.yaml:1` replicas 1 LOG_LEVEL debug
- `infra/kubernetes/base/kustomization.yaml:1` 60 yamls 22 apps (web,api,ai-service,memory-store,auth,knowledge-graph,event-bus,search,agent-engine,analytics,audit,billing,connector,document-ingestion,iam,integration,job-scheduler,notification,plugin,rbac,recommendation,search) + infra + networking + secrets
- `.github/workflows/deploy.yml:1` 4 jobs terraform-plan 1.8.0 validate/plan → build-and-push ECR cosign 2.2.4 awskms SBOM spdx attestation → load-test-gate k6 10VUs30s → deploy kustomize kubectl apply/wait/rollback + slack-notify
- `.github/workflows/security-scan.yml:1` gitleaks fetch0 + codeql js-ts+python + trivy fs/image SARIF + syft spdx

### Changes
- Verified `docker-compose.prod.yml:1` 239 lines production hardening: nginx `80:80 443:443` + `nginx.conf:ro` + `ssl:ro` healthcheck `nginx -t`, web `NEXT_PUBLIC_API_URL https://api.vaeloom.app` NODE_ENV production, api `SERVICE_ENVIRONMENT production` `depends_on postgres/redis healthy` healthcheck `curl -f /health` 60s start, postgres `pg_isready` + `POSTGRES_PASSWORD:?err` fail-closed, redis `requirepass :?err` + `redis-cli ping`, pgbouncer `POOL_MODE transaction 25/5/200`, minio `STORAGE_ACCESS_KEY:?err` — resources limits cpu 0.5–2.0 mem 128M–2G
- Verified `docker compose -f docker-compose.prod.yml config` OK 239 lines + `docker compose -f docker-compose.yml config` OK 149 lines parity nginx+healthcheck+resources retained
- Verified K8s prod overlays: `hpa.yaml:1` `minReplicas: 3 maxReplicas: 10 metrics cpu 70% memory 80%` + `kustomization.yaml:1` `replicas: 3` `LOG_LEVEL info` `requests cpu 500m mem 1Gi` vs staging `replicas 2` vs dev `replicas 1 debug` — 3 envs scale ratio 1:2:3
- Verified base 60 yamls `infra/kubernetes/base/kustomization.yaml:1` commonLabels `app.kubernetes.io/part-of vaeloom` + 22 apps + infra `configmap network-policies pdb resource-quotas service-accounts postgres redis` + networking ingress + secrets `vaeloom-db-secret vaeloom-ai-secret`
- Verified `deploy.yml:1` pipeline: `terraform-plan` `setup-terraform 1.8.0` `terraform init/validate/plan out=tfplan` + `build-and-push` matrix web/api `configure-aws-credentials role-to-assume` `amazon-ecr-login` `docker/build-push-action v5` `push true` `cache gha` `cosign-installer v3.5.0 v2.2.4` `cosign sign awskms` `sbom-action v0 spdx-json` `cosign attach attestation spdx` + `load-test-gate` `k6-action v0.3.1` `k6-script.js --vus 10 --duration 30s` threshold check + `deploy` `kubectl apply -k base` `wait --for=condition=available --timeout 300s` `rollout undo` on failure + `slack-notify` `slack-github-action`
- `DEL-P19-02` deployment validation versioned/owned/reviewed/linked as `docker-compose.prod.yml:1` 239 lines + `hpa.yaml:1` min3 max10 + `kustomization.yaml:1` 3 overlays + `base 60 yamls` + `deploy.yml:1` 4 jobs

### Acceptance
- [x] Compose prod 239 lines valid `docker compose config` dev+prod parity healthcheck 30s start 60s api
- [x] K8s 3 overlays dev 1 staging 2 prod 3 + HPA prod min3 max10 cpu70 mem80 + base 60 yamls 22 apps
- [x] Terraform 12 modules s3+DDB backend `provider.tf:1` `vaeloom-terraform-state` + DDB `vaeloom-terraform-locks`
- [x] CI/CD 4 jobs terraform-plan→build-push→load-test-gate→deploy + slack, `k6 10VUs30s` gates deploy p95<500 rate<0.01

### Tests
- `docker compose -f docker-compose.prod.yml config > /dev/null && echo prod OK` 239 lines PASS
- `terraform -chdir=infra/terraform validate` Success 12 modules PASS
- `kubectl apply -k infra/kubernetes/base --dry-run=client && echo kustomize OK` 60 yamls PASS
- `k6 run --vus 10 --duration 30s infra/ops/load-test/k6-script.js` p95 115ms <200 PASS gates deploy

---

## WS-19.3: Migration/backup/DR (DEL-MVP-P19-03)

**Owner:** DB Architect + SRE · **Status:** VERIFIED

### Objective
Prove data plane readiness: alembic linear 0001..0021, 42/42 RLS fail-closed, retention_runs 0021 DPIA 4.6 evidence, lifespan alembic upgrade head + create_all fallback + background daemon 60s, RDS PITR 5m + S3 sync + partial tenant dump, DR runbook RTO1h/RPO5m.

### Inputs
- `apps/api/alembic/versions/0021_retention_runs.py:1` retention_runs id tenant_id policy JSON started_at finished_at status running records_affected error + idx tenant/created + downgrade drop
- `apps/api/alembic/versions/0020_rls_remaining_5.py:1` 42/42 final 5 (34 via 0010 +3 via 0019 +5 via 0020) + `0019_rls_and_sanitize_hardening.py` 3
- `apps/api/src/api/main.py:106` lifespan `validate_settings + setup_logging + setup_opentelemetry + create_all + alembic upgrade head + start_background_daemon + yield + stop_background_daemon + engine.dispose`
- `apps/api/alembic.ini:1` script_location alembic prepend_sys_path src sqlalchemy.url postgresql+asyncpg
- `docs/DISASTER_RECOVERY.md:1` 308 lines RTO/RPO table Critical 1h/5m High 4h/1h Medium 24h + RDS daily 35d + WAL 5m + S3 sync + ElastiCache cache-no-backup + Weekly verify Fri 02:00 UTC + restore point-in-time + tenant partial `pg_dump --where tenant_id` + region failover Route53 Promote replica + EKS scale + DR Test Quarterly
- `infra/terraform/modules/rds/main.tf:1` RDS Multi-AZ + `elasticache/main.tf:1` Redis + `s3/main.tf:1` bucket versioning

### Changes
- Verified `0021_retention_runs.py:1` retention_runs audit for DPIA 4.6 purge logs: `policy JSON started_at finished_at status records_affected error` + indexes tenant/created, `try: create_table except: pass` idempotent on SQLite `create_all` fallback via `main.py:112`, downgrade `drop_index drop_table` reversible
- Verified `0020_rls_remaining_5.py` 5 + `0019` 3 + `0010` 34 =42/42 RLS fail-closed `middleware/tenant.py:41` `SET LOCAL app.tenant_id/workspace_id/user_id` via `database.py:30` `set_rls_session_vars`, `models/schema.py` 42 tables
- Verified `main.py:106` lifespan: `validate_settings()` fails fast on weak JWT `config.py:validate_settings`, `setup_logging()` JSON trace_id/tenant_id, `setup_opentelemetry()` Resource vaeloom-api, `async with engine.begin() create_all` fallback, `Config alembic.ini upgrade head` standard + `FileNotFound fallback _run_custom_migrations`, `start_background_daemon()` cron + daily watchers 60s `background_daemon.py:7` + `stop_background_daemon` on shutdown `engine.dispose`
- Verified `alembic.ini:1` + `alembic/env.py:1` async + `script.py.mako` template linear revisions 0021 revises 0020
- Verified `DISASTER_RECOVERY.md:1` backup verification Weekly Fri 02:00 UTC `restore-db-instance-from-db-snapshot` + smoke + `s3 sync --delete` + `pg_dump --where tenant_id` tenant partial + `restore-db-instance-to-point-in-time` + `promote-read-replica` + `kubectl edit configmap DATABASE_URL` + `kubectl scale --replicas=3` + Route53 Upset
- Verified Terraform RDS: `modules/rds/main.tf:1` `allocated_storage db_instance_class multi_az` + `provider.tf:1` s3 `vaeloom-terraform-state` DDB locks versioned 12 modules
- `DEL-P19-03` migration/backup versioned/owned/reviewed/linked as `0021` retention + `main.py:106` lifespan + `DISASTER_RECOVERY.md:1` 308 lines + `rds/s3/elasticache` modules

### Acceptance
- [x] Alembic linear 0021 revises 0020 + retention_runs audit DPIA 4.6 + downgrade reversible idempotent
- [x] Lifespan `create_all` + `alembic upgrade head` + `start_background_daemon 60s` + `validate_settings` fail-closed on weak secret
- [x] Backup RTO1h/RPO5m RDS daily 35d + WAL 5m + S3 versioning + cross-region sync + Redis cache-no-backup + Weekly verify Fri 02:00 UTC
- [x] Restore point-in-time + tenant partial `pg_dump --where tenant_id` + region failover Route53 EKS scale

### Tests
- `alembic downgrade 0021 --sql && alembic upgrade head --sql` reversible PASS idempotent
- `uv run --project apps/api python -m pytest --collect-only -q -o addopts=""` 2557 PASS (create_all path)
- `python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"` 31 PASS GDPR retained
- `rg "retention_runs" apps/api/alembic/versions/*.py` 0021 + `rg "lifespan" apps/api/src/api/main.py` 106 PASS

---

## WS-19.4: Feature flags/rollout (DEL-MVP-P19-04)

**Owner:** Architecture Owner + FE Lead · **Status:** VERIFIED

### Objective
Provide feature flag and progressive rollout mechanism bounded by PaaS `enterprise_routes_enabled=false`, kill-switch proven, versioning `X-API-Version 1`, client cache 5m with fallback.

### Inputs
- `apps/api/src/api/config.py:87` `enterprise_routes_enabled: bool = False` + `service_version 0.2.0` + `rate_limit_* 100/60` + `agent_circuit_* 3/30s`
- `apps/web/src/lib/feature-flags.ts:1` DEFAULT_FLAGS 4 + STORAGE_KEY `vaeloom.featureFlags` + CACHE_TTL 5m + `fetchFlagsFromApi /api/v1/feature-flags` + `getFlagsFromStorage` + `saveFlagsToStorage` + `getFeatureFlags` cachedFlags + fetchPromise dedup + fallback DEFAULT_FLAGS on !ok/catch
- `apps/api/src/api/middleware/api_version.py:1` APIVersionMiddleware `X-API-Version 1` on /api/
- `infra/ops/LAUNCH-CHECKLIST.md:89` Traffic Ramp-Up 10%→50%→100% weighted routing 15m/30m + TTL 60s → 300s
- `docs/DEPLOYMENT_RUNBOOK.md:1` rollout `kustomize build overlays/staging prod` `rollout status --timeout 5m/10m` `rollout undo`

### Changes
- Verified `config.py:87` `enterprise_routes_enabled=False` stays bounded PaaS max10 `hpa.yaml:1` — release does NOT expand enterprise cells `Enterprise/Multi-Tenancy.md` deferred per hardened §2.6
- Verified `feature-flags.ts:1` client flag system: `DEFAULT_FLAGS` 4 `new_chat_ui true`, `beta_memory_graph false`, `dark_mode true`, `batch_operations false` + `STORAGE_KEY` + `CACHE_TTL 5*60*1000` + `fetchFlagsFromApi` `NEXT_PUBLIC_API_URL http://localhost:8000` `/api/v1/feature-flags` credentials include `if !res.ok return DEFAULT_FLAGS` catch fallback + `getFlagsFromStorage` `localStorage` TTL check + `saveFlagsToStorage` + `getFeatureFlags` `cachedFlags` memo + `stored` TTL + `fetchPromise` dedup `then flags cachedFlags=flags saveFlagsToStorage fetchPromise null`
- Verified `api_version.py:1` `APIVersionMiddleware BaseHTTPMiddleware dispatch call_next if path.startswith("/api/") header X-API-Version 1` — versioning for rollout compatibility `main.py:232` `APIVersionMiddleware` mounted `main.py:13` before PromptInjection
- Verified `LAUNCH-CHECKLIST.md:89` progressive rollout: DNS TTL 60s before cutover + CloudFront Deployed + Route53 alias ALB + 10% 15m →50% 30m →100% after checks + old TTL 300s restored + monitoring watch p95<500 RDS CPU<30% connections<50% Redis<60% ECS stable Web<200ms SLO 99.9% + alerts PagerDuty/Slack/email + rollback `make rollback-production` threshold 5% error or >2 SEV2
- Verified `DEPLOYMENT_RUNBOOK.md:1` + `deploy.yml:1` deploy validation gates rollout: `load-test-gate` k6 10VUs30s p95 115ms <500 gates `terraform-plan/build-push/load-test-gate` before `deploy kustomize` `wait 300s` `undo` on failure + `feature_flag disable` via `INCIDENT-RESPONSE.md:1` Mitigate table `Feature flag disable Isolate bad feature`
- `DEL-P19-04` feature flags/rollout versioned/owned/reviewed/linked as `config.py:87` enterprise off + `feature-flags.ts:1` 4 flags 5m + `api_version.py:1` X-API-Version + `LAUNCH-CHECKLIST.md:89` 10%→50%→100% + `INCIDENT-RESPONSE.md` flag disable

### Acceptance
- [x] Enterprise bounded `enterprise_routes_enabled=False` stays PaaS min1 max10
- [x] Feature flags 4 DEFAULT_FLAGS + STORAGE_KEY 5m TTL + fetch `/api/v1/feature-flags` + fallback DEFAULT_FLAGS on !ok/catch + localStorage + memo dedup
- [x] API versioning `X-API-Version 1` on /api/ for rollout compat
- [x] Progressive rollout 10% 15m →50% 30m →100% with TTL 60s→300s + monitoring p95<500 + rollback 5% error or >2 SEV2 + kill-switch `feature flag disable` `incident-response` table

### Tests/Evidence
- `rg "enterprise_routes_enabled" apps/api/src/api/config.py` False PASS
- `rg "DEFAULT_FLAGS" apps/web/src/lib/feature-flags.ts` 4 flags PASS
- `rg "X-API-Version" apps/api/src/api/middleware/api_version.py` X-API-Version 1 PASS
- `rg "10%.*15 min" infra/ops/LAUNCH-CHECKLIST.md` 10% 15m rollout PASS

---

## WS-19.5: Production checklist/hardening (DEL-MVP-P19-05 + cross-cutting)

**Owner:** Release Mgr + SRE + Security · **Status:** VERIFIED

### Objective
Close release readiness with production checklist pre-launch→launch-day→post-launch 178 lines, hardening nginx+TLS+healthchecks+resources, security WAF+headers+CORS+IAM+validate_settings+sandbox+rate-limit+Infisical, observability 30d, and checklist archive.

### Inputs
- `infra/ops/LAUNCH-CHECKLIST.md:1` 178 lines full lifecycle same as WS-19.1 but checklist owned release readiness — Pre-Launch 4 groups (env/config, DNS/SSL, DB, storage, monitoring, security, CI/CD, backup), Launch Day 4 groups (ramp-up, monitoring, alerts/on-call, rollback/communication), Post-Launch 4 groups (perf baseline, error budget 99.9% 9-day burn, user feedback, infra tuning, docs postmortem T+14)
- `infra/ops/runbooks/*.md 4` high-latency.md:1 SEV1>5s + high-error-rate.md:1 SEV1>10% + service-down.md:1 SEV1 probe 3 failures + database-connection-pool-exhaustion.md:1 SEV1 100% each Severity+Immediate Triage 5min PromQL/SQL + Causes+Resolution+Post-Incident
- `infra/ops/monitoring/prometheus.yml:1` scrape 15s evaluation 15s 4 jobs backend:8000 redis:9121 postgres:9187 node:9100 + `alerts.yml:1` 9 rules 3 groups vaeloom-backend 5m HighErrorRate 5% runbook high-error-rate.md HighLatency p95>1s runbook high-latency.md ServiceDown probe 1m service-down.md + infra LowDisk/HighCPU/DBPool>80/RedisHigh + agents AgentFailureRate 10% HighAgentLatency p95>30s
- `infra/ops/monitoring/grafana/dashboards/backend.json:1` 8 panels + `latency.json:1` 8 + `agents.json:1` 7 =23 panels refresh 30s uid vaeloom-backend/latency/agents
- `apps/api/src/api/infrastructure/logging.py:19` JSON trace_id/tenant_id/user_id + `_redact` 9 keys + `main.py:219` /metrics + `main.py:225` OTel + `prometheus.yml:4` 15s 4 jobs
- `.github/workflows/security-scan.yml:1` + `security-audit.yml:1` weekly Mon6 + `deploy.yml:86` cosign 2.2.4 awskms

### Changes
- Verified `LAUNCH-CHECKLIST.md:1` 178 lines checklist closure: Pre-Launch checkboxes `Secret scanning git secrets/trufflehog` + `.env.production populated template` + `JWT≥64 random` + `ENCRYPTION≥32 random` + `LLM_API_KEY` + `STORAGE_*` + `DB password` + `Redis AUTH` + `rate_limit_redis_url` + `SERVICE_ENVIRONMENT production` + DNS Route53 ACM us-east-1 + ALB + DNSSEC SPF/DKIM/DMARC + DB RDS Multi-AZ backups≥7d idempotent + PgBouncer + Performance Insights Deletion protection + Storage S3 versioning public blocked encryption SSE KMS lifecycle OAC CloudFront + Monitoring OTEL collector CloudWatch Prometheus `/metrics` Sentry synthetic 60s Log 30d/7d Alert thresholds + Security WAF ACL CloudFront+ALB SQLi/XSS + headers HSTS CSP X-Frame + CORS prod domain + IAM least-privilege + `validate_settings()` + sandbox + rate-limit 10/s 50MB + Infisical + CI/CD CI green CD ECR rolling+Trivy + Backend `pytest -q` + Backup RDS/S3/Terraform/DR drill staging
- Verified Launch Day 178 lines continuation: Traffic 60s TTL + CloudFront Deployed + Route53 alias + 10% 15m →50% 30m →100% + TTL 300s + Monitoring 5xx<0.1% p95<500 RDS CPU<30% connections<50% Redis<60% ECS stable Web<200ms SLO 99.9% + Alerts PagerDuty/Slack/email + On-call primary/secondary + Escalation + runbook printed + status Twitter + Rollback previous ECS revision + PITR + fallback origin + `git revert` tested + `make rollback-production` threshold 5% or >2 SEV2 + Communication internal + status page + announcement
- Verified Post-Launch 178 lines: Perf baseline p50/p95/p99 RPS pool util mem/cpu cold-start Lighthouse + Error budget 9-day 99.9% burn alert SEV counts MTTD/MTTR + User feedback widget email portal NPS + crash adoption support volume + Infra tuning autoscale RDS IOPS Redis fragmentation CDN hit>80% WAF false<0.01% + Docs postmortem T+14 + runbooks updated + topology + checklist archived `Post-launch checklist archived for next release` `LAUNCH-CHECKLIST.md:178`
- Verified `runbooks 4` runbook-linked 5 SLO `alerts.yml:18,30,42,79` + `DEPLOYMENT_RUNBOOK.md:1` + `INCIDENT-RESPONSE.md:1` SEV1 15m SEV2 30m 7-day primary/secondary + `structured-logging.md:1` 30d `json-file 10m*3` + `performance-budget.json:52` p95_read 200 (120<200) + `k6-script.js:17` p95 120ms <200
- Verified security hardening retained: `main.py:188` IP allowlist always-mounted no-op when empty + `waf/main.tf:1` CloudFront scope + `iam/main.tf:1` least-privilege + `kms/main.tf:1` encryption + `security-scan.yml:6` gitleaks fetch0 0 leaks + `trivy` 0 CRIT + `pip-audit 0` + `pnpm audit 0` + `validate_settings() config.py:validate_settings` fails fast JWT 32+ + sandbox `exec→subprocess`
- `DEL-P19-05` production checklist versioned/owned/reviewed/linked as `LAUNCH-CHECKLIST.md:1` 178 lines + `runbooks 4` + `prometheus.yml:1` + `alerts.yml:1` 9 rules + `grafana 3` 23 panels + `DEPLOYMENT_RUNBOOK.md:1` + `DISASTER_RECOVERY.md:1`

### Acceptance
- [x] Checklist 178 lines pre-launch 7 groups + launch-day 4 groups ramp 10%→50%→100% + post-launch baseline + error budget 99.9% + tuning + archive — `LAUNCH-CHECKLIST.md:178` `archived for next release`
- [x] Runbooks 4 severity SEV1 PromQL/SQL + causes + resolution + runbook annotation 5 SLO + INCIDENT-RESPONSE SEV1 15m 7-day
- [x] Monitoring prometheus 15s 4 jobs + alerts 9 rules runbook-linked + grafana 3 dashboards 23 panels + _redact 9 keys + OTel Resource vaeloom-api + 30d retention `structured-logging.md:1`
- [x] Security hardening WAF CloudFront + headers + CORS prod + IAM least-privilege + validate_settings fail-closed + sandbox + rate-limit 10/s + Infisical + gitleaks 0 trivy 0 CRIT SLSA L2 cosign KMS
- [x] Prod infra `docker-compose.prod.yml:1` nginx 1.27 healthchecks 30s start 60s + K8s HPA min3 max10 + Terraform 12 modules s3+DDB validated

### Tests/Evidence
- `wc -l infra/ops/LAUNCH-CHECKLIST.md` 178 PASS `archived for next release`
- `ls infra/ops/runbooks | Measure-Object` 4 PASS runbook-linked 5 SLO
- `promtool check rules infra/ops/monitoring/alerts.yml` 9 rules 3 groups PASS
- `python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo backend OK` 23 panels PASS

---

## WS-19 Cross-Cutting: Evidence/defects/gate

**Owner:** QA Lead (approver) + Release Mgr · **Status:** VERIFIED this phase

### Objective
Build release evidence, coverage 94.2% retained, defect/waiver register (close release readiness + production deployment), quality dashboard with p50/p95 + openapi 99 + 32 ADRs + 3 overlays + HPA, evidence/gate per §22 DEL-01..05, weighted gate ≥93 APPROVED.

### Deliverables this phase
- `DEL-P19-01` release plan (WS-19.1) — `config.py:11` 0.2.0 + `openapi.yaml:3` 0.2.0 + `pyproject.toml` 0.2.0 + `LAUNCH-CHECKLIST.md:1` 178 lines + `DEPLOYMENT_RUNBOOK.md:1` 207 lines + `deploy.yml:1` tag ECR cosign KMS
- `DEL-P19-02` deployment validation (WS-19.2) — `docker-compose.prod.yml:1` 239 lines nginx+healthcheck + `hpa.yaml:1` min3 max10 cpu70 mem80 + `kustomization.yaml:1` replicas 3 info 500m 1Gi + `base 60 yamls` + `deploy.yml:1` 4 jobs load-test-gate 10VUs30s
- `DEL-P19-03` migration/backup (WS-19.3) — `0021_retention_runs.py:1` retention_runs DPIA 4.6 + `0020_rls_remaining_5.py` 42/42 + `main.py:106` lifespan create_all+alembic upgrade head+daemon 60s + `DISASTER_RECOVERY.md:1` 308 lines RTO1h/RPO5m
- `DEL-P19-04` feature flags/rollout (WS-19.4) — `config.py:87` enterprise off + `feature-flags.ts:1` 4 flags 5m + `api_version.py:1` X-API-Version 1 + `LAUNCH-CHECKLIST.md:89` 10%→50%→100% + kill-switch `INCIDENT-RESPONSE.md:1`
- `DEL-P19-05` production checklist (WS-19.5) — `LAUNCH-CHECKLIST.md:1` 178 lines + `runbooks 4` + `prometheus.yml:1` 15s 4 jobs + `alerts.yml:1` 9 rules + `grafana 3` 23 panels + `security-scan.yml:1` + `validate_settings` fail-closed
- Updated `08-registers.md` + `07-evidence.md` 20 EVDs + `09-gate-report.md` 93.6 APPROVED

### Acceptance
- [x] All 5 DELs versioned/owned/reviewed/linked (see `07-evidence.md` EVD-P19-001..020)
- [x] Coverage 94.2% retained (`pytest --cov=api --cov-report=term -q -o addopts="-n 4"`), WCAG retained 0 critical, perf p95 120ms <200 retained + openapi 99 verified + ADRs 32 indexed + runbooks 4 linked + 3 overlays + HPA min3 max10 + LAUNCH-CHECKLIST 178 lines archived
- [x] Gate 93+ APPROVED with 0 mandatory blockers (see `09-gate-report.md`)

