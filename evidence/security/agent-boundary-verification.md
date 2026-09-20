# Agent Security Boundary Verification

**Target**: `apps/api/src/api/routers/agents.py`,
`apps/api/src/api/orchestrator/`  
**Security Boundary**: Workspace Authorization, Tenant Context, Tool Execution
Permissions

---

## 1. Agent Boundary Controls

Every agent execution endpoint enforces strict pre-execution authentication and
workspace authorization:

```python
# agents.py:163-192
async def _verify_workspace_access(workspace_id: str, current_user: dict, db: AsyncSession) -> None:
    # 1. Parse and validate UUID format
    # 2. Query Workspace table (ownership)
    # 3. Query WorkspaceUser table (membership)
    # 4. If neither matches, raise HTTPException(404, "Workspace not found")
```

### Verified Endpoints:

1. `POST /api/v1/agents/chat`: Validates caller is member or owner of
   `workspaceId`.
2. `POST /api/v1/agents/chat/stream`: Validates caller membership before opening
   SSE stream.
3. `POST /api/v1/agents/runs/{request_id}/cancel`: Double-checks caller
   membership and run workspace binding before accepting cancellation requests.
4. `POST /api/v1/agents/{agent_id}/execute`: Requires valid user and tenant
   context.

---

## 2. Memory & Knowledge Graph Boundary

- Agents executing within Workspace A cannot query, retrieve, or write to
  Memory, Documents, or Knowledge Graph nodes belonging to Workspace B.
- Vector store searches and graph traversals are strictly parameterized by
  `workspace_id` and bounded by PostgreSQL RLS.
- Prompt injection defense: Untrusted inputs are scrubbed via
  `detect_adversarial_prompt()`; critical injection attempts immediately
  terminate execution before tool routing.
