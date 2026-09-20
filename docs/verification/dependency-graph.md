# Comprehensive System Dependency Graphs & Boundary Maps

## 1. Current Monolithic Architecture & Prohibited Cross-Layer Calls

```mermaid
flowchart TD
    subgraph Presentation ["Presentation Layer"]
        Web["Next.js 15 (apps/web)"]
    end

    subgraph Gateway ["API Gateway (apps/api)"]
        Router["FastAPI Routers (/api/v1/*)"]
        AuthMiddleware["Auth & Tenant Middleware"]
    end

    subgraph CoreMonolith ["Dual Execution Monoliths"]
        Loop["Orchestrator Loop (loop.py, 3,238 lines)"]
        Context["ContextLoader (context_loader.py)"]
        Executor["ToolExecutor (executor.py, 3,442 lines)"]
    end

    subgraph AgentsLayer ["Domain Agents (28 Agents)"]
        AgentCore["BaseAgent Subclasses"]
        MemoryAgents["Memory Consolidator & Retrieval"]
    end

    subgraph DomainServices ["Tangled Domain Services"]
        ATS["semantic_ats.py"]
        DocBuilder["document_builder.py"]
        Salary["salary_service.py"]
    end

    subgraph Persistence ["Persistence & External Layer"]
        DB[(PostgreSQL 16 / Supabase)]
        Redis[(Redis 7)]
        ExternalAPIs[(Google / GitHub / Slack)]
    end

    Web --> Router
    Router --> Loop
    Loop --> Context
    Context -->|VULNERABLE FALLBACK (line 92)| DB
    Loop --> AgentCore
    Loop --> Executor
    Executor --> DomainServices
    Executor --> ExternalAPIs
    DomainServices --> DB

    %% PROHIBITED DEPENDENCY FLOWS
    MemoryAgents -.->|ILLEGAL DIRECT DB (28 imports)| DB
    AgentCore -.->|ILLEGAL DIRECT CONFIG| Gateway
    Executor -.->|CIRCULAR IMPORT| Loop
```

---

## 2. Target Decoupled Enterprise Architecture (Strict Acyclic DAG)

```mermaid
flowchart TD
    subgraph UI ["User Experience"]
        Web["apps/web (Next.js 15)"]
    end

    subgraph API ["Gateway"]
        APIGateway["apps/api (FastAPI Gateway)"]
    end

    subgraph AgentsTier ["Domain Agents (28 Standalone Packages)"]
        Agent01["agents/career-agent/"]
        Agent02["agents/resume-agent/"]
        AgentXX["agents/... (28 Agents with agent.yaml)"]
    end

    subgraph Runtimes ["Runtimes"]
        MessagesWorker["runtimes/messages-api-worker/"]
        TemporalRuntime["runtimes/temporal-workflows/"]
        AgentSDK["runtimes/agent-sdk/"]
    end

    subgraph PlatformPackages ["Foundational Platform Packages"]
        Contracts["packages/agent-contracts/ (Pure Pydantic)"]
        Security["packages/agent-security/ (Zero-Trust)"]
        Policy["packages/agent-policy/ (Manifest Engine)"]
        Common["packages/agent-common/ (ReAct Core)"]
        Memory["packages/agent-memory/ (Two-Tier Memory)"]
        Tools["packages/agent-tools/ (Tool Registry & Sandbox)"]
        Delegation["packages/agent-delegation/ (DAG Router)"]
        Observability["packages/agent-observability/ (OTel/Audit)"]
        Evals["packages/agent-evals/ (Trajectory Harness)"]
    end

    subgraph DomainPackages ["Deterministic Domain Services"]
        DomainATS["packages/domain/ats/"]
        DomainResume["packages/domain/resume/"]
        DomainSalary["packages/domain/salary/"]
    end

    subgraph ConnectorsTier ["Consolidated Connectors"]
        Connectors["packages/connectors/ (9 External Connectors)"]
    end

    subgraph PersistenceTier ["Storage & External Systems"]
        Postgres[(PostgreSQL 16 - 42/42 RLS)]
        RedisCache[(Redis 7 - Working Memory)]
        Providers[(External SaaS APIs)]
    end

    Web --> APIGateway
    APIGateway --> Contracts
    APIGateway --> MessagesWorker
    MessagesWorker --> Common
    Common --> Policy
    Policy --> Contracts
    Common --> Tools
    Common --> Memory
    Common --> Delegation
    Delegation --> AgentsTier
    AgentsTier --> Contracts
    Tools --> DomainPackages
    Tools --> Connectors
    Connectors --> Providers
    Memory --> Postgres
    Memory --> RedisCache
    Common --> Observability
```
