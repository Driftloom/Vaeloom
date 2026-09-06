# IMMUTABLE MUSE SECURITY HANDOFF CONTRACT

**Effective Date:** 2026-09-06  
**Audience:** Muse Phase B Runtime & Agentic Engineering Owner  
**Authority:** Vaeloom Zero-Trust Security Architecture Gate  
**Verdict:** **READY FOR MUSE**

---

## 0. PURPOSE & GOVERNING PRINCIPLE

This document constitutes an **immutable security contract** governing all
development, refactoring, and feature additions during **Muse Phase B** (Durable
State, Temporal / LangGraph loops, Checkpointing, Recovery, Runtime Provenance)
and beyond.

Any architecture, orchestrator change, execution loop, worker implementation, or
API endpoint introduced by Muse that bypasses, disables, weakens, or fails to
uphold the 14 mandatory invariants below is **NON-COMPLIANT AND AUTOMATICALLY
REJECTED**.

---

## 1. THE 14 IMMUTABLE SECURITY INVARIANTS

### 1. Tenant Isolation

Every database transaction, memory lookup, search index query, and agent
execution MUST strictly verify tenant ownership. Cross-tenant leakage (even
within the same plan or organization) is forbidden.

### 2. Workspace Isolation

Workspaces are strictly isolated boundaries. User A in Workspace A cannot read,
mutate, delete, or reference memories, documents, embeddings, resumes, or
connectors belonging to Workspace B unless authorized by explicit
database-backed membership.

### 3. Fail-Closed Authorization

All authorization checks MUST fail closed.

- Missing, empty, or unparseable `workspace_id` MUST raise an immediate
  exception and reject the operation.
- Missing or unset PostgreSQL session variables (`app.current_tenant_id`,
  `app.current_workspace_id`) MUST return zero rows. No fallback to un-scoped
  queries is permitted.

### 4. Target PostgreSQL Row Level Security (RLS)

The production PostgreSQL database enforces RLS across all 28 policy-bearing
tables. All application database queries MUST execute under the non-superuser
application role (`vaeloom_app`) with active RLS. No query or migration may
disable RLS or grant `BYPASSRLS` to application roles.

### 5. Pooled DB Context Isolation

Database connections are pooled. Every transaction MUST set transaction-local
GUCs using `set_config('app.current_tenant_id', ..., true)` and
`set_config('app.current_workspace_id', ..., true)`. Transaction commit or
rollback MUST guarantee that no context leaks to subsequent pooled connection
reuses.

### 6. AgentCard Capability Enforcement

Every agent invocation (whether interactive ReAct, graph-dispatched, or static
default) MUST resolve the agent's authoritative `AgentCard`. The dispatcher MUST
verify:

- `card.status == 'ACTIVE'` (inactive or deprecated agents are blocked).
- Tools invoked by the agent MUST be explicitly declared in `card.tools`. Any
  tool call outside declared tools MUST be denied with `PermissionDeniedError`.

### 7. Approval Integrity & Stable Identity

Human-in-the-loop approvals MUST bind to the stable canonical hash of the action
payload (SHA-256 HMAC), the `agent_name`, `action_type`, and `workspace_id`.
Approvals MUST NOT bind to ephemeral request IDs that mutate across retries.
Tampered payloads MUST invalidate the approval match.

### 8. Approval Atomicity & Anti-Replay

Consequential agent operations (file renames, file moves, external
communications, database writes) MUST require explicit approval and MUST consume
the approval token via atomic single-use row-level state transition:

```sql
UPDATE agent_approvals
SET status = 'CONSUMED', updated_at = :now
WHERE id = :id AND status = 'APPROVED'
```

Replays or concurrent double-consumption attempts MUST be denied and re-prompted
for human approval.

### 9. Prompt Trust Boundaries & Structural Quarantine

Untrusted external data, retrieved documents, user input, and tool returns MUST
be quarantined using `<untrusted-data source="...">` boundary tags via
`quarantine()`. Structural breakout attempts (such as injected
`</untrusted-data>` tags) MUST be neutralized. Textual persuasion from prompts
MUST NOT create authorized side effects without passing through capability and
approval gates.

### 10. Authenticated Background Security Envelopes

Every background task, queue job, or scheduled agent slot enqueued to
Redis/BullMQ/Temporal MUST carry an authoritative `BackgroundSecurityEnvelope`.
Raw, un-enveloped background execution is forbidden. The envelope MUST
cryptographically bind `tenant_id`, `workspace_id`, `user_id`, `agent_id`,
`action`, `issued_at`, `expires_at`, `nonce`, and `payload_hash`.

### 11. Worker Execution Authorization

Background workers MUST verify:

- HMAC-SHA256 signature validity.
- Expiration (`now < expires_at`).
- Single-use nonce uniqueness against replay attacks.
- Authoritative database workspace access (`check_user_workspace_access`).
- Execution MUST be wrapped in an active `TenantContext`.

### 12. Side-Effect Controls

Security rejection MUST guarantee zero side effects:

- No database mutation.
- No external connector invocation.
- No approval consumption.
- No memory modification.

### 13. Auditability

All authorization denials, permission checks, and capability rejections MUST
emit structured audit log entries capturing `who`, `tenant`, `workspace`,
`action`, `resource`, `timestamp`, and `reason`. Audit logs MUST NEVER expose
raw secrets, authentication tokens, or encryption keys.

### 14. MCP Bounded Execution

Model Context Protocol (MCP) local stdio connectors execute with least-privilege
host permissions. All connector credentials and tokens MUST be encrypted at rest
with AES-256-GCM. Shell interpreters (`bash`, `sh`, `cmd.exe`, `powershell.exe`)
are strictly prohibited in MCP server configurations. Mutating tools MUST be
approval-gated.

---

## 2. COMPLIANCE CHECKLIST FOR MUSE IMPLEMENTATION

Before merging any Muse Phase B commit:

- [ ] Run
      `uv run python -m pytest apps/api/tests/test_security_phase_a.py -v -o addopts=""`
      (Must achieve 30/30 PASSED).
- [ ] Run
      `uv run python -m pytest apps/api/tests/test_rls_target_vaeloom.py -v -o addopts=""`
      (Must achieve 1/1 PASSED).
- [ ] Verify that no new agent execution path bypasses `AgentCard` or
      `TenantContext`.
- [ ] Verify that durable state machines and checkpointing serialize within the
      tenant/workspace boundary.
