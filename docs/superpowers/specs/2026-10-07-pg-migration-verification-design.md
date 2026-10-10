# PostgreSQL Migration Verification — Design

**Date:** 2026-10-07
**Status:** Design approved in conversation; awaiting written-spec review
**Scope:** Spec 1 of 2. Proves the memory-layer migrations apply, isolate, and roll back against a real PostgreSQL. Spec 2 (closing the registry bypasses and the feedback `workspace_id` gap) is deliberately **not** in this spec.

## Problem

Deploy 1 (`ranking_weight_profiles`, migration 0067) and Deploy 2 (`memory_type_packs`, migration 0068) shipped across 23 commits with unit-level confidence and **zero** database-level verification. Neither migration has ever been applied by a real PostgreSQL server.

Concretely, the following are asserted by tests that never executed the code they describe:

- **10 live-PostgreSQL tests are skipped** — 5 in `tests/test_ranking_weights_rls.py` (cross-workspace invisibility, same-workspace/different-user invisibility, `WITH CHECK` rejection, caller-own-profile insert, FORCE-RLS owner bypass) and 5 in `tests/test_migration_chain_pg.py`.
- **The rollback rehearsal is green by emptiness.** `migration-chain.yml` runs `alembic downgrade -1` against an **empty** `memories` table. The one irreversible operation in the memory work — re-adding `ck_memories_type_valid`, which re-validates every existing row — finds zero rows to object to and therefore cannot fail. The branch's only destructive step is verified exclusively where it is guaranteed to succeed.
- **A shipped migration contained invalid SQL and all its tests passed.** This was caught only by rendering DDL offline. It proves the existing suite cannot detect SQL-level defects.

The failure mode this spec exists to prevent: a feature that **degrades gracefully into looking healthy** rather than failing loudly. Deploy 1 is the live example — the whole learned-weights path was inert because nothing ever inserted the first profile row, and nothing objected.

## Goal

A single command proves, against a real PostgreSQL 16 with pgvector, that:

1. The full 68-migration chain applies from empty to head.
2. All 10 live-PostgreSQL tests execute and pass.
3. `0068`'s downgrade **fails loudly and names the offending value** when a memory holds a type outside the frozen 24, then succeeds once that row is removed.
4. The upgrade/downgrade/upgrade round trip returns to head with all RLS invariants intact.

## Non-goals

- **Not** a performance or concurrency proof. See "Explicitly unproven".
- **Not** a staging or production deployment rehearsal.
- **Not** a fix for the known registry bypasses (`import_memories`, `memory_records`, `recommendation_feedback.workspace_id`). Those are Spec 2, sequenced after this proves the foundation holds.
- **Not** wired into pre-commit or the default test run.

## Environment facts

Established by inspection on 2026-10-07, not assumed:

| Fact | Value | Consequence |
| --- | --- | --- |
| Host port 5432 | Occupied by native Windows PostgreSQL 18 (`postgresql-x64-18`, running) | Disposable container **must** use **5433** |
| `pgvector/pgvector:pg16` | Cached locally, 621MB | No image pull required |
| Docker Desktop | 29.6.2, linux backend, available | Container lifecycle is scriptable |
| `test_rls_live_pg.py` | Rejects any database whose name does not end `*_proof` or `*_test` | The script must **create** a correctly-named database, not accept an arbitrary URL |
| Stale containers | `vaeloom-pgtest` (0066) and `vaeloom-pg-proof` (0063/0054) removed after inspection; contained no irreproducible data | No port or name collisions remain |

pg16 is specified deliberately, **not** pg18: matching CI matters more than being current, because a version mismatch means local proof and CI proof are proofs of different systems.

## Architecture

**One script, two callers.** The verification logic exists exactly once, in `scripts/verify_pg_migrations.py`. CI does not re-implement it; CI invokes it against a service container it already provides.

```
  CI (migration-chain.yml)                Local developer
  service container pgvector:pg16        run_pg_verification.ps1
         │                                        │
         │  VAELOOM_TEST_PG_URL                   │ start container :5433
         │                                        │ run script
         ▼                                        │ teardown container + volume
   verify_pg_migrations.py  ◄──────────────────────┘
```

The script takes a database URL and assumes the server is already up. Container lifecycle is the wrapper's job. This separation is what lets CI reuse its existing service container without the script needing to know about Docker.

**Why one definition rather than a shared list file:** a shared file still has two consumers that can drift in how they invoke it. A script with one implementation and two callers cannot.

### Files

| File | Responsibility |
| --- | --- |
| `scripts/verify_pg_migrations.py` | The eight verification steps. Owns every assertion about migration behaviour. No Docker. |
| `scripts/run_pg_verification.ps1` | Local convenience: refuse-if-busy, start container, run the script, tear down container **and volume**. |
| `.github/workflows/migration-chain.yml` | Replaced steps 100–266 with an invocation of the script, keeping the existing service container and role bootstrap. |

`run_pg_verification.ps1` tears down the volume as well as the container. A verification database that survives a run is a trap: the next run inherits the previous schema and silently proves nothing.

## Verification steps

Executed in order by `verify_pg_migrations.py`. Any non-zero exit aborts and reports which step failed.

1. **`alembic upgrade head`** from an empty database.
2. **Run the live-PostgreSQL suite**: `tests/test_migration_chain_pg.py`, `tests/test_migration_0057_pg.py`, `tests/test_rls_live_pg.py`, `tests/test_ranking_weights_rls.py`. The first two are already in CI; the latter two are not and must be added.
3. **Seed the poison row.** Create a workspace, then a temporary pack whose vocabulary is a type *outside* the frozen 24:
   ```sql
   INSERT INTO memory_type_packs (slug, version, label, types, is_active)
   VALUES ('rollback_probe', 1, 'Rollback probe', '["job_posting"]', true);
   ```
   then one `memories` row of `type='job_posting'` in that workspace.
4. **Require `alembic downgrade -1` to fail.** Non-zero exit is mandatory.
5. **Assert the failure is the *right* failure.** A typo could make any statement fail and produce a red run that looks like a pass. Require all three:
   - exit code non-zero
   - stderr mentions `ck_memories_type_valid`
   - the pre-drop evidence log emitted by `0068.upgrade()` contains the offending value `job_posting`

   `upgrade()` already logs the distinct type list before dropping the constraint, written for a human reading a rollback failure. This spec makes that log an assertion target.

   **Log verbosity is part of the assertion.** `0068` restores that `logger.info` deliberately — a comment at `0068:104` records that a wider logger would swallow the evidence at default verbosity. The script must therefore run the step-3 seeding at a verbosity where `0068 pre-drop evidence: ... distinct types=[...]` is emitted, and must **fail if that line is absent** rather than treating an empty match as a pass. A silently-empty log is the exact "green by emptiness" failure this spec exists to eliminate, one level up.
6. **Remove the probe row; require `downgrade -1` to succeed.**
7. **`alembic upgrade head`** back to head.
8. **Re-run the invariant suite** to confirm the round trip left no damage.

### Why step 4 expects failure

A destructive migration that silently accepts incompatible data is worse than one that refuses. Proving the refusal is the deliverable; step 6 proves the system recovers into a known-good state afterwards. Without step 6 the claim is half a demonstration.

### Explicitly not proven

Step 3 proves the constraint fires on data written under a second pack. It does **not** prove behaviour for concurrent writes during a real rollback window, and does **not** prove rollback against a large production-shaped `memories` table. Seeded-data correctness only. This boundary is recorded here so it is not later mistaken for volume assurance.

## Failure policy

Verification will probably find something, because 68 migrations have never run end to end with 0067/0068 on top.

| Finding | Action |
| --- | --- |
| Defect in `0067`/`0068` or an earlier migration | **Fix it in this spec.** Same branch, same review gates. A migration that does not apply is a blocker, not a follow-up. |
| Fix requires a **new** migration | **Stop.** That is an architectural change discovered mid-flight; it returns to the partner as a fresh design gate rather than being absorbed silently. |
| A known pre-existing failure (`temporal` ×2, `profile_api` ×2) | Not a blocker. Documented, not fixed here. |
| A test fails because a migration is broken | **Fix the migration. Never adjust the test.** These tests describe intended behaviour; the migration is what is unproven. |

## Testing the harness

A verification harness that only ever returns green proves nothing. Three levels:

1. **Unit, no database** — argument parsing, port-conflict refusal, and step sequencing against a fake `alembic` on `PATH`. Catches "forgot to call upgrade" without a container. Fails loudly if a subprocess call is skipped.
2. **Integration, real container** — `run_pg_verification.ps1` starts pgvector:pg16, runs the script, asserts exit 0, asserts teardown removed both container and volume.
3. **Negative control** — deliberately break an input (corrupt the seed payload, or pre-insert an out-of-vocabulary row before `upgrade head`) and assert the script exits **non-zero**. This is the property that makes its green result meaningful.

## Port and lifecycle rules

- Default port **5433**, overridable by `VAELOOM_PG_VERIFY_PORT`. Never defaults to 5432.
- The wrapper **refuses to start** if the port is already bound rather than fighting the Windows PostgreSQL 18 service or another container.
- Container name is fixed (`vaeloom-pg-verify`) so a stale instance from a crashed run is detected and reported, not silently reused.

## Exit condition

Spec 1 is complete when all hold:

- `run_pg_verification.ps1` exits 0 on a clean machine with Docker running.
- All 10 live-PostgreSQL tests execute (5 previously skipped) and pass.
- Step 4 fails by design; step 5 asserts `ck_memories_type_valid` and `job_posting` are named; step 6 succeeds.
- The round trip returns to head with RLS invariants intact.
- CI's `migration-chain.yml` invokes the same script and is green.
- The three harness test levels pass.

## Consequences for later work

Proving 0068's rollback fails loudly on out-of-vocabulary data has a direct implication for **Spec 2**: adding a second pack to production would make any future `downgrade` of 0068 fail while memories hold types that pack introduced. That is correct behaviour, but it means the operational rollback story must be written *before* a second domain ships, not after. Spec 2 should address it.

## Risks

| Risk | Mitigation |
| --- | --- |
| Discovering a migration defect late, after much CI churn | Local runner exists specifically so the loop is seconds, not a PR round trip |
| Step 5 asserts on log text that later refactors change | Assertion targets the constraint name (stable schema object) and the value; both are contract, not formatting |
| Harness becomes a test nobody runs | It runs in CI on every push; a skipped CI step is visible in the PR |
| The `*_proof` / `*_test` naming rule is enforced only at test time | The script creates the database with a conforming name rather than accepting an arbitrary URL, so the rule is satisfied by construction |
