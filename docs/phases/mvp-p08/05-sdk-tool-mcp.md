# MVP-P08 — 05. SDK / Tool / MCP Contracts (DEL-MVP-P08-03)

> Owner: Developer Experience Lead · Existing: `sdk/typescript` (VaeloomClient,
> axios), `sdk/python`, `sdk/rest-api` (EMPTY), `connectors/mcp`, `plugins/`.

## 1. SDK contracts

| SDK                   | Contract                                                                       | Delta (P10–P12)                                                                     |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| TS (`@vaeloom/sdk`)   | apiKey/accessToken/tenantId; `X-Tenant-Id`, `X-API-Key`; axios client (exists) | add approval API + jobs polling + memory domains; typed per OpenAPI 3.1 (generated) |
| Python (`sdk/python`) | `VaeloomClient` (exists)                                                       | same deltas; parity tests vs TS                                                     |
| `sdk/rest-api`        | **EMPTY** — no files                                                           | ship static OpenAPI 3.1 + README at P11 (CF: mark as spec only, not new runtime)    |
| Shared types          | `packages/shared-types` (TS)                                                   | sync MemoryType domains + approval DTOs                                             |

- SDK conventions: same transformKeys() snake↔camel handling (repo pattern),
  typed errors (RFC 9457), automatic `Idempotency-Key` on retries.

## 2. Tool contracts (agent tools)

| Tool                                       | Contract                                           | Authz                               |
| ------------------------------------------ | -------------------------------------------------- | ----------------------------------- |
| `memory.read`                              | query+domains+limit → hits w/ provenance           | workspace scope                     |
| `memory.write`                             | domain, content, source_ref → memory row (QA gate) | workspace scope; supersession-aware |
| `gmail.list_drafts` / `gmail.create_draft` | draft-only (DEC-P01-03)                            | per-connector OAuth                 |
| `gmail.extract_deadlines`                  | message set → deadline facts                       | workspace scope                     |
| `job.analyze`                              | JD url → extracted role/skills/deadline (FR-04)    | workspace scope                     |
| `ats.score`                                | resume+JD → score + rationale (FR-21/22)           | workspace scope                     |
| `approval.request`                         | proposal → approval_request                        | consequential only                  |
| `reminder.schedule`                        | ScheduleEvent                                      | workspace scope                     |

- Tool registry: allowlists per agent (exists in orchestrator); no tool may
  bypass approval for consequential action (P05 threat mapping).

## 3. MCP contract (EXT-01 2026-07-28)

- `connectors/mcp` exists (client transport/types). MVP role: Vaeloom as MCP
  **client** (consume external MCP tools via the MCP connector) and server
  exposure deferred (enterprise).
- Pin: MCP 2026-07-28 profile; authorization per EXT-06 (OAuth 2.0 for MCP);
  resource metadata per RFC 9728 where applicable; compatibility + deprecation
  tests at P12; version recorded.

## 4. Plugin contracts (P0.2 sandbox)

- `plugin-sdk` (TS): PluginManifest, capabilities/hooks types (exist); runtime
  isolation = subprocess sandbox (P0.2).
- MVP: official plugins (sentiment, summarizer, translator, tag-generator,
  word-count) ship disabled unless user-approved; plugin execution audited; no
  plugin gains network-exfil or memory-write without tool allowlist (P05 §6, P12
  boundary tests).
