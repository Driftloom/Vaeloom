# Two-Tier Memory Architecture & Storage Forensics Audit

## 1. Executive Summary

The Vaeloom memory system operates across two tiers: **Working Memory**
(episodic context, session scratchpads, short-term turn history) and **Semantic
Memory** (long-term vector store, entity-relationship knowledge graph,
persistent facts).

---

## 2. Memory Tier Classification & Storage Engines

| Memory Tier                 | Storage Backend                                | Scope & Tenancy          | Persistence Model               | RLS & Security Policy          |
| :-------------------------- | :--------------------------------------------- | :----------------------- | :------------------------------ | :----------------------------- |
| **Tier 1: Working Memory**  | Redis / In-Memory Cache                        | Session / Ephemeral Turn | Key-Value TTL (1 hr)            | Workspace prefix key isolation |
| **Tier 2: Semantic Vector** | PostgreSQL `pgvector` / SQLite mock            | Workspace & Tenant       | `embeddings`, `memories` tables | 42/42 RLS policies enforced    |
| **Tier 2: Knowledge Graph** | Relational Graph (`entities`, `relationships`) | Workspace Level          | Persistent SQL                  | Workspace RLS + scoped queries |
| **Tier 2: Document Index**  | `documents`, `document_chunks`                 | Workspace Level          | Persistent SQL                  | Workspace RLS + scoped queries |

---

## 3. Forensic Code Deficiencies & Violations

1. **Direct Database Queries in Memory Handlers (`SEC-P0-01`)**:
   - `apps/api/src/api/agents/memory_agent/retrieval.py` directly executes SQL
     statements:
     - Line 32: `from sqlalchemy import select, text`
     - Line 35: `from api.models.schema import Embedding, Entity, MemoryRecord`
   - Bypasses any policy engine or dynamic memory scope check declared on
     agents.
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
