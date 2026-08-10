# MVP-P07 — 03. Data Models & Dictionary (DEL-MVP-P07-01)

> Owner: Data Architect · Target = existing 33 tables + migrations 0003..0006
> (designed here, executed P11). Physical details in `04`.

## 1. Logical model — authoritative stores

| Store            | Table(s)                                                                                                                                                                                                                                                                                                                                                                                                                                | Role                           | Authoritative  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------- |
| System of record | Postgres: users, tenants, workspaces, workspace_users, documents, document_versions, memories, memory_records, resumes, applications, schedule_events, connectors, agents, agent_executions, agent_actions, events, event_subscriptions, dead_letter_events, notifications, api_keys, auth_sessions, permissions, usage_records, webhooks, webhook_deliveries, subscriptions, integrations, plugins, plugin_executions, agent_schedules | All persisted truth            | ✅             |
| Object storage   | documents files (MinIO/S3)                                                                                                                                                                                                                                                                                                                                                                                                              | Binary content                 | ✅ (files)     |
| Projections      | embeddings (pgvector), entities/relationships (graph), Meilisearch index                                                                                                                                                                                                                                                                                                                                                                | Derived, rebuildable (ADR-024) | ❌ rebuildable |
| Queue            | Redis (BullMQ-compatible)                                                                                                                                                                                                                                                                                                                                                                                                               | Transient jobs                 | ❌ ephemeral   |

## 2. NEW tables (migrations — ADR-021)

### `approval_request`

| Column          | Type             | Notes                                          |
| --------------- | ---------------- | ---------------------------------------------- |
| id              | UUID PK          |                                                |
| workspace_id    | UUID FK NOT NULL | scope key (composite w/ tenant)                |
| tenant_id       | UUID NOT NULL    |                                                |
| action_type     | VARCHAR(50)      | `gmail_send`, `job_submit`, `reminder_send`, … |
| payload         | JSONB            | intended action (immutable)                    |
| payload_hash    | CHAR(64)         | SHA-256 binding                                |
| scope_claims    | JSONB            | read/write scopes                              |
| ttl_seconds     | INT              | expiry (FR-51)                                 |
| expires_at      | TIMESTAMPTZ      | computed                                       |
| status          | VARCHAR(20)      | pending/approved/rejected/expired/replayed     |
| idempotency_key | VARCHAR(255)     | unique per workspace                           |
| created_at      | TIMESTAMPTZ      |                                                |

### `approval_decision`

| Column              | Type          | Notes                                  |
| ------------------- | ------------- | -------------------------------------- |
| id                  | UUID PK       |                                        |
| approval_request_id | FK            | immutable link                         |
| decision            | VARCHAR(20)   | approved/rejected                      |
| decided_by          | UUID FK users |                                        |
| decided_at          | TIMESTAMPTZ   |                                        |
| client_context      | JSONB         | device/redirect info (privacy-minimal) |

Indexes: `(workspace_id, status, expires_at)`, unique
`(workspace_id, idempotency_key)`.

## 3. Modified tables (migrations)

| Table                         | Change                                                                                                                                              | Purpose                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `applications`                | + `idempotency_key VARCHAR(255) NULL`, partial unique index                                                                                         | replay-safe submissions (FR-50/51)                |
| `agent_actions`               | + `idempotency_key`, + `approval_request_id FK NULL`                                                                                                | auditable consequential actions                   |
| `memories` / `memory_records` | `type` → domain enum + CHECK (profile, document, career, episodic, preference, working); + `supersedes_id FK NULL`, + `deleted_at TIMESTAMPTZ NULL` | 6-memory taxonomy + supersession (FR-68, ADR-022) |
| `embeddings`                  | + `model_version VARCHAR(100)`, + `dimensions INT`, + `source_table`, `source_id`                                                                   | provenance (ADR-024); rebuild                     |
| `documents`                   | + `retention_policy VARCHAR(50) DEFAULT 'user_driven'`, + `deleted_at`                                                                              | lifecycle (BQ-P07-01)                             |
| `users`, `workspaces`         | + `consent_version VARCHAR(20)`, `consent_granted_at`                                                                                               | DPDP notice/consent record (NFR-17)               |
| `connectors`                  | + `oauth_scopes JSONB`, `refresh_token_rotated_at`                                                                                                  | RFC 9700 (P08)                                    |

## 4. Data dictionary (prompt §17) — per dataset

| Dataset                | Owner         | Source            | Purpose/basis             | Classification            | Scope key    | Residency                            | Schema v | Quality                     | Retention                               | Consumers            |
| ---------------------- | ------------- | ----------------- | ------------------------- | ------------------------- | ------------ | ------------------------------------ | -------- | --------------------------- | --------------------------------------- | -------------------- |
| Profile/memories       | user          | resume, entries   | service provision/consent | personal data             | workspace_id | nearest region (BQ-P05-02, flag P13) | v1       | provenance+QA gate          | user-driven (BQ-P07-01)                 | agents, RAG          |
| Documents (resumes)    | user          | upload            | ingest                    | personal data             | workspace_id | same                                 | v1       | parse ≥90% (BQ-P02-03)      | user-driven                             | extraction           |
| Gmail-derived facts    | user          | Gmail (delegated) | deadlines/reminders       | personal data (delegated) | workspace_id | same                                 | v1       | ≥90% extraction (BQ-P02-03) | user-driven; raw body minimized (FR-40) | scheduler, reminders |
| Applications/tracking  | user          | app + connectors  | tracking                  | personal data             | workspace_id | same                                 | v1       | provenance                  | user-driven                             | ATS, UI              |
| Approvals              | user          | app               | consent record            | personal data             | workspace_id | same                                 | v1       | immutable                   | audit retention (DPDP)                  | audit                |
| Audit logs             | user/operator | services          | security/DPDP §8          | operational               | workspace_id | same                                 | v1       | append-only                 | DPDP-aligned retention                  | compliance           |
| Telemetry              | operator      | OTel              | ops                       | internal (no personal)    | none         | same                                 | v1       | —                           | P17 policy                              | dashboards           |
| Embeddings/projections | derived       | memories/docs     | retrieval                 | personal data (derived)   | workspace_id | same                                 | v1       | rebuildable                 | follows source                          | RAG                  |
| Eval datasets          | Vaeloom       | licensed (P02)    | validation                | non-personal synthetic    | none         | same                                 | pinned   | ≥90/≥80 gates               | kept w/ license record                  | evals                |

## 5. Entity relationships (key)

user 1—N workspace (via workspace_users) · workspace 1—N {documents, memories,
applications, schedule_events, connectors, approval_request} · document 1—N
document_version · document 1—N memory_record (source) · memory 1—0..1 memory
(supersedes) · approval_request 1—0..1 approval_decision · agent 1—N
agent_execution 1—N agent_action (0..1 approval_request).
