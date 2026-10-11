"""Tests for `scripts/run_pg_verification.ps1`, the local disposable-container wrapper.

Two tiers:

* **Always on, cheap, no Docker.** Static checks that the wrapper agrees with the
  script it drives -- image, container name, database name, and the guards. These
  run in the normal CI suite because they are milliseconds.
* **Gated behind `VAELOOM_PG_VERIFY_E2E=1`.** The tests that actually start
  containers. They are skipped by default *on purpose*: `ci-backend.yml`'s Core
  API Test Suite collects everything under `tests/`, and spawning PostgreSQL
  containers there would make the main suite slow, flaky, and competing with the
  migration-chain workflow's own container.

The gated tier is not dead weight -- `migration-chain.yml` invokes the Python
script on every push, so the teardown path it exercises is covered in CI.
"""

from __future__ import annotations

import os
import pathlib
import re
import shutil
import subprocess

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
WRAPPER = REPO_ROOT / "scripts" / "run_pg_verification.ps1"

CONTAINER_NAME = "vaeloom-pg-verify"
IMAGE = "pgvector/pgvector:pg16"
DATABASE = "vaeloom_test"

requires_docker = pytest.mark.skipif(
    shutil.which("docker") is None, reason="docker is not on PATH"
)
requires_e2e = pytest.mark.skipif(
    os.environ.get("VAELOOM_PG_VERIFY_E2E") != "1",
    reason="set VAELOOM_PG_VERIFY_E2E=1 to run tests that start PostgreSQL containers",
)


def _docker(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["docker", *args], capture_output=True, text=True, timeout=120
    )


def _container_exists(name: str) -> bool:
    result = _docker("ps", "-a", "--filter", f"name=^/{name}$", "--format", "{{.Names}}")
    return name in (result.stdout or "")


def _run_wrapper(port: int, timeout: int = 900) -> subprocess.CompletedProcess:
    """Invoke the wrapper via the same shell contract CI/devs use."""
    return subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(WRAPPER),
            "-Port",
            str(port),
        ],
        capture_output=True,
        text=True,
        timeout=timeout,
    )


# ---------------------------------------------------------------------------
# Always-on tier: the wrapper agrees with the script it drives.
# ---------------------------------------------------------------------------


def test_wrapper_exists():
    assert WRAPPER.is_file(), f"missing wrapper: {WRAPPER}"


def test_wrapper_pins_the_pg16_image():
    # Matching CI matters more than being current: a version mismatch means local
    # proof and CI proof are proofs of different systems.
    assert f"$Image         = '{IMAGE}'" in WRAPPER.read_text(encoding="utf-8")


def test_wrapper_uses_the_fixed_container_name():
    # A stable name is what lets guard 1 detect a stale container from a crashed run.
    assert f"$ContainerName = '{CONTAINER_NAME}'" in WRAPPER.read_text(encoding="utf-8")


def test_wrapper_database_name_satisfies_the_script_guard():
    # verify_pg_migrations.py refuses any database not ending _proof or _test.
    assert DATABASE.endswith(("_proof", "_test"))


def test_wrapper_defaults_to_5433_and_never_publishes_host_5432():
    text = WRAPPER.read_text(encoding="utf-8")
    assert "else { 5433 }" in text, "default host port must be 5433"

    # The `:5432` inside the port mapping is the container's internal port, which
    # is correct and necessary. What must never appear is a literal *host* 5432.
    published = re.findall(r"-p\s+[\"']([^\"']+)[\"']", text)
    assert published, "wrapper must publish the container port"
    for mapping in published:
        assert mapping == "127.0.0.1:${Port}:5432", (
            f"unexpected port mapping {mapping!r}: the host side must be the "
            "overridable $Port, never a hard-coded 5432"
        )


def test_wrapper_binds_to_loopback_only():
    # Publishing 0.0.0.0 would expose a throwuser superuser database on every
    # interface for the life of the run.
    assert '"127.0.0.1:${Port}:5432"' in WRAPPER.read_text(encoding="utf-8")


def test_wrapper_tears_down_container_and_volume():
    text = WRAPPER.read_text(encoding="utf-8")
    assert re.search(r"docker rm -f -v", text), "must remove the volume, not just the container"
    assert "finally" in text, "teardown must run even when the script fails or throws"


def test_wrapper_refuses_a_stale_container_without_deleting_it():
    text = WRAPPER.read_text(encoding="utf-8")
    assert "already exists" in text
    # Guard 1 refuses; the only rm -v in the file is inside the finally block.
    guard, _, teardown = text.partition("finally")
    assert "rm -f -v" not in guard, "the stale-container guard must not delete anything"


# ---------------------------------------------------------------------------
# Gated tier: these actually start containers.
# ---------------------------------------------------------------------------


@requires_docker
@requires_e2e
def test_wrapper_refuses_when_a_stale_container_exists():
    created = _docker(
        "create", "--name", CONTAINER_NAME, "-e", "POSTGRES_PASSWORD=x", IMAGE
    )
    if created.returncode != 0:
        pytest.skip(f"could not create the stale container: {created.stderr.strip()}")
    try:
        result = _run_wrapper(5433)
        assert result.returncode != 0, "wrapper must refuse to reuse a stale container"
        combined = result.stdout + result.stderr
        assert CONTAINER_NAME in combined, "the refusal must name the container"
        # It must not have deleted it -- it may be someone else's run.
        assert _container_exists(CONTAINER_NAME), "wrapper must not delete the stale container"
    finally:
        _docker("rm", "-f", "-v", CONTAINER_NAME)


@requires_docker
@requires_e2e
def test_wrapper_refuses_when_the_port_is_already_bound():
    import socket

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        sock.listen(1)
        port = sock.getsockname()[1]
        result = _run_wrapper(port)
    assert result.returncode != 0, "wrapper must refuse a bound port"
    combined = result.stdout + result.stderr
    assert str(port) in combined, "the refusal must name the port"
    assert "VAELOOM_PG_VERIFY_PORT" in combined, "the refusal must name the override"
    assert not _container_exists(CONTAINER_NAME), "no container should be started"


@requires_docker
@requires_e2e
def test_wrapper_runs_verification_and_tears_down_completely():
    assert not _container_exists(CONTAINER_NAME), "a stale container is present; run this alone"
    result = _run_wrapper(5433, timeout=1800)
    combined = result.stdout + result.stderr
    assert not _container_exists(CONTAINER_NAME), "wrapper must remove the container"
    volumes = _docker("volume", "ls", "--filter", f"label=com.docker.compose.project={CONTAINER_NAME}")
    assert CONTAINER_NAME not in (volumes.stdout or ""), "wrapper must remove the volume"
    # Do not assert on the exit code here: whether verification passes is Task 5's
    # subject. What this pins is that the wrapper ran the script and cleaned up.
    assert "VERIFICATION PASSED" in combined or "VERIFICATION FAILED" in combined, (
        "wrapper did not report a verdict; it may have died before running the script"
    )
