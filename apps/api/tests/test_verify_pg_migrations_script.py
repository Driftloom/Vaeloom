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
