# Module 05: Chaos Engineering & Resilient Fallbacks
**Audit Identifier**: `AUD-M05-AI-32`
**Scope**: Vector database outages, S3 network partitions, graceful degradation, and worker redrive.

---

## 1. Degradation Scenarios & Handling

| Failure Scenario | System Reaction | Recovery Mechanism |
|---|---|---|
| **Qdrant Vector DB Down** | `get_vector_store()` intercepts failure | Seamlessly falls back to `FallbackVectorStore` without throwing 500 |
| **Object Storage Timeout** | `StorageService` retries with exponential backoff | Raises graceful HTTP 503 rather than corrupted writes |
| **Worker Crash mid-parsing** | Temporal workflow heartbeat expires | Automatically restarts activity on an available worker |
| **LLM Provider Outage** | Primary model throws 5xx or rate limit | Falls back through secondary provider ladder down to local synthesis |

---

## 2. Verification Evidence

- `test_module05_chaos.py`:
  - `test_vector_store_chaos_fallback`: Confirms fallback to `FallbackVectorStore` when vector store is invalid.
  - `test_fallback_vector_store_safe_operations`: Confirms zero-trust search operations work safely on fallback store.
  - `test_storage_service_missing_s3_graceful_handling`: Confirms presence of upload/download/delete handlers.
