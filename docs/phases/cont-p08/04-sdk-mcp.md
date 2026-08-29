# CONT-P08 — 04 SDK / Tool / MCP Contracts

**Deliverable:** `DEL-CONT-P08-03` | **Version:** 1.0 | **Date:** 2026-08-29

## Tool Contracts

- `ALL_TOOLS 49 +1 alias` (`tools/definitions.py:933`) + dynamic
  `mcp__<srv>__<tool>` (`executor.py:92` `DYNAMIC_TOOL_DEFS`) — category
  `memory_read 2s` `memory_write 2s` `connector_read 5s` `connector_write 10s`
  `system 1s` + `TOOL_TIMEOUT_OVERRIDES browse 45s`.
- `readOnlyHint==false` → `approval_gated` dynamically (`executor.py:98`),
  `mark_approval_gated` at `mcp/tools/refresh`.

## MCP 2026-07-28

- Version-pinned `mcp>=2.0` `pyproject 46`, `stdio/http`
  (`connector_ext_service` `env allowlist`, `headers token verify`), 300s
  discovery TTL `mcp__<Server>__<Tool>` with `scope connector.mcp.execute`,
  `MAX_ARGS_CHARS 20k`.
- `mcp/tools|refresh|sync|call` `routers/connectors.py` +
  `services/mcp_client_service` metachar deny `sh|bash…`.

## SDK

- `sdk/typescript` `api-client.ts` `transformKeys` `snake↔camel`, typed
  `agentApi/mcpApi` (`lib/api-client.ts` 2191 LOC vs `api.ts` `transformKeys`
  parity).
- Additive `v1` `tolerant readers` —
  `graph/contracts RoutingDecision/Handoff/Eval v1` never breaks `openapi 110`.

---

_Version 1.0 2026-08-29 — `rg "mcp__" 0` until discovery, `discovery 300s`._
