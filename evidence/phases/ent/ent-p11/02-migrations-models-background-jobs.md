# ENT-P11 — 02 Database Migrations, Models & Background Jobs

> **Phase:** `ENT-P11` (Backend Implementation)  
> **Deliverable:** `DEL-ENT-P11-02` (v1.0)  
> **Owner:** Lead Database Engineer & Distributed Task Systems Architect  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Alembic Migration Hierarchy & Expand/Contract Framework

The database schema evolves through strictly ordered, reversible Alembic
migrations. The active production database stands at head migration `0061`, with
migrations `0062` through `0066` prepared under the zero-downtime
expand/contract paradigm:

```
apps/api/alembic/versions/
├── 0010_tenant_rls_base.py            # Initial 34-table FORCE RLS baseline
├── 0019_workspace_rls_ext.py          # +3 Tables RLS expansion
├── 0020_sovereign_vaults_rls.py       # +5 Tables sovereign candidate enclaves
├── 0023_resume_artifacts_table.py     # Binary PDF/DOCX storage inline & S3 pointers
├── 0047_service_policies_hardening.py # Service policy boundary remediation
├── 0061_current_production_head.py    # Head migration (42 FORCE RLS Tables)
└── [0062..0066_planned_expansion.py]  # 22-Memory taxonomy & partitioned audit logs
```

### Non-Negotiable Migration Rules:

1. **Lock Timeout Protection:** Every migration executes
   `op.execute("SET lock_timeout = '2s';")` to prevent table lock pileups.
2. **Concurrent Indexing:** All indexes are created concurrently outside
   transaction blocks (`CREATE INDEX CONCURRENTLY`).
3. **Mandatory Rollback Scripts:** Every `upgrade()` function is paired with a
   tested, idempotent `downgrade()` function.

---

## 2. Forty-Two Core Database Models Summary

All 42 tables enforce `FORCE ROW LEVEL SECURITY` and map to declarative
SQLAlchemy 2.0 async models:

| Domain Cluster              | Key Model Classes                                 | Schema Table Names                                       | Multi-Tenant Key |
| :-------------------------- | :------------------------------------------------ | :------------------------------------------------------- | :--------------: |
| **Multi-Tenant Foundation** | `Tenant`, `Organization`, `Workspace`, `User`     | `tenants`, `organizations`, `workspaces`, `users`        |   `tenant_id`    |
| **Sovereign Candidate**     | `CandidateSovereignVault`, `ConsentGrant`         | `candidate_sovereign_vaults`, `consent_grants`           |    `user_id`     |
| **Resumes & Artifacts**     | `Resume`, `ResumeArtifact`, `ResumeTemplate`      | `resumes`, `resume_artifacts`, `resume_templates`        |  `workspace_id`  |
| **Cognitive Memories**      | `CognitiveMemory`, `MemoryRelation`               | `cognitive_memories`, `memory_relations`                 |    `user_id`     |
| **Governance & Audit**      | `AgentAuditLog`, `SessionEvent`, `ApprovalAction` | `agent_audit_logs`, `session_events`, `approval_actions` |   `tenant_id`    |
| **Connectors & MCP**        | `Connector`, `McpToolBridge`, `WebhookEndpoint`   | `connectors`, `mcp_tool_bridges`, `webhook_endpoints`    |  `workspace_id`  |

---

## 3. BullMQ Distributed Task Workers Architecture

Background tasks that exceed the 500ms synchronous API request budget are
offloaded to BullMQ worker processes communicating via Redis 7.2:

```mermaid
graph TD
    API[FastAPI Endpoint] -->|Enqueue Task Payload| Redis[(Redis 7.2 Broker)]

    subgraph Workers["Dedicated Async Task Workers"]
        Redis --> W1[worker_compilation.py<br/>Headless Playwright PDF Render]
        Redis --> W2[worker_extraction.py<br/>TypeSafe Jev Career Fact Extraction]
        Redis --> W3[worker_webhooks.py<br/>Standard Webhooks HMAC-SHA256 Dispatcher]
    end

    W1 --> S3[MinIO S3 Bucket]
    W2 --> DB[(PostgreSQL 16 DB)]
    W3 --> Ext[Enterprise Webhook Receiver]

    W1 -.->|Exhausted Attempts (3)| DLQ[(Dead Letter Queue: dlq:compilation)]
    W3 -.->|Exhausted Attempts (5)| DLQ2[(Dead Letter Queue: dlq:webhooks)]
```

### Worker Process Configuration:

- **`worker_compilation.py`:** Manages a pool of headless Playwright Chromium
  worker instances. Concurrency is pinned to 4 workers per container to prevent
  CPU/memory thrashing.
- **`worker_extraction.py`:** Parses candidate resumes into raw text, calls
  TypeSafe AI Jev S1 for deterministic fact extraction, computes vector
  embeddings, and inserts verified facts into `cognitive_memories`.
- **`worker_webhooks.py`:** Dispatches signed HTTP requests with exponential
  backoff (10s, 30s, 2m, 15m, 1h). Subscriptions with 50 consecutive failures
  are automatically suspended.

---

_Signed: Lead Database Engineer & Distributed Task Systems Architect —
2026-09-29_
