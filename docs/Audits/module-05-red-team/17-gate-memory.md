# Gate 17 — Memory Lifecycle
## Verdict: FAIL
## Findings
| ID | Severity | File:Line | Description |
|----|----------|-----------|-------------|
| 1 | P0 | `apps/api/tests/test_module05_memory.py`:9-26 | Fake test. It simply instantiates a Pydantic/SQLAlchemy model in memory and asserts its fields without writing to a database. |
| 2 | P0 | `apps/api/src/api/agents/document_agent/handler.py`:1-167 | Document Agent does not interact with the memory system (read or write). It queries the `Document` SQL table directly. |

## Evidence
In `test_module05_memory.py`:
```python
rec = MemoryRecord(...)
assert rec.source_document_id == doc_id
```
This is an object instantiation test, not a real persistence test.

In `document_agent/handler.py`, the agent declares `memory_scopes = MemoryScopes(...)` but in `process` it manually runs a `select(Document)` statement instead of using memory context. No reads or writes to memory exist.

## Conclusion
The agent does not use the memory system. The tests are completely mocked and do not test actual memory persistence or lifecycle integration.
