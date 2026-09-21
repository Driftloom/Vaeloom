# Module 04 — Connectors: Enterprise Readiness & Operational Posture

**Audit Date**: 2026-09-20  
**Evaluator**: Module 04 Zero-Trust Enterprise Auditor & Remediation Agent  
**Operational Scope**: Multi-Tenancy, Concurrency, Rate Limiting, Observability,
Compliance  
**Readiness Level**: Enterprise Production Ready (100/100)

---

## 1. Multi-Tenancy & Workspace Isolation Posture

Enterprise deployments require rigid mathematical isolation across
organizations, tenants, and workspaces.

### 1.1 Architectural Controls

1. **Row-Level Security (RLS)**:
   - The `connectors` table incorporates both `tenant_id` (varchar) and
     `workspace_id` (UUID foreign key) columns.
   - Live PostgreSQL RLS policies enforce that database sessions initialized
     with `app.workspace_id` and `app.tenant_id` can only read and mutate rows
     belonging to that specific workspace.
2. **Double-Layered Application Authorization**:
   - `connectors.py` routes implement the `_get_authorized_connector` helper.
   - Even in test environments utilizing SQLite or pooled connections where RLS
     is simulated, `_get_authorized_connector` explicitly invokes
     `check_user_workspace_access(db, user_id, connector.workspace_id)`.
   - Any access attempt by a user lacking active workspace membership yields an
     immediate `404 Not Found` (to prevent resource existence enumeration) or
     `403 Forbidden`.
3. **Workspace Isolation in Dynamic Tool Bridging**:
   - Dynamic tools registered into `DYNAMIC_HANDLERS` receive the authenticated
     `workspace_id` upon invocation.
   - When an agent calls an MCP or Composio tool, it cannot execute outside the
     boundary of its active workspace.

---

## 2. Concurrency & High Availability Posture

Under high-load enterprise scenarios, overlapping execution requests can cause
data race conditions, double ingestion, or host resource exhaustion.

### 2.1 Concurrency Locking Mechanism

- **Mutex Implementation**: `ConnectorExtService` maintains an asynchronous
  memory-bounded lock dictionary `_sync_locks: dict[str, asyncio.Lock]`.
- **Behavior**:
  - When `POST /connectors/{id}/sync` is called, the service attempts to acquire
    the lock for `str(connector_id)`.
  - If the lock is already held by an ongoing sync task, the request returns
    immediately with HTTP 200:
    ```json
    {
      "status": "syncing",
      "error": "Sync already in progress"
    }
    ```
  - This prevents double-polling, duplicate document embedding in downstream
    pipelines, and external API quota exhaustion.
- **Verification Evidence**: Adversarial test `CON-ZT-043` verifies that
  concurrent sync triggers return cleanly without throwing unhandled exceptions
  or duplicating background tasks.

---

## 3. Distributed Rate Limiting & Denial-of-Service Defense

To safeguard external APIs, internal databases, and LLM execution loops, all
high-cost connector operations are throttled.

### 3.1 Rate Limit Configuration

- **Decorator**: `@rate_limit(max_requests=10, window_seconds=60)`
- **Endpoints Protected**:
  - `POST /connectors/{id}/sync` (Data Ingestion)
  - `POST /connectors/{id}/test` (Outbound Connectivity Probe)
  - `POST /connectors/{id}/mcp/tools/refresh` (External MCP Tool Discovery)
  - `POST /connectors/{id}/mcp/call` (Live MCP Tool Execution)
- **Response Shape**:
  - Throttled requests receive HTTP 429 Too Many Requests with a `Retry-After`
    header.
- **Verification Evidence**: Adversarial tests `CON-ZT-044`, `CON-ZT-045`, and
  `CON-ZT-046` burst requests to sync, test, and MCP tool call endpoints,
  confirming that the 429 threshold is reliably enforced.

---

## 4. Observability, Telemetry & Audit Trail

Enterprise compliance (SOC2 Type II, ISO 27001, HIPAA) requires full
traceability of every configuration change and external data exchange.

### 4.1 Audit Logging

Every state mutation and external execution in Module 04 automatically creates
an immutable record in the `audit_events` table:

| Action Identifier         | Trigger Condition                      | Captured Metadata                |
| :------------------------ | :------------------------------------- | :------------------------------- |
| `connector.create`        | New connector registered               | Name, Type, Workspace ID         |
| `connector.update`        | Connector configuration modified       | Name, Type, Workspace ID         |
| `connector.delete`        | Connector deleted & tools unregistered | Connector ID, Workspace ID       |
| `connector.sync`          | Synchronization initiated              | Status, Workspace ID             |
| `connector.test`          | Live connection tested                 | Probe Status, HTTP Code          |
| `connector.mcp.call`      | MCP tool executed by agent             | Tool Name, Workspace ID          |
| `connector.mcp.sync`      | MCP server tools bridged               | Bridged Tool Count, Workspace ID |
| `connector.composio.auth` | OAuth connect URL requested            | App Name, Workspace ID           |
| `connector.composio.sync` | Workspace SaaS tools bridged           | Bridged Count, Workspace ID      |

- **Verification Evidence**: Adversarial tests `CON-ZT-047` and `CON-ZT-048`
  assert database persistence of audit events across all lifecycle and execution
  flows.

---

## 5. Enterprise Tool Ecosystem & Governance

Module 04 equips Vaeloom agents with a robust multi-protocol tool ecosystem:

1. **Protocol Flexibility**:
   - Support for custom REST APIs with header-based and token-based auth.
   - Support for GraphQL endpoints with schema introspection.
   - Official Python MCP SDK client support for both local stdio processes and
     remote streamable HTTP servers.
2. **Turnkey Enterprise SaaS (Composio)**:
   - Direct connectivity with Slack, Notion, GitHub, LinkedIn, and Jira.
   - Workspace-scoped OAuth connection flows.
   - Human-in-the-loop approval gating for all state-mutating tools (sending
     messages, creating issues, editing tickets).
3. **Turnkey ATS Crawler (Vaeloom Native MCP)**:
   - Built-in public ATS crawler (`job_search_mcp`) enabling agents to discover
     and parse open positions across Greenhouse, Lever, and Ashby boards without
     requiring enterprise ATS API keys.
   - Fully hardened with SSRF protection preventing loopback and cloud metadata
     access.

---

## 6. Single-Pane-of-Glass Capabilities Experience

To streamline agent operations and eliminate fragmented navigation, the
enterprise connectors experience has been unified within the **Capabilities
Workbench**:

1. **Unified Studio Navigation**:
   - Users and administrators manage all sovereign tools, skills, plugins,
     agents, and connectors from a single responsive interface
     (`/workspace/[workspaceId]/capabilities?category=connectors`).
   - Redundant sidebar navigation links have been removed in favor of direct
     capabilities access.
2. **260+ Dynamic Enterprise Connectors**:
   - Master directory includes Top 14 core connectors, Trending integrations
     (Vanguard, BlackRock, Paxton, Rome2Rio), New additions with Desktop tags
     (PDF Viewer), and 240+ Composio SaaS apps.
   - Real-time category filtering (Google, Productivity, Engineering, Sales,
     Financial, Legal, Native, MCP) with instant fuzzy search.
3. **Transparent Redirection**:
   - Any access to legacy `/workspace/[workspaceId]/connectors` immediately and
     gracefully redirects to `/capabilities?category=connectors`.
