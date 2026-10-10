"""Safety guards and step sequencer for ``scripts/verify_pg_migrations.py``.

This script provisions PostgreSQL roles and runs destructive migrations against a
database URL a developer can paste from anywhere -- CI exports one, and the local
wrapper builds one. So "refuses before touching the database" is the product here,
not the sequencer: a run against the wrong database is unrecoverable, and the
failure mode this file exists to prevent is a guard that passes because it was
never exercised rather than because it held.

The module is loaded by path -- ``scripts/`` is not an importable package. This
follows ``tests/test_ranking_weights_rls.py:236-250``.
"""

from __future__ import annotations

import importlib.util
import pathlib
import subprocess
import sys

import pytest

SAFE_URL = "postgresql://postgres:vaeloom_verify_pw@127.0.0.1:5433/vaeloom_test"
UNSAFE_URL = "postgresql://postgres:pw@127.0.0.1:5432/vaeloom_prod"


def _load_script():
    """Import scripts/verify_pg_migrations.py as a module so its guards can be called."""
    path = (
        pathlib.Path(__file__).resolve().parents[3] / "scripts" / "verify_pg_migrations.py"
    )
    assert path.exists(), f"verification script not found at {path}"
    spec = importlib.util.spec_from_file_location("verify_pg_migrations_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


script = _load_script()


def _repo_with_alembic(tmp_path: pathlib.Path) -> pathlib.Path:
    """A throwaway repo root whose apps/api holds an alembic.ini."""
    api = tmp_path / "apps" / "api"
    api.mkdir(parents=True)
    (api / "alembic.ini").write_text("[alembic]\n", encoding="utf-8")
    return tmp_path


def _fake_alembic(tmp_path: pathlib.Path) -> tuple[pathlib.Path, pathlib.Path]:
    """A real program that appends to a log every time it is invoked.

    Returns ``(script_path, log_path)``. This is a ``.py`` file run through
    ``sys.executable``, not a shell or batch script: CI collects this suite on
    ``ubuntu-latest`` (``ci-backend.yml:10``), where a shebangless ``.cmd`` with
    ``0o644`` is not executable at all. One form for both platforms means the
    control below is exercised locally by the same code CI runs.
    """
    log = tmp_path / "alembic-invocations.log"
    script = tmp_path / "fake_alembic.py"
    script.write_text(
        "import sys\n"
        "from pathlib import Path\n"
        f"LOG = Path({str(log)!r})\n"
        'with LOG.open("a", encoding="utf-8") as _handle:\n'
        '    _handle.write(" ".join(sys.argv[1:]) + "\\n")\n',
        encoding="utf-8",
    )
    return script, log


def _run_fake_alembic(script: pathlib.Path, *args: str) -> None:
    """The single way the fake is ever invoked, on every platform."""
    subprocess.run([sys.executable, str(script), *args], check=True)


def _forbid_subprocess(monkeypatch, module) -> list:
    """Record -- and loudly fail on -- any subprocess spawned by the script."""
    calls: list = []

    def fake_run(cmd, *args, **kwargs):
        calls.append(cmd)
        raise AssertionError(f"the script shelled out via subprocess.run({cmd!r})")

    monkeypatch.setattr(module.subprocess, "run", fake_run)
    return calls


# --------------------------------------------------------------------------
# guard_target_database
# --------------------------------------------------------------------------


def test_guard_accepts_proof_database():
    assert script.guard_target_database("vaeloom_rls_proof") is None


def test_guard_accepts_test_database():
    assert script.guard_target_database("vaeloom_test") is None


def test_guard_rejects_production_database():
    with pytest.raises(script.UnsafeTargetError) as exc:
        script.guard_target_database("vaeloom_prod")
    assert "vaeloom_prod" in str(exc.value), (
        "the refusal must name the offending database -- a developer who pastes a "
        "production URL needs to know which database was refused"
    )


def test_guard_rejects_bare_name():
    with pytest.raises(script.UnsafeTargetError) as exc:
        script.guard_target_database("postgres")
    assert "postgres" in str(exc.value)


def test_database_name_from_url_ignores_query():
    url = f"{SAFE_URL}?ssl=require&application_name=verify_pg_migrations"
    assert script.database_name_from_url(url) == "vaeloom_test"


def test_database_name_from_url_ignores_trailing_slash():
    url = f"{SAFE_URL}/?ssl=require"
    assert script.database_name_from_url(url) == "vaeloom_test"


# --------------------------------------------------------------------------
# Guard ordering: nothing runs before the target is proven safe
# --------------------------------------------------------------------------


def test_main_rejects_unsafe_database_before_touching_alembic(monkeypatch, tmp_path, capsys):
    fake_alembic, invocation_log = _fake_alembic(tmp_path)
    repo_root = _repo_with_alembic(tmp_path / "repo")
    calls = _forbid_subprocess(monkeypatch, script)

    returncode = script.main(
        [
            "--pg-url",
            UNSAFE_URL,
            "--repo-root",
            str(repo_root),
            "--alembic",
            str(fake_alembic),
        ]
    )

    assert returncode == 2
    assert calls == [], f"the guard rejected the target but still shelled out: {calls}"
    assert not invocation_log.exists(), "the fake alembic ran; the guard did not hold first"
    stderr = capsys.readouterr().err
    assert "vaeloom_prod" in stderr, f"the refusal must name the database it refused: {stderr!r}"


def test_negative_control_the_fake_alembic_would_have_recorded(tmp_path):
    """Keeps the assertion above from passing vacuously.

    ``not invocation_log.exists()`` only means "the fake was never run" if the
    fake does record being run, with the migration arguments it was handed. If
    it stopped recording, the guard test would keep passing while proving
    nothing -- which is the green-by-absence failure this suite exists to
    eliminate, so the control is itself load-bearing and is not skipped on
    platforms where it is inconvenient.
    """
    fake_alembic, invocation_log = _fake_alembic(tmp_path)
    assert not invocation_log.exists()

    _run_fake_alembic(fake_alembic, "upgrade", "head")

    assert invocation_log.exists(), (
        "the fake alembic did not record its own execution, so its absence proves "
        "nothing about the guard test"
    )
    assert "upgrade head" in invocation_log.read_text(encoding="utf-8"), (
        "the fake ran without receiving the migration arguments, so the control "
        "proves only that some process started"
    )


def test_main_rejects_a_malformed_url_with_exit_2(monkeypatch, tmp_path, capsys):
    """A typo'd URL is a refusal, not a failed verification step.

    ``urlparse`` raises ``ValueError`` on a malformed URL. Uncaught, that escapes
    ``main`` as a traceback with exit code 1 -- which this script's own contract
    defines as "a verification step failed", so the operator reads a broken
    migration chain when the real cause is a bad paste.
    """
    repo_root = _repo_with_alembic(tmp_path / "repo")
    calls = _forbid_subprocess(monkeypatch, script)

    returncode = script.main(
        ["--pg-url", "postgresql://u:p@[::1/db", "--repo-root", str(repo_root)]
    )

    assert returncode == 2, "a malformed URL is a guard rejection, not a step failure"
    assert calls == [], "the malformed URL escaped before the guard could refuse it"
    stderr = capsys.readouterr().err
    assert "Traceback" not in stderr, f"a bad paste must not produce a traceback: {stderr!r}"
    assert "--pg-url" in stderr and "VAELOOM_TEST_PG_URL" in stderr, (
        f"the operator must be told both ways to supply a URL: {stderr!r}"
    )


def test_main_returns_2_when_alembic_ini_is_missing(tmp_path, capsys):
    repo_root = tmp_path / "repo"
    (repo_root / "apps" / "api").mkdir(parents=True)

    returncode = script.main(["--pg-url", SAFE_URL, "--repo-root", str(repo_root)])

    assert returncode == 2
    stderr = capsys.readouterr().err
    assert "apps/api" in stderr, (
        f"a missing alembic.ini must name the required working directory: {stderr!r}"
    )


def test_resolve_alembic_cwd_missing_ini(tmp_path):
    (tmp_path / "apps" / "api").mkdir(parents=True)
    with pytest.raises(RuntimeError) as exc:
        script.resolve_alembic_cwd(tmp_path)
    assert "apps/api" in str(exc.value)


# --------------------------------------------------------------------------
# URL sourcing: CI runs the script with no arguments at all
# --------------------------------------------------------------------------


def test_parse_args_defaults_pg_url_from_the_environment(monkeypatch):
    monkeypatch.setenv("VAELOOM_TEST_PG_URL", SAFE_URL)
    assert script.parse_args([]).pg_url == SAFE_URL

    monkeypatch.setenv("VAELOOM_TEST_PG_URL", "postgresql://other/elsewhere")
    assert script.parse_args(["--pg-url", SAFE_URL]).pg_url == SAFE_URL


def test_main_without_a_url_from_either_source_exits_2_naming_both(monkeypatch, tmp_path, capsys):
    monkeypatch.delenv("VAELOOM_TEST_PG_URL", raising=False)
    repo_root = _repo_with_alembic(tmp_path / "repo")

    returncode = script.main(["--repo-root", str(repo_root)])

    assert returncode == 2
    stderr = capsys.readouterr().err
    assert "--pg-url" in stderr and "VAELOOM_TEST_PG_URL" in stderr, (
        f"the operator must be told both ways to supply a URL: {stderr!r}"
    )


# --------------------------------------------------------------------------
# The sequencer
# --------------------------------------------------------------------------


def test_every_declared_step_name_resolves_to_a_callable():
    for name in script.VERIFICATION_STEPS:
        assert callable(getattr(script, name, None)), (
            f"VERIFICATION_STEPS declares {name!r} but the module defines no callable "
            "of that name; the sequencer would skip a step rather than fail"
        )


def test_main_walks_every_declared_step_in_declared_order(monkeypatch, tmp_path):
    repo_root = _repo_with_alembic(tmp_path / "repo")
    walked: list = []
    for name in script.VERIFICATION_STEPS:
        monkeypatch.setattr(script, name, lambda n=name: walked.append(n))

    returncode = script.main(["--pg-url", SAFE_URL, "--repo-root", str(repo_root)])

    assert returncode == 0
    assert walked == list(script.VERIFICATION_STEPS), "a declared step was never invoked"
    assert "step_1_upgrade_head" in script.VERIFICATION_STEPS
    assert "step_8_reassert_invariants" in script.VERIFICATION_STEPS


def test_main_returns_1_and_names_the_first_failing_step(monkeypatch, tmp_path, capsys):
    repo_root = _repo_with_alembic(tmp_path / "repo")
    names = list(script.VERIFICATION_STEPS)
    failing = names[2]

    def boom():
        raise RuntimeError("alembic downgrade -1 exited 0")

    for index, name in enumerate(names):
        if name == failing:
            monkeypatch.setattr(script, name, boom)
        elif index > names.index(failing):
            monkeypatch.setattr(
                script, name, lambda n=name: pytest.fail(f"{n} ran after the failing step")
            )
        else:
            monkeypatch.setattr(script, name, lambda: None)

    returncode = script.main(["--pg-url", SAFE_URL, "--repo-root", str(repo_root)])

    assert returncode == 1
    stderr = capsys.readouterr().err
    assert failing in stderr, f"the failure must name the step that failed: {stderr!r}"
    assert "alembic downgrade -1 exited 0" in stderr


def test_module_constants_match_the_migration_chain():
    """These are consumed by Task 2's role preflight and by Task 4's CI job."""
    assert script.APP_ROLE == "vaeloom_app"
    assert script.APP_PASSWORD == "vaeloom_app_proof_pw"
    assert script.NONLOGIN_ROLES == ("service_role", "authenticated")


# --------------------------------------------------------------------------
# assert_downgrade_failed_as_expected
#
# This is the crux of the whole verification. 0068's downgrade re-adds
# ck_memories_type_valid, which PostgreSQL validates against every existing row,
# so a memory written under a second domain pack must make it refuse. Today CI
# rehearses that downgrade against an EMPTY memories table, where the check has
# nothing to object to and the step cannot fail.
#
# The proof only counts if the refusal is the right refusal. A downgrade that
# died because of a typo, a missing role or an unrelated permission error is
# equally non-zero, and accepting it would turn a red run into a green one -- so
# the assertion demands the constraint name AND the offending value, and an empty
# output raises rather than passing.
# --------------------------------------------------------------------------


def _expected_refusal_output() -> str:
    """What a real `alembic downgrade -1` prints when the CHECK refuses the probe row.

    Shaped from PostgreSQL's actual message, which carries the failing row in the
    DETAIL line -- that is the only place the offending value appears.
    """
    _, probe_type, check_name = script.rollback_probe_literals()
    return (
        "INFO  [alembic.runtime.migration] Running downgrade 0068 -> 0067\n"
        "FAILED: 0068_memory_type_packs.py -> 0067\n"
        "sqlalchemy.exc.DBAPIError: (asyncpg) ERROR:  check constraint "
        f'"{check_name}" of relation "memories" is violated by some row\n'
        f"DETAIL:  Failing row contains (... 'note', ..., '{probe_type}', ...).\n"
    )


def test_assert_downgrade_rejects_zero_exitcode():
    """A downgrade that SUCCEEDED proves the opposite of what this step claims.

    Reaching 0067 with the probe row intact means the restored CHECK accepted a
    type 0027 does not list, so the safety boundary is gone and the run must fail.
    """
    with pytest.raises(RuntimeError):
        script.assert_downgrade_failed_as_expected(0, _expected_refusal_output())


def test_assert_downgrade_rejects_unrelated_failure():
    """Non-zero is not enough: a permission error is a different failure entirely."""
    with pytest.raises(RuntimeError) as exc:
        script.assert_downgrade_failed_as_expected(
            1, "ERROR:  permission denied for schema public"
        )
    assert "ck_memories_type_valid" in str(exc.value), (
        "the refusal must say which expected token was missing -- otherwise the "
        "operator cannot tell a permission problem from the proof working"
    )


def test_assert_downgrade_rejects_missing_value():
    """The constraint is named but the offending value is not: not the proof."""
    _, probe_type, check_name = script.rollback_probe_literals()
    output = (
        f'ERROR:  check constraint "{check_name}" of relation "memories" '
        "is violated by some row\nDETAIL:  Failing row contains (uuid, document).\n"
    )
    assert probe_type not in output, "this control must not accidentally name the value"
    with pytest.raises(RuntimeError):
        script.assert_downgrade_failed_as_expected(1, output)


def test_assert_downgrade_rejects_missing_constraint():
    """The value is named but not the constraint: also not the proof."""
    _, probe_type, check_name = script.rollback_probe_literals()
    output = (
        "ERROR:  new row violates check constraint on relation \"memories\"\n"
        f"DETAIL:  Failing row contains (... '{probe_type}' ...).\n"
    )
    assert check_name not in output, "this control must not accidentally name the constraint"
    with pytest.raises(RuntimeError):
        script.assert_downgrade_failed_as_expected(1, output)


def test_assert_downgrade_accepts_expected_failure():
    """The one shape that passes: non-zero, naming the constraint and the value."""
    assert (
        script.assert_downgrade_failed_as_expected(1, _expected_refusal_output()) is None
    )


def test_assert_downgrade_rejects_empty_output():
    """Green by emptiness, explicitly.

    Output is captured from a subprocess, so an empty string is a real outcome (a
    crash before any flush, a redirected stream). A substring test on "" is False
    for both tokens, so the strict form raises; an `if constraint in output and
    value in output` gate written as a bare conditional, or an `all(...)` over an
    empty list of lines, would pass here and report a proof that never happened.
    """
    with pytest.raises(RuntimeError) as exc:
        script.assert_downgrade_failed_as_expected(1, "")
    message = str(exc.value)
    _, probe_type, check_name = script.rollback_probe_literals()
    assert check_name in message and probe_type in message, (
        f"an empty output must be reported as missing BOTH expected tokens: {message!r}"
    )


def test_rollback_probe_literals_are_stable():
    """The three literals are the contract between the seed, the assertion and CI.

    Tests above read them through this function rather than retyping them, so a
    rename cannot pass CI's psql assertions while breaking the Python side. This
    is the one place they are spelled out.
    """
    assert script.rollback_probe_literals() == (
        "rollback_probe",
        "job_posting",
        "ck_memories_type_valid",
    )


# --------------------------------------------------------------------------
# Step wiring: what each step actually executes
#
# alembic and pytest are recorded rather than executed (Ruling C -- `--alembic`
# may hold a non-executable path, so a test must never hand it one and expect a
# process). The database work is stubbed for the same reason; the SQL itself is
# Task 5's real run.
# --------------------------------------------------------------------------

EXPECTED_LIVE_PG_SUITES = (
    "tests/test_migration_chain_pg.py",
    "tests/test_migration_0057_pg.py",
    "tests/test_rls_live_pg.py",
    "tests/test_ranking_weights_rls.py",
)


def _live_pg_output(outcome: str = "PASSED") -> str:
    lines = [f"{path}::test_example {outcome}" for path in EXPECTED_LIVE_PG_SUITES]
    if outcome == "PASSED":
        lines.append("4 passed in 3.10s")
    else:
        lines.append("1 passed, 3 skipped in 3.10s")
    return "\n".join(lines) + "\n"


def _completed(returncode: int, stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(
        args=[], returncode=returncode, stdout=stdout, stderr=stderr
    )


def _record_subprocess(monkeypatch, module, results: list) -> list:
    """Record subprocess.run calls and hand back canned results in order."""
    calls: list = []
    queue = list(results)

    def fake_run(cmd, *args, **kwargs):
        calls.append({"cmd": list(cmd), "kwargs": kwargs})
        if not queue:
            raise AssertionError(f"unexpected extra subprocess call: {cmd!r}")
        return queue.pop(0)

    monkeypatch.setattr(module.subprocess, "run", fake_run)
    return calls


def _stub_database_work(monkeypatch, module) -> list:
    """Replace the three database-touching helpers, recording what they were given."""
    calls: list = []
    monkeypatch.setattr(
        module, "ensure_roles", lambda pg_url: calls.append(("ensure_roles", pg_url))
    )
    monkeypatch.setattr(
        module, "seed_rollback_probe", lambda pg_url: calls.append(("seed", pg_url))
    )
    monkeypatch.setattr(
        module, "_remove_rollback_probe", lambda pg_url: calls.append(("remove", pg_url))
    )
    return calls


def _stub_run_env(monkeypatch):
    """Ignore a developer's exported VAELOOM_TARGET_URL so the walk is deterministic."""
    monkeypatch.delenv(script.TARGET_URL_ENV_VAR, raising=False)
    monkeypatch.delenv("VAELOOM_TEST_PG_URL", raising=False)


def _passing_run_results() -> list:
    """Subprocess results for a run where the probe behaves exactly as designed."""
    return [
        _completed(0),                                # step 1: alembic upgrade head
        _completed(0, stdout=_live_pg_output()),      # step 2: live-PG suite
        _completed(1, stdout=_expected_refusal_output()),  # step 4: downgrade must fail
        _completed(0),                                # step 6: downgrade must succeed
        _completed(0),                                # step 7: alembic upgrade head
        _completed(0, stdout=_live_pg_output()),      # step 8: live-PG suite again
    ]


def test_role_preflight_is_the_first_declared_step():
    """The migrations GRANT to, and CREATE POLICY for, roles that must already exist."""
    assert script.VERIFICATION_STEPS[0] == "step_0_ensure_roles", (
        "ensure_roles must be walked before step 1, or `upgrade head` fails on the "
        "first GRANT to a role that does not exist yet"
    )
    assert len(script.VERIFICATION_STEPS) == 9, (
        "eight numbered checks plus the role preflight; a shorter tuple means a "
        "declared verification was dropped"
    )
    assert script.VERIFICATION_STEPS[1:] == (
        "step_1_upgrade_head",
        "step_2_run_live_pg_suite",
        "step_3_seed_rollback_probe",
        "step_4_downgrade_must_fail",
        "step_5_assert_downgrade_failure_shape",
        "step_6_remove_probe_and_downgrade",
        "step_7_upgrade_head_again",
        "step_8_reassert_invariants",
    ), "the canonical step names are ratified; they are not ours to renumber"


def test_main_drives_every_step_in_order_with_stubbed_effects(monkeypatch, tmp_path):
    """One full pass over the sequencer, pinning what each step actually executes.

    This is where the argv is checked rather than assumed: the working directory
    must be apps/api (alembic.ini only resolves there), the live suite must be
    invoked through the caller's own interpreter under `-v`, and the two
    downgrades must bracket the refusal.
    """
    _stub_run_env(monkeypatch)
    repo_root = _repo_with_alembic(tmp_path / "repo")
    api_dir = repo_root / "apps" / "api"
    db_calls = _stub_database_work(monkeypatch, script)
    calls = _record_subprocess(monkeypatch, script, _passing_run_results())

    returncode = script.main(["--pg-url", SAFE_URL, "--repo-root", str(repo_root)])

    assert returncode == 0, "a correctly staged run must pass every step"
    assert db_calls == [("ensure_roles", SAFE_URL), ("seed", SAFE_URL), ("remove", SAFE_URL)], (
        f"the role preflight, the seed and the teardown are each called once, in "
        f"that order: {db_calls!r}"
    )
    assert [call["cmd"] for call in calls] == [
        ["alembic", "upgrade", "head"],
        [sys.executable, "-m", "pytest", *EXPECTED_LIVE_PG_SUITES, "-v", "-o", "addopts="],
        ["alembic", "downgrade", "-1"],
        ["alembic", "downgrade", "-1"],
        ["alembic", "upgrade", "head"],
        [sys.executable, "-m", "pytest", *EXPECTED_LIVE_PG_SUITES, "-v", "-o", "addopts="],
    ], f"the executed commands drifted: {[call['cmd'] for call in calls]!r}"
    for call in calls:
        assert call["kwargs"]["cwd"] == api_dir, (
            f"alembic/pytest must run from {api_dir}, not {call['kwargs']['cwd']}"
        )
        assert call["kwargs"]["capture_output"] is True
        assert call["kwargs"]["text"] is True
    pytest_env = calls[1]["kwargs"]["env"]
    assert pytest_env["VAELOOM_TEST_PG_URL"] == SAFE_URL, (
        "without this the live-PG suites skip themselves and the run proves nothing"
    )


def test_main_fails_when_the_live_pg_suite_skips(monkeypatch, tmp_path, capsys):
    """A skip is not a pass: pytest exits 0 for an all-skipped run (Ruling D)."""
    _stub_run_env(monkeypatch)
    repo_root = _repo_with_alembic(tmp_path / "repo")
    _stub_database_work(monkeypatch, script)
    results = _passing_run_results()
    results[1] = _completed(0, stdout=_live_pg_output("SKIPPED"))
    _record_subprocess(monkeypatch, script, results)

    returncode = script.main(["--pg-url", SAFE_URL, "--repo-root", str(repo_root)])

    assert returncode == 1
    skipped_line = f"{EXPECTED_LIVE_PG_SUITES[0]}::test_example SKIPPED"
    stderr = capsys.readouterr().err
    assert "step_2_run_live_pg_suite" in stderr, (
        f"the failure must name the step that rejected the suite: {stderr!r}"
    )
    assert skipped_line in stderr, (
        f"the operator must be shown WHICH tests skipped, not just that some did: {stderr!r}"
    )


def test_main_fails_at_step_5_when_the_downgrade_refused_for_another_reason(
    monkeypatch, tmp_path, capsys
):
    """The refusal has to be the constraint's, or a typo reads as a passing proof."""
    _stub_run_env(monkeypatch)
    repo_root = _repo_with_alembic(tmp_path / "repo")
    _stub_database_work(monkeypatch, script)
    results = _passing_run_results()
    results[2] = _completed(1, stdout="ERROR:  permission denied for schema public")
    _record_subprocess(monkeypatch, script, results)

    returncode = script.main(["--pg-url", SAFE_URL, "--repo-root", str(repo_root)])

    assert returncode == 1
    stderr = capsys.readouterr().err
    assert "step_5_assert_downgrade_failure_shape" in stderr, (
        f"the operator must be told which step rejected the downgrade: {stderr!r}"
    )


def test_main_fails_at_step_6_when_the_second_downgrade_also_fails(
    monkeypatch, tmp_path, capsys
):
    """Removing the probe and then failing to roll back is a failure, not a retry."""
    _stub_run_env(monkeypatch)
    repo_root = _repo_with_alembic(tmp_path / "repo")
    _stub_database_work(monkeypatch, script)
    results = _passing_run_results()
    results[3] = _completed(1, stdout="ERROR:  relation \"memory_taxonomy_ledger\" does not exist")
    _record_subprocess(monkeypatch, script, results)

    returncode = script.main(["--pg-url", SAFE_URL, "--repo-root", str(repo_root)])

    assert returncode == 1
    stderr = capsys.readouterr().err
    assert "step_6_remove_probe_and_downgrade" in stderr, (
        f"the teardown's own downgrade failure must be surfaced: {stderr!r}"
    )


def test_role_bootstrap_repairs_a_preexisting_nologin_app_role():
    """CI creates vaeloom_app as NOLOGIN; a skip-if-exists guard strands it there.

    `tests/test_rls_live_pg.py` then declines to create it, the role can never log
    in, and `test_pg_live_password_login_succeeds_as_vaeloom_app` is unreachable --
    which is why that file was never added to CI. The ELSE branch is the fix, so
    it is asserted here rather than left to the first real run.
    """
    sql = script._role_bootstrap_sql(script.APP_ROLE, login=True)
    assert f"CREATE ROLE {script.APP_ROLE} LOGIN" in sql
    assert f"ALTER ROLE {script.APP_ROLE} LOGIN PASSWORD" in sql, (
        "an existing role must be ALTERed, not left as whatever CI made it"
    )
    assert script.APP_PASSWORD in sql
    assert "IF NOT EXISTS (SELECT FROM pg_roles" in sql
    assert sql.index("CREATE ROLE") < sql.index("ELSE") < sql.index("ALTER ROLE")

    nonlogin = script._role_bootstrap_sql("service_role", login=False)
    assert f"CREATE ROLE service_role NOLOGIN" in nonlogin
    assert f"ALTER ROLE service_role NOLOGIN" in nonlogin
