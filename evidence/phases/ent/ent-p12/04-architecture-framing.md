# ENT-P12 — 04 Architecture Framing — Enterprise AI & Memory Synthesis

> **Phase:** `ENT-P12` (AI Agent Memory and Data Pipeline Implementation)  
> **Deliverable:** Supporting Architecture Framing Specification  
> **Owner:** Principal Enterprise AI Architect & Cognitive Systems Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Unified Enterprise AI Architecture Topology

The Vaeloom cognitive platform combines multi-agent orchestration,
high-dimensional semantic memory, deterministic tool sandboxing, and a two-tier
cognitive pipeline:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        USER / API INTERACTION LAYER                    │
│  - SSE Streaming Hook (useAgentStream) consumes live ReAct thoughts    │
│  - Presentation Tier renders typed JSON cards (ResumeCard, JobCard)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR & INTENT ROUTING TIER                   │
│  - System 1 (TypeSafe AI Jev): Sub-50ms deterministic action routing   │
│  - 28 Specialist Agent Roster extending shared BaseAgent harness       │
│  - Plan-Act-Observe-Reflect-Improve execution loop with 3x QA retries  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌───────────────────────────────────┐       ┌───────────────────────────────────┐
│     SEMANTIC MEMORY & RAG TIER    │       │     TOOL & MCP CAPABILITY PLANE   │
│ - 22-Memory Type Taxonomy         │       │ - 5 Tool Trust Tiers              │
│ - pgvector HNSW Cosine Index      │       │ - Sandboxed MCP v2 Client Service │
│ - Hybrid Dense-Sparse (BM25+RRF)  │       │ - SSRF URL Guard (RFC 1918 Block) │
│ - Memory Consolidation & Provenance│      │ - HMAC-SHA256 HITL Approval Gate  │
└───────────────────────────────────┘       └───────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    TWO-TIER COGNITIVE INFERENCE PLANE                  │
│  - Tier 1 (System 1): TypeSafe AI Jev (choice, noul, score) in < 50ms   │
│  - Tier 2 (System 2): Ollama Cloud Gemma 4 31B grounded synthesis      │
│  - XML Context Fencing (<document_context>) & [UNTRUSTED_DATA] wrapping│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Cognitive Architecture Invariants

### Invariant 1: Two-Tier Cognitive Separation (INV-AI-01)

- Deterministic action classification, routing, and destructive action triage
  are handled exclusively by TypeSafe AI Jev System 1 in $< 50\text{ ms}$.
- Deep generative synthesis is executed via Ollama Cloud Gemma 4 31B (with local
  12B container fallback).
- Generative tokens are never wasted on deterministic logic or policy routing.

### Invariant 2: Candidate Memory Sovereignty & Database RLS Isolation (INV-AI-02)

- All candidate memories across all 22 types are strictly owned by `user_id` and
  isolated by `workspace_id`.
- Retrieval queries enforce transaction-local session GUCs
  (`app.workspace_id = memories.workspace_id`).
- Institutional employer tenants cannot access candidate memory without active,
  explicit `ConsentGrant`.
- Erasure requests execute KMS DEK destruction, rendering embeddings and raw
  text unrecoverable within 60s.

### Invariant 3: Mandatory Human-in-the-Loop Gating for Consequential Tools (INV-AI-03)

- Tier 4 consequential operations (application dispatches, email dispatches,
  workspace policy mutations, primary resume overwrites) strictly require user
  confirmation.
- The platform generates an HMAC-SHA256 approval token with a 15-minute TTL;
  autonomous execution without user signature is structurally impossible.

### Invariant 4: Strict Untrusted Data Fencing & Length Capping (INV-AI-04)

- All external tool execution outputs, scraped web pages, and uploaded files are
  wrapped in `[UNTRUSTED_DATA]` markers and capped at 4,000 characters.
- System prompt instructions are isolated inside dedicated XML fences
  (`<system_instructions>`), preventing indirect prompt injection attacks from
  altering agent policies.

### Invariant 5: Sub-15ms Vector Query Latency & Zero Mock Live Validation (INV-AI-05)

- pgvector HNSW semantic retrieval maintains $< 15\text{ ms}$ p95 query latency
  under production multi-tenant concurrency.
- In accordance with the Enterprise Honesty Mandate, 100% of live integration
  and cognitive test suites execute against authentic endpoints (PostgreSQL,
  MinIO, TypeSafe AI, Ollama Cloud) with zero mocks or synthetic bypasses.

---

_Signed: Principal Enterprise AI Architect & Cognitive Systems Lead —
2026-09-29_
