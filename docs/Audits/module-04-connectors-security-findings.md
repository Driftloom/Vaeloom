# Module 04 — Connectors: Zero-Trust Security Findings & Threat Analysis

**Audit Timestamp**: 2026-09-21T22:30:00+05:30  
**Lead Auditor**: Antigravity Zero-Trust Verification Agent  
**Classification**: Enterprise Security Forensic Audit  
**Target Subsystem**: Connectors, MCP Subprocesses, Composio SaaS Bridge, Native ATS Crawler  

---

## 1. STRIDE Threat Modeling Matrix

| Threat Category | Potential Attack Vector | Mitigating Control & Architectural Hardening | Actual Implementation Status | Zero-Trust Verification State |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Forged workspace headers or impersonated tenant identities accessing external connectors | Strict JWT claim extraction, `check_user_workspace_access()` DB query, `_get_authorized_connector()` fail-closed check. | Implemented in `routers/connectors.py:76-110` | Code verified; `test_connectors.py` passes. CON-ZT-001 blocked by GAP-CON-01. |
| **Tampering** | Modifying another tenant's connector configuration or injecting shell commands into stdio args | Authorization checks on `PUT`, interpreter blocklist (`bash`, `sh`, `powershell`, `cmd`), regex metacharacter filtering (`_SHELL_METACHARS`). | Implemented in `routers/connectors.py:324` and `services/mcp_client_service.py:39-95` | Verified via `test_mcp_client_service.py` (24/24 green). |
| **Repudiation** | Connector creation, configuration changes, or tool executions performed without audit records | Automatic synchronous recording into `audit_events` table for all lifecycle operations, MCP tool calls, and Composio flows. | Implemented in `routers/connectors.py:53-74` | Code verified. CON-ZT-047..048 blocked by GAP-CON-01. |
| **Information Disclosure** | Plaintext API keys leaked in responses; credentials extracted via SSRF or cloud metadata | Fernet encryption at rest, `"******"` masking in all API responses, safe diagnostic health checks, SSRF URL policy with redirect inspection. | Implemented in `services/connector_ext_service.py:17,309` and `routers/connectors.py:35` | Verified via `test_connector_ext_service.py` (35/35 green) and manual response verification. |
| **Denial of Service** | Flooding external sync or test endpoints triggering rate limit exhaustion or resource starvation | Concurrency mutex lock per connector ID, sliding-window rate limiters returning HTTP 429 (10 req/min). | Implemented in `services/connector_ext_service.py:379` and `@rate_limit` decorator | Verified via `temporal/test_connector_sync.py` (3/3 green). Multi-process lock is process-local (FIND-CON-002). |
| **Elevation of Privilege** | Agent executing destructive write operations on enterprise SaaS (Slack, GitHub) without oversight | Dynamic tool bridging registers state-modifying actions with `mark_approval_gated()`, halting ReAct loop for human approval. | Implemented in `services/mcp_client_service.py:58,316` and `tools/executor.py` | Verified via `test_mcp_client_service.py:265` (PASSED). |

---

## 2. In-Depth Security Findings

### FIND-CON-001 (P0): Adversarial Test Fixture Blindness via LLMService Syntax Regression
- **Vulnerability**: The entire 61-test zero-trust adversarial test suite (`test_connectors_zero_trust_adversarial.py`) and the 10-test MCP integration test suite (`test_mcp_connectors.py`) fail to execute in CI due to an `AttributeError` during fixture setup.
- **Root Cause**: An unrelated commit (`e7846ce1`) modified `apps/api/src/api/services/llm_service.py`, defining `def _normalize_anthropic_tools` at column 0 (line 1067). This cut off `class LLMService`, turning all subsequent methods (including `generate_completion_stream` at line 1377) into local closures of `_normalize_anthropic_tools`.
- **Security Impact**: The system has lost continuous automated security regression testing for multi-tenant isolation, SSRF URL policy validation, shell interpreter rejection, and response credential masking.
- **Remediation Required**:
  1. Fix indentation of `_normalize_anthropic_tools` in `apps/api/src/api/services/llm_service.py`.
  2. Add `raising=False` to `monkeypatch.setattr(LLMService, "generate_completion_stream", ..., raising=False)` in `tests/security/conftest.py:336` and `tests/integration/conftest.py:244`.

### FIND-CON-002 (P2): Process-Local In-Memory Mutex for Connector Sync
- **Vulnerability**: `ConnectorExtService.trigger_sync` manages concurrent syncs via an in-memory dictionary `_sync_locks: dict[str, asyncio.Lock]`.
- **Security Impact**: In a horizontally scaled production deployment with multiple Uvicorn worker processes or Kubernetes pods, two concurrent requests to `POST /api/v1/connectors/{id}/sync` routed to different processes bypass the in-memory lock, allowing duplicate simultaneous outbound requests and state corruption.
- **Remediation Required**: Migrate sync locking to Redis distributed lock (`redlock`) or PostgreSQL advisory locking.

### FIND-CON-003 (P3): Composio Gateway OAuth Secret Decoupling
- **Vulnerability**: Composio SaaS integrations rely on external Composio cloud vault storage for third-party OAuth access and refresh tokens. If the Composio API key is compromised, an attacker could access connected third-party SaaS accounts.
- **Security Impact**: Reliance on a third-party gateway for OAuth token persistence requires strict Infisical vault security for `COMPOSIO_API_KEY`.
- **Mitigating Control**: Vaeloom isolates entities per workspace (`entity_id = "workspace_" + workspace_id`), preventing cross-workspace account mixing.
