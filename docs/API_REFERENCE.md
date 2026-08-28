# Vaeloom API Reference

Base URL: `https://api.vaeloom.dev` (production) or `http://localhost:8000` (local)

Version: `0.2.0`

## Authentication

All API endpoints (except `/health`, `/auth/signup`, `/auth/login`) require authentication.

### Bearer Token (JWT)

```
Authorization: Bearer <access_token>
```

Obtain a token via `POST /api/v1/auth/signup` or `POST /api/v1/auth/login`.

**Token format**: JSON Web Token (JWT) with claims:
- `sub` — user UUID
- `email` — user email
- `tenant_id` — tenant UUID (null for personal accounts)
- `iat` — issued at timestamp
- `exp` — expiry timestamp (1 hour for access tokens, 30 days for refresh tokens)

### API Key

```
Authorization: Bearer <api_key>
```

API keys can be created in the dashboard for programmatic access.

### SSO Token

```json
POST /api/v1/auth/sso/{provider}
{ "token": "<id_token_from_provider>" }
```

## API Versioning

The API is versioned via URL prefix: `/api/v1/`. Breaking changes will increment the version (`/api/v2/`). Non-breaking additions (new fields, new endpoints) may be added to the current version.

Current version: **v1**

## Endpoint Groups

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe — returns `{"status":"ok"}` |
| GET | `/health/ready` | Readiness — checks DB + Redis connectivity |
| GET | `/health/startup` | Startup — checks DB + Redis + Infisical |
| GET | `/metrics` | Prometheus metrics |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/signup` | Register with email + password |
| POST | `/api/v1/auth/login` | Log in, returns access + refresh tokens |
| GET | `/api/v1/auth/me` | Get current user + workspaces |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/sso/{provider}` | SSO token login (google, microsoft) |
| GET | `/api/v1/auth/sso/{provider}` | Get SSO authorization URL |
| GET | `/api/v1/auth/sso/{provider}/callback` | SSO OAuth callback |

### Workspaces

Workspaces are the top-level organizational unit. All resources (agents, memories, documents, connectors) belong to a workspace.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/workspaces` | Create workspace |
| GET | `/api/v1/workspaces` | List user's workspaces |
| GET | `/api/v1/workspaces/{id}` | Get workspace details |
| PATCH | `/api/v1/workspaces/{id}` | Update workspace |
| DELETE | `/api/v1/workspaces/{id}` | Delete workspace |
| GET | `/api/v1/workspaces/{id}/agents` | List agents in workspace |
| GET | `/api/v1/workspaces/{id}/memories` | List memories in workspace |
| GET | `/api/v1/workspaces/{id}/connectors` | List connectors in workspace |

### Agents

Agents are AI workers with specific capabilities. Each agent has a system prompt, tool list, and execution history.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agents` | Register a new agent |
| GET | `/api/v1/agents` | List agents |
| GET | `/api/v1/agents/{id}` | Get agent details |
| PUT | `/api/v1/agents/{id}` | Update agent configuration |
| DELETE | `/api/v1/agents/{id}` | Deactivate agent |
| POST | `/api/v1/agents/chat` | Chat message (auto-routed to agent) |
| POST | `/api/v1/agents/{id}/execute` | Execute agent (supports SSE streaming) |
| POST | `/api/v1/agents/{id}/run` | Quick-run with input |
| GET | `/api/v1/agents/{id}/executions` | List execution history |
| POST | `/api/v1/agents/{id}/schedule` | Schedule recurring execution |

**Streaming**: Set `?stream=true` on `POST /execute` to receive Server-Sent Events (SSE). Each chunk is a JSON object with fields `content`, `tool_calls`, `status`.

### Memory

The persistent memory system. Memories are vector-indexed and searchable by semantic similarity.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/memories` | Create memory entry |
| GET | `/api/v1/memories` | List memories (paginated) |
| GET | `/api/v1/memories/{id}` | Get memory by ID |
| PUT | `/api/v1/memories/{id}` | Update memory |
| DELETE | `/api/v1/memories/{id}` | Delete memory |
| POST | `/api/v1/memories/search` | Semantic search over memories |

### Knowledge Graph

Entity-relationship graph for structured knowledge. Supports traversal and shortest-path queries.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/knowledge-graph/nodes` | Create a node |
| GET | `/api/v1/knowledge-graph/nodes` | List nodes (paginated, filterable) |
| GET | `/api/v1/knowledge-graph/nodes/{id}` | Get node |
| PUT | `/api/v1/knowledge-graph/nodes/{id}` | Update node |
| DELETE | `/api/v1/knowledge-graph/nodes/{id}` | Delete node |
| POST | `/api/v1/knowledge-graph/nodes/{id}/edges` | Create edge from node |
| GET | `/api/v1/knowledge-graph/nodes/{id}/edges` | List edges from node |
| GET | `/api/v1/knowledge-graph/edges` | List all edges |
| DELETE | `/api/v1/knowledge-graph/edges/{id}` | Delete edge |
| POST | `/api/v1/knowledge-graph/traverse` | Traverse graph (BFS/DFS, max depth configurable) |
| GET | `/api/v1/knowledge-graph/path` | Find shortest path between two nodes |

### Search

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/search` | Hybrid search across all sources |

Supports: full-text keyword search, vector similarity search, knowledge graph traversal. Returns ranked results with relevance scores.

### Documents

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/documents` | Upload document (multipart form) |
| GET | `/api/v1/documents` | List documents in workspace |

Supported formats: PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, images (OCR).

### Resumes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/resumes` | List resumes |
| GET | `/api/v1/resumes/master` | Get master resume |
| POST | `/api/v1/resumes/{id}/generate` | Generate resume variant |

### Applications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/workspaces/{wid}/applications` | List applications |
| POST | `/api/v1/workspaces/{wid}/applications` | Create application |
| GET | `/api/v1/workspaces/{wid}/applications/{id}` | Get application |
| PATCH | `/api/v1/workspaces/{wid}/applications/{id}/outcome` | Update outcome |

### Integrations

External service integrations (Gmail, Google Calendar, GitHub, etc.).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/integrations` | Create integration |
| GET | `/api/v1/integrations` | List user integrations |
| PUT | `/api/v1/integrations/{id}` | Update integration |
| DELETE | `/api/v1/integrations/{id}` | Delete integration |
| POST | `/api/v1/integrations/{id}/sync` | Trigger full sync |

### Connectors

MCP-compatible connectors for external data sources.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/connectors` | Create connector |
| GET | `/api/v1/connectors` | List connectors |
| GET | `/api/v1/connectors/{id}` | Get connector details |
| PUT | `/api/v1/connectors/{id}` | Update connector |
| DELETE | `/api/v1/connectors/{id}` | Delete connector |
| POST | `/api/v1/connectors/{id}/sync` | Trigger sync |
| GET | `/api/v1/connectors/{id}/sync/status` | Get sync status |
| POST | `/api/v1/connectors/{id}/test` | Test connection |

### Scheduler

CRON-based job scheduling for recurring agent executions.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/scheduler/jobs` | Create scheduled job |
| GET | `/api/v1/scheduler/jobs` | List jobs |
| GET | `/api/v1/scheduler/jobs/{id}` | Get job details |
| PATCH | `/api/v1/scheduler/jobs/{id}` | Update job |
| DELETE | `/api/v1/scheduler/jobs/{id}` | Delete job |
| POST | `/api/v1/scheduler/jobs/{id}/pause` | Pause job |
| POST | `/api/v1/scheduler/jobs/{id}/resume` | Resume job |
| POST | `/api/v1/scheduler/jobs/{id}/trigger` | Trigger immediate execution |
| GET | `/api/v1/scheduler/jobs/{id}/executions` | List executions |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/notifications/send` | Send notification |
| GET | `/api/v1/notifications` | List notifications |
| GET | `/api/v1/notifications/{id}` | Get notification |
| POST | `/api/v1/notifications/templates` | Create template |
| GET | `/api/v1/notifications/templates` | List templates |
| POST | `/api/v1/notifications/subscribe` | Subscribe to channel |

### Events

Event publishing and subscription for internal event-driven communication.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/events` | Publish event |
| GET | `/api/v1/events` | List events |
| POST | `/api/v1/events/subscriptions` | Create subscription |
| GET | `/api/v1/events/subscriptions` | List subscriptions |

### Billing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/billing/usage` | Get usage records |
| GET | `/api/v1/billing/subscription` | Get current subscription |
| POST | `/api/v1/billing/subscription` | Create/update subscription |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analytics` | Dashboard with KPIs + usage |
| GET | `/api/v1/analytics/usage` | Usage time series |
| GET | `/api/v1/analytics/metrics` | KPI summary |
| POST | `/api/v1/analytics/events` | Track event |
| POST | `/api/v1/analytics/aggregate` | Trigger aggregation |

### Audit

Immutable audit log for compliance. Every agent action and user operation is recorded.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/audit/events` | Record audit event |
| GET | `/api/v1/audit/events` | Query events (filterable) |
| GET | `/api/v1/audit/events/{id}` | Get event |
| POST | `/api/v1/audit/export` | Export events (JSON/CSV) |
| GET | `/api/v1/audit/compliance/report` | Generate compliance report |

### IAM

Identity and Access Management for enterprise multi-tenant deployments.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/iam/users` | Create user |
| GET | `/api/v1/iam/users` | List users (tenant-scoped) |
| GET | `/api/v1/iam/users/{id}` | Get user |
| PUT | `/api/v1/iam/users/{id}` | Update user |
| DELETE | `/api/v1/iam/users/{id}` | Deactivate user |
| POST | `/api/v1/iam/users/{id}/roles` | Assign roles |
| DELETE | `/api/v1/iam/users/{id}/roles/{rid}` | Remove role |
| GET | `/api/v1/iam/users/{id}/permissions` | Get effective permissions |

### Plugins

Third-party plugin management with sandboxed execution.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/plugins` | Register plugin |
| GET | `/api/v1/plugins` | List plugins |
| GET | `/api/v1/plugins/{id}` | Get plugin details |
| PUT | `/api/v1/plugins/{id}` | Update plugin |
| DELETE | `/api/v1/plugins/{id}` | Delete plugin |
| POST | `/api/v1/plugins/{id}/execute` | Execute plugin |
| GET | `/api/v1/plugins/{id}/permissions` | Get permissions |
| GET | `/api/v1/plugins/{id}/executions` | List executions |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/chat/workspaces/{wid}/chat` | Send chat message |

### Recommendations

AI-powered recommendations for jobs, skills, and actions.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/recommendations` | Generate recommendations |
| GET | `/api/v1/recommendations/{user_id}` | Get user recommendations |
| POST | `/api/v1/recommendations/feedback` | Record feedback |
| GET | `/api/v1/recommendations/trending` | Get trending items |
| POST | `/api/v1/recommendations/index` | Rebuild index |

## Error Format

All errors return a consistent JSON structure:

```json
{
  "detail": "Human-readable error message",
  "status_code": 400
}
```

For validation errors:

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error"
    }
  ],
  "status_code": 422
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No content (successful delete) |
| 400 | Bad request (validation error) |
| 401 | Unauthenticated (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 422 | Validation error |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Rate Limiting

- **Default**: 100 requests per 60 seconds per client IP
- **Burst**: Up to 10 requests above the limit before 429 is returned
- **Headers**:
 - `X-RateLimit-Limit`: maximum requests per window
 - `X-RateLimit-Remaining`: remaining requests in current window
 - `X-RateLimit-Reset`: Unix timestamp when the window resets
- **429 Response**: Includes `Retry-After` header (seconds until retry)
- **Per-agent rate limits**: Separate counters for agent execution endpoints

## Pagination

List endpoints support cursor or offset-based pagination:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `page_size` | integer | 20 | Items per page (max 100) |

Response format:

```json
{
  "items": [...],
  "total": 142,
  "page": 1,
  "page_size": 20
}
```

Some endpoints use `"memories"`, `"agents"`, `"plugins"` instead of `"items"` as the key — check the specific endpoint schema.

## Common Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | For protected routes | `Bearer <token>` |
| `Content-Type` | For POST/PUT/PATCH | `application/json` (or `multipart/form-data` for uploads) |
| `X-Request-ID` | Optional | Idempotency key for safe retries |
| `X-Correlation-ID` | Optional | Client-generated trace ID |

## Common Response Headers

| Header | Description |
|--------|-------------|
| `X-Request-ID` | Echoed from request, or server-generated |
| `X-Correlation-ID` | Echoed from request, or server-generated |
| `X-RateLimit-*` | Rate limiting status |
| `X-Response-Time` | Server processing time in milliseconds |

## WebSocket Endpoints

WebSocket support is available for real-time agent streaming (future). Current streaming uses SSE over HTTP: `POST /api/v1/agents/{id}/execute?stream=true`.
