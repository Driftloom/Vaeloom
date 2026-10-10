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
import os
import pathlib
import subprocess
import sys
from collections.abc import Callable, Sequence
from urllib.parse import urlparse

# scripts/verify_pg_migrations.py -> repo root
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

PG_URL_ENV_VAR = "VAELOOM_TEST_PG_URL"
ALLOWED_DB_SUFFIXES = ("_proof", "_test")

# Must match the roles the migration chain itself grants to (0005_rls_expanded.py,
# 0047 service policies). Task 2 owns creating them; they are declared here so the
# guardrails and the preflight cannot drift apart.
APP_ROLE = "vaeloom_app"
APP_PASSWORD = "vaeloom_app_proof_pw"
NONLOGIN_ROLES = ("service_role", "authenticated")

# The ordered proof. A prepended role preflight (step 0) is expected to join this
# tuple; `main` resolves each name against this module's globals, so adding an
# entry needs no change here.
VERIFICATION_STEPS = (
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
# Verification steps. Task 1 ships the sequencer; the bodies land with Task 2.
# --------------------------------------------------------------------------


def step_1_upgrade_head() -> None:
    """Apply the whole chain from empty, via `alembic upgrade head`."""


def step_2_run_live_pg_suite() -> None:
    """Run the live-PostgreSQL suites. Any skip is a failure, not a pass."""


def step_3_seed_rollback_probe() -> None:
    """Seed a memory whose type is outside the frozen vocabulary."""


def step_4_downgrade_must_fail() -> None:
    """`alembic downgrade -1` must refuse to drop the constraint over that row."""


def step_5_assert_downgrade_failure_shape() -> None:
    """The refusal must name the constraint AND the offending value."""


def step_6_remove_probe_and_downgrade() -> None:
    """Remove the probe row, then require `alembic downgrade -1` to succeed."""


def step_7_upgrade_head_again() -> None:
    """Return to head so the round trip is complete."""


def step_8_reassert_invariants() -> None:
    """Re-run the live-PostgreSQL suites to confirm the round trip did no damage."""


def main(argv: Sequence[str] | None = None) -> int:
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
        resolve_alembic_cwd(args.repo_root)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    for step_name in VERIFICATION_STEPS:
        try:
            _resolve_step(step_name)()
        except Exception as exc:
            print(f"FAILED at {step_name}: {exc}", file=sys.stderr)
            return 1
        print(f"[ok] {step_name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
