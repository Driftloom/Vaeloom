# PostgreSQL Migration Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the 68-migration chain applies, isolates, and rolls back correctly against a real PostgreSQL 16 with pgvector — currently 10 live-PG tests are skipped and the one irreversible migration is only rehearsed against an empty table.

**Architecture:** One canonical script, `scripts/verify_pg_migrations.py`, owns every assertion about migration behaviour and knows nothing about Docker. CI invokes it against its existing service container; `scripts/run_pg_verification.ps1` wraps it for local use by starting a disposable container on port 5433 and tearing down both container and volume afterwards.

**Tech Stack:** Python 3.12 (`uv`), Alembic, SQLAlchemy async + asyncpg, pytest, PostgreSQL 16 + pgvector, PowerShell 5.1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-07-pg-migration-verification-design.md` — the plan argues from the spec, so the spec travels with it; executors read both.

## Global Constraints

- **Never defaults to host port 5432.** It is occupied by a native Windows PostgreSQL 18 service. Default is **5433**, overridable by `VAELOOM_PG_VERIFY_PORT`.
- Container image is exactly `pgvector/pgvector:pg16`. Match CI; do not upgrade to pg18 — a version mismatch means local proof and CI proof prove different systems.
- Fixed container name `vaeloom-pg-verify` so a stale instance from a crashed run is detected, not silently reused.
- `run_pg_verification.ps1` removes the container **and its volume**. A surviving verification database is a trap: the next run inherits the previous schema and proves nothing.
- **Scripts run with CWD = `apps/api`**, matching the existing convention (`python ../../scripts/verify_architecture.py` in `ci-backend.yml`). The script resolves the repo root itself; never rely on the caller's CWD.
- The target database name must end with `_proof` or `_test`. The script refuses otherwise.
- `alembic` must be invoked from `apps/api` so `alembic.ini` and the version scripts resolve.
- Never `git checkout`, `git reset`, or bulk `git add`. A concurrent process is editing `master`. Stage exact paths only.
- Run backend tests serially: `-o addopts=""`. Default `-n 4` xdist is unreliable on Windows.
- Known pre-existing failures that are **not** blockers: `test_TE05_provider_fallback`, `test_TE25_full_combined`, `test_public_profile`, `test_get_avatar_public`.
- **Never adjust a test to accommodate a broken migration.** These tests describe intended behaviour; the migration is the unproven part.

## Review Focus

Five failure modes the spec implies but no requirement pins. Each line gets its test in the task named.

1. **A developer points the script at a real database.** `VAELOOM_TEST_PG_URL` is a copy-pasteable value and the script provisions roles and runs destructive migrations. Expected: refuse unless the name ends `_proof`/`_test`, naming the offending name. → Task 1
2. **The downgrade fails for an unrelated reason** — missing role, permission denied, bad `alembic.ini` — and the script mistakes that red run for the expected CHECK violation. Expected: a different failure does **not** satisfy the assertion; step 5 requires the specific constraint name. → Task 2
3. **A stale `vaeloom-pg-verify` container is already running.** Expected: refuse and report it, not reuse it — reuse would verify a schema it did not create. → Task 3
4. **Host port 5433 is already bound** by something else. Expected: refuse with a message naming the port and the override variable, not fail obscurely mid-migration. → Task 3
5. **`alembic` is not resolvable, or CWD is wrong.** Expected: fail naming the `apps/api` working-directory requirement, before any partial migration is left behind. → Task 1

---

### Task 1: Safety guards and step sequencer

**Files:**
- Create: `scripts/verify_pg_migrations.py`
- Test: `apps/api/tests/test_verify_pg_migrations_script.py`

**Interfaces:**
- Consumes: nothing. First task.
- Produces:
  - `UnsafeTargetError(RuntimeError)`
  - `guard_target_database(db_name: str) -> None` — raises `UnsafeTargetError` unless `db_name` ends with `_proof` or `_test`
  - `resolve_alembic_cwd(repo_root: Path) -> Path` — returns `repo_root / "apps" / "api"`; raises `RuntimeError` if `alembic.ini` is absent there
  - `parse_args(argv: Sequence[str] | None) -> argparse.Namespace` with `--pg-url` (required), `--repo-root` (default: two levels above the script), `--alembic` (default `"alembic"`)
  - `database_name_from_url(url: str) -> str`
  - `main(argv: Sequence[str] | None = None) -> int` — returns `0` on success, `1` on a failed step, `2` on a guard rejection
  - Module constant `VERIFICATION_STEPS: tuple[str, ...]` — the ordered step names
  - Module constant `APP_ROLE = "vaeloom_app"`, `APP_PASSWORD = "vaeloom_app_proof_pw"`, `NONLOGIN_ROLES = ("service_role", "authenticated")`

- [ ] **Step 1: Write the failing guard tests**

```python
def test_guard_accepts_proof_database():        # vaeloom_rls_proof -> no raise
def test_guard_accepts_test_database():         # vaeloom_test -> no raise
def test_guard_rejects_production_database():   # vaeloom_prod -> UnsafeTargetError, message contains "vaeloom_prod"
def test_guard_rejects_bare_name():             # "postgres" -> UnsafeTargetError
def test_database_name_from_url_ignores_query():        # ?ssl=... stripped
def test_database_name_from_url_ignores_trailing_slash():# trailing slash stripped

def test_main_rejects_unsafe_database_before_touching_alembic(monkeypatch):
    # fake alembic on PATH records invocations into a list;
    # run main(["--pg-url", ".../vaeloom_prod", "--alembic", str(fake)])
    # expect returncode 2 AND the invocation list is empty

def test_resolve_alembic_cwd_missing_ini(tmp_path):
    # no alembic.ini under apps/api -> RuntimeError naming apps/api
```

- [ ] **Step 2: Run the guard tests and confirm they fail**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_verify_pg_migrations_script.py -q -o addopts=""`
Expected: FAIL — `ModuleNotFoundError` or `cannot import name 'guard_target_database'`.

- [ ] **Step 3: Create the script skeleton with guards and the sequencer**

Create `scripts/verify_pg_migrations.py` with `argparse`, `pathlib`, `subprocess`, and `urllib.parse.urlparse`. Define `UnsafeTargetError`, `guard_target_database`, `database_name_from_url`, `resolve_alembic_cwd`, `parse_args`, `main`, and the three constants above.

`main` must, in this order: parse args → `guard_target_database(database_name_from_url(args.pg_url))` → `resolve_alembic_cwd(args.repo_root)` → walk `VERIFICATION_STEPS`, invoking `step_1_upgrade_head` … `step_8_reassert_invariants` (stubs returning `None` for Tasks 1–2; filled in Task 2). Return `1` on the first step that raises, printing the step name to stderr before exiting.

Guard rejection must happen **before** any subprocess call. That ordering is the test in `test_main_rejects_unsafe_database_before_touching_alembic`.

- [ ] **Step 4: Run the guard tests and confirm they pass**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_verify_pg_migrations_script.py -q -o addopts=""`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify_pg_migrations.py apps/api/tests/test_verify_pg_migrations_script.py
git commit -m "feat(verify): add PG verification script with target-database guards"
```

---

### Task 2: Role preflight and the rollback probe

This is the task that matters most. It proves the one irreversible operation in the memory work refuses out-of-vocabulary data instead of silently accepting it.

**Files:**
- Modify: `scripts/verify_pg_migrations.py`
- Test: `apps/api/tests/test_verify_pg_migrations_script.py`

**Interfaces:**
- Consumes: `database_name_from_url`, `resolve_alembic_cwd`, `UnsafeTargetError`, `APP_ROLE`, `APP_PASSWORD`, `NONLOGIN_ROLES`, `main`, `VERIFICATION_STEPS` (all from Task 1).
- Produces:
  - `ensure_roles(pg_url: str) -> None` — idempotent. Creates `service_role` and `authenticated` as `NOLOGIN`; creates **or alters** `vaeloom_app` to `LOGIN PASSWORD 'vaeloom_app_proof_pw'`; grants `CONNECT` on the target database and `USAGE` on schema `public`.
  - `seed_rollback_probe(pg_url: str) -> None` — creates a workspace, a `memory_type_packs` row with slug `rollback_probe`, vocabulary `["job_posting"]`, and one `memories` row of `type='job_posting'` in that workspace.
  - `assert_downgrade_failed_as_expected(returncode: int, output: str) -> None` — raises unless **all three** hold: `returncode != 0`; `"ck_memories_type_valid"` in `output`; `"job_posting"` in `output`.
  - `rollback_probe_literals() -> tuple[str, str, str]` — returns `("rollback_probe", "job_posting", "ck_memories_type_valid")`, so tests assert against the same constants the implementation uses rather than re-typing them.

**Note on `ensure_roles`:** `apps/api/tests/test_rls_live_pg.py:79-90` already creates `vaeloom_app` behind an `IF NOT EXISTS (SELECT FROM pg_roles ...)` guard, and `.github/workflows/migration-chain.yml:90-98` creates it as `NOLOGIN`. If CI's `NOLOGIN` role wins, the tests' guard skips creation and the role can never log in — which is why `test_rls_live_pg.py` was never added to CI. `ensure_roles` must therefore `ALTER ROLE ... LOGIN` when the role already exists, not skip.

- [ ] **Step 1: Write the failing assertion tests**

```python
def test_assert_downgrade_rejects_zero_exitcode():        # rc=0 -> raises
def test_assert_downgrade_rejects_unrelated_failure():    # rc=1, output="ERROR: permission denied for schema public" -> raises
def test_assert_downgrade_rejects_missing_value():        # rc=1, names constraint but not the value -> raises
def test_assert_downgrade_rejects_missing_constraint():    # rc=1, names value but not constraint -> raises
def test_assert_downgrade_accepts_expected_failure():     # rc=1, output contains BOTH -> no raise
def test_assert_downgrade_rejects_empty_output():
    # rc=1, output="" -> raises, NOT silently passing.
    # Guards the green-by-emptiness class this whole spec exists to eliminate.

def test_rollback_probe_literals_are_stable():
    # asserts the three constants; guards test/prod drift
```

- [ ] **Step 2: Run the assertion tests and confirm they fail**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_verify_pg_migrations_script.py -q -o addopts=""`
Expected: FAIL — `ImportError` for `assert_downgrade_failed_as_expected`.

- [ ] **Step 3: Implement `ensure_roles` and `rollback_probe_literals`**

In `scripts/verify_pg_migrations.py`, connect with SQLAlchemy async + asyncpg using `VAELOOM_TARGET_URL` falling back to the `--pg-url` value. Execute the role bootstrap as a single `DO $$ ... $$;` per role using the same `IF NOT EXISTS` shape as `test_rls_live_pg.py:79-90`, but with an `ELSE` branch running `ALTER ROLE vaeloom_app LOGIN PASSWORD ...` so a pre-existing `NOLOGIN` role is corrected rather than skipped. Then grant `CONNECT` on the target database and `USAGE` on `public`.

Add `rollback_probe_literals()` returning the three constants.

- [ ] **Step 4: Run the assertion tests and confirm the pure ones pass**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_verify_pg_migrations_script.py -q -o addopts="" -k "assert or literals"`
Expected: PASS. The `ensure_roles` code is covered by Task 5's real run, not here.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify_pg_migrations.py apps/api/tests/test_verify_pg_migrations_script.py
git commit -m "feat(verify): add role preflight and rollback-probe constants"
```

- [ ] **Step 6: Implement the eight steps**

Replace the Task 1 stubs in `main` with the real bodies, in `VERIFICATION_STEPS` order:

1. `ensure_roles` — must run **before** step 1, because migrations issue `GRANT ... TO service_role, authenticated, vaeloom_app` and `CREATE POLICY ... TO vaeloom_app`, which fail if the roles are absent. Keep it as step 0 inside the walked sequence and say so in its step name.
2. `alembic upgrade head` via `subprocess.run([args.alembic, "upgrade", "head"], cwd=alembic_cwd, capture_output=True, text=True)`. Non-zero → raise.
3. Run the live-PG suite: `pytest tests/test_migration_chain_pg.py tests/test_migration_0057_pg.py tests/test_rls_live_pg.py tests/test_ranking_weights_rls.py -v -o addopts=""` from `alembic_cwd`. Any `skipped` result on these files is a **failure**, not a pass — a skipped test is exactly the condition this spec exists to eliminate.
4. `seed_rollback_probe`.
5. `alembic downgrade -1`; capture returncode and merged stdout+stderr; pass both to `assert_downgrade_failed_as_expected`.
6. Delete the `rollback_probe` pack and the probe `memories` row (the pack first, so no active vocabulary references the type), then `alembic downgrade -1` and require zero.
7. `alembic upgrade head`.
8. Re-run the live-PG suite from step 3.

Steps 3 and 8 invoke pytest through the same resolved interpreter the caller used (`sys.executable`), not a bare `pytest`, so the plan works under both `uv run` in CI and the local venv.

- [ ] **Step 7: Run the full script unit tests and confirm they pass**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_verify_pg_migrations_script.py -q -o addopts=""`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add scripts/verify_pg_migrations.py
git commit -m "feat(verify): implement the eight migration verification steps"
```

---

### Task 3: Local disposable-container wrapper

**Files:**
- Create: `scripts/run_pg_verification.ps1`
- Test: `apps/api/tests/test_run_pg_verification_wrapper.py`

**Interfaces:**
- Consumes: `scripts/verify_pg_migrations.py` from Tasks 1–2, invoked as `python <repo_root>/scripts/verify_pg_migrations.py --pg-url postgresql://postgres:<password>@localhost:<port>/vaeloom_test`.
- Produces: `scripts/run_pg_verification.ps1`, which on success exits 0 and leaves no container or volume behind.

Constants: `$ContainerName = "vaeloom-pg-verify"`, `$Image = "pgvector/pgvector:pg16"`, `$Database = "vaeloom_test"`, `$Password = "vaeloom_verify_pw"`, port from `$env:VAELOOM_PG_VERIFY_PORT` else `5433`.

- [ ] **Step 1: Write the failing wrapper tests**

These run only when Docker is available; gate them with `pytest.mark.skipif(shutil.which("docker") is None, ...)`.

```python
def test_wrapper_refuses_when_port_already_bound(docker_available):
    # bind 5433 with a throwaway listener, run the wrapper,
    # assert it exits non-zero AND prints the port and VAELOOM_PG_VERIFY_PORT,
    # AND no container named vaeloom-pg-verify was created

def test_wrapper_refuses_when_stale_container_exists(docker_available):
    # start a stopped container named vaeloom-pg-verify, run the wrapper,
    # assert non-zero exit naming the stale container,
    # assert the stale container is still there (wrapper did not delete it)

def test_wrapper_tears_down_container_and_volume_on_success(docker_available):
    # run against a real container, assert exit 0,
    # assert `docker ps -a --filter name=vaeloom-pg-verify` is empty
```

- [ ] **Step 2: Run the wrapper tests and confirm they fail**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_run_pg_verification_wrapper.py -q -o addopts="" -m ""`
Expected: FAIL — the script does not exist.

- [ ] **Step 3: Implement the wrapper**

`scripts/run_pg_verification.ps1`, in order:

1. **Stale-container guard.** `docker ps -a --filter "name=^/vaeloom-pg-verify$" --format "{{.ID}}"`. If non-empty: `Write-Error` naming it and exit 1. Do **not** remove it — it may be someone else's in-flight run.
2. **Port guard.** `Test-NetConnection -ComputerName 127.0.0.1 -Port $Port`. If it succeeds, the port is taken: `Write-Error` naming the port and `$env:VAELOOM_PG_VERIFY_PORT`, exit 1.
3. **Start** `docker run -d --name vaeloom-pg-verify -e POSTGRES_PASSWORD=$Password -e POSTGRES_DB=$Database -p "127.0.0.1:${Port}:5432" $Image`.
4. **Wait** for readiness by polling `docker exec vaeloom-pg-verify pg_isready -U postgres -d $Database` until success or 60s elapsed; exit 1 with the captured log on timeout.
5. **Invoke** `python <repo_root>/scripts/verify_pg_migrations.py --pg-url "postgresql://postgres:$Password@127.0.0.1:$Port/$Database"`, capture `$LASTEXITCODE`.
6. **Always** `docker rm -f -v vaeloom-pg-verify` in a `finally`, whether the script passed, failed, or the wrapper threw.
7. `exit $scriptExitCode`.

Bind to `127.0.0.1` explicitly. Publishing on `0.0.0.0` would expose a throwaway superuser database on every interface for the life of the run.

- [ ] **Step 4: Run the wrapper tests and confirm they pass**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_run_pg_verification_wrapper.py -q -o addopts=""`
Expected: PASS. Docker is available in this environment.

- [ ] **Step 5: Run the wrapper end to end**

Run: `powershell -ExecutionPolicy Bypass -File scripts/run_pg_verification.ps1`
Expected: exit 0 on a clean migration chain. **A non-zero exit here is a real finding, not a harness bug** — record it and go to Task 5.

- [ ] **Step 6: Commit**

```bash
git add scripts/run_pg_verification.ps1 apps/api/tests/test_run_pg_verification_wrapper.py
git commit -m "feat(verify): add disposable pg16 runner for local verification"
```

---

### Task 4: Rewire CI onto the single definition

**Files:**
- Modify: `.github/workflows/migration-chain.yml:90-266`
- Modify: `apps/api/tests/test_ranking_weights_rls.py:415-425`

**Interfaces:**
- Consumes: `scripts/verify_pg_migrations.py` (Tasks 1–2), which reads `VAELOOM_TEST_PG_URL`.
- Produces: a `migration-chain.yml` whose verification steps delegate entirely to the script, with no duplicated migration or test logic.

- [ ] **Step 1: Add the missing target-database guard to `test_ranking_weights_rls.py`**

`apps/api/tests/test_rls_live_pg.py:131-133` skips unless the database name ends `_proof`/`_test`. `apps/api/tests/test_ranking_weights_rls.py:421-423` gates only on the env var being non-empty — so pointing `VAELOOM_TEST_PG_URL` at a production database today runs role provisioning and destructive tests against it.

Mirror the `test_rls_live_pg.py` guard: extend its `skipif` so the condition also requires the extracted database name to end with `_proof` or `_test`, reusing the existing `_target_db()`-style helper that already exists in that module. Update the `reason=` string to name both the variable and the suffix rule.

Add a unit test asserting the skipif condition is present and that a URL ending `vaeloom_prod` is skipped — this file's own tests are skipped without a database, so assert on the marker rather than by executing.

- [ ] **Step 2: Run the guard test and confirm it fails, then passes**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_ranking_weights_rls.py -q -o addopts=""`
Expected: before the edit, the new guard test FAILs; after, PASS.

- [ ] **Step 3: Replace the CI verification block**

In `.github/workflows/migration-chain.yml`, delete the `Create the Supabase-compatible roles` step (currently lines 90–98) and every step from `Run the migration chain from empty` through `Re-run the migration and RLS invariants after the round trip` (currently lines 100–266). Replace with one step:

```yaml
      - name: Verify migration chain, rollback refusal, and RLS invariants
        run: uv run python ../../scripts/verify_pg_migrations.py
```

The job already exports `VAELOOM_TEST_PG_URL` (line 68) pointing at `vaeloom_test` — which satisfies the `_proof`/`_test` guard — and keeps the `pgvector/pgvector:pg16` service container and `uv run` working directory. Keep the existing `Upload migration log on failure` step.

Deleting the CI role bootstrap is deliberate, not a regression: `ensure_roles` owns role provisioning for both callers, and the old `NOLOGIN` bootstrap is incompatible with the RLS proof tests.

- [ ] **Step 4: Verify the workflow parses and no orphan references remain**

Run: `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/migration-chain.yml'))"`
Expected: parses with no error.

Run: `Select-String -Path .github/workflows/migration-chain.yml -Pattern "alembic (upgrade|downgrade)|Create the Supabase-compatible"`
Expected: no matches — no migration logic remains in the workflow outside the script.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/migration-chain.yml apps/api/tests/test_ranking_weights_rls.py
git commit -m "ci: delegate migration verification to the single canonical script"
```

---

### Task 5: First real run, defect triage, and evidence

**Files:**
- Modify as defects require: `apps/api/alembic/versions/*.py`
- Modify: `docs/verification/memory-audit.md`
- Modify: `AGENTS.md`
- Modify: `.superpowers/sdd/2026-10-07-memory-weights-and-domain-packs/progress.md`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: a recorded green run, or recorded fixed defects — either way, a written evidence entry.

**Triage policy (from the spec):**

| Finding | Action |
| --- | --- |
| Defect in `0067`, `0068`, or an earlier migration | Fix it here, re-run until exit 0. |
| Fix requires a **new** migration (`0069`+) | **Stop.** Return to the partner for a fresh design gate; do not absorb an architectural change silently. |
| A test fails because a migration is broken | Fix the migration. Never the test. |
| `test_TE05_provider_fallback`, `test_TE25_full_combined`, `test_public_profile`, `test_get_avatar_public` | Pre-existing, out of scope, document and move on. |

- [ ] **Step 1: Run the full verification and capture the exact output**

Run: `New-Item -ItemType Directory -Force evidence/verification | Out-Null; powershell -ExecutionPolicy Bypass -File scripts/run_pg_verification.ps1 2>&1 | Tee-Object evidence/verification/pg-verification.log`
Expected: exit 0. `Tee-Object` writes the log whether the script passes or fails. Record the real output either way.

- [ ] **Step 2: Confirm all 10 previously-skipped tests actually executed**

Run: `Select-String -Path evidence/verification/pg-verification.log -Pattern "skipped"`
Expected: zero matches across the pytest summary for `test_rls_live_pg.py` and `test_ranking_weights_rls.py`. A skip here is a failed proof — the script enforces this in step 3, but read the summary to confirm.

- [ ] **Step 3: Triage any defect found, per the policy above**

For each failure: identify whether it is a migration defect or a harness defect. Fix migrations. If the fix needs a new migration, stop and report instead of proceeding.

- [ ] **Step 4: Re-run until exit 0**

Run: `powershell -ExecutionPolicy Bypass -File scripts/run_pg_verification.ps1`
Expected: exit 0.

- [ ] **Step 5: Run the regression suites that touched migrations**

Run: `cd apps/api && .venv\Scripts\python.exe -m pytest tests/test_memory_type_packs.py tests/test_ranking_weights.py tests/test_migration_0057_pg.py -q -o addopts=""`
Expected: PASS.

- [ ] **Step 6: Record the evidence honestly**

In `docs/verification/memory-audit.md`, replace the "unverified against PostgreSQL" status for migrations 0067/0068 with the actual outcome, including the exact counts of tests executed and any defect found and fixed. State plainly that this proves correctness on seeded data and **does not** prove rollback under concurrent load or against a large production-shaped `memories` table.

Update `AGENTS.md`'s memory section with the new command and the result. Append a dated entry to `.superpowers/sdd/2026-10-07-memory-weights-and-domain-packs/progress.md` recording what ran, what passed, and what remains unproven.

Do not mark anything verified that did not run. If a step could not be completed, say which and why.

- [ ] **Step 7: Commit**

```bash
git add docs/verification/memory-audit.md AGENTS.md .superpowers/sdd/2026-10-07-memory-weights-and-domain-packs/progress.md evidence/verification/pg-verification.log apps/api/alembic/versions
git commit -m "verify: run migrations against live PostgreSQL and record evidence"
```

Omit the `alembic/versions` path if no migration was modified.
