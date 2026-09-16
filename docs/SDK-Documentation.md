# Vaeloom SDK Documentation

> **Purpose:** SDK installation, usage, and method reference for the Vaeloom
> platform **Status:** Rewritten to match code (2026-09-15) **Owner:**
> Engineering Team **Last Updated:** 2026-09-15 **Version:** 0.1.0

| Metadata         | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| **Purpose**      | SDK installation, usage, and method reference for the Vaeloom platform |
| **Status**       | Code-truth (all methods verified against `sdk/` source)                |
| **Owner**        | Engineering Team                                                       |
| **Last Updated** | 2026-09-15                                                             |
| **Version**      | 0.1.0                                                                  |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Packages](#2-packages)
3. [Installation](#3-installation)
4. [Authentication](#4-authentication)
5. [TypeScript SDK Reference](#5-typescript-sdk-reference)
6. [Python SDK Reference](#6-python-sdk-reference)
7. [Shared Types](#7-shared-types)
8. [Error Handling](#8-error-handling)
9. [Examples](#9-examples)
10. [Roadmap (NOT Implemented)](#10-roadmap-not-implemented)
11. [Best Practices](#11-best-practices)
12. [Related Documents](#12-related-documents)

---

## 1. Overview

The **Vaeloom SDK** (v0.1.0) is a thin, memory-first API client. It wraps HTTP
transport (axios in TypeScript, sync httpx in Python), injects auth headers, and
exposes typed helpers for memory CRUD, agent listing/execution (TS only), and
health checks.

**Audience:** Backend engineers and integrators calling the Vaeloom REST API
(`POST /api/v1/memory`, `/api/v1/memory/search`, `/api/v1/agents`, ...).

**What it is NOT (yet):** there is no fluent query builder, no generic entity
CRUD (`entity()`), no `agent().runAndWait()`, no `tasks()` handle, no batch
helpers, no streaming/cursor pagination, no OAuth/PKCE flow, no retry policy, no
response cache, and no `MockTransport`. Any doc or example claiming those
describes the roadmap, not this release. See
[section 10](#10-roadmap-not-implemented).

```mermaid
graph TD
  APP[Your Application] --> TS[@vaeloom/sdk<br/>VaeloomClient - axios]
  APP --> PY[vaeloom - VaeloomClient<br/>sync httpx]
  TS --> API[REST API Gateway<br/>/api/v1 + /health]
  PY --> API
```

---

## 2. Packages

| Package           | Location                | Version                                     | Transport                                                  | Import                                                |
| ----------------- | ----------------------- | ------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| TypeScript        | `sdk/typescript`        | `@vaeloom/sdk@0.1.0`                        | axios (`^1.7.0`), 30s timeout                              | `import { VaeloomClient } from "@vaeloom/sdk"`        |
| Python            | `sdk/python`            | `vaeloom-sdk 0.1.0` ( imports as `vaeloom`) | sync `httpx` (`>=0.27.0`) + `pydantic>=2.7.0`, 30s timeout | `from vaeloom import VaeloomClient`                   |
| Shared types (TS) | `packages/shared-types` | `@vaeloom/shared-types@0.1.0`               | types only, no runtime                                     | `import type { Memory } from "@vaeloom/shared-types"` |

Notes:

- Shared types live in **`packages/shared-types`**, not `packages/sdk-types`
  (that package does not exist). The SDKs define their own small copies
  (`sdk/typescript/src/types.ts`, `sdk/python/src/vaeloom/models.py`).
- The Python SDK is **synchronous** (plain `httpx.Client`, regular `def`
  methods). There is no async client and no `execute_agent` method.
- Both SDKs default to `baseUrl/base_url = "https://api.vaeloom.dev"`. Point at
  local dev with `http://localhost:8000`.

---

## 3. Installation

### 3.1 TypeScript SDK

```bash
pnpm add @vaeloom/sdk@0.1.0
```

Source layout (`sdk/typescript/src/`): `client.ts` (`VaeloomClient` +
`VaeloomClientConfig`), `types.ts` (`Memory`, `MemoryQuery`,
`MemoryQueryFilter`, `MemoryType`, `Agent`, `AgentExecution`, `AgentConfig`,
`User`, `Tenant`, `Workspace`, `PaginatedResponse`, `ApiError`, `MemoryStatus`,
`AgentStatus`), `index.ts` (barrel exports).

### 3.2 Python SDK

```bash
pip install vaeloom-sdk==0.1.0
# Python >=3.12 required
```

Source layout (`sdk/python/src/vaeloom/`): `client.py` (`VaeloomClient`),
`models.py` (`Memory`, `Agent`, `MemoryQuery`, `MemoryQueryFilter`,
`MemoryType`, `MemoryStatus`, `AgentStatus`, `PaginationMeta`,
`PaginatedResponse`), `__init__.py` (exports `VaeloomClient`, `Memory`, `Agent`,
`MemoryQuery`, `PaginatedResponse`).

### 3.3 Verifying Installation

```typescript
import { VaeloomClient } from '@vaeloom/sdk';
const client = new VaeloomClient({ baseUrl: 'http://localhost:8000' });
console.log(await client.healthCheck());
```

```python
from vaeloom import VaeloomClient
client = VaeloomClient(base_url="http://localhost:8000")
print(client.health_check())
```

---

## 4. Authentication

Both SDKs accept a static API key and/or a pre-obtained bearer token, plus an
optional tenant header. There is no OAuth flow, no token refresh, and no
credential caching in v0.1.0.

```typescript
const client = new VaeloomClient({
  apiKey: process.env.VAELOOM_API_KEY, // -> X-API-Key
  accessToken: process.env.VAELOOM_TOKEN, // -> Authorization: Bearer
  tenantId: process.env.VAELOOM_TENANT_ID, // -> X-Tenant-Id
  baseUrl: 'https://api.vaeloom.dev',
});
```

```python
client = VaeloomClient(
    api_key=os.environ["VAELOOM_API_KEY"],       # -> X-API-Key
    access_token=os.environ.get("VAELOOM_TOKEN"),  # -> Authorization: Bearer
    tenant_id=os.environ.get("VAELOOM_TENANT_ID"), # -> X-Tenant-Id
    base_url="https://api.vaeloom.dev",
    timeout=30,
)
```

| Config key (TS / Python)       | Header                      | Required                               |
| ------------------------------ | --------------------------- | -------------------------------------- |
| `apiKey` / `api_key`           | `X-API-Key`                 | Conditional (or access token)          |
| `accessToken` / `access_token` | `Authorization: Bearer ...` | Conditional (or API key)               |
| `tenantId` / `tenant_id`       | `X-Tenant-Id`               | No                                     |
| `baseUrl` / `base_url`         | (base URL)                  | No (default `https://api.vaeloom.dev`) |

Never hardcode keys. Use environment variables or a secrets manager.

---

## 5. TypeScript SDK Reference

Client: `sdk/typescript/src/client.ts` (`VaeloomClient`, axios-backed). This is
the COMPLETE method list — nothing else exists on the client.

### Memory

```typescript
// POST /api/v1/memory — returns the created Memory
const mem = await client.createMemory({
  title: 'Q4 notes',
  type: 'note',
  tags: ['finance'],
});

// GET /api/v1/memory/{id} — returns response.data
const one = await client.getMemory(mem.id);

// POST /api/v1/memory/search — { query, filters?, limit?, offset?, minScore? }
const page = await client.searchMemories({
  query: 'Q4 revenue',
  limit: 10,
  offset: 0,
});
// page: { data: Memory[], meta: { page, pageSize, total, totalPages, hasNext, hasPrevious } }

// DELETE /api/v1/memory/{id}
await client.deleteMemory(mem.id);
```

Filter shape (`MemoryQueryFilter`):
`{ types?: MemoryType[], tags?: string[], dateFrom?: string, dateTo?: string }`
where `MemoryType` is
`document | email | code | note | conversation | webpage | structured`.

### Agents

```typescript
// GET /api/v1/agents — returns response.data
const agents: Agent[] = await client.listAgents();

// POST /api/v1/agents/{agentId}/execute — returns the execution record
const exec: AgentExecution = await client.executeAgent(agent.id, {
  documentId: 'doc_1',
});

// GET /api/v1/agents/{agentId} — returns response.data
const agent: Agent = await client.getAgentStatus(agent.id);
```

### Health and raw requests

```typescript
// GET /health — returns data.status
const status: string = await client.healthCheck();

// Escape hatch for endpoints the SDK does not wrap (axios passthrough)
const res = await client.request<{ ok: boolean }>({
  method: 'GET',
  url: '/api/v1/workspaces',
});
```

---

## 6. Python SDK Reference

Client: `sdk/python/src/vaeloom/client.py` (`VaeloomClient`, sync httpx). This
is the COMPLETE method list — note there is **no** `execute_agent`, no
`get_agent_status`, no `delete_memory`, and no generic `request()`.

```python
from vaeloom import VaeloomClient, MemoryQuery

client = VaeloomClient(api_key="...", base_url="http://localhost:8000")

# POST /api/v1/memory -> Memory (pydantic model)
mem = client.create_memory({"title": "Q4 notes", "type": "note", "tags": ["finance"]})

# GET /api/v1/memory/{id} -> Memory
one = client.get_memory(str(mem.id))

# POST /api/v1/memory/search -> PaginatedResponse[Memory]
page = client.search_memories(MemoryQuery(query="Q4 revenue", limit=10, offset=0))

# GET /api/v1/agents -> list[Agent]
agents = client.list_agents()

# GET /health -> str
status = client.health_check()
```

Python models use snake_case fields (`created_at`, `tenant_id`, `date_from`,
`min_score`) mirroring the backend schema. The TS SDK uses camelCase
(`createdAt`, `tenantId`) per its own `types.ts`.

---

## 7. Shared Types

Canonical shared types live in **`packages/shared-types`**
(`@vaeloom/shared-types`), re-exported from `src/index.ts`:

`types/domain`, `types/memory`, `types/agent`, `types/event`, `types/api`,
`types/auth`, `types/auth-dto`, `types/workspace`, `types/tenant`,
`types/connector`.

The frontend imports these (`apps/web/src/lib/api.ts`, `api-client.ts`). The
SDKs do NOT depend on this package today — they carry their own minimal
`Memory`/`Agent` copies. Unify on `@vaeloom/shared-types` when the SDKs next
rev.

```typescript
import type { Memory, Agent, PaginatedResponse } from '@vaeloom/shared-types';
```

---

## 8. Error Handling

Both SDKs classify only three HTTP statuses; everything else propagates as the
transport's native error (axios error / `httpx.HTTPStatusError`).

| Status | TypeScript (`client.ts` interceptor) | Python (`_request`)                        |
| ------ | ------------------------------------ | ------------------------------------------ |
| 401    | `Error("Authentication failed")`     | `PermissionError("Authentication failed")` |
| 403    | `Error("Permission denied")`         | `PermissionError("Permission denied")`     |
| 429    | `Error("Rate limit exceeded")`       | `Exception("Rate limit exceeded")`         |

```typescript
try {
  await client.getMemory('missing-id');
} catch (err) {
  // axios error passthrough except 401/403/429 above
  console.error(err);
}
```

```python
try:
    client.get_memory("missing-id")
except PermissionError:
    print("bad credentials")
except Exception as e:  # httpx.HTTPStatusError and others
    print("request failed:", e)
```

There is no built-in retry, backoff, timeout override (beyond the 30s default),
or typed error hierarchy in v0.1.0. Implement retries in your own code if you
need them.

---

## 9. Examples

### 9.1 TypeScript: index a memory, search it back, run an agent

```typescript
import { VaeloomClient } from '@vaeloom/sdk';

const client = new VaeloomClient({
  apiKey: process.env.VAELOOM_API_KEY,
  baseUrl: process.env.VAELOOM_BASE_URL ?? 'https://api.vaeloom.dev',
});

const mem = await client.createMemory({ title: 'Q4 notes', type: 'note' });
const hits = await client.searchMemories({ query: 'Q4', limit: 5 });
const agents = await client.listAgents();
if (agents.length > 0) {
  await client.executeAgent(agents[0].id, { memoryId: mem.id });
}
await client.deleteMemory(mem.id);
```

### 9.2 Python: index a memory and search it back

```python
import os
from vaeloom import VaeloomClient, MemoryQuery

client = VaeloomClient(
    api_key=os.environ["VAELOOM_API_KEY"],
    base_url=os.getenv("VAELOOM_BASE_URL", "https://api.vaeloom.dev"),
)

mem = client.create_memory({"title": "Q4 notes", "type": "note"})
hits = client.search_memories(MemoryQuery(query="Q4", limit=5))
print(hits.meta.total, [m.title for m in hits.data])
```

---

## 10. Roadmap (NOT Implemented)

The following appeared in earlier drafts of this document but do NOT exist in
code. Do not use them; track them as future work.

| Claimed feature                                                                                                | Reality in v0.1.0                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Fluent query builder (`.query().filter().sort().page()`) with `eq/ne/gt/inList/contains` operators             | NOT implemented — `searchMemories` takes a plain `MemoryQuery` object                                                                       |
| Generic entity CRUD (`client.entity("documents").create/get/list/update/delete`)                               | NOT implemented — only memory endpoints are wrapped                                                                                         |
| `agent().run()` / `runAndWait()` with `pollIntervalMs`/`timeoutMs`, webhooks                                   | NOT implemented — TS has one-shot `executeAgent` only; Python has none                                                                      |
| `client.tasks().get/cancel()`                                                                                  | NOT implemented — no `tasks()` handle exists                                                                                                |
| Batch operations (`.batch([...])`, 100 ops)                                                                    | NOT implemented                                                                                                                             |
| Cursor pagination (`.cursor()`) / streaming (`.stream()`)                                                      | NOT implemented — offset pagination via `limit`/`offset` only                                                                               |
| OAuth2 / PKCE / token refresh (`client.auth.refresh()`)                                                        | NOT implemented — static key/token headers only                                                                                             |
| Retry policy / backoff / `maxRetries` / `requestTimeoutMs`                                                     | NOT implemented — fixed 30s timeout, no retries                                                                                             |
| Response cache (`cache: { ttlMs, maxEntries }`)                                                                | NOT implemented                                                                                                                             |
| `MockTransport` / `@vaeloom/sdk-ts/testing`                                                                    | NOT implemented — no test transport exists                                                                                                  |
| Request metrics / `client.on("metric")` / tracing hooks                                                        | NOT implemented                                                                                                                             |
| Package names `@vaeloom/sdk-ts` / `Vaeloom-sdk-py`, `packages/sdk-ts`, `packages/sdk-py`, `@vaeloom/sdk-types` | FICTION — real names are `@vaeloom/sdk` (`sdk/typescript`), `vaeloom-sdk` (`sdk/python`), `@vaeloom/shared-types` (`packages/shared-types`) |

---

## 11. Best Practices

1. Create one client per process and reuse it (connection pooling).
2. Keep credentials in env vars or a secrets manager; never commit them.
3. Send `snake_case` fields to Python-model endpoints; the TS `MemoryQuery` uses
   camelCase (`minScore`, `dateFrom`) per `sdk/typescript/src/types.ts` — match
   the SDK you import, not the other one.
4. Wrap calls in try/catch — only 401/403/429 are classified; the rest surface
   as transport errors.
5. Use `request()` (TS) only for unwrapped endpoints; prefer the typed helpers
   so call sites keep working when the SDK grows.

---

## 12. Related Documents

| Document            | Description                   | Location                          |
| ------------------- | ----------------------------- | --------------------------------- |
| API Reference       | REST endpoints the SDKs wrap  | `docs/backend/API-Reference.md`   |
| OpenAPI spec        | Machine-readable contract     | `docs/backend/openapi.yaml`       |
| TS SDK README       | Install + 5-line example      | `sdk/typescript/README.md`        |
| Python SDK README   | Install + 5-line example      | `sdk/python/README.md`            |
| Shared types README | `@vaeloom/shared-types` usage | `packages/shared-types/README.md` |
| UI kit README       | `@vaeloom/ui-kit` usage       | `packages/ui-kit/README.md`       |
