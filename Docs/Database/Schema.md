# Database Schema

> **Purpose:** Define the complete database schema for Vaeloom
> **Canonical source:** [`/Docs/Vaeloom-Complete-Documentation.md#11-database-design`](../../Docs/Vaeloom-Complete-Documentation.md#11-database-design), [`/Docs/Engineering/Implementation/02-database-schema.md`](../../Docs/Engineering/Implementation/02-database-schema.md)

## Overview

The database schema is the physical implementation of Vaeloom's relational data model â€” defining 9 core tables with complete column types, constraints (primary keys, foreign keys, NOT NULL, UNIQUE), and relationships that together store all user data, memory records, knowledge graph entities, application data, and audit logs. The schema is implemented as PostgreSQL DDL with UUID primary keys, workspace_id foreign keys for tenant isolation, JSONB for semi-structured memory content, and TIMESTAMPTZ for temporal data. The schema is managed through version-controlled ORM migrations (Prisma or Alembic) and must never be modified directly in production.

This document defines the complete DDL for all 9 tables, constraint definitions, estimated row counts at MVP scale, and key design decisions (UUID v7, soft deletes, JSONB usage, append-only audit). It serves as the authoritative reference for database engineers, backend developers writing queries, and anyone reviewing schema changes in migration PRs.

## Goals

- Define 9 core tables with complete column types, constraints, and foreign keys in executable DDL
- Enforce workspace_id tenant isolation on every data table through foreign key constraints
- Implement append-only audit log (agent_actions) with database-level protection against UPDATE/DELETE
- Maintain UUID primary keys with gen_random_uuid() (v4, migrating to v7 for high-write tables)
- Support JSONB for semi-structured memory content with extracted indexed columns for frequent query paths

## Scope

**In Scope:**
- Complete DDL for all 9 core tables: users, workspaces, documents, document_versions, memory_records, entities, relationships, applications, agent_actions
- Column types, NOT NULL constraints, primary keys, foreign keys, UNIQUE constraints
- JSONB columns for semi-structured memory record content
- Append-only audit log design with immutability guarantees
- Table comments and estimated row counts at MVP scale

**Out of Scope:**
- Index definitions (covered in Indexes.md)
- Partitioning strategy (covered in Partitioning.md)
- Graph store schema (AGE â€” covered in Knowledge-Graph.md)
- Vector store schema (pgvector â€” covered in Embeddings.md)
- Row-Level Security policies (future improvement)
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

> **Diagram:** Entity-relationship diagram showing 9 core tables in Vaeloom's PostgreSQL schema. **users** â†’ **workspaces** is the root hierarchy â€” every other table is scoped by `workspace_id`. **documents** have a version chain via **document_versions**. **entities** and **relationships** form the knowledge graph. **memory_records** link back to their source documents. **agent_actions** provides the append-only audit log.

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

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Missing foreign key constraints between related tables | Without foreign keys, orphaned rows accumulate â€” documents without a workspace, memory_records without a source document |
| Using TEXT for all string columns instead of specific types | TEXT columns lose the semantic meaning of the data â€” use UUID for IDs, TIMESTAMPTZ for dates, and domain-specific types like FLOAT for confidence scores |
| Forgetting to add NOT NULL constraints to required columns | Nullable columns that should never be null force every query to handle NULL â€” leading to application bugs and inconsistent data quality |
| Schema drift between development and production | Hand-editing the production schema without generating a migration creates drift â€” the next deploy will overwrite the change or fail trying |

## Best Practices

| Practice | Why |
|----------|-----|
| Define all constraints (PK, FK, NOT NULL, UNIQUE) in the schema | Constraints are the database's self-defense against application bugs â€” a missing FK constraint lets orphaned data accumulate silently |
| Use domain-appropriate types for every column | UUID for identifiers, TIMESTAMPTZ for timestamps, FLOAT for confidence scores, JSONB for unstructured content â€” types are documentation |
| Keep the Prisma/SQLAlchemy schema as the single source of truth | All schema changes must be made through the ORM's migration system â€” direct SQL changes to the database create drift that breaks the next deployment |
| Document every table's purpose and expected row count in the schema comments | Schema comments travel with the code and survive migrations â€” they are the most durable form of documentation |

## Security Considerations

| Consideration | Mitigation |
|--------------|-----------|
| Row-Level Security (RLS) for workspace isolation | Enable RLS on all tenant-scoped tables with a policy that checks `workspace_id = current_setting('app.workspace_id')` â€” provides a defense-in-depth layer |
| Avoiding SELECT * in production code | Selecting all columns from a table may inadvertently expose sensitive columns â€” always specify the columns needed |
| Audit log immutability | The agent_actions table must be append-only â€” use database triggers or application-level enforcement to prevent UPDATE or DELETE on audit rows |

## Performance Considerations

| Consideration | Approach |
|--------------|----------|
| JSONB schema flexibility vs query performance | JSONB allows schema flexibility but queries that lack an index scan all rows â€” extract frequently-queried JSONB fields to indexed columns |
| UUID primary key performance | Random UUID v4 as primary key causes index fragmentation on large tables â€” use sequential UUID v7 for high-write tables |
| Column ordering for storage efficiency | Place fixed-size columns (UUID, TIMESTAMPTZ) before variable-size columns (TEXT, JSONB) for better storage alignment and query performance |

---

## Database

| Table | Primary Key | Foreign Keys | Key Constraints | Estimated Rows at MVP Scale |
|-------|-------------|--------------|-----------------|------------------------------|
| `users` | `id UUID` | â€” | `email UNIQUE` | < 10K |
| `workspaces` | `id UUID` | `user_id â†’ users(id)` | â€” | < 15K |
| `documents` | `id UUID` | `workspace_id â†’ workspaces(id)` | â€” | < 100K |
| `document_versions` | `id UUID` | `document_id â†’ documents(id)` | â€” | < 500K |
| `memory_records` | `id UUID` | `workspace_id â†’ workspaces(id)`, `source_document_id â†’ documents(id)` | â€” | < 500K |
| `entities` | `id UUID` | `workspace_id â†’ workspaces(id)` | â€” | < 50K |
| `relationships` | `id UUID` | `from_entity_id â†’ entities(id)`, `to_entity_id â†’ entities(id)` | â€” | < 200K |
| `applications` | `id UUID` | `workspace_id â†’ workspaces(id)` | â€” | < 10K |
| `agent_actions` | `id UUID` | `workspace_id â†’ workspaces(id)` | Append-only (no UPDATE/DELETE) | < 1M |

---

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|---------------|--------------|---------------|
| Table count | 9 core tables | Add tables for new features (retain core schema) | Domain-based schema decomposition with bounded contexts |
| Row count per table (worst: agent_actions) | 1M | Partition by month; composite index on (workspace_id, created_at) | Archive agent_actions > 90 days to cold storage |
| JSONB field extraction | 5 queryable JSONB paths | Extract to indexed columns as query patterns stabilize | Automatic JSONB schema discovery and extraction |
| FK constraint validation overhead | 7 FK relationships | Validate FKs at application layer for bulk inserts; enable FK after | Use NOT VALID FKs for bulk loads; VALIDATE CONCURRENTLY after |

---

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| FK constraint violation on insert | INSERT fails with FK error | Application validates parent ID existence before insert | Log violation; background reconciliation job identifies orphans |
| NOT NULL constraint on backfill | Column added as NOT NULL fails on existing NULL rows | Require backfill before adding NOT NULL constraint | Migration runbook includes backfill step |
| UUID collision (extremely rare) | INSERT fails on PK violation | Application catches and retries with new UUID | Log collision for statistical tracking (should never happen) |
| Schema drift between ORM and database | Application query fails on missing column | Run `prisma migrate deploy` before deploying new code | Migration-first deployment strategy prevents drift |

---

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|-----------------|----------|-----------|
| FK constraint violations | > 10/day | Warning | Schema > Data Integrity |
| Schema version drift (ORM vs DB) | Any drift detected | Critical | Schema > Version Drift |
| Missing NOT NULL on expected columns | > 5 nullable columns that should be NOT NULL | Info | Schema > Constraint Coverage |
| Table row count growth rate | > 20% month-over-month | Info | Schema > Growth |
| New tables created without schema review | Any new table not in version control | Warning | Schema > Governance |

---

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| JSONB for unstructured content has no schema enforcement | Application must handle missing/invalid fields | Validate JSONB content at application layer | Add PostgreSQL CHECK constraints for JSONB validation |
| No soft-delete columns on most tables | DELETE operations lose data permanently | Use application-level soft delete (is_deleted flag) | Add deleted_at timestamps to all user-data tables |
| No table comments in schema definition | Schema intent not visible in database tools | Maintain schema documentation separately | Add COMMENT ON TABLE statements in migrations |
| Row-level security not yet enabled | Workspace isolation relies entirely on application layer | Enforce workspace_id in all application queries | Enable RLS with workspace_id policy on all tenant-scoped tables |

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

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Row-Level Security (RLS) enforcement on all tenant-scoped tables | High | Medium | Q4 2026 |
| JSONB CHECK constraints for structured memory content validation | Medium | Low | Q3 2026 |
| Soft-delete columns on all user-data tables (deleted_at, deleted_by) | Medium | Low | Q3 2026 |
| Table comments in every migration for self-documenting schema | Low | Low | Q3 2026 |
| Database governance automation (schema change notifications, impact analysis) | Low | Medium | Q1 2027 |

---

## Related Documents

- [Database Design.md](./Database-Design.md)
- [Indexes.md](./Indexes.md)
- [`/Docs/Engineering/Implementation/02-database-schema.md`](../../Docs/Engineering/Implementation/02-database-schema.md)
