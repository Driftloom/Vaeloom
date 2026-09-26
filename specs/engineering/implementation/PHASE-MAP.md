# Implementation → MVP Phases Map (WS-E)

> **Verified:** 2026-09-15 · **Rule:** `docs/engineering/Implementation/` holds
> the build-order guides (how); `docs/phases/mvp-pXX/` holds execution evidence
> (proof). Cross-link, don't duplicate.

| Implementation guide                 | MVP phase evidence                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `00-master-build-order.md`           | `mvp-p04/` (planning/governance ≈ `project/COMMIT_PLAN.md`, `IMPLEMENTATION-CHECKLIST.md`) |
| `01-foundation-infra.md`             | `mvp-p00/`, `mvp-p06/`                                                                     |
| `02-database-schema.md`              | `mvp-p07/` (12 migrations, 34-table RLS baseline)                                          |
| `03-ingestion-pipeline.md`           | `mvp-p07/`, `mvp-p11/`, `mvp-p12/` (17-type whitelist, F-40 parsers)                       |
| `04-memory-system.md`                | `mvp-p07/`, `mvp-p12/`                                                                     |
| `05-agent-harness-orchestration.md`  | `mvp-p12/`                                                                                 |
| `06-rag-retrieval.md`                | `mvp-p12/`                                                                                 |
| `07-mcp-tool-ecosystem.md`           | `mvp-p12/` (bridge `mcp__Server__Tool`, 300s TTL — see `docs/mcp/servers/seed-configs.md`) |
| `08-specialist-agents.md`            | `mvp-p12/` (≈ `docs/ai/*`, `docs/agents/`, `engineering/04..09`)                           |
| `09-ai-gateway-model-routing.md`     | `mvp-p12/`                                                                                 |
| `10-evaluation-framework.md`         | `mvp-p14/` (R01..R08, Test-Matrix)                                                         |
| `11-guardrails-safety.md`            | `mvp-p13/`, safety `agentic-safety-w1..w5` (reports)                                       |
| `12-observability-tracing.md`        | `mvp-p17/`                                                                                 |
| `13-api-backend.md`                  | `mvp-p08/`, `mvp-p11/` (OpenAPI 254 paths current; 99/110 refs stale)                      |
| `14-frontend-workspace.md`           | `mvp-p09/`, `mvp-p10/` (20 routes, transformKeys)                                          |
| `15-security-compliance.md`          | `mvp-p13/` (95.4 APPROVED; 233/170, 42/42 RLS)                                             |
| `16-deployment-infrastructure.md`    | `mvp-p16/`, `mvp-p19/`, `mvp-p20/`                                                         |
| `17-agent-orchestration-at-scale.md` | `mvp-p21/` → `cont-p00..p21` (enterprise scale-out)                                        |

> Overlap note:
> `mvp-p04≈project/COMMIT_PLAN+IMPLEMENTATION-CHECKLIST+00-master-build-order`
> and `mvp-p12≈ai/*+agents/*+engineering/04..09` are the same plan↔evidence
> pattern as product/mvp-p03 — navigate both, edit the guide, cite the gate.
