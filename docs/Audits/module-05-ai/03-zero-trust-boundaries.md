# Module 05: Zero-Trust Boundaries & Perimeter Verification
**Audit Identifier**: `AUD-M05-AI-03`
**Scope**: Micro-segmentation, fail-closed perimeters, and boundary isolation across memory, tools, and storage.

---

## 1. Zero-Trust Architectural Rules

In Vaeloom Module 05, zero-trust means:
1. **Never trust client parameters**: Even if a request contains a valid JWT, the workspace context in URL parameters and body payloads must match the authorized tenant session.
2. **Never trust uploaded files**: Files are treated as untrusted binary blobs until validated by `FileSecurityService` magic-byte inspection, MIME detection, and prompt injection scanning.
3. **Never allow un-scoped vector queries**: Vector searches cannot execute across the global index. If `workspace_id` or `tenant_id` is missing from `filters`, `VectorStore.search()` raises `ValueError` fail-closed.
4. **Never execute tools without workspace context**: `execute_tool()` rejects any invocation where `workspace_id` is empty or where parameters attempt to cross workspaces.

---

## 2. Verification Evidence

### 2.1 Vector Store Fail-Closed Enforcement
```python
# From api/infrastructure/vector_store.py:281
if not filters or ("workspace_id" not in filters and "tenant_id" not in filters):
    raise ValueError("Zero-Trust violation: vector search must specify tenant_id or workspace_id filter")
```
Verified in `test_module05_rag.py` and `test_module05_chaos.py`.

### 2.2 Tool Execution Perimeter
```python
# From api/tools/executor.py:3398
if not workspace_id or not str(workspace_id).strip():
    raise ValueError(f"workspace_id is required for tool execution (tool '{tool.name}')")
```
Verified in `test_module05_tools.py`.

### 2.3 Cross-Workspace Parameter Tampering
```python
# From api/tools/executor.py:3410
if param_ws and param_ws != ctx_ws:
    raise PermissionDeniedError(
        f"Cross-workspace tool execution prohibited: param workspace_id '{param_ws}' != context '{ctx_ws}'"
    )
```
Verified in `test_module05_tools.py`.
