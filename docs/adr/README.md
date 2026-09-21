# Vaeloom Architecture Decision Records (ADR Index)

> **Status:** 45 ADRs, all `Accepted` unless noted. Generated 2026-09-15
> (CONT-P18 DEL-03). Titles sourced from file H1s — this index is a map, not a
> substitute; read the ADR for context, consequences, and supersession.

## Foundation (001–020)

| ID                                       | Title                                     |
| ---------------------------------------- | ----------------------------------------- |
| [ADR-001](ADR-001-use-fastapi.md)        | Use FastAPI for Backend API               |
| [ADR-002](ADR-002-use-nextjs.md)         | Use Next.js 15 for Frontend               |
| [ADR-003](ADR-003-use-pgvector.md)       | Use pgvector for Vector Embeddings        |
| [ADR-004](ADR-004-memory-graph.md)       | Knowledge Graph for Memory System         |
| [ADR-005](ADR-005-agent-orchestrator.md) | Agent Orchestrator Pattern                |
| [ADR-006](ADR-006-sqlalchemy-async.md)   | SQLAlchemy Async for Database Access      |
| [ADR-007](ADR-007-jwt-auth.md)           | JWT-Based Authentication                  |
| [ADR-008](ADR-008-plugin-sandbox.md)     | Subprocess Plugin Isolation               |
| [ADR-009](ADR-009-monorepo-structure.md) | Monorepo with pnpm Workspaces             |
| [ADR-010](ADR-010-mcp-connectors.md)     | MCP Protocol for Integrations             |
| [ADR-011](ADR-011-opentelemetry.md)      | OpenTelemetry for Observability           |
| [ADR-012](ADR-012-rate-limiting.md)      | Rate Limiting with Sliding Window         |
| [ADR-013](ADR-013-multi-tenancy.md)      | Multi-Tenancy with Pooled Isolation       |
| [ADR-014](ADR-014-secret-management.md)  | Secret Management Strategy                |
| [ADR-015](ADR-015-alembic-migrations.md) | Alembic for Database Migrations           |
| [ADR-016](ADR-016-structured-logging.md) | Structured Logging with structlog         |
| [ADR-017](ADR-017-circuit-breaker.md)    | Circuit Breaker for External Dependencies |
| [ADR-018](ADR-018-sso-auth.md)           | SSO with Google and Microsoft             |
| [ADR-019](ADR-019-object-storage.md)     | Object Storage with S3-compatible API     |
| [ADR-020](ADR-020-eks-terraform.md)      | EKS Deployment with Terraform             |

## Hardening & Memory (021–032)

| ID                                                         | Title                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| [ADR-021](ADR-021-approval-idempotency-persistence.md)     | Approval & Idempotency Persistence                         |
| [ADR-022](ADR-022-memory-taxonomy.md)                      | Six-Domain Memory Taxonomy on Existing Schema              |
| [ADR-023](ADR-023-workspace-isolation.md)                  | Workspace Isolation Hardening (App Scoping + Postgres RLS) |
| [ADR-024](ADR-024-rebuildable-projections.md)              | Rebuildable Projections (Never Authoritative)              |
| [ADR-025](ADR-025-workload-identity.md)                    | Workload Identity for FastAPI Worker / API / Connectors    |
| [ADR-026](ADR-026-paas-first-mvp.md)                       | PaaS-First MVP Target, Nearest Region                      |
| [ADR-027](ADR-027-owasp-llm-agentic-security-posture.md)   | OWASP LLM/Agentic Security Posture                         |
| [ADR-028](ADR-028-event-driven-architecture-bullmq.md)     | Event-Driven Architecture with BullMQ                      |
| [ADR-029](ADR-029-c4-model-architecture-documentation.md)  | C4 Model for Architecture Documentation                    |
| [ADR-030](ADR-030-agent-credential-isolation.md)           | Agent Credential Isolation                                 |
| [ADR-031](ADR-031-input-sanitization-retrieved-content.md) | Input Sanitization for Retrieved Content                   |
| [ADR-032](ADR-032-migration-system-unification.md)         | Migration System Unification                               |

## Agentic & Enterprise (033–044)

| ID                                                              | Title                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [ADR-033](ADR-033-react-gating-streaming-durable-scheduling.md) | ReAct Gating, True Token Streaming, and Durable Background Scheduling            |
| [ADR-034](ADR-034-resume-document-pipeline.md)                  | Resume Document Pipeline — Templates, Playwright Compilation, Semantic ATS       |
| [ADR-035](ADR-035-browser-scraping-tools.md)                    | Browser & Scraping Tools — SSRF Policy, Engine Strategy, Quotas                  |
| [ADR-036](ADR-036-native-mcp-integration.md)                    | Native Python MCP Client Integration                                             |
| [ADR-037](ADR-037-hybrid-integration-framework.md)              | Hybrid Integration Framework (Native Core + MCP Long-Tail + Pluggable Providers) |
| [ADR-038](ADR-038-temporal-durable-execution.md)                | Temporal Durable Execution (Ingestion + Approval Signals + Schedules Migration)  |
| [ADR-039](ADR-039-langgraph-durable-integration.md)             | LangGraph as Agent Reasoning Topology inside Temporal Durability                 |
| [ADR-040](ADR-040-tenant-cells-control-plane.md)                | Tenant Cells & Control Plane                                                     |
| [ADR-041](ADR-041-workload-identity.md)                         | Workload Identity (Temporal Workers + API)                                       |
| [ADR-042](ADR-042-data-classes-residency.md)                    | Data Classes & Residency                                                         |
| [ADR-043](ADR-043-strangler-adapter.md)                         | Strangler Adapter (MVP Monolith → Cell)                                          |
| [ADR-044](ADR-044-zero-trust-p1-hardening.md)                   | Zero-Trust P1 Hardening (Hybrid RAG, Model Routing, Observability, Concurrency)  |
| [ADR-045](ADR-045-transactional-outbox.md)                      | Transactional Outbox for DB+Broker Dual-Write Safety (slice 1)                   |

## Ownership & Cadence

- Owner: Architecture (Platform Engineer). New ADRs numbered sequentially,
  linked here at merge time.
- Supersession is recorded in the superseded ADR's header — never by deletion.

## Collision note — ADR-025 vs ADR-041 (WS-D 2026-09-15)

Both ADRs are titled "workload identity" but decide **different scopes at
different maturity** — read both before citing either:

|              | ADR-025                                                                                        | ADR-041                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File         | `ADR-025-workload-identity.md`                                                                 | `ADR-041-workload-identity.md`                                                                                                                                          |
| Title        | Workload Identity for FastAPI Worker ↔ API / Connectors                                        | Workload Identity (Temporal Workers + API)                                                                                                                              |
| Status       | **PROPOSED — design-only, GAP (implement P07/P11)**                                            | **Accepted** (2026-08-29)                                                                                                                                               |
| Mechanism    | HMAC-signed service tokens (worker ↔ API, API ↔ connectors); no user creds in workers (NFR-16) | SPIFFE/mTLS (`CN=api-{cellId}` / `CN=worker-{cellId}`, K8s ServiceAccount → SecretManager, per-cell master key); HPA + `max_concurrent_activities`, `workload_id` audit |
| Honest state | Nothing implemented at HEAD at decision time                                                   | Reversible fallback to `token_ref` until drill passes                                                                                                                   |

Neither supersedes the other. A future ADR should consolidate (HMAC service
tokens for API↔connector paths + mTLS for worker↔pg/redis) or explicitly scope
each; until then, cite by number.
