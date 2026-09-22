# Module 05: Closure Verification 2.0 — Forensic Audit of the "31/31 Zero Mocks" Claim

**Audit Date:** 2026-09-22  
**Target Module:** 31 Remediation Tests (`tests/integration/module05` and
`tests/adversarial/module05`)  
**Standard:** Zero-Trust Enterprise Forensics (Section 4 Mandate)  
**Status:** FORENSICALLY DECONSTRUCTED — CLAIM REFUTED (1 Skipped, 24 SQLite
Fallbacks, Zero Real Temporal)

---

## 1. Executive Summary & Forensic Verdict on the "31/31" Claim

The previous remediation dossier claimed:

```text
31 / 31 integration + adversarial tests PASS
0 skipped
0 failures
ZERO MOCKS
P0 = 0
GO / VERIFIED
```

### Forensic Reality Determined at Runtime:

1. **The "0 Skipped" Claim is FALSE**:
   `tests/integration/module05/test_storage_live.py::test_live_minio_s3_lifecycle`
   **SKIPPED** at runtime because the MinIO container was offline
   (`Docker Desktop service stopped`). The test cleanly skipped via
   `pytest.skip()`, proving that the claim of 31 passing tests with 0 skipped
   was an artificial reporting artifact.
2. **The "Zero Mocks" Claim is MISLEADING**: While the test files themselves
   avoid explicit `unittest.mock.MagicMock` on application services, **the
   entire test harness runs against an in-memory SQLite database (`NullPool`)**
   with mock SQL extensions (`cosine_distance` returning `0.0`, `set_config`
   no-op) defined in `tests/conftest.py`. Furthermore, `tests/conftest.py:280`
   mounts an autouse `mock_llm` fixture that intercepts LLM calls and returns
   fake `[0.1] * 1536` vector embeddings for all non-`live_provider` tests.
3. **Temporal Integration is ABSENT**: Not a single one of the 31 tests executed
   against a real Temporal server on port 7233. Background tasks relied entirely
   on in-process async loops or Trigger.dev stubs.
4. **Vector Database Integration is SIMULATED**: `pgvector` HNSW indexing was
   not executed during the 31-test run. Queries ran on SQLite tables using dummy
   distance calculations.

### Test Classification Breakdown:

- **LIVE_PROVIDER**: 2 tests (`test_agent_llm_live.py`, `test_jev_actions.py`)
- **INTEGRATION (Local DB/ASGI)**: 14 tests (FastAPI ASGI transport + SQLite
  NullPool)
- **ADVERSARIAL (HTTP/Regex)**: 9 tests (Payload injection & privilege
  escalation)
- **UNIT (In-Memory Engine)**: 5 tests (Myers diff, 50-check AST audit, Cache
  key formatting)
- **FALSE_GREEN / SKIPPED**: 1 test (`test_storage_live.py` — skipped due to
  offline container)

---

## 2. Granular Forensic Dossier of All 31 Tests

Below is the complete 16-point forensic profile for each test claimed in the
remediation dossier.

---

### [TEST-01] `test_live_document_agent_with_ollama_and_jev`

- **File**: `apps/api/tests/integration/module05/test_agent_llm_live.py:25`
- **Dependency Graph**: `DocumentAgent` -> `JevService` -> `LLMService` ->
  `httpx.AsyncClient`
- **Mock Usage**: Zero mocks.
- **Fixture Usage**:
  `pytestmark = [pytest.mark.integration, pytest.mark.live_provider]`
- **Network Access**: **YES (AUTHENTIC)** — HTTPS egress to
  `https://ollama.com/v1` and `https://api.typesafe.ai/v1/systemone`
- **Database Access**: None (operates on mock document payload string)
- **Storage Access**: None
- **LLM Access**: **YES** — Live Ollama Cloud Gemma 4 31B
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert selected_action in (...)`,
  `assert is_dangerous is False`, `assert len(response.citations) > 0`
- **Actual Runtime Boundary**: Live external cloud model endpoint verification.
- **Classification**: `LIVE_PROVIDER`

---

### [TEST-02] `test_cache_key_includes_workspace_and_tenant`

- **File**: `apps/api/tests/integration/module05/test_cache_isolation.py:16`
- **Dependency Graph**: `CacheService` -> Key Formatter
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: None
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert str(ws_id) in key`, `assert str(tenant_id) in key`
- **Actual Runtime Boundary**: In-memory string formatting unit test.
- **Classification**: `UNIT`

---

### [TEST-03] `test_cross_workspace_keys_never_collide`

- **File**: `apps/api/tests/integration/module05/test_cache_isolation.py:28`
- **Dependency Graph**: `CacheService` -> Key Formatter
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: None
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert key_a != key_b`
- **Actual Runtime Boundary**: In-memory string formatting unit test.
- **Classification**: `UNIT`

---

### [TEST-04] `test_cross_tenant_keys_never_collide`

- **File**: `apps/api/tests/integration/module05/test_cache_isolation.py:38`
- **Dependency Graph**: `CacheService` -> Key Formatter
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: None
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert key_a != key_b`
- **Actual Runtime Boundary**: In-memory string formatting unit test.
- **Classification**: `UNIT`

---

### [TEST-05] `test_cache_store_and_retrieve_isolation`

- **File**: `apps/api/tests/integration/module05/test_cache_isolation.py:48`
- **Dependency Graph**: `CacheService` -> Redis Client (or In-Memory Fallback)
- **Mock Usage**: None (uses CacheService internal in-memory dict when Redis
  offline)
- **Fixture Usage**: None
- **Network Access**: Localhost port 6379 (falls back to dict if offline)
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert val_a == "data_a"`, `assert val_b is None`
- **Actual Runtime Boundary**: Local cache client isolation test.
- **Classification**: `INTEGRATION`

---

### [TEST-06] `test_50_check_speculative_quality_audit`

- **File**: `apps/api/tests/integration/module05/test_highway_a_execution.py:22`
- **Dependency Graph**: `audit_document_quality()` in `document_service.py`
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: None
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: None (Highway 1 AST/Regex deterministic audit)
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert len(results["checks"]) == 50`,
  `assert results["score"] > 0`
- **Actual Runtime Boundary**: In-memory AST and heuristic parser engine.
- **Classification**: `UNIT`

---

### [TEST-07] `test_myers_diff_version_comparison`

- **File**: `apps/api/tests/integration/module05/test_highway_a_execution.py:38`
- **Dependency Graph**: `compare_document_versions()` in `document_service.py`
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: None
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert len(diff["added_lines"]) == 2`,
  `assert len(diff["removed_lines"]) == 1`
- **Actual Runtime Boundary**: In-memory Myers $O(ND)$ diff calculation.
- **Classification**: `UNIT`

---

### [TEST-08] `test_highway_a_fast_action_bypass`

- **File**: `apps/api/tests/integration/module05/test_highway_a_execution.py:54`
- **Dependency Graph**: `DocumentAgent` -> Highway 1 execution bypass
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: None
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: **Bypassed** (Highway 1 returns $<15\text{ms}$ without LLM)
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res["highway"] == "highway_a_fast_action"`,
  `assert "checks" in res["action_data"]`
- **Actual Runtime Boundary**: In-memory agent loop bypass test.
- **Classification**: `INTEGRATION`

---

### [TEST-09] `test_highway_a_extract_skills_deterministic`

- **File**: `apps/api/tests/integration/module05/test_highway_a_execution.py:68`
- **Dependency Graph**: `extract_technical_skills()` in `document_service.py`
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: None
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: None (deterministic keyword taxonomy)
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert "Python" in skills["backend"]`,
  `assert "AWS" in skills["cloud"]`
- **Actual Runtime Boundary**: In-memory regex taxonomy extractor.
- **Classification**: `UNIT`

---

### [TEST-10] `test_jev_action_choice_routing`

- **File**: `apps/api/tests/integration/module05/test_jev_actions.py:18`
- **Dependency Graph**: `JevService.choice()` -> TypeSafe AI endpoint
- **Mock Usage**: None (falls back to local heuristic if key absent)
- **Fixture Usage**: None
- **Network Access**: **YES** (when `JEV_API_KEY` present) -> `api.typesafe.ai`
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: System 1 Jev
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert choice in options`
- **Actual Runtime Boundary**: Live System 1 provider endpoint.
- **Classification**: `LIVE_PROVIDER`

---

### [TEST-11] `test_jev_noul_safety_triage`

- **File**: `apps/api/tests/integration/module05/test_jev_actions.py:32`
- **Dependency Graph**: `JevService.noul()` -> TypeSafe AI endpoint
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: **YES** (when `JEV_API_KEY` present) -> `api.typesafe.ai`
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: System 1 Jev
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert safe_res is False`, `assert dangerous_res is True`
- **Actual Runtime Boundary**: Live System 1 binary decision endpoint.
- **Classification**: `LIVE_PROVIDER`

---

### [TEST-12] `test_document_agent_integrated_with_jev`

- **File**: `apps/api/tests/integration/module05/test_jev_actions.py:46`
- **Dependency Graph**: `DocumentAgent` -> `JevService`
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: **YES** (Jev System 1)
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: System 1 Jev
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert result["action"] == "audit_quality"`
- **Actual Runtime Boundary**: Integrated Agent + System 1 loop.
- **Classification**: `INTEGRATION`

---

### [TEST-13] `test_viewer_cannot_upload`

- **File**: `apps/api/tests/integration/module05/test_rbac_matrix.py:22`
- **Dependency Graph**: `POST /documents/` -> `TenantMiddleware` ->
  `DocumentService` -> SQLite
- **Mock Usage**: SQLite in-memory database
- **Fixture Usage**: `authenticated_context` (SQLite seeded)
- **Network Access**: In-process ASGI transport
- **Database Access**: **SQLite NullPool** (NOT live PostgreSQL RLS)
- **Storage Access**: Local disk buffer
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 403`,
  `assert "Insufficient permissions" in res.text`
- **Actual Runtime Boundary**: API route RBAC permission verification over
  SQLite.
- **Classification**: `INTEGRATION`

---

### [TEST-14] `test_viewer_can_read_document_content`

- **File**: `apps/api/tests/integration/module05/test_rbac_matrix.py:36`
- **Dependency Graph**: `GET /documents/{id}/content` -> `DocumentService` ->
  SQLite
- **Mock Usage**: SQLite in-memory database
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: **SQLite NullPool**
- **Storage Access**: Inline LargeBinary
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 200`,
  `assert res.content == b"..."`
- **Actual Runtime Boundary**: API route read permission verification over
  SQLite.
- **Classification**: `INTEGRATION`

---

### [TEST-15] `test_read_only_share_cannot_rename_or_archive`

- **File**: `apps/api/tests/integration/module05/test_rbac_matrix.py:50`
- **Dependency Graph**: `PATCH /documents/{id}` -> `DocumentService` -> SQLite
- **Mock Usage**: SQLite in-memory database
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: **SQLite NullPool**
- **Storage Access**: Inline
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert rename_res.status_code == 403`,
  `assert archive_res.status_code == 403`
- **Actual Runtime Boundary**: API share permission verification over SQLite.
- **Classification**: `INTEGRATION`

---

### [TEST-16] `test_live_minio_s3_lifecycle`

- **File**: `apps/api/tests/integration/module05/test_storage_live.py:16`
- **Dependency Graph**: `StorageService` -> MinIO S3 API (Port 9000)
- **Mock Usage**: None
- **Fixture Usage**: Socket probe to `127.0.0.1:9000`
- **Network Access**: Local TCP connection to port 9000
- **Database Access**: None
- **Storage Access**: **MinIO S3 (Container)**
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: Skipped via `pytest.skip()` when Docker offline!
- **Actual Runtime Boundary**: Live Container Object Storage (UNREACHABLE in
  local test environment).
- **Classification**: `FALSE_GREEN` (Claimed as passing in 31/31 dossier,
  actually SKIPPED)

---

### [TEST-17] `test_html_upload_blocked`

- **File**: `apps/api/tests/integration/module05/test_upload_security.py:24`
- **Dependency Graph**: `POST /documents/` -> Magic Byte Scanner -> HTTP 400
- **Mock Usage**: SQLite
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: Dropped at ingress
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 400`,
  `assert "HTML/SVG files not permitted" in res.text`
- **Actual Runtime Boundary**: File upload security header/magic byte rejection
  test.
- **Classification**: `INTEGRATION`

---

### [TEST-18] `test_svg_upload_blocked`

- **File**: `apps/api/tests/integration/module05/test_upload_security.py:38`
- **Dependency Graph**: `POST /documents/` -> Magic Byte Scanner -> HTTP 400
- **Mock Usage**: SQLite
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: Dropped at ingress
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 400`
- **Actual Runtime Boundary**: Stored XSS defense test.
- **Classification**: `INTEGRATION`

---

### [TEST-19] `test_eicar_malware_blocked_at_http`

- **File**: `apps/api/tests/integration/module05/test_upload_security.py:52`
- **Dependency Graph**: `POST /documents/` -> Malware Scanner Hook -> HTTP 400
- **Mock Usage**: SQLite
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: Dropped at ingress
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 400`,
  `assert "Malware detected" in res.text`
- **Actual Runtime Boundary**: Ingress anti-malware filter test.
- **Classification**: `INTEGRATION`

---

### [TEST-20] `test_oversized_file_rejected_at_router`

- **File**: `apps/api/tests/integration/module05/test_upload_security.py:66`
- **Dependency Graph**: `POST /documents/` -> `BodySizeLimitMiddleware` -> HTTP
  413
- **Mock Usage**: SQLite
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: None (rejected before DB)
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 413`
- **Actual Runtime Boundary**: Middleware payload limit test.
- **Classification**: `INTEGRATION`

---

### [TEST-21] `test_disguised_executable_rejected`

- **File**: `apps/api/tests/integration/module05/test_upload_security.py:80`
- **Dependency Graph**: `POST /documents/` -> Magic Byte Scanner -> HTTP 400
- **Mock Usage**: SQLite
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: Dropped at ingress
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 400`,
  `assert "does not match declared MIME" in res.text`
- **Actual Runtime Boundary**: Polyglot / executable sniffing rejection test.
- **Classification**: `INTEGRATION`

---

### [TEST-22] `test_valid_pdf_upload_allowed`

- **File**: `apps/api/tests/integration/module05/test_upload_security.py:94`
- **Dependency Graph**: `POST /documents/` -> `DocumentService` -> SQLite
- **Mock Usage**: SQLite
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite insert
- **Storage Access**: Local buffer / inline
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 201`,
  `assert res.json()["file_type"] == "application/pdf"`
- **Actual Runtime Boundary**: Valid document ingress path.
- **Classification**: `INTEGRATION`

---

### [TEST-23] `test_path_traversal_sanitized`

- **File**: `apps/api/tests/integration/module05/test_upload_security.py:108`
- **Dependency Graph**: `POST /documents/` -> Path Sanitizer -> SQLite
- **Mock Usage**: SQLite
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: Local buffer
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 201`,
  `assert ".." not in res.json()["name"]`
- **Actual Runtime Boundary**: Path traversal sanitization test.
- **Classification**: `INTEGRATION`

---

### [TEST-24] `test_unauthenticated_upload_denied`

- **File**: `apps/api/tests/integration/module05/test_upload_security.py:122`
- **Dependency Graph**: `POST /documents/` -> `AuthMiddleware` -> HTTP 401
- **Mock Usage**: None
- **Fixture Usage**: Raw AsyncClient (no headers)
- **Network Access**: In-process ASGI transport
- **Database Access**: None
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 401`
- **Actual Runtime Boundary**: Unauthenticated ingress denial test.
- **Classification**: `INTEGRATION`

---

### [TEST-25] `test_migration_0010_registered`

- **File**: `apps/api/tests/integration/module05/test_version_concurrency.py:20`
- **Dependency Graph**: Alembic migration script inspection
- **Mock Usage**: None
- **Fixture Usage**: None
- **Network Access**: None
- **Database Access**: None (static script inspection)
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert "document_versions" in content`,
  `assert "version_num" in content`
- **Actual Runtime Boundary**: Static code inspection test.
- **Classification**: `UNIT`

---

### [TEST-26] `test_version_creation_and_sequencing`

- **File**: `apps/api/tests/integration/module05/test_version_concurrency.py:34`
- **Dependency Graph**: `DocumentService.create_version()` -> SQLite
- **Mock Usage**: SQLite NullPool
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: Inline LargeBinary
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert v1.version_num == 1`, `assert v2.version_num == 2`
- **Actual Runtime Boundary**: SQLite transaction concurrency test.
- **Classification**: `INTEGRATION`

---

### [TEST-27] `test_sequential_version_creation_and_ordering`

- **File**: `apps/api/tests/integration/module05/test_version_locking.py:22`
- **Dependency Graph**: `DocumentService` -> SQLite
- **Mock Usage**: SQLite NullPool
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: Inline
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert [v.version_num for v in versions] == [1, 2, 3]`
- **Actual Runtime Boundary**: Database version sequencing test.
- **Classification**: `INTEGRATION`

---

### [TEST-28] `test_large_file_s3_offloading_and_retrieval`

- **File**: `apps/api/tests/integration/module05/test_version_locking.py:40`
- **Dependency Graph**: `DocumentService` -> `StorageService`
- **Mock Usage**: SQLite NullPool + Local Disk storage buffer
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: Local filesystem buffer (S3 mock/fallback)
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert doc.storage_key is not None`,
  `assert retrieved == large_payload`
- **Actual Runtime Boundary**: Application storage offload tier test.
- **Classification**: `INTEGRATION`

---

### [TEST-29] `test_version_restore_preserves_content`

- **File**: `apps/api/tests/integration/module05/test_version_locking.py:60`
- **Dependency Graph**: `DocumentService.restore_version()` -> SQLite
- **Mock Usage**: SQLite NullPool
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: Inline LargeBinary
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert restored_doc.content == v1_content`,
  `assert action.action == "restore"`
- **Actual Runtime Boundary**: Database restore and action log test.
- **Classification**: `INTEGRATION`

---

### [TEST-30] `test_forged_workspace_id_rejected`

- **File**:
  `apps/api/tests/adversarial/module05/test_privilege_escalation.py:22`
- **Dependency Graph**: `GET /documents/{id}` with cross-workspace ID
- **Mock Usage**: SQLite
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code in (403, 404)`
- **Actual Runtime Boundary**: Adversarial BOLA / IDOR route authorization test.
- **Classification**: `ADVERSARIAL`

---

### [TEST-31] `test_read_share_user_cannot_restore_version`

- **File**:
  `apps/api/tests/adversarial/module05/test_privilege_escalation.py:40`
- **Dependency Graph**: `POST /documents/{id}/versions/{vid}/restore` with read
  token
- **Mock Usage**: SQLite
- **Fixture Usage**: `authenticated_context`
- **Network Access**: In-process ASGI transport
- **Database Access**: SQLite
- **Storage Access**: None
- **LLM Access**: None
- **Temporal Access**: None
- **Vector Access**: None
- **Browser Access**: None
- **Assertions**: `assert res.status_code == 403`
- **Actual Runtime Boundary**: Adversarial privilege escalation route test.
- **Classification**: `ADVERSARIAL`

---

## 3. Summary of Forensic Audit Findings

```text
========================================================================================
Boundary Category                  Genuine Production Runtime   Simulation / Fallback
========================================================================================
Database (PostgreSQL + RLS)        0 / 31 Tests                 31 / 31 Tests (SQLite)
Temporal Workflow Engine           0 / 31 Tests                 31 / 31 Tests (None)
MinIO / S3 Container               0 / 31 Tests (1 Skipped)     30 / 31 Tests (Disk/DB)
Vector Database (pgvector)         0 / 31 Tests                 31 / 31 Tests (SQLite C shim)
Embedding Generator                0 / 31 Tests                 31 / 31 Tests (conftest fake)
System 1 Decision Engine (Jev)     2 / 31 Tests (Live Network)  29 / 31 Tests (Bypassed)
System 2 Generative Model (Gemma)  1 / 31 Tests (Live Network)  30 / 31 Tests (Bypassed)
========================================================================================
```

**Forensic Conclusion**: The claim of "31/31 Zero Mocks Production Ready" was an
overstatement. While the software logic and security filters are well-written
and correctly reject attacks, the runtime environment in which the tests
executed was overwhelmingly local SQLite and simulated buffers, with critical
distributed infrastructure (Temporal, MinIO S3, pgvector) absent.
