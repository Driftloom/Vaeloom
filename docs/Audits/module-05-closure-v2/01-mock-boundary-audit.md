# Module 05: Closure Verification 2.0 — Comprehensive Mock Boundary Census

**Audit Date:** 2026-09-22  
**Target Module:** Full Repository Mock Footprint Analysis (Section 5 Mandate)  
**Standard:** Zero-Trust Enterprise Forensics  
**Status:** COMPLETE AUDIT — MOCKS PROVEN IN TEST HARNESSES

---

## 1. Executive Summary & Policy Rule

In accordance with Section 5:

> **The goal is NOT: zero mocks anywhere in repository.**  
> **The goal is: No mocked dependency may be used as proof of a real integration
> boundary.**

This audit searched the complete test tree for every mock mechanism, determining
whether it affects the integration boundaries claimed for Module 05
production-readiness.

```text
========================================================================================
Search Term       Occurrences Across Tests   Affects Module 05 Integration Boundary?
========================================================================================
`Mock` / `MagicMock`    42 files             YES — Intercepts external connectors & LLMs
`AsyncMock`             80+ files            YES — Intercepts LLM calls in prompt injection tests
`patch` / `monkeypatch` 95+ files            YES — Intercepts settings, auth, and LLM calls
`mock_llm`              18 files             YES — Autouse fixture returning fake [0.1]*1536
`fake` / `stub`         24 files             YES — In-memory test doubles for S3 and redis
`respx` / HTTP mock      6 files             YES — Intercepts outgoing HTTP calls to providers
`NullPool` SQLite DB    All standard tests   YES — Substitutes PostgreSQL with SQLite
----------------------------------------------------------------------------------------
```

---

## 2. Granular Evaluation of Mocked Boundaries

### 2.1 LLM and Embedding Mocking (`mock_llm`)

- **Location**: `apps/api/tests/conftest.py:280`
  ```python
  @pytest_asyncio.fixture(autouse=True)
  async def mock_llm(monkeypatch, request):
      if request.node.get_closest_marker("live_provider"):
          return
      monkeypatch.setattr(settings, "llm_api_key", "")
      fake_embedding = [0.1] * 1536
      async def fake_generate_embedding(self, text: str, *args, **kwargs):
          return fake_embedding
  ```
- **Impact on Module 05**: Any test not explicitly decorated with
  `@pytest.mark.live_provider` does **not** call real embedding or completion
  providers. It receives static `[0.1] * 1536` arrays.
- **Verdict**: Ingestion and RAG tests running under standard pytest verify
  orchestration logic, but **do not prove real vector model integration**.

### 2.2 Direct LLM Interception in Adversarial Tests (`test_prompt_injection.py`)

- **Location**:
  `apps/api/tests/adversarial/module05/test_prompt_injection.py:42`
  ```python
  with patch("api.services.llm_service.llm_service.generate_completion", side_effect=fake_generate_completion):
      with patch("api.agents.document_agent.handler.settings.llm_api_key", "test-key-enabled"):
          res = await agent.synthesize_documents(...)
  ```
- **Impact on Module 05**: This test was claimed in the remediation dossier as
  an adversarial "Zero Mocks" integration test. In reality, it explicitly mocks
  `llm_service.generate_completion` to inspect prompt messages in memory.
- **Verdict**: Valid unit test for prompt construction, but **cannot be cited as
  proof of live prompt injection resistance against a real LLM**.

### 2.3 Database Mocking (SQLite vs. PostgreSQL)

- **Location**: `apps/api/tests/conftest.py:215`
  - Tests create per-test SQLite databases using `NullPool`.
  - SQLite lacks native Row-Level Security (RLS), native UUID columns, and
    `pgvector`.
  - To prevent tests from crashing on SQL functions, `conftest.py` registers
    fake C-extensions:
    ```python
    dbapi_connection.create_function("cosine_distance", 2, lambda a, b: 0.0)
    dbapi_connection.create_function("set_config", 3, lambda a, b, c: b)
    ```
- **Impact on Module 05**: The 31 integration and adversarial tests ran on
  SQLite with dummy `cosine_distance` returning `0.0`. They did **not** execute
  against PostgreSQL RLS or pgvector indexes.
- **Verdict**: Application logic passed, but **real database kernel security was
  simulated**.

### 2.4 Object Storage Fallbacks (MinIO / S3)

- **Location**: `apps/api/tests/integration/module05/test_storage_live.py:20`
  - When the Docker container `vaeloom-test-minio` is offline,
    `socket.create_connection(("127.0.0.1", 9000))` fails and skips the test.
  - In all other tests, `StorageService` falls back to writing bytes to
    `./storage/` or PostgreSQL inline `LargeBinary`.
- **Impact on Module 05**: Real S3 offloading was **not exercised** in the
  standard test pass.

---

## 3. Forensic Conclusion

The claim that Module 05 has "Zero Mocks" across its verification suite is
refuted. The repository contains extensive, necessary mocks for CI speed, but
these mocks **cannot be used as proof of real infrastructure integration**.
Under Section 64 of the verification contract, critical integration boundaries
remain simulated.
