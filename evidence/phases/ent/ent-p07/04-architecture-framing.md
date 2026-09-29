# ENT-P07 — 04 Architecture Framing — Enterprise Data Tier Synthesis

> **Phase:** `ENT-P07` (Data Architecture and Database Design)  
> **Deliverable:** Supporting Architecture Framing Specification  
> **Owner:** Principal Data Architect & Security Governance Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Unified Enterprise Data Tier Topology

The Vaeloom Enterprise data architecture combines relational persistence, vector
similarity indexing, immutable document vaults, and distributed session caching
into a secure multi-tenant fabric:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA ACCESS & ROUTING TIER                      │
│  - FastAPI TenantMiddleware (Extracts tenant_id, workspace_id, user_id)│
│  - Supavisor Connection Pooler (:6543 Transaction Mode)                │
│  - Session GUC Injector (set_rls_session_vars per DB connection)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PRIMARY DATABASE TIER (POSTGRESQL 16)                │
│  - 42 Tables with FORCE ROW LEVEL SECURITY                             │
│  - Candidate Sovereign Vaults vs Institutional Enterprise Scopes       │
│  - pgvector HNSW Indexing (1536 / 3072 dims for 22 memory types)       │
│  - Declarative Partitioning for agent_audit_logs by Month              │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌───────────────────────────────────────┐┌───────────────────────────────┐
│     IMMUTABLE DOCUMENT VAULT (S3)     ││     TASK & CACHE BROKER       │
│  - MinIO / AWS S3 Object Storage      ││  - Redis 7.2.5 (BullMQ Queue) │
│  - Encrypted AES-256-GCM at rest      ││  - Ephemeral Agent Scratchpad │
│  - Candidate Resumes, Portfolios, PDF ││  - Sliding Window Rate Limits │
│  - S3 Object Lock for Compliance WORM ││  - SSE / WebSocket Pub/Sub    │
└───────────────────────────────────────┘└───────────────────────────────┘
```

---

## 2. Core Data Architecture Invariants

### Invariant 1: Fail-Closed Row-Level Security (INV-DATA-01)

- 100% of tables containing tenant, workspace, or user data enforce
  `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
- Missing or malformed session configuration GUCs (`app.tenant_id`,
  `app.user_id`, `app.workspace_id`) cause queries to fail closed, returning
  exactly zero rows.
- Table policies never rely on application-level filtering alone.

### Invariant 2: Sovereign Candidate Vault Isolation (INV-DATA-02)

- Candidate personal career memories and private document artifacts are isolated
  inside `candidate_sovereign_vaults`.
- Institutional administrators and enterprise tenants have zero visibility into
  candidate sovereign data without explicit, time-bounded, cryptographically
  auditable `ConsentGrant` records.

### Invariant 3: Cryptographic Provenance Anchoring (INV-DATA-03)

- Every record in `cognitive_memories` carries immutable provenance metadata,
  including the SHA-256 checksum of the originating candidate artifact, line
  numbers, extraction agent ID, and model version.
- LLM prompt generation fetches only memories with valid provenance citations,
  preventing synthetic hallucination loops.

### Invariant 4: Non-Blocking Expand/Contract Schema Evolution (INV-DATA-04)

- All schema migrations adhere strictly to the expand/contract pattern.
- Destructive operations (`DROP COLUMN`, table locks $>2\text{s}$) are
  prohibited in online migrations.
- Every migration script must include a fully tested, idempotent reverse
  rollback down-script.

### Invariant 5: Sub-20ms pgvector Retrieval Latency (INV-DATA-05)

- All vector search queries against `cognitive_memories` execute over
  Hierarchical Navigable Small World (HNSW) indexes with $m=16$ and
  $ef\_construction=64$.
- p95 vector similarity search latency must not exceed 20ms on 100,000
  embeddings while maintaining recall $\ge 99\%$.

---

_Signed: Principal Data Architect & Security Governance Lead — 2026-09-29_
