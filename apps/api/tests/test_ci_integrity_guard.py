"""Regression guards for the CI integrity plugin (``tests/ci_integrity.py``).

Each test drives a real pytest subprocess, because both guarantees are about
what happens when a process dies: a same-process assertion cannot observe an
``os._exit``.

* The worker guard is the only thing that survives ``pytest-timeout``'s
  ``os._exit(1)`` and names the hung test with a stack.
* The controller guard turns an unbounded wait into exit code 66 plus a dump.
* Both are opt-in, so a plain local run must stay silent.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parents[1]

HANGING_TEST = "import time\n\n\ndef test_hangs_forever():\n    time.sleep(60)\n"
PASSING_TEST = "def test_passes():\n    assert True\n"


def _run_pytest(
    tmp_path: Path,
    source: str,
    *args: str,
    artifact_dir: Path | None,
) -> subprocess.CompletedProcess[str]:
    test_file = tmp_path / "test_integrity_synthetic.py"
    test_file.write_text(source, encoding="utf-8")

    env = os.environ.copy()
    # The outer suite may itself run under these; never leak them inwards.
    env.pop("PYTEST_ADDOPTS", None)
    if artifact_dir is None:
        env.pop("CI_INTEGRITY_DIR", None)
    else:
        env["CI_INTEGRITY_DIR"] = str(artifact_dir)

    command = [
        sys.executable,
        "-m",
        "pytest",
        str(test_file),
        "-o",
        "addopts=",
        "-p",
        "tests.ci_integrity",
        "-p",
        "no:cacheprovider",
        *args,
    ]
    return subprocess.run(
        command,
        cwd=API_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=180,
    )


def test_worker_hang_dump_survives_timeout_os_exit(tmp_path: Path) -> None:
    """A timed-out worker must leave the nodeid and a stack behind."""
    artifacts = tmp_path / "artifacts"

    result = _run_pytest(
        tmp_path,
        HANGING_TEST,
        "-n",
        "1",
        "--dist",
        "loadfile",
        "--timeout=6",
        "--timeout-method=thread",
        "--max-worker-restart=0",
        artifact_dir=artifacts,
    )

    output = result.stdout + result.stderr
    assert result.returncode == 1, output
    assert "node down: Not properly terminated" in output

    worker_log = (artifacts / "worker-gw0.log").read_text(encoding="utf-8")
    # The dump is written to an fd, which is the point: pytest-timeout's
    # os._exit discards anything routed through the execnet channel.
    assert "test_integrity_synthetic.py" in worker_log
    assert "in test_hangs_forever" in worker_log
    assert "Thread 0x" in worker_log


@pytest.mark.parametrize(
    "workers",
    [[], ["-n", "1", "--dist", "loadfile"]],
    ids=["serial", "xdist"],
)
def test_watchdog_bounds_a_stalled_controller(
    tmp_path: Path, workers: list[str]
) -> None:
    """Silence must fail fast with exit 66 instead of burning 45 minutes.

    The xdist case is the one CI runs. It regressed once: arming on
    ``pytest_collection_finish`` left the watchdog dead under xdist because the
    controller never calls that hook.
    """
    artifacts = tmp_path / "artifacts"

    result = _run_pytest(
        tmp_path,
        HANGING_TEST,
        *workers,
        "--ci-watchdog-timeout=2",
        artifact_dir=artifacts,
    )

    assert result.returncode == 66, result.stdout + result.stderr
    assert "CI INTEGRITY: the test controller stopped making progress." in result.stderr

    stall_log = (artifacts / "CONTROLLER-STALL.log").read_text(encoding="utf-8")
    assert "test_hangs_forever" in stall_log
    assert '"reason": "controller-stall"' in stall_log


def test_guards_are_opt_in(tmp_path: Path) -> None:
    """Without the env var and flag, a local run writes nothing and passes."""
    result = _run_pytest(tmp_path, PASSING_TEST, artifact_dir=None)

    assert result.returncode == 0, result.stdout + result.stderr
    assert not list(tmp_path.glob("worker-*.log"))
    assert not list(tmp_path.glob("controller.log"))
    assert not (tmp_path / "run-integrity.json").exists()


def test_watchdog_option_is_registered_by_root_conftest() -> None:
    """The root conftest must expose the plugin on an ordinary invocation."""
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--help"],
        cwd=API_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "--ci-watchdog-timeout" in result.stdout
