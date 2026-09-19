# Database Schema

> **Purpose:** Define the complete database schema for Vaeloom **Canonical
> source:**
> [`/docs/Vaeloom-Complete-Documentation.md#11-database-design`](../../docs/Vaeloom-Complete-Documentation.md#11-database-design),
> [`/docs/Engineering/Implementation/02-database-schema.md`](../../docs/Engineering/Implementation/02-database-schema.md)

## Overview

The database schema is the physical implementation of Vaeloom's relational data
model — defining **67 production tables** (with **42 enforced under PostgreSQL Row-Level Security**)
across version-controlled Alembic migrations (`0001_initial_schema.py` through `0042_users_tenant_id.py`).
Tables store user identities, multi-tiered memory records, knowledge graph entities, application states,
resume pipelines, durable task checkpoints, and immutable audit logs.

Tenant isolation is strictly enforced via `workspace_id` and `tenant_id` session variables (`app.workspace_id`,
`app.tenant_id`) checked fail-closed by PostgreSQL Row-Level Security policies.

## Goals

- Define 9 core tables with complete column types, constraints, and foreign keys
  in executable DDL
- Enforce workspace_id tenant isolation on every data table through foreign key
  constraints
- Implement append-only audit log (agent_actions) with database-level protection
  against UPDATE/DELETE
- Maintain UUID primary keys with gen_random_uuid() (v4, migrating to v7 for
  high-write tables)
- Support JSONB for semi-structured memory content with extracted indexed
  columns for frequent query paths

## Scope

**In Scope:**

- Complete DDL for all 9 core tables: users, workspaces, documents,
  document_versions, memory_records, entities, relationships, applications,
  agent_actions
- Column types, NOT NULL constraints, primary keys, foreign keys, UNIQUE
  constraints
- JSONB columns for semi-structured memory record content
- Append-only audit log design with immutability guarantees
- Table comments and estimated row counts at MVP scale

**Out of Scope:**

- Index definitions (covered in Indexes.md)
- Partitioning strategy (covered in Partitioning.md)
- Graph store schema (Apache AGE — provisioned in Docker, UNUSED in code)
- Vector store schema (pgvector — `vector(1536)` column in memories table,
  IVFFlat index in extensions.sql)
- Row-Level Security policies (**DONE — 42/42 tables**, migrations
  0010/0019/0020 + `0005_rls.py`; see RLS section below)
- Materialized views or denormalized reporting tables

---

## Entity Relationship Diagram

```mermaid
erDiagram
 users ||--o{ workspaces : has
 workspaces ||--o{ documents : contains
 documents ||--o{ document_versions : versions
 workspaces ||--o{ memory_records : contains
 workspaces ||--o{ entities : has
 entities ||--o{ relationships : from
 entities ||--o{ relationships : to
 workspaces ||--o{ applications : contains
 workspaces ||--o{ agent_actions : logs
 documents ||--o{ memory_records : sources

 users {
 uuid id PK
 string email UK
 string auth_provider
 timestamp created_at
 }

 workspaces {
 uuid id PK
 uuid user_id FK
 timestamp created_at
 }

 documents {
 uuid id PK
 uuid workspace_id FK
 uuid source_connector_id
 string path
 string type
 string raw_storage_key
 text summary
 timestamp created_at
 }

 document_versions {
 uuid id PK
 uuid document_id FK
 int version_number
 string storage_key
 uuid superseded_by
 }

 memory_records {
 uuid id PK
 uuid workspace_id FK
 string type
 jsonb content
 float confidence
 float importance
 timestamp freshness_at
 uuid source_document_id FK
 }

 entities {
 uuid id PK
 uuid workspace_id FK
 string type
 string canonical_name
 string[] aliases
 }

 relationships {
 uuid id PK
 uuid from_entity_id FK
 uuid to_entity_id FK
 string relation_type
 }

 applications {
 uuid id PK
 uuid workspace_id FK
 string status
 timestamp submitted_at
 }

 agent_actions {
 uuid id PK
 uuid workspace_id FK
 string agent_name
 string action_type
 string status
 }
```

> **Diagram:** Entity-relationship diagram showing 9 core tables in Vaeloom's
> PostgreSQL schema. **users** → **workspaces** is the root hierarchy — every
> other table is scoped by `workspace_id`. **documents** have a version chain
> via **document_versions**. **entities** and **relationships** form the
> knowledge graph. **memory_records** link back to their source documents.
> **agent_actions** provides the append-only audit log.

---

## Key Schemas

### Users & Workspaces

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  auth_provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Documents

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  source_connector_id UUID,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  raw_storage_key TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Memory Records

```sql
CREATE TABLE memory_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL,
  content JSONB NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  importance FLOAT DEFAULT 0.5,
  freshness_at TIMESTAMPTZ DEFAULT now(),
  source_document_id UUID REFERENCES documents(id)
);
```

## Row-Level Security (DONE — 42/42)

RLS is enforced on **42 of 42 tables**: 34 via migration `0010`, +3 via `0019`,
+5 via `0020` (plus `0005_rls.py` base). `TenantMiddleware` resolves tenant
context per request (`TenantContext`) and `set_rls_session_vars`
(`database.py:30`) SETs `app.workspace_id` / `app.user_id` / `app.tenant_id`
GUCs **fail-closed** — a missing context refuses the query instead of opening
access. Full inventory: [Migrations.md](./Migrations.md).

## Common Mistakes

| Mistake                                                     | Consequence                                                                                                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing foreign key constraints between related tables      | Without foreign keys, orphaned rows accumulate — documents without a workspace, memory_records without a source document                                 |
| Using TEXT for all string columns instead of specific types | TEXT columns lose the semantic meaning of the data — use UUID for IDs, TIMESTAMPTZ for dates, and domain-specific types like FLOAT for confidence scores |
| Forgetting to add NOT NULL constraints to required columns  | Nullable columns that should never be null force every query to handle NULL — leading to application bugs and inconsistent data quality                  |
| Schema drift between development and production             | Hand-editing the production schema without generating a migration creates drift — the next deploy will overwrite the change or fail trying               |

## Best Practices

| Practice                                                                     | Why                                                                                                                                          |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Define all constraints (PK, FK, NOT NULL, UNIQUE) in the schema              | Constraints are the database's self-defense against application bugs — a missing FK constraint lets orphaned data accumulate silently        |
| Use domain-appropriate types for every column                                | UUID for identifiers, TIMESTAMPTZ for timestamps, FLOAT for confidence scores, JSONB for unstructured content — types are documentation      |
| Keep the SQLAlchemy models as the single source of truth                     | All schema changes must be made through Alembic migrations — direct SQL changes to the database create drift that breaks the next deployment |
| Document every table's purpose and expected row count in the schema comments | Schema comments travel with the code and survive migrations — they are the most durable form of documentation                                |

## Security Considerations

| Consideration                                    | Mitigation                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row-Level Security (RLS) for workspace isolation | **DONE — 42/42 tables** enforced via migrations 0010/0019/0020 + `0005_rls.py`. `TenantMiddleware` sets `app.workspace_id` (path/header) + `app.user_id` + `app.tenant_id` via `TenantContext`; `set_rls_session_vars` (`database.py`) SETs GUCs **fail-closed** (missing context = refused, never open) |
| Avoiding SELECT * in production code             | Selecting all columns from a table may inadvertently expose sensitive columns — always specify the columns needed                                                                                                                                                                                        |
| Audit log immutability                           | The agent_actions table must be append-only — use database triggers or application-level enforcement to prevent UPDATE or DELETE on audit rows                                                                                                                                                           |

## Performance Considerations

| Consideration                                 | Approach                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| JSONB schema flexibility vs query performance | JSONB allows schema flexibility but queries that lack an index scan all rows — extract frequently-queried JSONB fields to indexed columns  |
| UUID primary key performance                  | Random UUID v4 as primary key causes index fragmentation on large tables — use sequential UUID v7 for high-write tables                    |
| Column ordering for storage efficiency        | Place fixed-size columns (UUID, TIMESTAMPTZ) before variable-size columns (TEXT, JSONB) for better storage alignment and query performance |

---

## Database

| Table               | Primary Key | Foreign Keys                                                          | Key Constraints                | Estimated Rows at MVP Scale |
| ------------------- | ----------- | --------------------------------------------------------------------- | ------------------------------ | --------------------------- |
| `users`             | `id UUID`   | —                                                                     | `email UNIQUE`                 | < 10K                       |
| `workspaces`        | `id UUID`   | `user_id → users(id)`                                                 | —                              | < 15K                       |
| `documents`         | `id UUID`   | `workspace_id → workspaces(id)`                                       | —                              | < 100K                      |
| `document_versions` | `id UUID`   | `document_id → documents(id)`                                         | —                              | < 500K                      |
| `memory_records`    | `id UUID`   | `workspace_id → workspaces(id)`, `source_document_id → documents(id)` | —                              | < 500K                      |
| `entities`          | `id UUID`   | `workspace_id → workspaces(id)`                                       | —                              | < 50K                       |
| `relationships`     | `id UUID`   | `from_entity_id → entities(id)`, `to_entity_id → entities(id)`        | —                              | < 200K                      |
| `applications`      | `id UUID`   | `workspace_id → workspaces(id)`                                       | —                              | < 10K                       |
| `agent_actions`     | `id UUID`   | `workspace_id → workspaces(id)`                                       | Append-only (no UPDATE/DELETE) | < 1M                        |

---

## Scalability

| Dimension                                  | Current Limit           | 10x Strategy                                                        | 100x Strategy                                                 |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Table count                                | 9 core tables           | Add tables for new features (retain core schema)                    | Domain-based schema decomposition with bounded contexts       |
| Row count per table (worst: agent_actions) | 1M                      | Partition by month; composite index on (workspace_id, created_at)   | Archive agent_actions > 90 days to cold storage               |
| JSONB field extraction                     | 5 queryable JSONB paths | Extract to indexed columns as query patterns stabilize              | Automatic JSONB schema discovery and extraction               |
| FK constraint validation overhead          | 7 FK relationships      | Validate FKs at application layer for bulk inserts; enable FK after | Use NOT VALID FKs for bulk loads; VALIDATE CONCURRENTLY after |

---

## Error Handling

| Scenario                              | Detection                                            | Mitigation                                              | Recovery                                                        |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| FK constraint violation on insert     | INSERT fails with FK error                           | Application validates parent ID existence before insert | Log violation; background reconciliation job identifies orphans |
| NOT NULL constraint on backfill       | Column added as NOT NULL fails on existing NULL rows | Require backfill before adding NOT NULL constraint      | Migration runbook includes backfill step                        |
| UUID collision (extremely rare)       | INSERT fails on PK violation                         | Application catches and retries with new UUID           | Log collision for statistical tracking (should never happen)    |
| Schema drift between ORM and database | Application query fails on missing column            | Run `alembic upgrade head` before deploying new code    | Migration-first deployment strategy prevents drift              |

---

## Monitoring

| Metric                                   | Alert Threshold                              | Severity | Dashboard                    |
| ---------------------------------------- | -------------------------------------------- | -------- | ---------------------------- |
| FK constraint violations                 | > 10/day                                     | Warning  | Schema > Data Integrity      |
| Schema version drift (ORM vs DB)         | Any drift detected                           | Critical | Schema > Version Drift       |
| Missing NOT NULL on expected columns     | > 5 nullable columns that should be NOT NULL | Info     | Schema > Constraint Coverage |
| Table row count growth rate              | > 20% month-over-month                       | Info     | Schema > Growth              |
| New tables created without schema review | Any new table not in version control         | Warning  | Schema > Governance          |

---

## Limitations

| Limitation                                               | Impact                                         | Workaround                                                                                      | Future Resolution                                     |
| -------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| JSONB for unstructured content has no schema enforcement | Application must handle missing/invalid fields | Validate JSONB content at application layer                                                     | Add PostgreSQL CHECK constraints for JSONB validation |
| No soft-delete columns on most tables                    | DELETE operations lose data permanently        | Use application-level soft delete (is_deleted flag)                                             | Add deleted_at timestamps to all user-data tables     |
| No table comments in schema definition                   | Schema intent not visible in database tools    | Maintain schema documentation separately                                                        | Add COMMENT ON TABLE statements in migrations         |
| Row-level security enforced (42/42, fail-closed GUCs)    | Defense-in-depth beyond app-layer checks       | RLS policies are the backstop; every query still scopes `workspace_id` at the application layer | Covered by migration inventory in Migrations.md       |

---

## Examples

### Example 1: Create Core Tables DDL

```sql
-- Users
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'clerk',
    auth_provider_id VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workspaces
CREATE TABLE workspaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES users(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Actions (append-only audit log)
CREATE TABLE agent_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    action_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT agent_actions_immutable CHECK (
        pg_trigger_depth() > 0 OR false
    )
);
```

### Example 2: JSONB Query Patterns on memory_records

```sql
-- Insert semi-structured memory record
INSERT INTO memory_records (workspace_id, record_type, content)
VALUES (
    'ws_abc',
    'conversation_summary',
    '{
        "participants": ["Alice", "Bob"],
        "topics": ["database schema", "migration strategy"],
        "action_items": [
            {"owner": "Alice", "task": "Add workspace_id index"},
            {"owner": "Bob", "task": "Write migration script"}
        ],
        "duration_minutes": 45
    }'
);

-- Query by JSONB path (using GIN index)
SELECT record_type, content->>'duration_minutes' AS duration
FROM memory_records
WHERE workspace_id = 'ws_abc'
  AND content @> '{"participants": ["Alice"]}'
  AND (content->>'duration_minutes')::int > 30;
```

---

## Production Table Inventory (67 Tables across 42 Alembic Migrations)

| Subsystem | Tables | RLS Enforced (42 Total) | Alembic Migration |
| :--- | :--- | :--- | :--- |
| **Core Identity & Workspaces** | `users`, `workspaces`, `workspace_members`, `tenants`, `auth_sessions`, `revoked_user_cutoffs`, `api_keys` | `workspaces`, `workspace_members`, `auth_sessions`, `api_keys` | 0001, 0005, 0010, 0042 |
| **Documents & Chunks** | `documents`, `document_versions`, `document_chunks`, `resume_artifacts`, `resume_sources` | **ALL** (5/5) | 0001, 0005, 0020, 0023 |
| **Memory System (6 Types)** | `memory_records`, `scale_memory_nodes`, `memory_versions`, `crdt_sync_deltas`, `proactive_proposals` | **ALL** (5/5) | 0001, 0005, 0019, 0020 |
| **Knowledge Graph** | `entities`, `relationships`, `entity_observations`, `graph_snapshots` | **ALL** (4/4) | 0001, 0005, 0010 |
| **Career & Applications** | `applications`, `application_stages`, `job_listings`, `interview_prep`, `career_goals` | `applications`, `application_stages`, `interview_prep`, `career_goals` | 0001, 0005, 0010 |
| **Agent Execution & Loop** | `agent_actions`, `agent_executions`, `agent_approvals`, `loop_checkpoints`, `tool_idempotencies` | **ALL** (5/5) | 0001, 0005, 0019, 0021 |
| **Connectors & Integrations** | `connectors`, `connector_configs`, `gmail_watches`, `sync_cursors` | **ALL** (4/4) | 0005, 0010, 0036 |
| **Security, Compliance & Keys** | `provider_keys`, `retention_runs`, `audit_logs`, `legal_holds`, `sovereign_identities`, `verifiable_credentials` | **ALL** (6/6) | 0010, 0019, 0020 |
| **Enterprise & Billing** | `subscriptions`, `invoices`, `feature_flag_overrides`, `org_teams`, `org_members` | **ALL** (5/5) | 0010, 0020 |
| **Temporal & Orchestration** | `workflow_executions`, `activity_retries`, `schedule_dispatches` | Monitored | 0038 |

---

## Related Documents

- [Database Design.md](./Database-Design.md)
- [Indexes.md](./Indexes.md)
- [`/docs/Engineering/Implementation/02-database-schema.md`](../../docs/Engineering/Implementation/02-database-schema.md)
