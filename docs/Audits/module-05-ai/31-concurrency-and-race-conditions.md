# Module 05: Concurrency, Deduplication & Race Conditions
**Audit Identifier**: `AUD-M05-AI-31`
**Scope**: Cryptographic deduplication, fuzzy filename matching, optimistic locking, and concurrent upload handling.

---

## 1. Concurrency Controls

Implemented in `api/ingestion/dedup.py`:
- **Content Hash Deduplication**: `compute_content_hash(content)` calculates SHA-256 digests. If an identical file is uploaded simultaneously, the system links to the existing version rather than duplicating storage.
- **Fuzzy Filename Matching**: `filename_similarity()` detects minor variations (`resume_v1.pdf` vs `resume_v2.pdf`) using `difflib.SequenceMatcher` (> 0.85 threshold).
- **Undo Concurrency**: `undo_action` verifies that no intervening mutations have invalidated the undo snapshot before reverting document state.

---

## 2. Verification Evidence

- `test_module05_concurrency.py`:
  - `test_content_hash_deterministic_dedup`: Verifies SHA-256 determinism across identical payloads.
  - `test_filename_similarity_heuristic`: Confirms version grouping vs distinct file separation.
