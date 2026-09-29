# ENT-P08 — 03 Client SDK, Tool Contracts & Model Context Protocol (MCP) Adapters

> **Phase:** `ENT-P08` (API Integration and Contract Design)  
> **Deliverable:** `DEL-ENT-P08-03` (v1.0)  
> **Owner:** Principal SDK Engineer & AI Integration Architect  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Official Enterprise Client SDK Contracts

Vaeloom provides official, strongly typed SDKs for TypeScript and Python
generated directly from verified OpenAPI 3.2.0 specifications:

### A. TypeScript Client SDK (`@vaeloom/sdk-ts`)

- **Runtime Targets:** Node.js 20+, Bun, Browser (Modern ES2023+).
- **Core Features:** Built-in JWT token refresh, Server-Sent Events (SSE)
  streaming reader for agent trajectories, automatic retry on 429/503 with
  exponential backoff.

```typescript
import { VaeloomClient } from '@vaeloom/sdk-ts';

const client = new VaeloomClient({
  baseUrl: 'https://api.vaeloom.com/v1',
  apiKey: process.env.VAELOOM_API_KEY!,
  workspaceId: 'ws_110923ef',
});

// Stream reasoning steps from 28-agent cognitive pipeline
const stream = await client.agents.runStream({
  agentSlug: 'career-coaching',
  prompt:
    'Analyze ATS skill gaps against Senior Platform Engineer role at Stripe',
});

for await (const chunk of stream) {
  if (chunk.type === 'thought') {
    console.log(`[Thinking]: ${chunk.content}`);
  } else if (chunk.type === 'tool_call') {
    console.log(
      `[Tool Executing]: ${chunk.toolName}(${JSON.stringify(chunk.args)})`,
    );
  } else if (chunk.type === 'final_response') {
    console.log(`[Result]: ${chunk.content}`);
  }
}
```

### B. Python Client SDK (`vaeloom-sdk-py`)

- **Runtime Targets:** Python 3.12+ (Typed Pydantic v2 async models).
- **Core Features:** `httpx` async client, context manager support, automatic
  session GUC header injection.

```python
from vaeloom import AsyncVaeloomClient

async with AsyncVaeloomClient(api_key="sk_live_...", workspace_id="ws_110923ef") as client:
    resume = await client.resumes.get("res_998123cd")
    tailored = await client.resumes.tailor(
        resume_id=resume.id,
        job_description="Staff Site Reliability Engineer...",
        template_id="tmpl_executive_modern"
    )
    print(f"Tailored Resume ATS Score: {tailored.ats_score}")
```

---

## 2. Model Context Protocol (MCP) Server Adapters & Bridge

Vaeloom implements native Model Context Protocol (MCP) v2 adapters (ADR-036)
allowing cognitive agents to dynamically discover and execute external tools
over stdio and HTTP/SSE streams:

```mermaid
flowchart LR
    subgraph Agent["Vaeloom Cognitive Runtime"]
        ReAct[ReAct Agent Loop] --> Exec[Dynamic Tool Executor]
    end

    subgraph Bridge["MCP Client Service (services/mcp_client_service.py)"]
        Exec --> Router{Tool Router}
        Router -->|Internal Native| Native[Native Agent Tools (61 Total)]
        Router -->|External MCP| MCPBridge["MCP Client Adapter<br/>(Scope: connector.mcp.execute)"]
    end

    subgraph External["External MCP Servers"]
        MCPBridge -->|stdio / pipe| MCP1[GitHub MCP Server]
        MCPBridge -->|Streamable HTTP| MCP2[PostgreSQL MCP Server]
        MCPBridge -->|Local Process| MCP3[Custom Enterprise MCP]
    end
```

### MCP Tool Bridging Schema:

External tools are namespaced into the executor's registry using the pattern:
`mcp__<ServerName>__<ToolName>`.

```json
{
  "name": "mcp__github__search_repositories",
  "description": "Searches GitHub repositories for relevant open-source projects or code samples.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query terms" },
      "sort": {
        "type": "string",
        "enum": ["stars", "forks", "updated"],
        "default": "stars"
      }
    },
    "required": ["query"]
  },
  "metadata": {
    "server_id": "conn_github_mcp_01",
    "timeout_seconds": 30,
    "read_only": true,
    "requires_hitl": false
  }
}
```

---

## 3. Governed Tool Registration & Sandboxed Execution Boundary

To prevent unexpected execution, privilege escalation, and data exfiltration
(OWASP Agentic Top 10), all agent tools are categorized into security tiers:

| Tool Tier                                 | Execution Policy                            | Example Tools                                                                        | Security Controls                                                                |
| :---------------------------------------- | :------------------------------------------ | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| **Tier 1: Read-Only Query**               | Autonomous execution                        | `calculate_semantic_ats_score`, `browse_job_page`, `mcp__github__get_issue`          | Subprocess isolation; SSRF URL guard; 30s timeout; read-only token.              |
| **Tier 2: Mutation & Draft**              | Autonomous execution with workspace logging | `tailor_resume_section`, `create_cover_letter_draft`, `save_career_note`             | Scoped to active workspace; RLS policy check; schema validation.                 |
| **Tier 3: Destructive / External Action** | **Human-In-The-Loop (HITL) Gated**          | `send_external_email`, `delete_resume`, `apply_to_job_external`, `mcp__*__push_code` | **Halted by System 1 (`noul` routing)**; requires explicit human approval in UI. |

### Network Egress Security Guardrail (`utils/url_guard.py`):

For web-browsing tools (`browse_job_page`, `verify_application_link`):

1. **HTTPS Enforcement:** Only `https://` schemes permitted.
2. **Private IP & Loopback Blocking:** DNS resolution performed pre-flight;
   connections to private IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
   `127.0.0.0/8`) and IPv6 loopback (`::1`) unconditionally rejected (hard HTTP
   403).
3. **Workspace Quota:** Enforces sliding-window limit of 20 scrapes per hour per
   workspace (`SCRAPE_QUOTA_PER_HOUR`).

---

_Signed: Principal SDK Engineer & AI Integration Architect — 2026-09-29_
