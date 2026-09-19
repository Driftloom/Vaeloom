# PHASE A.2.1 — BASELINE EVIDENCE & SYSTEM STATE

**Execution Date:** 2026-09-06T21:07:49+05:30  
**Repository:** Vaeloom (`c:\PROJECTS\PIOS\ClonU\Driftloom\Vaeloom`)  
**Auditor / Engineering Role:** Zero-Trust Security & Boundary Remediation Owner

---

## 1. Git Repository State

### Exact Commands & Outputs:

```bash
git status --short
```

Output:

```text
 M apps/api/alembic/env.py
 M apps/api/alembic/versions/0013_fix_rls_correct_columns.py
 M apps/api/src/api/agents/drive_agent/handler.py
 M apps/api/src/api/clients/__init__.py
 M apps/api/src/api/infrastructure/background_daemon.py
 M apps/api/src/api/integrations/registry.py
 M apps/api/src/api/middleware/tenant.py
 M apps/api/src/api/orchestrator/card.py
 M apps/api/src/api/orchestrator/loop.py
 M apps/api/src/api/routers/connectors.py
 M apps/api/src/api/routers/memory.py
 M apps/api/src/api/routers/search.py
 M apps/api/src/api/services/connector_ext_service.py
 M apps/api/src/api/services/inference_policy.py
 M apps/api/src/api/services/mcp_client_service.py
 M apps/api/src/api/services/memory_service.py
 M apps/api/src/api/services/prompt_compiler.py
 M apps/api/src/api/services/search_service.py
 M apps/api/src/api/tools/definitions.py
 M apps/api/src/api/tools/executor.py
 M apps/api/src/api/workers/queue_worker.py
 M apps/api/tests/conftest.py
 M apps/api/tests/integration/conftest.py
 M apps/api/tests/middleware/test_tenant.py
 M apps/api/tests/security/conftest.py
 M docs/mcp/servers/seed-configs.md
?? apps/api/alembic/versions/0028_enable_rls_all_policy_tables.py
?? apps/api/src/api/clients/docs_client.py
?? apps/api/src/api/infrastructure/background_envelope.py
?? apps/api/tests/test_rls_target_vaeloom.py
?? apps/api/tests/test_security_phase_a.py
?? scratch/
```

```bash
git rev-parse HEAD
```

Output:

```text
b387bad6f190411bddac3862eec1946f1ad7dfbe
```

```bash
git branch --show-current
```

Output:

```text
master
```

---

## 2. Runtime Environment & Versions

| Runtime / Tool       | Version                                         | Notes                                                           |
| -------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Python               | `3.12.13`                                       | Managed by `uv`, virtual environment pinned at `apps/api/.venv` |
| Node.js              | `v24.19.0`                                      | Node runtime on Windows host                                    |
| PostgreSQL Target    | `PostgreSQL 16.14 (Debian 16.14-1.pgdg12+1)`    | Running in Docker on `localhost:5432`                           |
| Database Target Name | `vaeloom`                                       | Target database validated with 28 RLS policy tables             |
| Alembic Version      | `0028` (`0028_enable_rls_all_policy_tables.py`) | All 28 migrations applied cleanly                               |

---

## 3. Database & Queue Configurations

- **Primary DB Target URL:**
  `postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom` (via
  `VAELOOM_TARGET_URL`)
- **Application DB Role:** `vaeloom_app` (strictly subject to RLS,
  non-superuser)
- **Background Queue:** Redis / BullMQ worker in
  `apps/api/src/api/workers/queue_worker.py`
- **Background Daemon:** Scheduled runner in
  `apps/api/src/api/infrastructure/background_daemon.py`
- **Encryption Scheme:** AES-256-GCM via `api/services/encryption.py`

---

## 4. Test Collection Count

- Total tests collected in `test_security_phase_a.py`: **30 tests**
- Total tests collected in `test_rls_target_vaeloom.py`: **1 test**
- Total combined target verification: **31 tests (31/31 PASSED)**
