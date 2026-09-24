# Legacy Constraint Register: AI Orchestration, Routing & Agent Execution

**Document Identifier**: `REG-LEGACY-ROUTING-01`  
**Creation Date**: 2026-09-24  
**Status**: ACTIVE FORENSIC REGISTER  
**Scope**: Full repository analysis of procedural shortcuts, keyword
dictionaries, static ladders, mock dependencies, and offline constraints across
`apps/api`.

---

## Executive Summary

This register provides a forensic accounting of all legacy architectural
constraints in Vaeloom's cognitive and orchestration pipelines. Each entry
documents the exact file location, original intent, current behavior,
test/production dependencies, removal risks, and the target zero-trust
replacement architecture.

---

## 1. Forensic Constraint Matrix

| ID         | Constraint Category                | Primary Location                             | Original Purpose                                            | Current Defect / Failure Mode                                                                        | Replacement Architecture                                                    |
| :--------- | :--------------------------------- | :------------------------------------------- | :---------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **LCR-01** | `CATEGORY_KEYWORDS`                | `router.py:125-141`                          | Coarse intent categorization without LLM cost               | Blind substring matching; misses synonyms, typos, multilingual, and complex intent                   | **Layer B Embedding Centroid Similarity + TypeSafe Jev System 1**           |
| **LCR-02** | Hardcoded Intent Dicts             | `router.py:347-365`                          | Fast-path greeting handling (`_GREETINGS`, etc.)            | Brittle token comparison; traps varied social openers or typo greetings                              | **Semantic Conversational Classifier (`IntentEnvelope.social_intent`)**     |
| **LCR-03** | Distress Keyword Detection         | `router.py:366-380`                          | Prevent emotional distress queries misrouting to task tools | Hardcoded tuple (`_DISTRESS_KEYWORDS`); fails on colloquial phrasing or unlisted distress words      | **Layer B/C Structured `ContextSignal` Engine**                             |
| **LCR-04** | Agent-Type `if/elif` Ladder        | `loop.py:2340-2700`                          | Procedural dispatch of agents and tool calls                | 345 lines of rigid procedural dispatch; violates Open/Closed principle; bypasses ReAct               | **Dynamic `AgentCard` Contract Resolver + ReAct Tool Executor**             |
| **LCR-05** | MVP Scope Routing                  | `router.py:58-64, 456-460`                   | Cost & feature containment during early MVP                 | Routing layer enforces entitlement policy; confuses "agent not available" with "tenant not entitled" | **Decoupled Deterministic Policy & Entitlement Engine (Layer D)**           |
| **LCR-06** | Static Action-Chip Dicts           | `conversation_agent/handler.py:193-201`      | Quick UI suggestion pills                                   | Static hardcoded arrays; zero workspace state awareness; dumb string dispatch                        | **Workspace-Aware Dynamic `ActionProposal` Engine**                         |
| **LCR-07** | Mock LLM Fixtures                  | `conftest.py:215, 251`                       | Offline CI test reliability                                 | Returns canned strings; fakes answers rather than validating structured contracts                    | **Contract-Based Test Model (`ContractTestModel`) with scenario injection** |
| **LCR-08** | Deterministic Test Assumptions     | `tests/test_router.py`, `test_loop.py`       | Asserts exact agent names from static keywords              | Tests fail if semantic models pick equally valid or superior candidate agents                        | **Behavioral Capability Asserts (`selected_capability == ...`)**            |
| **LCR-09** | Implementation Detail Asserts      | `tests/test_router.py:45`                    | Verify internal dictionary structure                        | Asserts presence of strings in `CATEGORY_KEYWORDS`; tightly couples test to obsolete debt            | **E2E Scenario & Behavioral Contract Testing**                              |
| **LCR-10** | Offline-Only Assumptions           | `conftest.py`, `database.py`                 | Run without external dependencies or GPU                    | Encouraged procedural shortcuts because CI couldn't call real models                                 | **Dual-Mode Contract Simulator (Offline CI valid, Online live proven)**     |
| **LCR-11** | Procedural Routing in Orchestrator | `loop.py:act_phase`                          | Hardcoded execution methods (`agent.build_roadmap()`)       | Orchestrator knows private domain logic of every agent instead of coordinating                       | **Autonomous ReAct Execution with Typed Tool Invocations**                  |
| **LCR-12** | Duplicated Routing Logic           | `router.py` vs `agents.py` vs `chat.py`      | Fast endpoints vs full SSE chat                             | Divergent intent classification in `/chat`, `/chat/stream`, and `/workspaces/{id}/chat`              | **Unified `RoutingEngine` Pipeline Service**                                |
| **LCR-13** | Duplicated Safety Logic            | `router.py:QA` vs `loop.py:QA`               | Multi-stage safety checks                                   | Redundant QA calls validating same outputs; inconsistent fail-closed criteria                        | **Canonical Verification Gatekeeper Pipeline**                              |
| **LCR-14** | Duplicated Tool-Selection Logic    | `definitions.py` vs `loop.py` vs `router.py` | Tool mapping to agents                                      | Truncation to 12 tools (`ordered[:12]`); uncoordinated dynamic MCP tool injection                    | **Dynamic Tool Capability Index with Permission Gating**                    |
| **LCR-15** | Duplicated Memory Selection        | `loop.py:2460` vs `memory_service.py`        | Context hydration before execution                          | RAG blocks injected into raw string prompt then stripped with regex by agents                        | **Structured `<user_context>` XML Fencing with Provenance Tracking**        |

---

## 2. In-Depth Forensic Investigation (Mandatory 15 Areas)

### LCR-01: `CATEGORY_KEYWORDS`

- **Location**:
  [`apps/api/src/api/orchestrator/router.py:125-141`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/router.py#L125-L141)
- **Original Purpose**: Provide sub-5ms intent routing without invoking an LLM,
  reducing latency and operational token cost for obvious commands.
- **Current Behavior**: Loops through 15 categories, sums word occurrences found
  in `msg_lower`, and selects the category with the highest hit count.
- **Dependency**: Used by `classify_intent()`, `_is_complex_multi_agent()`, and
  secondary disambiguators.
- **Tests Depending on It**: `tests/test_router.py` (multiple tests asserting
  keyword hits).
- **Production Dependency**: Core router entry point for all
  `/api/v1/agents/chat` requests.
- **Is It Still Valid?**: **NO**. Fragile against typos, synonyms, paraphrasing,
  and multi-word semantic intent.
- **Risk if Removed Directly**: Break legacy unit tests in `test_router.py` that
  directly inspect dictionary contents or expect keyword-driven routing.
- **Migration Strategy**: Strangler pattern: Layer B Semantic Candidate
  Generator (Vector cosine similarity) runs alongside keyword scoring; shadow
  telemetry logs discrepancies until semantic layer reaches >99% confidence,
  then keyword dict is deprecated.
- **Replacement Architecture**: `SemanticCapabilityIndex` mapping
  1536-dimensional embeddings of queries against Agent Capability Centroids.

### LCR-02: Hardcoded Intent Dictionaries

- **Location**:
  [`apps/api/src/api/orchestrator/router.py:347-365`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/router.py#L347-L365)
- **Original Purpose**: Prevent small-talk ("hi", "hello", "thanks") from
  falling into the low-confidence clarification trap.
- **Current Behavior**: Checks `clean_msg` against a static `frozenset` of ~30
  English greetings and farewells.
- **Dependency**: Directly returns `"conversation", 0.95`.
- **Tests Depending on It**: `test_conversation_agent.py`, `test_router.py`.
- **Is It Still Valid?**: **NO**. Non-English greetings, creative greetings, or
  mixed sentences fail.
- **Replacement Architecture**: `IntentEnvelope.social_intent` classified via
  lightweight decision classifier / semantic exemplar embedding.

### LCR-03: Distress Keyword Detection

- **Location**:
  [`apps/api/src/api/orchestrator/router.py:366-380`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/router.py#L366-L380)
- **Original Purpose**: Intercept panic and burnout queries before task keywords
  route them to robotic job application drafting.
- **Current Behavior**: Matches substring against a hardcoded tuple of 24
  distress tokens.
- **Dependency**: Fast-path route to `ConversationAgent` at 0.95 confidence.
- **Tests Depending on It**: `test_distress_query_routing_and_containment`.
- **Is It Still Valid?**: **NO**. It is a symptom patch. Vulnerable to unlisted
  distress phrases ("I'm losing my mind", "can't do this anymore", "crying at my
  desk").
- **Replacement Architecture**: `ContextSignal` engine analyzing emotional
  valence, urgency, and cognitive load from semantic embeddings and user state.

### LCR-04: Agent-Type `if/elif` Ladder

- **Location**:
  [`apps/api/src/api/orchestrator/loop.py:2340-2700`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/loop.py#L2340-L2700)
- **Original Purpose**: Dispatch agent execution without dynamic runtime
  reflection.
- **Current Behavior**: 345 lines of sequential `if agent_type == ...`
  statements, manually invoking specific methods (`agent.build_roadmap()`,
  `agent.classify_emails()`, `agent.prepare()`).
- **Dependency**: Called by `act_phase()` for all static agent requests.
- **Is It Still Valid?**: **NO**. Completely prevents autonomous tool discovery,
  plugins, and dynamic MCP servers.
- **Replacement Architecture**: Universal `AgentExecutor` calling
  `agent.execute_react(plan, tools, context)` governed by `AgentCard` manifests.

### LCR-05: MVP Scope Routing Lock

- **Location**:
  [`apps/api/src/api/orchestrator/router.py:58-64, 456-460`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/orchestrator/router.py#L58-L64)
- **Original Purpose**: Restrict execution to the 8 canonical MVP agents when
  `settings.mvp_scope_enforced` is True.
- **Current Behavior**: Checks category membership in router and yields
  `out_of_scope` in SSE stream if agent is enterprise.
- **Dependency**: Tied to configuration flag `mvp_scope_enforced`.
- **Is It Still Valid?**: The _business requirement_ (tier gating) is valid, but
  its _architectural location_ is WRONG. Entitlement logic must not be coupled
  to semantic intent classification.
- **Replacement Architecture**: Move to Layer D Deterministic Policy Gate
  (`api.orchestrator.policy.entitlements`). Router identifies true intent;
  policy gate enforces license/tier access.

### LCR-06: Static Action-Chip Dictionaries

- **Location**:
  [`apps/api/src/api/agents/conversation_agent/handler.py:193-201`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/agents/conversation_agent/handler.py#L193-L201)
- **Original Purpose**: Provide user with quick next steps.
- **Current Behavior**: Returns hardcoded arrays of strings based on basic
  keyword substrings.
- **Dependency**: Consumed by `ChatWindow.tsx` as clickable text buttons.
- **Is It Still Valid?**: **NO**. Completely blind to user's real workspace
  state, documents, or active pipeline.
- **Replacement Architecture**: `ActionProposalEngine` that queries live
  database state (pending approvals, unorganized files, draft applications) and
  generates typed executable proposals.

### LCR-07: Mock LLM Fixtures in CI

- **Location**:
  [`apps/api/tests/conftest.py:215, 251`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/tests/conftest.py#L215)
- **Original Purpose**: Allow tests to run without API keys, network access, or
  cost.
- **Current Behavior**: Returns static pre-baked strings or empty dictionaries;
  instance attributes shadow class patches.
- **Dependency**: 3,600+ backend tests rely on `mock_llm` autouse fixture.
- **Is It Still Valid?**: Offline testing is mandatory, but _answer-faking_ is
  harmful.
- **Replacement Architecture**: `ContractTestModel` that implements the exact
  Pydantic schema contract, supports scenario injection, timeout simulation, and
  malformed response testing.

### LCR-08 & LCR-09: Implementation-Coupled Test Assertions

- **Location**: `apps/api/tests/test_router.py`, `test_loop.py`
- **Original Purpose**: Ensure router code runs as expected.
- **Current Behavior**: Tests assert exact dictionary lookups (e.g.
  `assert "resume" in CATEGORY_KEYWORDS["career_resume"]`) rather than user goal
  resolution.
- **Is It Still Valid?**: **NO**. Prevents any refactoring of the underlying
  routing mechanism.
- **Replacement Architecture**: Behavioral test suites asserting
  `IntentEnvelope.required_capability` and goal satisfaction.

### LCR-10: Offline-Only Architecture Assumptions

- **Location**: `database.py`, `conftest.py`
- **Original Purpose**: Fast local development and lightweight CI execution.
- **Current Behavior**: Code is written with fallbacks that mask missing
  database features (e.g. pgvector vector similarity vs SQLite table scans).
- **Replacement Architecture**: Clean abstraction layers (`VectorStoreAdapter`)
  with identical behavioral contracts in SQLite (cosine brute-force) and
  PostgreSQL (pgvector HNSW index).

### LCR-11: Procedural Routing Inside Orchestrator

- **Location**: `apps/api/src/api/orchestrator/loop.py:act_phase`
- **Original Purpose**: Direct execution of agent functions.
- **Current Behavior**: Orchestrator has intimate knowledge of each agent's
  method signatures (`agent.monthly_review`, `agent.analyze_access_logs`).
- **Replacement Architecture**: Uniform
  `BaseAgent.execute(intent_envelope, context)` interface.

### LCR-12: Duplicated Routing Logic

- **Location**: `router.py`, `routers/agents.py`, `routers/chat.py`
- **Original Purpose**: Serving different HTTP endpoints.
- **Current Behavior**: Intent classification and supervisory delegation are
  copy-pasted across streaming, non-streaming, and legacy chat routes.
- **Replacement Architecture**: Single authoritative
  `OrchestrationPipeline.handle()` service.

### LCR-13: Duplicated Safety Logic

- **Location**: `router.py` (QA loop) vs `loop.py` (QA verification gate)
- **Original Purpose**: Validate agent output before returning to user.
- **Current Behavior**: Both router and loop instantiate `QAAgent` and run 3
  retry loops, duplicating latency and token usage.
- **Replacement Architecture**: Single canonical QA Gatekeeper at Layer F.

### LCR-14: Duplicated Tool Selection & Artificial Truncation

- **Location**: `tools/definitions.py`, `loop.py:ordered = ordered[:12]`
- **Original Purpose**: Prevent context window explosion.
- **Current Behavior**: Silently chops off available tools after the first 12,
  regardless of user needs or connected MCP servers.
- **Replacement Architecture**: Semantic tool retrieval: embed tool descriptions
  and dynamically load only the top-K relevant tools for the current intent.

### LCR-15: Duplicated Memory Selection & Raw Context Stripping

- **Location**: `loop.py:_build_context_block`,
  `conversation_agent/handler.py:69`
- **Original Purpose**: Inject memory into LLM prompts.
- **Current Behavior**: Memory context is dumped into a raw text string, which
  downstream agents strip via regex (`re.split(r"\n\n\[Context from")`) because
  it was polluting conversation style.
- **Replacement Architecture**: Explicit memory injection into structured prompt
  sections (`<user_profile>`, `<relevant_memories>`) with strict XML boundary
  fencing.
