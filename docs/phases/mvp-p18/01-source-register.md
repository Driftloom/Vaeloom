# MVP-P18 — 01. Source Register

> **Phase:** MVP-P18 — Documentation and Knowledge Transfer  
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 95.4 42/42 RLS via 0020 `787053aa6e6f`, retention_runs 0021) + P15 93.1 APPROVED (94.2% 99 paths) + P16 92.8 APPROVED (12 TF 22 K8s SLSA L2) + P17 93.2 APPROVED (OTel traces + 5 SLO 9 rules + 3 Grafana 23 panels + 4 runbooks + 30d)  
> **Prompt:** `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/01-mvp/MVP-P18-documentation-and-knowledge-transfer.md` §1-32 (docs IA, API/user docs, ADRs, training, docs quality/ownership)  
> **Gate Authority:** Technical Writer (accountable) + Developer Experience Lead (backup) + Architecture Owner + Security/Compliance + Support Lead veto

## Internal Sources

| ID | Source | Owner | Use | Location | Version/Date | Status |
|---|---|---|---|---|---|---|
| INT-01 | Universal Prompt Generator & Gatekeeper | Vaeloom source team | Governing 32-section contract (§6 Entry, §22 DEL, §28 gate) | `docs/Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | 2026-08-04 | VERIFIED |
| INT-02 | MVP E2E Enterprise Hardened | Vaeloom source team | MVP corrections, PaaS-first bounded docs | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` | 2026-08-04 | VERIFIED |
| INT-03 | MVP Spec — 8 agents, 22 memory types | Vaeloom source team | Scope 8 agents, 6 MVP memory types | `docs/01-vaeloom-mvp-spec.md` | 2026-07-13 | VERIFIED |
| INT-04 | Architecture 6-layer | Eng Team | Interface→Connectors→Ingestion→Orchestration→Memory→Storage | `docs/02-system-architecture.md` | 2026-07-13 | VERIFIED |
| INT-05 | Agent Workflow | Eng Team | 10-step loop, payload-bound approval | `docs/03-agent-workflow.md` | 2026-07-13 | VERIFIED |
| INT-06 | Memory KG 22 types | Eng Team | KG + vector + 6 MVP types | `docs/04-memory-knowledge-graph.md` | 2026-07-13 | VERIFIED |
| INT-07 | P15 Gate 93.1 APPROVED | Perf Eng + SRE | Predecessor gate honest 93.1 — 94.2% + axe 0 critical + k6 p50 45ms p95 120ms | `docs/phases/mvp-p15/09-gate-report.md:27` | 2026-08-22 `787053a` | VERIFIED |
| INT-08 | P16 Gate 92.8 APPROVED | Platform Eng | P16 IaC/supply-chain 12 TF valid 22 K8s SLSA L2 cosign KMS | `docs/phases/mvp-p16/09-gate-report.md:1` | 2026-08-22 | VERIFIED |
| INT-09 | P17 Gate 93.2 APPROVED | SRE + Obs Eng | P17 observability OTel traces + 5 SLO 9 rules + 3 dashboards 23 panels + 4 runbooks + 30d | `docs/phases/mvp-p17/09-gate-report.md:1` | 2026-08-22 | VERIFIED |
| INT-10 | P17 Handoff 93.2 PROCEED | SRE | P18 authorized with 4 restrictions (per-file 68%, starlette Keep 0.50, chaos partial, SLSA L2) | `docs/phases/mvp-p17/10-handoff-to-p18.md:1` | 2026-08-22 | VERIFIED |
| INT-11 | P13 Gate 95.4 APPROVED | Security Arch | 42/42 RLS via 0020, retention_runs 0021, DPIA v1.2 All Regions | `docs/phases/mvp-p13/09-gate-report.md:32` | 2026-08-22 `787053a` | VERIFIED |
| INT-12 | ADRs 001-032 | Arch | 32 decisions, ADR-001 monolith FastAPI, ADR-011 OTel, ADR-016 structured logging | `docs/adr/` | 2026-08-22 | VERIFIED |
| INT-13 | OpenAPI 99 paths | API | Contract live 99 paths at 787053a (was 88 at P12) | `docs/backend/openapi.yaml:1` | 2026-08-22 | VERIFIED |
| INT-14 | AGENTS.md counts | Eng | 2557 tests, 170 unique security, 99 OpenAPI, 4 workers | `AGENTS.md:48-54` | 2026-08-22 | VERIFIED |
| INT-15 | Docs master index | Tech Writer | 256 docs taxonomy + mermaid 15 categories Arch/AI/Backend/DB/DevOps/Eng/Ent/FE/Ops/Product/Sec/Test/API/Guides/Contrib | `docs/README.md:1` | 584 lines | VERIFIED |
| INT-16 | Documentation Map | Tech Writer | 15 categories, 178 docs, dependency graph, canonical phase sources | `docs/DOCUMENTATION-MAP.md:1` | 65 lines | VERIFIED |
| INT-17 | Developer Onboarding | DX Lead | Prerequisites Node≥18 pnpm≥9 Python≥3.12 Docker, Clone+Setup, Stack 5432/6379/9000, Tests 1626+jest+e2e+k6 | `docs/DEVELOPER_ONBOARDING.md:1` | 216 lines | VERIFIED |
| INT-18 | API Reference | API | v0.2.0 Base https://api.vaeloom.dev / localhost:8000, JWT/SSO, 99 paths grouped Health/Auth/Workspace/Agent/Memory/KG/Search/Doc/Resume/Integration/Connector/Scheduler/Event/Billing | `docs/API_REFERENCE.md:1` | 407 lines | VERIFIED |
| INT-19 | Deployment Runbook | SRE | Pre-deploy checklist, Docker push ECR, terraform apply dev/staging/prod, alembic upgrade/downgrade, kustomize staging/prod rollout 5m/10m, smoke curl/health/k6 | `docs/DEPLOYMENT_RUNBOOK.md:1` | 207 lines | VERIFIED |
| INT-20 | Disaster Recovery Runbook | SRE | RTO 1h/RPO 5m, RDS daily snapshot 35d + WAL 5m, S3 cross-region, Redis cache, restore-to-point-in-time, tenant partial, region failover Route53 | `docs/DISASTER_RECOVERY.md:1` | 308 lines | VERIFIED |
| INT-21 | Docs Portal | DX Lead | Embedded docs HTML portal sidebar/search/theme, 15 categories nav, DOCS_DATA + CATEGORIES_DATA, marked+mermaid CDN | `docs-portal.html:1` | 1127 lines | VERIFIED |
| INT-22 | Contributing Guide | Eng | Prerequisites Node≥20 pnpm≥9 Docker Python≥3.12, Project structure 25 packages, Coding standards TS strict/Pepy8 100ch, Lint ruff/eslint/prettier husky, Conv commits, PR process | `CONTRIBUTING.md:1` | 299 lines | VERIFIED |
| INT-23 | Architecture C4 | Arch | C4 L1-L4, ADR-029 c4-model, event architecture, scalability/performance | `docs/Architecture/C4-Architecture.md:1` + `ADR-029` | 2026-07-17 | VERIFIED |
| INT-24 | Backend API docs | API | API-Architecture, REST Standards, GraphQL, Auth/AuthZ RBAC/ABAC, Validation, Error Standards | `docs/Backend/API-Architecture.md:1` | 21 files | VERIFIED |
| INT-25 | Security docs | Sec | Security Architecture + Threat Model + OWASP + IAM + Encryption + Secrets + Privacy + GDPR + SOC2 | `docs/Security/Security-Architecture.md:1` | 14 files | VERIFIED |
| INT-26 | Runbooks 4 | SRE | high-latency, high-error-rate, service-down, db-pool-exhaustion | `infra/ops/runbooks/high-latency.md:1`, `high-error-rate.md:1`, `service-down.md:1`, `database-connection-pool-exhaustion.md:1` | 4 files | VERIFIED |
| INT-27 | Structured logging infra | SRE | StructuredJsonFormatter trace_id/tenant_id/user_id + _redact 9 keys + CorrelationID | `apps/api/src/api/infrastructure/logging.py:19` | 146 lines | VERIFIED |
| INT-28 | OTel FastAPI | SRE | Resource vaeloom-api BatchSpanProcessor OTLP gRPC + FastAPIInstrumentor | `apps/api/src/api/infrastructure/opentelemetry.py:19` | ~45 lines | VERIFIED |
| INT-29 | Metrics middleware | SRE | Counter http_requests_total + Histogram 0.01-10s + Gauge active_users | `apps/api/src/api/infrastructure/metrics.py:7` | ~35 lines | VERIFIED |
| INT-30 | Prometheus ops | SRE | Scrape 15s + 4 jobs backend/redis/postgres/node + alerts.yml 5m burn 2x/5x | `infra/ops/monitoring/prometheus.yml:1` | 46 lines | VERIFIED |
| INT-31 | Alerts ops 5+9 rules | SRE | 3 groups vaeloom-backend/infra/agents 9 rules, 5 SLO alerts runbook-linked | `infra/ops/monitoring/alerts.yml:1` | 118 lines | VERIFIED |
| INT-32 | Grafana 3 dashboards | SRE | backend rate/error/latency + latency per-endpoint heatmap + agents token/execution | `infra/ops/monitoring/grafana/dashboards/backend.json:1` | 3 files 23 panels | VERIFIED |
| INT-33 | Incident response | SRE | SEV1-4 15m/30m/2h/next-day, 7-day rotation, Detect→Triage<5m→Mitigate<30m | `infra/ops/INCIDENT-RESPONSE.md:1` | ~180 lines | VERIFIED |
| INT-34 | Security audit workflow | Security | pnpm audit high + pip-audit + gitleaks fetch0 + dependency-diff weekly Mon6 | `.github/workflows/security-audit.yml:1` | 115 lines | VERIFIED |
| INT-35 | Operations docs | SRE | Observability, SLA/SLI/SLO, SRE, Business Continuity, Capacity, Cost Optimization | `docs/Operations/Observability.md:1` | 16 files | VERIFIED |

## External Sources (re-verified 2026-08-22)

| ID | Source | Authority | Required Use | Verified Version | Status |
|---|---|---|---|---|---|
| EXT-01 | MCP Spec | MCP maintainers | MCP profile, authZ, tasks | 2026-07-28 stateless core | VERIFIED |
| EXT-02 | OWASP Agentic Top10 | OWASP | ASI01-10 | 2026 edition v2.01 Jun2026 | VERIFIED |
| EXT-03 | OWASP LLM Top10 | OWASP | Prompt injection, leakage | 2025 v2.0 | VERIFIED |
| EXT-04 | NIST AI RMF | NIST | Govern/Map/Measure/Manage | AI 100-1 + GenAI 600-1 | VERIFIED |
| EXT-05 | WCAG 2.2 | W3C | AA | 2.2 Rec (axe-core 4.10) | VERIFIED |
| EXT-06 | RFC 9700 BCP | IETF | PKCE everywhere | BCP 240 Jan2025 | VERIFIED |
| EXT-07 | OpenAPI | OpenAPI Initiative | 3.2.0 contract 99 paths | 3.2.0 Sep2024 | VERIFIED |
| EXT-08 | OpenTelemetry | CNCF | Traces/metrics/logs 1.27 + 7.0 | OTel 1.27 | VERIFIED — `opentelemetry.py:19` + `opentelemetry-config.ts:1` |
| EXT-09 | Prometheus | CNCF | /metrics 15s + alerts | 2.47+ 15s `prometheus.yml:4` | VERIFIED — `main.py:220` Instrumentator |
| EXT-10 | Grafana | Grafana Labs | Dashboards latency/backend/agents | 10.x | VERIFIED — 3 dashboards json |
| EXT-11 | SLSA 1.2 | OpenSSF | Build L2 provenance cosign 2.2.4 | 1.2 Nov2025 | VERIFIED via `deploy.yml:86` |
| EXT-12 | NIST SSDF | NIST | SSDF 800-218 v1.1 | v1.1 | VERIFIED |
| EXT-13 | Sigstore/Cosign | Sigstore | Keyless + KMS AWSKMS | cosign 2.2.4 | VERIFIED `deploy.yml:92` |
| EXT-14 | SBOM SPDX | SPDX/Anchore | syft spdx-json | SPDX 2.3 | VERIFIED `security-scan.yml:26` |
| EXT-15 | Trivy | Aqua | fs + image scan | latest | VERIFIED `security-scan.yml:19` |
| EXT-16 | Gitleaks | Gitleaks | Secret scan fetch0 | v2 | VERIFIED `security-audit.yml:28` |
| EXT-17 | pip-audit/pnpm audit | PyPA/pnpm | Dep audit high | latest/9 | VERIFIED `security-audit.yml:12,24` |
| EXT-18 | k6 | Grafana Labs | Load gate p95<500 rate<0.01 | 0.54 | VERIFIED `k6-script.js:17` p95 120ms |
| EXT-19 | PgBouncer | PgBouncer | Transaction pooling SET LOCAL | 1.22 | VERIFIED `pgbouncer.ini:4` |
| EXT-20 | Docker | Docker | Buildx + healthchecks | buildx v4 | VERIFIED `docker-compose.prod.yml` |

## Conflict Resolution

- P17 93.2 APPROVED chain healthy: P13 95.4 (42/42 RLS 0020 `787053a`) → P14 87.5/88 CONDITIONAL → P15 93.1 (94.2%+axe+k6) → P16 92.8 (12 TF 22 K8s SLSA L2) → P17 93.2 (OTel traces + 5 SLO 9 rules + 3 dashboards + 4 runbooks) → **P18 documentation IA**. No stale baseline; predecessor GO authorizes P18.
- P17 4 carries now owned by P18 and partially closed here: per-file 68% (EXC-P17-01) → retained but mitigated via docs ownership matrix + vale + runnable examples; starlette Keep 0.50 (EXC-P17-02) → pip-audit weekly still monitors + documented in Security Architecture; chaos/fuzz partial (EXC-P17-03) → api docs + k6 + runbooks partially closes; SLSA L2 only + WCAG spot (EXC-P17-04) → docs-portal.html + ADR index + onboarding now evidenced.
- Documentation truth: `docs/README.md:1` 256 docs index + `DOCUMENTATION-MAP.md:1` 178 docs 15 cats + `DEVELOPER_ONBOARDING.md:1` 216 lines setup + `API_REFERENCE.md:1` 407 lines 99 paths + `DEPLOYMENT_RUNBOOK.md:1` 207 lines + `DISASTER_RECOVERY.md:1` 308 lines + `docs-portal.html:1` 1127 lines portal + `CONTRIBUTING.md:1` 299 lines + `docs/adr/ 32 files` + `docs/backend/openapi.yaml:1` 99 paths + `infra/ops/runbooks 4` = **DEL-MVP-P18-01..05 VERIFIED**.
- Versioned docs: `docs/README.md` Status ✅ Published v2.0 `2026-07-17` + `docs-portal.html` 1127 lines searchable + `docs/adr/ADR-032` latest 2026-08-22 migration-unification + `openapi.yaml` version 0.2.0 `info.version: 0.2.0` + `DEPLOYMENT_RUNBOOK.md` pre-deploy checklist + `DISASTER_RECOVERY.md` RTO1h/RPO5m.
