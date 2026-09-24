# Zero-Trust Architectural Re-Engineering: Master Tasks & Execution Registry

**Target System**: Vaeloom Cognitive AI Platform (`apps/api` & `apps/web`)  
**Standard**: Zero-Trust Autonomous Architecture (Zero Keyword Hacks, Zero
Procedural Ladders, Zero Mock Answer-Faking)  
**Creation Date**: 2026-09-24  
**Status**: IN_RESEARCH_AND_PLANNING

---

## Progress Overview

| Phase        | Milestone                                | Scope                                             |      Status      | Evidence / Artifact                                         |
| :----------- | :--------------------------------------- | :------------------------------------------------ | :--------------: | :---------------------------------------------------------- |
| **Phase 0**  | **Operating Mode & Rules**               | Non-negotiable enterprise constraints             |   `COMPLETED`    | Fully acknowledged; zero band-aids                          |
| **Phase 1**  | **Forensic Repository Audit**            | Code + Tests + DB + Docs deep dive                |  `IN_PROGRESS`   | 4 Parallel Subagents dispatched                             |
| **Phase 2**  | **Legacy-Constraint Register**           | Register all architectural debt & traps           |  `IN_PROGRESS`   | `docs/Audits/agentic-routing-legacy-constraint-register.md` |
| **Phase 3**  | **Target Architecture Blueprint**        | 6-Layer Hybrid Architecture design                | `PENDING_REVIEW` | `docs/Architecture/Agentic-Routing-Architecture.md`         |
| **Phase 4**  | **Typed Intent Envelope**                | Pydantic v2 `IntentEnvelope` (25+ fields)         |    `PLANNED`     | `api/orchestrator/contracts/intent.py`                      |
| **Phase 5**  | **Keyword Routing Elimination**          | Eradicate `CATEGORY_KEYWORDS` & fast-path dicts   |    `PLANNED`     | Strangler Phase 1-7 migration                               |
| **Phase 6**  | **Hybrid Layered Routing Engine**        | Layers A to F (Safety, Vector, LLM, Policy, Exec) |    `PLANNED`     | `api/orchestrator/routing/`                                 |
| **Phase 7**  | **Capability Discovery & AgentCards**    | `AgentCapability` schema & manifests              |    `PLANNED`     | `docs/Architecture/Capability-Registry.md`                  |
| **Phase 8**  | **State-Aware Routing**                  | Conversation turn + active artifact resolution    |    `PLANNED`     | Resolves pronouns ("make it shorter")                       |
| **Phase 9**  | **Memory-Aware Routing**                 | Provenance, sensitivity, and freshness fencing    |    `PLANNED`     | `api/orchestrator/context/memory_resolver.py`               |
| **Phase 10** | **Multi-Agent Task Decomposition**       | Supervisor dynamic dependency DAG                 |    `PLANNED`     | DAG builder replacing 8-word/2-cat heuristic                |
| **Phase 11** | **Human/Emotional Context Signals**      | Structured `ContextSignal` (Rogers OARS)          |    `PLANNED`     | Non-keyword contextual signal engine                        |
| **Phase 12** | **Dynamic Action Proposals Engine**      | Executable proposal chips with tool bindings      |    `PLANNED`     | Dynamic proposal generator                                  |
| **Phase 13** | **LLM Structured Output Contract**       | Pydantic `RoutingDecision` schema                 |    `PLANNED`     | Zero chain-of-thought, auditable summary                    |
| **Phase 14** | **Groundedness & Anti-Hallucination**    | Deny unknown capability / permission              |    `PLANNED`     | Fail-closed capability validation                           |
| **Phase 15** | **Model Failure Hierarchy**              | Deterministic safety -> Semantic -> Safe no-op    |    `PLANNED`     | Fail-closed degradation hierarchy                           |
| **Phase 16** | **Test Suite Modernization**             | A-I test classification & behavioral rewrite      |    `PLANNED`     | Classification of existing 3,640 tests                      |
| **Phase 17** | **Contract-Based Mock Model**            | Scenario-configurable offline simulator           |    `PLANNED`     | Replaces answer-faking mocks in CI                          |
| **Phase 18** | **Determinism & Versioning**             | Model, prompt, and routing version tracking       |    `PLANNED`     | Version headers & trace metadata                            |
| **Phase 19** | **MVP Scope Policy Decoupling**          | Move out of router into Entitlement Engine        |    `PLANNED`     | `api/orchestrator/policy/entitlements.py`                   |
| **Phase 20** | **Orchestrator Procedural Refactor**     | Eradicate 345-line procedural ladder              |    `PLANNED`     | Registry -> Resolver -> Planner -> Policy -> Exec           |
| **Phase 21** | **Capability-Driven Tool Selection**     | `ToolCapability` schema & permission gate         |    `PLANNED`     | Model proposes, Policy authorizes                           |
| **Phase 22** | **Autonomy Levels & Approval Gates**     | READ, SUGGEST, DRAFT, WRITE, ACT                  |    `PLANNED`     | Hard separation of privileges                               |
| **Phase 23** | **Observability & OpenTelemetry**        | Distributed tracing across 6 layers               |    `PLANNED`     | Request correlation, cost & latency spans                   |
| **Phase 24** | **Zero-Trust Security & Multi-Tenancy**  | IDOR, RLS, CSRF, and identity guards              |    `PLANNED`     | Revalidation at every boundary                              |
| **Phase 25** | **Prompt Injection & Evidence Fencing**  | `<untrusted_evidence>` isolation                  |    `PLANNED`     | Data is never instruction                                   |
| **Phase 26** | **Cost & Latency Optimization**          | p50/p95/p99 budgets, semantic cache               |    `PLANNED`     | Small-model fast routing, large model escalation            |
| **Phase 27** | **11 Versioned Architecture Contracts**  | Intent, Capability, Routing, Plan, Tool, etc.     |    `PLANNED`     | `specs/contracts/` & `docs/Architecture/`                   |
| **Phase 28** | **Strangler Migration Execution**        | 7-phase transition with shadow evaluation         |    `PLANNED`     | Zero production downtime or regressions                     |
| **Phase 29** | **Golden Routing Evaluation Dataset**    | Paraphrases, multi-agent, context, negative       |    `PLANNED`     | `tests/ai/routing/golden/`                                  |
| **Phase 30** | **Adversarial Test Suite (25 Vectors)**  | Injection, hallucination, IDOR, collision         |    `PLANNED`     | `tests/ai/routing/adversarial/`                             |
| **Phase 31** | **General Distress Case Verification**   | Semantic equivalence across 5+ variants           |    `PLANNED`     | No keyword overfitting                                      |
| **Phase 32** | **Action Proposal E2E Execution**        | Full execution lifecycle of dynamic chips         |    `PLANNED`     | Chip click -> tool run -> state update                      |
| **Phase 33** | **Full 17-Step E2E Lifecycle Trace**     | End-to-end user request to audit response         |    `PLANNED`     | Zero shortcuts, live endpoints                              |
| **Phase 34** | **Zero-Trust Red-Teaming (22 Modes)**    | Break-the-system fuzzing and boundary stress      |    `PLANNED`     | Replay, races, loops, tenant escape                         |
| **Phase 35** | **Loop Safety & Termination Budgets**    | Hard fail-closed limits on ReAct iterations       |    `PLANNED`     | Token, time, iteration, cycle ceilings                      |
| **Phase 36** | **Memory Write Safety**                  | Provenance, sensitivity, and conflict checks      |    `PLANNED`     | No blind model fact generation                              |
| **Phase 37** | **Complete Architectural Documentation** | 8 core markdown documents with Mermaid            |    `PLANNED`     | `docs/Architecture/`, `docs/AI/`, `docs/Audits/`            |
| **Phase 38** | **Evidence-Based Success Verification**  | Absolute truth in verification                    |    `PLANNED`     | Verification substantiated by traces                        |
| **Phase 39** | **10 Verification Gates (Gate 1 to 10)** | Static, Contract, Unit, Int, E2E, Adv, etc.       |    `PLANNED`     | Weighted release gauntlet                                   |
| **Phase 40** | **Full 3,640 Test Suite Audit & Run**    | Re-run full suite with behavioral metrics         |    `PLANNED`     | Serial execution w/ coverage tracking                       |
| **Phase 41** | **Static Anti-Patch Scanner Script**     | Automated CI linter blocking keyword hacks        |    `PLANNED`     | `scripts/anti_patch_scanner.py`                             |
| **Phase 42** | **Quality & Economics Metrics Report**   | Accuracy, recall, latency, cost per request       |    `PLANNED`     | Real benchmark telemetry                                    |
| **Phase 43** | **Final Architectural Alignment Check**  | Verify LLM/Memory/Registry/Policy roles           |    `PLANNED`     | Alignment verification audit                                |
| **Phase 44** | **20 Final Deliverables & Q&A (A-S)**    | Complete answers to questions A through S         |    `PLANNED`     | Comprehensive final report                                  |
| **Phase 45** | **Final Release Verdict**                | RELEASE VERIFIED vs NOT RELEASE VERIFIED          |    `PLANNED`     | P0-P3 Defect matrix                                         |

---

## Detailed Task Breakdown

### Phase 1 & 2: Forensic Repository Audit & Legacy Constraint Register

- [x] Subagent 1 Dispatched: Orchestration & Routing Deep Dive (`router.py`,
      `loop.py`, `supervisor.py`, `base.py`, `card_registry.py`).
- [x] Subagent 2 Dispatched: Memory, RAG & Knowledge Graph Deep Dive
      (`agents/memory/`, `memory_service.py`, `memories` table, `entities`,
      vector retrieval).
- [x] Subagent 3 Dispatched: Tool & MCP Subsystem Auditor
      (`tools/definitions.py`, `executor.py`, `mcp_client_service.py`, Composio
      connectors).
- [x] Subagent 4 Dispatched: Test Architecture & Constraint Register Auditor
      (`conftest.py`, `tests/`, mock LLM fixtures, offline test assumptions).
- [ ] Synthesize findings into
      `docs/Audits/agentic-routing-legacy-constraint-register.md`.
- [ ] Document the 15 explicit investigation areas mandated by Section 2.

### Phase 3 & 27: Target Architecture & 11 Formal Contracts

- [ ] Create `docs/Architecture/Agentic-Routing-Architecture.md` with Mermaid
      sequence and flow diagrams.
- [ ] Create `docs/Architecture/Capability-Registry.md` detailing
      `AgentCapability` and `ToolCapability`.
- [ ] Create `docs/Architecture/Execution-Planning.md` detailing dynamic
      planning and ReAct execution.
- [ ] Create `docs/Architecture/Agent-Policy-Boundary.md` defining strict
      separation between intelligence and authorization.
- [ ] Create `docs/AI/Routing-Model-Contract.md` detailing Pydantic schemas and
      structured output contracts.
- [ ] Define the 11 versioned architectural contracts:
  1. `IntentEnvelope` (v1.0.0)
  2. `AgentCapability` (v1.0.0)
  3. `RoutingDecision` (v1.0.0)
  4. `ExecutionPlan` (v1.0.0)
  5. `ToolCapability` (v1.0.0)
  6. `MemoryEvidence` (v1.0.0)
  7. `PolicyEvaluation` (v1.0.0)
  8. `ApprovalRequest` (v1.0.0)
  9. `AgentExecutionResult` (v1.0.0)
  10. `QAValidationReport` (v1.0.0)
  11. `OrchestratorAuditEvent` (v1.0.0)

### Phase 4 to 6: Core Routing Engine Overhaul

- [ ] Implement `api.orchestrator.contracts.intent` (`IntentEnvelope` with 25+
      fields).
- [ ] Build Layer A (Deterministic Safety & IDOR Pre-Screen).
- [ ] Build Layer B (Cheap Semantic Candidate Generation via vector embeddings &
      capability centroids).
- [ ] Build Layer C (LLM Semantic Intent Arbitration via TypeSafe Jev System 1 /
      micro-LLM returning `RoutingDecision`).
- [ ] Build Layer D (Deterministic Policy Gate & Entitlement Authorization).
- [ ] Build Layer E (Execution Planner with tool requirements & dependency
      ordering).
- [ ] Build Layer F (Autonomous Execution Runner).

### Phase 7, 20 & 21: Eradication of Procedural Ladders & Dynamic Agent/Tool Execution

- [ ] Eradicate lines 2340-2700 in `loop.py` (procedural `if agent_type == ...`
      ladder).
- [ ] Implement `CapabilityResolver` and dynamic tool binding via `AgentCard`
      contracts.
- [ ] Decouple domain-specific execution into agent classes; orchestrator only
      coordinates.
- [ ] Enable LLM-driven tool proposals with deterministic policy evaluation
      before execution.

### Phase 8 & 9: State-Aware & Memory-Aware Contextual Assembly

- [ ] Build Conversation Turn & Active Artifact Resolver: Resolves
      `"make it shorter"`, `"update this"`, `"send it"` to active
      resume/application/email in state.
- [ ] Build Memory Evidence Resolver: Injects scoped, freshness-rated,
      provenance-backed entities into `<user_context>` XML fencing.
- [ ] Enforce memory sensitivity classifications and strict tenant/workspace
      bindings.

### Phase 10 & 11: Task Decomposition & Human/Emotional Context Signals

- [ ] Overhaul `supervisor.py`: Replace `2 categories + 8 words = multi-agent`
      heuristic with semantic task graph decomposition.
- [ ] Implement `ContextSignal` engine: Translates emotional distress, urgency,
      confusion, and fatigue into cognitive parameters (Rogers OARS response
      tone, micro-step breakdown, low cognitive load) without hardcoded
      keywords.

### Phase 12 & 32: Dynamic Capability-Driven Action Proposals Engine

- [ ] Replace static string arrays (`["☕ 10-Minute Reset", ...]`) with dynamic
      `ActionProposal` objects.
- [ ] Synthesize proposals based on live workspace state (pending applications,
      draft resumes, calendar conflicts).
- [ ] Verify full end-to-end execution of action chips (Click -> Tool Execution
      -> State Update -> Observation).

### Phase 16, 17 & 40: Test Architecture Modernization & Behavioral Guarantees

- [ ] Classify all 3,640 existing tests into A through I tiers.
- [ ] Build `ContractTestModel` in `conftest.py` replacing static answer-faking
      mocks with schema-valid scenario simulators.
- [ ] Preserve behavioral contracts (A, F, G, H, I); rewrite brittle
      implementation-coupled tests (B, C, D, E).
- [ ] Verify 100% full test suite execution without regressions.

### Phase 28, 29, 30 & 31: Golden Dataset, Adversarial Suite & Shadow Migration

- [ ] Create `tests/ai/routing/golden/` with single-intent, paraphrase,
      multi-agent, contextual, emotional, and negative test cases.
- [ ] Create `tests/ai/routing/adversarial/` covering all 25 adversarial vectors
      (injection, collision, missing keywords, stale memory, cross-tenant,
      malformed output).
- [ ] Prove semantic equivalence across 5+ general distress paraphrases without
      keyword reliance.
- [ ] Run Shadow Routing evaluation comparing legacy router vs new router.

### Phase 41 & 42: Static Anti-Patch Scanner & Quality Telemetry

- [ ] Build `scripts/anti_patch_scanner.py` to continuously detect keyword
      additions, procedural ladders, and mock answer-faking.
- [ ] Run benchmark to calculate p50/p95/p99 latency, routing token usage, and
      cost per request.

### Phase 37, 44 & 45: Verification Gauntlet & Final Deliverables

- [ ] Execute Gates 1 through 10.
- [ ] Generate `docs/Audits/agentic-routing-zero-trust-verification.md`.
- [ ] Produce comprehensive answers to questions A through S.
- [ ] Deliver final verdict: `RELEASE VERIFIED` or `NOT RELEASE VERIFIED` with
      full P0-P3 defect matrix.
