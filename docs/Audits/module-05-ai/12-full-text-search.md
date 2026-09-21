# Module 05: Full-Text Document Search Architecture
**Audit Identifier**: `AUD-M05-AI-12`
**Scope**: PostgreSQL tsvector indexes, text search ranking, search filters, and workspace scoping.

---

## 1. Full-Text Search Architecture

Vaeloom supports keyword and full-text search across documents using PostgreSQL `tsvector` column on `documents` (migration `0026_tsvector_documents.py`):
- **Weighted Ranking**: Document title (`weight 'A'`), path (`weight 'B'`), and body text (`weight 'C'`) are concatenated into the search vector.
- **Stemming & Stopwords**: Uses standard `'english'` dictionary for stemming and morphological normalization.
- **Endpoint**: `GET /api/v1/documents/search?q=...&workspace_id=...`

---

## 2. Filtering & Security Bounds

The search query strictly enforces:
1. `workspace_id == ctx_workspace_id`: Foreign workspace documents are never returned.
2. `status != 'QUARANTINED'`: Compromised or malware-flagged documents are omitted.
3. `status != 'ARCHIVED'`: Soft-deleted documents are omitted unless `include_archived=true` is explicitly requested by workspace owners.

---

## 3. Verification Evidence

- `test_module05_search.py`:
  - `test_search_documents_workspace_isolation_and_filters`: Validates that search results strictly observe workspace boundaries and quarantine exclusions.
