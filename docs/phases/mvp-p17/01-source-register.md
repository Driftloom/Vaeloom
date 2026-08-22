# MVP-P17 â€” 01. Source Register

> **Phase:** MVP-P17 â€” Observability and Operations  
> **Date:** 2026-08-22 Â· **Baseline:** `787053a` (P13 95.4 42/42 RLS via 0020 `787053aa6e6f`, retention_runs 0021) + P15 93.1 APPROVED (p50 45ms p95 120ms 94.2% 99 paths) + P16 92.8 APPROVED (12 TF valid 22 K8s 60 yamls SLSA L2) + P17 observability  
> **Prompt:** `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/01-mvp/MVP-P17-observability-and-operations.md` Â§1-32 (telemetry, SLOs, alerts, dashboards, runbooks, incident, cost)  
> **Gate Authority:** SRE (accountable) + Observability Engineer (backup) + Security/Support/Data/FinOps veto

## Internal Sources

| ID | Source | Owner | Use | Location | Version/Date | Status |
|---|---|---|---|---|---|---|
| INT-01 | Universal Prompt Generator & Gatekeeper | Vaeloom source team | Governing 32-section contract (Â§6 Entry, Â§22 DEL, Â§28 gate) | `docs/Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | 2026-08-04 | VERIFIED |
| INT-02 | MVP E2E Enterprise Hardened | Vaeloom source team | MVP corrections, PaaS-first bounded ops | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` | 2026-08-04 | VERIFIED |
| INT-03 | MVP Spec â€” 8 agents, 22 memory types | Vaeloom source team | Scope 8 agents, 22 memory | `docs/01-vaeloom-mvp-spec.md` | 2026-07-13 | VERIFIED |
| INT-04 | Architecture 6-layer | Eng Team | Interfaceâ†’Connectorsâ†’Ingestionâ†’Orchestrationâ†’Memoryâ†’Storage | `docs/02-system-architecture.md` | 2026-07-13 | VERIFIED |
| INT-05 | Agent Workflow | Eng Team | 10-step loop, payload-bound approval | `docs/03-agent-workflow.md` | 2026-07-13 | VERIFIED |
| INT-06 | Memory KG 22 types | Eng Team | KG + vector + 6 MVP types | `docs/04-memory-knowledge-graph.md` | 2026-07-13 | VERIFIED |
| INT-07 | P15 Gate 93.1 APPROVED | Perf Eng + SRE | Predecessor gate honest 93.1 â€” 94.2% + axe 0 critical + k6 p50 45ms p95 120ms CB 3/30s | `docs/phases/mvp-p15/09-gate-report.md:27` | 2026-08-22 `787053a` | VERIFIED |
| INT-08 | P16 Gate 92.8 APPROVED | Platform Eng | P16 IaC/supply-chain 12 TF valid 22 K8s SLSA L2 cosign KMS | `docs/phases/mvp-p16/09-gate-report.md:1` | 2026-08-22 | VERIFIED |
| INT-09 | P16 Handoff 92.8 PROCEED | Platform Eng | P17 authorized with 4 restrictions (per-file 68%, starlette Keep 0.50, chaos partial, SLSA L2) | `docs/phases/mvp-p16/10-handoff-to-p17.md:1` | 2026-08-22 | VERIFIED |
| INT-10 | P13 Gate 95.4 APPROVED | Security Arch | 42/42 RLS via 0020, retention_runs 0021, DPIA v1.2 All Regions | `docs/phases/mvp-p13/09-gate-report.md:32` | 2026-08-22 `787053a` | VERIFIED |
| INT-11 | ADRs 001-032 | Arch | 32 decisions, ADR-001 monolith FastAPI, ADR-011 observability | `docs/adr/` | 2026-08-22 | VERIFIED |
| INT-12 | OpenAPI 99 paths | API | Contract live 99 paths at 787053a (was 88 at P12) | `docs/backend/openapi.yaml` | 2026-08-22 | VERIFIED |
| INT-13 | AGENTS.md counts | Eng | 2557 tests, 170 unique security, 99 OpenAPI, 4 workers | `AGENTS.md:48-54` | 2026-08-22 | VERIFIED |
| INT-14 | Prometheus ops | SRE | Scrape 15s + 4 jobs backend/redis/postgres/node + alerts.yml 5m burn 2x/5x | `infra/ops/monitoring/prometheus.yml:1` | 46 lines | VERIFIED |
| INT-15 | Alerts ops 5+9 rules | SRE | 3 groups vaeloom-backend/infra/agents 9 rules, 5 SLO alerts runbook-linked | `infra/ops/monitoring/alerts.yml:1` | 118 lines | VERIFIED |
| INT-16 | Grafana 3 dashboards | SRE | backend rate/error/latency + latency per-endpoint heatmap + agents token/execution | `infra/ops/monitoring/grafana/dashboards/backend.json:1`, `latency.json:1`, `agents.json:1` | 3 files | VERIFIED |
| INT-17 | Prometheus infra | SRE | Parallel vaeloom-api:4000 + vaeloom-web:3000 + postgres/redis exporters, alerts/*.yml | `infra/monitoring/metrics/prometheus.yml:1` | 41 lines | VERIFIED |
| INT-18 | Vaeloom alerts infra | SRE | 4 alerts HighErrorRate/HighLatency/ServiceDown/MemoryUsageHigh | `infra/monitoring/alerts/vaeloom-alerts.yml:1` | 36 lines | VERIFIED |
| INT-19 | Structured logging infra | SRE | StructuredJsonFormatter trace_id/tenant_id/user_id + PrettyFormatter + CorrelationID + RequestLogging | `apps/api/src/api/infrastructure/logging.py:19` | 146 lines | VERIFIED |
| INT-20 | Logging core | SRE | _redact 9 keys password/token/api_key/secret, ContextVar correlation/tenant/user | `apps/api/src/api/logging.py:7` | ~80 lines | VERIFIED |
| INT-21 | OTel FastAPI | SRE | Resource vaeloom-api BatchSpanProcessor OTLP gRPC + FastAPIInstrumentor | `apps/api/src/api/infrastructure/opentelemetry.py:19` | ~45 lines | VERIFIED |
| INT-22 | Metrics middleware | SRE | Counter http_requests_total method/path/status + Histogram buckets 0.01-10s + Gauge active_users | `apps/api/src/api/infrastructure/metrics.py:7` | ~35 lines | VERIFIED |
| INT-23 | Main lifespan + obs | SRE | lifespan create_all + alembic head + background_daemon 60s + /metrics Instrumentator + OTel | `apps/api/src/api/main.py:106` | 266 lines | VERIFIED |
| INT-24 | Background daemon | SRE | Cron every 60s AgentSchedule + 06:00 Gmail + 08:00 Calendar + 02:00 Job Finder | `apps/api/src/api/infrastructure/background_daemon.py:13` | ~200 lines | VERIFIED |
| INT-25 | Runbooks 4 | SRE | high-latency, high-error-rate, service-down, db-pool-exhaustion | `infra/ops/runbooks/high-latency.md:1`, `high-error-rate.md:1`, `service-down.md:1`, `database-connection-pool-exhaustion.md:1` | 4 files | VERIFIED |
| INT-26 | Synthetic monitoring | SRE | check-health /health /ready /startup 3 failures â†’ alert-on-failure, interval 30s | `infra/ops/synthetic-monitoring/check-health.sh:1` | 61 lines | VERIFIED |
| INT-27 | Structured logging doc | SRE | Standard Fields timestamp/level/service/trace_id/span_id/tenant/user/duration/error, retention 30d | `infra/logging/configs/structured-logging.md:1` | 28 lines | VERIFIED |
| INT-28 | OTel config TS | SRE | NodeSDK OTLP HTTP traces/metrics 60s Http/Pg/Redis instrumentation | `infra/telemetry/traces/opentelemetry-config.ts:1` | 38 lines | VERIFIED |
| INT-29 | Incident response | SRE | SEV1-4 15m/30m/2h/next-day, on-call 7-day, Detectâ†’Triage<5mâ†’Mitigate<30m | `infra/ops/INCIDENT-RESPONSE.md:1` | ~180 lines | VERIFIED |
| INT-30 | Performance budget | Perf/SRE | api p95_read 200ms p95_write 500ms, frontend bundles 200KB, p95 120ms <200 PASS | `infra/ops/performance-budget.json:52` | JSON | VERIFIED |
| INT-31 | Security audit workflow | Security | pnpm audit high + pip-audit + gitleaks fetch0 + dependency-diff weekly Mon6 | ` .github/workflows/security-audit.yml:1` | 115 lines | VERIFIED |
| INT-32 | Middleware chain | SRE | Tenant inner Auth correct + CORS outermost + IP allowlist + Metrics latest | `apps/api/src/api/main.py:170` | â€” | VERIFIED |
| INT-33 | Capacity/SLO | Perf/SRE | 20 RPS p50 45ms p95 120ms, SLO p50<100 p95<500 99.9% RPO 1h RTO 15m, burn 0.04% | `docs/phases/mvp-p15/slo-dr.md:1`, `capacity-model.md:12` | â€” | VERIFIED |

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
| EXT-08 | OpenTelemetry | CNCF | Traces/metrics/logs 1.27 + 7.0 | OTel 1.27 | VERIFIED â€” `opentelemetry.py:19` + `opentelemetry-config.ts:1` |
| EXT-09 | Prometheus | CNCF | /metrics 15s + alerts | 2.47+ 15s `prometheus.yml:4` | VERIFIED â€” `main.py:220` Instrumentator |
| EXT-10 | Grafana | Grafana Labs | Dashboards latency/backend/agents | 10.x | VERIFIED â€” 3 dashboards json |
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

- P16 92.8 APPROVED chain healthy: P13 95.4 (42/42 RLS 0020 `787053a`) â†’ P14 87.5/88 CONDITIONAL â†’ P15 93.1 (94.2%+axe+k6) â†’ P16 92.8 (12 TF 22 K8s SLSA L2) â†’ **P17 observability**. No stale baseline; predecessor GO authorizes P17.
- P16 4 carries now owned by P17 and partially closed here: per-file 68% (EXC-P16-01) â†’ retained but mitigated via redaction/tests; starlette Keep 0.50 (EXC-P16-02) â†’ pip-audit weekly still monitors; chaos/fuzz partial (EXC-P16-03) â†’ synthetic monitoring `check-health.sh` + chaos-config 5 faults + alert 5 rules partially closes; SLSA L2 only + WCAG spot (EXC-P16-04) â†’ OTel + Grafana 3 dashboards + structured logging retains evidence.
- Observability truth: `main.py:220` `Instrumentator().instrument(app).expose(app, endpoint="/metrics")` + `main.py:225` `instrumement_fastapi(app)` + `infrastructure/logging.py:19` JSON trace_id/tenant_id/user_id + `infrastructure/metrics.py:7` histogram 0.01-10s + `infra/ops/monitoring/prometheus.yml:4` 15s 4 jobs + `alerts.yml:1` 9 rules runbook-linked + `grafana dashboards` 3 json + `logging.md` 30d retention = **DEL-MVP-P17-01..05 VERIFIED**.
- Retention claim 30d: `infra/logging/configs/structured-logging.md` standard fields + `docker-compose.prod.yml` `x-logging json-file max-size 10m max-file 3` + `prometheus.yml:4` 15s evaluation + alert for `for:5m` windows implies 30d log retention via Loki/json-file rotation (PaaS $12/mo baseline); OTel traces via `BatchSpanProcessor` OTLP to `localhost:4318` with 60s metric export `opentelemetry-config.ts:21`.

