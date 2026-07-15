# 00 — Master Build Order (Enterprise)
### Read this first. Do not start this folder until the MVP folder is fully built, deployed, and proven with real users.

## Entry criteria
Every acceptance criterion in `mvp/16-deployment-infrastructure.md` is met AND the product has real usage data (per `Meridian-Complete-Documentation.md` §14 Roadmap — the "v1.5" earned-autonomy stage should ideally already be underway). Enterprise work that starts before this is premature — multi-tenancy and a plugin ecosystem solve problems you don't have evidence of yet.

## What this folder is
Each file here is an **upgrade delta** on top of its MVP counterpart, not a rewrite. Read `mvp/NN-*.md` immediately before `enterprise/NN-*.md` for the same number — the enterprise file assumes everything in the MVP file already exists and works.

## Build order
Same numbering as MVP through file 16, plus one genuinely new file (17, no MVP counterpart) — with one addition to the dependency rule: **file 15 (Security & Compliance) gates file 00's own exit criterion** — do not onboard a real enterprise/tenant customer until 15 is done, regardless of what else is ready.

| # | File | Upgrades | Gated by |
|---|---|---|---|
| 01 | `01-foundation-infra.md` | Multi-tenant provisioning, SSO scaffolding | MVP 01 |
| 02 | `02-database-schema.md` | Tenant scoping, dedicated graph/vector stores | MVP 02 |
| 03 | `03-ingestion-pipeline.md` | Broader connector catalog, streaming sync | MVP 03 |
| 04 | `04-memory-system.md` | Full 20-type taxonomy, Reflection Agent | MVP 04 |
| 05 | `05-agent-harness-orchestration.md` | Durable state, Self-Improvement + QA Agent as real agents | MVP 05 |
| 06 | `06-rag-retrieval.md` | Semantic cache, dedicated vector DB | MVP 06 |
| 07 | `07-mcp-tool-ecosystem.md` | Marketplace, real MCP transport, SDK release | MVP 07 |
| 08 | `08-specialist-agents.md` | Remaining ~20 agents (full 28-roster) | MVP 08 |
| 09 | `09-ai-gateway-model-routing.md` | Multi-provider, dynamic cost routing | MVP 09 |
| 10 | `10-evaluation-framework.md` | Benchmark suite, human-eval rotation | MVP 10 |
| 11 | `11-guardrails-safety.md` | ABAC, formal threat model, supply-chain security | MVP 11 |
| 12 | `12-observability-tracing.md` | SOC2 retention, anomaly detection | MVP 12 |
| 13 | `13-api-backend.md` | Public API/SDK, webhooks, versioning | MVP 13 |
| 14 | `14-frontend-workspace.md` | Admin console, Analytics, accessibility audit | MVP 14 |
| 15 | `15-security-compliance.md` | Full RBAC, SSO, GDPR/SOC2, consent model | MVP 15 |
| 16 | `16-deployment-infrastructure.md` | Kubernetes, multi-region, DR, chaos testing | MVP 16 |
| 17 | `17-agent-orchestration-at-scale.md` | **New — no MVP counterpart.** Routing across 28 agents, tenant-aware dispatch, multi-agent plan coordination, circuit breaking | Enterprise 05, 08, 10, 11, 12 |

File 17 exists because MVP's simple intent-router (`mvp/05`) was deliberately sized for 8 agents and one tenant — routing across 28 agents, multiple tenants, and genuine multi-agent plans is a large enough problem to deserve its own file rather than being squeezed into the harness file. Build it after 05, 08, 10, 11, and 12 are all done, since it consumes signals from every one of them.

## The one decision that matters most in this folder
File 15's consent model: an organization (university, employer) can provision accounts and set policy boundaries, but must never read an individual's memory contents without that individual's explicit, granular, revocable consent. Every other file in this folder is engineering; that one is the trust commitment the whole enterprise tier depends on. If any later design decision seems to require weakening it, stop and flag it rather than quietly proceeding.

## Definition of "Enterprise done"
A pilot institution can provision accounts for its population, apply tenant-level policy, and see aggregated (consented) engagement data — without a single verified instance of cross-tenant leakage or non-consented individual memory access, confirmed by the penetration test in `enterprise/15-security-compliance.md`.
