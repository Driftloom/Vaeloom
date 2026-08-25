# 42 — [P2] MCP tool output: structuredContent uncapped into agent context; unbounded call arguments

**Date:** 2026-08-23 · **Severity: P2** · **Status: OPEN**

## Evidence

1. Text content from MCP tools is truncated to 20 000 chars
   (`services/mcp_client_service.py:286`), but
   `payload["structured"] = structured` (`:290`) passes arbitrary-size MCP
   `structuredContent` through unmodified, and it is mapped straight into the
   bridged tool result that enters agent context (`:347-351`). A hostile/broken
   MCP server can inject multi-MB JSON → context blowout / cost / degraded loop
   behavior.
2. Request side: `McpCallRequest.arguments: dict[str, Any]` has no size or depth
   bound (`schemas/connector_ext.py:55`).

## Fix direction

Cap serialized `structured` payload (e.g. same 20 KB budget, shared constant),
reject >N-byte `arguments` with 422, and consider depth/key-count limits.
