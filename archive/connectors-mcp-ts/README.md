# Archived — Legacy TS MCP Connector

**Archived:** 2026-08-27 per ADR-036 and ADR-037

`connectors/mcp` (TS: `index.ts`, `mcp.connector.ts`, `transport.ts`) was a
working stdio/HTTP-SSE JSON-RPC MCP client but was **never wired into the Python
API**.

Superseded by native Python `mcp` SDK in
`apps/api/src/api/services/mcp_client_service.py` (ADR-036) with encrypted
`env`/`headers`, validation, bridging as `mcp__<Server>__<Tool>`.

Restore from git history if needed; not wired to `pnpm` workspace after
archival.
