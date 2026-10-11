#!/usr/bin/env python3
"""Prove the migration chain applies, isolates and rolls back on a real PostgreSQL.

Two callers, one definition: CI (`migration-chain.yml`) runs this against the
service container it already provides, and `scripts/run_pg_verification.ps1`
runs it against a disposable container on port 5433. The script knows nothing
about Docker -- container lifecycle is the wrapper's job.

This script PROVISIONS ROLES and runs DESTRUCTIVE migrations (downgrade, with a
poison row the chain must refuse to drop). The database URL arrives from a
copy-pasteable environment variable, so the refusal below is the safety property
that matters most: a developer who points it at a real database must be turned
away before any subprocess runs, not after the first migration.

Exit codes:
    0  every step passed
    1  a verification step failed
    2  refused before running anything (unsafe target, missing URL, bad alembic CWD)
"""

from __future__ import annotations

import argparse
import dataclasses
import os
import pathlib
import subprocess
import sys
import uuid
from collections.abc import Callable, Mapping, Sequence
from urllib.parse import urlparse

# scripts/verify_pg_migrations.py -> repo root
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

PG_URL_ENV_VAR = "VAELOOM_TEST_PG_URL"

# The same variable alembic's env.py consults first (OP-RLS-01): the deliberate
# override for the owner/migrator role. Honouring it here keeps this script and
# the migrations pointed at the same database instead of at two.
TARGET_URL_ENV_VAR = "VAELOOM_TARGET_URL"

ALLOWED_DB_SUFFIXES = ("_proof", "_test")

# Must match the roles the migration chain itself grants to (0005_rls_expanded.py,
# 0047 service policies). Task 2 owns creating them; they are declared here so the
# guardrails and the preflight cannot drift apart.
APP_ROLE = "vaeloom_app"
APP_PASSWORD = "vaeloom_app_proof_pw"
NONLOGIN_ROLES = ("service_role", "authenticated")

# The live-PostgreSQL suites the chain is judged by, relative to apps/api. Walked
# twice: once against a freshly upgraded database and once after the round trip,
# so a rollback that silently damaged the end state is caught by the re-run rather
# than by a reader comparing two logs by eye.
LIVE_PG_SUITES = (
    "tests/test_migration_chain_pg.py",
    "tests/test_migration_0057_pg.py",
    "tests/test_rls_live_pg.py",
    "tests/test_ranking_weights_rls.py",
)

# pytest's exit code for "collected no tests". Not an error in general, but here
# it means the four suites above did not run at all, which is indistinguishable
# from passing as far as an exit-code check is concerned.
PYTEST_NO_TESTS_COLLECTED = 5

# The ordered proof: the eight numbered checks, preceded by the role preflight
# they all depend on. `main` resolves each name against this module's globals, so
# a name that does not resolve fails the run rather than being skipped.
VERIFICATION_STEPS = (
    "step_0_ensure_roles",
    "step_1_upgrade_head",
    "step_2_run_live_pg_suite",
    "step_3_seed_rollback_probe",
    "step_4_downgrade_must_fail",
    "step_5_assert_downgrade_failure_shape",
    "step_6_remove_probe_and_downgrade",
    "step_7_upgrade_head_again",
    "step_8_reassert_invariants",
)


class UnsafeTargetError(RuntimeError):
    """Refused: the target is not a disposable verification database."""


def guard_target_database(db_name: str) -> None:
    """Refuse any database that is not obviously disposable.

    ``vaeloom_prod`` passes every other check in this script and is the one case
    that cannot be undone, so the rule is a naming convention a human can eyeball
    rather than a heuristic: the name must end ``_proof`` or ``_test``, matching
    the guard ``tests/test_rls_live_pg.py`` already applies.
    """
    if not db_name:
        raise UnsafeTargetError(
            "refusing to run: no database name could be read from the target URL. "
            f"The name must end with {ALLOWED_DB_SUFFIXES[0]} or "
            f"{ALLOWED_DB_SUFFIXES[1]}."
        )
    if not db_name.endswith(ALLOWED_DB_SUFFIXES):
        raise UnsafeTargetError(
            f"refusing to run against database '{db_name}': this script provisions "
            "PostgreSQL roles and runs destructive migrations, so it only runs "
            f"against a database whose name ends with {ALLOWED_DB_SUFFIXES[0]} or "
            f"{ALLOWED_DB_SUFFIXES[1]}. Point --pg-url (or the "
            f"{PG_URL_ENV_VAR} environment variable) at a disposable database such "
            "as vaeloom_rls_proof, or run scripts/run_pg_verification.ps1 to get a "
            "throwaway one."
        )


def database_name_from_url(url: str) -> str:
    """Extract the database name, ignoring the query string and a trailing slash.

    ``postgresql://u:p@host:5433/vaeloom_test/?ssl=require`` -> ``vaeloom_test``.
    A trailing slash is the difference between a rejected and an accepted target,
    so it is normalized here rather than trusted to the caller.
    """
    return urlparse(url).path.rstrip("/").rsplit("/", 1)[-1]


def resolve_alembic_cwd(repo_root: pathlib.Path) -> pathlib.Path:
    """Return the only directory alembic can be invoked from.

    The migrations import each other relative to ``apps/api``; run from anywhere
    else alembic fails part-way and leaves a half-migrated database behind.
    """
    alembic_cwd = repo_root / "apps" / "api"
    if not (alembic_cwd / "alembic.ini").is_file():
        raise RuntimeError(
            f"alembic must be invoked from {alembic_cwd.as_posix()} so alembic.ini and "
            "the version scripts resolve, but no alembic.ini is there. Pass "
            "--repo-root if the repository is not at the expected location."
        )
    return alembic_cwd


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    """Parse arguments.

    ``--pg-url`` defaults to ``VAELOOM_TEST_PG_URL`` rather than being required:
    CI invokes this script with no arguments at all, and a required flag would
    make argparse exit 2 before any guard ran.
    """
    parser = argparse.ArgumentParser(
        prog="verify_pg_migrations",
        description=(
            "Apply, isolate and roll back the migration chain against a real "
            "PostgreSQL. Refuses any database whose name does not end _proof/_test."
        ),
    )
    parser.add_argument(
        "--pg-url",
        default=os.environ.get(PG_URL_ENV_VAR),
        help=(
            f"target PostgreSQL URL (default: ${PG_URL_ENV_VAR}). "
            "The database name must end with _proof or _test."
        ),
    )
    parser.add_argument(
        "--repo-root",
        type=pathlib.Path,
        default=REPO_ROOT,
        help="repository root; alembic is run from <repo-root>/apps/api (default: %(default)s)",
    )
    parser.add_argument(
        "--alembic",
        default="alembic",
        help="alembic executable to invoke (default: %(default)s)",
    )
    return parser.parse_args(argv)


def _resolve_step(step_name: str) -> Callable[[], None]:
    """Look a step up by name so the tuple and the functions cannot drift apart."""
    step = globals().get(step_name)
    if not callable(step):
        raise RuntimeError(
            f"VERIFICATION_STEPS declares '{step_name}' but this module defines no "
            "callable of that name; the sequencer would skip a verification step "
            "instead of failing."
        )
    return step


# --------------------------------------------------------------------------
# The rollback probe
# --------------------------------------------------------------------------

PROBE_PACK_SLUG = "rollback_probe"
PROBE_MEMORY_TYPE = "job_posting"
RESTORED_CHECK_NAME = "ck_memories_type_valid"

# Namespace for deriving the probe's row identifiers. Fixed rather than uuid4 so
# the seed and the teardown compute the same values from the same inputs; see
# _ProbeIds for why that has to be true rather than merely convenient.
PROBE_ID_NAMESPACE = uuid.UUID("2f7b0d5e-9c41-5a6f-8d13-6e0a4c7b9d52")


def rollback_probe_literals() -> tuple[str, str, str]:
    """``(pack slug, memory type, constraint name)`` for the rollback probe.

    One definition, read by the seed, by the teardown, by the refusal assertion
    and by the tests. The constraint name in particular is asserted twice -- once
    here and once in `.github/workflows/migration-chain.yml`, which greps the
    restored CHECK after its own downgrade -- so a rename that changed only one
    side would pass CI while breaking the other.
    """
    return (PROBE_PACK_SLUG, PROBE_MEMORY_TYPE, RESTORED_CHECK_NAME)


def assert_downgrade_failed_as_expected(returncode: int, output: str) -> None:
    """Require the refusal to be the constraint's, and raise otherwise.

    0068's ``downgrade`` re-adds ``ck_memories_type_valid``, and PostgreSQL
    validates a CHECK against every existing row, so the probe memory must make
    that statement fail. "Must fail" is the weak form of the claim and it is not
    the one worth making: a downgrade that died on a typo, a missing role or an
    unrelated permission error is equally non-zero, and accepting that would
    report a proof that never ran. So all three conditions are required -- a
    non-zero exit, the constraint's name, and the offending value.

    The value is the part that cannot be faked by accident. 0068's downgrade
    logs it in the pre-restore evidence of distinct types (or PostgreSQL prints
    it in the DETAIL line for single-row insertions), so a message that omits it
    did not come from this constraint refusing this row.

    An empty ``output`` raises for both missing tokens rather than passing: this
    is the green-by-emptiness failure the whole exercise exists to eliminate, and
    a substring test against ``""`` must never be read as confirmation.
    """
    _, probe_type, check_name = rollback_probe_literals()

    problems: list[str] = []
    if returncode == 0:
        problems.append(
            "`alembic downgrade -1` exited 0 with the probe row still in `memories`, so "
            "the restored CHECK accepted a type it does not list. The safety boundary "
            "this step exists to prove is not there."
        )
    if check_name not in output:
        problems.append(
            f"the output never names the constraint '{check_name}', so the downgrade did "
            "not fail on the restored memory-type CHECK. Failing for any other reason "
            "(a typo, a missing role, a permission error) is not the proof."
        )
    if probe_type not in output:
        problems.append(
            f"the output never names the offending value '{probe_type}', so it does not "
            "show that the refusal was caused by the probe row. An empty or truncated "
            f"output names neither token, which is a failure and not a pass."
        )

    if problems:
        raise RuntimeError(
            "`alembic downgrade -1` did not refuse the way the rollback probe requires:"
            + "".join(f"\n  - {problem}" for problem in problems)
            + f"\n\nRaw output ({len(output)} chars):\n{output}"
        )


# --------------------------------------------------------------------------
# Talking to the target database
# --------------------------------------------------------------------------


def _sql_literal(value: str) -> str:
    """Quote a Python string as a SQL string literal."""
    return "'" + value.replace("'", "''") + "'"


def _quote_identifier(name: str) -> str:
    """Double-quote a SQL identifier, refusing anything that would need escaping.

    The database name reaches ``GRANT CONNECT ON DATABASE "..."`` by
    interpolation. The guard above it already requires a ``_proof``/``_test``
    suffix, which constrains the tail but not the head -- so the whole identifier
    is checked here rather than trusted.
    """
    if not name or not (name[0].isalpha() or name[0] == "_"):
        raise UnsafeTargetError(
            f"refusing to run: the target database name {name!r} is not a usable "
            "PostgreSQL identifier."
        )
    if not all(character.isalnum() or character == "_" for character in name):
        raise UnsafeTargetError(
            f"refusing to run: the target database name {name!r} contains characters "
            "that are not valid in a PostgreSQL identifier."
        )
    return f'"{name}"'


def _effective_target_url(pg_url: str) -> str:
    """The database this run will actually touch, guarded.

    ``VAELOOM_TARGET_URL`` wins, because that is the owner/migrator role the
    migrations run as and pointing this script somewhere other than where alembic
    migrates would prove nothing. Which means it also needs the guard the flag
    already got: honouring an environment override that points at a production
    database would route straight around the refusal this script exists to make.
    """
    target = (os.environ.get(TARGET_URL_ENV_VAR) or "").strip() or pg_url
    guard_target_database(database_name_from_url(target))
    return target


def _async_url(url: str) -> str:
    """Pin the asyncpg driver, whichever form the caller supplied."""
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


def _execute(target_url: str, statements: Sequence[tuple[str, Mapping[str, object]]]) -> list[int]:
    """Run ``statements`` in one transaction; return their row counts.

    One transaction on purpose: role creation, the probe seed and the probe
    teardown each have to be all-or-nothing, because a half-applied version
    leaves either a role that cannot log in or a probe row with no pack, and
    both read as a passing run to whatever runs next.

    SQLAlchemy is imported here rather than at module scope so the guards -- the
    part that has to hold before anything reaches a database, and the part the
    safety tests exercise -- stay importable with nothing but the stdlib.
    """
    import asyncio

    import sqlalchemy as sa
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    async def run() -> list[int]:
        engine = create_async_engine(_async_url(target_url), poolclass=NullPool)
        try:
            async with engine.begin() as connection:
                row_counts: list[int] = []
                for statement, parameters in statements:
                    result = await connection.execute(sa.text(statement), parameters)
                    row_counts.append(result.rowcount)
                return row_counts
        finally:
            await engine.dispose()

    return asyncio.run(run())


def _role_bootstrap_sql(role: str, *, login: bool) -> str:
    """Create ``role``, or correct it if it already exists.

    Modelled on the ``IF NOT EXISTS (SELECT FROM pg_roles ...)`` block in
    ``tests/test_rls_live_pg.py:79-90``, with the ``ELSE`` branch that block
    lacks and cannot afford. CI creates all three roles as ``NOLOGIN``; with a
    plain skip-if-exists guard, a pre-existing ``vaeloom_app`` would stay
    ``NOLOGIN``, that test file's own guard would decline to create it, and the
    role could never log in -- which is exactly why
    ``test_pg_live_password_login_succeeds_as_vaeloom_app`` was never added to
    CI. The ``ELSE`` is the whole point, so it is not conditional on the role
    being absent.
    """
    if login:
        credentials = f"LOGIN PASSWORD {_sql_literal(APP_PASSWORD)}"
    else:
        credentials = "NOLOGIN"
    return (
        "DO $$\n"
        "BEGIN\n"
        f"    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = {_sql_literal(role)}) THEN\n"
        f"        CREATE ROLE {role} {credentials};\n"
        "    ELSE\n"
        f"        ALTER ROLE {role} {credentials};\n"
        "    END IF;\n"
        "END $$;\n"
    )


def ensure_roles(pg_url: str) -> None:
    """Create -- or repair -- the roles the migration chain grants to.

    Idempotent, because a verification run against a database that has already
    been used once has to reach the same state as a fresh one, and because
    ``ensure_roles`` and the CI role step can run in either order.

    ``service_role`` and ``authenticated`` are created ``NOLOGIN``: they exist
    only so ``GRANT ... TO service_role, authenticated`` and ``CREATE POLICY ...
    TO service_role`` resolve, and on Supabase they are not login roles either.
    ``vaeloom_app`` is the exception -- it is the role the live RLS suite logs in
    as, so it is forced to ``LOGIN`` with a known password whether or not it
    already existed.
    """
    target = _effective_target_url(pg_url)
    database = _quote_identifier(database_name_from_url(target))

    statements: list[tuple[str, Mapping[str, object]]] = [
        (_role_bootstrap_sql(role, login=False), {}) for role in NONLOGIN_ROLES
    ]
    statements.append((_role_bootstrap_sql(APP_ROLE, login=True), {}))
    statements.append(
        (f"GRANT CONNECT ON DATABASE {database} TO {APP_ROLE}", {})
    )
    statements.append((f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}", {}))

    _execute(target, statements)


@dataclasses.dataclass(frozen=True)
class _ProbeIds:
    """The row identifiers this run's probe owns, derivable by either half of it.

    The teardown cannot discover these by querying: ``memories`` carries only the
    workspace-scoped ``p_memories_workspace`` policy
    (``0014_memories_rls_workspace_only.py:35-38``), so a lookup for the probe row
    is filtered by exactly the GUC the teardown is trying to learn. Reading them
    out of the database is therefore circular -- the only non-circular way for the
    teardown to learn the probe's scope is to compute it the same way the seed did.

    So they are derived from the target database name rather than drawn at random:
    two ``uuid5`` calls over a fixed namespace, which the seed and the teardown
    each perform independently. A random id the teardown cannot reproduce would
    leave it deleting zero rows under any non-superuser connecting role and
    raising a message blaming the seed for a fault that is entirely its own.
    """

    user_id: uuid.UUID
    workspace_id: uuid.UUID
    memory_id: uuid.UUID

    @classmethod
    def for_target(cls, target_url: str) -> _ProbeIds:
        database = database_name_from_url(target_url)
        return cls(
            user_id=uuid.uuid5(PROBE_ID_NAMESPACE, f"probe:user:{database}"),
            workspace_id=uuid.uuid5(PROBE_ID_NAMESPACE, f"probe:workspace:{database}"),
            memory_id=uuid.uuid5(PROBE_ID_NAMESPACE, f"probe:memory:{database}"),
        )


def _scope_guc_statements(probe_ids: _ProbeIds) -> list[tuple[str, Mapping[str, object]]]:
    """The RLS scope the seed writes under and the teardown deletes under.

    One definition, used by both. They must agree on it: the seed needs the GUCs
    to insert the probe at all, and the teardown needs the *same* values to delete
    it -- ``memories`` is workspace-scoped, so a teardown that set no GUC, or a
    different one, would match zero rows under any non-superuser connecting role
    and report that the probe was never planted.

    ``is_local`` is true on both sides: ``_execute`` runs everything in a single
    transaction, and the AGENTS.md invariant is that these GUCs must be set inside
    the session that reads under them.
    """
    return [
        (
            "SELECT set_config('app.user_id', :user_id, true)",
            {"user_id": str(probe_ids.user_id)},
        ),
        (
            "SELECT set_config('app.workspace_id', :workspace_id, true)",
            {"workspace_id": str(probe_ids.workspace_id)},
        ),
    ]


def seed_rollback_probe(pg_url: str) -> None:
    """Plant a memory whose type only a second, temporary domain pack allows.

    0068 replaced the frozen ``ck_memories_type_valid`` with the
    ``memory_type_packs`` registry, and its ``downgrade`` puts the CHECK back --
    which PostgreSQL validates against every row that already exists. CI
    rehearses that downgrade against an empty ``memories`` table, where there is
    nothing to object to and the step cannot fail.

    So: a second pack declaring exactly one type the CHECK does not list, and one
    memory written under it. ``job_posting`` is legal under the registry and
    illegal under 0027, which is the entire disagreement the rollback has to
    surface. The workspace exists so the row is a realistic tenant-scoped memory
    rather than an orphan, and the row carries ``type_pack_slug`` so it remains
    attributable after the pack that legalised it is deleted.

    Re-runnable: the probe's identifiers are derived from the target database name
    rather than drawn at random, and every row the seed writes is upserted, so a
    second run against an already-used database lands on the same ids instead of
    colliding with the previous run's leftovers. The pack is written with
    ``ON CONFLICT DO UPDATE`` rather than ``DO NOTHING`` so the vocabulary on disk
    always matches the vocabulary the refusal assertion expects.
    """
    slug, probe_type, _ = rollback_probe_literals()
    target = _effective_target_url(pg_url)
    probe_ids = _ProbeIds.for_target(target)

    user_id = probe_ids.user_id
    workspace_id = probe_ids.workspace_id
    memory_id = probe_ids.memory_id
    email = f"verify-pg-migrations-{user_id}@verification.invalid"

    statements: list[tuple[str, Mapping[str, object]]] = [
        # The proof tables are FORCE-RLS. A superuser ignores the policies, but a
        # non-superuser owner does not, and seeding would then fail on the very
        # isolation this script is verifying. The teardown sets the same scope,
        # because it faces the same policies.
        *_scope_guc_statements(probe_ids),
        ("DELETE FROM memories WHERE type = :probe_type", {"probe_type": probe_type}),
        (
            "INSERT INTO users (id, email, display_name, auth_provider, status, preferences)\n"
            "VALUES (:user_id, :email, :display_name, 'email', 'ACTIVE', '{}'::jsonb)\n"
            "ON CONFLICT (id) DO UPDATE\n"
            "    SET email = EXCLUDED.email,\n"
            "        display_name = EXCLUDED.display_name",
            {
                "user_id": user_id,
                "email": email,
                "display_name": "PG verification probe",
            },
        ),
        (
            "INSERT INTO workspaces (id, user_id, name)\n"
            "VALUES (:workspace_id, :user_id, :name)\n"
            "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
            {
                "workspace_id": workspace_id,
                "user_id": user_id,
                "name": "PG verification probe workspace",
            },
        ),
        (
            "INSERT INTO memory_type_packs (slug, version, label, types, is_active)\n"
            "VALUES (:slug, 1, :label, CAST(:types AS jsonb), true)\n"
            "ON CONFLICT (slug) DO UPDATE\n"
            "    SET version = EXCLUDED.version,\n"
            "        label = EXCLUDED.label,\n"
            "        types = EXCLUDED.types,\n"
            "        is_active = EXCLUDED.is_active",
            {
                "slug": slug,
                "label": "Rollback probe",
                "types": f'["{probe_type}"]',
            },
        ),
        (
            "INSERT INTO memories (\n"
            "    id, type, status, title, content_hash, size, metadata, tags,\n"
            "    user_id, workspace_id, type_pack_slug, type_pack_version\n"
            ")\n"
            "VALUES (\n"
            "    :memory_id, :probe_type, 'active', :title, :content_hash, 0,\n"
            "    '{}'::jsonb, '{}'::varchar(255)[], :user_id, :workspace_id, :slug, 1\n"
            ")",
            {
                "memory_id": memory_id,
                "probe_type": probe_type,
                "title": "PG verification rollback probe",
                "content_hash": f"verify-pg-migrations-{memory_id}",
                "user_id": user_id,
                "workspace_id": workspace_id,
                "slug": slug,
            },
        ),
    ]

    _execute(target, statements)


def _remove_rollback_probe(pg_url: str) -> None:
    """Undo :func:`seed_rollback_probe`, pack first, and insist something went.

    Order matters: the pack is deleted before the row it legalises, so no active
    vocabulary ever references ``job_posting`` while it is still in ``memories``.
    Deleting the row first would leave a registry that claims the type is legal
    with nothing behind it.

    Both deletes are checked. A teardown that removed zero rows means the probe
    was never planted, and the ``downgrade -1`` that follows would then succeed
    for the wrong reason -- the same green-by-absence this script exists to
    eliminate, one step later in the sequence.

    It deletes under the same RLS scope the seed wrote under, for the same reason:
    ``memories`` is workspace-scoped, so without those GUCs this would match zero
    rows under any non-superuser connecting role and then raise the "the probe was
    never seeded" complaint, blaming the seed for a fault that is its own.
    """
    slug, probe_type, _ = rollback_probe_literals()
    target = _effective_target_url(pg_url)

    row_counts = _execute(
        target,
        [
            *_scope_guc_statements(_ProbeIds.for_target(target)),
            ("DELETE FROM memory_type_packs WHERE slug = :slug", {"slug": slug}),
            ("DELETE FROM memories WHERE type = :probe_type", {"probe_type": probe_type}),
        ],
    )
    # _execute returns one row count per statement, so the two set_config
    # preludes occupy the leading slots. Taken from the end so the counts keep
    # their meaning if the prelude ever grows a statement.
    _, _, packs_deleted, rows_deleted = row_counts

    if packs_deleted != 1:
        raise RuntimeError(
            f"removing the probe deleted {packs_deleted} '{slug}' packs, expected exactly "
            "1. Either the probe was never seeded -- in which case the refusal that "
            "step 5 checked was not about it -- or a previous run left the table in a "
            "state this script does not understand. Refusing to roll back anyway."
        )
    if rows_deleted < 1:
        raise RuntimeError(
            f"removing the probe deleted {rows_deleted} '{probe_type}' memories, expected "
            "at least 1. The downgrade would succeed only because the row that made it "
            "fail was never there. Refusing to treat that as a pass."
        )


# --------------------------------------------------------------------------
# Verification steps
#
# Every step takes no arguments, because `main` walks `VERIFICATION_STEPS` and
# the sequencer is easier to trust when a step cannot be handed a different
# target than the one the guards approved. What a step needs is therefore
# recorded on `_CONTEXT` by `main`, once, for the whole run.
# --------------------------------------------------------------------------


@dataclasses.dataclass
class _RunContext:
    """Everything the steps need from the command line, resolved exactly once."""

    pg_url: str
    alembic_cwd: pathlib.Path
    alembic: str
    # Filled in by step 4 and read by step 5. Kept on the context rather than
    # returned, because the two are separate entries in the walked sequence.
    downgrade_returncode: int | None = None
    downgrade_output: str | None = None


_CONTEXT: _RunContext | None = None


def _context() -> _RunContext:
    """The run in progress, or an error naming the only legitimate caller."""
    if _CONTEXT is None:
        raise RuntimeError(
            "no verification run is in progress. The steps read the target URL and "
            "the alembic working directory from main(), which is what applied the "
            "guards; calling one directly means nothing established what it may act "
            "on."
        )
    return _CONTEXT


def _merged_output(completed: subprocess.CompletedProcess) -> str:
    """stdout and stderr together, because the refusal may arrive in either stream."""
    return f"{completed.stdout or ''}{completed.stderr or ''}"


def _alembic_environment(context: _RunContext) -> dict[str, str]:
    """The environment every alembic child must run with.

    This is not hygiene, it is the whole ballgame. ``apps/api/alembic/env.py``
    resolves its DDL target as ``VAELOOM_TARGET_URL`` -> ``DATABASE__URL`` ->
    ``DATABASE_URL`` -> ``alembic.ini``, and it loads the app settings on the way,
    which read ``apps/api/.env``. So an alembic child that merely *inherits* the
    ambient environment will connect to whatever that file names -- a developer's
    or a hosted project's real database -- while this script's guard sits here,
    unused, having checked a URL alembic never looked at.

    The first real run of this harness did exactly that: it migrated a remote
    Supabase project to head and reported success, because step 1 exited 0 and
    nothing compared the database alembic actually touched against the one this
    process approved.

    So: set the deliberate override, and actively remove the ambient names. An
    inherited variable that can point migrations at a shared instance is not a
    default, it is a hazard.
    """
    environment = dict(os.environ)
    target = _effective_target_url(context.pg_url)
    environment[TARGET_URL_ENV_VAR] = target
    environment[PG_URL_ENV_VAR] = target
    environment["VAELOOM_VERIFY_ACTIVE"] = "1"
    for ambient in ("DATABASE__URL", "DATABASE_URL", "DATABASE_MIGRATION__URL"):
        environment.pop(ambient, None)
    return environment


def _alembic_run(context: _RunContext, *arguments: str) -> subprocess.CompletedProcess:
    """Run alembic from ``apps/api`` with an explicit environment. Never raises.

    This is the ONLY place this module invokes alembic. Every caller goes through
    here, so there is exactly one place where the environment is set and exactly
    one place to get it wrong.

    That is not theoretical. This function and ``step_4`` each had their own
    ``subprocess.run``; the first fix stopped `upgrade head` from connecting to a
    remote Supabase project, and `downgrade -1` -- the one command in this module
    that *destroys* schema -- kept inheriting ``.env`` and did it anyway. Step 4
    cannot use the raising wrapper because a non-zero exit is its expected
    result, so the non-raising primitive has to be the shared one, not a
    convenience bolted onto the raising wrapper.
    """
    command = [context.alembic, *arguments]
    completed = subprocess.run(
        command,
        # check=False stated, not defaulted: every caller of this helper wants the
        # returncode inspected by itself rather than an exception from inside run().
        check=False,
        cwd=context.alembic_cwd,
        env=_alembic_environment(context),
        capture_output=True,
        text=True,
    )
    output = _merged_output(completed)
    if "ALEMBIC CONNECTING TO:" in output:
        for line in output.splitlines():
            if "ALEMBIC CONNECTING TO:" in line:
                connected_url = line.split("ALEMBIC CONNECTING TO:", 1)[1].strip()
                from urllib.parse import urlparse

                parsed = urlparse(connected_url)
                if (parsed.hostname or "").lower() not in ("127.0.0.1", "localhost", ""):
                    raise RuntimeError(
                        f"FATAL: Alembic connected to non-local host '{parsed.hostname}': {connected_url}. "
                        "Verification aborted!"
                    )
                db_name = parsed.path.rstrip("/").rsplit("/", 1)[-1]
                if not db_name.endswith(ALLOWED_DB_SUFFIXES):
                    raise RuntimeError(
                        f"FATAL: Alembic connected to unsafe database '{db_name}': {connected_url}. "
                        "Verification aborted!"
                    )
    return completed


def _alembic(context: _RunContext, *arguments: str) -> subprocess.CompletedProcess:
    """Run alembic and raise unless it exited zero. See :func:`_alembic_run`."""
    completed = _alembic_run(context, *arguments)
    if completed.returncode != 0:
        shown = " ".join((context.alembic, *arguments))
        raise RuntimeError(
            f"`{shown}` exited {completed.returncode}:\n{_merged_output(completed)}"
        )
    return completed


def _skipped_target_tests(output: str) -> list[str]:
    """The target-file tests pytest reported as SKIPPED, in the order printed.

    Scoped to the four files deliberately: a skip elsewhere in the suite is not
    this step's business, and an unscoped search would fail on skips that have
    always been there and say nothing about whether the live proof ran.
    """
    prefixes = tuple(f"{path}::" for path in LIVE_PG_SUITES)
    return [
        line.strip()
        for line in output.splitlines()
        if line.strip().startswith(prefixes) and " SKIPPED" in line
    ]


def _run_live_pg_suite(context: _RunContext, label: str) -> None:
    """Run the four live-PostgreSQL files, treating a skip as a failure.

    Every test in these files exists only to exercise a real server; they
    ``skipif`` on the absence of ``VAELOOM_TEST_PG_URL``. A skip is therefore
    not "nothing to check here" but "the check that was supposed to happen did
    not", and pytest exits 0 for a fully-skipped run -- so the exit code alone
    cannot be the verdict. ``5`` (no tests collected) is not a pass either.

    Invoked as ``sys.executable -m pytest`` rather than a bare ``pytest`` so the
    suites run on the same interpreter that is running this script, under both
    ``uv run`` in CI and a local virtualenv.

    The child is pointed at the **effective** target, not the ``--pg-url`` flag.
    Every other consumer of the target -- alembic (which inherits the ambient
    environment), ``ensure_roles``, the seed and the teardown -- resolves through
    ``_effective_target_url``, so when ``VAELOOM_TARGET_URL`` is exported they all
    act on that database. Handing pytest ``context.pg_url`` instead pointed the
    suites at a second, unrelated database: alembic would have migrated one,
    while these eight checks certified another. Re-running the guard here is not
    redundant either -- before this, an unguarded ``VAELOOM_TARGET_URL`` reached
    the child unchecked.
    """
    environment = dict(os.environ)
    target = _effective_target_url(context.pg_url)
    environment[TARGET_URL_ENV_VAR] = target
    # The four suites hand this straight to `create_async_engine`, which resolves
    # a bare `postgresql://` to the *sync* psycopg2 dialect. That driver is not a
    # dependency of this project, so exporting the flag verbatim fails all of
    # them with `No module named 'psycopg2'` -- fourteen errors that read like
    # broken tests and were really one wrong URL scheme.
    environment[PG_URL_ENV_VAR] = _async_url(target)

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            *LIVE_PG_SUITES,
            "-v",
            "-o",
            "addopts=",
        ],
        check=False,
        cwd=context.alembic_cwd,
        capture_output=True,
        text=True,
        env=environment,
    )
    output = _merged_output(completed)
    skipped = _skipped_target_tests(output)

    problems: list[str] = []
    if completed.returncode == PYTEST_NO_TESTS_COLLECTED:
        problems.append(
            f"pytest collected no tests from {' '.join(LIVE_PG_SUITES)}. On PostgreSQL "
            "that is never right: these files exist to run against a real server."
        )
    elif completed.returncode != 0:
        problems.append(f"pytest exited {completed.returncode}.")
    if skipped:
        problems.append(
            f"{len(skipped)} test(s) in the target files were SKIPPED. A skipped "
            "live-PostgreSQL test is a check that did not run, and is reported as a "
            "failure rather than a pass:\n    "
            + "\n    ".join(skipped)
        )

    if problems:
        raise RuntimeError(
            f"{label} did not pass:\n  - " + "\n  - ".join(problems) + f"\n\n{output}"
        )


def step_0_ensure_roles() -> None:
    """Provision the roles the chain grants to, before it grants to them.

    First for a mechanical reason, not a stylistic one: ``0005_rls_expanded.py``
    and ``0047`` issue ``GRANT ... TO service_role, authenticated, vaeloom_app``
    and ``CREATE POLICY ... TO vaeloom_app``, and those statements fail outright
    when the named role does not exist. On Supabase they pre-exist, which is why
    the chain never had to create them and why it failed on any other
    PostgreSQL.
    """
    ensure_roles(_context().pg_url)


def _alembic_head_revision(alembic_cwd: pathlib.Path) -> str:
    """The head this repo's migration graph resolves to, read without a database.

    From the local version scripts via alembic's own ``ScriptDirectory``, not via
    an ``alembic heads`` subprocess: a subprocess would need its own environment
    handling to avoid the very misdirection this module exists to prevent, and
    this needs no database at all. It answers "what did we ask for" using only
    what is on disk, so it cannot be confused by whatever a child connected to.
    """
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    config = Config(str(alembic_cwd / "alembic.ini"))
    # alembic.ini names `script_location` relative to the process CWD, and this
    # module is invoked from the repo root, not from apps/api. Pin it absolutely
    # so the graph resolves regardless of where the caller stands.
    config.set_main_option("script_location", str(alembic_cwd / "alembic"))
    heads = sorted(ScriptDirectory.from_config(config).get_heads())
    if len(heads) != 1:
        raise RuntimeError(
            f"expected exactly one migration head, found {heads or 'none'}. "
            "A branching migration graph makes 'upgrade head' ambiguous, so the "
            "verification cannot claim it applied the whole chain."
        )
    return heads[0]


def _recorded_alembic_head(target_url: str) -> str:
    """What the target database itself says was applied.

    Read back from the database rather than from alembic's exit code, because the
    exit code only says the command succeeded -- not that it succeeded *here*.
    """

    import asyncio

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool

    async def read() -> str:
        engine = create_async_engine(_async_url(target_url), poolclass=NullPool)
        try:
            async with engine.connect() as connection:
                result = await connection.execute(text("SELECT version_num FROM alembic_version"))
                return ",".join(sorted(row[0] for row in result))
        finally:
            await engine.dispose()

    return asyncio.run(read())


def step_1_upgrade_head() -> None:
    """Apply the whole chain from empty, via `alembic upgrade head`.

    Then read the head back *out of the database* and require it to be the head
    this script asked for. `alembic upgrade head` exiting 0 proves only that the
    command worked; on the first real run of this harness it exited 0 having
    migrated a remote Supabase project to head while this container sat empty,
    and nothing caught it. Comparing the database against the revision alembic
    resolved locally turns that silent misdirection into a loud failure.
    """
    context = _context()
    expected = _alembic_head_revision(context.alembic_cwd)
    _alembic(context, "upgrade", "head")

    actual = _recorded_alembic_head(_effective_target_url(context.pg_url))
    if actual != expected:
        raise RuntimeError(
            f"`alembic upgrade head` reported success but the target database is at "
            f"'{actual}', not the expected head '{expected}'. The database this run "
            "guarded is not the one the migrations were applied to -- do not trust "
            "any later step until this is understood."
        )


def step_2_run_live_pg_suite() -> None:
    """Run the live-PostgreSQL suites. Any skip is a failure, not a pass."""
    _run_live_pg_suite(_context(), "the live-PostgreSQL suite (pre-probe)")


def step_3_seed_rollback_probe() -> None:
    """Seed a memory whose type is outside the frozen vocabulary."""
    seed_rollback_probe(_context().pg_url)


def step_4_downgrade_must_fail() -> None:
    """`alembic downgrade -1` must refuse to drop the constraint over that row.

    Deliberately does not raise on a non-zero exit -- that is the expected
    outcome here. It records the result for step 5, which is where "failed" is
    turned into "failed for the right reason". A step that only recorded a
    boolean would leave that distinction to nobody.
    """
    context = _context()
    completed = _alembic_run(context, "downgrade", "-1")
    context.downgrade_returncode = completed.returncode
    context.downgrade_output = _merged_output(completed)


def step_5_assert_downgrade_failure_shape() -> None:
    """The refusal must name the constraint AND the offending value."""
    context = _context()
    if context.downgrade_returncode is None:
        raise RuntimeError(
            "step 4 recorded no downgrade result, so there is nothing to judge. "
            "Step 4 must run before this one; a missing result here would otherwise "
            "be indistinguishable from a refusal that was never checked."
        )
    assert_downgrade_failed_as_expected(
        context.downgrade_returncode, context.downgrade_output or ""
    )


def step_6_remove_probe_and_downgrade() -> None:
    """Remove the probe, then require `alembic downgrade -1` to succeed.

    The teardown and the downgrade are one step because they are one claim: with
    the probe gone, rolling back is supposed to work. Splitting them would let a
    step that deleted nothing be followed by a step that rolled back cleanly and
    reported success.
    """
    context = _context()
    _remove_rollback_probe(context.pg_url)
    _alembic(context, "downgrade", "-1")


def step_7_upgrade_head_again() -> None:
    """Return to head so the round trip is complete."""
    _alembic(_context(), "upgrade", "head")


def step_8_reassert_invariants() -> None:
    """Re-run the live-PostgreSQL suites to confirm the round trip did no damage."""
    _run_live_pg_suite(_context(), "the live-PostgreSQL suite (post round trip)")


def main(argv: Sequence[str] | None = None) -> int:
    global _CONTEXT

    args = parse_args(argv)

    pg_url = (args.pg_url or "").strip()
    if not pg_url:
        print(
            "refusing to run: no target database URL. Pass --pg-url, or set the "
            f"{PG_URL_ENV_VAR} environment variable.",
            file=sys.stderr,
        )
        return 2

    # Guard first, always: nothing below this line may shell out before the
    # target is proven disposable.
    try:
        guard_target_database(database_name_from_url(pg_url))
    except UnsafeTargetError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except ValueError as exc:
        # A malformed URL raises out of urlparse, not out of the guard. Left
        # uncaught it escapes main as a traceback with exit code 1, which this
        # script's own contract defines as "a verification step failed" -- the
        # operator would read a broken migration chain for a bad paste.
        print(
            f"refusing to run: the target URL could not be parsed ({exc}). Check the "
            f"--pg-url flag, or the {PG_URL_ENV_VAR} environment variable it defaults "
            "to.",
            file=sys.stderr,
        )
        return 2

    try:
        alembic_cwd = resolve_alembic_cwd(args.repo_root)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    # Only now, with the guards behind it, does anything learn what it may act on.
    # Steps take no arguments (the sequencer calls them bare), so this is where
    # the approved target and the resolved alembic working directory are recorded
    # for the whole walk.
    _CONTEXT = _RunContext(pg_url=pg_url, alembic_cwd=alembic_cwd, alembic=args.alembic)
    try:
        for step_name in VERIFICATION_STEPS:
            try:
                _resolve_step(step_name)()
            except Exception as exc:
                print(f"FAILED at {step_name}: {exc}", file=sys.stderr)
                return 1
            print(f"[ok] {step_name}")
    finally:
        # Cleared on every exit, including the early `return 1`. A second main()
        # in the same interpreter must not inherit the previous run's target, its
        # alembic working directory, or -- worst of all -- its recorded downgrade
        # result, which would let step 5 pass on evidence step 4 never gathered.
        _CONTEXT = None

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
