# Identity, Multi-Tenancy & Workspace Isolation Forensic Audit

## 1. Executive Summary

This audit evaluates how user identity, workspace boundaries, and organization
multi-tenancy are validated across the API and agent execution layers.

### Critical Finding: P0 Identity Fallback Vulnerability (`SEC-P0-02`)

- **Location**: `apps/api/src/api/orchestrator/context_loader.py:88-96`
- **Defect**: If `user_id` is None or omitted from the request, the context
  loader queries the database for _any_ user in the workspace and impersonates
  them.

---

## 2. Code Evidence: The Context Loader Fallback Flaw

From `apps/api/src/api/orchestrator/context_loader.py`:

```python
88:                 resolved_user_id = user_id
89:                 if not resolved_user_id:
90:                     try:
91:                         from ..models.schema import WorkspaceUser
92:                         wu_stmt = select(WorkspaceUser.user_id).where(WorkspaceUser.workspace_id == uuid.UUID(str(workspace_id))).limit(1)
93:                         wu_res = await session.execute(wu_stmt)
94:                         resolved_user_id = wu_res.scalar_one_or_none()
95:                     except Exception:
96:                         resolved_user_id = None
```

### Exploit & Risk Vector

1. An unauthenticated or background process triggers an agent execution
   specifying only a `workspace_id`.
2. The orchestrator executes `select(WorkspaceUser.user_id)...limit(1)`.
3. The first returned user's profile, personal career history, private notes,
   and documents are loaded into `context.profile`.
4. The agent executes actions and responds on behalf of that user, violating
   privacy and security isolation.

---

## 3. AgentRequest Schema Weakness

In `apps/api/src/api/schemas/agent.py` and `loop.py`:

- `AgentRequest.user_id` is typed as `Optional[str] = None`.
- Requests originating from background cron triggers, webhooks, or
  unauthenticated mocks can execute without an explicit identity claim.

---

## 4. Required Remediation Standard

1. **Delete Fallback Query**: Completely remove lines 88-96 in
   `context_loader.py`.
2. **Enforce Non-Null Identity**:
   - In `packages/agent-contracts/vaeloom_agent_contracts/request.py`:
     ```python
     class AgentRequest(BaseModel):
         workspace_id: UUID
         tenant_id: UUID
         user_id: UUID  # Non-null! Never Optional!
         agent_name: str
         input_text: str
     ```
3. **Fail-Closed Context Loader**:
   - If `user_id` is missing, immediately raise
     `SecurityIsolationError("AgentRequest requires non-null user_id")`.
