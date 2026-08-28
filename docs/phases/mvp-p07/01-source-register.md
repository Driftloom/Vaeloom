# MVP-P07 — 01. Source Register

> Prompt §4 + §15. Schema read live 2026-08-07 (`0c4f73a`); corrected 2026-08-15
> post-audit.

## 1. Internal sources

| ID | Source | Use | Status |
| ---------- | ------------------------------------------------------------------ | --------------- | --------- |
| INT-01..10 | gatekeeper, INT-02 (SHA-256 `2FA8966F…69640`), INT-03/05/07/08/09 | as prior phases | Available |
| REPO | `master` @ `0c4f73a`; `apps/api/src/api/models/schema.py` read | Schema truth | Available |

## 2. External standards — verified at phase start

| ID | Standard | Applicability |
| ------------ | ------------------------------ | --------------------------------------------- |
| EXT-06 | RFC 9700 OAuth | P08 (token data) |
| EXT-08 | OpenAPI 3.1 | P08 contracts |
| EXT-11 | NIST SSDF 800-218 | P06 standards; applies to migrations |
| EXT-12 | Gmail API | connector data (polling state) |
| EXT-16 | DPDP Rules 2025 | retention/erasure/consent design (this phase) |
| EXT-14/15/17 | GDPR / EU AI Act / FERPA+COPPA | NOT_APPLICABLE (India; 18+; re-check P13) |

## 3. Schema truth (live read — corrected)

Total: **52 unique tables** (38 ORM-defined + 14 microservice-only via Alembic 0002).

### 3.1 Core tables (38 ORM-defined)

| Table | Existing columns | Gap → this phase |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `users` | id, email, name, password_hash, tenant_id, consent_version, consent_granted_at, timestamps | — |
| `tenants` | id, name, slug, plan, config, timestamps | — |
| `auth_sessions` | id, user_id, token_hash, ip, user_agent, expires_at, timestamps | — |
| `api_keys` | id, tenant_id, name, key_hash, scopes, rate_limit, expires_at, revoked_at, timestamps | — |
| `workspaces` | id, tenant_id, name, slug, consent_version, consent_granted_at, timestamps | — |
| `workspace_users` | workspace_id, user_id, role, timestamps | — |
| `connectors` | id, tenant_id, workspace_id, type, name, config, oauth_*, status, timestamps | — |
| `documents` | id, tenant_id, workspace_id, source_connector_id, title, filename, mime_type, size, metadata, tags, retention_policy, deleted_at, timestamps | — |
| `document_versions` | id, document_id, version, content, content_hash, timestamps | — |
| `memories` | id, tenant_id, workspace_id, user_id, type, status, title, summary, content, content_hash, size, embedding, metadata, tags, source_type/uri/label, connector_id, vector_id, graph_node_id, domain, supersedes_id, deleted_at, timestamps | CHECK constraint missing on domain |
| `memory_records` | id, workspace_id, memory_id, type, content, confidence, importance, freshness_at, source_document_id, supersedes_id, deleted_at, timestamps | — |
| `entities` | id, tenant_id, workspace_id, name, type, metadata, timestamps | — |
| `relationships` | id, tenant_id, workspace_id, from_entity_id, to_entity_id, type, weight, metadata, timestamps | — |
| `embeddings` | id, tenant_id, workspace_id, content, embedding, model_name, model_version, dimensions, source_table, source_id, metadata, timestamps | HNSW index missing |
| `resumes` | id, tenant_id, workspace_id, user_id, raw_text, sections, timestamps | — |
| `applications` | id, tenant_id, workspace_id, user_id, job_title, company, status, idempotency_key, resume_id, timestamps | idempotency_key no migration |
| `schedule_events` | id, tenant_id, workspace_id, user_id, title, description, start_time, end_time, all_day, recurrence, location, attendees, metadata, timestamps | — |
| `agents` | id, tenant_id, workspace_id, user_id, name, type, description, config, status, timestamps | — |
| `agent_executions` | id, tenant_id, agent_id, input, output, status, duration_ms, timestamps | — |
| `agent_actions` | id, tenant_id, workspace_id, agent_id, action_type, input, output, status, idempotency_key, approval_request_id, timestamps | idempotency_key + approval_request_id no migration |
| `idempotency_records` | id, idempotency_key, response, expires_at, timestamps | Created by custom runner 0006 |
| `agent_approvals` | id, tenant_id, workspace_id, agent_id, action_type, input, status, reviewed_by, reviewed_at, timestamps | Created by custom runner 0003 |
| `approval_request` | ORM exists (schema.py:530), NO migration | Needs migration |
| `approval_decision` | ORM exists (schema.py:555), NO migration | Needs migration |
| `permissions` | id, tenant_id, workspace_id, agent_id, resource, action, conditions, timestamps | — |
| `events` | id, tenant_id, workspace_id, type, status, payload, metadata, timestamps | — |
| `event_subscriptions` | id, workspace_id, event_type, target_url, headers, active, timestamps | — |
| `dead_letter_events` | id, workspace_id, event_id, error, retry_count, timestamps | — |
| `subscriptions` | id, tenant_id, workspace_id, name, type, config, active, timestamps | — |
| `webhooks` | id, workspace_id, name, url, secret, events, active, timestamps | — |
| `webhook_deliveries` | id, webhook_id, event_type, payload, status, response, timestamps | — |
| `usage_records` | id, tenant_id, workspace_id, user_id, metric, quantity, unit_price, metadata, timestamps | — |
| `notifications` | id, tenant_id, workspace_id, user_id, title, body, type, read, metadata, timestamps | — |
| `integrations` | id, workspace_id, name, type, config, status, timestamps | — |
| `plugins` | id, tenant_id, workspace_id, name, type, config, enabled, timestamps | Alembic 0002 (also has ORM) |
| `plugin_executions` | id, plugin_id, input, output, status, duration_ms, timestamps | Alembic 0002 (also has ORM) |
| `agent_schedules` | id, agent_id, cron, config, enabled, timestamps | Alembic 0002 (also has ORM) |
| `gmail_watches` | id, workspace_id, user_id, gmail_address, watch_channel_id, watch_expiration, status, timestamps | Custom runner 0007 |

### 3.2 Microservice tables (14 — from Alembic 0002, NO ORM models)

| Table | Source |
| ---------------------------- | ----------- |
| `analytics_events` | Alembic 0002 |
| `audit_events` | Alembic 0002 |
| `iam_users` | Alembic 0002 |
| `iam_user_roles` | Alembic 0002 |
| `knowledge_nodes` | Alembic 0002 |
| `knowledge_edges` | Alembic 0002 |
| `notification_templates` | Alembic 0002 |
| `notification_subscribers` | Alembic 0002 |
| `notification_device_tokens` | Alembic 0002 |
| `recommendations` | Alembic 0002 |
| `recommendation_feedback` | Alembic 0002 |
| `user_preference_vectors` | Alembic 0002 |
| `scheduled_jobs` | Alembic 0002 |
| `job_executions` | Alembic 0002 |

## 4. Migration inventory (corrected)

| System | Migration | Creates | Status |
| ------- | -------------------------- | --------------------------------------------------------------------------- | ------- |
| Alembic | `0001_initial_schema` | 25 core tables | Applied |
| Alembic | `0002_microservice_tables` | 17 microservice tables | Applied |
| Custom | `0002_microservice_tables` | 2 microservice tables (`knowledge_nodes`, `knowledge_edges`) | Applied |
| Custom | `0003_approvals` | `agent_approvals` table | Applied |
| Custom | `0004_memory_taxonomy` | `domain`/`supersedes_id`/`deleted_at` on `memories` | Applied |
| Custom | `0005_rls` | RLS on 4 tables (`memories`, `documents`, `agent_actions`, `usage_records`) | Applied |
| Custom | `0006_idempotency` | `idempotency_records` table | Applied |
| Custom | `0007_gmail_watch` | `gmail_watches` table | Applied |

**Total: 2 Alembic + 7 custom runner = 9 migrations applied.**

## 5. Missing migrations (needs this phase)

| What | ORM definition | Migration | Notes |
| ------------------------------------ | ------------------------ | ---------- | -------------------------------------------------------------- |
| `approval_request` table | schema.py:530 | ✅ Alembic 0003 | Already exists in Alembic chain |
| `approval_decision` table | schema.py:555 | ✅ Alembic 0003 | Already exists in Alembic chain |
| `idempotency_key` on `applications` | ORM field | ✅ Alembic 0003 | Already exists in Alembic chain |
| `idempotency_key` on `agent_actions` | ORM field | ✅ Alembic 0003 | Already exists in Alembic chain |
| CHECK constraint on `Memory.domain` | Not enforced | ❌ None | Domain column free-form, no validation |
| RLS expansion | 4 of ~30 eligible tables | ❌ Partial | Only `memories`, `documents`, `agent_actions`, `usage_records` |

## 6. RLS policy status

**Custom runner** (fallback path when Alembic fails):

| Table | RLS | Policy |
| ------------------------------------ | --- | ------------------------------------------------------- |
| `memories` | ✅ | tenant isolation via `current_setting('app.tenant_id')` |
| `events` | ✅ | tenant isolation |
| `usage_records` | ✅ | tenant isolation |
| `api_keys` | ✅ | tenant isolation |
| All other tenant-scoped tables (~30) | ❌ | No RLS — relies on application-layer filtering only |

**Alembic** (primary path — `main.py:80-91`):

| Table | RLS | Policy |
| ------------------------------------ | --- | ------------------------------------------------------- |
| 31 tables (workspaces→relationships) | ✅ | composite workspace_id + tenant_id via `app.*` GUCs |
| 3 additional tables (from 0007/0010) | ✅ | agent_approvals, idempotency_records, gmail_watches |
| All other tables | ❌ | No RLS |

**Note:** `main.py:80-99` tries Alembic first, falls back to custom runner.
Alembic provides stronger coverage (34 tables vs 4). Custom runner is dev-only.

## 7. Conflict log

| ID | Conflict | Resolution | Authority | Date |
| --------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------- | ---------- |
| CF-P07-01 | INT-09 memory intent (6 stores as separate stores) vs single `memories` table with free-form type | ADR-022 (P05): domain-typed rows + supersession; no table split; migrations only | INT-02 §4 + REPO | 2026-08-07 |
| CF-P07-02 | Embedding Vector(1536) (OpenAI) vs BQ-P06-02 local/free embeddings | Dimension made configurable; migration 0007 guarded re-embed (ADR-024); final provider pinned P12 | User BQ-P06-02 | 2026-08-07 |
| CF-P07-03 | Original register claimed 33 tables; actual count is 52 (38 ORM + 14 microservice-only) | Corrected via deep audit of schema.py + all migration files | Deep audit | 2026-08-15 |
| CF-P07-04 | Original register claimed no approval tables; `agent_approvals` exists (custom 0003), plus 2 ORM-only | `agent_approvals` is applied; `approval_request`/`approval_decision` need migrations | Deep audit | 2026-08-15 |
| CF-P07-05 | Original register claimed 2 alembic migrations; actual: 2 Alembic + 7 custom runner = 9 total | Custom runner migrations are a separate system, not Alembic | Deep audit | 2026-08-15 |

Evidence: `EVD-MVP-P07-001` (schema read, this register).
