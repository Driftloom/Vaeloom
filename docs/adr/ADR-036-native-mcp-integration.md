# ADR-036: Native Python MCP Client Integration

Date: 2026-08-23 Status: Accepted Related: ADR-034 (document pipeline), ADR-035
(browser tools)

## Context

The product blueprint calls for connecting Vaeloom agents to external MCP (Model
Context Protocol) servers — browser automation, Postgres/pgvector semantic
queries, Google Workspace, Obsidian. The existing TS package (`connectors/mcp`)
was never wired into the Python API, and the external connector system
(`connector_ext_service`) only supported database/rest/graphql/file types.

## Decision

### 1. Official `mcp` SDK inside apps/api (not a TS sidecar)

`mcp>=2.0.0` resolves cleanly against the pinned FastAPI/Starlette stack (it
uses separate `httpx2/httpcore2` packages). A Node sidecar would add a runtime
dependency to backend ops for no capability gain. Both transports are used via
the SDK: `stdio_client` (subprocess servers) and `streamable_http_client`.

### 2. MCP servers are `mcp`-type external connectors

Reuses the full CRUD + tenant scoping + audit of `connector_ext_service`. Config
validation is fail-closed (`validate_mcp_config`):

- transport ∈ {stdio, http}
- stdio: command required; shell interpreters (bash/sh/powershell/cmd/pwsh)
  denied; argv list only; shell metacharacters rejected
- http: https enforced unless explicit dev-only `allow_insecure`
- `env` values are encrypted at rest per key

Update path now revalidates configs for **all** connector types (was
create-only).

### 3. One-shot sessions + TTL discovery cache

Each operation opens a fresh session (`initialize` → op → close) with a 10s
connect / 30s call budget. Discovery results cache per connector for 300s;
`refresh=true` or the `/mcp/tools/refresh` route bypasses it. No long-lived
child processes to reap.

### 4. Bridged tools join the executor's dynamic registry

Discovered tools register as `mcp__<ServerSlug>__<ToolSlug>`:

- scope `connector.mcp.execute`, category `connector_read` when the server hints
  readOnly else `connector_write` (+30s timeout override)
- handlers enforce workspace ownership of the connector **at call time**
- non-read-only names are added to `approval_gated_tools()` — the ReAct loop now
  consults that unified function instead of a hardcoded set
- ReAct offers bridged definitions alongside the agent's declared tools (bounded
  by the existing 12-tool cap)

Static-dispatch agent handlers are untouched; MCP tools are reachable through
ReAct and the operator REST proxy.

### 5. Admin surface on the existing connectors router

`GET /{id}/mcp/tools`, `POST /{id}/mcp/tools/refresh`, `POST /{id}/mcp/sync`
(discover+bridge), `POST /{id}/mcp/call` (operator invocation), and
`POST /{id}/test` routes through MCP health check. Startup warm-up re-syncs all
enabled connectors fire-and-forget so a reboot never silently drops bridges.

## Consequences

- In-memory discovery cache and bridge registry reset per process — warm-up
  covers restarts; multi-instance consistency would need shared state later.
- Quotas/approval semantics apply uniformly: MCP writes require approval just
  like native write tools.
- Seed configs documented in `docs/mcp/servers/seed-configs.md`.

## Verification

- 20 unit tests (validation matrix, slugify, discovery mapping + cache, bridge
  registration/gating, workspace enforcement, dynamic dispatch through
  `execute_tool` incl. scope denial)
- 10 integration tests (mcp CRUD w/ env encryption-at-rest, shell-command
  rejection, update revalidation, sync/call/test routes, non-mcp rejection)
