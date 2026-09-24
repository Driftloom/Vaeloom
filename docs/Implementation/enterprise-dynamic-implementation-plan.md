# Vaeloom Enterprise Dynamic Implementation Plan

**Standard**: Zero-Trust Implementation & Verification Standard (Phase 5)  
**Priority Hierarchy**: P0 Security & Architecture -> P1 Reliability & Dynamic
Execution -> P2 Optimization  
**Date**: 2026-09-24  
**Status**: APPROVED FOR EXECUTION

---

## 1. Phased Execution Roadmap

```
+--------------------------------------------------------------------------------+
| PHASE 1: Core Registry Infrastructure (P0)                                     |
| PostgreSQL Models • Alembic Migration 0056 • Pydantic Schemas • Admin Routers  |
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 2: Semantic Intent Resolution (P0)                                       |
| Exemplar Embeddings • Layer B Cosine Match • Eliminate Keyword Ladder         |
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 3: Dynamic Agent Discovery (P0)                                          |
| Filesystem Scanner • Dynamic Loader • Card Registry DB Sync                   |
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 4: Dynamic Tool Discovery (P1)                                           |
| @register_tool • Per-Execution Discovery • Permission & Risk Filters           |
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 5: Dynamic Model Routing (P1)                                            |
| DB Model Catalog • Fallback Chain • Circuit Breaker • Tenant Policy Overrides  |
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 6: Agent-to-Agent Hierarchy & Sub-Agent Manager (P1)                     |
| Typed AgentMessage • Redis/Async Event Bus • SubAgentManager • Parent-Child RLS|
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 7: Graph Execution Engine Decomposition (P1)                             |
| LangGraph StateGraph • Modular Nodes (Understand/Plan/Execute/Observe/Reflect) |
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 8: Prompt Versioning & Dynamic Overrides (P2)                            |
| DB-Backed Prompt Versions • Tenant Overrides • A/B Rollout                     |
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 9: Dynamic Frontend Capabilities (P2)                                    |
| GET /agents/commands • Dynamic Slash Commands • Dynamic Workspace UI Tokens   |
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 10: Repository Pattern & Query Isolation (P2)                            |
| Base Tenant Repository • Extracted Repositories (Agent, Tool, Memory, Model)   |
+--------------------------------------------------------------------------------+
                                       │
                                       ▼
+--------------------------------------------------------------------------------+
| PHASE 11: Enterprise Evaluation Framework (P2)                                 |
| Golden Dataset • Automated Evaluation Pipeline • Accuracy & Latency Benchmarks |
+--------------------------------------------------------------------------------+
```

---

## 2. Detailed Task Breakdown

### Phase 1: Core Registry Infrastructure (P0)

- **Task 1.1**: Define SQLAlchemy models in
  `apps/api/src/api/models/registries.py`:
  - `ToolRegistryEntry`: tool identity, version, JSON schemas, risk class,
    required scopes, tenant/workspace binding.
  - `ModelProviderEntry`: provider, model, context window, pricing, health,
    latency tier, tenant override.
  - `PolicyEntry`: dynamic runtime policies, risk thresholds, approval triggers.
  - `PromptVersionEntry`: prompt key, semantic version, template text, hash,
    author, active status.
  - `EvaluationEntry`: benchmark run metadata, accuracy score, latency,
    hallucination score, token count.
- **Task 1.2**: Author Alembic migration
  `alembic/versions/0056_enterprise_registries.py` with PostgreSQL Row-Level
  Security (RLS) enabled on all 5 tables.
- **Task 1.3**: Pydantic DTO schemas in
  `apps/api/src/api/schemas/registries.py`.
- **Task 1.4**: Admin REST endpoints in
  `apps/api/src/api/routers/registries.py`.
- **Task 1.5**: Startup database seeder syncing in-code catalog to DB.

### Phase 2: Semantic Intent Resolution (P0)

- **Task 2.1**: Pre-compute and cache vector embeddings for all semantic
  exemplars across the 29 capability manifests.
- **Task 2.2**: Upgrade
  `apps/api/src/api/orchestrator/routing/layer_b_semantic.py` with cosine
  similarity ranking.
- **Task 2.3**: Remove `CATEGORY_KEYWORDS` from
  `apps/api/src/api/orchestrator/router.py`.
- **Task 2.4**: Remove the static `if/elif` agent selection block from
  `router.py:classify_intent()`.
- **Task 2.5**: Retain fast-path guards for conversational greetings and
  distress containment as deterministic safety checks.

### Phase 3: Dynamic Agent Discovery (P0)

- **Task 3.1**: Create `apps/api/src/api/orchestrator/agent_discovery.py` with
  dynamic module discovery.
- **Task 3.2**: Replace static imports in `router.py` with lazy loading via
  discovery registry.
- **Task 3.3**: Sync agent metadata and capabilities to PostgreSQL on
  application startup.
- **Task 3.4**: Expose `GET /agents/registry` for discovery.

### Phase 4: Dynamic Tool Discovery (P1)

- **Task 4.1**: Build `apps/api/src/api/services/tool_registry_service.py` to
  filter tools dynamically per agent run.
- **Task 4.2**: Add `@register_tool` decorator in
  `apps/api/src/api/tools/definitions.py`.
- **Task 4.3**: Integrate native MCP tools into unified discovery pipeline.
- **Task 4.4**: Wire tool discovery into the execution loop.

### Phase 5: Dynamic Model Routing (P1)

- **Task 5.1**: Upgrade `apps/api/src/api/services/model_router.py` to read from
  PostgreSQL `model_registry`.
- **Task 5.2**: Add automated provider health checks and circuit breaker
  fallback.
- **Task 5.3**: Add tenant-specific BYOK and model policy overrides.

### Phase 6: Agent-to-Agent Hierarchy & Sub-Agent Manager (P1)

- **Task 6.1**: Implement
  `apps/api/src/api/orchestrator/contracts/agent_message.py` with typed,
  cryptographically signed messages.
- **Task 6.2**: Build `apps/api/src/api/orchestrator/sub_agent_manager.py`
  allowing main agents to spawn, monitor, and aggregate sub-agents.
- **Task 6.3**: Implement Redis / in-process async event bus in `agent_bus.py`.
- **Task 6.4**: Ensure child sub-agents inherit caller's tenant/workspace
  boundaries and cannot exceed parent scopes.

### Phase 7: Canonical Graph Execution Engine (P1)

- **Task 7.1**: Create `apps/api/src/api/orchestrator/execution/` with explicit
  nodes:
  - `UnderstandNode`
  - `PlanNode`
  - `ExecuteNode`
  - `ObserveNode`
  - `ApproveNode`
  - `ReflectNode`
  - `CompleteNode`
- **Task 7.2**: Connect nodes into a robust StateGraph with cycle detection,
  budget checks, and checkpoint persistence.
- **Task 7.3**: Refactor `run_agent_loop` in `loop.py` to run the state graph
  while maintaining backward-compatible streaming interfaces.

### Phase 8: Prompt Versioning (P2)

- **Task 8.1**: Upgrade `prompt_registry.py` to support DB-backed versioning
  with tenant overrides.
- **Task 8.2**: Add A/B canary testing support for prompt templates.

### Phase 9: Dynamic Frontend Capabilities (P2)

- **Task 9.1**: Add `GET /agents/commands` endpoint returning dynamic slash
  commands based on workspace capabilities.
- **Task 9.2**: Update web app `ChatWindow.tsx` to consume dynamic slash
  commands instead of the static `SLASH` array.

### Phase 10: Repository Pattern (P2)

- **Task 10.1**: Create `apps/api/src/api/repositories/base.py` enforcing tenant
  and workspace filters automatically.
- **Task 10.2**: Create `AgentRepository`, `ToolRepository`, `ModelRepository`,
  `MemoryRepository`.

### Phase 11: Enterprise Evaluation Framework (P2)

- **Task 11.1**: Build `apps/api/src/api/services/evaluation_service.py` to
  evaluate intent accuracy, tool accuracy, groundedness, and hallucination.
- **Task 11.2**: Generate an enterprise golden evaluation dataset.

---

## 3. Backward Compatibility & Zero Downtime Strategy

1. **Feature-Flagged Migration**: All new registry and dynamic discovery
   mechanisms are backed by runtime fallback to established defaults if tables
   are empty.
2. **Deterministic Fallbacks**: If embedding services or vector search are
   unreachable, the system falls back gracefully to cached scoring or
   deterministic fast-paths without crashing.
3. **Database Migration Safety**: Migrations add new tables and nullable foreign
   keys without altering existing production columns.
