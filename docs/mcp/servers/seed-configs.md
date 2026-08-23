# MCP Server Seed Configs for Vaeloom

MCP servers are stored as `mcp`-type external connectors. Create one per server
via the API (admin/operator), then sync to bridge its tools into the agent tool
executor.

```bash
# 1. Register the server (config is validated; env values are encrypted at rest)
curl -X POST $API/api/v1/connectors \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "Postgres Knowledge Graph",
    "type": "mcp",
    "config": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://user:pass@host/vaeloom"],
      "env": {}
    }
  }'

# 2. Discover tools + register into TOOL_DISPATCH (namespaced mcp__<name>__<tool>)
curl -X POST $API/api/v1/connectors/<id>/mcp/sync -H "Authorization: Bearer $TOKEN"

# 3. Inspect / refresh discovered tools
curl $API/api/v1/connectors/<id>/mcp/tools -H "Authorization: Bearer $TOKEN"
```

## Recommended servers

| Purpose                 | Transport | Command / URL                                                   | Notes                                                                        |
| ----------------------- | --------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Browser automation**  | stdio     | `npx -y @modelcontextprotocol/server-puppeteer`                 | Screenshots + JS-rendered DOM; complements native `browse_job_page`          |
| **Postgres / pgvector** | stdio     | `npx -y @modelcontextprotocol/server-postgres postgresql://...` | Read-only semantic search over the knowledge graph                           |
| **GitHub**              | http      | `https://api.githubcopilot.com/mcp/` (PAT via `env`)            | Native GitHub tools already exist — prefer those; use MCP for advanced flows |
| **Google Drive**        | stdio     | `npx -y @modelcontextprotocol/server-gdrive`                    | Read-only docs search                                                        |
| **Obsidian**            | stdio     | `npx -y mcp-obsidian <vault-path>`                              | Sync interview prep notes / roadmaps                                         |

## Config reference

| Field            | stdio    | http     | Description                                     |
| ---------------- | -------- | -------- | ----------------------------------------------- |
| `transport`      | required | required | `"stdio"` \| `"http"`                           |
| `command`        | required | —        | Executable (shell interpreters denied)          |
| `args`           | optional | —        | argv list, no shell metacharacters              |
| `url`            | —        | required | Server endpoint                                 |
| `allow_insecure` | —        | optional | Set `true` only for local dev http:// endpoints |
| `env`            | optional | optional | Extra env vars — each value encrypted at rest   |

## Safety model

- Discovered tools whose server does **not** hint `readOnly` are approval-gated
  in agent runs (`approval_gated_tools()`).
- Calls enforce workspace ownership of the connector at execution time.
- On startup Vaeloom re-syncs all enabled `mcp` connectors (non-fatal).
