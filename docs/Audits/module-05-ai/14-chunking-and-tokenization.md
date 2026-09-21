# Module 05: Document Chunking & Tokenization Architecture
**Audit Identifier**: `AUD-M05-AI-14`
**Scope**: Semantic text chunking, character/token boundaries, overlap preservation, and metadata propagation.

---

## 1. Chunking Implementation

Implemented in `api/ingestion/chunking.py`:
- Function: `chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> list[TextChunk]`
- **TextChunk Data Model**:
  - `content`: Chunk text string.
  - `index`: Monotonic integer position within document.
  - `start_char`: Absolute start character offset in original source text.
  - `end_char`: Absolute end character offset in original source text.

---

## 2. Chunking Properties

1. **Boundary Alignment**: Chunks break preferentially on paragraph breaks (`\n\n`), sentence boundaries (`. `, `? `, `! `), or whitespace, preventing word truncation.
2. **Overlap Preservation**: Bounded overlap ensures sentences spanning chunk boundaries remain coherent for embedding and cross-chunk context retrieval.
3. **Quarantine Flagging**: `pipeline.py` attaches a `quarantined: bool` property to chunks flagged by `PromptInjectionMiddleware`.

---

## 3. Verification Evidence

- `test_module05_rag.py`:
  - Validates `chunk_text` produces non-empty chunks with positive character lengths.
- `test_module05_e2e.py`:
  - Validates end-to-end chunking preserves text offsets and correctly yields 2+ chunks for multi-sentence inputs.
