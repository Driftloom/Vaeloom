# MVP-P08 — 05. SDK / Tool / MCP Contracts (DEL-MVP-P08-03)

> Owner: Developer Experience Lead · Re-run 2026-08-17. Existing:
> `sdk/typescript` (VaeloomClient, axios), `sdk/python`, `sdk/rest-api` (EMPTY),
> `connectors/mcp`, `plugins/`.

## 1. SDK contracts

| SDK                   | Contract                                                                       | Status  | Delta (P10–P12)                                                                     |
| --------------------- | ------------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------- |
| TS (`@vaeloom/sdk`)   | apiKey/accessToken/tenantId; `X-Tenant-Id`, `X-API-Key`; axios client (exists) | PARTIAL | add approval API + jobs polling + memory domains; typed per OpenAPI 3.1 (generated) |
| Python (`sdk/python`) | `VaeloomClient` (exists)                                                       | PARTIAL | same deltas; parity tests vs TS; async httpx                                        |
| `sdk/rest-api`        | **EMPTY** — no files                                                           | MISSING | ship static OpenAPI 3.1 + README at P11                                             |
| Shared types          | `packages/shared-types` (TS)                                                   | PARTIAL | sync MemoryType domains + approval DTOs                                             |

### SDK coverage gap analysis

| API Surface Area            | Endpoints | SDK Coverage | Gap     |
| --------------------------- | --------- | ------------ | ------- |
| Auth (login/signup/refresh) | 6         | 0            | FULL    |
| Memories (CRUD + search)    | 4         | 4 (basic)    | PARTIAL |
| Agents (CRUD + execute)     | 8         | 3            | LARGE   |
| Workspaces                  | 4         | 0            | FULL    |
| Approvals                   | 5         | 0            | FULL    |
| Gmail                       | 6         | 0            | FULL    |
| Documents                   | 2         | 0            | FULL    |
| Connectors                  | 5         | 0            | FULL    |
| Events                      | 3         | 0            | FULL    |
| Scheduler                   | 9         | 0            | FULL    |
| Consent/GDPR                | 6         | 0            | FULL    |
| Knowledge Graph             | 6         | 0            | FULL    |
| Search                      | 1         | 0            | FULL    |
| Notifications               | 5         | 0            | FULL    |
| Resumes                     | 3         | 0            | FULL    |
| Health                      | 3         | 1            | LARGE   |
| **Total**                   | **79**    | **8 (10%)**  | **90%** |

### SDK conventions (design delta)

| Convention            | Design                                                             |
| --------------------- | ------------------------------------------------------------------ |
| snake↔camel transform | `transformKeys()` pattern exists in `api.ts` and `api-client.ts`   |
| Error handling        | Typed errors matching RFC 9457; auto-retry on 429 with Retry-After |
| Idempotency           | Automatic `Idempotency-Key` on retry (UUID v4)                     |
| Pagination            | Cursor-based; `limit` + `cursor` params; `{items, next_cursor}`    |
| Auth                  | API key (`X-API-Key`) or access token (`Authorization: Bearer`)    |
| Tenant context        | `X-Tenant-Id` header (existing pattern)                            |
| Versioning            | SDKs track API minor versions; deprecation warnings on upgrades    |

## 2. Tool contracts (agent tools)

| Tool                                       | Contract                                           | Authz                               | Status      |
| ------------------------------------------ | -------------------------------------------------- | ----------------------------------- | ----------- |
| `memory.read`                              | query+domains+limit → hits w/ provenance           | workspace scope                     | IMPLEMENTED |
| `memory.write`                             | domain, content, source_ref → memory row (QA gate) | workspace scope; supersession-aware | PARTIAL     |
| `gmail.list_drafts` / `gmail.create_draft` | draft-only (DEC-P01-03)                            | per-connector OAuth                 | IMPLEMENTED |
| `gmail.extract_deadlines`                  | message set → deadline facts                       | workspace scope                     | MISSING     |
| `job.analyze`                              | JD url → extracted role/skills/deadline (FR-04)    | workspace scope                     | MISSING     |
| `ats.score`                                | resume+JD → score + rationale (FR-21/22)           | workspace scope                     | MISSING     |
| `approval.request`                         | proposal → approval_request                        | consequential only                  | IMPLEMENTED |
| `reminder.schedule`                        | ScheduleEvent                                      | workspace scope                     | PARTIAL     |

### Tool registry

- Allowlists per agent exist in orchestrator (`apps/api/src/api/agents/`)
- 21 agent implementations registered
- No tool may bypass approval for consequential action (P05 threat mapping)
- Tool execution audit logged via `audit_service.record_event()`

## 3. MCP contract (EXT-01 2026-07-28)

### Current state

| Component  | File                              | Status      |
| ---------- | --------------------------------- | ----------- |
| MCP client | `connectors/mcp/mcp.connector.ts` | IMPLEMENTED |
| Transport  | `connectors/mcp/transport.ts`     | IMPLEMENTED |
| Types      | `connectors/mcp/types.ts`         | IMPLEMENTED |
| Tests      | `connectors/mcp/__tests__/`       | EXISTS      |

### MVP role

- Vaeloom as MCP **client** (consume external MCP tools via the MCP connector)
- MCP **server** exposure deferred (enterprise)
- Pin: MCP 2026-07-28 profile
- Authorization per EXT-06 (OAuth 2.0 for MCP)
- Resource metadata per RFC 9728 where applicable
- Compatibility + deprecation tests at P12

### MCP tool schema (existing pattern)

```json
{
  "name": "tool_name",
  "description": "Tool description",
  "inputSchema": { "type": "object", "properties": {...} }
}
```

## 4. Plugin contracts (P0.2 sandbox)

### Current state

| Component         | File                         | Status      |
| ----------------- | ---------------------------- | ----------- |
| Plugin SDK (TS)   | `packages/plugin-sdk/`       | EXISTS      |
| Plugin manifests  | PluginManifest, capabilities | EXISTS      |
| Runtime isolation | Subprocess sandbox           | IMPLEMENTED |
| Official plugins  | `plugins/` (5 plugins)       | EXISTS      |

### Official plugins (MVP)

| Plugin        | Location                 | Status |
| ------------- | ------------------------ | ------ |
| sentiment     | `plugins/sentiment/`     | EXISTS |
| summarizer    | `plugins/summarizer/`    | EXISTS |
| translator    | `plugins/translator/`    | EXISTS |
| tag-generator | `plugins/tag-generator/` | EXISTS |
| word-count    | `plugins/word-count/`    | EXISTS |

### Plugin security contract

- Plugins ship **disabled** unless user-approved
- Plugin execution audited via `audit_service.record_event()`
- No plugin gains network-exfil or memory-write without tool allowlist (P05 §6)
- Subprocess isolation: CPU, memory, FD limits; temp dir per execution; no
  network by default
- Plugin boundary tests at P12 (P05 threat mapping)

## 5. Shared types (`packages/shared-types`)

### Current state

- TypeScript types used by `apps/web` for API communication
- `api.ts` and `api-client.ts` have `transformKeys()` for snake↔camel
- Memory, Agent, Workspace types exist but lag behind API schema

### Delta

- Sync `MemoryType` enum (22 types from `schemas/memory_types.py`)
- Add approval DTOs (ApprovalRequest, ApprovalDecision)
- Add job DTOs (Job, JobStatus)
- Add event DTOs (Event, EventSubscription)
