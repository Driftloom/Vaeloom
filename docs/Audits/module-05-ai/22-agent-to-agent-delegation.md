# Module 05: Agent-to-Agent Delegation & Identity Scoping
**Audit Identifier**: `AUD-M05-AI-22`
**Scope**: A2A communication, token passing, scope attenuation, and delegation boundaries.

---

## 1. A2A Delegation Architecture

When a primary agent (e.g. `WorkspaceAgent` or `Orchestrator`) delegates a subtask to `DocumentAgent`:
- **Identity Passthrough**: `request_id`, `correlation_id`, `workspace_id`, and `tenant_id` are preserved across the invocation payload.
- **Scope Attenuation**: The delegated agent cannot inherit broader scopes than the caller. Specifically, `DocumentAgent` cannot be granted write scopes (`memory.write` or `connector.write`) via delegation if the delegating agent does not possess them.
- **Audit Logging**: A2A handoffs log caller agent ID, target agent ID, and subtask goals in `audit_events`.

---

## 2. Verification Evidence

- `test_module05_agent_to_agent.py`:
  - `test_agent_delegation_scope`: Validates that delegated tool calls maintain original workspace binding and respect attenuated scope boundaries.
