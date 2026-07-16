# Vaeloom Integration Guide

> **Purpose:** Comprehensive guide for integrating third-party services with Vaeloom through the connector framework â€” covering connector SDK usage, OAuth implementation, webhook setup, data sync, rate limiting, error recovery, and certification
> **Status:** ðŸ†• New
> **Owner:** Backend Team
> **Last Updated:** 2026-07-13
> **Canonical source:** [`Docs/Integration-Guide.md`](./Integration-Guide.md)

---

## Overview

Vaeloom connects to the services where users already keep their professional data â€” email (Gmail, Outlook), code repositories (GitHub, GitLab), messaging (Slack, Discord), cloud storage (Google Drive, OneDrive), and calendaring (Google Calendar, Outlook Calendar). Each integration is built as a **connector** â€” a self-contained module that handles authentication, data synchronization, webhook reception, and error recovery for a single external service.

This guide is the reference for engineers building new connectors. It covers the connector SDK, OAuth 2.0 authorization flows, webhook endpoint setup and verification, polling-based sync strategies, rate limit management, error handling patterns, and the connector certification process. The audience is backend engineers and integration partners who need to add or maintain a connector in the Vaeloom ecosystem.

The connector framework sits at the boundary between Vaeloom's internal event-driven architecture and the external APIs it consumes. Connectors are registered with the Connector Agent, communicate through the Event Bus, and store credentials in the Secrets Manager. Understanding the [Event Architecture](./Architecture/Event-Architecture.md) and [Authentication](./Backend/Authentication.md) systems is a prerequisite for this guide.

Reliable integrations are critical because Vaeloom's core value proposition â€” an always-current second brain â€” depends on continuous, correct data flow from external sources. A broken connector means stale memory, missed deadlines, and eroded user trust.

---

## Goals

- Define the connector integration architecture and component boundaries
- Establish standards for OAuth 2.0 implementation, token lifecycle, and scope management
- Provide implementation patterns for webhook setup, signature verification, idempotency, and retry policies
- Document sync strategies (full, incremental, webhook-driven, reconciliation) with performance trade-offs
- Enable operational excellence through rate limiting, error queues, monitoring dashboards, and connector certification

---

## Scope

### In Scope

- Connector SDK structure and usage patterns
- OAuth 2.0 authorization flows (authorization code, PKCE, client credentials)
- Webhook endpoint configuration, signature verification, retry policies, and idempotency
- Data synchronization strategies â€” full sync, incremental sync, webhook-driven sync, reconciliation
- Rate limiting â€” per-connector configuration, queue management, backpressure signals
- Error handling â€” transient vs permanent errors, retry policies, dead letter queue, alerting
- Connector manifest format and registration
- Connector certification requirements and testing
- Security â€” credential encryption, scope enforcement, audit logging, connector isolation

### Out of Scope

- Internal agent-to-agent communication patterns (see [Event Architecture](./Architecture/Event-Architecture.md))
- Frontend UI for connector configuration and management
- Database schema migrations for connector storage
- Third-party API design or documentation
- Custom enterprise SSO integration (see [Authentication](./Backend/Authentication.md))
- Connector plugin marketplace (see Future Improvements section)

---

## Architecture

```mermaid
graph TD
    classDef external fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:2px
    classDef adapter fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef bus fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:2px
    classDef pipeline fill:#f3e5f5,stroke:#6a1b9a,color:#000,stroke-width:2px
    classDef cross fill:#fce4ec,stroke:#c62828,color:#000,stroke-width:1.5px,stroke-dasharray: 5 3

    subgraph External["ðŸŒ External Services"]
        E1["Gmail API"]
        E2["GitHub API"]
        E3["Slack API"]
        E4["Outlook API"]
        E5["Google Calendar API"]
    end

    subgraph Adapter["ðŸ”Œ Connector Adapter Layer"]
        direction TB
        A1["Connector SDK<br/>TypeScript + Python"]
        A2["OAuth Handler<br/>Token lifecycle"]
        A3["Webhook Receiver<br/>Signature verification"]
        A4["Sync Scheduler<br/>Cron / event-driven"]
        A5["Rate Limiter<br/>Per-connector buckets"]
    end

    subgraph Bus["ðŸ“¨ Event Bus (Redis / Kafka)"]
        B1["webhook.gmail.incoming"]
        B2["sync.github.completed"]
        B3["connector.degraded"]
        B4["token.refresh.failed"]
    end

    subgraph Pipeline["âš™ï¸ Processing Pipeline"]
        P1["Event Router"]
        P2["Classifier<br/>email / notification / event"]
        P3["Deduplicator<br/>external_id + workspace_id"]
        P4["Entity Extractor"]
        P5["Memory Agent<br/>Write to graph"]
    end

    subgraph Cross["ðŸ›¡ï¸ Cross-Cutting"]
        C1["Secrets Manager<br/>AES-256 encrypted"]
        C2["Error Queue<br/>Dead Letter"]
        C3["Health Dashboard<br/>Prometheus + Grafana"]
    end

    E1 -->|REST / Webhook| A3
    E2 -->|GraphQL / Webhook| A3
    E3 -->|RTM / Webhook| A3
    E1 -->|Polling| A4
    E2 -->|Polling| A4
    A2 -->|OAuth tokens| C1
    A3 -->|Validated events| B1
    A4 -->|Sync results| B2
    B1 --> P1
    B2 --> P1
    B3 --> C3
    B4 --> C2
    P1 --> P2 --> P3 --> P4 --> P5
    C2 -->|Alert| C3
    A5 -->|Backpressure| A4
    A5 -->|Throttle| A3

    class E1,E2,E3,E4,E5 external
    class A1,A2,A3,A4,A5 adapter
    class B1,B2,B3,B4 bus
    class P1,P2,P3,P4,P5 pipeline
    class C1,C2,C3 cross
```text

> **Diagram:** Connector architecture showing five layers. **External Services** connect via REST/GraphQL APIs or webhooks. The **Connector Adapter Layer** manages OAuth, webhook reception, sync scheduling, and rate limiting. Validated events publish to the **Event Bus** (Redis/Kafka) on typed topics. The **Processing Pipeline** routes, classifies, deduplicates, and extracts entities into memory. **Cross-Cutting** concerns include encrypted credential storage, a dead letter error queue, and a health dashboard.

---

## Components

| Component | Responsibility | Technology | Scale Strategy |
|-----------|---------------|------------|----------------|
| Connector SDK | Base class, manifest validation, HTTP client, token injection | TypeScript / Python | SDK versioned per connector |
| OAuth Handler | Authorization URL generation, code exchange, token refresh, scope negotiation | TypeScript (NestJS) | Stateless â€” scales horizontally |
| Webhook Receiver | Endpoint registration, HMAC verification, idempotency check, event publishing | TypeScript (NestJS) | Stateless â€” scales horizontally |
| Sync Scheduler | Cron triggers, sync queue management, pagination, page token tracking | TypeScript (BullMQ) | Worker pool â€” partitioned by connector_id |
| Rate Limiter | Token bucket per connector, Retry-After parsing, backoff orchestration | TypeScript (Redis) | Redis-backed â€” shared state |
| Error Queue | Dead letter storage, replay, TTL-based retention | Redis / PostgreSQL | Partitioned by error type |
| Connector Registry | Manifest storage, versioning, health state, metrics aggregation | PostgreSQL | Read replicas for dashboard |

---

## Workflows

### OAuth Authorization Flow

```text
Step 1:  User clicks "Connect Service" in frontend
Step 2:  API generates state parameter (anti-CSRF) and stores in Redis (TTL: 10min)
Step 3:  API redirects user to provider's OAuth consent URL with requested scopes
Step 4:  User approves scopes on provider's consent screen
Step 5:  Provider redirects to Vaeloom callback URL with authorization code
Step 6:  API exchanges authorization code for access_token + refresh_token + expires_in
Step 7:  API encrypts tokens and stores in Secrets Manager keyed by workspace_id + connector_id
Step 8:  API stores expires_at and scopes in connector_registry (PostgreSQL)
Step 9:  API marks connector as "connected" â€” sync scheduler activates
```text

### Webhook Setup Flow

```text
Step 1:  Connector registers webhook URL with external service (POST /webhooks/:connector_type)
Step 2:  Service returns webhook_id and shared secret â€” stored in Secrets Manager
Step 3:  Vaeloom responds to inbound webhooks by verifying HMAC-SHA256 signature
Step 4:  Idempotency check: look up X-Idempotency-Key in Redis (TTL: 5min)
Step 5:  If new: publish event to Event Bus topic webhook.{connector_type}
Step 6:  Processing pipeline handles event â€” classify, deduplicate, extract entities
Step 7:  On success: ACK event, return 200 OK to external service
Step 8:  On failure: NACK event, retry up to 3 times, then route to Dead Letter Queue
```text

### Polling Sync Workflow

```text
Step 1:  Sync scheduler triggers based on connector cron schedule (e.g., every 6h)
Step 2:  Load connector config and decrypted tokens from Secrets Manager
Step 3:  Check token expiry â€” refresh if needed (at least 5min before expiry)
Step 4:  Call external API with pagination (page_token / cursor / nextPageToken)
Step 5:  Process each page: deduplicate by external_id, classify items, extract entities
Step 6:  Enqueue extracted entities for Memory Agent ingestion
Step 7:  On rate limit (429): parse Retry-After, backoff 30s â†’ 2m â†’ 5m
Step 8:  On success: update last_sync_at, record item_count, emit metrics
Step 9:  On repeated failure: mark connector as degraded, alert engineering
```text

### Error Recovery Workflow

```text
Step 1:  Repeated failures push events to Dead Letter Queue
Step 2:  DLQ alert triggers (threshold: 100 events in 1h)
Step 3:  Engineer inspects DLQ entries â€” payload, error, headers preserved
Step 4:  Engineer identifies root cause (API change, revoked token, credential expiry)
Step 5:  Apply fix â€” update connector config, re-authorize, or deploy connector patch
Step 6:  Replay DLQ entries through processing pipeline (preserving original order)
Step 7:  Mark connector as healthy if syncs succeed
```text

---

## Integration Types

| Type | Description | When to Use | Examples |
|------|-------------|-------------|----------|
| OAuth 2.0 | Authorization code flow with PKCE; access + refresh tokens | Services requiring user-authorized scoped access | Gmail, GitHub, Slack, Google Drive |
| API Key | Static key in header (X-API-Key / Authorization) | Internal services or simple read-only APIs | Weather API, public data feeds |
| Webhook | Provider pushes events to Vaeloom endpoint | Real-time event delivery | GitHub push events, Slack events API |
| Polling | Vaeloom fetches data on a schedule | APIs without webhook support or for catch-up sync | Gmail (fallback), Calendar events |
| SDK | Client library wrapping provider's SDK | Providers with mature SDKs and complex types | Google Workspace SDK, Microsoft Graph SDK |

---

## Connector Manifest

Every connector must define a manifest that declares its identity, authentication requirements, capabilities, and configuration. The manifest is stored in the Connector Registry and validated on registration.

```json
{
  "id": "connector.gmail",
  "name": "Gmail Connector",
  "version": "1.2.0",
  "min_sdk_version": "0.4.0",
  "auth": {
    "type": "oauth2",
    "provider": "google",
    "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth",
    "token_url": "https://oauth2.googleapis.com/token",
    "scopes": {
      "required": ["https://www.googleapis.com/auth/gmail.readonly"],
      "optional": ["https://www.googleapis.com/auth/gmail.modify"]
    },
    "pkce_required": true,
    "token_lifetime_sec": 3600,
    "refresh_enabled": true
  },
  "capabilities": {
    "sync": {
      "type": "polling",
      "default_interval": "every 6 hours",
      "supports_incremental": true,
      "max_items_per_sync": 10000
    },
    "webhook": {
      "supported": true,
      "events": ["message.received", "message.sent"],
      "max_retries": 3,
      "idempotency_required": true
    },
    "rate_limiting": {
      "max_requests_per_second": 250,
      "quota_unit": "requests",
      "retry_after_required": true
    }
  },
  "config": {
    "fields": [
      {
        "key": "label_filter",
        "type": "string",
        "label": "Gmail Label Filter",
        "description": "Only sync emails with this label",
        "required": false,
        "default": "INBOX"
      },
      {
        "key": "max_attachment_size_mb",
        "type": "number",
        "label": "Max Attachment Size (MB)",
        "default": 25,
        "min": 1,
        "max": 100
      }
    ]
  }
}
```text

```yaml
# connector.github.yml
id: connector.github
name: GitHub Connector
version: "1.1.0"
min_sdk_version: "0.4.0"
auth:
  type: oauth2
  provider: github
  authorization_url: "https://github.com/login/oauth/authorize"
  token_url: "https://github.com/login/oauth/access_token"
  scopes:
    required:
      - "repo"
      - "notifications"
    optional:
      - "read:org"
      - "read:user"
  pkce_required: false
  token_lifetime_sec: 28800
  refresh_enabled: true
capabilities:
  sync:
    type: polling
    default_interval: "every 6 hours"
    supports_incremental: true
    max_items_per_sync: 5000
  webhook:
    supported: true
    events:
      - "push"
      - "pull_request"
      - "issues"
    max_retries: 3
    idempotency_required: true
  rate_limiting:
    max_requests_per_hour: 5000
    quota_unit: requests
    retry_after_required: true
config:
  fields:
    - key: repos
      type: string[]
      label: "Repository Filter"
      description: "Only sync notifications for these repos (empty = all)"
      required: false
```text

---

## OAuth Flow

```mermaid
sequenceDiagram
    participant User as "ðŸ‘¤ User"
    participant Client as "ðŸŒ Vaeloom Client"
    participant API as "âš™ï¸ Vaeloom API"
    participant SM as "ðŸ”‘ Secrets Manager"
    participant Provider as "ðŸŒ External Provider"

    User->>Client: Click "Connect {Service}"
    Client->>API: POST /connectors/{id}/auth/initiate
    API->>API: Generate state + PKCE code_verifier
    API->>SM: Store state (TTL: 10min), code_verifier (TTL: 10min)
    API-->>Client: { authorization_url, state }
    Client->>Provider: Redirect user to authorization_url <br/>+ response_type=code <br/>+ scope={scopes} <br/>+ state={state} <br/>+ code_challenge={S256}
    Provider->>User: Display consent screen with requested scopes
    User->>Provider: Approve permissions

    alt âœ… User Approves
        Provider-->>Client: Redirect to callback <br/>?code={auth_code}&state={state}
        Client->>API: POST /connectors/{id}/auth/callback <br/>{ code, state }
        API->>SM: Verify state matches
        API->>Provider: POST /token <br/>grant_type=authorization_code <br/>code={auth_code} <br/>redirect_uri={callback} <br/>code_verifier={verifier}
        Provider-->>API: { access_token, refresh_token, expires_in }
        API->>SM: Encrypt tokens (AES-256-GCM) <br/>Store at secrets/{workspace}/{connector}
        API->>API: Record expires_at, scopes in DB
        API-->>Client: { status: "connected" }
        Client-->>User: âœ… Service connected

    else âŒ User Denies
        Provider-->>Client: Redirect to callback <br/>?error=access_denied
        Client->>User: Show "Authorization denied" message
    end

    Note over API,SM: â”€â”€ Token Refresh â”€â”€

    API->>API: Check expires_at < now + 300s
    API->>SM: Decrypt refresh_token
    API->>Provider: POST /token <br/>grant_type=refresh_token <br/>refresh_token={token}
    Provider-->>API: { access_token, expires_in }

    alt âœ… Refresh Succeeds
        API->>SM: Encrypt & store new access_token
        API->>API: Update expires_at

    else âŒ Refresh Fails (invalid_grant)
        API->>API: Mark connector degraded
        API->>Client: Notify user â€” re-connect required
    end
```text

> **Diagram:** OAuth 2.0 authorization code flow with PKCE. **Top half:** user authorizes via provider consent screen, Vaeloom exchanges the code for tokens, tokens are encrypted and stored in Secrets Manager. **Bottom half:** automatic token refresh when access token is within 5 minutes of expiry â€” failure marks the connector as degraded.

### Token Refresh Strategy

| Scenario | Action | Outcome |
|----------|--------|---------|
| Token expired | Refresh before sync | Transparent â€” sync proceeds normally |
| Token expires within 5min | Preemptive refresh | No sync delay â€” refresh completes before API call |
| Refresh succeeds | Store new access_token, update expires_at | Connector remains healthy |
| Refresh fails (invalid_grant) | Mark degraded, notify user | User must re-authorize |
| Refresh fails (network) | Retry 2x with 5s backoff | Auto-recovery on transient failure |
| Refresh token revoked | Mark degraded permanently | Manual re-connection required |

### Scope Management

| Practice | Rationale |
|----------|-----------|
| Request minimum scopes per connector | Gmail connector should only request `gmail.readonly`, not calendar or contacts scopes â€” principle of least privilege |
| Store granted scopes alongside tokens | API responses may grant fewer scopes than requested â€” use actual scopes, not requested scopes, for capability checks |
| Re-authorize on scope upgrade | If a connector needs new scopes (e.g., from readonly to modify), trigger a fresh OAuth flow â€” never reuse old tokens with elevated scopes |
| Validate scopes on each sync | Providers may change a user's scopes between syncs (admin policy, user revocation) â€” verify minimum scopes before each sync cycle |

---

## Webhook Setup

### Endpoint Configuration

| Parameter | Specification | Example |
|-----------|---------------|---------|
| Endpoint URL | `POST /webhooks/{connector_type}` | `POST /webhooks/gmail` |
| Payload Format | JSON (application/json) | `{ "event": "message_received", "payload": {...} }` |
| Signature Header | `X-Hub-Signature-256` (HMAC-SHA256) | `sha256=abc123...` |
| Idempotency Header | `X-Idempotency-Key` (UUID v4) | `uuid-abc-123-def` |
| Response (success) | `200 OK` | `{ "status": "received" }` |
| Response (duplicate) | `200 OK` (existing idempotency key) | `{ "status": "duplicate", "previous_id": "evt_..." }` |
| Response (error) | `500 Internal Server Error` | â€” |

### Signature Verification

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

interface WebhookHeaders {
  "x-hub-signature-256": string;
  "x-idempotency-key": string;
}

export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const expectedSignature = `sha256=${createHmac("sha256", secret)
    .update(payload, "utf-8")
    .digest("hex")}`;

  try {
    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(signatureHeader);

    if (expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
```text

### Retry Policy

| Attempt | Delay | Notes |
|---------|-------|-------|
| 1st | Immediate | First processing attempt |
| 2nd | 30 seconds | Transient failure recovery |
| 3rd | 5 minutes | Extended backoff |
| 4th (DLQ) | â€” | Route to Dead Letter Queue |

### Idempotency

Idempotency ensures that duplicate webhook deliveries (common in production â€” network retries, provider re-delivery guarantees) do not result in duplicate processing. The idempotency key is extracted from the `X-Idempotency-Key` header and checked against a Redis cache with a 5-minute TTL (matching the typical webhook re-delivery window). If the key exists, the endpoint returns `200 OK` with the previous event ID without re-processing. If the key is new, the event is published to the Event Bus and the key + event ID are stored in Redis.

```typescript
async function handleWebhook(
  connectorType: string,
  payload: unknown,
  headers: WebhookHeaders,
): Promise<Response> {
  const idempotencyKey = headers["x-idempotency-key"];

  // Check idempotency
  const existing = await redis.get(`idempotency:${idempotencyKey}`);
  if (existing) {
    return { status: "duplicate", previousId: existing };
  }

  // Verify signature
  const secret = await secretsManager.get(`${connectorType}.webhook_secret`);
  const rawPayload = JSON.stringify(payload);
  if (!verifyWebhookSignature(rawPayload, headers["x-hub-signature-256"], secret)) {
    return { status: 401, body: "Invalid signature" };
  }

  // Publish to event bus
  const eventId = generateEventId();
  await eventBus.publish(`webhook.${connectorType}`, {
    id: eventId,
    connectorType,
    payload,
    receivedAt: new Date().toISOString(),
  });

  // Store idempotency key (TTL: 5 min)
  await redis.setEx(`idempotency:${idempotencyKey}`, 300, eventId);

  return { status: "received", eventId };
}
```text

---

## Data Sync Strategies

| Strategy | Mechanism | Use Case | Trade-offs |
|----------|-----------|----------|------------|
| Full Sync | Fetch all items, compare with stored state | Initial connector setup, reconciliation after errors | High latency, API quota intensive â€” use sparingly |
| Incremental Sync | Fetch items modified since last sync (use `after` / `since` / `updatedMin` params) | Regular sync cycles (every 6h) | Lower latency, lower quota usage â€” preferred for recurring sync |
| Webhook-Driven Sync | Real-time push notifications update individual items | Gmail push, GitHub push events | Near-real-time, low latency â€” but misses items if webhook delivery fails |
| Reconciliation | Periodic comparison of local state vs external source to detect missed items | Daily integrity check | Catches silent failures (missed webhooks, pagination gaps) â€” run less frequently |

### Sync Decision Matrix

```mermaid
flowchart LR
    classDef init fill:#e3f2fd,stroke:#1565c0,color:#000
    classDef webhook fill:#e8f5e9,stroke:#2e7d32,color:#000
    classDef inc fill:#fff3e0,stroke:#e65100,color:#000
    classDef rec fill:#f3e5f5,stroke:#6a1b9a,color:#000

    Start["Sync Triggered"] --> First{"First sync<br/>after connect?"}
    First -->|Yes| Full["ðŸ”µ Full Sync<br/>Fetch all items"]
    First -->|No| WebhookAvail{"Webhook events<br/>available?"}
    WebhookAvail -->|Yes & recent| Webhook["ðŸŸ¢ Webhook-Driven<br/>Process live events"]
    WebhookAvail -->|No / stale| Incremental["ðŸŸ  Incremental Sync<br/>Fetch since last sync_at"]
    Full --> FullDone["Store all items<br/>Set last_sync_at"]
    Webhook --> SyncDone
    Incremental --> SyncDone["âœ… Sync Complete<br/>Update sync metrics"]
    SyncDone --> Timer{"24h since<br/>last reconciliation?"}
    Timer -->|Yes| Reconcile["ðŸŸ£ Reconciliation<br/>Compare local vs source"]
    Timer -->|No| End["â¸ï¸ Wait for next trigger"]
    Reconcile -->|Items missing| Incremental
    Reconcile -->|All match| End

    class Full init
    class Webhook webhook
    class Incremental,Reconcile inc
    class Start,SyncDone,End rec
```text

> **Diagram:** Sync strategy decision tree. First sync always does a **full sync**. Subsequent syncs prefer **webhook-driven** updates if recent events exist, falling back to **incremental** polling. A **reconciliation** check runs every 24 hours to catch items missed by webhooks or pagination gaps, triggering an incremental catch-up if discrepancies are found.

---

## Rate Limiting

### Per-Connector Rate Limit Configuration

| Connector | Limit | Scope | Backoff Strategy |
|-----------|-------|-------|------------------|
| Gmail | 250 quota units/user/second | Per user | Retry-After header |
| GitHub | 5,000 requests/hour | Per user (authenticated) | Retry-After header |
| Slack | 1 request/second | Per workspace | 1min â†’ 5min exponential |
| Outlook | 10,000 requests/hour | Per tenant | Retry-After header |
| Google Calendar | 60 requests/minute | Per user | Retry-After header |

### Queue Management

```typescript
interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  backoffBaseMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

class TokenBucketRateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();

  constructor(private redis: Redis) {}

  async acquire(connectorId: string, cost: number = 1): Promise<void> {
    const bucket = await this.getOrCreateBucket(connectorId);

    while (bucket.tokens < cost) {
      const waitTime = this.calculateWaitTime(bucket);
      await sleep(waitTime);
      await this.refreshBucket(connectorId, bucket);
    }

    bucket.tokens -= cost;
    await this.persistBucket(connectorId, bucket);
  }

  async handleRateLimitResponse(
    connectorId: string,
    retryAfterSeconds: number,
  ): Promise<void> {
    const cooldown = Math.min(retryAfterSeconds * 1000, this.config.maxBackoffMs);
    await this.redis.setEx(
      `ratelimit:backoff:${connectorId}`,
      Math.ceil(cooldown / 1000),
      "active",
    );
  }
}
```text

### Backpressure Signals

| Signal | Source | Action |
|--------|--------|--------|
| `429 Too Many Requests` | External API | Parse Retry-After, apply per-connector backoff |
| `503 Service Unavailable` | External API | Exponential backoff (1min base, 2x multiplier, 30min cap) |
| Queue depth > threshold | Internal sync queue | Pause new sync jobs until queue drains below 80% |
| Token bucket empty | Rate limiter | Delay sync until next window replenishes tokens |
| Consumer lag > 10K | Event Bus monitoring | Scale processing workers, reduce sync batch sizes |

---

## Error Handling

### Transient Errors

| Error | Detection | Retry Policy | Recovery |
|-------|-----------|--------------|----------|
| `429 Too Many Requests` | HTTP status code | 3 retries: 30s â†’ 2m â†’ 5m | Auto â€” sync continues |
| `5xx Server Error` | HTTP status code | 3 retries: 10s â†’ 1m â†’ 3m | Auto â€” sync continues |
| Network timeout | `fetch` timeout / ECONNRESET | 2 retries: immediate + 30s | Auto â€” immediate retry |
| Rate limit exceeded | Rate limiter signal | Backoff until window reset | Auto â€” next window |
| OAuth token expired | `401` + refresh attempt | 2 retry refresh attempts | Auto â€” refresh succeeds |

### Permanent Errors

| Error | Detection | Action | Recovery |
|-------|-----------|--------|----------|
| `invalid_grant` | Token refresh returns `400` | Mark connector degraded | Manual â€” user re-authorizes |
| `insufficient_scope` | API returns `403` | Mark connector degraded | Manual â€” re-authorize with required scopes |
| `resource_not_found` | API returns `404` | Log warning, skip item | Auto â€” item was deleted externally |
| `invalid_request` | Malformed payload | Log error, push to DLQ | Manual â€” fix connector code |

### Dead Letter Queue

The Dead Letter Queue (DLQ) preserves events that have exceeded their maximum retry attempts. Each DLQ entry stores the full event payload, headers, error details, retry count, and timestamps. DLQ entries are retained for 30 days with automatic cleanup.

```json
{
  "eventId": "evt_failed_abc123",
  "connectorId": "connector.gmail",
  "originalTopic": "webhook.gmail.incoming",
  "payload": { "messageId": "msg_456", "from": "user@example.com" },
  "error": {
    "type": "TOKEN_EXPIRED",
    "message": "Refresh token invalid â€” user must re-authorize",
    "statusCode": 400,
    "retryCount": 3
  },
  "timestamps": {
    "firstAttempt": "2026-07-13T08:00:00Z",
    "lastAttempt": "2026-07-13T08:15:30Z",
    "queuedAt": "2026-07-13T08:15:31Z"
  },
  "headers": {
    "x-idempotency-key": "uuid-def-456-ghi",
    "x-hub-signature-256": "sha256=abc..."
  }
}
```text

### Alerting

| Condition | Severity | Channel | Threshold |
|-----------|----------|---------|-----------|
| DLQ depth > 100 | P1 | PagerDuty + Slack | >100 events in 1h |
| Connector degraded > 24h | P2 | Slack | Connector unhealthy flag |
| Sync failure rate > 20% | P2 | Slack | Over 10-min rolling window |
| Token refresh failure rate > 50% | P1 | PagerDuty + Slack | Over 5-min rolling window |
| Rate limit hit rate > 50% | P3 | Dashboard alert | Over 1h window |

---

## Security

| Concern | Mitigation | Verification |
|---------|------------|--------------|
| Credential storage | OAuth tokens encrypted with AES-256-GCM at rest in Secrets Manager â€” never stored in database or logs | Quarterly secrets audit, automated token leak scan |
| Credential in transit | TLS 1.2+ required for all connector API calls and webhook endpoints | TLS configuration scan in CI/CD pipeline |
| Scope escalation | Each connector uses a dedicated OAuth client with minimum required scopes â€” no scope reuse across connectors | Automated manifest validation on registration |
| Token leakage | Sanitize all log output â€” redact `access_token`, `refresh_token`, `authorization` header values | Log inspection in staging, CI regex scan |
| Webhook injection | HMAC-SHA256 signature verification on every webhook â€” use `timingSafeEqual` comparison | Integration tests with invalid signatures assert 401 |
| CSRF on OAuth | `state` parameter with cryptographic randomness (32 bytes) stored in Redis with 10min TTL | Penetration test of OAuth callback endpoint |
| Connector isolation | Each connector runs in its own execution context â€” no shared memory, no cross-connector data access | Runtime isolation tests, dependency vulnerability scanning |
| Audit logging | All connector actions â€” token exchange, sync start/complete, webhook received, error â€” logged with connector_id, workspace_id, timestamp | Audit log review in quarterly security review |

---

## Performance

| Concern | Budget | Measurement | Optimization |
|---------|--------|-------------|--------------|
| Sync duration (incremental) | < 2 minutes per connector | Histogram â€” `sync_duration_ms` | Parallel page fetching (max 5 concurrent), pagination token caching |
| Sync duration (full) | < 15 minutes per connector | Histogram â€” `sync_duration_ms` | Batch items in groups of 100, stream to processing pipeline |
| Webhook processing latency | < 500ms p99 | Histogram â€” `webhook_latency_ms` | Stateless receiver â€” no DB writes in hot path |
| Token refresh latency | < 1s p95 | Histogram â€” `token_refresh_ms` | Preemptive refresh 5min before expiry â€” never on sync critical path |
| Rate limiter overhead | < 5ms per decision | Histogram â€” `ratelimit_check_ms` | Local Redis pipeline batch checks every 100ms |
| Memory per connector | < 256MB RSS | Container metrics | Stream processing, page early on large payloads |

### Sync Frequency Tuning

| Data Freshness Requirement | Connector Type | Sync Interval | Notes |
|---------------------------|----------------|---------------|-------|
| Near-real-time | Email, Chat | Webhook-driven + incremental every 1h | Webhooks for live events, polling as safety net |
| Daily | Calendar, Tasks | Every 12h | Changes are infrequent â€” 12h is sufficient |
| On-activity | GitHub, Drive | Webhook-driven + incremental every 6h | Webhooks cover push/PR events, polling catches missed events |
| Weekly | Archive connectors | Every 24h | Low-activity connectors get less frequent sync |

### Batch Sizes and Parallel Processing

| Operation | Batch Size | Parallelism | Rationale |
|-----------|------------|-------------|-----------|
| Page fetch | API default (max 100) | 5 concurrent workers | Balance throughput vs rate limit consumption |
| Entity extraction | 50 items | 3 concurrent workers | LLM extraction is CPU-bound â€” limit parallelism to avoid throttling |
| Memory write | 25 items | 2 concurrent writers | Avoid write contention in graph database |
| DLQ replay | 100 events | 1 (sequential per connector) | Preserve ordering guarantees within a connector |

---

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| `sync_duration_ms` (p99) | > 5min for incremental, > 30min for full | P2 | Connector Health Dashboard |
| `sync_failure_rate` | > 20% over 10min window | P2 | Connector Health Dashboard |
| `webhook_latency_ms` (p99) | > 1s | P2 | Connector Health Dashboard |
| `webhook_invalid_signatures` | > 5 in 5min from same IP | P3 | Security Dashboard |
| `connector_degraded_count` | > 0 for > 24h | P2 | Connector Health Dashboard |
| `token_refresh_failure_rate` | > 50% over 5min | P1 | Auth Dashboard |
| `dlq_depth` | > 100 events | P1 | Error Processing Dashboard |
| `ratelimit_hit_rate` | > 50% of requests | P3 | Rate Limit Dashboard |
| `quota_used_pct` | > 80% of daily quota | P3 | Quota Usage Dashboard |
| `items_processed_per_sync` | 0 for 2 consecutive syncs | P3 | Connector Health Dashboard |

### Connector Health Dashboard

The Connector Health Dashboard (Grafana) displays per-connector and aggregate views:

- **Health Status Grid**: Green (healthy), Yellow (degraded â€” token refresh failing), Red (broken â€” no successful sync in 48h)
- **Sync Latency**: p50 / p95 / p99 histogram for each connector type
- **Error Rate**: Time-series of sync failures, webhook validation failures, token refresh failures
- **Quota Usage**: Current usage vs daily quota per connector â€” projected exhaustion time
- **DLQ Depth**: Current dead letter count and age of oldest entry
- **Rate Limit Impact**: Rate limit hits per connector â€” distinguish soft (429) from hard (blocked) limits
- **Webhook Volume**: Events received per minute per connector type â€” detect sudden spikes or drops

---

## Connector Certification

### Requirements for Publishing a Connector

| Category | Requirement | Verification |
|----------|-------------|--------------|
| Manifest | Complete manifest with id, name, version, auth, capabilities, config | Schema validation on PR |
| OAuth | PKCE flow for SPA support, token refresh, scope enforcement | Integration tests with sandbox |
| Webhooks | Signature verification, idempotency, retry policy | Mock webhook server in test suite |
| Sync | Full + incremental sync, pagination, empty state handling | Test with 0, 100, 10K items |
| Rate Limiting | Retry-After parsing, exponential backoff, backpressure | Chaos tests with simulated 429 |
| Error Handling | All error paths handled, DLQ routing, structured logging | Error injection test suite |
| Security | Secrets Manager usage, no hardcoded credentials, TLS | Security review + SAST scan |
| Monitoring | Metrics exported, structured logging, alert integration | Grafana dashboard configured |
| Documentation | README with setup, auth, sync, webhook, error reference | Doc review |
| Tests | Unit tests > 80% coverage, integration tests, chaos tests | CI pipeline pass |

### Review Process

```mermaid
flowchart LR
    classDef submit fill:#e3f2fd,stroke:#1565c0,color:#000
    classDef review fill:#fff3e0,stroke:#e65100,color:#000
    classDef test fill:#e8f5e9,stroke:#2e7d32,color:#000
    classDef sec fill:#fce4ec,stroke:#c62828,color:#000
    classDef approve fill:#f3e5f5,stroke:#6a1b9a,color:#000

    Submit["ðŸ“¤ Submit PR<br/>Connector code + manifest"] --> ManifestCheck{"Manifest<br/>validates?"}
    ManifestCheck -->|Pass| CodeReview["ðŸ” Code Review<br/>Backend team lead"]
    ManifestCheck -->|Fail| Fix["âœï¸ Fix manifest"]
    Fix --> ManifestCheck
    CodeReview --> TestSuite["ðŸ§ª Integration Tests<br/>Sandbox environment"]
    TestSuite -->|Pass| SecurityReview["ðŸ”’ Security Review<br/>Token handling, scopes"]
    TestSuite -->|Fail| Fix
    SecurityReview -->|Pass| Performance["ðŸ“Š Performance Review<br/>Sync latency, quota usage"]
    SecurityReview -->|Fail| Fix
    Performance -->|Pass| Docs["ðŸ“ Documentation Review<br/>README, manifest, examples"]
    Performance -->|Fail| Fix
    Docs -->|Pass| Staging["ðŸ§ª Staging Deployment<br/>7-day observation"]
    Docs -->|Fail| Fix
    Staging -->|Healthy| Approval["âœ… Certified<br/>Register in production"]
    Staging -->|Degraded| Fix

    class Submit submit
    class ManifestCheck,CodeReview,Performance,Docs review
    class TestSuite,Staging test
    class SecurityReview sec
    class Approval approve
```text

> **Diagram:** Connector certification pipeline. A PR triggers automated manifest validation, then progresses through code review â†’ integration tests â†’ security review â†’ performance review â†’ documentation review â†’ 7-day staging observation before production certification. Any failure routes back to fixes and re-submission.

---

## Examples

### Gmail Connector Integration

```typescript
import { ConnectorBase, OAuthConfig, SyncResult } from "@vaeloom/connector-sdk";
import { google, gmail_v1 } from "googleapis";

interface GmailConfig {
  labelFilter: string;
  maxAttachmentSizeMb: number;
}

export class GmailConnector extends ConnectorBase<GmailConfig> {
  readonly id = "connector.gmail";
  readonly version = "1.2.0";

  getOAuthConfig(): OAuthConfig {
    return {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      pkceRequired: true,
      tokenLifetimeSec: 3600,
    };
  }

  async sync(token: string, config: GmailConfig, state: SyncState): Promise<SyncResult> {
    const client = this.createClient(token);
    const items: SyncItem[] = [];
    let pageToken: string | undefined;

    do {
      const response = await client.users.messages.list({
        userId: "me",
        maxResults: 100,
        pageToken,
        q: state.lastSyncAt
          ? `after:${Math.floor(state.lastSyncAt.getTime() / 1000)}`
          : undefined,
      });

      for (const message of response.data.messages || []) {
        const detail = await client.users.messages.get({
          userId: "me",
          id: message.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        items.push({
          externalId: message.id!,
          type: "email",
          data: detail.data,
          timestamp: new Date(parseInt(detail.data.internalDate!)),
        });
      }

      pageToken = response.data.nextPageToken;

      if (items.length >= state.maxItems) break;
    } while (pageToken);

    return {
      items,
      nextPageToken: pageToken,
      hasMore: !!pageToken,
    };
  }
}
```text

### GitHub Connector Integration

```python
from Vaeloom_connector_sdk import ConnectorBase, OAuthConfig, SyncResult, SyncState
from typing import Optional
import httpx


class GitHubConnector(ConnectorBase):
    id = "connector.github"
    version = "1.1.0"

    def get_oauth_config(self) -> OAuthConfig:
        return OAuthConfig(
            authorization_url="https://github.com/login/oauth/authorize",
            token_url="https://github.com/login/oauth/access_token",
            scopes=["repo", "notifications"],
            pkce_required=False,
            token_lifetime_sec=28800,
        )

    async def sync(
        self,
        token: str,
        config: dict,
        state: SyncState,
    ) -> SyncResult:
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
        }
        items = []
        page = 1

        async with httpx.AsyncClient() as client:
            while True:
                params = {
                    "per_page": 100,
                    "page": page,
                    "all": "true",
                }

                if state.last_sync_at:
                    params["since"] = state.last_sync_at.isoformat()

                response = await client.get(
                    "https://api.github.com/notifications",
                    headers=headers,
                    params=params,
                )

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    raise RateLimitError(retry_after_seconds=retry_after)

                response.raise_for_status()
                notifications = response.json()

                if not notifications:
                    break

                for notification in notifications:
                    items.append({
                        "external_id": notification["id"],
                        "type": "notification",
                        "data": notification,
                        "timestamp": notification["updated_at"],
                    })

                page += 1

                if len(items) >= state.max_items:
                    break

        return SyncResult(
            items=items,
            has_more=False,
        )
```text

### Webhook Registration (CLI)

```bash
# Register webhook endpoint for GitHub connector
curl -X POST https://api.Vaeloom.dev/v1/connectors/github/webhooks \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.Vaeloom.dev/webhooks/github",
    "events": ["push", "pull_request", "issues"],
    "secret": "$(openssl rand -hex 32)"
  }'

# Response
# {
#   "webhook_id": "wh_abc123",
#   "status": "active",
#   "events": ["push", "pull_request", "issues"]
# }

# Test webhook delivery
curl -X POST https://api.Vaeloom.dev/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{"action":"test"}' | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d' ' -f2)" \
  -H "X-Idempotency-Key: test-$(uuidgen)" \
  -d '{"action":"test","repository":{"full_name":"Vaeloom/test"}}'
```text

---

## Best Practices

| # | Practice | Rationale |
|---|----------|-----------|
| 1 | **Idempotent event handlers** | Webhook providers may deliver the same event multiple times â€” handlers must produce the same result for the same idempotency key. Use `X-Idempotency-Key` for deduplication with a 5-minute Redis TTL matching the typical re-delivery window |
| 2 | **Graceful degradation on API failures** | When an external API is unavailable, skip that sync cycle rather than failing the entire connector â€” degraded state is better than broken state. Users see stale data instead of error messages |
| 3 | **Progressive enhancement of sync strategies** | Start with polling sync for MVP, add webhook support later â€” polling is simpler to implement and debug, and webhooks can be layered on top without changing the processing pipeline |
| 4 | **Token preemptive refresh** | Check token expiry at the start of every sync cycle â€” refresh at least 5 minutes before expiry to avoid sync delays from inline refresh round-trips |
| 5 | **Structured logging with connector_id** | Every log line must include `connector_id`, `workspace_id`, `sync_id`, and `attempt` â€” debugging connector failures without these identifiers is nearly impossible across multi-tenant workloads |
| 6 | **Respect rate limit headers exactly** | Parse and honor `Retry-After`, `X-RateLimit-Reset`, and `X-RateLimit-Remaining` from every API response â€” ignoring these causes connector bans and permanent IP blocks |
| 7 | **Test with production-like data volumes** | A connector that works with 10 items will break with 10,000 â€” test pagination, memory pressure, and sync duration at realistic data volumes before certification |
| 8 | **Circuit breaker for repeated failures** | After 5 consecutive sync failures, stop retrying and mark the connector degraded â€” prevents wasted resources and alert fatigue |

---

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| **Missing webhook signature verification** | Any attacker who discovers the webhook URL can inject forged events â€” without HMAC verification, the system processes untrusted data as if it came from the provider |
| **Ignoring rate limit headers** | Retrying immediately after a `429` without parsing `Retry-After` compounds the rate limit violation â€” providers may ban the application, affecting all users of that connector |
| **No dead letter queue** | Events that fail processing after max retries disappear silently â€” without a DLQ, failures are invisible, data is lost, and debugging requires reproducing the exact race condition |
| **Storing OAuth tokens in the database** | A database breach exposes long-lived credentials â€” tokens must be stored in a dedicated Secrets Manager with AES-256-GCM encryption and access auditing |
| **Not handling pagination correctly** | APIs limit page size (usually 100 items) â€” missing `nextPageToken` or `cursor` handling means only the first page is synced, silently losing all remaining data |
| **Using the same OAuth client for multiple connector types** | A connector with `gmail.readonly` scope that reuses a token with `calendar.readonly` scope creates privilege ambiguity â€” each connector type must have its own OAuth client with scoped credentials |
| **No token refresh pre-check** | Starting a sync without checking token expiry leads to an immediate `401`, which triggers an inline refresh â€” adding 2-3 network round trips to every sync cycle doubles sync latency |
| **Hardcoding connector configuration** | Label filters, max items, sync intervals hardcoded in connector code prevent per- workspace customization â€” all configurable parameters must come from the connector manifest's config fields |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **API deprecation / breaking changes** | Medium | High | Monitor provider changelogs, maintain abstraction layer between connector SDK and provider API, version-pin provider SDKs, run integration tests weekly against sandbox environments |
| **Quota exhaustion** | Medium | High | Track quota usage per connector per workspace, alert at 80% of daily quota, implement per-workspace rate limiter as safety net, stagger sync schedules across workspaces |
| **Token revocation without notice** | Medium | Medium | Handle `invalid_grant` gracefully â€” mark connector degraded, notify user with actionable message ("Re-connect {service}"), offer one-click re-authorization |
| **Webhook delivery outage** | Low | Medium | Webhook delivery is best-effort â€” maintain polling fallback with shorter intervals (every 1h) to catch missed events, run reconciliation check every 24h |
| **Provider rate limit policy change** | Low | Medium | Treat `Retry-After` as authoritative regardless of configured limits â€” update rate limit config schema to allow per-provider overrides without connector code changes |
| **Secrets Manager availability** | Low | High | Cache decrypted tokens locally for the duration of a sync (TTL: 5min), fall back to Secrets Manager on cache miss â€” prevents sync failure during Secrets Manager maintenance |
| **Concurrent sync race conditions** | Low | Medium | Implement distributed lock per connector_id + workspace_id using Redis â€” a new sync acquires the lock, existing sync releases it if it times out |

---

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| No real-time sync for polling-only APIs | Data freshness limited to sync interval (1-12h) | Use webhook-driven sync for critical connectors (Gmail push, GitHub webhooks) | Auto-generated webhook endpoints when provider adds webhook support |
| Webhook delivery is best-effort (at-least-once) | Duplicate events possible | Idempotency keys with 5min Redis TTL | Implement exactly-once processing with event sourcing and deduplication log |
| Rate limit consumed per-workspace, not per-user | One heavy workspace can degrade connector health for other workspaces | Per-workspace token bucket with weighted fair queuing | Dynamic rate limit distribution based on workspace activity history |
| Full sync is O(n) on item count | Large workspaces (100K+ items) take >15min for initial sync | Chunk sync in pages of 100, stream items to processing pipeline | Parallel full sync with partitioned page fetching and progress tracking |
| No connector plugin marketplace | Connectors must be developed and deployed by core team | Private connector registry with versioned manifests | Connector marketplace with third-party plugin SDK and sandbox certification |
| OAuth token lifetime varies per provider | Some providers issue short-lived tokens (1h) causing frequent refreshes | Preemptive refresh 5min before expiry | Token lifetime normalization layer that caches and refreshes through a unified interface |

---

<a id="future-improvements"></a>
## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| **Connector Plugin Marketplace** | High | High | Q1 2027 â€” Third-party developers can publish connectors through a certified plugin registry with sandbox testing and automated certification |
| **Connector Templates / Scaffolding** | High | Low | Q4 2026 â€” CLI tool (`Vaeloom connector:create`) that generates a complete connector project from a template â€” manifest, OAuth, sync, tests, CI |
| **Auto-Generated Connectors from OpenAPI specs** | Medium | High | Q2 2027 â€” Connector SDK generates a working connector from an OpenAPI 3.0 specification with configurable auth, sync, and rate limit parameters |
| **Dynamic Rate Limit Distribution** | Medium | Medium | Q1 2027 â€” Algorithm that distributes rate limit capacity across workspaces based on historical usage patterns, reducing per-connector quota waste |
| **Webhook Health Monitoring** | Medium | Low | Q4 2026 â€” Proactive webhook delivery monitoring â€” detect when provider stops sending events (webhook silence) and automatically fall back to polling |
| **Cross-Connector Data Correlation** | Low | High | Q3 2027 â€” Detect related items across connectors (e.g., a GitHub PR referenced in a Gmail thread) and create cross-connector memory links |
| **Connector Auto-Update** | Low | Medium | Q2 2027 â€” Connector SDK version management with automatic manifest updates and zero-downtime connector hot-swapping |

---

## Related Documents

- [`Backend/Connectors.md`](./Backend/Connectors.md) â€” Connector architecture, OAuth token lifecycle, sync execution, error handling
- [`Backend/Authentication.md`](./Backend/Authentication.md) â€” OAuth 2.0 flows, JWT, session management, token security
- [`Backend/Authorization.md`](./Backend/Authorization.md) â€” Permission model, scope enforcement, ABAC
- [`Architecture/Event-Architecture.md`](./Architecture/Event-Architecture.md) â€” Event bus, webhook ingestion, dead letter queue, event schema
- [`Developer_Experience/Developer-Guide.md`](./Developer_Experience/Developer-Guide.md) â€” Adding a new connector, project navigation
- [`Security/Encryption.md`](./Security/Encryption.md) â€” AES-256-GCM encryption, Secrets Manager integration
- [`Security/Security-Architecture.md`](./Security/Security-Architecture.md) â€” Overall security architecture, threat model
- [`Security/Audit-Logs.md`](./Security/Audit-Logs.md) â€” Audit logging requirements and retention
- [`Architecture/Microservices.md`](./Architecture/Microservices.md) â€” Microservice boundaries, connector isolation
- [`Operations/SLO.md`](./Operations/SLO.md) â€” Service level objectives for connector sync latency and availability
- [`Testing/Integration-Testing.md`](./Testing/Integration-Testing.md) â€” Integration testing patterns for connectors
- [`Vaeloom-Complete-Documentation.md`](./Vaeloom-Complete-Documentation.md) â€” Full product and system documentation
