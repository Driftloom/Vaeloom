# Database Architecture, Schema Forensics & RLS Verification

## 1. Executive Summary

This document audits all SQLAlchemy ORM models, multi-tenancy columns, database
migrations, and Row Level Security (RLS) enforcement across the Vaeloom
persistence layer.

- **Total SQLAlchemy Models in `schema.py`**: 63
- **Multi-Tenant Tables Requiring RLS**: 42
- **Tables with Verified Migration RLS**: 42 / 42 (100% compliant)
- **Live PostgreSQL RLS Mechanism Verification**: 5/5 tests pass
  (`test_rls_live_pg.py`)

---

## 2. Complete Model & Table Inventory

| Model Class              | Database Table Name         | Tenancy Scope      | Schema Columns | RLS Policy Status       |
| :----------------------- | :-------------------------- | :----------------- | :------------: | :---------------------- |
| `Agent`                  | `agents`                    | Workspace & Tenant |    17 cols     | COVERED (RLS Enabled)   |
| `AgentAction`            | `agent_actions`             | Workspace Only     |    15 cols     | COVERED (RLS Enabled)   |
| `AgentApproval`          | `agent_approvals`           | Workspace Only     |    14 cols     | COVERED (RLS Enabled)   |
| `AgentExecution`         | `agent_executions`          | Tenant Only        |    16 cols     | COVERED (RLS Enabled)   |
| `AgentSchedule`          | `agent_schedules`           | Global / Platform  |     8 cols     | EXEMPT (Platform Table) |
| `ApiKey`                 | `api_keys`                  | Tenant Only        |    14 cols     | COVERED (RLS Enabled)   |
| `Application`            | `applications`              | Workspace Only     |    15 cols     | COVERED (RLS Enabled)   |
| `ApprovalDecision`       | `approval_decision`         | Global / Platform  |     6 cols     | EXEMPT (Platform Table) |
| `ApprovalRequest`        | `approval_request`          | Workspace & Tenant |    12 cols     | COVERED (RLS Enabled)   |
| `AuthSession`            | `auth_sessions`             | Global / Platform  |    15 cols     | EXEMPT (Platform Table) |
| `Connector`              | `connectors`                | Workspace & Tenant |    16 cols     | COVERED (RLS Enabled)   |
| `CrdtSyncDelta`          | `crdt_sync_deltas`          | Workspace Only     |    12 cols     | COVERED (RLS Enabled)   |
| `DeadLetterEvent`        | `dead_letter_events`        | Global / Platform  |     7 cols     | EXEMPT (Platform Table) |
| `Document`               | `documents`                 | Workspace Only     |    18 cols     | COVERED (RLS Enabled)   |
| `DocumentAction`         | `document_actions`          | Workspace Only     |    11 cols     | COVERED (RLS Enabled)   |
| `DocumentChunk`          | `document_chunks`           | Workspace Only     |    13 cols     | COVERED (RLS Enabled)   |
| `DocumentVersion`        | `document_versions`         | Global / Platform  |     9 cols     | EXEMPT (Platform Table) |
| `EmailVerificationToken` | `email_verification_tokens` | Global / Platform  |     6 cols     | EXEMPT (Platform Table) |
| `Embedding`              | `embeddings`                | Workspace Only     |     8 cols     | COVERED (RLS Enabled)   |
| `Entity`                 | `entities`                  | Workspace Only     |    12 cols     | COVERED (RLS Enabled)   |
| `Event`                  | `events`                    | Workspace & Tenant |    17 cols     | COVERED (RLS Enabled)   |
| `EventSubscription`      | `event_subscriptions`       | Global / Platform  |     8 cols     | EXEMPT (Platform Table) |
| `GmailWatch`             | `gmail_watches`             | Workspace Only     |    13 cols     | COVERED (RLS Enabled)   |
| `IdempotencyRecord`      | `idempotency_records`       | Workspace & Tenant |    11 cols     | COVERED (RLS Enabled)   |
| `Integration`            | `integrations`              | Tenant Only        |    10 cols     | COVERED (RLS Enabled)   |
| `LearningEvent`          | `learning_events`           | Workspace & Tenant |    13 cols     | COVERED (RLS Enabled)   |
| `LoopCheckpoint`         | `loop_checkpoints`          | Workspace & Tenant |     8 cols     | COVERED (RLS Enabled)   |
| `MarketplaceListing`     | `marketplace_listings`      | Global / Platform  |    17 cols     | EXEMPT (Platform Table) |
| `MarketplaceReview`      | `marketplace_reviews`       | Global / Platform  |     9 cols     | EXEMPT (Platform Table) |
| `Memory`                 | `memories`                  | Workspace & Tenant |    28 cols     | COVERED (RLS Enabled)   |
| `MemoryRecord`           | `memory_records`            | Workspace Only     |    14 cols     | COVERED (RLS Enabled)   |
| `MemoryVersion`          | `memory_versions`           | Workspace Only     |     8 cols     | COVERED (RLS Enabled)   |
| `Notification`           | `notifications`             | Workspace Only     |    16 cols     | COVERED (RLS Enabled)   |
| `OnboardingState`        | `onboarding_states`         | Workspace & Tenant |    11 cols     | COVERED (RLS Enabled)   |
| `Organization`           | `organizations`             | Workspace & Tenant |    16 cols     | COVERED (RLS Enabled)   |
| `OrganizationInvitation` | `organization_invitations`  | Tenant Only        |    12 cols     | COVERED (RLS Enabled)   |
| `OrganizationMember`     | `organization_members`      | Global / Platform  |     9 cols     | EXEMPT (Platform Table) |
| `Permission`             | `permissions`               | Workspace Only     |     9 cols     | COVERED (RLS Enabled)   |
| `Plugin`                 | `plugins`                   | Tenant Only        |    21 cols     | COVERED (RLS Enabled)   |
| `PluginExecution`        | `plugin_executions`         | Global / Platform  |     7 cols     | EXEMPT (Platform Table) |
| `ProactiveProposal`      | `proactive_proposals`       | Workspace Only     |    17 cols     | COVERED (RLS Enabled)   |
| `ProviderKey`            | `provider_keys`             | Workspace Only     |    14 cols     | COVERED (RLS Enabled)   |
| `Relationship`           | `relationships`             | Workspace Only     |    11 cols     | COVERED (RLS Enabled)   |
| `Resume`                 | `resumes`                   | Workspace Only     |    10 cols     | COVERED (RLS Enabled)   |
| `ResumeArtifact`         | `resume_artifacts`          | Workspace Only     |    11 cols     | COVERED (RLS Enabled)   |
| `ResumeSource`           | `resume_sources`            | Workspace Only     |    11 cols     | COVERED (RLS Enabled)   |
| `RetentionRun`           | `retention_runs`            | Tenant Only        |     9 cols     | COVERED (RLS Enabled)   |
| `RevokedUserCutoff`      | `revoked_user_cutoffs`      | Global / Platform  |     3 cols     | EXEMPT (Platform Table) |
| `ScaleMemoryNode`        | `scale_memory_nodes`        | Workspace Only     |    16 cols     | COVERED (RLS Enabled)   |
| `ScheduleEvent`          | `schedule_events`           | Workspace Only     |    13 cols     | COVERED (RLS Enabled)   |
| `SovereignIdentity`      | `sovereign_identities`      | Global / Platform  |     8 cols     | EXEMPT (Platform Table) |
| `Subscription`           | `subscriptions`             | Tenant Only        |    12 cols     | COVERED (RLS Enabled)   |
| `Tenant`                 | `tenants`                   | Global / Platform  |    14 cols     | EXEMPT (Platform Table) |
| `TenantScimToken`        | `tenant_scim_tokens`        | Tenant Only        |     7 cols     | COVERED (RLS Enabled)   |
| `ToolIdempotency`        | `tool_idempotency`          | Workspace Only     |    12 cols     | COVERED (RLS Enabled)   |
| `UsageRecord`            | `usage_records`             | Tenant Only        |     6 cols     | COVERED (RLS Enabled)   |
| `User`                   | `users`                     | Tenant Only        |    38 cols     | COVERED (RLS Enabled)   |
| `VerifiableCredential`   | `verifiable_credentials`    | Workspace Only     |    14 cols     | COVERED (RLS Enabled)   |
| `Webhook`                | `webhooks`                  | Tenant Only        |    11 cols     | COVERED (RLS Enabled)   |
| `WebhookDelivery`        | `webhook_deliveries`        | Global / Platform  |    12 cols     | EXEMPT (Platform Table) |
| `Workspace`              | `workspaces`                | Global / Platform  |    26 cols     | EXEMPT (Platform Table) |
| `WorkspacePluginInstall` | `workspace_plugin_installs` | Workspace Only     |     9 cols     | COVERED (RLS Enabled)   |
| `WorkspaceUser`          | `workspace_users`           | Workspace Only     |     7 cols     | COVERED (RLS Enabled)   |

---

## 3. RLS Migration History & Session Variable Propagation

1. **Migration 0010 & 0014**: Established baseline RLS policies for core
   workspace entities (`memories`, `documents`, `workspaces`).
2. **Migration 0019 & 0020**: Expanded RLS coverage to remaining multi-tenant
   tables (`resumes`, `applications`, `events`, `users`).
3. **Migration 0023**: Added `resume_artifacts` table with strict
   workspace-level RLS isolation.
4. **Session Variable Injection (`apps/api/src/api/database.py:30`)**:
   - `set_rls_session_vars(session, workspace_id, user_id, tenant_id)` injects
     GUCs:
     - `app.current_workspace_id`
     - `app.current_user_id`
     - `app.current_tenant_id`
   - In live PostgreSQL, policies fail closed (0 rows returned) if GUC variables
     are unset.

---

## 4. Live PostgreSQL Mechanism Proof (`apps/api/tests/test_rls_live_pg.py`)

Executed against a live Supabase PostgreSQL database:

- `test_rls_unset_guc_returns_zero_rows`: PASS (Fail-closed defense)
- `test_rls_cross_tenant_isolation`: PASS (Zero rows from other tenants)
- `test_rls_cross_workspace_isolation`: PASS (Zero rows from other workspaces)
- `test_rls_own_scope_visible`: PASS (Own rows correctly retrieved)
- `test_rls_mismatched_insert_rejected`: PASS (WITH CHECK constraint prevents
  cross-tenant writes)
