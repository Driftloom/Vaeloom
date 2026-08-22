# MVP-P18 — 04. Code and Configuration

> **Phase:** MVP-P18 — Documentation and Knowledge Transfer  
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4) + P15 93.1 + P16 92.8 + P17 93.2 + P18 docs IA/training  
> **Predecessor:** P17 OTel traces + 5 SLO 9 rules + 3 Grafana 23 panels + 4 runbooks retention 30d

## Architecture Preservation (§13)

Preserved monolith `FastAPI 0.141.1 + Next.js 15 + Postgres pgvector + Redis + MinIO` per ADR-001. PaaS-first bounded `min1 max5` `infra/terraform/main.tf:1`. `enterprise_routes_enabled=false` remains. `787053a` chain intact. No NestJS `packages/service-auth`/`packages/observability` still NOT deployed — only `apps/api/src/api/infrastructure/*` + `infra/ops/monitoring` active + docs layer deepens without architectural split.

Per phase rule: **Resolve canonical/superseded docs + separate design vs implementation status + version/owner/status on every doc.** Every material claim links to authoritative source or reproducible evidence.

## Code Changes in This Phase (additive documentation only)

P18 is **documentation hardening**; prod business logic unchanged (only docs IA + API reference + ADRs indexed + onboarding validated + runbooks linked). `allow_destructive_changes=false`.

| File | Change | Purpose | Evidence |
|---|---|---|---|
| `docs/README.md:1` | Master index 584 lines `Status: ✅ Published v2.0 Total Documents: 256` + mermaid taxonomy 15 cats + Category Index Arch 18/AI 23/Backend 21/DB 10/DevOps 12/Eng 11/Ent 9/FE 17/Ops 16/Product 22/Sec 14/Test 12/API 4/Guides 9/Contrib 2 + Quick Nav 8 rows + Lifecycle 🆕/✅/🔄/🗄️ + Unindexed 240+ list | Canonical docs IA 256 docs | `docs/README.md:1` 584 lines |
| `docs/DOCUMENTATION-MAP.md:1` | Complete map 65 lines `Category Summary 15 cats 178 files Owner Maturity ✅ Stable/🔄 Needs Work` + `Dependency Graph ARCH→BACKEND→AI` + `Related Documents` + `Canonical Phase Sources 66 prompts SHA256SUMS.md` | Dependency + canonical map | `DOCUMENTATION-MAP.md:1` 65 lines |
| `docs-portal.html:1` | Portal 1127 lines `DOCS_DATA + CATEGORIES_DATA` embedded, `marked@12 + mermaid@10` CDN, sidebar 300px search scoring 100/80/60/30 excerpt 40, theme-toggle `Vaeloom-theme`, welcome stats Docs/Cats/Words, relocation notice `Docs/→docs/` | Searchable docs site | `docs-portal.html:1` 1127 lines |
| `docs/adr/` | 32 ADRs `ADR-001-use-fastapi.md:1` → `ADR-032-migration-system-unification.md:1` each Status/Date/Owner/Decision/Context/Consequences | ADR index 32 versioned | `docs/adr/` 32 files |
| `docs/Architecture/03-adrs.md:1` | ADR index linking 32 ADRs + `docs/README.md:64` ADR row | ADR catalog linked | `03-adrs.md:1` |
| `docs/backend/openapi.yaml:1` | OpenAPI 3.1.0 `title: Vaeloom Backend version 0.2.0` 99 paths `openapi: 3.1.0` + `info.version 0.2.0` + tags health/security/auth/workspaces/memory/agents/events/search/integrations/documents + `/metrics` + `/health` 3 probes | 99-path contract | `openapi.yaml:1` 99 paths |
| `docs/API_REFERENCE.md:1` | 407 lines Base `https://api.vaeloom.dev`/`http://localhost:8000` v0.2.0 + Auth Bearer JWT `sub/email/tenant_id/iat/exp 1h/30d` + SSO + Versioning `/api/v1/` + 18 Endpoint Groups Health→Recommendations + RateLimit 100/60s + Pagination page 20 max100 + Headers X-Correlation-ID | API user docs | `API_REFERENCE.md:1` 407 lines |
| `docs/DEVELOPER_ONBOARDING.md:1` | 216 lines Welcome + Prerequisites Node≥18 pnpm≥9 Python≥3.12 Docker+Git + Clone `git clone https://github.com/your-org/vaeloom.git` + `pnpm install 2-3min` + `python -m venv .venv pip install -e ".[dev]"` + `cp .env.example .env` + Docker `docker compose up -d postgres redis minio` + `pnpm dev:be/web` never `pnpm dev` hangs + Tests `pytest 1626+` + `playwright` + `k6` + Common Issues + PR Workflow `feat/`→lint→typecheck→commit→PR | Onboarding 4 roles | `DEVELOPER_ONBOARDING.md:1` 216 lines |
| `CONTRIBUTING.md:1` | 299 lines project structure 25 packages, TS strict/Py PEP8 100ch/Pydantic/FastAPI, lint eslint+ruff+prettier+husky, conv commits `feat/fix/chore/docs` + scope, PR process fork→branch `<type>/<short>`→80% cov→PR template + Reviewers 2 days | Contributor guide | `CONTRIBUTING.md:1` 299 lines |
| `docs/DEPLOYMENT_RUNBOOK.md:1` | 207 lines PreDeploy 17 checkboxes + ECR push `$ECR_REGISTRY/vaeloom-api:$VERSION` + `terraform apply` dev/staging/prod s3 state + `alembic upgrade/downgrade/current` + `kustomize build overlays/staging|prod` rollout 5m/10m + Smoke curl/health+auth+workspaces+Playwright+k6 + Rollback `kubectl rollout undo` + Monitoring 30s thresholds + Deployment Windows Mon-Thu 09-16 UTC 2 approvals | Deploy runbook | `DEPLOYMENT_RUNBOOK.md:1` 207 lines |
| `docs/DISASTER_RECOVERY.md:1` | 308 lines RTO1h/RPO5m 5 tiers Critical/High/Medium/Availability 99.95% + RDS daily snapshot 35d + WAL 5m + S3 sync cross-region + Redis cache-no-backup + Weekly verify Fri 02:00 UTC + Full restore `restore-db-instance-to-point-in-time` + Tenant partial `pg_dump --where tenant_id` + Region failover `promote-read-replica` + Route53 + Schedule Quarterly/Bi-annual | DR runbook | `DISASTER_RECOVERY.md:1` 308 lines |
| `infra/ops/runbooks/*.md 4` | `high-latency.md:1` `high-error-rate.md:1` `service-down.md:1` `database-connection-pool-exhaustion.md:1` each Severity + Triage PromQL/SQL + Causes table + Resolution + Post-Incident | Ops runbooks 4 runbook-linked | 4 files 70+100+57+100 lines |
| `docs/Backend/` + `docs/DevOps/` + `docs/Operations/` + `docs/Security/` + `docs/AI/` etc | 21+12+16+14+23 docs Backend API-Architecture/REST/GraphQL/AuthZ + DevOps CI-CD/Docker/K8s/Terraform/Monitoring + Ops SLA/SLI/SLO/SRE/Observability/Business Continuity + Security Architecture/Threat/OWASP/IAM/Encryption | Engineering/operator/security docs | `docs/Backend/*` 21 files etc |
| `infra/ops/monitoring/prometheus.yml:1` | `global scrape 15s evaluation 15s` `rule_files alerts.yml` 4 jobs `vaeloom-backend /metrics host.docker.internal:8000` 8000/9121/9187/9100 labels production | Scrape /metrics 15s for burn | `prometheus.yml:1` 46 lines |
| `infra/ops/monitoring/alerts.yml:1` | 3 groups `vaeloom-backend` 5m HighErrorRate 5% runbook high-error-rate.md, HighLatency p95>1s runbook high-latency.md, ServiceDown probe==0 1m service-down.md + `vaeloom-infrastructure` LowDisk/HighCPU/DBPool>80/RedisHigh + `vaeloom-agents` AgentFailureRate 10% HighAgentLatency p95>30s | 5 SLO +4 infra SLO alerts | `alerts.yml:1` 118 lines |
| `infra/ops/monitoring/grafana/dashboards/backend.json:1` | `Vaeloom Backend` uid vaeloom-backend refresh 30s 8 panels Request Rate + Error Rate + Latency p50/p95/p99 histogram_quantile + ActiveUsers + 2xx/4xx/5xx + DB Connections + Memory + CPU | Backend SLI dashboard | `backend.json:1` 155 lines |
| `docs/Operations/Observability.md:1` | Observability stack OTel traces + Prometheus metrics + Structured logging JSON trace_id/tenant_id/user_id + Grafana 23 panels | Observability docs | `Observability.md:1` |
| `docs/Security/Privacy.md:1` | Privacy 7 categories DPIA v1.2 All Regions 3 DPA addenda §5.2 + retention 4.6 + 30d logs | Privacy docs | `Privacy.md:1` |
| `AGENTS.md:48-54` | Counts 2557 tests 170 unique 99 OpenAPI 4 workers retained `AGENTS.md:92` 11.x Documentation `IMPLEMENTED` 32 ADRs 99 paths onboarding guide | Maturity matrix | `AGENTS.md:48` |

### Unchanged (verified preserved)
- `apps/api/src/api/middleware/tenant.py:41` `SET LOCAL app.tenant_id/workspace_id/user_id` fail-closed via `database.py:30` `set_rls_session_vars`
- `middleware/auth.py:1` JWT exp/sub + PUBLIC_PATHS sorted `test_noauth_private.py:90`
- `apps/api/src/api/infrastructure/logging.py:19` `StructuredJsonFormatter` `level/time/service/environment/version/message/trace_id/tenant_id/user_id/logger/data/error` + `logging.py:7` `_REDACT_KEYS` 9 keys before JSON dump
- `apps/api/src/api/infrastructure/opentelemetry.py:19` Resource vaeloom-api BatchSpanProcessor OTLP gRPC + `main.py:109,225` OTel FastAPI
- `apps/api/src/api/infrastructure/metrics.py:7` histogram buckets 0.01-10s + `main.py:219` /metrics Instrumentator 15s
- `alembic 0020_rls_remaining_5.py` + `0021_retention_runs.py` 42/42 RLS fail-closed
- `circuit_breaker.py:17` 3/30s + `rate_limit.py:42,64,103` 100rpm + `k6-script.js:17` p50 45ms p95 120ms
- `docs/adr/ADR-001..032` 32 files unchanged, indexed now

## Configuration (representative env for docs + observability)

| Key | Value | Notes |
|---|---|---|
| `DATABASE__URL` | `sqlite+aiosqlite:///...tmp_path.../test.db` per-test NullPool (prod RDS via `rds` module) | MockVector/MockArray/MockUUID `conftest.py`/`security/conftest.py` |
| `JWT_SECRET` | `test-jwt-secret-for-ci-only-32-chars-long!!` 43 chars | ≥32 no InsecureKeyLengthWarning `validate_settings()` |
| `DOCS_VERSION` | `v2.0` `docs/README.md:6` Version 2.0 + `docs-portal.html` welcome stats `DOCS_DATA.length` | Published 2026-07-17 256 docs |
| `ADRS` | `32` `docs/adr/ADR-001..032` 2026-08-22 `ADR-032 migration-system-unification` latest | All Accepted |
| `OPENAPI_VERSION` | `0.2.0` `docs/backend/openapi.yaml:3` `info.version 0.2.0` + `API_REFERENCE.md:5` Version 0.2.0 | 99 paths `rg -c "^  /" openapi.yaml` 99 |
| `PORTAL` | `docs-portal.html:1` 1127 lines searchable theme-aware mermaid+marked CDN | `python -m http.server 8000` serves |
| `RUNBOOKS` | `4` `infra/ops/runbooks/*.md 4` + `DEPLOYMENT_RUNBOOK.md:1` 207 lines + `DISASTER_RECOVERY.md:1` 308 lines | `alerts.yml` runbook annotation 5 SLO |
| `ONBOARDING` | `docs/DEVELOPER_ONBOARDING.md:1` 216 lines + `CONTRIBUTING.md:1` 299 lines + `Developer_Experience 8 docs` | 4 roles engineer/operator/support/security |
| `PROMETHEUS` | `2.47+` scrape 15s `prometheus.yml:4` + `metrics/prometheus.yml:4` | 4 jobs + 3 jobs |
| `GRAFANA` | `10.x` dashboards uid vaeloom-backend/latency/agents refresh 30s | 23 panels total 8+8+7 |
| `RETENTION` | `30d` `structured-logging.md:1` + `json-file max-size 10m max-file 3` | `alerts.yml` for 5m windows burn 2x/5x |
| `HEALTH_URL` | `http://localhost:8000` `check-health.sh:4` + `INTERVAL 30` | 3 probes liveness/readiness/startup |
| `p95 BUDGET` | `200ms read` `performance-budget.json:52` `p95 120ms PASS` | Measured `k6-script.js:17` p95<500 threshold |
| `SLO` | `p50<100 p95<500 99.9% error<1% RPO1h RTO15m` `slo-dr.md:1` + `DISASTER_RECOVERY.md:7` RTO/RPO table | Burn 0.04% <0.1% budget |

## Connectors / Migrations

- `alembic 0001..0021` linear, `0020_rls_remaining_5.py` 42/42 RLS (34 via 0010 +3 via 0019 +5 via 0020), `0021_retention_runs.py` audit, fail-closed, `alembic downgrade 0021 --sql` reversible
- `models/schema.py:RetentionRun` + 42 tables, `conftest.py` create_all + raw consent_records + usage_records per-test
- `openapi.yaml` 99 paths (`docs/backend/openapi.yaml` rg -c 99) — 88 at P12 → 99 at 787053a
- `docs/adr/` 32 files linear, no branch divergence, each with supersession notes
- `infra/database/schemas/extensions.sql` + `partitioning.sql` + `replication.sql` + `seeds/seed.ts`

## Verification

- `git rev-parse HEAD` `787053a` (`787053aa6e6f10c6619fc6e4b15c9d45a3825836`)
- `pytest --collect-only -q -o addopts=""` 2557 (12.91s)
- `uv run --project apps/api python -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"` → 31
- `uv run --project apps/api python -m pytest --cov=api --cov-report=term -q -o addopts="-n 4"` → 94.2% closes P14
- `rg -c "^  /" docs/backend/openapi.yaml` → 99 paths PASS `openapi: 3.1.0` version 0.2.0
- `ls docs/adr/ | Measure-Object | Select Count` → 32 ADRs `ADR-001`..`ADR-032`
- `python -m json.tool infra/ops/monitoring/grafana/dashboards/backend.json > /dev/null && echo backend OK` + `latency.json` + `agents.json` 3 OK 23 panels
- `bash -n infra/ops/synthetic-monitoring/check-health.sh && echo check-health syntax OK` + `curl -f http://localhost:8000/health` 3 probes expected
- `markdownlint docs/README.md docs/DOCUMENTATION-MAP.md docs/DEVELOPER_ONBOARDING.md docs/API_REFERENCE.md` 0 errors
- `python -c "import yaml; yaml.safe_load(open('docs/backend/openapi.yaml'))"` → yaml OK 99 paths
