# Agent 01 (Orchestrator / Supervisor) — Zero-Trust Security Audit

- **Audit Target**: Agent 01 — Orchestrator Gateway, Router, Supervisor, and
  ReAct Execution Loop
- **Security Standard**: Enterprise Zero-Trust Architecture (NIST SP 800-207
  Parity)
- **Evaluation Date**: 2026-09-21
- **Auditor Role**: Principal Enterprise Security Engineer & Zero-Trust Auditor
- **Status**: **SECURITY COMPLIANT (0 Critical, 0 High, 0 Medium Open
  Vulnerabilities)**

---

## 1. STRIDE Threat Model & Defense Matrix

| Threat Category            | Potential Attack Vector                                                                             | Orchestrator Zero-Trust Defense                                                                                                                                 | Verification Status   |
| :------------------------- | :-------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| **Spoofing**               | Attacker passes legitimate JWT but supplies arbitrary `user_id` in request JSON body                | Strict assertion `dto.user_id == current_user["sub"]` in `apps/api/src/api/routers/orchestrator.py`; returns HTTP 403 on mismatch.                              | **VERIFIED (PROVEN)** |
| **Tampering**              | Attacker modifies JWT token payload or signature                                                    | Cryptographic signature verification via `jwt.decode` using `settings.jwt_secret` and `settings.jwt_algorithm`; returns HTTP 401 on tampering.                  | **VERIFIED (PROVEN)** |
| **Repudiation**            | Actions performed without audit trail or accountable user identity                                  | Every turn generates a non-null `request_id`, user-bound `SecurityContext`, and cryptographic hash-chained audit event.                                         | **VERIFIED (PROVEN)** |
| **Information Disclosure** | User attempts IDOR by supplying another workspace's ID to access data across boundaries             | Explicit call to `check_user_workspace_access(session, workspace_id, user_id, tenant_id)`. If user lacks active membership, request is rejected with HTTP 403.  | **VERIFIED (PROVEN)** |
| **Denial of Service**      | Infinite recursive loops, circular DAG delegation, or tool budget exhaustion                        | Supervisor cycle detection prunes duplicate nodes. `LoopSafetyTracker` enforces hard caps (max 3 iterations, 12 tools, $0.50 budget, 120s timeout).             | **VERIFIED (PROVEN)** |
| **Elevation of Privilege** | Agent attempts to invoke mutating tool (`send_external_email`, `delete_user_data`) without approval | Unified `_react_approval_gate` pauses execution in `paused_awaiting_approval`, issuing single-use approval token. Action executes ONLY after valid consumption. | **VERIFIED (PROVEN)** |

---

## 2. Authentication & Identity Architecture

```
[Inbound HTTP POST /api/v1/orchestrator/execute]
                       │
                       ▼
            [FastAPI Dependency Injection]
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[get_current_user]           [get_tenant_id]
         │                           │
  Decodes JWT token           Extracts from claims / state
  Checks expiration (exp)     Defaults to context tenant
  Validates HMAC signature                    │
         │                                    │
         └─────────────┬──────────────────────┘
                       │
                       ▼
        [Caller Identity Verification]
         assert dto.user_id == current_user["sub"]
         (Rejects forged identity with 403 Forbidden)
                       │
                       ▼
        [Workspace Boundary Verification]
         check_user_workspace_access(db, ws_id, user_id, tenant_id)
         (Rejects cross-workspace IDOR with 403 Forbidden)
                       │
                       ▼
         Proceeds to Orchestration Loop
```

### Zero-Trust Invariants

1. **Never Trust Request Body for Identity**: The caller's `user_id` and
   `tenant_id` are derived strictly from the cryptographic JWT claims. Request
   body parameters cannot elevate privilege or redirect identity.
2. **Fail-Closed on Auth Absence**: If the `Authorization` header is missing,
   malformed, or signed by an untrusted key, FastAPI immediately halts execution
   with HTTP 401.

---

## 3. Authorization & Tool Execution Boundaries

The Orchestrator governs two classes of tools:

### 3.1 Non-Mutating / Autonomous Tools (Permitted)

- `web_search`: Search queries bounded to read-only search providers.
- `query_graph`: Graph read queries restricted to entities within the authorized
  workspace.
- `search_documents`: Vector embeddings and semantic document search scoped
  strictly by `workspace_id`.
- `calculate_semantic_ats_score`: Read-only keyword and format scoring.

### 3.2 Mutating / Approval-Gated Tools (Strict Human Approval Required)

- `send_external_email`: External communication requires human sign-off.
- `submit_job_application`: Consequential job submission triggers approval
  request.
- `delete_user_data`: Destructive action pauses execution.
- `modify_connector_credentials`: Write-level connector modification requires
  administrator confirmation.

### 3.3 Approval Token Mechanics

1. Tool proposal detected in `_react_approval_gate`.
2. Hash generated: `SHA256(workspace_id + agent_name + tool_name + args)`.
3. If no matching `APPROVED` record exists in `agent_approvals`, state
   transitions to `paused_awaiting_approval`.
4. Response returns an approval card with unique `approval_id`.
5. When user approves via UI, record marked `APPROVED`.
6. Next execution atomizes consumption (`CONSUMED`), ensuring single-use
   execution with replay immunity.

---

## 4. Multi-Tenancy & Cross-Workspace Isolation

Multi-tenancy isolation is enforced at two distinct layers:

1. **Application Gateway Layer**: `check_user_workspace_access` queries
   `workspaces` and `workspace_users` to verify user membership within the
   specific tenant boundary.
2. **State Store Layer (`ForeignCheckpointError`)**: When resuming a loop state
   from a checkpoint, `validate_resume_identity` verifies:
   - `state.workspace_id == incoming.workspace_id`
   - `state.tenant_id == incoming.tenant_id`
   - `state.user_id == incoming.user_id` Any discrepancy immediately raises
     `ForeignCheckpointError`, failing closed to prevent state corruption or
     cross-tenant context injection.

---

## 5. Secret Redaction & Log Sanitation

All log sinks, error traces, and checkpoint storage pass through `scrub_pii`:

- **API Keys**: Patterns matching `sk-[a-zA-Z0-9\-_]{16,}` replaced with
  `[REDACTED_API_KEY]`.
- **Bearer Tokens**: JWT tokens matching `Bearer [A-Za-z0-9\-_~+/]+=*` replaced
  with `Bearer [REDACTED_TOKEN]`.
- **Emails**: Email addresses matching standard patterns masked as
  `[REDACTED_EMAIL]`.
- **Credit Cards**: Card digits masked as `[REDACTED_CREDIT_CARD]`.

---

## 6. Security Vulnerability Ledger

| ID                      | Severity        | Description                                                                       | Remediated In                                               | Verified By                           |
| :---------------------- | :-------------- | :-------------------------------------------------------------------------------- | :---------------------------------------------------------- | :------------------------------------ |
| `SEC-01-GATEWAY-AUTH`   | **P0 Critical** | Missing `get_current_user` and `check_user_workspace_access` in `/execute` router | `apps/api/src/api/routers/orchestrator.py`                  | `test_gate_01_*` and `test_gate_02_*` |
| `SEC-01-AGENT01-WIRING` | **P1 High**     | Inert stub in `agents/career-agent` lacked policy checks and delegation controls  | `agents/career-agent/src/vaeloom_career_agent/handler.py`   | `test_career_agent_*`                 |
| `SEC-01-PII-REDACTION`  | **P2 Medium**   | PII scrubber failed on hyphenated Anthropic and OpenAI keys                       | `packages/agent-security/src/vaeloom_agent_security/pii.py` | `test_gate_08_*`                      |

**Security Verdict**: All identified vulnerabilities have been remediated,
verified by fresh runtime tests, and sealed against regression.
