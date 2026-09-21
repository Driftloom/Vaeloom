# Module 05: Tool Execution Security & IDOR Defense
**Audit Identifier**: `AUD-M05-AI-20`
**Scope**: MCP-shaped tool schemas, scope authorization (`memory.read`, `memory.write`), parameter tampering checks, and audit logging.

---

## 1. Tool Execution Protocol

Implemented in `api/tools/definitions.py` and `api/tools/executor.py`:
- Registered Tools: `search_documents`, `get_document_content`, `list_workspace_folders`, `create_workspace_folder`, `get_document_version`, `restore_document_version`, `share_workspace_document`, `get_document_audit_history`.
- Schema Standard: Follows MCP standard (name, description, `input_schema`, `output_schema`, `required_scope`).
- Scope Checking: Agents must possess matching scopes in their runtime card before executing tools.

---

## 2. Multi-Tenant IDOR & Tampering Guard

`execute_tool()` enforces:
1. `workspace_id` is mandatory.
2. If `params["workspace_id"]` is passed, it must equal the authenticated `workspace_id`. If an attacker passes a foreign workspace ID, `PermissionDeniedError` is thrown immediately and logged as `cross_workspace_tamper`.

---

## 3. Verification Evidence

- `test_module05_tools.py`:
  - `test_document_tool_declarations`: Verifies presence of all enterprise document tools in `ALL_TOOLS`.
  - `test_document_tools_workspace_boundary_enforcement`: Verifies mandatory `workspace_id` and blocks cross-workspace tampering.
