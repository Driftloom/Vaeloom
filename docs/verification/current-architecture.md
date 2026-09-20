# Current Monolithic Architecture: Reverse-Engineered Topology

## 1. Executive Summary

This document provides a reverse-engineered architectural topology of the
Vaeloom monorepo as it exists today, mapping caller/callee flows, shared memory
access, and monolithic bottlenecks.

---

## 2. End-to-End System Topology (Current State)

```mermaid
flowchart TD
    subgraph UI ["Next.js 15 Web Application (apps/web)"]
        Pages["App Router Pages (/workspace/[id]/*)"]
        SWR["SWR Data Fetching"]
        APIClient["Transformed API Client (api-client.ts)"]
    end

    subgraph API ["FastAPI Monolith (apps/api)"]
        FastAPIRoot["FastAPI App (api/main.py)"]
        Middleware["TenantMiddleware (GUC Injection)"]
        AuthMiddleware["Auth & CSRF Middleware"]
        Routers["HTTP Routers (/api/v1/*)"]
    end

    subgraph CoreMonolith ["Dual Execution Monoliths"]
        Loop["Orchestrator Loop (loop.py, 3,238 lines)"]
        Context["ContextLoader (context_loader.py)"]
        Executor["ToolExecutor (executor.py, 3,442 lines)"]
    end

    subgraph AgentSubsystem ["Embedded Domain Agents (28 Agents)"]
        Agents["apps/api/src/api/agents/* (No Manifests)"]
        MemoryAgents["Memory Agents (Direct SQL Queries)"]
    end

    subgraph Storage ["Persistence Layer"]
        PG["PostgreSQL 16 (42/42 RLS)"]
        Redis["Redis 7 (Cache & Rates)"]
        Temporal["Temporal Server (Workflows & Activities)"]
    end

    Pages --> APIClient
    APIClient -->|HTTP / JSON| FastAPIRoot
    FastAPIRoot --> Middleware --> AuthMiddleware --> Routers
    Routers --> Loop
    Loop --> Context
    Context -->|Vulnerable Fallback: line 92| PG
    Loop --> Agents
    Agents -->|Direct SQL: 28 violations| PG
    Agents --> Loop
    Loop --> Executor
    Executor -->|In-Process Execution| Storage
    Loop --> Temporal
```

---

## 3. Critical Monolithic Bottlenecks Identified

1. **Dual Monoliths**:
   - `loop.py` (3,238 lines) and `executor.py` (3,442 lines) form a tightly
     coupled core holding all routing, state persistence, tool dispatch, and
     approval handling.
2. **Absence of Service Boundaries**:
   - Domain agents call each other recursively in-process without going through
     network or queue boundaries.
3. **Coupled Business Services**:
   - Deterministic calculations (ATS score, resume layout, salary estimate) are
     tangled inside the API web service.
