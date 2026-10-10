# Vaeloom — Agent Notes

Operational instructions for agents working in this repo. Every line here is
something that will break a session, or a fact you cannot infer from filenames.

Repo-specific commands and invariants only. Language standards live in
`docs/engineering/Coding-Standards.md`.

---

## Working Agreements

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

---

## Quick Commands

| Action                           | Command                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Frontend dev                     | `pnpm dev:web` (or `make dev-web` — fastest, no Nx)                                        |
| API dev                          | `pnpm dev:be` (or `make dev-be`)                                                           |
| Install                          | `pnpm install`                                                                             |
| Backend tests (scoped)           | `cd apps/api && uv run --project apps/api python -m pytest <path> -q`                      |
| Backend tests (serial, reliable) | `cd apps/api && uv run --project apps/api python -m pytest -q -o addopts=""`               |
| Backend tests + coverage         | `cd apps/api && uv run --project apps/api python -m pytest --cov=api --cov-report=term -q` |
| Web tests                        | `cd apps/web && npx jest`                                                                  |
| Web typecheck                    | `cd apps/web && npx tsc --noEmit`                                                          |
| Typecheck all                    | `pnpm typecheck`                                                                           |
| Lint all                         | `pnpm lint`                                                                                |
| Regenerate OpenAPI               | `pnpm gen:openapi`                                                                         |
| Regenerate memory type union     | `python scripts/gen_memory_type_union.py` (`--check` to verify)                            |

`make help` lists everything in the Makefile.

## CRITICAL: Never use `pnpm dev`

Bare `pnpm dev` is disabled at the root — it echoes an error and exits 1. It
previously ran `nx run-many --target=dev --parallel` across all 25 packages and
hung, because most packages have no `dev` script. Use `pnpm dev:web`,
`make dev-web`, or `pnpm dev:be`.

---

## Four things that WILL break

### 1. Pydantic does not read `.env`

`model_config = {"env_prefix": "", "case_sensitive": False}` (`config.py:276`)
has **no `env_file`**. A `.env` row is invisible to settings. Set env vars
directly, and note the double underscore: `DATABASE__URL` maps to the field
`database__url`.

### 2. CSP blocks browser calls to the local API

`connect-src` in `apps/web/src/middleware.ts:111` only admits
`localhost:8000`/`127.0.0.1:8000` when `NODE_ENV === 'development'`, or
`ALLOW_LOCAL_API === 'true'`, or the request hostname is localhost. Outside
that, `fetch` to the API fails **silently** — no console error, no network row.
The CSP lives in `middleware.ts` only, not `next.config.js`.

### 3. Casing differs by direction

Responses are camelCased automatically: `transformKeys` (`api.ts:130`) is
applied inside `api.request` (`api.ts:440`), so anything going through
`request()` gets it for free. `api-client.ts` imports the same function rather
than redefining it.

Request params do **not** transform — `encodeParams` (`api-client.ts:34`) passes
keys through, so query strings and JSON bodies stay snake_case.

Raw `fetch` bypassing `request()` gets no transform at all.

### 4. CSRF and auth allowlists are narrow and must agree

`csrf.SKIP_PREFIXES` is `frozenset({"/scim"})` — **not** `/api/v1/auth`. That
was deliberately narrowed; a blanket auth skip would exempt every future auth
endpoint.

- `csrf.SKIP_PATHS` enumerates individual public endpoints, including
  `/csrf-token` and several `/api/v1/auth/*` paths.
- `auth.PUBLIC_PATHS` is a separate list with its own auth entries.
- `/api/v1/auth/refresh` is **conditionally** exempt — skipped only when the
  credential is explicit in the body; a cookie-borne refresh is challenged,
  because rotation makes a forged retry lock the user out.

**A new auth endpoint must be added to both lists** or it returns 403.

---

## Running the servers

```powershell
# Terminal 1 — API. Generate fresh secrets per machine; never reuse.
#   $env:JWT_SECRET="$(openssl rand -hex 32)"     # 32+ chars required (F-07)
#   $env:ENCRYPTION_KEY="$(openssl rand -base64 32)"
$env:JWT_SECRET="test-jwt-secret-for-ci-only-32-chars-long!!"
$env:ENCRYPTION_KEY="$(openssl rand -base64 32)"
$env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"
$env:LLM_API_KEY="mock-key"; $env:OTEL_SDK_DISABLED="true"
uv run --project apps/api python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — frontend
pnpm dev:web
```

Python is pinned to 3.12 through `apps/api/.python-version` and the venv is
managed by `uv`. Run commands through `uv run --project apps/api` so you get it.

**Port 3000 collisions** — leftover processes block the port. Fix:
`Get-Process -Name "node" | Stop-Process -Force`, then retry.

`apps/web/next.config.js:20` sets `output: 'standalone'` only when
`CI === 'true'` **and** platform isn't win32 — local builds stay fast.

Test accounts: `audit@vaeloom.test` / `AuditPass123!` (auto-seeded for e2e
through `apps/web/e2e/api-launcher.py`), or sign up at `localhost:3000/signup`.
`demo@vaeloom.app` only exists on seeded DBs.

---

## Backend testing

**Do not trust a full-suite pass/fail count.** The suite crashes under xdist —
`INTERNALERROR` plus a Windows fatal exception `0xc000070a` from the asyncio
loop on `tests/security/`. The crash truncates the run, so the reported totals
are wrong and a `-n 4` result is not evidence.

- Iterate per-file or per-area.
- Trust `-o addopts=""` (serial) for a whole-suite number.
- `addopts = "-n 4 --dist loadfile --timeout=120 --timeout-method=thread"`
  (`apps/api/pyproject.toml`).

Tests use SQLite with a mock backend — a `tmp_path` per-test DB through
`NullPool`. `mock_llm` and `mock_connector_test` are autouse fixtures in
`apps/api/tests/conftest.py:381` and `:436`.

**When patching LLM methods, patch the class _and_ the `llm_service`
singleton.** The class-level fakes take `self`; a bare function assigned to the
singleton does not, and a stale instance attribute left by an earlier test
silently shadows the class patch. See `tests/test_semantic_ats_tools.py`.

Live suites (`tests/integration/module05/`, `tests/adversarial/module05/`) use
real MinIO S3, real TypeSafe AI Jev, and real Ollama Cloud. They are marked
`live_provider` and bypass the LLM mock. Run them with `-o addopts=""`.

---

## RLS and multi-tenancy invariants

- **GUCs are transaction-scoped.** `set_config(..., is_local=true)` means a
  query issued _after_ the session block gets zero rows and **does not raise**.
  Any read of a FORCE-RLS table must open its session first and resolve inside
  it. See `services/ranking_weights.py:190-200` for the correct shape.
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
- **Every table in `public` needs RLS _and_ a policy.** `0066` ends with
  `_assert_schema_wide_coverage`, which raises if any public table is missing
  either. A migration that creates a table without them fails the chain.
- HNSW indexes already exist (`0011_hnsw_index.py`, both `vector_cosine_ops`).
  The ORM `__table_args__` lists only B-tree indexes and is not the DB state.

---

## Memory subsystem invariants

- **Two type taxonomies plus a generated artefact.** The backend literal
  (`schemas/memory.py:21`) is the source; `packages/shared-types` mirrors it and
  `memory.generated.ts` is generated from it. Change one, change both,
  regenerate: `python scripts/gen_memory_type_union.py`. CI runs `--check`
  (byte-exact) — `ci-backend.yml:50`. Never hand-edit `*.generated.ts`;
  `.prettierignore` excludes it so lint-staged can't reformat the artefact.
- **The whitelist lives in the service, not in Pydantic.** `MemoryCreate.type`
  is `str` and validates shape only. Migration 0068 **dropped**
  `ck_memories_type_valid`, so the service-layer `memory_type_packs` check is
  the only guard on the write path. Re-adding a Pydantic whitelist recreates the
  drift.
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
  (`memory_service.py:437`). `memory_agent/retrieval.py` is deleted — it had no
  production importers. Ranking and budget logic is `services/context_engine.py`
  (`token_budget=2000`).
- **`user_preference_vectors.preference_vector` is not wired into ranking.**
  `search_ranking.py` consumes structured `preferred_tags` / `preferred_types`;
  the embedding column is read only by `recommendation_service.generate()`.
- Known gaps, deliberately left: `memory_records` still carries its own frozen
  `ck_memory_records_type_valid`, and `import_memories` builds `Memory(...)`
  directly, bypassing the pack registry. The guarantee today is "the three
  service write paths validate", not "all memory writes".

---

## Agent loop invariants

- **ReAct is live.** `agent_react_enabled` defaults `True` (`config.py:213`).
  ReAct intercepts `act_phase` before static dispatch, so **tests that are about
  the static ladder must pin `settings.agent_react_enabled = False`** — see
  `TestActPhase::test_dispatch_paths` and `test_qa_loop_gate.py`.
- ReAct output is gated. `run_agent_loop` and the streaming loop each hold their
  own QA grounding gate (`loop.py` ~3336 and ~3678), both operating on
  `act_phase`'s result. `tests/test_react_revival_safety.py` proves a rejected
  act result never reaches the user and that the scope and AgentCard gates still
  deny unauthorised tools.

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
  OpenAPI size in this file unless you measured it in this session. The previous
  revision accumulated count history and contradicted itself across sections.
- **Do not edit an expectation to make a test green.** See Known open gaps.

---

## Known open gaps — do not silently "fix" these

- **Golden retrieval `r15`** — `tests/eval/golden_retrieval.json` expects
  `job_search` for _"generate weekly digest of my job search activity"_; the
  router returns `reflection`. The drift is between `router.py` and the fixture.
  Reconcile one of them deliberately; do not edit the fixture.
- **`recommendation_feedback` has no `workspace_id`**, so `user_preference`
  learning aggregates on `user_id` alone — a rating in one workspace moves the
  profile in another. `POST /feedback` enforces `rec_user_id == caller` (403);
  **two sibling endpoints still take `user_id` from the body with no ownership
  compare**.
- **Enterprise auth is partial** — SAML exists in `services/saml.py` with real
  `signxml` but is not wired to the router; RBAC is a dependency-injection
  helper, not middleware.
- **~25 tables carry `USING (true)` service policies** covering `vaeloom_app`
  (0047). For the app role those rely on app-layer scoping only — see
  `docs/security/RLS-SERVICE-POLICY-EXPOSURE.md`.
- **`pfi 7.1.0` + FastAPI `0.141.1` requires a shim** until upgrade — see
  `.agents/findings/archive/37-pfi-fastapi-every-request-500.md`.

---

## Repo map

**25 packages**, all under the pnpm workspace.

```
apps/           web (Next.js 15) · api (FastAPI/Python)
packages/       ui-kit · shared-types · eslint-config · tsconfig · observability
integrations/   calendar · email · github · google-drive · notion · slack
connectors/     graphql · mcp · rest
sdk/            typescript
plugins/        tag-generator · word-count · sentiment · summarizer · translator
```

**Where to look**

| Thing                            | Path                                                            |
| -------------------------------- | --------------------------------------------------------------- |
| Phase contracts (governing spec) | `specs/phase-contracts/` — start `00-master-index.md`           |
| Execution status                 | `specs/phase-contracts/EXECUTION-STATUS.md`                     |
| Phase evidence, gates, handoffs  | `evidence/phases/<track>/<track>-pXX/`                          |
| Architecture decisions           | `docs/adr/ADR-001…ADR-045`                                      |
| Coding guidelines                | `docs/coding-guidelines/`                                       |
| Language standards               | `docs/engineering/Coding-Standards.md`                          |
| OpenAPI (generated, committed)   | `specs/api/openapi.yaml`, `docs/backend/openapi.yaml`           |
| Migrations                       | `apps/api/alembic/versions/` — head is `0068_memory_type_packs` |

A knowledge graph of the codebase lives in `graphify-out/` — useful for "who
calls this" / "what depends on that" before you grep.

---

## Known state

Measured numbers are deliberately absent from this file — they go stale. Run the
command and read the output. See
`evidence/phases/mvp/mvp-p00/03-maturity-and-evidence-matrix.md` for the last
full audit and its caveats.
