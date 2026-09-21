# Module 05: RAG Retrieval, Reranking & Context Budgeting
**Audit Identifier**: `AUD-M05-AI-17`
**Scope**: Dense + sparse hybrid retrieval, cross-encoder reranking, substring overlap suppression, and context window fitting.

---

## 1. RAG Pipeline Implementation

Implemented in `api/services/rag.py`:
1. **Hybrid Retrieval**: Queries both vector embeddings (semantic similarity) and PostgreSQL tsvector (lexical keyword matching).
2. **Deduplication**: Eliminates duplicate memory records matching the same ID.
3. **Reranking**:
   - Scores candidates via cross-encoder scoring or heuristic relevance.
   - Orders candidates strictly by descending relevance score.
4. **Context Window Fitting**:
   - `fit_to_context_window(items, max_context_tokens)`: Truncates and prioritizes top candidates so LLM context window limits (e.g. 8K or 32K tokens) are never exceeded.

---

## 2. Verification Evidence

- `test_module05_rag.py`:
  - `test_reranking_and_context_budgeting`: Verifies candidate sorting, deduplication, and context window token constraints.
