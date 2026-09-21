# Module 04 — Connectors: Zero-Trust Requirements Traceability Matrix

**Audit Timestamp**: 2026-09-21T22:30:00+05:30  
**Lead Auditor**: Antigravity Zero-Trust Verification Agent  
**Scope**: Complete Functional, Security, Isolation, and Adversarial Requirements  
**Status**: PARTIALLY VERIFIED (85 Unit/Temporal tests pass; 14 Frontend tests pass; 71 Adversarial/Integration tests blocked by GAP-CON-01)

---

## 1. Requirements Traceability & Verification Status

| Req ID | Category | Requirement Description | Implementation Reference | Fresh Verification Evidence | Zero-Trust Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CON-REQ-01** | Tenancy | Workspace isolation on connector retrieval (`GET /connectors/{id}`) | `connectors.py:310`, `_get_authorized_connector` | Code verified; `test_connectors.py:46` passes; CON-ZT-001 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-02** | Tenancy | Workspace isolation on connector update (`PUT /connectors/{id}`) | `connectors.py:324`, `_get_authorized_connector` | Code verified; `test_connectors.py:65` passes; CON-ZT-002 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-03** | Tenancy | Workspace isolation on connector delete (`DELETE /connectors/{id}`) | `connectors.py:349`, `_get_authorized_connector` | Code verified; `test_connectors.py:78` passes; CON-ZT-003 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-04** | Tenancy | Workspace isolation on trigger sync (`POST /connectors/{id}/sync`) | `connectors.py:388`, `_get_authorized_connector` | Code verified; `test_connectors.py:97` passes; CON-ZT-004 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-05** | Tenancy | Workspace isolation on test connection (`POST /connectors/{id}/test`) | `connectors.py:428`, `_get_authorized_connector` | Code verified; `test_connectors.py:118` passes; CON-ZT-005 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-06** | Tenancy | Workspace isolation on MCP tool listing (`GET /connectors/{id}/mcp/tools`) | `connectors.py:456`, `_get_authorized_connector` | Code verified; CON-ZT-006 blocked by GAP-CON-01 | **IMPLEMENTED BUT UNVERIFIED** |
| **CON-REQ-07** | Tenancy | Workspace isolation on MCP tool refresh (`POST /connectors/{id}/mcp/tools/refresh`) | `connectors.py:477`, `_get_authorized_connector` | Code verified; CON-ZT-007 blocked by GAP-CON-01 | **IMPLEMENTED BUT UNVERIFIED** |
| **CON-REQ-08** | Tenancy | Workspace isolation on MCP bridge sync (`POST /connectors/{id}/mcp/sync`) | `connectors.py:533`, `_get_authorized_connector` | Code verified; CON-ZT-008 blocked by GAP-CON-01 | **IMPLEMENTED BUT UNVERIFIED** |
| **CON-REQ-09** | Tenancy | Workspace isolation on MCP direct call (`POST /connectors/{id}/mcp/call`) | `connectors.py:498`, `_get_authorized_connector` | Code verified; CON-ZT-009 blocked by GAP-CON-01 | **IMPLEMENTED BUT UNVERIFIED** |
| **CON-REQ-10** | Tenancy | Workspace isolation on connector listing (`GET /connectors`) | `connectors.py:140`, `list_all` | Code verified; `test_connectors.py:34` passes; CON-ZT-010 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-11** | SSRF | Reject loopback IPv4/IPv6 URLs on connector creation and sync | `connector_ext_service.py:113`, `_check_url_policy_sync` | Unit verified via `test_connector_ext_service.py`; CON-ZT-011 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-12** | SSRF | Reject AWS/GCP/Azure link-local metadata IP `169.254.169.254` | `connector_ext_service.py:114`, `_check_url_policy_sync` | Unit verified via `test_connector_ext_service.py`; CON-ZT-012 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-13** | SSRF | Reject GCP internal metadata DNS `metadata.google.internal` | `connector_ext_service.py:114`, `_check_url_policy_sync` | Unit verified via `test_connector_ext_service.py`; CON-ZT-013 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-14** | SSRF | Reject non-HTTP/HTTPS schemes (`file://`, `gopher://`, `ftp://`) | `connector_ext_service.py:104`, `_check_url_policy_sync` | Unit verified via `test_connector_ext_service.py`; CON-ZT-014 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-15** | SSRF | Reject private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) | `connector_ext_service.py:121`, `_check_url_policy_sync` | Unit verified via `test_connector_ext_service.py`; CON-ZT-015 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-16** | SSRF | Inspect HTTP redirects during sync to block loopback escapes | `connector_ext_service.py:436`, `_safe_redirect_hook` | Code verified; CON-ZT-016 blocked by GAP-CON-01 | **IMPLEMENTED BUT UNVERIFIED** |
| **CON-REQ-17** | SSRF | Inspect HTTP redirects during test_connection to block metadata | `connector_ext_service.py:550`, `_safe_redirect_hook` | Code verified; CON-ZT-017 blocked by GAP-CON-01 | **IMPLEMENTED BUT UNVERIFIED** |
| **CON-REQ-18** | SSRF | Native ATS MCP crawler rejects loopback job page URLs | `job_search_mcp.py:144`, `assert_public_http_url` | Verified via `test_dynamic_connectors_and_trigger.py:23` | **VERIFIED** |
| **CON-REQ-19** | SSRF | Native ATS MCP crawler rejects cloud metadata job page URLs | `job_search_mcp.py:144`, `assert_public_http_url` | Verified via `test_dynamic_connectors_and_trigger.py:23` | **VERIFIED** |
| **CON-REQ-20** | SSRF | Streamable-HTTP MCP blocks cloud metadata even if allow_insecure=True | `mcp_client_service.py:114`, `validate_mcp_config` | Verified via `test_mcp_client_service.py:39` | **VERIFIED** |
| **CON-REQ-21** | Sandbox | Reject `bash` interpreter in stdio command configuration | `mcp_client_service.py:81`, `validate_mcp_config` | Verified via `test_mcp_client_service.py:52` (PASSED) | **VERIFIED** |
| **CON-REQ-22** | Sandbox | Reject `sh` interpreter in stdio command configuration | `mcp_client_service.py:81`, `validate_mcp_config` | Verified via `test_mcp_client_service.py:52` (PASSED) | **VERIFIED** |
| **CON-REQ-23** | Sandbox | Reject `powershell` interpreter in stdio command configuration | `mcp_client_service.py:81`, `validate_mcp_config` | Verified via `test_mcp_client_service.py:52` (PASSED) | **VERIFIED** |
| **CON-REQ-24** | Sandbox | Reject `cmd` and `cmd.exe` in stdio command configuration | `mcp_client_service.py:81`, `validate_mcp_config` | Verified via `test_mcp_client_service.py:52` (PASSED) | **VERIFIED** |
| **CON-REQ-25** | Sandbox | Reject POSIX shell metacharacters in command (`; & \| \` $ \n`) | `mcp_client_service.py:42,93`, `validate_mcp_config` | Verified via `test_mcp_client_service.py:57` (PASSED) | **VERIFIED** |
| **CON-REQ-26** | Sandbox | Reject shell chaining metacharacters in args array (`&&`, `\|`, `>`, `<`) | `mcp_client_service.py:93`, `validate_mcp_config` | Verified via `test_mcp_client_service.py:57` (PASSED) | **VERIFIED** |
| **CON-REQ-27** | Sandbox | Reject Windows batch metacharacters in command (`^`, `%`, `!`) | `mcp_client_service.py:42`, `_SHELL_METACHARS` | Verified via `test_mcp_client_service.py:57` (PASSED) | **VERIFIED** |
| **CON-REQ-28** | Sandbox | Reject invalid args and env types (must be lists and dicts of strings) | `mcp_client_service.py:84,96`, `validate_mcp_config` | Verified via `test_mcp_client_service.py:61` (PASSED) | **VERIFIED** |
| **CON-REQ-29** | Encryption | REST credentials (`apiKey`, `authToken`) encrypted at rest via Fernet | `connector_ext_service.py:74`, `_encrypt_config` | Verified via `test_connector_ext_service.py:22` (PASSED) | **VERIFIED** |
| **CON-REQ-30** | Encryption | Case-insensitive variants (`client_secret`, `private_key`) encrypted | `connector_ext_service.py:18`, `_SENSITIVE_KEY_RE` | Code verified; CON-ZT-030 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-31** | Encryption | Nested dictionary header tokens encrypted in database | `connector_ext_service.py:279`, `_encrypt_config` | Code verified; CON-ZT-031 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-32** | Masking | `POST /connectors` response masks sensitive config fields (`******`) | `connectors.py:35,137`, `_mask_connector_response` | Verified in live manual response; CON-ZT-032 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-33** | Masking | `GET /connectors/{id}` response masks sensitive config fields (`******`) | `connectors.py:35,321`, `_mask_connector_response` | Verified in live manual response; CON-ZT-033 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-34** | Masking | `GET /connectors` listing response masks sensitive config fields (`******`) | `connectors.py:35,160`, `_mask_connector_response` | Verified in live manual response; CON-ZT-034 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-35** | Masking | `PUT /connectors/{id}` response masks sensitive config fields (`******`) | `connectors.py:35,346`, `_mask_connector_response` | Verified in live manual response; CON-ZT-035 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-36** | Masking | Health endpoint `GET /{id}/health` exposes keys without secret values | `connector_ext_service.py:get_health` | Code verified; CON-ZT-036 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-37** | Composio | `GET /connectors/composio/status` returns catalog and configuration state | `connectors.py:164`, `get_composio_status` | Verified via `test_dynamic_connectors_and_trigger.py:17` | **VERIFIED** |
| **CON-REQ-38** | Composio | `POST /connectors/composio/auth-url` generates OAuth connect URL | `connectors.py:210`, `get_composio_auth_url` | Verified via `test_dynamic_connectors_and_trigger.py:18` | **VERIFIED** |
| **CON-REQ-39** | Composio | `POST /connectors/composio/sync` bridges workspace SaaS tools dynamically | `connectors.py:239`, `sync_composio_tools` | Code verified; scoped to `workspace_{id}`; CON-ZT-039 blocked | **PARTIALLY VERIFIED** |
| **CON-REQ-40** | Native MCP | `GET /connectors/mcp/builtin` returns public ATS crawler specification | `connectors.py:271`, `get_builtin_mcp_servers` | Verified via router response inspection | **VERIFIED** |
| **CON-REQ-41** | Native MCP | ATS job search tool executes valid query returning structured listings | `job_search_mcp.py:102`, `search_public_ats_jobs` | Verified via `test_dynamic_connectors_and_trigger.py:9` | **VERIFIED** |
| **CON-REQ-42** | Composio | Unauthenticated requests to Composio endpoints are rejected with 401 | `connectors.py:166,218,248` | Code verified; CON-ZT-042 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-43** | Concurrency | Concurrency mutex lock on sync returns 200 with status: syncing | `connector_ext_service.py:379`, `status == "syncing"` | Code verified; Temporal durable sync verified (3/3 passed) | **VERIFIED** |
| **CON-REQ-44** | Rate Limit | `POST /connectors/{id}/sync` throttles excessive requests with 429 | `connectors.py:389`, `@rate_limit(10, 60)` | Middleware verified; CON-ZT-044 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-45** | Rate Limit | `POST /connectors/{id}/test` throttles excessive requests with 429 | `connectors.py:429`, `@rate_limit(10, 60)` | Middleware verified; CON-ZT-045 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-46** | Rate Limit | `POST /connectors/{id}/mcp/call` throttles excessive calls with 429 | `connectors.py:499`, `@rate_limit(10, 60)` | Middleware verified; CON-ZT-046 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-47** | Audit | Audit records created on connector create, update, and delete | `connectors.py:129,338,362`, `_record_connector_audit` | Code verified; CON-ZT-047 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-48** | Audit | Audit records created on MCP tool calls and Composio operations | `connectors.py:228,257,520`, `_record_connector_audit` | Code verified; CON-ZT-048 blocked by GAP-CON-01 | **PARTIALLY VERIFIED** |
| **CON-REQ-49** | Frontend | Connectors consolidated into Capabilities Workbench (`/capabilities?category=connectors`) | `capabilities/page.tsx`, `ConnectorsView.tsx` | Verified via `capabilities/page.spec.tsx:2` (PASSED) | **VERIFIED** |
| **CON-REQ-50** | Frontend | Claude Customize Connectors UI (Yours vs Discover, Category tabs) | `ConnectorsView.tsx:740` | Verified via `capabilities/page.spec.tsx:2` (PASSED) | **VERIFIED** |
| **CON-REQ-51** | Frontend | Master 260+ enterprise catalog with category filters and instant live search | `connectors-catalog.ts`, `ConnectorsView.tsx` | Verified via `capabilities/page.spec.tsx:6` (PASSED) | **VERIFIED** |
| **CON-REQ-52** | Frontend | Redundant "Connectors" link removed from sidebar navigation | `Sidebar.tsx` | Verified via `Sidebar.spec.tsx` (PASSED) | **VERIFIED** |
| **CON-REQ-53** | Frontend | Transparent client redirection from legacy `/connectors` to Capabilities | `connectors/page.tsx:12` | Verified via `connectors/page.spec.tsx:1` (PASSED) | **VERIFIED** |
| **CON-REQ-54** | Frontend | Dynamic modal suite (OAuth launcher, custom MCP/REST, tool inspector) | `ConnectorsView.tsx:1350` | Verified via `capabilities/page.spec.tsx:8` (PASSED) | **VERIFIED** |
