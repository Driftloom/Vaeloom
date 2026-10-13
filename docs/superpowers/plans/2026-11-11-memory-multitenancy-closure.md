# Memory & multi-tenancy closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migration 0069 closes three silent-failure gaps in the memory and multi-tenancy subsystem: workspace-scoped preference learning, registry-validated imports, and a single frozen vocabulary.

**Architecture:** One migration carries the schema change; the service and router changes make the code honour it; the verification harness proves it. Nothing validates `workspace_id` from a request body — it comes from authenticated context only.

**Tech Stack:** Python 3.12 (uv), Alembic, SQLAlchemy async + asyncpg, FastAPI, pytest, PostgreSQL 16 + pgvector.

**Spec:** `docs/superpowers/specs/2026-11-11-memory-multitenancy-closure-design.md`

## Global Constraints

- **`workspace_id` is nullable and legacy rows stay `NULL`.** Never backfill a guess. Learning queries filter `WHERE workspace_id = :workspace_id`, so `NULL` rows contribute nothing.
- **No request body ever supplies `workspace_id`.** It comes from authenticated context. `recommendations.py:73` already overwrites `dto.workspace_id` from `get_workspace_id` — that is the pattern.
- **Assert exact status codes.** `403` for ownership mismatch on `POST /index`; `422` for an out-of-vocabulary memory type. `assert x in (403, 404)` is banned.
- **Migration 0066's `_assert_schema_wide_coverage` must pass.** Every public table needs RLS *and* at least one policy, or the chain fails.
- **Parts 2 and 3 ship together.** Dropping `ck_memory_records_type_valid` is only safe once every `memory_records` write path validates.
- **Never adjust a test to accommodate a broken migration.**
- Run backend tests serially: `-o addopts=""`.
- Never `git checkout`, `git reset`, or bulk `git add`; a concurrent process edits `master`. Stage exact paths.
- **Do not run migrations against any non-local database.** The Supabase project in `apps/api/.env` stays at `0067`; deployment runs from CI/CD only.

## Review Focus

Five failure modes the spec implies that no happy-path test exercises:

1. **A `NULL`-workspace legacy row still influencing ranking.** The isolation test proves A≠B; nothing proves quarantine. Expected: a `NULL` row contributes nothing.
2. **An import that fails midway leaving partial rows.** Expected: atomic — zero rows written when any row is invalid.
3. **`MemoryRecord(type=<future literal>)`** in `document_service.py` bypassing validation after the CHECK is dropped. Expected: both construction sites validate.
4. **`downgrade -1` over out-of-vocabulary `memory_records` data.** Expected: refuses and names the value, not a silent success.
5. **A rating arriving with no workspace context.** Expected: no-op that never fails the rating, matching `record_feedback_signal`.

---

### Task 1: Migration 0069 — schema and RLS

**Files:**
- Create: `apps/api/alembic/versions/0069_memory_workspace_isolation.py`

**Interfaces:**
- Consumes: head `0068_memory_type_packs`.
- Produces: `recommendation_feedback.workspace_id` (nullable), `user_preference_vectors.workspace_id` with PK `(user_id, tenant_id, workspace_id)`, `ck_memory_records_type_valid` dropped, and workspace-aware RLS policies on both recommendation tables.

- [ ] **Step 1: Write the failing DDL tests**

Add to `apps/api/tests/test_migration_chain_pg.py` (live-PG, skipped without `VAELOOM_TEST_PG_URL`):

```python
def test_0069_adds_nullable_workspace_to_recommendation_feedback():
    # column exists, is_nullable True, and existing rows are not backfilled
def test_0069_user_preference_vectors_is_keyed_by_workspace():
    # PK columns == {user_id, tenant_id, workspace_id}
def test_0069_drops_the_second_frozen_vocabulary():
    # ck_memory_records_type_valid absent on memories? no -- absent on memory_records
def test_0069_rls_covers_every_touched_table():
    # each of the two tables has RLS enabled AND >=1 policy
def test_0069_policy_scopes_on_workspace():
    # the feedback policy definition references workspace_id, not just user_id
```

- [ ] **Step 2: Confirm they fail**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_migration_chain_pg.py -q -o addopts="" -k 0069`
Expected: FAIL — 0069 does not exist.

- [ ] **Step 3: Write `upgrade()`**

In order, each step idempotent:

1. `ALTER TABLE recommendation_feedback ADD COLUMN IF NOT EXISTS workspace_id uuid NULL;`
2. `user_preference_vectors`: add `workspace_id uuid NULL`, drop the old PK, add PK on `(user_id, tenant_id, workspace_id)`. Use `DO $$ ... EXCEPTION WHEN duplicate_table/duplicate_object THEN NULL $$` so a rerun past a partial failure still lands.
3. Drop `ck_memory_records_type_valid` from `memory_records`, guarded `IF EXISTS`.
4. **RLS:** drop and recreate the policies on `recommendation_feedback` and `user_preference_vectors` so both scope on `workspace_id` using the same `current_setting('app.workspace_id', true)` idiom the rest of the chain uses. `APP.workspace_id` is transaction-scoped, so follow `ranking_weights.py:190-200` for the correct session shape.
5. Do **not** touch any other table's policy.

- [ ] **Step 4: Write `downgrade()`**

The exact reverse. Restore `ck_memory_records_type_valid` with its **24 literals**, byte-identical to `0027_memory_taxonomy_expand_contract.py:89-95` — copy them from there rather than retyping, so the two cannot drift. Revert the PK. Drop `workspace_id`.

Because 0068 established that a downgrade must refuse over out-of-vocabulary data, `downgrade()` must re-add the constraint in a way that *fails* if such a row exists. Do not pre-delete rows to make it pass.

- [ ] **Step 5: Run the DDL tests against the container**

Run: `cd apps/api && $env:VAELOOM_TEST_PG_URL="postgresql+asyncpg://postgres:vaeloom_verify_pw@127.0.0.1:5433/vaeloom_test"; .venv\Scripts\python.exe -m pytest tests/test_migration_chain_pg.py -q -o addopts=""`
Expected: PASS. (Start the container with `scripts/run_pg_verification.ps1`'s image if none is running.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/alembic/versions/0069_memory_workspace_isolation.py apps/api/tests/test_migration_chain_pg.py
git commit -m "feat(db): add workspace isolation and retire the second frozen vocabulary"
```

---

### Task 2: Service and router honour the new schema

**Files:**
- Modify: `apps/api/src/api/services/recommendation_service.py` (SELECT ~line 30, INSERT ~line 351)
- Modify: `apps/api/src/api/routers/recommendations.py:96-102`
- Modify: `apps/api/src/api/services/memory_service.py` (`import_memories`)
- Modify: `apps/api/src/api/services/document_service.py:612,1761`

**Interfaces:**
- Consumes: `memory_type_packs` — reuse the exact validation helper `memory_service`'s create/update/supersede paths already call. Do not write a second validator.
- Produces: no new public API. `POST /index` returns 403 on mismatch; `import_memories` returns 422 on an out-of-vocabulary type.

- [ ] **Step 1: Write the failing tests**

```python
# recommendations router
def test_post_index_rejects_a_user_id_that_is_not_the_caller():  # 403 exactly
def test_post_index_allows_the_caller_to_reindex_themselves():   # not 403

# recommendation_service
def test_learning_ignores_feedback_from_another_workspace()
def test_learning_ignores_feedback_with_a_null_workspace()      # the quarantine

# memory_service.import_memories
def test_import_rejects_an_out_of_vocabulary_type_with_422()
def test_import_writes_nothing_when_any_row_is_invalid()        # atomic
def test_import_accepts_an_active_pack_type_and_records_provenance()

# document_service
def test_memory_record_write_validates_its_type(monkeypatch)     # both call sites
```

- [ ] **Step 2: Confirm they fail**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_recommendations*.py tests/test_memory_service*.py -q -o addopts=""`
Expected: FAIL.

- [ ] **Step 3: Scope the learning queries**

In `recommendation_service.py`, add `workspace_id` to the `user_preference_vectors` SELECT and the `ON CONFLICT` INSERT. Bind it from the caller, never from a payload. A `NULL` workspace must make the learning step a no-op, matching the behaviour `ranking_weights.record_feedback_signal` already has — a rating must never fail because it cannot learn.

- [ ] **Step 4: Close `POST /index`**

In `recommendations.py:96-102`, derive `current_uid` from `current_user` exactly as line 55 does, and return `403` when `dto.user_id != current_uid`. Do not return 404 and do not silently no-op.

- [ ] **Step 5: Validate `import_memories`**

Validate every row's `type` against the active packs **before** writing anything, then write. Reject the batch as a whole with `MemoryTypeRejected` → **422**. Validation before insert is what makes the batch atomic; validating per row as you insert would leave partial rows behind.

- [ ] **Step 6: Validate both `MemoryRecord` write paths**

`document_service.py:612` and `:1761` construct `MemoryRecord(type="document")`. Both must validate through the registry **before** Task 1's CHECK is dropped. Both literals are currently valid, so this adds no behaviour change today — its purpose is that a future edit to either literal cannot bypass the registry. Without this, Task 1 Step 3 removes the last database-level guard on `memory_records.type`.

- [ ] **Step 7: Run the tests**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/ -q -o addopts="" -k "recommend or memory_service or document_service"`
Expected: PASS.

- [ ] **Step 8: Run the broader regression set**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_memory_type_packs.py tests/test_memory_vector_correctness.py tests/test_ranking_weights.py -q -o addopts=""`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/api/services/recommendation_service.py apps/api/src/api/routers/recommendations.py apps/api/src/api/services/memory_service.py apps/api/src/api/services/document_service.py
git commit -m "fix(memory): scope preference learning by workspace and validate every write path"
```

---

### Task 3: Verify and record

**Files:**
- Modify: `docs/verification/memory-audit.md`
- Modify: `AGENTS.md`
- Create: `evidence/verification/memory-0069.txt`

- [ ] **Step 1: Run the full harness**

Run: `pnpm verify:pg`
Expected: all nine steps pass, exit 0. This covers `upgrade head` from empty, the four live-PG suites with zero skips, the 0068 rollback proof, the round trip, and re-assertion.

- [ ] **Step 2: Prove the downgrade refuses**

Against the container, with an out-of-vocabulary `memory_records` row present, run `alembic downgrade -1`. It must fail and name the value. This is the 0069 equivalent of the proof Spec 1 built for 0068. Record the actual output — do not assert it from memory.

- [ ] **Step 3: Correct `AGENTS.md`**

The Known open gaps entry for `recommendation_feedback` is now resolved; remove it and replace with the new invariant: **`workspace_id` is nullable, legacy rows are quarantined and contribute nothing, and no endpoint may take it from a body.** Record `POST /index`'s ownership check. Record that `memory_records.type` is now registry-validated with no database constraint, which makes the two `document_service` write paths load-bearing.

- [ ] **Step 4: Record evidence**

Write `evidence/verification/memory-0069.txt`: what ran, exact test counts, what the downgrade refusal printed, and — explicitly — what is still unproven (concurrency during rollback, behaviour at volume).

- [ ] **Step 5: Commit**

```bash
git add docs/verification/memory-audit.md AGENTS.md evidence/verification/memory-0069.txt
git commit -m "docs(memory): record 0069 verification and the new invariants"
```
