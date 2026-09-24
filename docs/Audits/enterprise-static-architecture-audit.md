# Vaeloom Enterprise Static Architecture Audit

**Standard**: Zero-Trust Implementation and Verification Standard (Phase 1 /
Phase 2)  
**Date**: 2026-09-24  
**Auditor**: Antigravity Enterprise Architecture Team  
**Scope**: Full Repository Audit (Backend, Frontend, Agents, Services, Routers,
Middleware, DB, Tools, MCP, Orchestrator)

---

## 1. Executive Summary

A comprehensive, zero-trust repository audit of Vaeloom was performed across:

- **Backend API**: `apps/api/src/api/` (94+ services, 28+ agents, 40+ routers,
  60+ models, 55 migrations)
- **Frontend Web**: `apps/web/` (Next.js 14 App Router, ChatWindow, API client)
- **Orchestration**: `apps/api/src/api/orchestrator/` (router.py, supervisor.py,
  loop.py, capability_registry.py, card_registry.py)
- **Tools & MCP**: `apps/api/src/api/tools/` (definitions.py, executor.py),
  `connectors/`
- **Infrastructure & DB**: PostgreSQL + pgvector, Redis, MinIO, Docker Compose,
  Alembic

While Vaeloom possesses advanced components (such as a 6-layer cognitive routing
engine, 42/42 PostgreSQL RLS tables, dual Jev System 1 + Gemma System 2
architecture, and versioned execution state), **critical business logic still
relies on static, brittle, hard-coded mechanisms**.

This document catalogs every static mechanism identified, its blast radius,
security risk, scalability bottleneck, and the required dynamic replacement.

---

## 2. Static Mechanism Inventory Matrix

| ID        | Category            | Location                                         | Mechanism                                                               | Risk Level | Blast Radius                   |
| --------- | ------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- | ---------- | ------------------------------ |
| **SM-01** | Routing / Intent    | `src/api/orchestrator/router.py:125-141`         | `CATEGORY_KEYWORDS` dictionary (15 categories with fixed string arrays) | **P0**     | Global agent dispatch          |
| **SM-02** | Agent Dispatch      | `src/api/orchestrator/router.py:459-493`         | 35-line `if/elif` hard-coded agent selection ladder                     | **P0**     | Specialist agent selection     |
| **SM-03** | Agent Registry      | `src/api/orchestrator/router.py:71-102`          | Static Python dictionary `AGENT_REGISTRY` with 28 static class imports  | **P0**     | Extensibility, plugin agents   |
| **SM-04** | Model Catalog       | `src/api/services/model_router.py:25-44`         | Static `MODEL_CATALOG` dictionary with hard-coded token costs & limits  | **P1**     | Model upgrades, BYOK pricing   |
| **SM-05** | Model Task Mapping  | `src/api/services/model_router.py:47-103`        | Hard-coded `TASK_MODEL_MAP` and `AGENT_TASK_TYPE_MAP`                   | **P1**     | Dynamic task complexity        |
| **SM-06** | Orchestration DAG   | `src/api/orchestrator/supervisor.py:24-31`       | Hard-coded `SEQUENTIAL_CHAINS` & `PARALLEL_SAFE` sets                   | **P1**     | Multi-agent execution DAGs     |
| **SM-07** | Tool Definitions    | `src/api/tools/definitions.py`                   | 44KB global Python objects; no DB backing                               | **P1**     | Tool discovery & RBAC          |
| **SM-08** | Tool Assignment     | `src/api/agents/*/handler.py`                    | Static tool list assigned in class definitions                          | **P1**     | Dynamic tool permissions       |
| **SM-09** | Frontend Routing    | `apps/web/.../ChatWindow.tsx:202-211`            | Hard-coded `SLASH` command array & agent dot colors                     | **P2**     | Dynamic workspace capabilities |
| **SM-10** | Capability Registry | `src/api/orchestrator/capability_registry.py:25` | In-code list `CANONICAL_CAPABILITIES`; no DB sync                       | **P1**     | Dynamic capability rollout     |
| **SM-11** | Tool DB Registry    | Database schema                                  | Missing `tool_registry` table in PostgreSQL                             | **P1**     | Zero-trust tool verification   |
| **SM-12** | Model DB Registry   | Database schema                                  | Missing `model_registry` table in PostgreSQL                            | **P1**     | Zero-trust model policy        |
| **SM-13** | Policy DB Registry  | Database schema                                  | Missing `policy_registry` table in PostgreSQL                           | **P2**     | Dynamic runtime policies       |
| **SM-14** | Prompt DB Storage   | Database schema / `src/api/prompts/`             | Prompts stored on disk; no DB versioning/tenant overrides               | **P2**     | A/B prompt evaluation          |
| **SM-15** | Repository Layer    | `src/api/services/`                              | No repository abstraction; queries scattered directly in services       | **P2**     | Multi-tenant query audit       |
| **SM-16** | Monolithic Loop     | `src/api/orchestrator/loop.py`                   | 186KB monolithic imperative execution loop                              | **P1**     | Extensible graph execution     |
| **SM-17** | Intent Guard        | `src/api/orchestrator/router.py:356-389`         | Hard-coded `_GREETINGS` and `_DISTRESS_KEYWORDS`                        | **P2**     | Contextual intent handling     |
| **SM-18** | Agent Delegation    | `src/api/orchestrator/supervisor.py`             | Ad-hoc invocation without typed message contracts or event bus          | **P1**     | Sub-agent hierarchies          |

---

## 3. Detailed Forensic Analysis of Static Mechanisms

### 3.1 SM-01 & SM-02: Hard-Coded Keyword Routing and `if/elif` Dispatch

- **Source File**: `src/api/orchestrator/router.py` (Lines 125-141, 459-493)
- **Code Pattern**:
  ```python
  CATEGORY_KEYWORDS = {
      "document_organization": ["organize", "file", "rename", "folder", ...],
      "career_resume": ["resume", "cv", "bullet", "achievement", "ats", ...],
      ...
  }
  ...
  elif best_category == "career_resume":
      fast_agent = "ats" if any(kw in msg_lower for kw in ["score", "ats", "gap", "keyword"]) else "resume"
  elif best_category == "job_search":
      if any(kw in msg_lower for kw in ["internship", "intern", "co-op", "fellowship"]):
          fast_agent = "internship"
  ```
- **Why It Is Static & Brittle**:
  1. Substring matching fails on synonyms, misspellings, multilingual requests,
     or complex compound queries.
  2. Adding a 30th agent requires editing this file, modifying dictionaries, and
     adding branches to the `if/elif` ladder.
  3. Diverges from the 6-layer cognitive routing engine, creating conflicting
     paths and test flakiness.
- **Enterprise Replacement**: Embedding-based semantic similarity against
  declared `semantic_exemplars` in `AgentCapabilityManifest`, unified under the
  6-layer `RoutingEngine`.

### 3.2 SM-03: Static Agent Registry & Hard-Coded Class Imports

- **Source File**: `src/api/orchestrator/router.py` (Lines 9-38, 71-102)
- **Code Pattern**:
  ```python
  from api.agents.analytics_agent.handler import AnalyticsAgent
  ...
  AGENT_REGISTRY: dict[str, type] = {
      "conversation": ConversationAgent,
      "resume": ResumeAgent,
      ...
  }
  ```
- **Why It Is Static & Brittle**: Every agent handler class must be imported at
  module top-level. Memory footprint is high at startup, circular import hacks
  are needed (`import ... inside function`), and dynamically loaded workspace
  plugins or customer-specific agents cannot be registered without codebase
  rebuilds.
- **Enterprise Replacement**: Metadata-driven Dynamic Agent Discovery
  (`agent_discovery.py`) that auto-discovers agents from directories, registers
  capabilities in PostgreSQL, and lazy-loads handlers on demand.

### 3.3 SM-04 & SM-05: Static Model Catalog & Hard-Coded Task Tiers

- **Source File**: `src/api/services/model_router.py` (Lines 25-44, 47-103)
- **Code Pattern**:
  ```python
  MODEL_CATALOG: dict[str, ModelConfig] = {
      "gpt-4o-mini": ModelConfig("gpt-4o-mini", "openai", 128000, 0.00015, 0.0006, "fast"),
      "gpt-4o": ModelConfig("gpt-4o", "openai", 128000, 0.0025, 0.01, "balanced"),
      ...
  }
  TASK_MODEL_MAP: dict[str, str] = { "resume_generate": "balanced", ... }
  ```
- **Why It Is Static & Brittle**:
  1. Model pricing, context windows, and availability change frequently in
     production.
  2. Customers with BYOK (Bring Your Own Key) or dedicated enterprise endpoints
     (Azure OpenAI, private Gemma) cannot customize model configurations without
     redeploying code.
  3. No dynamic fallback chain when a provider is degraded or rate-limited.
- **Enterprise Replacement**: DB-backed `ModelProviderEntry` table with cached
  runtime lookup, health monitoring, circuit breaker integration, and
  tenant-level model override policies.

### 3.4 SM-06 & SM-18: Hard-Coded DAG Heuristics & Untyped Delegation

- **Source File**: `src/api/orchestrator/supervisor.py` (Lines 24-31)
- **Code Pattern**:
  ```python
  PARALLEL_SAFE = {"gmail", "scheduler", "organization", "memory", ...}
  SEQUENTIAL_CHAINS = [
      ["memory", "resume", "ats", "application"],
      ["career", "learning"],
      ...
  ]
  ```
- **Why It Is Static & Brittle**:
  1. Hard-coded lists cannot adapt to new agent pairings or dynamic user
     intents.
  2. Main agent cannot dynamically spawn sub-agents to parallelize sub-tasks
     (e.g., scraping 5 job links simultaneously) and aggregate their results
     safely.
  3. Delegation lacks structured cryptographic or capability-based authorization
     tokens.
- **Enterprise Replacement**: Metadata-driven dependency resolution
  (capabilities declare `parallel_safe` and `dependencies`), typed
  `AgentMessage` protocol, and an enterprise `SubAgentManager` with Redis
  pub/sub messaging.

### 3.5 SM-07, SM-08 & SM-11: Static Tool Definitions Without DB Registry

- **Source File**: `src/api/tools/definitions.py`, Agent Handlers
- **Code Pattern**: Tool definitions are instantiated as static Python objects;
  agents hard-code lists of `Tool(...)` instances in their constructors.
- **Why It Is Static & Brittle**:
  1. No runtime verification of whether a tenant/workspace is authorized to
     execute a specific tool.
  2. MCP tools and built-in tools live in separate registries without unified
     schema validation.
  3. An agent receives all tools indiscriminately, violating the principle of
     least privilege.
- **Enterprise Replacement**: `ToolRegistryEntry` in PostgreSQL, runtime
  `@register_tool` decorator, and dynamic per-execution tool discovery
  (`tool_registry_service.discover_tools(agent, workspace, permissions)`).

### 3.6 SM-16: Monolithic Execution Loop

- **Source File**: `src/api/orchestrator/loop.py` (186KB, ~4,000 lines)
- **Code Pattern**: A single, enormous imperative
  `for _round in range(max_rounds):` loop handling prompt compilation,
  streaming, tool dispatch, memory commits, and QA validation.
- **Why It Is Static & Brittle**: Violates Single Responsibility Principle.
  Impossible to unit-test individual phases in isolation, inject custom state
  nodes, pause/resume execution across distributed workers, or handle complex
  multi-step human-in-the-loop approvals cleanly.
- **Enterprise Replacement**: LangGraph-style canonical execution graph
  (`StateGraph`) with decoupled nodes: `UnderstandNode`, `PlanNode`,
  `ExecuteNode`, `ObserveNode`, `ApproveNode`, `ReflectNode`, `CompleteNode`.

---

## 4. Conclusion & Action Plan

The static architecture creates brittle dispatch ladders, tight coupling, and
security friction. The dynamic architecture designed in Deliverable 02 replaces
each static mechanism with a model-driven, registry-backed, policy-enforced, and
auditable enterprise subsystem.
