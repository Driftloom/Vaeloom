# Gate 07 — Real Embedding/Vector E2E
## Verdict: FAIL
## Findings
| ID | Severity | File:Line | Description |
|----|----------|-----------|-------------|
| 1 | P1 | `apps/api/tests/conftest.py:277-313` | Embeddings are completely mocked across the entire test suite via the `mock_llm` autouse fixture. No real embedding models are invoked. |
| 2 | P1 | `apps/api/tests/test_module05_rag.py:23-41` | Vector store testing uses an in-memory `FallbackVectorStore`, not a real vector database like PGVector or Qdrant. |
| 3 | INFO | `apps/api/src/api/infrastructure/vector_store.py:95` | The zero-trust filter fails closed: if `filters` is empty or lacks `workspace_id`/`tenant_id`, it explicitly raises a `ValueError`. |

## Evidence
- `conftest.py`:
```python
@pytest_asyncio.fixture(autouse=True)
async def mock_llm(monkeypatch):
    """Return fake LLM responses — no real API calls."""
    ...
    async def fake_generate_embedding(self, text: str, *args, **kwargs) -> list[float]:
        return fake_embedding
```
- `test_module05_rag.py`:
```python
async def test_vector_store_zero_trust_isolation():
    store = FallbackVectorStore()
```

## Conclusion
The claim of "Real Embedding/Vector E2E" is false. The tests run against an in-memory mock vector store (`FallbackVectorStore`) and a mocked LLM service that returns a static array for embeddings. While the code does contain logic for PGVector and Qdrant, the test suite does not prove their functionality in an E2E capacity.
