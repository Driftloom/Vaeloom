# Two-Tier Memory Architecture & Storage Forensics Audit

## 1. Executive Summary

The Vaeloom memory system operates across two tiers: **Working Memory**
(episodic context, session scratchpads, short-term turn history) and **Semantic
Memory** (long-term vector store, entity-relationship knowledge graph,
persistent facts).

---

## 2. Memory Tier Classification & Storage Engines

| Memory Tier                 | Storage Backend                                | Scope & Tenancy          | Persistence Model               | RLS & Security Policy             |
| :-------------------------- | :--------------------------------------------- | :----------------------- | :------------------------------ | :-------------------------------- |
| **Tier 1: Working Memory**  | Redis / In-Memory Cache                        | Session / Ephemeral Turn | Key-Value TTL (1 hr)            | Workspace prefix key isolation    |
| **Tier 2: Semantic Vector** | PostgreSQL `pgvector` / SQLite mock            | Workspace & Tenant       | `embeddings`, `memories` tables | RLS policies on 44 audited tables |
| **Tier 2: Knowledge Graph** | Relational Graph (`entities`, `relationships`) | Workspace Level          | Persistent SQL                  | Workspace RLS + scoped queries    |
| **Tier 2: Document Index**  | `documents`, `document_chunks`                 | Workspace Level          | Persistent SQL                  | Workspace RLS + scoped queries    |

---

## 3. Forensic Code Deficiencies & Violations

1. **Direct Database Queries in Memory Handlers (`SEC-P0-01`)** — **RESOLVED 2026-10-07**:
   - An agent-local retrieval module directly executed SQL
     statements (`from sqlalchemy import select, text`; `from
     api.models.schema import Embedding, Entity, MemoryRecord`), bypassing any
     policy engine or dynamic memory scope check declared on agents.
   - That module was never imported by any production code path — only by three
     test files. It has been **deleted**. Retrieval now goes exclusively through
     `MemoryService.search_memories`, which enforces tenant/workspace scoping and
     the caller's status filters on every query.
2. **Duplicated Memory Implementations**:
   - `apps/api/src/api/memory/` contains generic memory managers.
   - `apps/api/src/api/agents/memory_agent/` contains extraction, merge, and
     retrieval logic.
   - `apps/api/src/api/agents/memory/` contains duplicate agent handlers
     (`consolidator.py`, `document_agent.py`, `planning_agent.py`,
     `reflection_agent.py`, `self_improvement_agent.py`).
3. **Target Modularization (`packages/agent-memory/`)**:
   - Consolidate all memory logic into `packages/agent-memory/`:
     - `packages/agent-memory/working/` (Redis session & turn buffer)
     - `packages/agent-memory/semantic/` (Vector embeddings & semantic search)
     - `packages/agent-memory/graph/` (Entity & relationship knowledge graph)
     - `packages/agent-memory/policy/` (MemoryScopes contract enforcement)
