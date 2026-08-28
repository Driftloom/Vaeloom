# MVP-P12 — 01. Source Register

> **Phase:** MVP-P12 — AI, Agent, Memory, and Data-Pipeline Implementation 
> **Date:** 2026-08-20 · **Baseline:** `95d9848` (HEAD, pinned) + P12 changes

## Internal Sources

| ID | Source | Owner | Use | Location | Version/Date | Status |
| ------ | --------------------------------------- | ------------------- | -------------------------------------------------- | -------------------------------------------------------------------- | ------------ | -------- |
| INT-01 | Universal Prompt Generator & Gatekeeper | Vaeloom source team | Governing 32-section execution contract | `docs/Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | 2026-08-04 | VERIFIED |
| INT-02 | MVP E2E Enterprise Hardened | Vaeloom source team | Authoritative MVP corrections | `docs/vaeloom-mvp-e2e-enterprise-hardened.md` | 2026-08-04 | VERIFIED |
| INT-03 | MVP E2E Baseline | Vaeloom source team | MVP P0–21 execution baseline | `docs/vaeloom-mvp-e2e.md` | 2026-08-04 | VERIFIED |
| INT-04 | Enterprise E2E Baseline | Vaeloom source team | Enterprise P0–21 baseline (context only) | `docs/vaeloom-enterprise-e2e.md` | 2026-08-04 | VERIFIED |
| INT-05 | MVP Product Spec | Vaeloom source team | Canonical MVP scope — 8 agents, 22 memory types | `docs/01-vaeloom-mvp-spec.md` | 2026-08-04 | VERIFIED |
| INT-06 | System Architecture | Vaeloom source team | 6-layer architecture with Memory & Knowledge spine | `docs/02-system-architecture.md` | 2026-08-04 | VERIFIED |
| INT-07 | Agent Workflow | Vaeloom source team | 10-step agent workflow, approval gates | `docs/03-agent-workflow.md` | 2026-08-04 | VERIFIED |
| INT-08 | Memory & Knowledge Graph | Vaeloom source team | Memory architecture, RAG pipeline, graph design | `docs/04-memory-knowledge-graph.md` | 2026-08-04 | VERIFIED |
| INT-09 | P11 Gate Report | P11 phase owner | Predecessor gate — 90.5/100 CONDITIONAL | `docs/phases/mvp-p11/09-gate-report.md` | 2026-08-20 | VERIFIED |
| INT-10 | P11 Handoff | P11 phase owner | Predecessor handoff to P12 | `docs/phases/mvp-p11/10-handoff-to-p12.md` | 2026-08-20 | VERIFIED |
| INT-11 | 66-Phase Execution Status | Phase governance | Live tracking of all 66 prompts | `docs/prompts/.../EXECUTION-STATUS.md` | 2026-08-20 | VERIFIED |

## External Sources

| ID | Source | Owner | Use | Verified Version | Status |
| ------ | ---------------------------- | ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| EXT-01 | MCP Specification | MCP maintainers | Protocol/security/interoperability | 2026-07-28 (OAuth 2.1, MRTR, stateless core, SDK v2.0.0) | VERIFIED |
| EXT-02 | OWASP Agentic Apps Top 10 | OWASP | Agent/tool/memory/identity risks | 2026 edition — identifiers **ASI01–ASI10**, published 2025-12-09 | VERIFIED |
| EXT-03 | OWASP LLM Top 10 | OWASP | Prompt injection, leakage, excessive agency | 2025 | VERIFIED |
| EXT-04 | NIST AI RMF + GenAI Profile | NIST | AI governance and evaluation | AI 100-1 1.0; GenAI profile NIST-AI-600-1 (Jul 2024, 12 risks); 1.0 under revision; critical-infrastructure profile concept note 2026-04-07 | VERIFIED |
| EXT-05 | WCAG 2.2 | W3C | AA accessibility target | 2.2 Rec | VERIFIED |
| EXT-06 | RFC 9700 OAuth Security BCP | IETF | OAuth security for tool authorization | BCP 240 | VERIFIED |
| EXT-07 | OpenAPI Specification | OpenAPI Initiative | API contract for agent/tool routes | 3.2.0 | VERIFIED |
| EXT-08 | OpenTelemetry Specification | CNCF | Telemetry/context propagation | Current | VERIFIED |
| EXT-09 | SLSA v1.2 | OpenSSF | Build provenance and artifact integrity | 1.2 | NOTED |
| EXT-10 | Gmail API Push Notifications | Google | Watch renewal/reconciliation | Current — watch token expires 7 days, renew daily, historyId cursor, 404 → full re-sync, users.watch = 100 quota units | VERIFIED |
| EXT-11 | Anthropic Claude API | Anthropic | Primary reasoning model integration | claude-3-5-sonnet-20241022 (catalog); current-gen Opus 5/Sonnet 5/Haiku 4.5 verified as upgrade candidates | VERIFIED |
| EXT-12 | OpenAI API | OpenAI | Embedding model + fallback reasoning | text-embedding-3-small, gpt-4o; chat-latest verified as upgrade candidate | VERIFIED |
| EXT-13 | OpenAI pricing page | OpenAI | Model cost verification (catalog) | verified 2026-08-20 (no training by default; 30-day abuse-monitoring retention; ZDR) | VERIFIED |
| EXT-14 | Anthropic pricing page | Anthropic | Model cost verification (catalog) | verified 2026-08-20 (7-day API retention since 2025-09-14; ZDR; flagged content up to 2y) | VERIFIED |

## Architecture Decision Records Referenced

| ADR | Title | Relevance to P12 |
| ------- | ----------------------------- | ------------------------------------------------------- |
| ADR-001 | FastAPI monolith | Agent runtime architecture — no NestJS |
| ADR-003 | pgvector for embeddings | Vector storage for memory/retrieval |
| ADR-004 | PostgreSQL knowledge graph | Dual-table adjacency list for entity/relationship graph |
| ADR-005 | Custom agent orchestrator | Router → handler → think/tool/observe loop with SSE |
| ADR-010 | MCP standardized connectors | Tool schema for agent tool calling |
| ADR-013 | Multi-tenancy with RLS | Workspace isolation for all memory/agent operations |
| ADR-021 | Approval persistence | Human-in-the-loop gate for consequential agent actions |
| ADR-022 | Memory taxonomy | Episodic, semantic, procedural memory categories |
| ADR-027 | OWASP LLM security | Prompt injection filtering, content sanitization |
| ADR-031 | Input sanitization | Content boundary enforcement for untrusted data |
| ADR-032 | Alembic migration unification | Single migration source of truth |

## Conflict Resolution

| Conflict | Resolution | Authority |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| Enterprise hardened doc lists 10+ agents | MVP locked to 8 canonical agents per INT-05 §5 | INT-05 (MVP spec) takes precedence |
| Multiple embedding model candidates | OpenAI `text-embedding-3-small` used as default; `EmbeddingProvider` protocol allows swap | INT-02 §5 — provider-neutral design |
| Legacy migration runner vs Alembic | Alembic is authoritative per ADR-032; legacy runner kept as startup fallback | ADR-032 |
| BYOK design surface | BYOK is a P12 decision (DEC-P12-07), not yet an ADR; ADR proposal deferred to P13 governance | DEC-P12-07 |
