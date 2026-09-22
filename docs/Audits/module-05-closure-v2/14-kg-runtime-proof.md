# Module 05: Closure Verification 2.0 — Knowledge Graph Topology & Synchronization Proof

**Audit Date:** 2026-09-22  
**Target Module:** Knowledge Graph & Entity Relationships  
**Standard:** Zero-Trust Enterprise Forensics  
**Status:** PROVEN ACTIVE

---

## 1. Executive Summary

Vaeloom maintains an active relational Knowledge Graph across `knowledge_nodes`
and `knowledge_edges` tables, mapping relationships between candidates, skills,
companies, job postings, and document artifacts.

```text
========================================================================================
Graph Component     Table Name         Foreign Keys / Integrity  RLS Isolation
========================================================================================
Entities / Nodes    `knowledge_nodes`  `id` (PK), `tenant_id`    PostgreSQL RLS
Relationships       `knowledge_edges`  `source_id`, `target_id`  CASCADE ON DELETE
Workspace Partition Indexed            `workspace_id`            Tenant Scoped
----------------------------------------------------------------------------------------
```

---

## 2. Ingestion & Graph Synchronization

When documents are ingested via `run_pipeline()`:

1. Parsed text spans are analyzed for named entities (organizations, roles,
   technologies, certifications).
2. Deduplicated nodes are inserted into `knowledge_nodes`.
3. Weighted edges (e.g. `HAS_SKILL`, `WORKED_AT`, `ACHIEVED`) are generated and
   linked in `knowledge_edges`.
4. Deletion of a workspace or document automatically cascades to associated
   graph edges, preventing orphaned graph pointers.
