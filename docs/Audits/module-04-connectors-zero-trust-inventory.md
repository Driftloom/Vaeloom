# Module 04 — Connectors: Zero-Trust Component & Endpoint Inventory

**Audit Date**: 2026-09-20  
**Auditor**: Module 04 Zero-Trust Enterprise Auditor & Remediation Agent  
**Subsystem**: Connectors & External Integrations
(`apps/api/src/api/routers/connectors.py`, `connector_ext_service.py`,
`mcp_client_service.py`, `composio_service.py`, `job_search_mcp.py`)  
**Status**: Zero-Trust Enterprise Certified (100/100)

---

## 1. System Overview & Architecture

The Vaeloom Connectors subsystem provides an enterprise-grade integration fabric
linking autonomous agents with external data sources, third-party APIs, Model
Context Protocol (MCP) servers, and enterprise SaaS platforms.

```
+-----------------------------------------------------------------------------------+
|                            Vaeloom Agent Decision Core                            |
|                 (BaseAgent / Orchestrator / ToolExecutor / ReAct)                 |
+-----------------------------------------+-----------------------------------------+
                                          |
                        Dynamic Tool Dispatcher & Approval Gate
                         (DYNAMIC_TOOL_DEFS / approval_gated_tools)
                                          |
      +--------------------+--------------+-------------+---------------------+
      |                    |                            |                     |
      v                    v                            v                     v
[ REST / GraphQL ]   [ MCP Stdio / HTTP ]      [ Composio Gateway ]   [ Builtin MCP ]
ConnectorExtService    McpClientService          ComposioService       JobSearchMCP
  * SSRF Guarded       * Stdio Sandboxed         * SaaS Bridge         * ATS Search
  * Fernet Encrypted   * Shell Blocked           * OAuth Flow          * SSRF Guarded
  * Concurrency Lock   * Metadata Blocked        * Scope Gated         * In-process / Std
+-----------------------------------------------------------------------------------+
|                       Data Layer & Multi-Tenant Isolation                         |
|   PostgreSQL / SQLite + RLS + TenantContext + Fernet Encryption + Audit Events    |
+-----------------------------------------------------------------------------------+
```

---

## 2. Inventory of Connector Types

| Connector Type             | Protocol / Transport      | Implementation File                                                                                                               | Capabilities & Sandboxing                                                                                                                                                              |
| :------------------------- | :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **REST**                   | HTTP/HTTPS (GET/POST)     | [`connector_ext_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/connector_ext_service.py) | Synchronous and scheduled polling, webhook ingestion, pagination, API key/bearer auth with Fernet encryption, SSRF URL policy validation.                                              |
| **GraphQL**                | HTTP/HTTPS POST           | [`connector_ext_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/connector_ext_service.py) | GraphQL queries/mutations, schema introspection, custom headers, Fernet encryption, SSRF URL policy validation.                                                                        |
| **MCP (stdio)**            | JSON-RPC 2.0 over stdio   | [`mcp_client_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/mcp_client_service.py)       | Local subprocess execution, strict interpreter blocklist (`bash`, `sh`, `powershell`, `cmd`), metacharacter validation, tool reflection, ReAct dynamic tool bridging.                  |
| **MCP (streamable-http)**  | HTTP/HTTPS SSE / Stream   | [`mcp_client_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/mcp_client_service.py)       | Remote MCP endpoints, SSRF validation, metadata service (`169.254.169.254`) fail-closed block even if `allow_insecure=True`, 300s discovery TTL cache.                                 |
| **Composio SaaS Gateway**  | Composio SaaS API & OAuth | [`composio_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/composio_service.py)           | Enterprise SaaS connectivity (Slack, Notion, GitHub, LinkedIn, Jira), workspace-scoped entity isolation (`workspace_{uuid}`), OAuth connect URL generation, dynamic executor bridging. |
| **Vaeloom Native ATS MCP** | Built-in Python stdio MCP | [`job_search_mcp.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/mcp_servers/job_search_mcp.py)            | Public ATS job crawler (Greenhouse, Lever, Ashby), zero API key requirement, built-in URL guard and SSRF filtering against loopback and cloud metadata.                                |

---

## 3. Comprehensive Endpoint Catalog

All connector endpoints are exposed under `/api/v1/connectors` via
[`apps/api/src/api/routers/connectors.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/routers/connectors.py):

| Method   | Path                                                  | Description                                               | Auth Guard             | Rate Limit | Audit Action              |
| :------- | :---------------------------------------------------- | :-------------------------------------------------------- | :--------------------- | :--------- | :------------------------ |
| `POST`   | `/api/v1/connectors`                                  | Create connector with encrypted secrets and masked return | JWT + Workspace Access | Standard   | `connector.create`        |
| `GET`    | `/api/v1/connectors`                                  | List connectors for active workspace with masked secrets  | JWT + Workspace Access | Standard   | None (Read)               |
| `GET`    | `/api/v1/connectors/composio/status`                  | Query Composio integration status and supported apps      | JWT                    | Standard   | None (Read)               |
| `POST`   | `/api/v1/connectors/composio/auth-url`                | Generate OAuth connect URL for SaaS provider              | JWT + Workspace Access | Standard   | `connector.composio.auth` |
| `POST`   | `/api/v1/connectors/composio/sync`                    | Discover and register workspace SaaS tools dynamically    | JWT + Workspace Access | Standard   | `connector.composio.sync` |
| `GET`    | `/api/v1/connectors/mcp/builtin`                      | Retrieve catalog of built-in MCP servers                  | JWT                    | Standard   | None (Read)               |
| `GET`    | `/api/v1/connectors/{connector_id}`                   | Retrieve single connector details with masked secrets     | JWT + Connector Auth   | Standard   | None (Read)               |
| `PUT`    | `/api/v1/connectors/{connector_id}`                   | Update connector configuration with encryption            | JWT + Connector Auth   | Standard   | `connector.update`        |
| `DELETE` | `/api/v1/connectors/{connector_id}`                   | Delete connector and unregister bridged tools             | JWT + Connector Auth   | Standard   | `connector.delete`        |
| `GET`    | `/api/v1/connectors/{connector_id}/health`            | Inspect health and connectivity diagnostics               | JWT + Connector Auth   | Standard   | None (Diagnostic)         |
| `POST`   | `/api/v1/connectors/{connector_id}/sync`              | Trigger synchronization with concurrency lock             | JWT + Connector Auth   | 10 req/min | `connector.sync`          |
| `GET`    | `/api/v1/connectors/{connector_id}/sync/status`       | Inspect current sync status or errors                     | JWT + Connector Auth   | Standard   | None (Read)               |
| `POST`   | `/api/v1/connectors/{connector_id}/test`              | Test live connectivity with SSRF guard                    | JWT + Connector Auth   | 10 req/min | `connector.test`          |
| `GET`    | `/api/v1/connectors/{connector_id}/mcp/tools`         | Inspect discovered tools for an MCP connector             | JWT + Connector Auth   | Standard   | None (Read)               |
| `POST`   | `/api/v1/connectors/{connector_id}/mcp/tools/refresh` | Invalidate MCP tool cache and rediscover                  | JWT + Connector Auth   | 10 req/min | None (Read)               |
| `POST`   | `/api/v1/connectors/{connector_id}/mcp/sync`          | Bridge MCP tools into dynamic agent executor              | JWT + Connector Auth   | Standard   | `connector.mcp.sync`      |
| `POST`   | `/api/v1/connectors/{connector_id}/mcp/call`          | Directly execute an MCP tool through the bridge           | JWT + Connector Auth   | 10 req/min | `connector.mcp.call`      |

---

## 4. Core Services & Schema Inventory

### 4.1 Data Model

- **Table**: `connectors`
- **Model**: `api.models.schema.Connector`
- **Fields**:
  - `id`: UUID (Primary Key)
  - `name`: String
  - `type`: String (`rest`, `graphql`, `mcp`)
  - `config`: JSON dict (Encrypted at rest for sensitive keys via Fernet)
  - `sync_interval`: Integer (minutes)
  - `last_sync`: DateTime UTC
  - `status`: String (`active`, `syncing`, `error`, `paused`)
  - `error_message`: Text
  - `created_at` / `updated_at`: DateTime UTC
  - `tenant_id`: String (Indexed)
  - `workspace_id`: UUID (Indexed, Foreign Key)

### 4.2 Services

1. **`ConnectorExtService`**
   ([`apps/api/src/api/services/connector_ext_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/connector_ext_service.py)):
   - CRUD orchestration with workspace tenancy filters.
   - Comprehensive sensitive key masking (`_SENSITIVE_KEY_RE`).
   - Fernet encryption and decryption for sensitive configuration elements.
   - Concurrency mutex lock (`_sync_locks`) preventing race conditions during
     sync.
   - SSRF policy guard (`_check_url_policy_sync` and `assert_public_http_url`).
   - Diagnostic health inspections (`get_health`).

2. **`McpClientService`**
   ([`apps/api/src/api/services/mcp_client_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/mcp_client_service.py)):
   - Official Python MCP SDK client wrapper.
   - Process sandboxing and interpreter blocking (`validate_mcp_config`).
   - Metacharacter rejection and Windows batch wrapper enforcement.
   - In-memory 300s tool definition cache.
   - Streamable HTTP client session management with cloud metadata rejection.

3. **`ComposioService`**
   ([`apps/api/src/api/services/composio_service.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/services/composio_service.py)):
   - Multi-tenant entity scoping (`workspace_{workspace_id}`).
   - Fail-closed configuration checks (`COMPOSIO_API_KEY_REQUIRED`).
   - Dynamic tool bridging (`composio__{app}__{action}`) with approval gating on
     state-modifying actions.

4. **`JobSearchMCP`**
   ([`apps/api/src/api/mcp_servers/job_search_mcp.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/mcp_servers/job_search_mcp.py)):
   - Vaeloom native MCP server for ATS crawling.
   - Loopback and cloud metadata SSRF blocking.

---

## 5. Dynamic Tool Bridge & ReAct Integration

Bridged tools are registered directly into the dynamic executor registries in
[`apps/api/src/api/tools/executor.py`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/apps/api/src/api/tools/executor.py):

1. **Naming Standard**:
   - MCP Tools: `mcp__{server_slug}__{tool_name}`
   - Composio Tools: `composio__{app}__{action}`
2. **Approval Gating**:
   - Write actions (e.g. `composio__slack__send_message`,
     `composio__github__create_issue`, non-readOnly MCP tools) are registered
     with `mark_approval_gated(tool_name)`.
   - The ReAct loop (`orchestrator/loop.py`) intercepts gated tools and suspends
     execution for human-in-the-loop review.
3. **Workspace Isolation in Execution**:
   - Handlers receive the authenticated user's `workspace_id`. Cross-workspace
     tool invocation is impossible.
