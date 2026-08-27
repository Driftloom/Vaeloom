# ADR-037: Hybrid Integration Framework (Native Core + MCP Long-Tail + Pluggable Providers)

| Metadata     | Value                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------- |
| **Status**   | Accepted                                                                                           |
| **Date**     | 2026-08-27                                                                                         |
| **Deciders** | Engineering Team                                                                                   |
| **Related**  | ADR-009 (monorepo), ADR-010 (MCP connectors), ADR-036 (native MCP), ADR-030 (credential isolation) |

## Context

Vaeloom needs to integrate with dozens of external services for agents to be
useful (calendar, email, drive, GitHub, job boards, Outlook/Microsoft 365,
OneDrive, Slack, Notion …). The six TS packages under `integrations/*`
(calendar, email, github, google-drive, notion, slack) are fully written (~380
lines each, OAuth + CRUD + webhooks) but have **zero consumers** — nothing
imports them, they use in-memory state, and `sync()` is a no-op.
`connectors/mcp` (TS) was already superseded by the native Python MCP SDK per
ADR-036.

Static tool definitions have grown to 31 entries in `tools/definitions.py` with
a 2k-line executor; adding each integration as bespoke `ToolDefinition` +
`_execute_*` pair does not scale. At the same time, not every integration should
be an MCP server — core job-hunt flows (Gmail, Calendar, Drive, GitHub,
Greenhouse/Lever) need offline-mockable, version-pinned native code.

## Decision

### 1. Hybrid architecture

- **Native Python core** — job-critical integrations live as Python clients
  (`clients/*.py`) + executor handlers + tool definitions. Mock-safe offline,
  least-privilege scopes, version-pinned.
- **MCP long-tail** — everything else via custom MCP servers bridged as
  `mcp__<Server>__<Tool>` (ADR-036). One connector per server, approval-gated
  unless `readOnlyHint`.
- **Pluggable provider framework** — a uniform `IntegrationProvider` protocol so
  the 2nd, 3rd, … Nth integration is one folder, not a bespoke fork.

### 2. Provider registry

New package `apps/api/src/api/integrations/`:

```python
class IntegrationProvider(Protocol):
    id: str                        # "greenhouse", "outlook", "github" …
    display_name: str
    scopes: list[str]
    def tool_definitions(self) -> list[ToolDefinition]: ...
    async def handle(self, tool: str, params: dict, workspace_id: str) -> dict: ...
    def validate_config(self, config: dict) -> None: ...
```

- Each provider = one folder `integrations/providers/<id>/`.
- At startup `integrations/registry.py` discovers providers and registers their
  `ToolDefinition`s into the executor's dynamic registry (same path as MCP
  bridging, uniform `approval_gated_tools()` handling).
- Adding integration N+1 = drop a folder + env vars.

Providers shipped in this ADR: `drive`, `github`, `greenhouse`, `lever`,
`jobs_board` (aggregator), `graph_mail` (Outlook), `graph_calendar`, `onedrive`.

### 3. MCP HTTP `headers` (encrypted per-key)

ADR-036 only encrypted `env` for stdio transports; HTTP transports had no auth.
Hosted MCP servers (official GitHub at `api.githubcopilot.com/mcp`, Linear,
Notion hosted) require `Authorization: Bearer <PAT>` **as HTTP headers**, not
env vars.

- `mcp` connector config gains optional `headers: Record<string,string>`
  alongside `env`.
- Each value Fernet-encrypted at rest per-key (same scheme as `env`).
- Validated in `validate_mcp_config`, decrypted in `get_decrypted`, forwarded as
  `streamable_http_client(url, headers=...)`.
- Fail-closed: non-string values rejected, value size bounded (same 20k budget).

Seed configs doc updated to reflect `headers` and correct GitHub example to use
`headers.Authorization`.

### 4. Real `sync()` + authenticated `test_connection`

`connector_ext_service.trigger_sync` was a timestamp-only stub. Now:

- `rest`/`graphql` — authenticated GET/POST with
  `authToken`/`apiKey`/`headers.Authorization`, follows redirect guard, persists
  minimal ingest stub to memory store.
- `database` — validates DSN format; live connect deferred to provider
  (fail-closed).
- `file` — stats path.
- `mcp` — delegates to `mcp_client_service.list_tools(refresh=True)`.
- `test_connection` for `rest`/`graphql` sends the same authenticated request
  (was unauthenticated plain GET).

### 5. Native GitHub expansion (least-privilege)

From 2 tools (`fetch_github_repo`, `create_github_issue`) to 7:

- `search_github_repos`, `get_github_profile`, `list_github_issues`,
  `read_github_file`, `create_github_pull_request` added.
- Creds resolved as: per-workspace connector `token_ref` (preferred, ADR-030
  direction) → fallback `GITHUB_TOKEN`/`GITHUB_API_KEY` env. Scopes documented
  as `repo, read:user` minimal.

### 6. Legacy TS archive

`integrations/{calendar,email,github,google-drive,notion,slack}` and
`connectors/mcp` move to `archive/integrations-legacy-ts/` and
`archive/connectors-mcp-ts/` respectively, with `README.md` noting supersession
by this ADR + ADR-036. pnpm workspace entries retained until a monorepo-cleanup
ADR removes them.

## Alternatives Considered

- **All-MCP**: would make even core flows depend on third-party server
  availability; rejected for offline testability and version pinning.
- **Revive TS packages directly**: would reintroduce an in-memory Node sidecar
  with no persistence; rejected in favor of Python persistence + RLS.

## Consequences

- Tool surface grows from 31 to ~49 static definitions (plus dynamic MCP),
  covered by the same executor audit/timeout/approval model.
- Connector lifecycle is uniform across native + MCP (CRUD + `test` + `sync`).
- Offline tests stay green: every provider returns deterministic mock data when
  creds absent.
- Future integrations follow the provider protocol — one folder PR.

## Verification

- Doc: `docs/integrations/integration-matrix.md` is the single source of truth.
- Unit tests: per-provider validation + encryption round-trip + executor
  mock-safe paths.
- Integration tests: connector CRUD with encrypted `env`/`headers`, sync/test
  for each type, MCP http-headers bridging e2e, GitHub tool mock/live switch.
