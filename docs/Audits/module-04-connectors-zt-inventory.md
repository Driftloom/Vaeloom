# Module 04 — Connectors: Authoritative Zero-Trust Inventory

**Audit Timestamp**: 2026-09-21T22:30:00+05:30  
**Scope**: Module 04 — Connectors Subsystem (`apps/api`, `apps/web`, Database, Network, Security Boundaries)  
**Methodology**: Absolute Zero-Trust (Code Inspection, Runtime Verification, AST Analysis, Adversarial Test Execution)

---

## 1. System Inventory Summary

The Vaeloom Connectors subsystem provides an integration fabric linking autonomous agents with external data sources, third-party APIs, Model Context Protocol (MCP) servers, and enterprise SaaS platforms via Composio.

| ID | Capability | Location | Endpoint / Handler | DB / Storage | Security Boundary | Tests | Runtime Verified | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CON-INV-01** | Create Connector | `routers/connectors.py:113` | `POST /api/v1/connectors` | `connectors` table | JWT, Workspace Access, Fernet encryption, URL policy sync | `test_connectors.py:22` | YES (201 Created, Masked config) | **VERIFIED** |
| **CON-INV-02** | List Connectors | `routers/connectors.py:140` | `GET /api/v1/connectors` | `connectors` table | JWT, Workspace Access, User ownership subquery, Fernet masking | `test_connectors.py:34` | YES (200 OK, scoped to workspace) | **VERIFIED** |
| **CON-INV-03** | Get Connector Details | `routers/connectors.py:310` | `GET /api/v1/connectors/{id}` | `connectors` table | JWT, `_get_authorized_connector`, Workspace Access, Fernet masking | `test_connectors.py:46` | YES (200 OK, 404 on unauth) | **VERIFIED** |
| **CON-INV-04** | Update Connector | `routers/connectors.py:324` | `PUT /api/v1/connectors/{id}` | `connectors` table | JWT, `_get_authorized_connector`, Config revalidation, Fernet re-encryption | `test_connectors.py:65` | YES (200 OK, 404 on unauth) | **VERIFIED** |
| **CON-INV-05** | Delete Connector | `routers/connectors.py:349` | `DELETE /api/v1/connectors/{id}` | `connectors` table | JWT, `_get_authorized_connector`, Workspace Access, Audit log | `test_connectors.py:78` | YES (204 No Content) | **VERIFIED** |
| **CON-INV-06** | Connector Health | `routers/connectors.py:372` | `GET /api/v1/connectors/{id}/health` | `connectors` table | JWT, `_get_authorized_connector`, Credential redaction in diagnostics | Unit tests | YES (Safe diagnostics) | **VERIFIED** |
| **CON-INV-07** | Trigger Sync | `routers/connectors.py:388` | `POST /api/v1/connectors/{id}/sync` | `connectors` table | Rate limit (10/min), `_get_authorized_connector`, Mutex lock, SSRF guard | `test_connectors.py:97` | YES (200 OK, syncing status) | **VERIFIED** |
| **CON-INV-08** | Get Sync Status | `routers/connectors.py:413` | `GET /api/v1/connectors/{id}/sync/status` | `connectors` table | JWT, `_get_authorized_connector`, Workspace Access | `test_connectors.py:108` | YES (200 OK, status returned) | **VERIFIED** |
| **CON-INV-09** | Test Connection | `routers/connectors.py:428` | `POST /api/v1/connectors/{id}/test` | `connectors` table | Rate limit (10/min), `_get_authorized_connector`, SSRF policy, Safe redirect hook | `test_connectors.py:118` | YES (200 OK) | **VERIFIED** |
| **CON-INV-10** | List MCP Tools | `routers/connectors.py:456` | `GET /api/v1/connectors/{id}/mcp/tools` | In-memory cache + `connectors` | JWT, `_get_authorized_connector`, 300s TTL cache, schema validation | `test_mcp_client_service.py` | YES (via service unit test) | **VERIFIED (Unit)** |
| **CON-INV-11** | Refresh MCP Tools | `routers/connectors.py:477` | `POST /api/v1/connectors/{id}/mcp/tools/refresh` | In-memory cache | Rate limit (10/min), `_get_authorized_connector`, Cache invalidation | `test_mcp_client_service.py` | YES (via service unit test) | **VERIFIED (Unit)** |
| **CON-INV-12** | Direct MCP Tool Call | `routers/connectors.py:498` | `POST /api/v1/connectors/{id}/mcp/call` | `connectors` | Rate limit (10/min), `_get_authorized_connector`, Argument limit (20k), Output limit (20k) | `test_mcp_client_service.py` | YES (via service unit test) | **VERIFIED (Unit)** |
| **CON-INV-13** | Dynamic MCP Bridge Sync | `routers/connectors.py:533` | `POST /api/v1/connectors/{id}/mcp/sync` | `DYNAMIC_HANDLERS`, `DYNAMIC_TOOL_DEFS` | `_get_authorized_connector`, Dynamic executor registration, Approval gating | `test_mcp_client_service.py:240` | YES (Bridged with approval gate) | **VERIFIED** |
| **CON-INV-14** | Builtin MCP Catalog | `routers/connectors.py:271` | `GET /api/v1/connectors/mcp/builtin` | Dynamic Catalog | JWT, system Python executable binding, read-only ATS scraper | `test_dynamic_connectors_and_trigger.py` | YES (Returns job-search-mcp) | **VERIFIED** |
| **CON-INV-15** | Composio Status | `routers/connectors.py:164` | `GET /api/v1/connectors/composio/status` | In-memory cache | JWT, Enabled/configured state, Popular apps catalog | `test_dynamic_connectors_and_trigger.py` | YES (200 OK) | **VERIFIED** |
| **CON-INV-16** | Composio Apps Catalog | `routers/connectors.py:190` | `GET /api/v1/connectors/composio/apps` | `COMPOSIO_SUPPORTED_APPS` | JWT, Category filtering, 260+ enterprise app catalog | Service test | YES (200 OK, paginated) | **VERIFIED** |
| **CON-INV-17** | Composio OAuth URL | `routers/connectors.py:210` | `POST /api/v1/connectors/composio/auth-url` | Composio Backend API | JWT, Workspace Access, Audit log | `test_dynamic_connectors_and_trigger.py` | YES (Returns auth URL / config req) | **VERIFIED** |
| **CON-INV-18** | Composio SaaS Tool Sync | `routers/connectors.py:239` | `POST /api/v1/connectors/composio/sync` | `DYNAMIC_TOOL_DEFS` | JWT, Workspace Access, Dynamic bridge registration | Service test | YES (Scoped to workspace_id) | **VERIFIED** |
| **CON-INV-19** | Native ATS Job Crawler | `mcp_servers/job_search_mcp.py` | Tool: `search_public_ats_jobs` | In-process MCP | Greenhouse, Lever, Ashby public APIs, SSRF url_guard | `test_dynamic_connectors_and_trigger.py:9` | YES (Structured jobs output) | **VERIFIED** |
| **CON-INV-20** | Native ATS Job Scraper | `mcp_servers/job_search_mcp.py` | Tool: `fetch_job_details` | In-process MCP | `assert_public_http_url` SSRF guard, redirect inspection | `test_dynamic_connectors_and_trigger.py:23` | YES (SSRF fail-closed) | **VERIFIED** |
| **CON-INV-21** | Temporal Durable Sync | `temporal/workflows.py` | `ConnectorSyncWorkflow` | PostgreSQL + Temporal | Temporal worker, Heartbeat (30s), Activity cancel, Progress query | `temporal/test_connector_sync.py` | YES (3/3 passed in 28.18s) | **VERIFIED** |
| **CON-INV-22** | Frontend Connectors Redirect | `apps/web/.../connectors/page.tsx` | Route: `/workspace/{id}/connectors` | Client router | Client redirect to `/capabilities?category=connectors` | `connectors/page.spec.tsx` | YES (2/2 Jest tests green) | **VERIFIED** |
| **CON-INV-23** | Frontend Capabilities View | `components/capabilities/ConnectorsView.tsx` | UI Component | SWR / API Client | Yours vs Discover, 260+ catalog, OAuth launcher, Test/Sync modal | `capabilities/page.spec.tsx` | YES (12/12 Jest tests green) | **VERIFIED** |
| **CON-INV-24** | Frontend MCP Control Plane | `components/capabilities/McpView.tsx` | UI Component | SWR / API Client | Stdio/HTTP inspector, builtin server templates, mcp.json editor | `capabilities/page.spec.tsx:99` | YES (12/12 Jest tests green) | **VERIFIED** |
| **CON-INV-25** | IP Allowlist Middleware | `middleware/ip_filter.py` | Global ASGI Middleware | Settings (`IP_ALLOWLIST`) | CIDR matching, IPv4/IPv6, trusted proxy header handling (FIND-SEC-008) | `test_rate_limiting.py` | YES (Blocks untrusted IPs) | **VERIFIED** |
| **CON-INV-26** | Zero-Trust Adversarial Suite | `tests/security/test_connectors_zero_trust_adversarial.py` | 61 Adversarial Tests (CON-ZT-001..048) | Test SQLite DB | Multi-tenant, SSRF, Sandboxing, Fernet, Concurrency, Rate limits | Blocked by `mock_llm` conftest bug | **FAILED AT SETUP (61 errors)** | **BLOCKED BY REGRESSION** |
| **CON-INV-27** | MCP Integration Suite | `tests/integration/test_mcp_connectors.py` | 10 Route Integration Tests | Test SQLite DB | Endpoint contract, auth headers, tool listing, call proxy | Blocked by `mock_llm` conftest bug | **FAILED AT SETUP (10 errors)** | **BLOCKED BY REGRESSION** |

---

## 2. Component Trust Boundaries

```
[Untrusted Client / Browser]
       │
       ▼ (1. IP Allowlist Middleware - ASGI)
[FastAPI Entrypoint]
       │
       ▼ (2. Authentication: JWT decode & validation)
[Router: /api/v1/connectors]
       │
       ├─► (3. Workspace Access Gate: check_user_workspace_access(uid, wid))
       │
       ├─► (4. Rate Limit Middleware: sliding window 10 req/60s)
       │
       ▼ (5. Service Layer: connector_ext_service / mcp_client_service)
       │
       ├─► [Configuration Validation & Revalidation]
       │     - Schemes: http, https only
       │     - URL Guard: SSRF DNS resolution + IP check (loopback/link-local/private/metadata blocked)
       │     - Stdio Sandboxing: Denied interpreters (bash, sh, powershell, cmd), metacharacter regex
       │
       ├─► [Fernet Symmetric Encryption]
       │     - Encrypts sensitive keys, headers, env vars at rest
       │     - API responses masked universally with "******"
       │
       ├─► [Database Storage: PostgreSQL / SQLite]
       │     - RLS Policy: p_connectors_workspace (workspace_id = WS AND tenant_id = TEN)
       │
       ├─► [Outbound Boundary: External REST / GraphQL / MCP Server]
       │     - 5s-30s timeouts
       │     - Redirect response hook: assert_public_http_url on Location header
       │     - Clean parent environment: secrets stripped before subprocess spawn
       │
       └─► [Audit Logging: synchronous write to audit_events]
```
