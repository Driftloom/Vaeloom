# Vaeloom Enterprise Dynamic Agent Architecture

**Standard**: Zero-Trust Implementation & Verification Standard (Phase 4)  
**Version**: 2.0.0-Enterprise  
**Date**: 2026-09-24  
**Status**: APPROVED DESIGN

---

## 1. Architectural Philosophy: Deterministic Authority, Dynamic Intelligence

In an enterprise-grade AI-native architecture, there is a fundamental separation
of concerns:

```
+-------------------------------------------------------------------------+
|                  ENTERPRISE PLATFORM (DETERMINISTIC)                   |
| Identity • Authority • Policy • RBAC/ABAC • State • Approvals • Audit   |
+-------------------------------------------------------------------------+
                                   ▲
                                   │ Constrains & Authorizes
                                   ▼
+-------------------------------------------------------------------------+
|                    COGNITIVE RUNTIME (DYNAMIC)                          |
| Intent Resolution • Agent Discovery • Tool Selection • Model Routing   |
| Reasoning • Execution Sequencing • Memory Synthesis • Reflection        |
+-------------------------------------------------------------------------+
```

The Large Language Model (LLM) is an engine of **probabilistic reasoning and
synthesis**, NEVER the authority for security, identity, tenancy, or
permissions.

---

## 2. High-Level End-to-End Architecture

```mermaid
flowchart TD
    UI[User Input / API Request] --> Ctx[Identity / Tenant / Workspace Context Middleware]
    Ctx --> LayerA[Layer A: Security & IDOR Screening]
    LayerA --> LayerB[Layer B: Semantic Candidate Generation]
    LayerB --> LayerC[Layer C: Cognitive Intent Arbitration]
    LayerC --> LayerD[Layer D: Policy & Entitlement Gate]
    LayerD --> LayerE[Layer E: Execution Planning & DAG Generation]

    subgraph Execution_Engine["Canonical State Graph Execution Engine"]
        UnderstandNode[Understand & Context Assembly] --> PlanNode[Plan & Decompose]
        PlanNode --> ToolDiscovery[Dynamic Tool Discovery]
        ToolDiscovery --> ModelRouter[Dynamic Model Router]
        ModelRouter --> ExecuteNode[Execute: LLM / Tool / Sub-Agent]
        ExecuteNode --> ObserveNode[Observe & Validate Output]
        ObserveNode --> CheckApproval{Requires Approval?}
        CheckApproval -- Yes --> ApproveNode[Approval Gate: HITL]
        ApproveNode --> ReflectNode
        CheckApproval -- No --> ReflectNode[Reflect & Replan]
        ReflectNode -- Continue --> PlanNode
        ReflectNode -- Done --> CompleteNode[Complete: Memory / KG / Audit]
    end

    LayerE --> Execution_Engine
    CompleteNode --> Out[Sanitized Response & UI Action Cards]
```

---

## 3. Subsystem 1: Dynamic Intent Resolution (6-Layer Pipeline)

```mermaid
flowchart LR
    subgraph Input
        Q[User Query]
        T[Tenant / Workspace ID]
        U[User Permissions]
    end

    subgraph Layer_A["Layer A: Perimeter Security"]
        Sanitize[Input Sanitization]
        Adversarial[Adversarial Injection Scanner]
        IDOR[IDOR / Boundary Filter]
    end

    subgraph Layer_B["Layer B: Semantic Matcher"]
        Embed[Vector Embeddings]
        Cosine[Cosine Similarity to Exemplars]
        TopK[Top-K Candidate Capabilities]
    end

    subgraph Layer_C["Layer C: Cognitive Arbitration"]
        JevS1[TypeSafe AI Jev S1 <50ms]
        GemmaS2[Gemma 4 31B S2 Synthesizer]
        Arbitrate[Intent Envelope Construction]
    end

    subgraph Layer_D["Layer D: Policy Gate"]
        Entitle[Workspace Tier Entitlement]
        RBAC[User RBAC Authorization]
        Rate[Quota & Rate Check]
    end

    subgraph Layer_E["Layer E: Planner"]
        DAG[Task DAG Decomposition]
        AgentSel[Dynamic Agent Selection]
    end

    Input --> Layer_A --> Layer_B --> Layer_C --> Layer_D --> Layer_E
```

---

## 4. Subsystem 2: Dynamic Agent & Capability Registries

Agents and Capabilities are decoupled:

- **Capability**: Machine-readable contract defining input schema, output
  schema, required tools, risk class, and semantic exemplars.
- **Agent**: Implementation provider for one or more capabilities.

```mermaid
classDiagram
    class AgentCapabilityManifest {
        +String capability_id
        +String agent_id
        +String display_name
        +String description
        +List~String~ semantic_exemplars
        +List~String~ required_tools
        +List~String~ optional_tools
        +List~String~ supported_memory_scopes
        +RiskClass risk_class
        +AutonomyLevel default_autonomy
        +Boolean parallel_safe
        +List~String~ dependencies
    }

    class AgentCard {
        +String name
        +String version
        +String description
        +List~String~ tools
        +Dict input_schema
        +Dict output_schema
        +List~String~ safety_guidelines
        +List~Dict~ few_shot_examples
        +String status
    }

    class AgentRegistryEntry {
        +UUID id
        +String agent_id
        +String name
        +String version
        +String handler_path
        +Boolean is_active
        +UUID tenant_id
        +UUID workspace_id
        +DateTime created_at
    }

    AgentCapabilityManifest "1" -- "*" AgentCard : specifies
    AgentRegistryEntry "1" -- "*" AgentCapabilityManifest : provides
```

---

## 5. Subsystem 3: Dynamic Tool Discovery & Least-Privilege Filtering

An agent does NOT receive all tools indiscriminately. Tools are discovered
dynamically at execution time through 5 filtering stages:

```mermaid
flowchart TD
    Agent[Agent ID & Declared Capability] --> ReqTools[Candidate Tools from Manifest]
    ReqTools --> Filter1[1. Workspace Entitlement Filter]
    Filter1 --> Filter2[2. User RBAC / Scopes Filter]
    Filter2 --> Filter3[3. Risk Class & Kill-Switch Filter]
    Filter3 --> Filter4[4. MCP / Connector Health Filter]
    Filter4 --> Filter5[5. Idempotency & Rate Limit Filter]
    Filter5 --> AvailableTools[Dynamic Authorized Tool Set]

    subgraph Tool_Sources["Tool Sources"]
        Builtin[Built-in Tools: definitions.py]
        MCP[MCP Server Bridges: stdio/http]
        Connectors[External Connectors: OAuth/API]
    end

    Tool_Sources --> ReqTools
```

---

## 6. Subsystem 4: Dynamic Model Routing

```mermaid
flowchart TD
    Task[Agent Task & Complexity Requirements] --> ModelReq[Required Model Capabilities]

    subgraph Policy_Evaluation["Policy & Constraint Evaluation"]
        DataResidency[Tenant Data Residency: e.g. EU-only]
        BYOK[Tenant Provider Keys: OpenAI / Anthropic / Groq]
        SpendLimit[Per-Run & Daily Budget Ceiling]
        Health[Provider Health & Latency History]
    end

    ModelReq --> Policy_Evaluation
    Policy_Evaluation --> ModelSelection{Select Model}

    ModelSelection --> FastTier[Fast Tier: e.g. Gemini 3.5 Flash / GPT-4o-mini]
    ModelSelection --> BalancedTier[Balanced Tier: e.g. GPT-4o / Claude 3.5 Sonnet]
    ModelSelection --> PowerfulTier[Powerful Tier: e.g. Claude 3 Opus / Gemma 4 31B]

    FastTier --> CircuitBreaker[Circuit Breaker & Fallback Chain]
    BalancedTier --> CircuitBreaker
    PowerfulTier --> CircuitBreaker
    CircuitBreaker -- Outage --> FallbackProvider[Secondary Provider]
```

---

## 7. Subsystem 5: Agent-to-Agent Orchestration & Sub-Agent Spawning

Main agents can spawn specialist sub-agents for concurrent task execution. All
agent-to-agent interactions are governed by typed, cryptographically traceable
contracts:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Router as 6-Layer Routing Engine
    participant MainAgent as Main Agent (e.g. CareerAgent)
    participant SubMgr as SubAgentManager
    participant Sub1 as Sub-Agent A (ResumeAgent)
    participant Sub2 as Sub-Agent B (ATSAgent)
    participant Bus as AgentMessageBus (Redis Pub/Sub)
    participant HITL as Approval Manager

    User->>Router: "Tailor resume and run ATS score"
    Router->>MainAgent: Dispatch IntentEnvelope
    MainAgent->>SubMgr: Spawn Sub-Agents (resume, ats)

    Note over SubMgr,Bus: Generate Typed AgentMessage with Delegated Token
    SubMgr->>Bus: Publish AgentMessage(to=resume)
    SubMgr->>Bus: Publish AgentMessage(to=ats)

    par Parallel Sub-Agent Execution
        Bus->>Sub1: Execute Resume Tailoring
        Sub1-->>Bus: AgentMessageResult(resume_draft)
    and
        Bus->>Sub2: Execute ATS Audit
        Sub2-->>Bus: AgentMessageResult(ats_metrics)
    end

    Bus->>SubMgr: Aggregate Results
    SubMgr->>MainAgent: Consolidated Sub-Agent Output

    opt High Risk Action (Send Email / Apply)
        MainAgent->>HITL: Request Approval (Idempotent Token)
        HITL-->>User: Present Interactive Approval Card
        User->>HITL: Approve
        HITL->>MainAgent: Approval Authorized
    end

    MainAgent->>User: Final Grounded Response
```

---

## 8. Subsystem 6: Adaptive RAG & Knowledge Graph Pipeline

```mermaid
flowchart TD
    UserQuery[User Request / Goal] --> RAGDecision{Does Query Need Knowledge?}
    RAGDecision -- No --> DirectResponse[Direct Execution]
    RAGDecision -- Yes --> StrategySelector[Dynamic Strategy Selector]

    StrategySelector --> VectorRetriever[Vector Similarity: pgvector]
    StrategySelector --> KeywordRetriever[BM25 / Full-Text Search]
    StrategySelector --> KGRetriever[Knowledge Graph Traversal: BFS/DFS max depth 10]

    VectorRetriever --> HybridMerge[Hybrid Reciprocal Rank Fusion: RRF]
    KeywordRetriever --> HybridMerge
    KGRetriever --> HybridMerge

    HybridMerge --> Reranker[Context Reranker & Deduplication]
    Reranker --> GroundingGuard[Grounding & Provenance Verification]
    GroundingGuard --> TokenBudgetCompressor[Token Budget Compression]
    TokenBudgetCompressor --> Assembly[Context Sections: Task, Evidence, Profile]
```

---

## 9. Subsystem 7: Memory Architecture & Write Policy

```mermaid
flowchart LR
    Candidate[New Candidate Observation] --> Classify[Classification Engine]
    Classify --> Sensitivity{Sensitivity Check}
    Sensitivity -- Restricted --> Reject[Reject / Redact]
    Sensitivity -- Compliant --> Dedup{Deduplication & Conflict}
    Dedup -- Duplicate --> BumpConfidence[Increment Frequency / Confidence]
    Dedup -- New --> Provenance[Attach Source Doc / Tool Call ID]
    Provenance --> Scoping[Enforce Tenant & Workspace UUID]
    Scoping --> Storage[(PostgreSQL + pgvector + Versioning)]
```

---

## 10. Subsystem 8: Observability, Governance & Telemetry

```mermaid
flowchart TD
    Run[Agent Execution Run] --> Tracing[OTel Distributed Tracing: trace_id, span_id]
    Run --> CostTracking[Token & Cost Tracker: USD per token]
    Run --> Metrics[Prometheus Metrics: Latency, Success Rate, Fallbacks]
    Run --> AuditLog[AuditEvent: actor, action, tenant_id, workspace_id, diff]

    CostTracking --> SpendCeiling{Check Spend Ceiling}
    SpendCeiling -- Limit Exceeded --> Terminate[Terminate Run with COST_BUDGET]
    SpendCeiling -- Under Limit --> Continue[Continue Execution]
```

---

## 11. Security Invariants (INV-001 through INV-012)

Every component must enforce and prove the 12 core security invariants:

1. **INV-001**: Tenant boundary cannot be crossed under any prompt or tool
   payload.
2. **INV-002**: Workspace isolation is strictly enforced via PostgreSQL RLS and
   session variables.
3. **INV-003**: Agent permissions are least-privilege and enforced at runtime.
4. **INV-004**: Tool cannot exceed caller authorization.
5. **INV-005**: Memory writes and reads are scoped to authoritative
   authenticated context.
6. **INV-006**: RAG context injection filters by tenant and workspace IDs.
7. **INV-007**: Cache keys include tenant, workspace, and authorization hash.
8. **INV-008**: Background jobs serialize and re-validate security envelopes.
9. **INV-009**: Agent-to-agent delegation preserves security context and
   descends in privilege.
10. **INV-010**: LLM generated output is never an authority for security
    decisions.
11. **INV-011**: Approvals are single-use, time-bound, user-bound, and
    cryptographic.
12. **INV-012**: External connector secrets are encrypted at rest with envelope
    encryption and never logged.
