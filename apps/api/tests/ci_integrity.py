"""CI integrity guards for the API test suite.

Two holes in the xdist + pytest-timeout setup make a stuck run undiagnosable,
and this plugin closes both.

1. **A hung test leaves no evidence.** ``pytest-timeout``'s ``thread`` method
   ends the worker with ``os._exit(1)``. Under xdist the worker's terminal
   writes travel through an execnet channel, so the ``+++ Timeout +++`` banner
   and the thread stack dump are discarded before the process dies. CI sees
   only ``[gwN] node down: Not properly terminated``: no test name, no stack.
   :class:`_WorkerForensics` arms ``faulthandler`` against a *file descriptor*
   a few seconds before pytest-timeout would fire, so the dump survives the
   ``os._exit``. ``faulthandler.enable`` on the same descriptor also catches
   native crashes (SIGSEGV/SIGABRT) that would otherwise be silent.

2. **The controller can wait forever.** ``dsession.loop_once`` blocks on worker
   events with no liveness deadline. A worker that is alive but no longer
   reporting keeps ``_active_nodes`` non-empty, so the loop never terminates
   and only the workflow's ``timeout-minutes`` ends the job. That is where the
   45-minute "cancelled" runs come from.
   :class:`_ControllerWatchdog` bounds the silence to
   ``--ci-watchdog-timeout`` seconds and writes the controller stacks, the
   in-flight nodeid, and the scheduler state before exiting with
   :data:`WATCHDOG_EXIT_CODE`.

Both guards are opt-in so local runs stay silent and fast:

* ``CI_INTEGRITY_DIR`` enables the per-worker hang dumps and the controller
  timeline (CI sets it to a directory that is uploaded as an artifact).
* ``--ci-watchdog-timeout=SECONDS`` enables the controller watchdog (CI passes
  ``240``). ``0`` disables it, which is the default.

Exit code 66 means "the controller watchdog fired". pytest owns 0-4, so 66
cannot be confused with a test failure, an interrupt, an internal error, or a
usage error.
"""

from __future__ import annotations

import faulthandler
import json
import os
import threading
import time
from pathlib import Path
from typing import Any

import pytest

#: Distinct from pytest's own 0-4 so CI logs cannot read a stall as a failure.
WATCHDOG_EXIT_CODE = 66

#: Set to a directory to enable the worker dumps and the controller timeline.
ARTIFACT_DIR_ENV = "CI_INTEGRITY_DIR"

DEFAULT_WATCHDOG_SECONDS = 0.0
WATCHDOG_POLL_SECONDS = 2.0

#: Dump this long before pytest-timeout would kill the worker, so the write
#: wins the race against ``os._exit``.
DUMP_LEAD_SECONDS = 10.0


# --------------------------------------------------------------------------- #
# configuration helpers
# --------------------------------------------------------------------------- #


def _artifact_dir() -> Path | None:
    """Return the artifact directory, or ``None`` when the guard is disabled."""
    raw = os.environ.get(ARTIFACT_DIR_ENV)
    if not raw:
        return None
    directory = Path(raw)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _is_xdist_worker(config: pytest.Config) -> bool:
    return hasattr(config, "workerinput")


def _worker_id(config: pytest.Config) -> str:
    workerinput = getattr(config, "workerinput", None) or {}
    return str(workerinput.get("workerid", "gw?"))


def _hang_dump_deadline(config: pytest.Config) -> float | None:
    """Seconds after a test starts at which to dump its stacks.

    Derived from pytest-timeout's ``--timeout`` so the dump lands just before
    the worker is killed. Returns ``None`` when no timeout is configured, in
    which case only the START/END timeline is written.
    """
    raw = getattr(config.option, "timeout", None)
    try:
        timeout = float(raw) if raw is not None else 0.0
    except (TypeError, ValueError):
        return None
    if timeout <= 0:
        return None
    return max(1.0, timeout - DUMP_LEAD_SECONDS)


# --------------------------------------------------------------------------- #
# worker side: hang forensics
# --------------------------------------------------------------------------- #


class _WorkerForensics:
    """Per-worker timeline plus a stack dump that survives ``os._exit``."""

    def __init__(self, config: pytest.Config, directory: Path) -> None:
        self.nodeid: str | None = None
        self.deadline = _hang_dump_deadline(config)
        self.path = directory / f"worker-{_worker_id(config)}.log"
        # buffering=1 keeps the START line on disk before the test blocks; the
        # faulthandler dump bypasses this buffer entirely and writes to the fd.
        self._stream = self.path.open("a", encoding="utf-8", buffering=1)
        faulthandler.enable(file=self._stream, all_threads=True)
        self._write(
            f"WORKER {_worker_id(config)} pid={os.getpid()} "
            f"hang_dump_after={self.deadline}s"
        )

    def _write(self, line: str) -> None:
        self._stream.write(line + "\n")
        self._stream.flush()

    def before(self, item: pytest.Item) -> None:
        self.nodeid = item.nodeid
        self._write(f"START {time.time():.3f} {item.nodeid}")
        if self.deadline is not None:
            # A previous timer can only survive if a test ended abnormally, but
            # arming twice is an error in faulthandler, so cancel defensively.
            faulthandler.cancel_dump_traceback_later()
            faulthandler.dump_traceback_later(
                self.deadline,
                file=self._stream,
                exit=False,
            )

    def after(self, item: pytest.Item) -> None:
        if self.deadline is not None:
            faulthandler.cancel_dump_traceback_later()
        self._write(f"END   {time.time():.3f} {item.nodeid}")
        self.nodeid = None

    def flush(self) -> None:
        """Flush without closing.

        The descriptor is deliberately left open: xdist runs worker teardown
        (where coverage is saved) after ``pytest_sessionfinish``, and a crash
        there is exactly the kind of event this file exists to capture.
        """
        try:
            self._stream.flush()
        except ValueError:
            pass


# --------------------------------------------------------------------------- #
# controller side: liveness watchdog
# --------------------------------------------------------------------------- #


class _ControllerState:
    """Mutable state shared between the pytest hooks and the watchdog thread."""

    def __init__(self, directory: Path | None) -> None:
        self.directory = directory
        self._lock = threading.Lock()
        self._timeline: Any = None
        self.started_at = time.monotonic()
        self.last_activity = self.started_at
        self.phase = "startup"
        self.armed = False
        self.last_started: str | None = None
        self.last_report: str | None = None
        self.call_reports = 0
        self.failed_reports = 0
        self.node_down: list[dict[str, Any]] = []

    # -- mutation ---------------------------------------------------------- #

    def touch(self, phase: str) -> None:
        with self._lock:
            self.last_activity = time.monotonic()
            self.phase = phase

    def arm(self) -> None:
        """Start counting silence at session start.

        Collection is deliberately inside the budget: a hung import or a worker
        that never finishes collecting is a real stall, and CI collection is
        ~70 s against a 240 s threshold, so normal collection has ample room.
        ``pytest_collection_finish`` cannot be used to arm this under xdist --
        the controller never calls it (only ``looponfail`` does).
        """
        with self._lock:
            self.last_activity = time.monotonic()
            self.phase = "armed"
            self.armed = True

    def record_start(self, nodeid: str) -> None:
        with self._lock:
            self.last_started = nodeid
            self.last_activity = time.monotonic()
            self.phase = "running"
        self._write(f"START {time.time():.3f} {nodeid}")

    def record_report(self, report: pytest.TestReport) -> None:
        with self._lock:
            if report.when == "call":
                self.call_reports += 1
                if report.failed:
                    self.failed_reports += 1
            self.last_report = report.nodeid
            self.last_activity = time.monotonic()
            self.phase = "running"
        # setup/call/teardown each emit a report; one line per test is enough.
        # Failures in any phase still get a line, because that is the evidence.
        if report.when == "call" or report.failed:
            self._write(f"{report.outcome.upper():7} {time.time():.3f} {report.nodeid}")

    def record_node_down(self, worker: str, error: object) -> None:
        with self._lock:
            self.node_down.append({"worker": worker, "error": str(error)})
            self.last_activity = time.monotonic()
            self.phase = "node-down"
        self._write(f"NODE-DOWN {time.time():.3f} {worker} error={error}")

    def snapshot(self, idle: float) -> dict[str, Any]:
        with self._lock:
            return {
                "reason": "controller-stall",
                "phase": self.phase,
                "idle_seconds": round(idle, 1),
                "elapsed_seconds": round(time.monotonic() - self.started_at, 1),
                "last_started": self.last_started,
                "last_report": self.last_report,
                "call_reports": self.call_reports,
                "failed_reports": self.failed_reports,
                "node_down": list(self.node_down),
            }

    # -- timeline ---------------------------------------------------------- #

    def _write(self, line: str) -> None:
        if self.directory is None:
            return
        try:
            if self._timeline is None:
                self._timeline = (self.directory / "controller.log").open(
                    "a", encoding="utf-8", buffering=1
                )
            self._timeline.write(line + "\n")
            self._timeline.flush()
        except OSError:
            # Diagnostics must never be able to fail the suite.
            self._timeline = None


class _ControllerWatchdog(threading.Thread):
    """Fails the run when the controller stops hearing from its workers."""

    def __init__(
        self,
        config: pytest.Config,
        state: _ControllerState,
        stall_seconds: float,
    ) -> None:
        super().__init__(name="ci-integrity-watchdog", daemon=True)
        self._config = config
        self._state = state
        self._stall_seconds = stall_seconds
        # Not ``_stop``: threading.Thread uses that name for its own lifecycle
        # method and shadowing it breaks join()/is_alive().
        self._stop_event = threading.Event()

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        while not self._stop_event.wait(WATCHDOG_POLL_SECONDS):
            if not self._state.armed:
                continue
            idle = time.monotonic() - self._state.last_activity
            if idle >= self._stall_seconds:
                self._fire(idle)
                return

    # -- failure path ------------------------------------------------------ #

    def _xdist_state(self) -> dict[str, Any]:
        """Best-effort view of the xdist scheduler; never raises."""
        view: dict[str, Any] = {"active_workers": [], "pending_units": None}
        try:
            dsession = self._config.pluginmanager.getplugin("dsession")
            if dsession is None:
                return view
            view["active_workers"] = sorted(
                str(node.gateway.id)
                for node in getattr(dsession, "_active_nodes", ())
                if getattr(node, "gateway", None) is not None
            )
            scheduler = getattr(dsession, "sched", None)
            workqueue = getattr(scheduler, "workqueue", None)
            if workqueue is not None:
                view["pending_units"] = len(workqueue)
        except Exception as exc:  # pragma: no cover - diagnostics only
            view["error"] = repr(exc)
        return view

    def _fire(self, idle: float) -> None:
        report = self._state.snapshot(idle)
        report.update(self._xdist_state())
        report["stall_threshold_seconds"] = self._stall_seconds

        # A stall before the first logstart is a collection / worker-startup
        # stall. Say that outright: "last started : None" reads like missing
        # evidence when it is actually the diagnosis.
        last_started = report["last_started"] or (
            "<none: no test started (collection or worker startup)>"
        )
        last_report = report["last_report"] or "<none>"

        lines = [
            "=" * 78,
            "CI INTEGRITY: the test controller stopped making progress.",
            f"  no activity for {idle:.1f}s (threshold {self._stall_seconds:.0f}s)",
            f"  phase={report['phase']} elapsed={report['elapsed_seconds']}s",
            f"  last started : {last_started}",
            f"  last report  : {last_report}",
            f"  active workers: {report['active_workers']}",
            f"  workers lost  : {report['node_down']}",
            "  This is the condition that used to burn the workflow's 45-minute",
            "  timeout-minutes and report the job as 'cancelled'.",
            "=" * 78,
        ]
        banner = "\n".join(lines)

        if self._state.directory is not None:
            dump_path = self._state.directory / "CONTROLLER-STALL.log"
            try:
                with dump_path.open("w", encoding="utf-8") as handle:
                    handle.write(banner + "\n\n")
                    handle.write(json.dumps(report, indent=2) + "\n\n")
                    faulthandler.dump_traceback(file=handle, all_threads=True)
                    handle.flush()
                banner += f"\n  full dump: {dump_path}"
            except OSError as exc:
                banner += f"\n  (could not write dump: {exc!r})"

        # Broadcast to the real process stderr. pytest's global fd capture has
        # fd 2 dup2'd onto a temp file at this point, so a plain print() would
        # be discarded when os._exit skips sessionfinish. Suspending capture
        # restores the original descriptor; the process is about to die, so it
        # is never resumed.
        _suspend_capture(self._config)
        try:
            os.write(2, (banner + "\n").encode("utf-8", "replace"))
        except OSError:
            pass
        os._exit(WATCHDOG_EXIT_CODE)


def _suspend_capture(config: pytest.Config) -> None:
    """Restore the real stdout/stderr fds, best effort."""
    try:
        capture = config.pluginmanager.getplugin("capturemanager")
        if capture is not None:
            capture.suspend_global_capture(in_=True)
    except Exception:  # pragma: no cover - diagnostics must never fail
        pass


# --------------------------------------------------------------------------- #
# plugin hooks
# --------------------------------------------------------------------------- #

#: Controller-side state. Hooks such as ``pytest_runtest_logstart`` do not
#: receive the config object, so it is published here by ``pytest_configure``.
#: In a worker process this stays ``None``.
_STATE: _ControllerState | None = None


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("ci-integrity")
    group.addoption(
        "--ci-watchdog-timeout",
        action="store",
        type=float,
        default=DEFAULT_WATCHDOG_SECONDS,
        metavar="SECONDS",
        help=(
            "Exit with code 66 when the controller sees no test activity for "
            "this many seconds. 0 disables the watchdog (default). CI passes "
            "240 so a stalled suite fails in minutes with a stack dump instead "
            "of being cancelled by timeout-minutes."
        ),
    )


def pytest_configure(config: pytest.Config) -> None:
    directory = _artifact_dir()

    if _is_xdist_worker(config):
        if directory is not None:
            config._ci_integrity_worker = _WorkerForensics(config, directory)  # type: ignore[attr-defined]
        return

    stall = float(getattr(config.option, "ci_watchdog_timeout", 0.0) or 0.0)
    if stall <= 0:
        return

    state = _ControllerState(directory)
    watchdog = _ControllerWatchdog(config, state, stall)
    config._ci_integrity_state = state  # type: ignore[attr-defined]
    config._ci_integrity_watchdog = watchdog  # type: ignore[attr-defined]
    globals()["_STATE"] = state
    watchdog.start()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_protocol(
    item: pytest.Item, nextitem: pytest.Item | None
) -> Any:
    worker = getattr(item.config, "_ci_integrity_worker", None)
    if worker is None:
        yield
        return
    worker.before(item)
    try:
        yield
    finally:
        worker.after(item)


def pytest_sessionstart(session: pytest.Session) -> None:
    # Must be sessionstart, not collection_finish: the xdist controller never
    # calls pytest_collection_finish, so arming there left the watchdog
    # disabled in exactly the -n 2 configuration CI uses.
    state = getattr(session.config, "_ci_integrity_state", None)
    if state is not None:
        state.arm()


def pytest_runtest_logstart(nodeid: str, location: tuple[str, int | None, str]) -> None:
    if _STATE is not None:
        _STATE.record_start(nodeid)


def pytest_runtest_logreport(report: pytest.TestReport) -> None:
    if _STATE is not None:
        _STATE.record_report(report)


@pytest.hookimpl(optionalhook=True)
def pytest_testnodedown(node: Any, error: object) -> None:
    # xdist also fires this for a clean worker shutdown with error=None, so
    # only a real error belongs in the crash list.
    if _STATE is None or error is None:
        return
    gateway = getattr(node, "gateway", None)
    _STATE.record_node_down(str(getattr(gateway, "id", gateway)), error)


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    watchdog = getattr(session.config, "_ci_integrity_watchdog", None)
    if watchdog is not None:
        watchdog.stop()

    worker = getattr(session.config, "_ci_integrity_worker", None)
    if worker is not None:
        worker.flush()

    state = getattr(session.config, "_ci_integrity_state", None)
    if state is None or state.directory is None:
        return

    payload = state.snapshot(0.0)
    payload["reason"] = "session-finished"
    payload["exitstatus"] = exitstatus
    payload["complete"] = exitstatus == 0
    (state.directory / "run-integrity.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )
