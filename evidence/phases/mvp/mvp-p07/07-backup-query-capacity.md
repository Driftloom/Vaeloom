# P07 — Backup, Query & Capacity Design

> **Phase:** MVP-P07 · Hardening **Owner:** Vaeloom **Status:** Active **Last
> updated:** 2026-08-16

---

## 1. Backup & Recovery Strategy

### 1.1 Backup Schedule & Method

| Component | Method | Schedule | RPO | Retention |
| ------------------------ | ------------------------- | ------------------- | ---- | --------- |
| PostgreSQL | `pg_dump` (custom format) | Daily 02:00 UTC | ≤24h | 30 days |
| Object storage (S3/Blob) | Server-side sync | Daily after DB dump | ≤24h | 30 days |
| Vector store (pgvector) | Included in pg_dump | Daily with DB | ≤24h | 30 days |

### 1.2 Backup Execution Flow

```
02:00 UTC  pg_dump --format=custom --compress=6 --file=backup.dump
02:05 UTC  Upload backup.dump to object storage /backups/{date}/
02:10 UTC  Sync object storage bucket (server-side)
02:15 UTC  Verify backup integrity (pg_restore --list)
02:20 UTC  Prune backups older than 30 days
```

### 1.3 Recovery Objectives

| Metric | Target | Notes |
| ----------------- | ------------------------ | ------------------------------------ |
| **RPO** | ≤24h | BQ-P07-02: daily backup cadence |
| **RTO** | ≤24h | Best-effort for non-critical systems |
| **Restore scope** | Full DB + object storage | No partial restores unless debugging |

### 1.4 Failure Handling

- **Backup failure:** Immediate alert via OTEL span event → PagerDuty
 integration
- **Integrity check failure:** Mark backup as corrupt, trigger re-run, alert
- **Upload failure:** Retry 3× with 5min backoff, then alert
- **Prune failure:** Log warning, do not block next backup cycle

### 1.5 Recovery Ordering

Recovery follows a strict sequence to ensure data consistency:

1. **Restore PostgreSQL** from latest good backup (`pg_restore`)
2. **Verify schema** matches current codebase version
3. **Replay queue** for any events between backup time and failure time
4. **Rebuild projections** for event-sourced read models
5. **Verify vector store** embeddings are consistent with source documents
6. **Run health checks** — all `/health` endpoints must pass

### 1.6 Restore-to-Scratch in CI

Restore tests run weekly in CI to validate backup integrity:

```yaml
restore-test:
  runs-on: ubuntu-latest
  steps:
    - name: Download latest backup from object storage
    - name: Restore to ephemeral PostgreSQL
    - name: Run schema migration check
    - name: Run smoke test suite against restored DB
    - name: Teardown ephemeral DB
```

---

## 2. Query Patterns & Indexes

### 2.1 Current Index Inventory

All indexes defined in `backend/core/db/schema.py` and related models:

#### Memory System

| Index | Columns | Type | Notes |
| ---------------------------------------- | ---------------------------------- | ------ | ------------------------------- |
| `idx_memories_tenant_type` | `(tenant_id, memory_type)` | B-tree | Memory type lookup per tenant |
| `idx_memories_tenant_status` | `(tenant_id, status)` | B-tree | Active/archived filtering |
| `idx_memories_tenant_domain` | `(tenant_id, domain)` | B-tree | Domain-scoped queries |
| `idx_memories_workspace_id` | `(workspace_id)` | B-tree | Workspace membership |
| `idx_memory_records_workspace_type` | `(workspace_id, memory_type)` | B-tree | Type-filtered workspace queries |
| `idx_memory_records_workspace_freshness` | `(workspace_id, last_accessed_at)` | B-tree | Staleness/refresh ordering |

#### Graph / Knowledge

| Index | Columns | Type | Notes |
| ------------------------------- | ----------------------------- | ------ | ----------------------------- |
| `idx_entities_workspace_id` | `(workspace_id)` | B-tree | Entity lookup by workspace |
| `idx_entities_workspace_type` | `(workspace_id, entity_type)` | B-tree | Type-filtered entity queries |
| `idx_relationships_from_entity` | `(from_entity_id)` | B-tree | Outgoing edge traversal |
| `idx_relationships_to_entity` | `(to_entity_id)` | B-tree | Incoming edge traversal |
| `idx_embeddings_workspace_id` | `(workspace_id)` | B-tree | Embedding lookup by workspace |
| `idx_embeddings_source` | `(source_type, source_id)` | B-tree | Reverse lookup to source doc |

#### Documents & Connectors

| Index | Columns | Type | Notes |
| ----------------------------------- | ----------------------- | ------ | ------------------------ |
| `idx_documents_workspace_id` | `(workspace_id)` | B-tree | Document listing |
| `idx_documents_source_connector_id` | `(source_connector_id)` | B-tree | Connector-scoped queries |
| `idx_connectors_workspace_id` | `(workspace_id)` | B-tree | Connector listing |

#### Applications & Scheduling

| Index | Columns | Type | Notes |
| ------------------------------------ | ---------------------------- | ------ | ------------------ |
| `idx_applications_workspace_id` | `(workspace_id)` | B-tree | App listing |
| `idx_applications_workspace_status` | `(workspace_id, status)` | B-tree | Status filtering |
| `idx_schedule_events_workspace_id` | `(workspace_id)` | B-tree | Schedule listing |
| `idx_schedule_events_workspace_date` | `(workspace_id, event_date)` | B-tree | Date-range queries |

#### Agents & Execution

| Index | Columns | Type | Notes |
| --------------------------------------- | ------------------------------------ | ------ | -------------------------------- |
| `idx_agents_workspace_id` | `(workspace_id)` | B-tree | Agent listing |
| `idx_agent_executions_agent_id` | `(agent_id)` | B-tree | Execution history per agent |
| `idx_agent_actions_workspace_created` | `(workspace_id, created_at)` | B-tree | Activity feed, ordered |
| `idx_agent_actions_workspace_agent` | `(workspace_id, agent_id)` | B-tree | Per-agent filtering in workspace |
| `idx_agent_approvals_workspace_status` | `(workspace_id, status)` | B-tree | Pending/completed filtering |
| `idx_agent_approvals_workspace_created` | `(workspace_id, created_at)` | B-tree | Approval timeline |
| `idx_agent_schedules_agent_id` | `(agent_id)` | B-tree | Schedule per agent |
| `idx_approval_workspace_status_expiry` | `(workspace_id, status, expires_at)` | B-tree | Expiry-aware approval queries |

#### Permissions & Events

| Index | Columns | Type | Notes |
| --------------------------------- | -------------------------- | ------ | -------------------------- |
| `idx_permissions_workspace_id` | `(workspace_id)` | B-tree | Permission listing |
| `idx_permissions_workspace_agent` | `(workspace_id, agent_id)` | B-tree | Per-agent permission check |
| `idx_events_tenant_type` | `(tenant_id, event_type)` | B-tree | Event filtering |
| `idx_events_tenant_status` | `(tenant_id, status)` | B-tree | Status filtering |
| `idx_events_correlation_id` | `(correlation_id)` | B-tree | Distributed tracing |

#### Usage, Notifications, Plugins

| Index | Columns | Type | Notes |
| ---------------------------------- | ----------------------------------- | ------ | ---------------------------- |
| `idx_usage_records_tenant_metric` | `(tenant_id, metric_name)` | B-tree | Usage aggregation |
| `idx_notifications_workspace_id` | `(workspace_id)` | B-tree | Notification listing |
| `idx_notifications_workspace_read` | `(workspace_id, is_read)` | B-tree | Unread filtering |
| `idx_notifications_workspace_type` | `(workspace_id, notification_type)` | B-tree | Type filtering |
| `idx_plugins_tenant_status` | `(tenant_id, status)` | B-tree | Plugin status per tenant |
| `idx_plugin_executions_plugin_id` | `(plugin_id)` | B-tree | Execution history per plugin |

#### Idempotency & Gmail

| Index | Columns | Type | Notes |
| ------------------------------------- | ---------------------- | ------ | ------------------------------ |
| `idx_idempotency_expires` | `(expires_at)` | B-tree | Cleanup of expired keys |
| `idx_gmail_watches_channel_id` | `(channel_id)` | B-tree | Gmail push notification lookup |
| `idx_gmail_watches_status_expiration` | `(status, expiration)` | B-tree | Active watch filtering |

#### Workspaces

| Index | Columns | Type | Notes |
| ------------------------ | ----------- | ------ | ------------------------ |
| `idx_workspaces_user_id` | `(user_id)` | B-tree | User's workspace listing |

### 2.2 Missing Indexes (P07 Design)

These indexes are needed but not yet created:

| Index | Columns | Type | Condition | Reason |
| ------------------------------------- | ------------------------------- | -------------- | --------------------------------- | --------------------------------------------------- |
| `idx_memories_workspace_type_deleted` | `(workspace_id, memory_type)` | Partial B-tree | `WHERE deleted_at IS NULL` | Soft-delete filtering in list views |
| `idx_memories_workspace_supersedes` | `(workspace_id, supersedes_id)` | Partial B-tree | `WHERE supersedes_id IS NOT NULL` | Version chain traversal |
| `idx_approval_request_expires` | `(expires_at)` | Partial B-tree | `WHERE status = 'pending'` | Expired approval cleanup job |
| `idx_embeddings_hnsw` | `(embedding vector_cosine_ops)` | HNSW | — | Vector similarity search (requires pgvector ≥0.5.0) |

### 2.3 Query Pattern Documentation Template

Every hot-path query must be documented with this template:

```markdown
### Query: {name}

- **Endpoint:** `{method} {path}`
- **SQL:** `{description}`
- **Indexes used:** `{index_names}`
- **EXPLAIN output:** `{date}`
- **Rows scanned vs returned:** `{ratio}`
- **P99 latency:** `{ms}`
```

### 2.4 EXPLAIN Plan Requirements

| Hot Path | Required EXPLAIN Checkpoint | Threshold |
| ------------------------------- | --------------------------- | ---------- |
| Memory list by workspace | Before P15 delivery | ≤200ms P99 |
| Entity graph traversal | Before P15 delivery | ≤200ms P99 |
| Vector similarity search | When HNSW created | ≤100ms P99 |
| Approval queue query | Before P15 delivery | ≤200ms P99 |
| Event stream by correlation | Before P15 delivery | ≤100ms P99 |
| Workspace dashboard aggregation | Before P15 delivery | ≤300ms P99 |

### 2.5 N+1 Prevention Rules

1. **Workspace list views:** Use `selectinload()` or `joinedload()` for
 associations
2. **Agent execution lists:** Batch-load `agent_actions` with `IN` clause, not
 per-row
3. **Graph traversal:** Use recursive CTEs, not application-level loops
4. **Embedding lookups:** Always use vector index scan, never sequential

---

## 3. Index Strategy

### 3.1 B-tree Indexes

**Use for:** Equality and range queries on scalar columns.

**Convention:**

- Composite indexes always lead with `workspace_id` or `tenant_id`
- Follow with the most selective filter column
- Include `created_at` or `updated_at` for ordering when applicable

**Examples:**

```sql
-- Standard workspace-scoped lookup
CREATE INDEX idx_memories_workspace_type
  ON memories (workspace_id, memory_type);

-- Status filter with ordering
CREATE INDEX idx_agent_actions_workspace_created
  ON agent_actions (workspace_id, created_at DESC);
```

### 3.2 Partial Indexes

**Use for:** Queries that consistently filter on a constant condition.

**Convention:**

- Always specify `WHERE` clause in index definition
- Use for soft-delete (`deleted_at IS NULL`), status (`status = 'pending'`), and
 similar

**Examples:**

```sql
-- Soft-delete filter (missing, needs creation)
CREATE INDEX idx_memories_workspace_type_deleted
  ON memories (workspace_id, memory_type)
  WHERE deleted_at IS NULL;

-- Pending-only approval expiry (missing, needs creation)
CREATE INDEX idx_approval_request_expires
  ON approval_requests (expires_at)
  WHERE status = 'pending';
```

### 3.3 Unique Partial Indexes

**Use for:** Idempotency guarantees and deduplication.

**Examples:**

```sql
-- Idempotency keys (auto-cleanup via expires_at)
CREATE UNIQUE INDEX idx_idempotency_key
  ON idempotency_keys (idempotency_key)
  WHERE expires_at > now();
```

### 3.4 HNSW Index (Vector Search)

**Use for:** Approximate nearest-neighbor similarity search on embeddings.

**Prerequisites:**

- pgvector extension ≥ 0.5.0
- Embeddings table populated
- Vector dimensions set (e.g., 1536 for OpenAI ada-002)

**When to create:**

- After initial embedding backfill completes
- Before wiring vector search into MemoryService
- When pgvector version is confirmed in production

**Creation:**

```sql
CREATE INDEX idx_embeddings_hnsw
  ON embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Tuning parameters:**

- `m`: connections per node (16 default, 32 for higher recall)
- `ef_construction`: build-time search width (64 default, 128 for higher recall)
- `ef_search`: query-time search width (tunable at query time)

### 3.5 Index Naming Convention

```
idx_{table}_{col1}[_{col2}][_{modifier}]
```

Examples:

- `idx_memories_workspace_type` — composite
- `idx_memories_workspace_type_deleted` — partial (modifier = deleted)
- `idx_embeddings_hnsw` — algorithm type as modifier

---

## 4. Capacity Model

### 4.1 Current Estimates

| Metric | Target | Upper Bound | Notes |
| ------------------------ | ------ | ----------- | ------------------------- |
| Concurrent users | 100 | 1,000 | Per-workspace, not global |
| Workspaces | 100 | 1,000 | MVP scale |
| Memories per workspace | 10,000 | 100,000 | Including versions |
| Entities per workspace | 5,000 | 50,000 | Knowledge graph |
| Documents per workspace | 1,000 | 10,000 | Source materials |
| Embeddings per workspace | 10,000 | 100,000 | 1 per chunk |

### 4.2 Per-Table Row Estimates (12-month horizon)

| Table | 12-month estimate | Growth driver |
| ------------------- | ----------------- | -------------------------------- |
| `memories` | 1M rows | Versioned memories accumulate |
| `memory_records` | 500K rows | Access patterns per memory |
| `entities` | 500K rows | Knowledge graph growth |
| `relationships` | 2M rows | Edge density grows quadratically |
| `embeddings` | 10M rows | Document chunking |
| `documents` | 100K rows | Source documents |
| `events` | 50M rows | Audit trail, append-only |
| `agent_executions` | 5M rows | Agent activity logging |
| `agent_actions` | 10M rows | Per-step action records |
| `approval_requests` | 100K rows | Moderate volume |
| `usage_records` | 10M rows | Per-request metering |

### 4.3 Connection Pool Sizing (PgBouncer)

| Setting | Value | Rationale |
| --------------------- | ----------- | ----------------------------------------- |
| `default_pool_size` | 20 | Handles 100 concurrent with queuing |
| `max_client_conn` | 200 | 10× default pool for burst |
| `pool_mode` | transaction | Stateless API calls, release after commit |
| `server_idle_timeout` | 300s | Reclaim idle connections |
| `client_idle_timeout` | 0 | No client idle timeout (app manages) |

**Formula:**
`default_pool_size = (peak_concurrent × avg_query_time) / (3600 × target_utilization)`

At 100 concurrent × 200ms avg query × 0.7 utilization ≈ 8 connections minimum.
20 provides headroom.

### 4.4 Vector Index Sizing

| Parameter | Estimate |
| ---------------------- | ---------------------------------------- |
| Vector dimension | 1536 (ada-002) |
| Row size per embedding | ~6.1 KB (1536 × 4 bytes + overhead) |
| HNSW index size | ~1.2× data size (for m=16) |
| 10M embeddings | ~61 GB data + ~73 GB index = **~134 GB** |
| RAM for hot index | ~15 GB (top layers in memory) |

### 4.5 Storage Estimates

| Component | 12-month estimate | Notes |
| ----------------- | ----------------- | ------------------------ |
| PostgreSQL data | ~200 GB | All tables combined |
| HNSW index | ~73 GB | Vector search |
| B-tree indexes | ~20 GB | All B-tree indexes |
| Object storage | ~500 GB | Documents, backups |
| WAL | ~100 GB/day | Streaming replication |
| Backups (30 days) | ~6 TB | pg_dump + object storage |
| **Total** | **~7 TB** | Including backups |

### 4.6 Scaling Triggers

| Metric | Threshold | Action |
| --------------------------- | ---------------------- | ------------------------------------------------ |
| Connection pool utilization | >80% sustained 5min | Increase `default_pool_size` or add read replica |
| Query P99 latency | >200ms sustained 10min | Investigate missing indexes, add EXPLAIN |
| Disk usage | >70% | Archive old events, increase storage |
| Row count on `events` | >50M | Partition by month, archive old partitions |
| Row count on `embeddings` | >5M | Verify HNSW recall, tune `ef_search` |
| CPU utilization | >70% sustained 15min | Scale vertically or add read replicas |
| Memory usage | >80% | Increase shared_buffers, add RAM |

---

## 5. Query Discipline

### 5.1 Workspace Scoping Invariant

**Every query against tenant-scoped tables MUST include `workspace_id` or
`tenant_id` in the WHERE clause.** No exceptions.

```sql
-- CORRECT
SELECT * FROM memories WHERE workspace_id = $1 AND status = 'active';

-- WRONG — returns cross-tenant data
SELECT * FROM memories WHERE status = 'active';
```

This is enforced at the application layer (repository pattern) and verified by
security tests.

### 5.2 EXPLAIN on Hot Paths

At P15, every endpoint in the top-20 by traffic must have:

1. An EXPLAIN ANALYZE output saved
2. Index usage confirmed (no sequential scans on tables >10K rows)
3. Row estimate accuracy within 2× of actual

### 5.3 No N+1 in Workspace Views

Workspace dashboard and list views must use batch loading:

```python
# CORRECT — single query with join
memories = await db.execute(
    select(Memory)
    .where(Memory.workspace_id == workspace_id)
    .options(selectinload(Memory.tags))
)

# WRONG — N+1 problem
memories = await db.execute(
    select(Memory).where(Memory.workspace_id == workspace_id)
)
for memory in memories:
    tags = await db.execute(select(Tag).where(Tag.memory_id == memory.id))  # N+1!
```

### 5.4 Projection Reads Never Write

Event-sourced read models (projections) are read-only after rebuild. Never:

- Update projection state from a read path
- Write to projection tables from API handlers
- Modify projection data outside of event replay

### 5.5 Batch Preload for List Views

List endpoints must preload associated data in a single query:

```python
# List memories with tags and latest record in one query
memories = await db.execute(
    select(Memory)
    .where(Memory.workspace_id == workspace_id)
    .options(
        selectinload(Memory.tags),
        selectinload(Memory.records).with_loader_criteria(
            MemoryRecord.id == latest_record_subquery.c.id
        )
    )
    .order_by(Memory.updated_at.desc())
    .limit(page_size)
)
```

---

## 6. Performance Monitoring

### 6.1 Slow Query Logging

| Setting | Value |
| ------------- | ------------------------------ |
| Threshold | 200ms |
| Log target | OTEL span (structured) |
| Retention | 30 days |
| Alert trigger | >10 slow queries/min sustained |

```python
# In database engine configuration
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)
# Slow query detection via pg_stat_statements or application-level timing
```

### 6.2 Connection Pool Saturation Alerts

| Metric | Warning | Critical |
| ----------------- | ------- | -------- |
| Pool utilization | >60% | >80% |
| Wait queue depth | >5 | >20 |
| Connection errors | >1/min | >5/min |

Monitored via OTEL metrics exported from PgBouncer or application pool.

### 6.3 Index Bloat Detection

Run weekly:

```sql
SELECT
  schemaname, tablename, indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS scans
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND pg_relation_size(indexrelid) > 1024 * 1024  -- >1MB unused
ORDER BY pg_relation_size(indexrelid) DESC;
```

Action: Drop unused indexes >10MB after confirming no active use.

### 6.4 Table Growth Rate Tracking

Track daily row counts for key tables:

| Table | Expected daily growth | Alert threshold |
| --------------- | --------------------- | --------------- |
| `events` | ~140K rows | >500K rows/day |
| `agent_actions` | ~28K rows | >100K rows/day |
| `embeddings` | ~28K rows | >100K rows/day |
| `memories` | ~3K rows | >10K rows/day |

Monitored via `pg_stat_user_tables` (n_tup_ins) delta between snapshots.

### 6.5 OTEL Integration

All performance metrics are exported as OTEL metrics:

- `db.query.duration` — histogram of query execution time
- `db.pool.active_connections` — gauge of active pool connections
- `db.pool.wait_queue` — gauge of waiting requests
- `db.index.size_bytes` — gauge per index
- `db.table.row_count` — gauge per table

---

## Appendix A: Checklist

- [ ] Backup script created and tested
- [ ] Restore-to-scratch CI job configured
- [ ] Missing indexes created (`idx_memories_workspace_type_deleted`,
 `idx_memories_workspace_supersedes`, `idx_approval_request_expires`)
- [ ] HNSW index created (when pgvector ≥0.5.0 confirmed)
- [ ] PgBouncer configured with pool sizing above
- [ ] Slow query logging enabled at 200ms threshold
- [ ] Connection pool saturation alerts configured
- [ ] Index bloat detection query scheduled weekly
- [ ] Table growth tracking dashboards created
- [ ] EXPLAIN ANALYZE captured for all hot-path queries
- [ ] N+1 audit completed for workspace list views
- [ ] Query pattern documentation filled for top-20 endpoints
