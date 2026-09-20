# Module 04 — Connectors: Zero-Trust Security Findings & Remediation Report

**Audit Date**: 2026-09-20  
**Classification**: Enterprise Security Forensic Audit & Hardening  
**Target Subsystem**: Connectors, MCP Subprocesses, Composio SaaS Bridge, Native
ATS Crawler  
**Remediation Verdict**: All Findings Fully Remediated & Adversarially Proven

---

## 1. STRIDE Threat Modeling Matrix

| Threat Category            | Potential Attack Vector                                                                           | Mitigating Control & Architectural Hardening                                                                                                 | Test Evidence               |
| :------------------------- | :------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------- |
| **Spoofing**               | Forged workspace headers or impersonated tenant identities accessing external connectors          | Strict JWT claim extraction, `check_user_workspace_access()` DB query, `_get_authorized_connector()` fail-closed check.                      | `CON-ZT-001..010`           |
| **Tampering**              | Modifying another tenant's connector configuration or injecting shell commands into stdio args    | Authorization checks on `PUT`, interpreter blocklist (`bash`, `sh`, `powershell`, `cmd`), regex metacharacter filtering.                     | `CON-ZT-002, 021..027`      |
| **Repudiation**            | Connector creation, configuration changes, or tool executions performed without audit records     | Automatic synchronous recording into `audit_events` table for all lifecycle operations, MCP tool calls, and Composio flows.                  | `CON-ZT-047..048`           |
| **Information Disclosure** | Plaintext API keys leaked in responses; credentials extracted via SSRF or cloud metadata          | Fernet encryption at rest, `"******"` masking in all API responses, safe diagnostic health checks, SSRF URL policy with redirect inspection. | `CON-ZT-011..020, 029..036` |
| **Denial of Service**      | Flooding external sync or test endpoints triggering rate limit exhaustion or resource starvation  | In-flight concurrency mutex lock per connector ID, sliding-window rate limiters returning HTTP 429.                                          | `CON-ZT-043..046`           |
| **Elevation of Privilege** | Agent executing destructive write operations on enterprise SaaS (Slack, GitHub) without oversight | Dynamic tool bridging registers state-modifying actions with `mark_approval_gated()`, halting ReAct loop for human approval.                 | `CON-ZT-039`                |

---

## 2. In-Depth Security Findings & Remediation

### Finding 1: Server-Side Request Forgery (SSRF) & Network Perimeter Bypass

- **Vulnerability**:
  1. `ConnectorExtService.trigger_sync` and `test_connection` previously relied
     only on basic static URL checks. An attacker could register a public domain
     (e.g. `https://attacker.com/redirect`) that returns an HTTP 302 redirecting
     to `http://169.254.169.254/latest/meta-data/` or
     `http://127.0.0.1:8000/api/v1/admin`.
  2. `api/mcp_servers/job_search_mcp.py` executed unconstrained `httpx.get()`
     requests against user-provided URLs in `fetch_job_details`.
  3. `McpClientService` allowed streamable-HTTP MCP connections to bypass cloud
     metadata blocking when `allow_insecure=True` was passed.
- **Remediation Implemented**:
  1. In `connector_ext_service.py`:
     - Added `_check_url_policy_sync` verifying schemes (`http`, `https`),
       domain blocklists (`localhost`, `metadata.google.internal`), and IP
       subnets (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
       `169.254.0.0/16`).
     - Added redirect inspection loop in `trigger_sync()` and
       `test_connection()` using `assert_public_http_url` before following any
       redirect location header.
  2. In `job_search_mcp.py`:
     - Integrated `assert_public_http_url(job_url)` at the entry point of
       `fetch_job_details`, immediately failing closed on private, loopback, or
       metadata targets.
  3. In `mcp_client_service.py`:
     - Hardened `_run_with_session` and `validate_mcp_config` so
       `169.254.169.254` is unconditionally blocked regardless of
       `allow_insecure`.
- **Adversarial Proof**: Tests `CON-ZT-011` through `CON-ZT-020` verify
  fail-closed blocks across loopback, link-local, private subnets, redirect
  escapes, native ATS scraper, and HTTP MCP sessions.

```python
# Remediation in connector_ext_service.py (Redirect Inspection)
if 300 <= resp.status_code < 400 and "Location" in resp.headers:
    redirect_url = resp.headers["Location"]
    try:
        assert_public_http_url(redirect_url)
    except UrlBlockedError as e:
        logger.warning("SSRF blocked redirect for connector %s: %s", connector_id, e)
        return {"status": "error", "error": f"SSRF blocked redirect: {e}"}
```

---

### Finding 2: Command Injection & Subprocess Sandboxing

- **Vulnerability**: MCP stdio transport executes local processes
  (`subprocess.Popen` / `asyncio.create_subprocess_exec`). Attackers with
  workspace access could supply shell metacharacters or interpreters to break
  out of the command string. Furthermore, Windows installations were vulnerable
  to batch variable expansion characters (`^`, `%`, `!`).
- **Remediation Implemented**:
  1. In `mcp_client_service.py:validate_mcp_config`:
     - Denied shell interpreters: `bash`, `sh`, `powershell`, `cmd`, `cmd.exe`,
       `pwsh`.
     - Denied POSIX shell metacharacters in command: `;&|`$\n`.
     - Denied shell chaining metacharacters in arguments: `&&`, `|`, `>`, `<`.
     - Denied Windows batch metacharacters: `^`, `%`, `!`.
     - Enforced strict type checking (arguments must be a list of strings,
       environment variables must be a dictionary of strings).
  2. Windows `.cmd` and `.bat` scripts are resolved and wrapped in explicit
     argument vectors to prevent interpreter hijacking.
- **Adversarial Proof**: Tests `CON-ZT-021` through `CON-ZT-028` verify
  rejections of all interpreter types, metacharacters, and malformed inputs.

---

### Finding 3: Plaintext Credential Exposure & Response Leakage

- **Vulnerability**:
  1. Variant sensitive keys such as `client_secret`, `private_key`, and
     `access_token` were not caught by existing exact-match filters and were
     persisted unencrypted in the database.
  2. Outbound connector responses (`POST /connectors`, `GET /connectors/{id}`,
     `GET /connectors`, `PUT /connectors/{id}`) returned raw configuration
     dictionaries containing decrypted credentials.
  3. Diagnostic health endpoints lacked safe masking, creating potential
     disclosure vectors.
- **Remediation Implemented**:
  1. In `connector_ext_service.py`:
     - Added comprehensive regex matcher
       `_SENSITIVE_KEY_RE = re.compile(r"(?i)(api[_-]?key|auth[_-]?token|secret|password|bearer|private[_-]?key|access[_-]?token|credential)")`.
     - Created `mask_sensitive_config(config)` which replaces any matching
       sensitive key value with `"******"`.
     - Added `get_health()` diagnostic method that returns connector status,
       error messages, and configured key names without secret values.
  2. In `connectors.py`:
     - Applied `_mask_connector_response(connector)` across `create_connector`,
       `get_connector`, `list_connectors`, and `update_connector`.
- **Adversarial Proof**: Tests `CON-ZT-029` through `CON-ZT-036` inspect raw
  SQLite database rows to verify Fernet ciphertext and verify `"******"` masking
  in all API responses.

```python
# Remediation in connector_ext_service.py (Regex Detection & Masking)
_SENSITIVE_KEY_RE = re.compile(
    r"(?i)(api[_-]?key|auth[_-]?token|secret|password|bearer|private[_-]?key|access[_-]?token|credential)"
)

def mask_sensitive_config(config: dict[str, Any] | None) -> dict[str, Any]:
    if not config or not isinstance(config, dict):
        return {}
    masked = copy.deepcopy(config)
    for k, v in list(masked.items()):
        if _SENSITIVE_KEY_RE.search(k):
            masked[k] = "******"
        elif isinstance(v, dict):
            masked[k] = mask_sensitive_config(v)
    return masked
```

---

### Finding 4: Multi-Tenant Workspace Boundary Enforcement

- **Vulnerability**: If an authenticated user belonging to Workspace B possessed
  the UUID of a connector in Workspace A, lack of explicit authorization checks
  would allow them to read configuration, update credentials, trigger
  synchronization, or execute MCP tools.
- **Remediation Implemented**:
  1. In `connectors.py`:
     - Implemented
       `_get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)`
       as a mandatory gate on all parameterized operations.
     - Performs database lookup with tenant and workspace filtering, raising 404
       if not found or 403 if the user does not have membership in the
       connector's workspace via `check_user_workspace_access()`.
     - Added explicit route ordering placing static subpaths (`/composio/...`,
       `/mcp/builtin`) before `/{connector_id}` to prevent route collision.
- **Adversarial Proof**: Tests `CON-ZT-001` through `CON-ZT-010` prove that User
  B receives 404/403 across GET, PUT, DELETE, SYNC, TEST, and MCP tool execution
  attempts against Workspace A's connectors.

---

### Finding 5: Composio SaaS Integration & Human-in-the-Loop Governance

- **Vulnerability**: Autonomous agents executing actions on external SaaS
  platforms (e.g., Slack, GitHub, Jira) could perform destructive mutations
  without human oversight. Additionally, unconfigured Composio credentials could
  cause uncaught exceptions.
- **Remediation Implemented**:
  1. In `composio_service.py`:
     - Enforced workspace-scoped entity ID format (`workspace_{workspace_id}`)
       to prevent cross-tenant data leakage within Composio's multi-tenant
       backend.
     - Added fail-closed status reporting returning `COMPOSIO_API_KEY_REQUIRED`
       when unconfigured.
     - Implemented `bridge_workspace_tools()` which registers tools with
       `mark_approval_gated(tool_name)` for write operations (e.g.,
       `composio__slack__send_message`, `composio__github__create_issue`).
- **Adversarial Proof**: Tests `CON-ZT-037` through `CON-ZT-042` verify catalog
  discovery, OAuth connect URL generation, dynamic bridging, approval gating,
  and unauthenticated request rejection.
