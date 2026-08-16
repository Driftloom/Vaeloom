# MVP-P07 — 06. Provenance / Lifecycle / Deletion (DEL-MVP-P07-04)

> Owner: Privacy Engineer · DPDP Rules 2025 (§5 notice, §6 consent, rights);
> BQ-P07-01 retention; FR-60/61/62, NFR-20, NFR-23.

## 1. Provenance Model (INT-02 §5)

Every artifact in the system carries lineage metadata enabling audit,
correction, and erasure. Provenance is **never mutated in-place**; corrections
create new rows with `supersedes_id` pointing to the original.

### 1.1 Source Provenance

Tracks where data originated. Fields exist on `Memory`:

| Field          | Type | Description                                       |
| -------------- | ---- | ------------------------------------------------- |
| `source_type`  | enum | `upload`, `connector`, `api`, `agent`, `manual`   |
| `source_uri`   | text | Original location (URL, file path, connector ID)  |
| `source_label` | text | Human-readable label ("Gmail inbox", "notion/db") |
| `connector_id` | FK   | Links to connector record if sourced externally   |

### 1.2 Version Provenance

Tracks content and model versions for reproducibility:

| Artifact     | Fields                                                   | Notes                             |
| ------------ | -------------------------------------------------------- | --------------------------------- |
| Memory       | `content_hash` (SHA-256), `updated_at`                   | Detects content drift             |
| Embedding    | `model_version`, `source_table`, `source_id`, dimensions | Links embedding to source row     |
| Search index | `schema_version`                                         | Tracks index schema evolution     |
| LLM calls    | `model_version`, `prompt_hash`, `tool_version`           | Stored in `agent_executions`      |
| Chunking     | `chunking_strategy`, `chunk_size`                        | On `memory_records` if applicable |

Model/prompt/tool/retrieval/chunking/embedding/policy versions consolidated in a
version registry at P12.

### 1.3 Correction / Supersession (FR-68)

Corrections create a **new active row**; the old row transitions to
`SUPERSEDED`. Neither the old row nor its embeddings are silently overwritten.

```
Memory
  id              UUID PK
  supersedes_id   UUID FK(self)  — NULL for originals
  status          enum: ACTIVE | SUPERSEDED | PENDING_DELETION | DELETED

MemoryRecord
  id              UUID PK
  supersedes_id   UUID FK(self)  — NULL for originals
  deleted_at      timestamptz    — soft delete marker
```

**Transition rule**: A row with `supersedes_id IS NOT NULL` is always `ACTIVE`.
The referenced original is always `SUPERSEDED`. Erasure follows the supersession
chain to the root for completeness.

### 1.4 Projection Lineage

Derived data must be traceable back to its authoritative source:

| Projection          | Linkage                      | Rebuild strategy                |
| ------------------- | ---------------------------- | ------------------------------- |
| pgvector embeddings | `source_table` + `source_id` | Rebuild from Memory after erase |
| Graph nodes/edges   | `knowledge_nodes.source_id`  | Rebuild from Memory after erase |
| Search index        | document ID reference        | Rebuild from Memory after erase |

**No projection is authoritative.** All projections can be fully reconstructed
from the relational truth (ADR-024).

### 1.5 AI Output Provenance

| Artifact              | Provenance fields                                                          |
| --------------------- | -------------------------------------------------------------------------- |
| Agent execution       | `agent_executions`: model, prompt_hash, tool_version, latency, token_count |
| Extraction confidence | `memory_records.confidence` (0.0–1.0)                                      |
| QA gate               | Linked to `agent_executions.id`                                            |

### 1.6 Action Provenance

| Artifact       | Provenance                                                       |
| -------------- | ---------------------------------------------------------------- |
| Agent actions  | `agent_actions`: immutable, timestamped, linked to execution     |
| Approval chain | `approval_request` → `approval_decision`: append-only, immutable |

## 2. Lifecycle State Machine

Each artifact type has a defined set of valid states and transitions. Invalid
transitions are rejected at the application layer.

### 2.1 Memory

```
                    ┌──────────────┐
                    │  PROCESSING  │
                    └──────┬───────┘
                           │ content stored
                           ▼
                    ┌──────────────┐
            ┌──────│    ACTIVE    │──────┐
            │      └──────┬───────┘      │
            │             │              │
     correction      user deletes    supersedes
            │             │          new memory
            ▼             ▼              │
   ┌────────────┐  ┌──────────────┐     │
   │  SUPERSEDED│  │PENDING_DELETION│◄───┘
   └────────────┘  └──────┬───────┘
                          │ grace period expires
                          ▼
                   ┌──────────────┐
                   │    DELETED   │
                   └──────────────┘

Legal hold override:
  HOLDLOCK set on any row → deletion blocked until released
  Released → returns to previous state (PENDING_DELETION or ACTIVE)
```

**State semantics**:

| State              | Meaning                                                           |
| ------------------ | ----------------------------------------------------------------- |
| `PROCESSING`       | Ingested but not yet embedded/indexed                             |
| `ACTIVE`           | Fully indexed, queryable, contributes to search                   |
| `SUPERSEDED`       | Replaced by a newer row via `supersedes_id`; retained for lineage |
| `PENDING_DELETION` | User requested deletion; grace period active                      |
| `DELETED`          | Hard-deleted from primary store; erased from projections          |
| `HOLDLOCK`         | Legal hold — blocks transition to DELETED                         |

### 2.2 Document

```
  ACTIVE → PENDING_DELETION → DELETED
  (Legal hold blocks at any point)
```

Documents carry `deleted_at` as soft-delete marker. Hard delete follows the same
erasure path as Memory.

### 2.3 Application

```
  DRAFT → SUBMITTED → OUTCOME (approved / rejected / withdrawn)
```

Applications are immutable once submitted. Withdrawal transitions to a terminal
state; no erasure of the submission record (retained for audit per DPDP §8).

### 2.4 Legal Hold (HOLDLOCK)

A `legal_hold` table records which artifacts are under hold:

```sql
CREATE TABLE legal_holds (
    id            UUID PRIMARY KEY,
    artifact_type TEXT NOT NULL,       -- 'memory', 'document', 'application'
    artifact_id   UUID NOT NULL,
    reason        TEXT NOT NULL,       -- regulatory, litigation, investigation
    imposed_at    timestamptz NOT NULL,
    released_at   timestamptz,        -- NULL = still held
    imposed_by    UUID REFERENCES users(id)
);
```

**Hold enforcement**: The erasure job queries `legal_holds` before deleting any
row. If an active hold exists (`released_at IS NULL`), deletion is blocked and
the erasure receipt records the hold.

## 3. Erasure Matrix

Per BQ-P02-03: 100% deletion across all stores. Each row specifies the strategy,
current implementation status, and known gap.

### 3.1 Authoritative Stores (Postgres)

| Table                 | Strategy          | Status     | Gap                                   |
| --------------------- | ----------------- | ---------- | ------------------------------------- |
| `users`               | anonymize         | ✅ done    | —                                     |
| `memories`            | hard delete       | ⚠️ partial | `deleted_at` set but not hard-deleted |
| `memory_records`      | hard delete       | ⚠️ partial | Soft delete only; not erased          |
| `embeddings`          | hard delete       | ⚠️ partial | Not included in gdpr.py erasure       |
| `documents`           | hard delete       | ✅ done    | —                                     |
| `applications`        | hard delete       | ✅ done    | —                                     |
| `workspaces`          | cascade anonymize | ✅ done    | —                                     |
| `agent_executions`    | hard delete       | ⚠️ partial | Not included in gdpr.py erasure       |
| `agent_actions`       | hard delete       | ⚠️ partial | Not included in gdpr.py erasure       |
| `approval_request`    | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `approval_decision`   | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `agent_approvals`     | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `idempotency_records` | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `resumes`             | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `webhooks`            | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `webhook_deliveries`  | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `gmail_watches`       | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `plugins`             | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `plugin_executions`   | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `agent_schedules`     | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `knowledge_nodes`     | hard delete       | ❌ missing | Not included in gdpr.py erasure       |
| `knowledge_edges`     | hard delete       | ❌ missing | Not included in gdpr.py erasure       |

**gdpr.py currently covers**: users, memories, documents, applications,
workspaces, memory_records (soft only). **15+ tables are missed.**

### 3.2 Object Storage

| Store               | Strategy                         | Status     | Gap                        |
| ------------------- | -------------------------------- | ---------- | -------------------------- |
| Document files (S3) | Delete all versions of object    | ✅ done    | —                          |
| S3 version history  | Purge versions after 30-day hold | ⚠️ partial | No automated version purge |

### 3.3 Projections (Derived Data)

| Projection          | Strategy                        | Status     | Gap                  |
| ------------------- | ------------------------------- | ---------- | -------------------- |
| pgvector embeddings | Rebuild from Memory after erase | ❌ missing | No rebuild triggered |
| Graph nodes/edges   | Rebuild from Memory after erase | ❌ missing | No rebuild triggered |
| Search index        | Rebuild from Memory after erase | ❌ missing | No rebuild triggered |

**ADR-024 mandates**: Projections are rebuilt from relational truth after any
erasure. This is not implemented. Current gdpr.py only deletes from Postgres;
projections retain orphaned data indefinitely.

### 3.4 Redis / Queue

| Store               | Strategy                     | Status     | Gap                         |
| ------------------- | ---------------------------- | ---------- | --------------------------- |
| Session cache       | Delete session keys for user | ❌ missing | No Redis purge in erasure   |
| Job queues          | Purge pending jobs for user  | ❌ missing | No queue purge in erasure   |
| Dead-letter queue   | Purge DLQ entries for user   | ❌ missing | No DLQ cleanup              |
| Rate limit counters | Allow expiry (ephemeral)     | ✅ done    | TTL-based, no action needed |

### 3.5 Telemetry / Audit

| Store                | Strategy                                     | Status     | Gap                       |
| -------------------- | -------------------------------------------- | ---------- | ------------------------- |
| Audit logs           | Retain per DPDP §8; anonymize where possible | ✅ done    | —                         |
| Telemetry (OTLP)     | No personal data; retain indefinitely        | ✅ done    | —                         |
| Agent executions log | Anonymize user references                    | ⚠️ partial | Not anonymized on erasure |

### 3.6 External Providers

| Provider     | Strategy                                | Status  | Gap               |
| ------------ | --------------------------------------- | ------- | ----------------- |
| LLM provider | No raw personal data retained by policy | ✅ done | DPA review at P13 |
| Google OAuth | Revoke tokens; no local PII retained    | ✅ done | —                 |

## 4. Export Design (NFR-23)

### 4.1 Scope

User-triggered export includes all personal data:

| Data type       | Contents                                              |
| --------------- | ----------------------------------------------------- |
| Profile         | User metadata, preferences, notification settings     |
| Memories        | All memories with full provenance (source, version)   |
| Documents       | Document metadata + file content (base64 or download) |
| Applications    | Submission history + outcomes                         |
| Approvals       | Approval requests and decisions                       |
| Embeddings      | Metadata only (vectors are not user-exportable)       |
| Consent history | Consent grants and revocations                        |
| Audit trail     | User's action history (redacted for others' privacy)  |

### 4.2 Format

JSON archive (`user-export-{user_id}-{timestamp}.zip`):

```
user-export-{user_id}-{timestamp}/
├── profile.json
├── memories/
│   ├── index.json          # metadata + provenance for all memories
│   └── attachments/        # source documents if applicable
├── documents/
│   ├── index.json
│   └── files/              # document content
├── applications.json
├── approvals.json
├── consent-history.json
├── audit-trail.json
└── manifest.json           # checksums, export timestamp, schema version
```

### 4.3 Delivery

**Current (implemented)**: Inline JSON response from `/api/v1/gdpr/export`. No
archive, no signed URL, no object storage.

**Target (not implemented)**:

1. Export job enqueued → background worker generates ZIP
2. ZIP uploaded to object storage with 7-day signed URL
3. User notified via email with download link
4. Audit entry records export generation and download

### 4.4 Audit

Every export triggers an audit entry:

```json
{
  "action": "data_export",
  "user_id": "...",
  "exported_at": "...",
  "record_count": { "memories": 42, "documents": 7 },
  "delivery_method": "signed_url",
  "url_expires_at": "..."
}
```

## 5. Retention Decisions (BQ-P07-01)

### 5.1 Design Decisions

| Decision                                                         | Rationale                                           |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| Data kept until user deletes account                             | User control; no premature data loss                |
| **Indefinite grace** — no auto-purge                             | User may need time to review before final erasure   |
| Backups expire after 30 days                                     | RPO 24h; backup restore is read-only                |
| Erasure receipt distinguishes primary vs backup deletion         | FR-62; user knows when erasure is complete          |
| Legal hold blocks deletion                                       | Regulatory compliance; no data destroyed under hold |
| Audit logs retained per DPDP §8                                  | Breach/safety duties; retention aligned at P13      |
| Consent records kept for account life + DPDP period post-closure | Legal obligation                                    |

### 5.2 CONFLICT: retention.py Auto-Deletion

**The current `retention.py` service auto-deletes data, contradicting the
"indefinite grace" decision:**

| Table              | retention.py behavior     | Conflict                               |
| ------------------ | ------------------------- | -------------------------------------- |
| `events`           | Auto-deleted after N days | BQ-P07-01 says user-driven, indefinite |
| `audit_events`     | Auto-deleted after N days | DPDP §8 requires retention             |
| `usage_records`    | Auto-deleted after N days | May be needed for user export          |
| `agent_executions` | Auto-deleted after N days | Provenance data; should not auto-purge |
| `auth_sessions`    | Auto-deleted after N days | Acceptable for security                |

**Reconciliation required**:

1. `events` and `audit_events` auto-deletion must be removed or gated behind a
   config flag that defaults to OFF in production
2. `agent_executions` auto-deletion must be removed — these carry provenance
3. `usage_records` auto-deletion must be removed — needed for user export
4. `auth_sessions` auto-deletion is acceptable (security hygiene)
5. All retention policies must be reconciled with BQ-P07-01 before production
   deployment

## 6. Consent Management (DPDP §5 / §6)

### 6.1 Consent Version Tracking

The `users` and `workspaces` tables carry consent metadata:

```sql
-- On users table
consent_version    TEXT        -- version identifier of consent text
consent_granted_at timestamptz -- when current consent was granted
consent_ip         INET        -- IP at time of consent (DPDP §5(2))

-- On workspaces table
consent_version    TEXT
consent_granted_at timestamptz
```

### 6.2 Consent Events (Append-Only Log)

A `consent_events` table provides an immutable audit trail:

```sql
CREATE TABLE consent_events (
    id              UUID PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    workspace_id    UUID REFERENCES workspaces(id),
    event_type      TEXT NOT NULL,       -- 'granted', 'revoked', 'updated'
    consent_version TEXT NOT NULL,
    consent_text    TEXT,                -- snapshot of consent text at grant time
    granted_at      timestamptz NOT NULL,
    revoked_at      timestamptz,
    ip_address      INET,
    user_agent      TEXT
);
```

**Immutability**: `consent_events` rows are never updated or deleted. They form
the authoritative consent history for DPDP compliance.

### 6.3 Current State View

The current consent state is derived from:

```sql
SELECT user_id, consent_version, consent_granted_at, consent_ip
FROM users
WHERE id = :user_id;
```

Revocation triggers `event_type = 'revoked'` in `consent_events` and sets
`consent_granted_at = NULL` on the user. Data processing ceases immediately;
erasure follows per Section 3.

## 7. Gaps and Risks

### 7.1 Critical Gaps (Must Fix Before Production)

| Gap                                            | Impact                                  | Effort |
| ---------------------------------------------- | --------------------------------------- | ------ |
| gdpr.py misses 15+ tables                      | Incomplete erasure; DPDP violation      | Medium |
| No projection rebuild after erasure            | Orphaned embeddings/graph data          | High   |
| No erasure receipt (FR-62)                     | User cannot verify erasure completeness | Medium |
| retention.py auto-deletes contradict BQ-P07-01 | Data loss; policy violation             | Low    |
| No HOLDLOCK concept                            | Legal holds cannot be enforced          | Medium |

### 7.2 Implementation Gaps

| Gap                                        | Impact                                | Effort |
| ------------------------------------------ | ------------------------------------- | ------ |
| Export is inline JSON, not signed URL      | Large exports fail; no async delivery | Medium |
| No Redis/queue purge on erasure            | Cached PII persists                   | Low    |
| No consent event table                     | No audit trail for consent changes    | Low    |
| No lifecycle state machine enforcement     | Invalid state transitions possible    | Medium |
| Agent executions not anonymized on erasure | PII in execution logs                 | Low    |

### 7.3 Risks

| Risk                                       | Likelihood | Impact   | Mitigation                      |
| ------------------------------------------ | ---------- | -------- | ------------------------------- |
| Orphaned projection data after erasure     | High       | High     | Implement rebuild job (ADR-024) |
| Auto-deleted audit logs before DPDP review | Medium     | High     | Disable retention.py for audit  |
| Legal hold bypass via direct DB access     | Low        | Critical | Hold check in erasure job       |
| Export timeout on large datasets           | Medium     | Medium   | Async export with signed URL    |
| Consent version mismatch across workspaces | Low        | Medium   | Validate on workspace join      |

## 8. Implementation Roadmap

### Phase 1: Erasure Completeness (P07 deliverable)

1. Extend gdpr.py to cover all 15+ missed tables
2. Add projection rebuild trigger after erasure
3. Implement HOLDLOCK check in erasure job
4. Generate erasure receipt with primary + backup expiry dates
5. Disable retention.py auto-deletion for events/audit_events/usage_records

### Phase 2: Export & Consent (P07 deliverable)

1. Async export job with object storage + signed URL
2. Create `consent_events` table
3. Wire consent revocation to data processing pipeline

### Phase 3: State Machine (P12)

1. Enforce lifecycle transitions at application layer
2. Add state validation middleware
3. Monitor invalid transition attempts

## 9. References

- FR-60: Data minimization
- FR-61: Purpose limitation
- FR-62: Erasure receipt
- FR-68: Correction via supersession
- NFR-20: Audit trail
- NFR-23: User data export
- BQ-P07-01: Retention decisions (user, 2026-08-07)
- BQ-P02-03: 100% deletion requirement
- ADR-024: Projection rebuild from relational truth
- DPDP §5: Notice and consent
- DPDP §6: Consent requirements
- DPDP §8: Retention obligations
