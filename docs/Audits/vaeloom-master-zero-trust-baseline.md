# Vaeloom Master Zero-Trust Baseline — 2026-09-15

> **Commit:** `bd7b2125`
> (`feat(runtime): harness v1 hot-path wiring + ZT env fix`) **Mode:** FULL
> PROJECT AUDIT → GAP RECONCILIATION → IMPLEMENTATION → VERIFICATION
> **Hierarchy:** Real runtime > container > E2E tests > contract tests > unit
> tests > source > config > docs > claims. **Principle:** No inherited trust.
> Every PASS has evidence (command/test name/HTTP).

---

## 1. Repository Inventory (generated from repo, not docs)

### 1.1 Layout

| Area           | Path                           | Count                                                | Evidence                                           |
| -------------- | ------------------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| Frontend apps  | `apps/web`                     | 1 (Next.js 15 App Router)                            | `apps/web/src/app` 41 `page.tsx`                   |
| Backend apps   | `apps/api`                     | 1 (FastAPI)                                          | `apps/api/src/api`                                 |
| Services       | `src/api/services/*.py`        | **82**                                               | `Get-ChildItem services/*.py` 82                   |
| Agents (dirs)  | `src/api/agents`               | **23 dirs / 55 .py**                                 | `agents: 55 .py recurse`                           |
| Tools (static) | `src/api/tools/definitions.py` | **54** `ToolDefinition` + dynamic `mcp__*`           | `definitions.py:1028 ALL_TOOLS 50` + 4 added since |
| Connectors     | `connectors/`                  | 3 (graphql/mcp/rest)                                 | `connectors/`                                      |
| Integrations   | `integrations/`                | 6 (calendar/email/github/google-drive/notion/slack)  | `integrations/`                                    |
| Plugins        | `plugins/`                     | 5 (3 official + 2 community)                         | `plugins/`                                         |
| SDK            | `sdk/`                         | 2 (typescript/python)                                | `sdk/`                                             |
| Packages       | `packages/`                    | **9**                                                | `packages/`                                        |
| Docs           | `docs/**/*.md`                 | **1003**                                             | `Get-ChildItem docs -Recurse -Filter *.md`         |
| Phases         | `docs/phases/*`                | **42** (mvp-p00..p21, cont-p00..p11, agentic-w1..w5) | `Get-ChildItem docs/phases`                        |
| 66 prompts     | `docs/prompts/vaeloom-66...`   | **11 entries** (3 tracks)                            | `Get-ChildItem prompts/...`                        |

### 1.2 Build Inventory

| Kind                   | Actual                                                                             | Previous doc claim                   | Delta / note                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Routers                | **35** (+`__init__.py`=36)                                                         | —                                    | `apps/api/src/api/routers`                                                                      |
| Endpoints (decorators) | **244** (`GET103 POST103 PUT14 PATCH5 DELETE19`)                                   | —                                    | `rg @router.(get                                                                                | post | ...)` |
| Mounted ops (OpenAPI)  | **203 ops / 162 paths**                                                            | 110 (2026-08-23) / 162 (2026-09-15)  | Enterprise routes gated by `enterprise_routes_enabled=false` (MVP); 41 ops excluded in MVP mode |
| OpenAPI spec           | `docs/backend/openapi.yaml` **162 paths**                                          | 162                                  | Generator `scripts/gen_openapi.py` — ran `uv run … gen_openapi.py → 162 paths` 2026-09-15       |
| Services               | **82**                                                                             | —                                    | `services/`                                                                                     |
| Migrations             | **42 alembic** (0001..0042) + 10 legacy `src/api/migrations`                       | —                                    | `alembic/versions` 42                                                                           |
| DB models              | **1 file** `models/schema.py` + raw-SQL `knowledge_*`                              | —                                    | `ARRAY/String` compat via `conftest` shim (PG→SQLite for tests)                                 |
| Schemas                | **28 files** (27+`__init__`)                                                       | —                                    | `schemas/`                                                                                      |
| Agents                 | **23 dirs** (8 with contracts, 11 with `AgentCard`)                                | 28 (stale)                           | `Documentation count NOT blindly repeated`                                                      |
| Tools                  | **54 static** + `mcp__*`                                                           | —                                    | `definitions.py`                                                                                |
| Workflows              | **6** (Ingest, Hello, DurableAgentRun, Approval, ConnectorSync, EventTriggered)    | —                                    | `temporal/workflows.py`                                                                         |
| Task queues            | **8** (ingest, documents, agent, connectors, schedules, approvals, memory, events) | —                                    | `temporal/queues.py`                                                                            |
| Frontend routes        | **41 `page.tsx`**                                                                  | —                                    | `apps/web/src/app` (0 `route.ts` handlers)                                                      |
| Frontend components    | **~104**                                                                           | —                                    | `src/components: shared 26 + profile 16 + landing 42 + other 20`                                |
| Tests collected        | **3625** (`apps/api/tests` 3615 + scratch 10)                                      | 2731 (AGENTS.md) / 2672 (2026-08-23) | `uv run --project apps/api python -m pytest --collect-only -q` → 3615 in scope                  |
| Security tests         | **284 passed** (full `tests/security`)                                             | —                                    | `tests/security -q` 2026-09-15 284/284                                                          |

### 1.3 Architecture Reality vs Diagram

```text
sources → ingestion → memory → knowledge-graph/vector → agents → actions → outcomes → memory → future retrieval
```

| Arrow                                        | Runtime?        | Evidence                                                                                                                                                                       |
| -------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `User → account → workspace`                 | YES             | `routers/auth.py 9 endpoints`, `routers/workspaces.py 10 endpoints`, `services/workspace_service.py`                                                                           |
| `source connection → credentials`            | YES (encrypted) | `services/encryption.py EncryptedString`, `services/secrets_service.py`, `routers/connectors.py 12`                                                                            |
| `data ingestion → parser`                    | PARTIAL         | `routers/documents.py 8` + `ingestion/parsers.py` 10 types; **gap**: `json/html/xml` unsupported, scanned PDF not OCR'd, 10MB RAM read (`document_service.py:59`)              |
| `extraction → normalization`                 | YES             | `ingestion/pipeline.py:_populate_graph_memory`, `agents/memory_agent/extraction.py`                                                                                            |
| `entity resolution → dedup/merge`            | PARTIAL         | `ingestion/dedup.py 0.85 fuzzy`, `memory_service.py supersedes_id` but no `UNIQUE(workspace,content_hash)`                                                                     |
| `graph update + embeddings + vector index`   | PARTIAL         | Pipeline does `DocumentChunk+Embedding+kg_service` (full); **Temporal path** creates `Entity` but **no embeddings / `index_graph` is stub** (`activities.py:411 indexed:true`) |
| `retrieval → reranking → context`            | YES             | `memory_agent/retrieval.py hybrid + search_ranking.py:RRF`, but `/search` (`search_service.py`) is keyword-only (ILIKE); hybrid is hot-path in `orchestrator/loop.py:516`      |
| `agent reasoning → proposal`                 | YES             | `orchestrator/loop.py:2112 _dispatch_agent` 8 MVP + 14 enterprise                                                                                                              |
| `proposal → approval → execution`            | YES             | `approval_gated_tools() 12 + dynamic MCP`, `_react_approval_gate:876`, `UPDATE agent_approvals WHERE status=APPROVED` atomic                                                   |
| `outcome → memory update → future retrieval` | YES             | `memory_versioning.py`, `provenance_service.py`, `MemoryRecord.freshness_at` (no auto-expiry)                                                                                  |

---

## 2. Module Inventory

### 2.1 API Endpoints (mounted, MVP mode)

203 ops across 162 paths (35 routers; 8 enterprise routers excluded when
`enterprise_routes_enabled=false`):

`auth(9) workspaces(10) memories(10) agents(13) documents(8) search(1) knowledge_graph(11) connectors(12) resumes(14) applications(4) chat(1) gmail(6) scheduler(11) events(4) notifications(7) profile(17) provider_keys(6) cognition(8) anticipation(4) council(3) federation(1) sovereignty(8) integrations(5) temporal(6) health(3) + consent/gdpr/approvals/agent_costs`.

Excluded in MVP:
`billing(5) plugins(8) analytics(5) audit(5) iam(8) recommendations(5) webhooks(7) admin_console(12) feature_flags(5) scim`.

Evidence: `scripts/gen_openapi.py`,
`src/api/main.py:400-445 _safe_include + if enterprise_routes_enabled`,
`docs/backend/openapi.yaml`.

### 2.2 Frontend Routes (41 pages)

Roots: `/, /privacy, /terms, /forbidden, /session-expired, /status, /p/[userId]`
Auth:
`(auth)/login|signup|callback|auth/callback|forgot-password|reset-password|verify-email`
Workspace `workspace/[workspaceId]/`:
`page, chat, agents, agents/[agentId], memory, memory/[memoryId], jobs, schedule, history, files, files/[documentId], resume, resume/[resumeId]/edit, vault, connectors, applications, approvals, notifications, settings, profile, billing*, organizations*, admin*, developer*, marketplace*, feature-flags*`
(* = `EnterpriseGated` when `NEXT_PUBLIC_ENTERPRISE_ENABLED !== true`).

Evidence: `apps/web/src/app/**/page.tsx` 41, `middleware.ts`,
`components/shared/EnterpriseGated.tsx` used in 6 pages.

### 2.3 Agent Inventory (code, not docs)

| #   | Agent                                                                           | Dir                      | Card | Contract | Autonomy       | Tools (scope)                                            |
| --- | ------------------------------------------------------------------------------- | ------------------------ | ---- | -------- | -------------- | -------------------------------------------------------- |
| 1   | memory                                                                          | `memory_agent`           | YES  | YES      | observe        | search/query                                             |
| 2   | retrieval                                                                       | `memory_agent/retrieval` | —    | YES      | read_only      | search_documents                                         |
| 3   | resume                                                                          | `resume_agent`           | YES  | YES      | prepare        | compile_resume_* (own-artifact)                          |
| 4   | job_search                                                                      | `job_search_agent`       | YES  | YES      | suggest        | search_jobs, browse_job_page (read-only, SSRF-guarded)   |
| 5   | application                                                                     | `application_agent`      | YES  | —        | approval_gated | prepare tailored pkgs (requires approval)                |
| 6   | ats                                                                             | `ats_agent`              | YES  | —        | read_only      | calculate_ats_* (read-only)                              |
| 7   | organization                                                                    | `organization_agent`     | YES  | —        | approval_gated | rename/move/categorize (gated)                           |
| 8   | gmail                                                                           | `gmail_agent`            | YES  | YES      | suggest        | search_gmail, draft_email (draft-only, never send)       |
| 9   | scheduler                                                                       | `scheduler_agent`        | YES  | YES      | approval_gated | calendar (gated)                                         |
| 10  | career                                                                          | `career_agent`           | YES  | —        | suggest        | —                                                        |
| 11  | drive                                                                           | `drive_agent`            | YES  | —        | approval_gated | drive read (real+mock)                                   |
| 12  | github                                                                          | `github_agent`           | YES  | YES      | approval_gated | github read (create_issue/PR gated)                      |
| 13  | coding                                                                          | `coding_agent`           | —    | —        | suggest        | —                                                        |
| 14  | connector                                                                       | `connector_agent`        | —    | —        | suggest        | —                                                        |
| 15  | research                                                                        | `research_agent`         | —    | YES      | observe        | web_search                                               |
| …   | analytics, learning, reflection, recommendation, security, reminder, plugin, qa | various                  | NO   | NO       | —              | synthetic `card_registry.get_or_create()` fallback (gap) |

Gaps: `agent_registry` seeds **8/23**, `card_registry` **11/23** → ~12 agents
rely on synthetic fallback (`tools=[]`). No destructive `send_email`/`apply_job`
tool exists; only `draft_email`.

### 2.4 Memory / Graph / Vector

| Store             | Table(s)               | Vector dims                      | Isolation                                           | Notes                                                                                              |
| ----------------- | ---------------------- | -------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `memories`        | `schema.py:281`        | 1536 (`Vector`)                  | `workspace_id NULLABLE` (gap), `tenant_id nullable` | supersedes chain, lineage attempted but `lineage/taxonomy_version` not persisted (try/except pass) |
| `memory_records`  | `332`                  | —                                | `workspace_id NOT NULL FK CASCADE` ✓                | confidence/importance/freshness                                                                    |
| `embeddings`      | `527`                  | 1536                             | `workspace_id NO FK` (gap)                          | `model_version=text-embedding-3-small`                                                             |
| `knowledge_nodes` | raw SQL `alembic/0002` | TEXT `[...]` (gap: not pgvector) | `tenant_id TEXT NOT NULL`                           | not SQLAlchemy model                                                                               |
| `knowledge_edges` | raw SQL `0002`         | —                                | `workspace_id nullable`                             | duplicate prevention app-only                                                                      |
| `document_chunks` | `1248`                 | via `embedding_id FK SET NULL`   | `workspace_id NOT NULL FK CASCADE` ✓                | `content_hash`, token offsets                                                                      |

Evidence: `models/schema.py`,
`services/memory_service.py:150-157 every method filters`,
`services/knowledge_graph_service.py:_require_write_scope:23, _read_scope:29`.

### 2.5 Connectors

Gmail, Drive, GitHub, Outlook, OneDrive, Slack, Notion + MCP
(`connector_ext_service`, encrypted env values, shell interpreters denied). All
connectors are **draft/read-only unless approval-gated**
(`executor.py:261 _BASE_APPROVAL_GATED` includes
`draft_email, create_github_issue/PR, send_slack_message, calendar write, drive write`).

### 2.6 Current Test Inventory

| Suite                       | Collected | Run (q) | Pass           | Notes                                                                     |
| --------------------------- | --------- | ------- | -------------- | ------------------------------------------------------------------------- |
| All (`apps/api/tests`)      | 3615      | —       | —              | `uv run --project apps/api python -m pytest --collect-only -q` 2026-09-15 |
| Security (`tests/security`) | 284       | 284     | **284 passed** | `tests/security -q` 07m15s                                                |
| ZT master probes (NEW)      | 3         | 3       | **3 passed**   | `test_zt_master_probes.py`: auth matrix, workspace & memory IDOR          |
| ZT env override (NEW)       | 2         | 2       | **2 passed**   | `test_zt_config_env_override.py`                                          |
| Harness v1                  | 13        | 13      | **13 passed**  | `test_harness_v1.py`                                                      |

---

## 3. Baseline Failures (before fixes)

| ID     | Finding                                                                                                                         | Fixed                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| ZT-001 | `apps/api/.env` loaded with `override=True` — explicit `DATABASE__URL` env ignored, local/test silently talked to prod Supabase | **FIXED** `config.py:14-19 → override=False` (commit `bd7b2125`) |
| ZT-002 | Temporal ingestion path creates `Entity` but **no embeddings** and stub `index_graph` — vector miss for durable docs            | TRACKED P1                                                       |
| ZT-003 | Parsers missing `json/html/xml`, scanned PDF not OCR'd, corrupt PDF chunked as `"PDF parsing error: …"`                         | TRACKED P2                                                       |

---

## 4. How to Reproduce This Baseline

```bash
# Counts
Get-ChildItem apps/api/src/api/routers -Filter *.py | Measure-Object
Select-String -Path apps/api/src/api/routers/*.py -Pattern '@router\.(get|post|put|patch|delete)' | Measure-Object
uv run --project apps/api python scripts/gen_openapi.py  # → 162 paths
uv run --project apps/api python -m pytest --collect-only -q -o addopts=""  # → 3625 / 3615
uv run --project apps/api python -m pytest apps/api/tests/security -q -o addopts="" -p no:cacheprovider  # → 284 passed
uv run --project apps/api python -m pytest apps/api/tests/test_zt_master_probes.py apps/api/tests/test_zt_config_env_override.py -q -o addopts="" -p no:cacheprovider  # → 5 passed
```

Evidence path: `docs/prompts/vaeloom-66.../`, `docs/phases/*` (42),
`graphify-out/` (13511 nodes, 20107 edges).
