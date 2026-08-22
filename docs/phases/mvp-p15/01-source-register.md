# MVP-P15 — 01. Source Register

> **Phase:** MVP-P15 — Performance, Reliability, and Scalability  
> **Date:** 2026-08-22 · **Baseline:** `787053a` (P13 Perfect to 95+ 42/42 RLS via 0020, retention_runs 0021, 2557 tests, 99 OpenAPI) + P14 ea329dd 4 GO-conditions + P15 perf hardening  
> **Prompt:** `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/01-mvp/MVP-P15-performance-reliability-and-scalability.md` §28
> **Gate Authority:** Performance Engineer (accountable) + SRE (backup) + Security/Privacy/Data/A11y/Reliability veto

## Internal Sources

| ID | Source | Owner | Use | Location | Version/Date | Status |
|---|---|---|---|---|---|---|
| INT-01 | Universal Prompt Generator & Gatekeeper | Vaeloom source team | Governing 32-section contract | `docs/Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | 2026-08-04 | VERIFIED |
| INT-02 | MVP E2E Enterprise Hardened | Vaeloom source team | MVP corrections, hardening | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` | 2026-08-04 | VERIFIED |
| INT-03 | MVP Spec | Vaeloom source team | 8 agents, 22 memory types (spec 22 vs prompt 6 — spec controls MVP) | `docs/01-vaeloom-mvp-spec.md` | 2026-07-13 | VERIFIED |
| INT-04 | Architecture 6-layer | Eng Team | Interface→Connectors→Ingestion→Orchestration→Memory→Storage | `docs/02-system-architecture.md` | 2026-07-13 | VERIFIED |
| INT-05 | Agent Workflow | Eng Team | 10-step loop, approval gate | `docs/03-agent-workflow.md` | 2026-07-13 | VERIFIED |
| INT-06 | Memory KG 22 types | Eng Team | KG + vector + 6 MVP types | `docs/04-memory-knowledge-graph.md` | 2026-07-13 | VERIFIED |
| INT-07 | P14 Gate (honest) | QA Lead | Predecessor gate honest 87.5 → 88 waived CONDITIONAL (3 restrictions) | `docs/phases/mvp-p14/09-gate-report.md:26` | 2026-08-22 ea329dd | VERIFIED |
| INT-08 | P14 Handoff | QA Lead | 2557 collected, GDPR 31, DPIA DRAFT, 4 EXCs | `docs/phases/mvp-p14/10-handoff-to-p15.md:1` | 2026-08-22 | VERIFIED |
| INT-09 | P13 Gate 95.4 APPROVED | Security Arch | 42/42 RLS via 0020, retention_runs 0021, DPIA All Regions 1.2 | `docs/phases/mvp-p13/09-gate-report.md:32` | 2026-08-22 787053a | VERIFIED |
| INT-10 | P13 Zero-trust full re-audit | Zero-trust auditor | 27 findings F-01..27, file:line | `.agents/findings/2026-08-22-P13-zero-trust-full-re-audit.md` | 2026-08-22 | VERIFIED |
| INT-11 | P14 post-ea329dd re-verification | QA | 74.4→87.5 lift via 4 GO-conditions | `.agents/findings/2026-08-22-post-ea329dd-re-verification.md` | 2026-08-22 | VERIFIED |
| INT-12 | ADRs 001-032 | Arch | 32 decisions | `docs/adr/` | 2026-08-22 | VERIFIED |
| INT-13 | OpenAPI 99 paths | API | Contract live | `docs/backend/openapi.yaml` | 2026-08-22 787053a | VERIFIED — 99 paths, was 88 at P12 |
| INT-14 | AGENTS.md counts | Eng | 2557 tests, 170 unique security, 99 OpenAPI | `AGENTS.md:48-54` | 2026-08-22 787053a | VERIFIED `pytest --collect-only` 2557 |
| INT-15 | Capacity model (NEW) | Perf Eng | Workload shapes, QPS, doc/token/vector sizing | `docs/phases/mvp-p15/capacity-model.md` (DEL-P15-01 §4) | 2026-08-22 | VERIFIED |
| INT-16 | Load/resilience bundle (NEW) | Perf/SRE | k6 20 RPS p50/p95, chaos, circuit breaker 3/30s | `infra/ops/load-test/k6-script.js:17`, `docs/phases/mvp-p15/load-results.md` | 2026-08-22 | VERIFIED |
| INT-17 | SLO/DR runbook (NEW) | SRE | SLOs, error budgets, RPO/RTO, DR triggers | `docs/phases/mvp-p15/slo-dr.md` (DEL-P15-03) | 2026-08-22 | VERIFIED |
| INT-18 | Cost model + scaling runbook (NEW) | FinOps/SRE | Unit cost, LLM/token, headroom triggers | `docs/phases/mvp-p15/cost-model.md`, `scaling-runbook.md` | 2026-08-22 | VERIFIED |

## External Sources (re-verified 2026-08-22 via websearch ses_fdb)

| ID | Source | Authority | Required Use | Verified Version | Status |
|---|---|---|---|---|---|
| EXT-01 | MCP Spec | MCP maintainers | MCP profile, authZ, tasks/extensions | 2026-07-28 stateless core (`Mcp-Method` header, Tasks extension, auth hardening) | VERIFIED |
| EXT-02 | OWASP Agentic Top10 | OWASP | ASI01-10 (3 new: ASI07 inter-agent, ASI08 cascading, ASI10 rogue) | 2026 edition published 2025-12-09 v2.01 Jun2026 | VERIFIED |
| EXT-03 | OWASP LLM Top10 | OWASP | Prompt injection, leakage, excessive agency | 2025 v2.0 | VERIFIED |
| EXT-04 | NIST AI RMF | NIST | Govern/Map/Measure/Manage | AI 100-1 + GenAI 600-1 | VERIFIED |
| EXT-05 | WCAG 2.2 | W3C | AA | 2.2 Rec (axe-core 4.10) | VERIFIED — now re-measured P15 |
| EXT-06 | RFC 9700 BCP | IETF | PKCE everywhere, exact redirect | BCP 240 Jan2025 | VERIFIED |
| EXT-07 | OpenAPI | OpenAPI Initiative | 3.2.0 contract | 3.2.0 (Sep 2024) | VERIFIED |
| EXT-08 | SLSA 1.2 | OpenSSF | Provenance | 1.2 Nov2025 | NOTED |
| EXT-09 | NIST SSDF | NIST | SSDF 800-218 v1.1 | v1.1 | VERIFIED |
| EXT-10 | Gmail API Push | Google | 7-day watch, daily renewal, historyId | Current | VERIFIED |
| EXT-11 | GitHub Apps | GitHub | Least privilege fine-grained | Current | VERIFIED |
| EXT-12 | GDPR | EU | Art.20 portability now 31 tables | EU 2016/679 | VERIFIED |
| EXT-13 | DPDP Rules 2025 | India | Staged | 2025-11-14 final | VERIFIED |
| EXT-14 | FERPA/COPPA | US | Under-13 excluded | Current | VERIFIED |
| EXT-15 | pytest collection | Test infra | `pytest --collect-only -q -o addopts=""` | 2557, 233 security (170 unique) | VERIFIED 2026-08-22 |
| EXT-16 | InsecureKeyLengthWarning | PyJWT | 27-byte HMAC <32 SHA256 | Fixed to 32+ in `apps/api/tests/conftest.py:9` | FIXED F-07 |
| EXT-17 | k6 | Grafana Labs | Load testing | k6 v0.54 (latest) | VERIFIED — script `infra/ops/load-test/k6-script.js:1` |
| EXT-18 | axe-core / jest-axe | Deque | WCAG 2.2 AA automated | axe-core 4.10, jest-axe 9.0 | VERIFIED — `apps/web/src/__tests__/a11y.test.tsx:34` |
| EXT-19 | Prometheus / OTel | CNCF | Metrics / tracing | prometheus_fastapi_instrumentator 7.0, opentelemetry-api 1.27 | VERIFIED — `apps/api/src/api/main.py:167-168` |
| EXT-20 | PgBouncer | PgBouncer | Transaction pooling | 1.22, `SET LOCAL` safe | VERIFIED — `infra/ops/pgbouncer/pgbouncer.ini:4` |

## Conflict Resolution

- P14 claimed 87.5 honest → 88 waived CONDITIONAL with 3 pre-prod restrictions (coverage/WCAG/perf). P15 now **closes all 3** via `--cov` 94.2% + `jest-axe` 0 critical + `k6` p95 120ms — honest now ≥92, waivers not needed for APPROVED, only 1 carry (smoke dirs partial).
- RLS now 42/42 via 0020 (P13 787053a) — no longer 37/42. Tenant GUCs `app.tenant_id`/`app.workspace_id`/`app.user_id` via `TenantContext` (`apps/api/src/api/middleware/tenant.py:41`, `apps/api/src/api/database.py:30`) fail-closed.
- OpenAPI 99 paths live (was 88) — `docs/backend/openapi.yaml` 99 paths pinned 2026-08-22.

