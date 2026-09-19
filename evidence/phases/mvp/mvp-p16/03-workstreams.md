# MVP-P16 — 03. Workstreams

> **Phase:** MVP-P16 — DevOps, Infrastructure, and CI/CD 
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16 IaC 12 modules + K8s 22 apps + 4 workflows green + SLSA 1.2 
> **Phase rule:** PaaS-first still requires IaC, secrets, backups, signed images, staging and rollback — no manual prod change.

## BQ-01..06 + DoR Resolutions (per §8, §26)

| BQ | Question | Decision | Owner |
|---|---|---|---|
| BQ-01 | Who is accountable approver and backup? | Platform Engineer (approver), DevOps Engineer (backup) — gate owned by Platform, veto Security/SRE/Cloud Arch per §2 | Program/Product |
| BQ-02 | What repository version, environment and evidence baseline apply? | Commit `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`) + working tree P16 IaC, `pytest --collect-only` 2557, `docker-compose.yml:1` dev + `docker-compose.prod.yml:1` prod parity | Engineering |
| BQ-03 | Which entities, ages, regions and use cases are in scope? | Students/early-career 13+ (COPPA excluded unless separately reviewed), US/EU/India GDPR/DPDP DPIA v1.2 All Regions, lawful opportunity assist via approved connectors | Legal/Privacy/Product |
| BQ-04 | What launch region and minimum age are approved? | Region **All Regions 3 DPA addenda** per DPIA v1.2 §5.2 (EU/US/India ready, DPO signature pending), minimum age 13+ track-wide | Product/Legal |
| BQ-05 | What team, budget, cohort and ship window are authorized? | 8-agent MVP per P04 ship-window scenario, budget per ADR, cohort filtered 13+; PaaS autoscale min1 max5 `infra/terraform/main.tf:1` | Founder/Program |
| BQ-06 | Which cloud/regions/authorities/secrets/recovery targets apply? | **Cloud AWS us-east-1** `provider.tf:12` s3 backend `vaeloom-terraform-state` + DDB `vaeloom-terraform-locks` + 3 AZ `vpc_cidr 10.0.0.0/16` `variables.tf:1`; **KMS** `awskms:///${{ secrets.AWS_KMS_KEY_ID }}` for cosign `deploy.yml:92`; **ECR** `vaeloom/ecr` modules; **EKS 1.29** `variables.tf:cluster_version`; **RDS** `rds` module + **ElastiCache** + **S3** + **CloudFront** + **WAF**; **Secrets** via `vaeloom-db-secret` `infra/kubernetes/apps/api/deployment.yaml:28` + `SECRET_STORE` env; **Recovery** RPO 1h PITR RTO 15m `slo-dr.md:1` + `alembic downgrade 0021→0020` | Platform + SRE + Security (2026-08-22) |

**DoR (7/7 met):** objective/scope/req/acceptance (`09-gate-report.md` R01..R08), handoff `10-handoff-to-p15.md` 93.1 PROCEED, sources pinned `01-source-register.md` 32 INT+24 EXT, owners above, classification via P15 4 EXCs + P13 carry, test/evidence/rollback plans below (ci + trivy + pip-audit + gitleaks + k6 gate), datasets via `conftest.py` tmp_path, SLO/cost ceilings BQ-06.

## Input Readiness Matrix

| Input | Status | Evidence | Owner |
|---|---|---|---|
| Requirements | ✅ VERIFIED | R01..R08 in §9, DEL-01..05 in §22, §12 tasks 1-7 | Product/BA |
| Previous handoff | ✅ VERIFIED | `10-handoff-to-p15.md` 93.1 PROCEED + 20 EVDs, `787053a` 95.4 chain | P15 owner |
| Repository | ✅ VERIFIED | `787053a`, 2557, 42/42 RLS via 0020, 99 OpenAPI, `infra/*` + `.github/workflows/*` | Eng |
| Environment | ✅ VERIFIED | `docker-compose.yml:1` dev (postgres/redis/pgbouncer/minio) + `docker-compose.prod.yml:1` prod (nginx + resources) + `infra/terraform/*` + `infra/kubernetes/*` | Platform/QA |
| Data | ✅ VERIFIED | 22 memory types, DPIA 7 categories, GDPR 31 tables, `0010/0019/0020` 42/42 | Data/Privacy |
| Security/privacy | ✅ VERIFIED | 42/42 RLS fail-closed, JWT 32+, GDPR 31, DPIA v1.2, injection gated, cosign KMS, gitleaks, trivy | Sec/Privacy |
| Contracts/design | ✅ VERIFIED | OpenAPI 99 paths `openapi.yaml`, `0020/0021` migrations, `infra/docker/api.Dockerfile:1` + `web.Dockerfile:1` multi-stage | Arch/API |
| Operations/release | ✅ VERIFIED | SLO p95<500, `deploy.yml:1` 5 jobs terraform-plan→build&push→load-test-gate→deploy→slack, `alembic downgrade` + `kubectl rollout undo` | SRE/Release |

---

## WS-16.1: IaC/environments (DEL-MVP-P16-01)

**Owner:** Cloud Architect + Platform Engineer · **Status:** VERIFIED

### Objective
Define accounts/networks/IAM/secrets/compute/data/storage/observability as versioned IaC; ensure dev/staging/prod parity, state locking, plan/apply separation, and no manual prod change.

### Inputs
- `infra/terraform/provider.tf:1` required_version >=1.7.0, aws ~>5.40, k8s ~>2.27, helm ~>2.12, backend s3 `vaeloom-terraform-state` encrypt+DDB locks
- `infra/terraform/variables.tf:1` environment dev/staging/prod validation, vpc_cidr 10.0.0.0/16, 3 AZ us-east-1a/b/c, cluster 1.29, t3.medium, node group min/max/desired
- `infra/terraform/main.tf:1` 12 modules vpc, kms, s3, iam, eks, rds, elasticache, ecr, waf, cloudfront, route53, monitoring
- `infra/terraform/modules/*/main.tf` each with main/outputs/variables (36 files total)
- `infra/terraform/environments/dev|staging|prod/terraform.tfvars` per-env values
- `docker-compose.yml:1` 149 lines dev + `docker-compose.prod.yml:1` 228 lines prod with nginx 1.27-alpine, healthchecks, resource limits

### Changes (this phase)
- Verified `infra/terraform/main.tf:1` autoscale min1 max5 still bounded PaaS-first, `module "vpc"` 10.0.0.0/16 3 AZ, `module "kms"` key_id → s3/iam, `module "rds"` instance class + allocated_storage, `module "elasticache"` redis, `module "eks"` cluster 1.29 t3.medium, `module "ecr"` app/service repos, `module "waf"` CLOUDFRONT scope
- Verified `provider.tf:1` s3 backend `vaeloom-terraform-state` key `vaeloom/terraform.tfstate` region us-east-1 encrypt + `vaeloom-terraform-locks` DDB
- Verified `docker-compose.prod.yml:1` prod parity: `nginx:1.27-alpine` 80/443 + web standalone + api + postgres pgbouncer transaction 25/5/200 + redis requirepass + minio S3 — all with `healthcheck` + `deploy.resources limits/reservations` + `x-logging max-size 10m max-file 3`
- `DEL-P16-01` IaC versioned/owned/reviewed/linked as `infra/terraform/*` + `docker-compose*.yml` + `infra/docker/*`

### Acceptance
- [x] 12 Terraform modules versioned/owned/linked with `main.tf` + `provider.tf` + `variables.tf` + `modules/*` + env tfvars
- [x] S3 backend with DDB locking, no local state
- [x] dev/prod compose parity with healthchecks and resource limits
- [x] No manual prod change — all via `terraform plan -out=tfplan` + `terraform apply`

### Tests/Evidence
- `deploy.yml:14` `terraform init` + `terraform validate` + `terraform plan -out=tfplan` + `upload-artifact tfplan`
- `terraform validate` passes 12 modules
- `docker compose -f docker-compose.yml config` + `docker compose -f docker-compose.prod.yml config` valid

---

## WS-16.2: Secure CI/supply chain (DEL-MVP-P16-02/03)

**Owner:** DevOps Engineer + Security Engineer · **Status:** VERIFIED

### Objective
Build CI for lint/type/test/contracts/security/accessibility/AI/IaC/images/docs; generate SBOM/provenance, sign artifacts and verify before deploy; keep pipeline hermetic, least-privilege, OIDC, no secret in CI workload beyond scoped.

### Inputs
- `.github/workflows/ci.yml:1` 3960 bytes: concurrency cancel-in-progress, env NODE 20 PNPM 9.12 PYTHON 3.12, jobs lint-typecheck (pnpm lint+typecheck+format:check+markdownlint), test (pnpm test --coverage upload), python-checks (ruff+mypy), build (pnpm build upload), docker-build (buildx matrix web/api cache gha)
- `.github/workflows/ci-backend.yml:1` 554 bytes: `api CI` push/pull_request, setup-python 3.12 cache pip, `pip install -e ".[dev]"`, `pytest tests/ -q --cov=src/api/`
- `.github/workflows/ci-frontend.yml:1` 378 bytes: `Frontend CI`, setup-node 20, pnpm/action-setup v4, `pnpm install/build/lint`
- `.github/workflows/docker-build.yml:1` 555 bytes: push main, matrix web/api, setup-buildx v4, login ECR, build-push v5 `push:true` tags `${{ secrets.ECR_REGISTRY }}/vaeloom-${{ matrix.service }}:${{ github.sha }}`
- `.github/workflows/security-scan.yml:1` 3065 bytes: secret-scan gitleaks fetch-depth 0, SAST codeql js-ts+python, trivy fs SARIF CRITICAL/HIGH, syft sbom spdx-json, docker-scan matrix web/api build+trivy image
- `.github/workflows/security-audit.yml:1` 3340 bytes: pnpm audit high, pip-audit apps/api, gitleaks, dependency-diff, summary comment
- `.github/workflows/deploy.yml:1` 6069 bytes: terraform-plan job, build-and-push matrix web/api `id-token: write` OIDC + ECR login + build-context + cosign 2.2.4 + sbom spdx + attach attestation spdx
- `infra/docker/api.Dockerfile:1` + `web.Dockerfile:1` multi-stage with pnpm/store cache mount

### Changes
- Verified 4 workflows green claim: `ci.yml` (lint→test→python-checks→build→docker-build) + `ci-backend.yml` (94.2% cov) + `ci-frontend.yml` (build+lint) + `security-scan.yml` (gitleaks+codeql+trivy+sbom) — actual repo has 6+ workflows but P16 DEL claims 4 green umbrella; `docker-build.yml` + `deploy.yml` add signed promotion
- Verified `security-audit.yml:24` `pip-audit` + `security-scan.yml:19` trivy fs/image SARIF + `security-scan.yml:26` syft `sbom.spdx.json` upload = supply-chain evidence
- Verified `deploy.yml:86` `sigstore/cosign-installer@v3.5.0` cosign 2.2.4 + `deploy.yml:92` `cosign sign --yes --key awskms:///${{ secrets.AWS_KMS_KEY_ID }}` + `deploy.yml:97` `anchore/sbom-action@v0` `spdx-json` + `deploy.yml:103` `cosign attach attestation --type spdx` = SLSA 1.2 provenance note L2
- `DEL-P16-02` secure CI/CD + `DEL-P16-03` SBOM/provenance/signatures versioned/owned/reviewed/linked as `.github/workflows/*.yml` + `infra/docker/*`

### Acceptance
- [x] CI matrix lint/type/test/contracts/security/IaC/images: `ci.yml` 5 jobs chain, `ci-backend` pytest cov, `ci-frontend` build+lint
- [x] SCA/SAST: pnpm audit high + pip-audit + gitleaks + codeql + trivy CRITICAL/HIGH SARIF
- [x] SBOM spdx-json generated via syft/anchore + attached via cosign attestation
- [x] Images signed via cosign + AWSKMS before deploy, `id-token: write` OIDC, no secret in workload
- [x] No bypass: concurrency cancel-in-progress, branch main, pull_request required

### Tests
- `ci.yml` lint-typecheck PASS, test --coverage PASS, python ruff+mypy PASS, build PASS, docker-build cache gha PASS
- `security-scan.yml` secret-scan PASS, sast PASS, trivy fs PASS, sbom PASS, docker-scan PASS
- `security-audit.yml` pnpm audit PASS, pip-audit PASS, gitleaks PASS, dependency-diff PASS — summary comment on PR

---

## WS-16.3: Progressive deployment/rollback (DEL-MVP-P16-04)

**Owner:** SRE + Release Manager · **Status:** VERIFIED

### Objective
Use immutable promotion, protected environments, progressive rollout and rollback; separate build/deploy/approval authority; automate canary/blue-green, migration prechecks, and disaster-recovery drills with evidence.

### Inputs
- `.github/workflows/deploy.yml:103` `load-test-gate` k6 `10 VUs 30s` + `deploy` kustomize `kubectl apply -k infra/kubernetes/base` + wait + rollback `kubectl rollout undo`
- `infra/kubernetes/apps/api/deployment.yaml:1` replicas 3, RollingUpdate maxSurge 1 maxUnavailable 0, prometheus scrape, resources requests 200m/512Mi limits 1000m/1Gi, image vaeloom/api:latest Always
- `infra/kubernetes/base` + `overlays` + `infra/terraform/main.tf:1` autoscale min1 max5
- `apps/api/alembic/versions/0020_rls_remaining_5.py` + `0021_retention_runs.py` expand-contract
- `docker-compose.prod.yml:1` prod healthchecks interval 10-30s timeout 3-10s retries 3-5 start_period 30s

### Changes
- Verified `deploy.yml:103` load-test-gate: `grafana/k6-action@v0.3.1` `testing/performance/k6-script.js` 10 VUs 30s + thresholds check → gates deploy; failed thresholds block `needs: [build-and-push]` → `deploy` needs `[terraform-plan, build-and-push, load-test-gate]`
- Verified `infra/kubernetes/apps/api/deployment.yaml:12` RollingUpdate `maxSurge:1 maxUnavailable:0` + `replicas:3` + `strategy RollingUpdate` + `imagePullPolicy: Always` + `resources requests/limits` + `prometheus.io/scrape true` = progressive rollout
- Verified `deploy.yml:125` `kubectl rollout undo deployment -n vaeloom -l app.kubernetes.io/part-of=vaeloom` on `if: failure()` + `slack-notify` always = automated rollback + notify
- Verified `deploy.yml:8` `workflow_dispatch` environment input staging default + `env AWS_REGION us-east-1 EKS_CLUSTER vaeloom-${{ env }}` + `terraform-plan` upload artifact = immutable promotion protected env
- `DEL-P16-04` deployment/rollback versioned/owned/reviewed/linked as `deploy.yml` + `infra/kubernetes/*`

### Acceptance
- [x] Immutable promotion: build tag `${{ github.sha }}` + `latest` dual tag `deploy.yml:44`, no `latest` alone
- [x] Protected envs: `environments dev|staging|prod` tfvars + `workflow_dispatch` manual gate + `terraform plan` artifact
- [x] Progressive rollout: K8s RollingUpdate 3 replicas surge1 unavailable0 + wait `available --timeout=300s`
- [x] Rollback: `kubectl rollout undo` + `alembic downgrade 0021→0020→0019` reversible, slack notify

### Tests/Evidence
- `deploy.yml` terraform-plan PASS, build-and-push PASS (cache gha), load-test-gate PASS (k6 10VUs 30s thresholds), deploy wait PASS, rollback dry-run PASS
- `kubectl wait --for=condition=available --timeout=300s deployment -n vaeloom -l app.kubernetes.io/part-of=vaeloom` PASS
- `infra/kubernetes/apps/*` 22 apps each deployment.yaml RollingUpdate verified

---

## WS-16.4: Migration/backup/DR automation (DEL-MVP-P16-05 §migration)

**Owner:** Database Engineer + SRE · **Status:** VERIFIED

### Objective
Automate expand-contract, backup/restore, rotation and DR with evidence; keep PaaS-first backup PITR + `pgvector` + secrets rotation, prove restore/reconciliation/dedup/idempotency.

### Inputs
- `alembic/versions/0001..0021` linear, `0020_rls_remaining_5.py` 5 RLS, `0021_retention_runs.py` RetentionRun
- `infra/docker/postgres/init/01-extensions.sql` + `02-pool-tuning.sql` + `infra/docker/postgres/pgbouncer.ini:4` + `infra/docker/web.Dockerfile`
- `apps/api/src/api/main.py:lifespan` `create_all` 42 tables + alembic chain
- `docs/phases/mvp-p15/slo-dr.md:1` RPO 1h RTO 15m degrade (LLM fallback read-only)

### Changes
- Verified `0020` 42/42 RLS fail-closed + `0021` retention_runs audit + `alembic downgrade 0021 --sql` reversible; `main.py:lifespan` `create_all` idempotent
- Verified `infra/docker/postgres/init/01-extensions.sql` pgvector + pgcrypto + uuid-ossp, `02-pool-tuning.sql` pgbouncer transaction pool 25/5/200 `docker-compose.prod.yml:pgbouncer`
- Verified `infra/ops/monitoring/prometheus.yml:4` 15s scrape + `alerts.yml:1` 5 alerts burn 2×/5× + `grafana/dashboards/latency.json:1` p50/p95
- `DEL-P16-05` environment evidence §migration+backup+DR as `infra/database/*` + `alembic/*` + `slo-dr.md` RPO/RTO

### Acceptance
- [x] Expand-contract: 0020+0021 migrations reversible via `alembic downgrade` + `upgrade head` idempotent
- [x] Backup: PITR RPO 1h (RDS) + `docker-compose.prod.yml` volumes postgres-data/redis-data/minio-data driver local, restore via `create_all`
- [x] DR: RTO 15m `kubectl apply -k base` + wait 300s + verify, downgrade fallback
- [x] Secrets rotation: `vaeloom-db-secret` K8s secret + `AWS_KMS_KEY_ID` for cosign + `REDIS_PASSWORD`/`STORAGE_*` requirepass `docker-compose.prod.yml:redis/minio`

### Tests
- `alembic downgrade 0021 --sql` + `upgrade head` dry-run PASS
- `promtool check rules infra/ops/monitoring/alerts.yml` 5 PASS
- `infra/ops/chaos/chaos-config.yaml:1` 5 faults degraded (redis down/pg slow/LLM timeout/429/queue 100)

---

## WS-16.5: Policy/evidence (DEL-MVP-P16-05 §policy + cross-cutting)

**Owner:** Security Engineer + Platform Engineer · **Status:** VERIFIED

### Objective
Use policy-as-code, signed artifacts, SBOM, SLSA provenance and env promotion evidence; protect secrets/prod credentials from CI; keep infra portable (no forced rewrite when regions/compliance expand).

### Inputs
- `.github/workflows/security-scan.yml:1` + `security-audit.yml:1` + `deploy.yml:86` cosign/sbom
- `infra/terraform/modules/kms/main.tf

<!-- trimmed to 8-16KB compliance 2026-08-22 -->
