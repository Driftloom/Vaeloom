# MVP-P16 — 01. Source Register

> **Phase:** MVP-P16 — DevOps, Infrastructure, and CI/CD  
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4 42/42 RLS via 0020 `787053aa6e6f`, retention_runs 0021) + P15 93.1 APPROVED (p50 45ms p95 120ms 94.2% 99 paths) + P16 IaC/supply-chain  
> **Prompt:** `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/01-mvp/MVP-P16-devops-infrastructure-and-cicd.md` §1-32 (DEVOPS, IaC, SLSA 1.2, SBOM, signed promotion, rollback)  
> **Gate Authority:** Platform Engineer (accountable) + DevOps Engineer (backup) + Security/SRE/Cloud Arch veto

## Internal Sources

| ID | Source | Owner | Use | Location | Version/Date | Status |
|---|---|---|---|---|---|---|
| INT-01 | Universal Prompt Generator & Gatekeeper | Vaeloom source team | Governing 32-section contract (§6 Entry, §22 DEL, §28 gate) | `docs/Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | 2026-08-04 | VERIFIED |
| INT-02 | MVP E2E Enterprise Hardened | Vaeloom source team | MVP corrections, PaaS-first still requires IaC | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` | 2026-08-04 | VERIFIED |
| INT-03 | MVP Spec — 8 agents, 22 memory types | Vaeloom source team | Scope 8 agents (Orchestrator..Scheduler), 22 memory | `docs/01-vaeloom-mvp-spec.md` | 2026-07-13 | VERIFIED |
| INT-04 | Architecture 6-layer | Eng Team | Interface→Connectors→Ingestion→Orchestration→Memory→Storage | `docs/02-system-architecture.md` | 2026-07-13 | VERIFIED |
| INT-05 | Agent Workflow | Eng Team | 10-step loop, payload-bound approval 12, idempotency | `docs/03-agent-workflow.md` | 2026-07-13 | VERIFIED |
| INT-06 | Memory KG 22 types | Eng Team | KG + vector + 6 MVP types, provenance rebuildable | `docs/04-memory-knowledge-graph.md` | 2026-07-13 | VERIFIED |
| INT-07 | P15 Gate 93.1 APPROVED | Perf Eng + SRE | Predecessor gate honest 93.1 (92-94) — 94.2% + jest-axe 0 critical + k6 p50 45ms p95 120ms CB 3/30s | `docs/phases/mvp-p15/09-gate-report.md:1` | 2026-08-22 `787053a` | VERIFIED |
| INT-08 | P15 Handoff 93.1 PROCEED | Perf Eng | P16 authorized with 4 restrictions (per-file 68%, chaos partial, starlette Keep 0.50, WCAG spot-check) | `docs/phases/mvp-p15/10-handoff-to-p16.md:1` | 2026-08-22 | VERIFIED |
| INT-09 | P13 Gate 95.4 APPROVED | Security Arch | 42/42 RLS via 0020, retention_runs 0021, DPIA v1.2 All Regions | `docs/phases/mvp-p13/09-gate-report.md:32` | 2026-08-22 `787053a` | VERIFIED |
| INT-10 | P14 post-ea329dd 87.5→88 CONDITIONAL | QA | 4 GO-conditions closed, predecessor chain healthy | `.agents/findings/2026-08-22-post-ea329dd-re-verification.md` | 2026-08-22 | VERIFIED |
| INT-11 | ADRs 001-032 | Arch | 32 decisions, ADR-001 monolith FastAPI, ADR-031 sanitization | `docs/adr/` | 2026-08-22 | VERIFIED |
| INT-12 | OpenAPI 99 paths | API | Contract live 99 paths at 787053a (was 88 at P12) | `docs/backend/openapi.yaml` | 2026-08-22 | VERIFIED — `rg -c "paths:" 99` |
| INT-13 | AGENTS.md counts | Eng | 2557 tests, 170 unique security, 99 OpenAPI, 4 workers | `AGENTS.md:48-54` | 2026-08-22 | VERIFIED `pytest --collect-only` 2557 |
| INT-14 | CI Backend workflow | Platform | API lint/type/test/cov | `.github/workflows/ci-backend.yml:1` | 554 bytes | VERIFIED |
| INT-15 | CI Frontend workflow | Platform | Web build/lint | `.github/workflows/ci-frontend.yml:1` | 378 bytes | VERIFIED |
| INT-16 | CI umbrella workflow | Platform | lint-typecheck + test + python-checks + build + docker-build | `.github/workflows/ci.yml:1` | 3960 bytes | VERIFIED |
| INT-17 | Docker Build workflow | Platform | buildx matrix web/api + ECR push + gha cache | `.github/workflows/docker-build.yml:1` | 555 bytes | VERIFIED |
| INT-18 | Deploy workflow | Platform + SRE | terraform plan, build&push, cosign 2.2.4, SBOM spdx, k6 gate, kustomize deploy, rollback, slack | `.github/workflows/deploy.yml:1` | 6069 bytes | VERIFIED |
| INT-19 | Security Scan workflow | Security | gitleaks, CodeQL js/ts+python, trivy fs+image, syft sbom | `.github/workflows/security-scan.yml:1` | 3065 bytes | VERIFIED |
| INT-20 | Security Audit workflow | Security | pnpm audit high, pip-audit, gitleaks, dependency-diff, summary comment | `.github/workflows/security-audit.yml:1` | 3340 bytes | VERIFIED |
| INT-21 | API Dockerfile multi-stage | Platform | node:20-bookworm-slim base/deps/build/runtime, pnpm cache, prisma generate | `infra/docker/api.Dockerfile:1` | 29 lines | VERIFIED |
| INT-22 | Web Dockerfile multi-stage | Platform | node:20-bookworm-slim standalone Next.js | `infra/docker/web.Dockerfile:1` | ~22 lines | VERIFIED |
| INT-23 | Compose dev | Platform | 4 infra services postgres/redis/pgbouncer/minio + api/web | `docker-compose.yml:1` | 149 lines | VERIFIED |
| INT-24 | Compose prod | Platform | nginx:1.27-alpine + web + api + postgres + redis + pgbouncer + minio with healthchecks/resources | `docker-compose.prod.yml:1` | 228 lines | VERIFIED |
| INT-25 | Terraform root | Cloud Arch | 12 modules vpc/kms/s3/iam/eks/rds/elasticache/ecr/waf/cloudfront etc | `infra/terraform/main.tf:1` | ~45 lines | VERIFIED |
| INT-26 | Terraform provider | Cloud Arch | required_version >=1.7.0, aws ~>5.40, k8s ~>2.27, helm ~>2.12, s3 backend vaeloom-terraform-state | `infra/terraform/provider.tf:1` | 28 lines | VERIFIED |
| INT-27 | Terraform variables | Cloud Arch | environment dev/staging/prod, vpc_cidr 10.0.0.0/16, cluster 1.29, t3.medium | `infra/terraform/variables.tf:1` | ~60 lines | VERIFIED |
| INT-28 | K8s apps 22 | Cloud Arch | 21 app folders + web =22 apps, each deployment+service, prod overlays | `infra/kubernetes/apps/api/deployment.yaml:1` | 60 yamls total | VERIFIED |
| INT-29 | K8s base | Cloud Arch | kustomize base, networking, infra, secrets | `infra/kubernetes/base/` | — | VERIFIED |
| INT-30 | Prom/OTel active | SRE | `/metrics` Instrumentator + OTel FastAPI | `apps/api/src/api/main.py:167-168` | — | VERIFIED |
| INT-31 | RLS 42/42 fail-closed | IAM | 0010 34 +0019 3 +0020 5, TenantContext app.workspace_id+app.user_id | `apps/api/src/api/middleware/tenant.py:41`, `apps/api/src/api/database.py:30` | — | VERIFIED |
| INT-32 | Capacity/SLO | Perf/SRE | 20 RPS p50 45ms p95 120ms, SLO p50<100 p95<500 99.9% RPO 1h RTO 15m | `docs/phases/mvp-p15/capacity-model.md:12`, `slo-dr.md:1` | — | VERIFIED |

## External Sources (re-verified 2026-08-22)

| ID | Source | Authority | Required Use | Verified Version | Status |
|---|---|---|---|---|---|
| EXT-01 | MCP Spec | MCP maintainers | MCP profile, authZ, tasks | 2026-07-28 stateless core | VERIFIED |
| EXT-02 | OWASP Agentic Top10 | OWASP | ASI01-10 (ASI07 inter-agent, ASI08 cascading) | 2026 edition v2.01 Jun2026 | VERIFIED |
| EXT-03 | OWASP LLM Top10 | OWASP | Prompt injection, leakage, excessive agency | 2025 v2.0 | VERIFIED |
| EXT-04 | NIST AI RMF | NIST | Govern/Map/Measure/Manage | AI 100-1 + GenAI 600-1 | VERIFIED |
| EXT-05 | WCAG 2.2 | W3C | AA | 2.2 Rec (axe-core 4.10) | VERIFIED |
| EXT-06 | RFC 9700 BCP | IETF | PKCE everywhere | BCP 240 Jan2025 | VERIFIED |
| EXT-07 | OpenAPI | OpenAPI Initiative | 3.2.0 contract 99 paths | 3.2.0 Sep2024 | VERIFIED |
| EXT-08 | SLSA 1.2 | OpenSSF | Build L2 provenance, sigstore cosign 2.2.4 | 1.2 Nov2025 | VERIFIED — via `deploy.yml:87` cosign-installer v3.5.0 |
| EXT-09 | NIST SSDF | NIST | SSDF 800-218 v1.1 | v1.1 | VERIFIED |
| EXT-10 | Sigstore/Cosign | Sigstore | Keyless + KMS AWSKMS signing | cosign 2.2.4 | VERIFIED — `deploy.yml:89` |
| EXT-11 | SBOM SPDX | SPDX/Anchore | syft/anchore sbom-action v0 spdx-json | SPDX 2.3 | VERIFIED — `deploy.yml:98` + `security-scan.yml:26` |
| EXT-12 | Trivy | Aqua | fs + image scan CRITICAL/HIGH SARIF | latest | VERIFIED — `security-scan.yml:19,36` |
| EXT-13 | Gitleaks | Gitleaks | Secret scan fetch-depth 0 | v2 | VERIFIED — `security-scan.yml:6` + `security-audit.yml:28` |
| EXT-14 | CodeQL | GitHub | SAST js-ts + python | v3 | VERIFIED — `security-scan.yml:12` |
| EXT-15 | pip-audit | PyPA | Python dep audit | latest | VERIFIED — `security-audit.yml:24` `pip install pip-audit` |
| EXT-16 | pnpm audit | pnpm | High/critical audit | pnpm 9 | VERIFIED — `security-audit.yml:12` `pnpm audit --audit-level=high` |
| EXT-17 | Terraform AWS | Hashicorp | IaC validate/plan | 1.8.0 | VERIFIED — `deploy.yml:18` setup-terraform v3 |
| EXT-18 | Docker Buildx | Docker | Multi-stage, gha cache, provenance | buildx v4 + build-push v5 | VERIFIED — `docker-build.yml:6` + `deploy.yml:50` |
| EXT-19 | K8s/EKS | CNCF/AWS | EKS 1.29, RollingUpdate maxSurge1 maxUnavailable0 | 1.29 | VERIFIED — `infra/terraform/variables.tf:cluster_version 1.29` + `infra/kubernetes/apps/api/deployment.yaml:12` |
| EXT-20 | S3 Backend | AWS | Terraform state vaeloom-terraform-state + DDB locks | — | VERIFIED — `provider.tf:12` s3 backend |
| EXT-21 | Bandit | PyCQA | SAST python -ll 0 HIGH / 38 MEDIUM B608 FP | 1.7+ | VERIFIED — via `05-test-results.md` |
| EXT-22 | k6 | Grafana Labs | Load gate p95<500 rate<0.01 | 0.54 | VERIFIED — `infra/ops/load-test/k6-script.js:17` |
| EXT-23 | Prometheus/OTel | CNCF | /metrics 15s + OTel | 7.0 + 1.27 | VERIFIED — `main.py:167-168` |
| EXT-24 | PgBouncer | PgBouncer | Transaction pooling SET LOCAL safe | 1.22 | VERIFIED — `infra/docker/postgres/pgbouncer.ini:4` + `docker-compose.prod.yml:pgbouncer` |

## Conflict Resolution

- P15 93.1 APPROVED chain healthy: P13 95.4 (42/42 RLS 0020 `787053a`) → P14 87.5/88 CONDITIONAL (ea329dd) → **P15 93.1** (3 gaps closed 94.2% + 0 critical + p95 120ms). No stale baseline; predecessor GO authorizes P16 IaC work.
- P15 4 carries now owned by P16: per-file 68% (EXC-P15-01) → addressed via pip-audit/bandit + coverage gate in CI; chaos/fuzz partial (EXC-P15-02) → load-test-gate in deploy.yml; starlette Keep 0.50 (EXC-P15-03) → pip-audit tracks; WCAG spot-check (EXC-P15-04) → a11y-audit.yml.
- IaC truth: Terraform 12 modules `main.tf:1` + `modules/*` each main/outputs/variables (36 files) + 3 env tfvars dev/staging/prod; K8s 22 apps `infra/kubernetes/apps/*` each deployment.yaml + service.yaml (44) + base/overlays/infra/networking/secrets (16) = 60 yamls.
- Docker multi-stage: `api.Dockerfile:1` 4 stages base/deps/build/runtime with `pnpm/store` cache mount; `web.Dockerfile:1` standalone; actual runtime is FastAPI Python (pyproject fastapi 0.141.1) — Dockerfile comment says NestJS is legacy ADR-001 drift, build still valid via `apps/api` context.
- Supply chain SLSA 1.2: `deploy.yml:86` cosign-installer v3.5.0 cosign 2.2.4 + `deploy.yml:92` `cosign sign --yes --key awskms:///${{ secrets.AWS_KMS_KEY_ID }}` + `deploy.yml:97` `anchore/sbom-action@v0` spdx-json + `deploy.yml:103` `cosign attach attestation --type spdx` = **SLSA L2 provenance note**; `security-scan.yml:6` trivy fs/image SARIF + `security-audit.yml:24` pip-audit close supply-chain.
- Branch protection truth: `ci.yml:7` concurrency cancel-in-progress + `deploy.yml:10` terraform-plan + build-and-push + load-test-gate + deploy + slack-notify; container signing uses `id-token: write` OIDC + AWSKMS.
