# Gate 12 — Real Tool Calling
## Verdict: PARTIAL
## Findings
| ID | Severity | File:Line | Description |
|----|----------|-----------|-------------|
| 1 | P1 | `apps/api/tests/test_module05_tools.py:25-50` | Tool execution is tested solely against unit test mocks rather than real endpoint execution. |
| 2 | INFO | `apps/api/src/api/tools/definitions.py` | `ALL_TOOLS` contains definitions for document tools such as `search_documents` and `get_document_content`. |
| 3 | INFO | `apps/api/src/api/tools/executor.py` | The executor explicitly validates workspace boundaries and correctly blocks cross-workspace access attempts, isolating the query via `_ws_session`. |

## Evidence
- `test_module05_tools.py`:
```python
with pytest.raises(PermissionDeniedError) as exc:
    await execute_tool(
        tool=GET_DOCUMENT_CONTENT,
        params={"document_id": str(uuid.uuid4()), "workspace_id": attacker_ws},
        ...
```
- `executor.py`:
```python
async def _execute_get_document_content(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    ...
    if not doc or doc.workspace_id != ws_uuid or doc.deleted_at is not None:
        return {"status": "error", "tool": "get_document_content", "result": f"Document {document_id} not found in workspace"}
```

## Conclusion
Tool definitions exist and workspace isolation logic is present in the executor. However, similar to the other gates, the tests are unit-level only. The claim of "Real Tool Calling" is unsupported by any live integration tests, although the underlying logic appears structurally sound.
