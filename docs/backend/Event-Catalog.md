# Event Catalog

> **Purpose:** Provide the authoritative catalog of every event in Vaeloom's event-driven system — name, schema, producer, consumers, version, and retention
> **Status:** ðŸ†• New
> **Owner:** Architecture Team
> **Version:** 1.0
> **Last Updated:** 2026-07-16
> **Dependencies:** [`../Architecture/Event-Architecture.md`](../Architecture/Event-Architecture.md), [`../Architecture/Event-Flow.md`](../Architecture/Event-Flow.md), [`Queue.md`](./Queue.md)
> **Implementation Status:** ðŸ“‹ Spec Only

## Overview

This is the single source of truth for every event that flows through Vaeloom's event bus. An event is a fact that something happened in the past — "document uploaded," "agent run completed," "tenant suspended." Events are immutable, named in past tense, and carry enough context for any consumer to react. This catalog lists every event type, its payload schema, who produces it, who consumes it, its current version, and how long it is retained.

If an event is not in this catalog, it does not exist. Adding a new event requires a PR that updates this document.

## Goals

- Enumerate every event in the system with full schema
- Define naming conventions and structure
- Document producer and consumer relationships
- Establish versioning and retention per event type
- Enable automated schema validation against this catalog

## Scope

### In Scope

- All event types across documents, memories, agents, auth, tenants, connectors, notifications, analytics, billing
- Event naming convention and envelope format
- Producer/consumer mapping
- Versioning and retention

### Out of Scope

- Event bus transport (see [`../Architecture/Event-Architecture.md`](../Architecture/Event-Architecture.md))
- Event flow traces (see [`../Architecture/Event-Flow.md`](../Architecture/Event-Flow.md))

## Architecture

```mermaid
graph LR
    classDef producer fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef event fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef consumer fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px

    subgraph Producers["Producers"]
        API["API Service"]:::producer
        AI["AI Service"]:::producer
        WORKER["Workers"]:::producer
    end

    BUS["Event Bus<br/>(Redis Streams)"]:::event

    subgraph Consumers["Consumers"]
        INGEST["Ingestion"]:::consumer
        MEM["Memory"]:::consumer
        NOTIFY["Notifications"]:::consumer
        SEARCH["Search Indexer"]:::consumer
        AUDIT["Audit Logger"]:::consumer
        ANALYTICS["Analytics"]:::consumer
    end

    Producers --> BUS --> Consumers
```text

> **Diagram:** Event catalog topology. Producers emit to the bus; consumers subscribe by event type. Every event type in the catalog below flows through this topology.

## Naming Convention

```text
{domain}.{entity}.{action}
```text

| Part | Rule | Examples |
|------|------|----------|
| `domain` | Top-level business domain | `document`, `memory`, `agent`, `auth`, `tenant`, `connector`, `notification`, `analytics`, `billing` |
| `entity` | Specific entity within domain | `uploaded`, `run`, `created` (action-style for one-word events) or `user`, `subscription` |
| `action` | Past-tense verb | `completed`, `failed`, `suspended`, `created`, `deleted` |

## Event Envelope (CloudEvents)

Every event conforms to the CloudEvents 1.0 spec:

```json
{
  "specversion": "1.0",
  "type": "document.uploaded",
  "source": "/v1/documents/doc_abc123",
  "id": "evt_unique_id",
  "time": "2026-07-16T10:00:00.000Z",
  "datacontenttype": "application/json",
  "subject": "user_xyz",
  "tenantid": "tenant_acme",
  "traceid": "trace_abc123",
  "dataschema": "https://schemas.vaeloom.dev/events/document.uploaded.v1.json",
  "data": { /* event-specific payload */ }
}
```text

## Document Events

| Event | Version | Producer | Consumers | Retention |
|-------|---------|----------|-----------|-----------|
| `document.uploaded` | v1 | API Service (DocumentsModule) | Ingestion, Audit | 30 days |
| `document.parsed` | v1 | AI Service (IngestionModule) | Entity Extractor, Audit | 30 days |
| `document.entities_extracted` | v1 | AI Service (IngestionModule) | Embedding, Memory, Audit | 30 days |
| `document.embedded` | v1 | AI Service (IngestionModule) | Memory, Search, Audit | 30 days |
| `document.indexed` | v1 | AI Service (MemoryModule) | Search Indexer, Notifications, Audit | 30 days |
| `document.deleted` | v1 | API Service (DocumentsModule) | Memory (cleanup), Search (remove), Audit | 7 years |
| `document.shared` | v1 | API Service (DocumentsModule) | Notifications, Audit | 90 days |

### document.uploaded schema (v1)

```json
{
  "document_id": "doc_abc123",
  "user_id": "user_xyz",
  "tenant_id": "tenant_acme",
  "filename": "resume_2026.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 245678,
  "source": "upload",
  "workspace_id": "ws_42"
}
```text

## Memory Events

| Event | Version | Producer | Consumers | Retention |
|-------|---------|----------|-----------|-----------|
| `memory.created` | v1 | AI Service (MemoryModule) | RAG Index, Search, Audit | 90 days |
| `memory.updated` | v1 | AI Service (MemoryModule) | RAG Index, Search, Audit | 90 days |
| `memory.deleted` | v1 | AI Service (MemoryModule) | Search (remove), Vector (purge), Audit | 7 years |
| `memory.linked` | v1 | AI Service (MemoryModule) | Graph Index, Audit | 90 days |
| `memory.compressed` | v1 | AI Service (MemoryModule) | Long-Term Store, Audit | 90 days |

### memory.created schema (v1)

```json
{
  "memory_id": "mem_abc123",
  "memory_type": "graph",
  "user_id": "user_xyz",
  "tenant_id": "tenant_acme",
  "source": "agent_run",
  "source_id": "run_xyz",
  "entity_type": "skill",
  "entity_name": "Python",
  "confidence": 0.92,
  "importance": 0.75
}
```text

## Agent Events

| Event | Version | Producer | Consumers | Retention |
|-------|---------|----------|-----------|-----------|
| `agent.run.requested` | v1 | API Service | Orchestrator, Audit | 90 days |
| `agent.run.dispatched` | v1 | AI Service (Orchestrator) | Specialist Agent, Audit | 90 days |
| `agent.run.started` | v1 | AI Service (AgentModule) | Eval, Analytics, Audit | 90 days |
| `agent.run.completed` | v1 | AI Service (AgentModule) | Notifications, Analytics, Eval, Audit | 90 days |
| `agent.run.failed` | v1 | AI Service (AgentModule) | Notifications, Analytics, Audit | 1 year |
| `agent.run.cancelled` | v1 | API Service / AI Service | Notifications, Audit | 90 days |
| `agent.tool_called` | v1 | AI Service (AgentModule) | Eval, Audit | 30 days |
| `agent.memory_write` | v1 | AI Service (AgentModule) | Memory, Audit | 90 days |

### agent.run.completed schema (v1)

```json
{
  "run_id": "run_abc123",
  "user_id": "user_xyz",
  "tenant_id": "tenant_acme",
  "agent_type": "resume",
  "status": "completed",
  "duration_ms": 4200,
  "tokens_input": 1250,
  "tokens_output": 800,
  "model_used": "claude-3-5-sonnet",
  "memory_writes": 3,
  "guardrail_pass": true
}
```text

## Authentication Events

| Event | Version | Producer | Consumers | Retention |
|-------|---------|----------|-----------|-----------|
| `auth.user_registered` | v1 | API Service (AuthModule) | Notifications, Analytics, Audit | 1 year |
| `auth.user_logged_in` | v1 | API Service (AuthModule) | Analytics, Audit | 90 days |
| `auth.user_logged_out` | v1 | API Service (AuthModule) | Audit | 30 days |
| `auth.password_changed` | v1 | API Service (AuthModule) | Notifications, Audit | 7 years |
| `auth.mfa_enabled` | v1 | API Service (AuthModule) | Audit | 7 years |
| `auth.session_expired` | v1 | API Service (AuthModule) | Audit | 30 days |
| `auth.failed_login` | v1 | API Service (AuthModule) | Security (anomaly), Audit | 1 year |

## Tenant Events

| Event | Version | Producer | Consumers | Retention |
|-------|---------|----------|-----------|-----------|
| `tenant.provisioned` | v1 | API Service (TenantsModule) | Notifications, Analytics, Audit | 7 years |
| `tenant.updated` | v1 | API Service (TenantsModule) | Audit | 7 years |
| `tenant.suspended` | v1 | API Service (TenantsModule) | Notifications, Billing, Audit | 7 years |
| `tenant.offboarded` | v1 | API Service (TenantsModule) | Billing, Audit, Data Retention | 7 years |
| `tenant.activated` | v1 | API Service (TenantsModule) | Notifications, Audit | 7 years |

## Connector Events

| Event | Version | Producer | Consumers | Retention |
|-------|---------|----------|-----------|-----------|
| `connector.connected` | v1 | API Service (ConnectorsModule) | Notifications, Audit | 1 year |
| `connector.disconnected` | v1 | API Service (ConnectorsModule) | Notifications, Audit | 1 year |
| `connector.sync_started` | v1 | AI Service (MCPModule) | Audit | 30 days |
| `connector.sync_completed` | v1 | AI Service (MCPModule) | Memory, Notifications, Audit | 90 days |
| `connector.sync_failed` | v1 | AI Service (MCPModule) | Notifications, Audit | 1 year |
| `connector.token_expired` | v1 | AI Service (MCPModule) | Notifications, Audit | 90 days |

## Notification Events

| Event | Version | Producer | Consumers | Retention |
|-------|---------|----------|-----------|-----------|
| `notification.created` | v1 | Any service | NotificationsModule, Audit | 30 days |
| `notification.sent` | v1 | API Service (NotificationsModule) | Analytics, Audit | 30 days |
| `notification.read` | v1 | API Service (NotificationsModule) | Analytics | 30 days |

## Analytics Events

| Event | Version | Producer | Consumers | Retention |
|-------|---------|----------|-----------|-----------|
| `analytics.feature_used` | v1 | API Service / Frontend | AnalyticsModule | 2 years |
| `analytics.page_viewed` | v1 | Frontend | AnalyticsModule | 1 year |
| `analytics.metric_recorded` | v1 | Any service | AnalyticsModule | 2 years |

## Billing Events

| Event | Version | Producer | Consumers | Retention |
|-------|---------|----------|-----------|-----------|
| `billing.subscription_created` | v1 | API Service (BillingModule) | Notifications, Analytics, Audit | 7 years |
| `billing.subscription_updated` | v1 | API Service (BillingModule) | Notifications, Audit | 7 years |
| `billing.subscription_cancelled` | v1 | API Service (BillingModule) | Notifications, Analytics, Audit | 7 years |
| `billing.invoice_generated` | v1 | API Service (BillingModule) | Notifications, Audit | 7 years |
| `billing.payment_succeeded` | v1 | Stripe webhook → BillingModule | Notifications, Audit | 7 years |
| `billing.payment_failed` | v1 | Stripe webhook → BillingModule | Notifications, Dunning, Audit | 7 years |
| `billing.usage_threshold_reached` | v1 | API Service (BillingModule) | Notifications | 1 year |

## Versioning Strategy

| Change Type | Action | Example |
|-------------|---------|---------|
| Add optional field | No version bump | Add `metadata.source_app` to `document.uploaded` |
| Add required field | Bump to v2; both versions supported for 90 days | Add `tenant_id` (required) |
| Rename field | Bump to v2; deprecate old for 90 days | `file_name` → `filename` |
| Remove field | Bump to v2; migrate all consumers first | Remove `legacy_id` |

## Dead-Letter Queue

Events that fail processing after 3 retries are moved to `vaeloom.dlq` with:

- Original event payload
- Error message and stack trace
- Consumer that failed
- Retry count

DLQ events are reviewed daily; ops can retry, drop, or edit-and-retry.

## Security

| Concern | Mitigation |
|---------|-----------|
| PII in event payloads | PII fields encrypted at field level; schema validator rejects unencrypted PII |
| Event forgery | Producers sign events with HMAC; consumers verify signature |
| Event replay attack | `id` field is unique; consumers track processed IDs for dedup |

## Best Practices

| # | Practice | Rationale |
|---|----------|-----------|
| 1 | Events are immutable facts in past tense | `document.uploaded`, never `upload_document` |
| 2 | Every event must be idempotent for consumers | At-least-once delivery means duplicates are possible |
| 3 | Never put large payloads in events | Use references (`document_id`); keep payloads under 10KB |
| 4 | Update this catalog in the same PR that adds an event | Undocumented events are invisible to the team |

## Related Documents

- [`../Architecture/Event-Architecture.md`](../Architecture/Event-Architecture.md) — event bus design
- [`../Architecture/Event-Flow.md`](../Architecture/Event-Flow.md) — event flow traces
- [`Queue.md`](./Queue.md) — queue architecture
- [`../Security/Audit-Logs.md`](../Security/Audit-Logs.md) — audit event details
