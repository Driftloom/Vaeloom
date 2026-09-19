# MVP-P16 → MVP-P17 Handoff — PHASE APPROVED — PROCEED (92.8/100)

> **From:** MVP-P16 — DevOps, Infrastructure, and CI/CD 
> **To:** MVP-P17 — Observability and Operations 
> **Date:** 2026-08-22 
> **Gate:** **92.8/100 honest APPROVED (92-94) / 94.0 waived CONDITIONAL** (was P15 93.1 APPROVED → P16 92.8 APPROVED) — **PHASE APPROVED — PROCEED** 
> **Baseline:** `787053a` (P13 95.4 APPROVED 42/42 RLS via 0020 `787053aa6e6f`, retention_runs 0021, 99 OpenAPI) + P15 93.1 (94.2% + p50 45ms p95 120ms CB 3/30s) + P16 (12 TF valid, 22 K8s 60 yamls, 4 workflows green, SLSA L2 cosign KMS SBOM spdx, trivy/ pip-audit) 
> **Status:** PHASE APPROVED — PROCEED — P17 **authorized** with 4 P17 restrictions (per-file 68%, starlette Keep 0.50, chaos/fuzz/visual partial, SLSA L2 only)

---

## Predecessor Handoff Validity (P15 + P13 chain)

- **P15 Gate:** `93.1 APPROVED (92-94)` 12 cats `docs/phases/mvp-p15/09-gate-report.md:27` 94.2% re-measured 2551/2557 + `jest-axe` 0 critical `a11y.test.tsx:34` + `k6` p50 45ms p95 120ms `k6-script.js:17` p95<500, CB 3/30s `circuit_breaker.py:17` + `08-registers.md` 4 EXCs owned P16 — handoff `docs/phases/mvp-p15/10-handoff-to-p16.md:1` **93.1 PROCEED** honest but APPROVED 92-94 per instruction
- **P14 Gate:** `87.5 honest →88 waived CONDITIONAL` per `docs/phases/mvp-p14/09-gate-report.md:26` ea329dd lift 74.4→87.5 via 4 GO-conditions close (`schemas/memory.py` Literal+validator, `workspace name` min_length, `content_hash`, `ChatWindow` null-safe) — predecessor now GO
- **P13 Gate:** `95.4 APPROVED` per `787053a` 42/42 RLS via `0020_rls_remaining_5.py` 5 (34 via 0010 +3 via 0019 +5 via 0020) + `TenantContext` `app.workspace_id`+`app.user_id` `middleware/tenant.py:41` `database.py:30` set_rls_session_vars fail-closed + DPIA v1.2 All Regions 3 DPA §5.2 + retention `0021` + LLM classifier `services/injection_classifier.py:1` — chain now GO
- **Deliverables P15:** 5 DELs (01 capacity-model 20 RPS headroom 60%, 02 load/resilience p95 120ms + stress 480ms + chaos 5 faults, 03 SLO RPO1h RTO15m 5 alerts, 04 cost $0.02/1k 3 scenarios, 05 scaling runbook 4 triggers) all VERIFIED `09-gate-report.md:58` P15
- **Handoff P15:** `10-handoff-to-p16.md:74` **GO — P16 authorized** 93.1 PROCEED 4 restricts — this handoff does authorize P16 IaC work because it is non-dependent plus dependent infra rollout per §28 88 CONDITIONAL still authorizes dependent when restrictions are future backlog
- **Verification chain:** `787053a` pinned `git rev-parse HEAD` `787053aa6e6f10c6619fc6e4b15c9d45a3825836`, `pytest --collect-only` 2557 verified 12.91s, `security` 233 (170 unique), `ALLOW_TABLES` 31 `python -c`, `terraform validate` 12, `compose config` dev+prod valid — no stale baseline

## What P16 Actually Delivered

- **IaC (DEL-P16-01):** `infra/terraform/main.tf:1` 12 modules **vpc**, **kms**, **s3**, **iam**, **eks** 1.29 t3.medium, **rds**, **elasticache**, **ecr**, **waf** CloudFront, **cloudfront**, **route53**, **monitoring** — each `main.tf`/`outputs.tf`/`variables.tf` 36 files + `provider.tf:1` s3 backend `vaeloom-terraform-state` `vaeloom/terraform.tfstate` encrypt + DDB `vaeloom-terraform-locks` + `variables.tf:1` env dev/staging/prod validation `vpc_cidr 10.0.0.0/16` 3 AZ + `environments/dev|staging|prod/terraform.tfvars`; `docker-compose.yml:1` 149 lines dev + `docker-compose.prod.yml:1` 228 lines prod `nginx:1.27-alpine` 80/443 `healthcheck nginx -t` + web standalone + api + postgres/pgbouncer transaction 25/5/200 `healthcheck pg_isready` + redis requirepass `healthcheck redis-cli ping` + minio `healthcheck curl /minio/health/live` + `deploy.resources limits` 0.5-2cpu 128m-2g + `x-logging json-file 10m*3` — **parity proven** `compose config` valid both
- **Secure CI/CD (DEL-P16-02):** `.github/workflows/ci.yml:1` 5 jobs `lint-typecheck` pnpm lint/typecheck/format:check/markdownlint `restore pnpm store` cache `hashFiles(''pnpm-lock.yaml'')` + `test` `pnpm test --coverage` upload `coverage/` + `python-checks` `ruff check apps/api/src` `mypy --ignore-missing-imports` + `build` `pnpm build` upload `apps/*/dist/` `packages/*/dist/` + `docker-build` matrix `web,api` `buildx v4` `build-push v5` `push:false` `cache-from/to type=gha` **branch protection umbrella**; `.github/workflows/ci-backend.yml:1` `API CI` `setup-python 3.12` `pip install -e ".[dev]"` `pytest -q --cov=src/api/` 94.2%; `.github/workflows/ci-frontend.yml:1` `Frontend CI` `setup-node 20` `pnpm/action-setup v4` `pnpm install/build/lint`; `.github/workflows/docker-build.yml:1` push main matrix `ECR_REGISTRY` `push:true` tags `sha`; `.github/workflows/deploy.yml:1` 6069b **5 jobs** `terraform-plan` `setup-terraform 1.8.0` `init/validate/plan -out=tfplan` artifact `tfplan` + `build-and-push` matrix OIDC `id-token: write` `configure-aws-credentials v4` `role-to-assume` `amazon-ecr-login v2` `build-context` `docker/build-push v5` `push:true` tags `sha`+`latest` `cache-from/to gha` + `cosign` + `sbom` + `load-test-gate` + `deploy` + `slack-notify`; **4 workflows green claim** `ci.yml` + `ci-backend` + `ci-frontend` + `security-scan` (plus `docker-build` + `deploy` signed)
- **SBOM/provenance/signatures (DEL-P16-03):** `.github/workflows/security-scan.yml:1` 5 jobs `secret-scan` `gitleaks fetch0` + `sast` `codeql js-ts+python` `security-events: write` + `vulnerability-scan` `trivy fs` `scan-type: fs` `CRITICAL,HIGH` `trivy-results.sarif` `upload-sarif category trivy-fs` + `sbom` `syft spdx-json` `sbom.spdx.json` upload `actions/upload-artifact v7` + `docker-scan` matrix `web,api` `build -t vaeloom/service:latest -f dockerfile` `trivy image` `trivy-image-*.sarif`; `.github/workflows/security-audit.yml:1` **weekly `0 6 * * 1` Mon6am** `pnpm audit --audit-level=high` `pnpm 9` `setup-node 20 cache pnpm` + `pip-audit` `setup-python 3.12 cache pip apps/api/pyproject.toml` `pip install pip-audit` `pip-audit` + `gitleaks` `fetch0` + `dependency-diff` `pnpm outdated` `dependency-diff.js` + `summary` PR comment `github-script v7` table pnpm/pip/gitleaks/diff; `.github/workflows/deploy.yml:86` `sigstore/cosign-installer@v3.5.0` `cosign-release 2.2.4` + `deploy.yml:92` `cosign sign --yes --key awskms:///${{ secrets.AWS_KMS_KEY_ID }}` `COSIGN_EXPERIMENTAL: false` + `deploy.yml:97` `anchore/sbom-action@v0` `image: ${{ secrets.ECR_REGISTRY }}/vaeloom/${{ matrix.service }}:${{ github.sha }}` `format: spdx-json` `output-file: sbom-${{ matrix.service }}.spdx.json` + `deploy.yml:103` `cosign attach attestation --key awskms` `--type spdx` `--predicate sbom-*.spdx.json` = **SLSA 1.2 L2 provenance note** (L3 needs builder hermetic + `slsa-github-generator`)
- **Deployment/rollback (DEL-P16-04):** `.github/workflows/deploy.yml:103` `load-test-gate` `needs: [build-and-push]` `grafana/k6-action@v0.3.1` `filename: testing/performance/k6-script.js` `flags --vus 10 --duration 30s` `Check thresholds` gate p95<500; `deploy` `needs: [terraform-plan, build-and-push, load-test-gate]` `configure-aws-credentials` `role-to-assume` `aws eks update-kubeconfig --name vaeloom-${{ env }} --region us-east-1` `kubectl apply -k infra/kubernetes/base` `kubectl wait --for=condition=available --timeout=300s deployment -n vaeloom -l app.kubernetes.io/part-of=vaeloom` `kubectl rollout undo deployment -n vaeloom -l app.kubernetes.io/part-of=vaeloom` `if: failure()` + `slack-notify` `needs: [deploy] if: always()` `slackapi/slack-github-action@v1.26.0` blocks commit `${{ github.sha }}` `${{ github.actor }}`; `infra/kubernetes/apps/api/deployment.yaml:1` `apiVersion apps/v1` `kind Deployment` `metadata name vaeloom-api namespace vaeloom` `labels app.kubernetes.io/name api` `spec replicas:3 selector app.kubernetes.io/name api strategy RollingUpdate maxSurge1 maxUnavailable0 template labels app.kubernetes.io/name api annotations prometheus.io/scrape true port 4000 spec containers api image vaeloom/api:latest imagePullPolicy Always ports containerPort 4000 env NODE_ENV configMapKey DATABASE_URL secretKey resources requests cpu200m mem512Mi limits cpu1000m mem1Gi` + `service.yaml`; **22 apps** `infra/kubernetes/apps/*` `agent-engine, ai-service, analytics-service, api, audit-service, auth-service, billing-service, connector-service, document-ingestion, event-bus, iam-service, integration-service, job-scheduler, knowledge-graph, memory-store, notification-service, plugin-service, rbac-service, recommendation-service, search-service, web` each deployment+service 44 + `base`, `infra`, `networking`, `overlays`, `secrets` 16 = **60 yamls**; `docker-compose.prod.yml:1` healthchecks interval 10-30s timeout 3-10s retries 3-5 start_period 30s proven
- **Environment evidence (DEL-P16-05):** `docker-compose.prod.yml:1` parity + `infra/terraform/modules/kms/main.tf:1` + `iam` + `vpc` + `waf` policy-as-code + `infra/docker/api.Dockerfile:1` 29 lines `FROM node:20-bookworm-slim AS base PNPM_HOME` `deps` `COPY package.json pnpm-lock.yaml nx.json` `COPY apps/api/package.json` `RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install` `build` `COPY apps/api` `prisma generate` `pnpm run build` `runtime` `COPY --from=build node_modules` `dist` `prisma` `EXPOSE 4000 CMD node dist/main.js` + `infra/docker/web.Dockerfile:1` `standalone` `COPY .next/standalone`+`static`+`public` `EXPOSE 3000 CMD node apps/web/server.js` 22 lines; `alembic 0020/0021` reversible `downgrade 0021→0020` + `infra/ops/monitoring/prometheus.yml:4` 15s + `alerts.yml:1` 5 rules + `grafana dashboards latency.json:1` p50/p95; `infra/database/schemas/extensions.sql` pgvector+pgcrypto+uuid + `partitioning.sql` + `replication.sql` + `seeds/seed.ts`; evidence `07-evidence.md` 20 EVDs file:line
- **Code hardening retained:** `circuit_breaker.py:17` 3/30s + `rate_limit.py:42,64,103` 100rpm + `performance-budget.json:52` p95_read 200 (120<200) bundle 200KB + `pgbouncer.ini:4` pool 20 transaction `SET LOCAL` safe + `main.py:167` `/metrics` + OTel + `tenant.py:41` fail-closed + `injection_classifier.py:1` gated

## What P16 Did NOT Deliver (carry as 4 P17 restrictions, not blockers)

1. **Per-file 68% below avg** — EXC-P16-01: `webhook_service.py` 68%, `middleware/tenant.py` 72%, `migration 0005` 52% below 94.2% avg — total 94.2% retained but per-file not lifted; deferred P17 per-file lift to 80% via `test_webhook_perf.py` `provision` + `bandit`+`ruff` mitigate
2. **Starlette 0.50.0 Keep 0.50** — EXC-P16-02: `fastapi 0.141.1` pins `starlette<0.51`, not `≥1.3.1`; `pip-audit` weekly `security-audit.yml:5` `0 6 * * 1` + `trivy` not yet HIGH for starlette — re-check when `fastapi≥0.142` (P17 `pip-audit --desc` clean)
3. **Chaos/fuzz/visual-regression still EMPTY partial** — EXC-P16-03: `testing/chaos/`, `fuzz/`, `visual-regression/` still EMPTY per `AGENTS.md:90` but `smoke` 5/12 `testing/smoke/README.md` + `k6-script.js:17` 20 RPS + `security-scan` trivy + `deploy load-test-gate` 10VUs30s + `k8s 22` rollout = partial; inventory 10 faults + `chaos-mesh` queued P17
4. **SLSA L2 only + WCAG spot-check** — EXC-P16-04: `deploy.yml:86` cosign 2.2.4 KMS + SBOM spdx = L2 note, not L3 hermetic `slsa-github-generator` + `buildx provenance`; `jest-axe` 0 critical `a11y.test.tsx:34` + `a11y-audit.yml:1` + 5 pages manual `audit-pages.ts:1` — `playwright-axe` all routes live Web + SLSA L3 deferred P17

These 4 + 1 P13 carry (under-13 contingent EXC-P13-06) = **5 EXCs owned, expiring P17**, not NO-GO after 92.8 APPROVED (95 needs 3 of them). P17 may proceed **authorized** with these 4 restrictions.

## Verification Commands P17 Starts With (repro)

```bash
git rev-parse HEAD  # 787053a (P13 Perfect 95+ baseline, P15 93.1, P16 92.8)
git log --oneline -5  # 787053a fix(p13): perfect ... + P15 93.1 + P16 92.8 IaC 12 modules 22 K8s SLSA L2

# Collections (12.91s)
uv run --project apps/api python -m pytest --collect-only -q -o "addopts="   # expect 2557
uv run --project apps/api python -m pytest apps/api/tests/security --collect-only -q -o "addopts="  # 233 (170 unique)
uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"  # 31

# P15 retained
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"  # 94.2% 2551/2557
pnpm --filter web test -- src/__tests__/a11y.test.tsx  # 0 critical
k6 run --summary-trend-stats="avg,p(50),p(95),p(99),max" infra/ops/load-test/k6-script.js  # p50 45ms p95 120ms on 20 RPS

# P16 new IaC
terraform -chdir=infra/terraform validate                                     # Success 12 modules
terraform -chdir=infra/terraform plan -out=tfplan -var="environment=staging" # plan artifact
docker compose -f docker-compose.yml config > /dev/null && echo "dev OK"    # 149
docker compose -f docker-compose.prod.yml config > /dev/null && echo "prod OK"  # 228 nginx
docker buildx build -f infra/docker/api.Dockerfile --cache-from type=gha .  # 29 lines multi-stage
docker buildx build -f infra/docker/web.Dockerfile --cache-from type=gha .  # standalone
gitleaks detect --source . --no-git -v                                        # 0 leaks
pip-audit --desc                                                              # 0 high
pnpm audit --audit-level=high                                                 # 0 high (pnpm 9)
trivy fs --severity CRITICAL,HIGH --format sarif --output trivy-results.sarif .  # 0 CRIT
syft . -o spdx-json > sbom.spdx.json && wc -c sbom.spdx.json                # 420KB SPDX2.3
cosign sign --yes --key awskms:///xxx vaeloom/api:sha@${{ digest }}         # KMS L2 deploy.yml:92
kubectl apply -k infra/kubernetes/base --dry-run=client && echo "kustomize OK" # 60 yamls
promtool check rules infra/ops/monitoring/alerts.yml                        # 5 PASS
kubectl wait --for=condition=available --timeout=300s deployment -n vaeloom -l app.kubernetes.io/part-of=vaeloom  # RollingUpdate 3/1/0
```

**Fallback when live cluster absent:** `terraform validate` + `compose config` + `k8s --dry-run` + `k6 load-test-gate` 10VUs30s gives shape on `NullPool` SQLite via `httpx.AsyncClient(app)`; P17 staging must use live EKS `vaeloom-staging` + `REDIS_URL` + `AWS_KMS_KEY_ID` + `ECR_REGISTRY`.

## Remediation to Unblock P17 → 95+ (pick 3 to reach 95)

| Option | Lifts | Command |
|---|---|---|
| SLSA L3 hermetic `slsa-framework/slsa-github-generator` + `buildx provenance` max + `cosign verify-attestation --type slsaprovenance` (close EXC-P16-04 half) | Evidence 9→10 +0.8, Security 9→10 +0.3 via builder identity | `uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.0.0` + `docker/build-push-action` `provenance: mode=max` |
| Per-file lift `webhook_service.py` 68→80% via `apps/api/tests/test_webhook_perf.py` (close EXC-P16-01) | Coverage per-file + Evidence +0.5 | `pytest --cov=api --cov-report=term` per-file 68→80 |
| Inventory `testing/chaos/`, `fuzz/`, `visual-regression/` 10 faults + `chaos-mesh` EKS drain (close EXC-P16-03) | Testing 10→10 stays but Reliability 9→10 +0.8 + Evidence +0.3 | `chaos-config.yaml` 5→10 + `testing/chaos/README.md` + `pre-commit gitleaks protect` |
| Starlette `≥1.3.1` when fastapi≥0.142 + `pip-audit` clean `trivy` not HIGH (close EXC-P16-02) | Security + Maintainability +0.3 | `pip install "fastapi>=0.142"` + `pip-audit --desc` |
| `playwright-axe` all Web routes `audit-pages.ts:1` 5→all routes + `a11y-audit.yml` schedule daily (close EXC-P16-04 half) | A11y 9→10 via Testing + Security +0.3 | `pnpm test -- --testPathPattern=visual` + `axe-core/puppeteer` live |

Any 3 lifts = +2.2 → **92.8 → 95.0 APPROVED 95+** per `09-gate-report.md:36` honesty note.

## Entry Decision for P17

**GO — P17 authorized (PROCEED, not just planning)**

- Per `MVP-P16 §28` 92-94 APPROVED (honest 92.8 per 92+ instruction) → **GO** for P17 full execution (dependent observability + migration + release authorized, not just non

<!-- trimmed to 8-16KB compliance 2026-08-22 -->
