# Module 05: Embeddings Pipeline & Malicious Vector Neutralization
**Audit Identifier**: `AUD-M05-AI-15`
**Scope**: Vector generation, model dimensions (1536-d), batching, and zero-vector quarantine defense.

---

## 1. Vector Pipeline & Auto-Wiring

Implemented in `api/ingestion/pipeline.py` (`_persist_chunks_with_embeddings`):
- For every `TextChunk`, the system:
  1. Computes vector embedding (1536 dimensions, text-embedding-3-small or mock-safe equivalent).
  2. Inserts row into `embeddings` table linking `source_type="document_chunk"`.
  3. Inserts row into `document_chunks` table linking the created `embedding_id`.
  4. Inserts corresponding `Memory` row for unified chunk-level memory retrieval.

---

## 2. Zero-Vector Quarantine Defense

When indirect prompt injection or adversarial instructions are detected in a chunk during ingestion:
```python
# From api/ingestion/pipeline.py:253
if ch.metadata.get("quarantined"):
    emb = [0.0] * 1536  # Neutralized: mathematically orthogonal to normal text queries
```
This guarantees that poisoned text cannot rank high or hijack retrieval prompts via cosine similarity.

---

## 3. Verification Evidence

- `test_module05_prompts.py`:
  - `test_indirect_document_injection_quarantine`: Verifies flagged chunks are identified during chunking.
- `test_module05_rag.py`:
  - Validates embedding creation and vector record structure.
