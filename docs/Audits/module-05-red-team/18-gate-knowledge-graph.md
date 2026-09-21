# Gate 18 — Knowledge Graph Integration
## Verdict: FAIL
## Findings
| ID | Severity | File:Line | Description |
|----|----------|-----------|-------------|
| 1 | P0 | `apps/api/tests/test_document_kg_propagation.py`:50-77 | The test doesn't test propagation logic; it only instantiates static `CreateNodeRequest` objects and asserts their attributes. |
| 2 | P0 | `apps/api/src/api/services/knowledge_graph_service.py`:1-622 | There is no evidence of automatic extraction/propagation triggered upon document ingestion in this module. |

## Evidence
From `test_document_kg_propagation.py`:
```python
doc_node_req = CreateNodeRequest(..., properties={"source_document_id": doc_id, ...})
assert doc_node_req.properties["source_document_id"] == doc_id
```
This is a purely symbolic test. No actual KG service extraction logic or database persistence is exercised.

## Conclusion
The Knowledge Graph integration is not actually tested in an end-to-end or unit manner. The tests simply create constructor requests and assert the fields match, bypassing the real `KnowledgeGraphService` entity extraction and graph building logic. The claim of "100% GREEN" relies entirely on these fake tests.
