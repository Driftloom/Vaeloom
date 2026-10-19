# Vaeloom — Agent Notes

Operational instructions for agents working in this repo. Every line here is
something that will break a session, or a fact you cannot infer from filenames.

Repo-specific commands and invariants only. Language standards live in
`docs/engineering/Coding-Standards.md`.

---

## Working Agreements & Documentation Maintenance

Read
[`docs/coding-guidelines/GUIDELINES.md`](docs/coding-guidelines/GUIDELINES.md)
before your first non-trivial change, and
[`docs/coding-guidelines/EXAMPLES.md`](docs/coding-guidelines/EXAMPLES.md) for
worked wrong/right pairs drawn from real incidents here.

The short version:

1. **Think Before Coding** — state assumptions, surface interpretations, ask
   when a change touches a listed trigger.
2. **Simplicity First** — no speculative abstraction, no duplicated validation.
3. **Surgical Changes** — match surrounding style, change only what the request
   traces to, mention dead code rather than deleting it.
4. **Goal-Driven Execution** — fail-before / pass-after tests, verify in the
   smallest scope that exercises the change.
5. **Honesty** — exact assertions, no fabricated numbers, no flattering
   defaults.
6. **Documentation & Artifacts Maintenance** — when modifying schemas, APIs,
   domain packs, tokens, or system behavior:
   - **Regenerate committed artifacts**: Never hand-edit `*.generated.ts` or
     committed OpenAPI specs. Run the corresponding generator scripts.
   - **Update documentation**: If an architectural contract, endpoint, or
     invariant changes, update the relevant document under `docs/` or
     `specs/phase-contracts/` and record decisions in `docs/adr/`.
   - **Keep AGENTS.md truthful**: If a command, path, or invariant documented
     here changes, update this file in the same change.

---

## Quick Commands

Run all commands from the **repository root** unless specified otherwise.

| Action                           | Command                                                                                                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend dev                     | `pnpm dev:web` (or `cd apps/web && pnpm next dev -p 3000` / `make dev-web` on Unix)                                                                                                                                                                           |
| API dev                          | `pnpm dev:be` (or `make dev-be` on Unix)                                                                                                                                                                                                                      |
| Background queue worker          | `uv run --project apps/api python -m api.workers.queue_worker` (or `make dev-worker`)                                                                                                                                                                         |
| Install Node dependencies        | `pnpm install`                                                                                                                                                                                                                                                |
| Install Playwright Chromium      | `uv run --project apps/api playwright install chromium` (required for resume PDF builds)                                                                                                                                                                      |
| Backend tests (scoped)           | `uv run --project apps/api python -m pytest apps/api/tests/<path> -q` (or `cd apps/api && uv run python -m pytest <path> -q`)                                                                                                                                 |
| Backend tests (serial, reliable) | `uv run --project apps/api python -m pytest apps/api/tests/ -q -o addopts=""` (or in `apps/api`: `uv run python -m pytest tests/ -q -o addopts=""`)                                                                                                           |
| Backend tests + coverage         | `uv run --project apps/api python -m pytest apps/api/tests/ --cov=api --cov-report=term -q`                                                                                                                                                                   |
| Web tests                        | `cd apps/web && npx jest` (or `pnpm --filter @vaeloom/web test`)                                                                                                                                                                                              |
| Web typecheck                    | `cd apps/web && npx tsc --noEmit`                                                                                                                                                                                                                             |
| Typecheck all                    | `pnpm typecheck`                                                                                                                                                                                                                                              |
| Lint all                         | `pnpm lint`                                                                                                                                                                                                                                                   |
| Regenerate OpenAPI               | `pnpm gen:openapi`                                                                                                                                                                                                                                            |
| Regenerate memory type union     | `python scripts/gen_memory_type_union.py` (`--check` to verify in CI)                                                                                                                                                                                         |
| Regenerate UI design tokens      | `python scripts/gen_tokens.py` (`--check` to verify in CI)                                                                                                                                                                                                    |
| Verify PG migrations (local)     | `pnpm verify:pg` (or `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_pg_verification.ps1`)                                                                                                                                                   |
| Prove the memory rollback        | `pnpm verify:pg` proves apply/isolate/rollback against a disposable pg16. Steps 3-6 plant a row whose type only a temporary pack allows and require the downgrade to REFUSE, naming the constraint and the value. A downgrade that cannot fail is not a test. |

> [!WARNING] **Do not run `uv run --project apps/api` inside `apps/api`**:
> `--project apps/api` is relative to the current working directory. If you are
> already inside `apps/api`, omit `--project apps/api`
> (`uv run python -m pytest ...`), or stay in the root.

> [!NOTE] On Windows PowerShell, `make` is not recognized by default. Use the
> direct `pnpm` or `uv` commands listed above.

## CRITICAL: Never use `pnpm dev`

Bare `pnpm dev` is disabled at the root — it echoes an error and exits 1. It
previously ran `nx run-many --target=dev --parallel` across packages and hung.
Use `pnpm dev:web` or `pnpm dev:be`.

---

## Five things that WILL break

### 1. Pydantic does not read `.env` & Remote DDL is Guarded

`model_config = {"env_prefix": "", "case_sensitive": False}` in
`apps/api/src/api/config.py:276` has **no `env_file`**. A `.env` row is
invisible to settings. Set environment variables directly in your shell, and
note the double underscore for nested settings: `DATABASE__URL` maps to
`database__url`.

**Remote DDL Guard**: `apps/api/alembic/env.py` strictly blocks running
migrations against any non-local/cloud database (e.g. Supabase, AWS RDS) from a
local workstation unless `ALLOW_REMOTE_DDL=1` is explicitly exported. Never
place remote production or staging database URLs in local `.env` files. Cloud
database credentials are restricted to CI/CD secrets and deployment runners.

### 2. CSP blocks browser calls to the local API

`connect-src` in `apps/web/src/middleware.ts:89-115` only admits
`localhost:8000`/`127.0.0.1:8000` when `NODE_ENV === 'development'`, or
`ALLOW_LOCAL_API === 'true'`, or the request hostname is localhost. Outside
that, `fetch` calls to the local API fail **silently** — no console error, no
network row. The CSP lives in `middleware.ts` only, not `next.config.js`.

### 3. Casing differs by direction

Responses are camelCased automatically: `transformKeys`
(`apps/web/src/lib/api.ts:130`) is applied inside `api.request`
(`apps/web/src/lib/api.ts:440`), so anything going through `request()` gets it
for free. `api-client.ts` imports the same function rather than redefining it.

Request parameters do **not** transform — `encodeParams`
(`apps/web/src/lib/api-client.ts:34`) passes keys through, so query strings and
JSON bodies stay snake_case.

Raw `fetch` bypassing `request()` gets no transform at all.

### 4. CSRF and auth allowlists are narrow and must agree

`csrf.SKIP_PREFIXES` in `apps/api/src/api/middleware/csrf.py` is
`frozenset({"/scim"})` — **not** `/api/v1/auth`. That was deliberately narrowed;
a blanket auth skip would exempt every future auth endpoint.

- `csrf.SKIP_PATHS` enumerates individual public endpoints, including
  `/csrf-token` and several `/api/v1/auth/*` paths.
- `auth.PUBLIC_PATHS` (`apps/api/src/api/middleware/auth.py`) is a separate list
  with its own auth entries.
- `/api/v1/auth/refresh` is **conditionally** exempt — skipped only when the
  credential is explicit in the body; a cookie-borne refresh is challenged,
  because rotation makes a forged retry lock the user out.

**A new auth endpoint must be added to both lists** or it returns 403.

### 5. PDF & resume compilation fails without Playwright Chromium

`apps/api/src/api/services/document_builder.py` renders resume PDFs via
Playwright Chromium (`page.pdf()`). If Chromium is not installed, the compile
endpoints (`POST /resumes/{id}/compile`) raise an error and return **HTTP 503**.
Install it once locally using:
`uv run --project apps/api playwright install chromium`.

---

## Running the servers

```powershell
# Terminal 1 — API. Generate fresh secrets per machine; never reuse.
# JWT_SECRET and ENCRYPTION_KEY must be 32+ chars long.
# In PowerShell on Windows, openssl may not be present; use static dev strings or Python:
$env:JWT_SECRET="test-jwt-secret-for-ci-only-32-chars-long!!"
$env:ENCRYPTION_KEY="test-encryption-key-for-local-dev-32b="
$env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"
$env:LLM_API_KEY="mock-key"; $env:OTEL_SDK_DISABLED="true"
uv run --project apps/api python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
pnpm dev:web

# Terminal 3 (optional) — Background queue worker for scheduled/async jobs
uv run --project apps/api python -m api.workers.queue_worker
```

Python is pinned to 3.12 through `apps/api/.python-version` and the venv is
managed by `uv`. Always run commands through `uv run --project apps/api`.

**Port 3000 collisions** — leftover processes block the port. Fix:
`Get-Process -Name "node" | Stop-Process -Force`, then retry.

`apps/web/next.config.js:20` sets `output: 'standalone'` only when
`CI === 'true'` **and** platform isn't win32 — local builds stay fast.

**Test accounts**:

- `audit@vaeloom.test` / `AuditPass123!` (auto-seeded for e2e through
  `apps/web/e2e/api-launcher.py`)
- `demo@vaeloom.app` / `demo1234` (demo DB seed; present only on seeded DBs)
- Or sign up locally at `http://localhost:3000/signup`.

---

## Backend testing

**Do not trust a full-suite pass/fail count under `-n 4`.** The suite crashes
under xdist on Windows — `INTERNALERROR` plus a fatal exception `0xc000070a`
from the asyncio loop on `tests/security/`. The crash truncates the run, so
reported totals are wrong and a `-n 4` result is not reliable evidence.

- Iterate per-file or per-area.
- Trust `-o addopts=""` (serial) for a whole-suite number.
- `addopts = "-n 4 --dist loadfile --timeout=120 --timeout-method=thread"`
  (`apps/api/pyproject.toml:89`).

Tests use SQLite with a mock backend — a `tmp_path` per-test DB through
`NullPool`. `mock_llm` and `mock_connector_test` are autouse fixtures in
`apps/api/tests/conftest.py:381` and `:436`.

**When patching LLM methods, patch the class _and_ the `llm_service`
singleton.** The class-level fakes take `self`; a bare function assigned to the
singleton does not, and a stale instance attribute left by an earlier test
silently shadows the class patch. See
`apps/api/tests/test_semantic_ats_tools.py`.

Live suites (`apps/api/tests/integration/module05/`,
`apps/api/tests/adversarial/module05/`) use real MinIO S3, real TypeSafe AI Jev,
and real Ollama Cloud. They are marked `live_provider` and bypass the LLM mock.
Run them with `-o addopts=""`.

---

## RLS and multi-tenancy invariants

- **GUCs are transaction-scoped.** `set_config(..., is_local=true)` means a
  query issued _after_ the session block gets zero rows and **does not raise**.
  Any read of a FORCE-RLS table must open its session first and resolve inside
  it. See `apps/api/src/api/services/ranking_weights.py:190-200` for the correct
  shape.
- **`app.user_id` is part of the identity, not just `app.workspace_id`.**
  Policies need a top-level `AND` around the parenthesised workspace group — SQL
  binds `AND` tighter than `OR`, so a flat predicate leaves one branch
  unconstrained while still reading as correct.
- **Riding `TenantContext` is not enough.** The contextvar is populated by
  `TenantMiddleware` on request paths only. A worker, Temporal, or background
  caller with an explicit `user_id` must forward it into
  `scoped_session(..., user_id=user_id)`, or `app.user_id` is unset and it reads
  zero rows.
- **Unset GUCs fail closed.** Don't add a permissive branch for the null case.
- **Every table in `public` needs RLS _and_ a policy.** Migration `0066` ends
  with `_assert_schema_wide_coverage`, which raises if any public table is
  missing either. A migration that creates a table without them fails the chain.
- HNSW indexes already exist (`apps/api/alembic/versions/0011_hnsw_index.py`,
  both `vector_cosine_ops`). The ORM `__table_args__` lists only B-tree indexes
  and is not the complete DB state.

---

## Memory subsystem invariants

- **Domain packs are the source of truth for the type taxonomy.** `CAREER_TYPES`
  in `apps/api/src/api/services/memory_type_packs.py` is the canonical list. The
  frontend union is generated from it into
  `packages/shared-types/src/types/memory.generated.ts` via
  `python scripts/gen_memory_type_union.py`. CI runs `--check` (byte-exact) in
  `.github/workflows/ci-backend.yml:50`. Never hand-edit `*.generated.ts`;
  `.prettierignore` excludes it so lint-staged cannot reformat the artefact.
- **The whitelist lives in the service, not in Pydantic.**
  `apps/api/src/api/schemas/memory.py:21` defines `MemoryType = str` and
  validates shape only. Migration 0068 **dropped** `ck_memories_type_valid`, so
  the service-layer `memory_type_packs` check is the only guard on the write
  path. Re-adding a Pydantic whitelist recreates the drift.
- **`MemoryTypeRejected` maps to 422**, not 5xx, on create/update/supersede. A
  routine client mistake must not burn the error budget.
- **`supersede_memory` must touch the vector store.** It upserts the successor
  and purges the predecessor. It historically didn't, which made the Corrections
  UI invisible to search — `embeddings` is the primary search path.
- **The vector path must honour caller visibility.** It re-queries `Memory` by
  id, so it needs the same `status_filter`, tenant, workspace, and `source_type`
  filters the caller passed, or `document_chunk` rows consume top-k slots and
  are silently dropped.
- **Retrieval changes belong in `MemoryService.search_memories`**
  (`apps/api/src/api/services/memory_service.py:437`).
  `memory_agent/retrieval.py` is deleted — it had no production importers.
  Ranking and budget logic is `apps/api/src/api/services/context_engine.py`
  (`token_budget=2000`).
- **`user_preference_vectors.preference_vector` is not wired into ranking.**
  `search_ranking.py` consumes structured `preferred_tags` / `preferred_types`;
  the embedding column is read only by `recommendation_service.generate()`.
- **Closed in 0069.** `memory_records` no longer carries its own frozen
  `ck_memory_records_type_valid`, and `import_memories` validates the whole
  batch through the pack registry before writing any of it. The guarantee is now
  **all four service write paths validate**, not three of four.

  The two `document_service` `MemoryRecord(...)` sites validate too. Since 0069
  removed the database constraint, they are the only guard left on
  `memory_records.type`. Both write the constant `"document"`, which is valid,
  so this changes no behaviour today - its purpose is that a future edit to
  either constant cannot slip past the last remaining check. **A third
  `MemoryRecord(` call site added to that module must validate as well.**

---

## Agent loop invariants

- **ReAct is live.** `agent_react_enabled` defaults `True`
  (`apps/api/src/api/config.py:213`). ReAct intercepts `act_phase` before static
  dispatch, so **tests that are about the static ladder must pin
  `settings.agent_react_enabled = False`** — see
  `TestActPhase::test_dispatch_paths` in `apps/api/tests/test_orchestrator.py`.
- **Ceiling short-circuit**: Spending, token, quota, and tool limits terminate
  immediately via the ceiling check in `apps/api/src/api/orchestrator/loop.py`
  (~line 3336 in streaming, ~line 3696 in standard loop).
- **QA Verification Gate**: `run_agent_loop` and the streaming loop each run the
  QA verification gate (`loop.py:3420` and `loop.py:3762`), validating schema,
  PII, harm, and grounding via `QAAgent`.
  `apps/api/tests/test_react_revival_safety.py` proves a rejected act result
  never reaches the user and that scope and AgentCard gates still deny
  unauthorised tools.

---

## Honesty rules

Enforced here, not aspirational.

- Assert the **exact** expected status code.
  `assert res.status_code in (200, 201, 401, 403)` is banned — it passes when
  isolation is broken and auth is broken at once.
- Security tests need **negative controls**: prove cross-tenant access,
  injection payloads, and privilege escalation produce hard denials
  (400/401/403/413).
- **No mocks in live-provider suites.** If the test is in `module05/`, it talks
  to real endpoints.
- **Never fabricate a number.** Do not put a test count, coverage figure, or
  OpenAPI size in this file unless you measured it in this session.
- **Do not edit an expectation to make a test green.** See Known open gaps.

---

## Known open gaps — do not silently "fix" these

- **Golden retrieval `r15`** — `apps/api/tests/eval/golden_retrieval.json`
  expects `job_search` for _"generate weekly digest of my job search activity"_;
  the router (`apps/api/src/api/orchestrator/router.py`) returns `reflection`.
  The drift is between `router.py` and the fixture. Reconcile one of them
  deliberately; do not edit the fixture silently.
- **Preference learning is workspace-scoped since 0069.**
  `recommendation_feedback` has a nullable `workspace_id` and is deliberately
  NOT backfilled - the parent `recommendations` table has no workspace either,
  so a backfill would be a guess, and a guessed workspace is the contamination
  the column prevents. Learning filters on an exact workspace match, so legacy
  `NULL` rows are quarantined and contribute nothing. `user_preference_vectors`
  is keyed by `(user_id, tenant_id, workspace_id)`; legacy vectors are
  discarded, not migrated. **Every endpoint derives `workspace_id` from
  authenticated context - never from a body.** `POST /feedback` and
  `POST /index` both enforce that the caller is the subject (403 otherwise), and
  `POST /index` takes `workspace_id` from context.
- **Enterprise auth is partial** — SAML exists in
  `apps/api/src/api/services/saml.py` with real `signxml` but is not wired to
  the router; RBAC is a dependency-injection helper, not middleware.
- **~25 tables carry `USING (true)` service policies** covering `vaeloom_app`
  (migration 0047). For the app role those rely on app-layer scoping only — see
  `docs/security/RLS-SERVICE-POLICY-EXPOSURE.md`.
- **`pfi 7.1.0` + FastAPI `0.141.1` requires a shim** until upgrade — see
  `.agents/findings/archive/37-pfi-fastapi-every-request-500.md`.

---

## Repo map

Monorepo combining a Next.js 15 frontend workspace (managed with pnpm) and a
FastAPI backend (managed with uv).

### Structure:

```
apps/
  web/                  Next.js 15 App Router frontend (@vaeloom/web)
  api/                  FastAPI backend in Python 3.12 (managed via uv)
packages/
  ui-kit/               Shared React UI components (@vaeloom/ui-kit)
  shared-types/         Cross-stack TypeScript types & generated unions (@vaeloom/shared-types)
  eslint-config/        Shared ESLint rules (@vaeloom/eslint-config)
  tsconfig/            Shared TypeScript configs (@vaeloom/tsconfig)
  observability/        OpenTelemetry & tracing helpers (@vaeloom/observability)
  plugin-sdk/           SDK for creating plugins (@vaeloom/plugin-sdk)
  queue/                Queue primitives (@vaeloom/queue)
  service-auth/         Service-level auth helpers (@vaeloom/service-auth)
  vaeloom-sync/         CRDT/Vault synchronization primitives (@vaeloom/vault-sync)
integrations/
  calendar, email, github, google-drive, notion, slack
connectors/
  graphql, mcp, rest
sdk/
  typescript/           Public TypeScript client SDK (@vaeloom/sdk)
plugins/
  official/             sentiment, summarizer, translator
  community/            tag-generator, word-count
```

**Where to look**

| Thing                            | Path                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Phase contracts (governing spec) | `specs/phase-contracts/` — start `00-master-index.md`                        |
| Execution status                 | `specs/phase-contracts/EXECUTION-STATUS.md`                                  |
| Phase evidence, gates, handoffs  | `evidence/phases/<track>/<track>-pXX/`                                       |
| Architecture decisions           | `docs/adr/ADR-001…ADR-045`                                                   |
| Coding guidelines                | `docs/coding-guidelines/GUIDELINES.md` & `EXAMPLES.md`                       |
| Language standards               | `docs/engineering/Coding-Standards.md`                                       |
| OpenAPI (generated, committed)   | `specs/api/openapi.yaml`, `docs/backend/openapi.yaml`                        |
| Migrations                       | `apps/api/alembic/versions/` — head is `0070_vault_sync_conflict_history.py` |

A knowledge graph of the codebase lives in `graphify-out/` — useful for "who
calls this" / "what depends on that" before you grep.

---

## Known state

Measured numbers are deliberately absent from this file — they go stale. Run the
command and read the output. See
`evidence/phases/mvp/mvp-p00/03-maturity-and-evidence-matrix.md` for the last
full audit and its caveats.
