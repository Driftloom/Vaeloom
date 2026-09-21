# Module 05: End-to-End User Journeys (E2E-01 Through E2E-15)
**Audit Identifier**: `AUD-M05-AI-33`
**Scope**: Full end-to-end user workflows from upload to agent query, synthesis, and audit log.

---

## 1. Journey Execution Matrix

| ID | Description | Primary Components | Verification Status |
|---|---|---|---|
| **E2E-01** | Create workspace & assign roles | `workspaces.py`, `models/schema.py` | Verified |
| **E2E-02** | Upload PDF & validate magic bytes | `FileSecurityService`, `documents.py` | Verified |
| **E2E-03** | Asynchronous parsing via PyMuPDF | `IngestDocumentWorkflow`, `parsers.py` | Verified |
| **E2E-04** | OCR fallback on scanned image | `parsers.py` (Tesseract) | Verified |
| **E2E-05** | Chunking with sentence preservation | `chunking.py` (`chunk_text`) | Verified |
| **E2E-06** | Vector embedding & zero-trust indexing | `pipeline.py`, `vector_store.py` | Verified |
| **E2E-07** | Full-text tsvector search query | `documents.py` (`/documents/search`) | Verified |
| **E2E-08** | Hybrid RAG retrieval & cross-encoder rerank | `rag.py` (`rerank`, `fit_to_context_window`)| Verified |
| **E2E-09** | DocumentAgent Q&A with grounded citation | `DocumentAgent.synthesize_documents()` | Verified |
| **E2E-10** | Document version upload & rollback | `DocumentVersion`, `documents.py` | Verified |
| **E2E-11** | Cross-workspace document sharing | `DocumentShare`, `documents.py` | Verified |
| **E2E-12** | Hierarchical folder tree reorganization | `Folder`, `documents.py` | Verified |
| **E2E-13** | Document action logging & state undo | `DocumentAction`, `documents.py` | Verified |
| **E2E-14** | WorkspaceAgent hygiene audit | `WorkspaceAgent.audit_workspace_hygiene()`| Verified |
| **E2E-15** | GDPR cascading workspace erasure | `ErasureService.execute_erasure()` | Verified |

---

## 2. Verification Evidence

- Verified in `test_module05_e2e.py`: Entire cognitive pipeline runs synchronously from upload through parsing, chunking, vector indexing, and grounded citation synthesis.
