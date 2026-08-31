# Tool Inventory

> Source: Agentic-AI-Zero-Trust-E2E-Audit.md section 17 + definitions.py (50
> tools). Approval-gated 12.

See main audit section 17.

50 tools in ALL_TOOLS (definitions.py) + DYNAMIC_TOOL_DEFS (MCP). 12 static
approval-gated + dynamic non-readOnly auto-gated.

| Category        | Count | Timeout                                |
| --------------- | ----- | -------------------------------------- |
| memory_read     | 5     | 2s                                     |
| memory_write    | 3     | 2s                                     |
| connector_read  | 23    | 5s                                     |
| connector_write | 9     | 10s                                    |
| system          | 10    | 1s + overrides browse 45s, compile 30s |

Scope check: executor.check_permission exact or prefix .*,
approval_gated_tools() before exec, audit true, scrape quota 20/h (Redis sorted
set).

Reproduce: python3 -c from api.tools.definitions import ALL_TOOLS; len 50.
