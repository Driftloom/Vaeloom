# F-41 — API CI worker deaths are undiagnosable and the controller waits forever

**Severity:** P1 (CI reliability / diagnosability) **Area:**
`.github/workflows/ci-backend.yml`, `apps/api/tests/ci_integrity.py`,
`apps/api/conftest.py` **Found:** 2026-11-13 while investigating repeated
`API CI :: test` cancellations **Status: IN PROGRESS** — the failure is now
bounded and self-diagnosing; the test that stalls is named by the first
instrumented run.

## Summary

The `test` job did not fail; it was cancelled at `timeout-minutes: 45`. Three
runs showed the same shape: the first worker died **243–255 s** after the test
step began, further workers died over the next 30+ minutes, and the job was
cancelled. The logs contained no test name and no stack for any death, so every
previous explanation was a guess.

Root-cause chain, in causal order:

1. **At least one test blocks for more than 180 s in CI.** It is
   environment-specific: the two largest work units finish locally in 4.4 s and
   6.7 s (9.4 s with CI's env).
2. **pytest-timeout removes the evidence.** `--timeout-method=thread` ends the
   worker with `os._exit(1)` (`pytest_timeout.py:505-542`). Under xdist the
   worker's terminal writes travel over an execnet channel, so the
   `+++ Timeout +++` banner and thread stack are discarded before the controller
   can read them. The controller prints only
   `[gwN] node down: Not properly terminated` (`xdist/workermanage.py:403-410`).
3. **`-q` hid the restart machinery.** xdist gates `report_line()` on
   `config.option.verbose >= 0` (`xdist/dsession.py:78-80`). `-q` sets
   `verbose = -1`, so `replacing crashed worker` and
   `maximum crashed workers reached` never printed. The existence of `gw2`/`gw3`
   in the logs proves restarts did happen, invisibly.
4. **The controller has no liveness deadline.** `dsession.loop_once()` blocks on
   the worker event queue with a 2 s poll and no overall deadline
   (`dsession.py:146-157`). When a worker is stuck below the Python layer,
   `triggershutdown()` cannot complete, the loop keeps spinning, and only the
   workflow's 45-minute cap ends the job.
5. **A dead worker corrupted the coverage signal.** pytest-cov drops a worker
   that never calls `pytest_sessionfinish`. In run `42814603061` the suite
   actually finished with `10 failed, 4945 passed, 2204.03s`, but coverage
   reported `25.11%` and the job ended on
   `FAIL Required test coverage of 80.0% not reached` — a coverage message
   masking five worker crashes.

Steps 2–5 are fixed in this change. Step 1 is deliberately **not** guessed at:
the next CI run will name the test and print its stack.

## Evidence

| Run                        | Step start | First `node down` | Delta  | Outcome                    |
| -------------------------- | ---------- | ----------------- | ------ | -------------------------- |
| job `131406272055`         | 18:43:14.8 | 18:47:29.2        | 254.4s | cancelled at 45m           |
| job `131406430105`         | —          | 18:47:35.3        | 243s   | cancelled at 45m           |
| run `42814603061`          | 12:53:00.7 | 12:57:11.8        | 251.2s | finished in 2204s, 10 fail |

The stable ~4-minute first death is consistent with collection (~70 s) plus one
180 s timeout. It is not consistent with OOM (which would be scattered) or a
single slow file (which would not kill four workers).

**Proof that a fired timeout is invisible under xdist** (local, synthetic
`time.sleep(60)`):

```text
$ pytest test_hang.py -n 1 --timeout=2 --timeout-method=thread -q
[gw0] node down: Not properly terminated
worker 'gw0' crashed while running 'test_hang.py::test_hangs_forever'
```

No banner, no stack. The timeout did fire; `os._exit` destroyed the output.

**Why crashitem names cannot be trusted.** `loadscope.remove_node()` reports the
first not-completed nodeid in the crashed worker's work unit
(`xdist/scheduler/loadscope.py:185-205`), not necessarily the item that was
executing. In run `42814603061` only one progress character had been flushed
before `[gw0] node down`, yet the reported crashitem was
`TestStatePersistence::test_load_or_create_existing`, deep inside a 67-test
file. Separately, `--loadscope-reorder` defaults to `True`, so work units are
scheduled by descending test count, not alphabetically — the first worker gets
the largest file, not the first file collected.

**Why progress dot counts cannot be trusted.** stdout is a pipe, so pytest's
terminal writer block-buffers; the visible dots are only the flushed prefix.
The "1 dot" observation above is therefore not a test count.

**Local repro attempts (all clean):**

| Candidate                                    | Command                                                 | Result          |
| -------------------------------------------- | ------------------------------------------------------- | --------------- |
| `tests/agents/test_document_agent.py`         | `-n 2 --dist loadfile --timeout=30`                     | 10 passed, 4.39s |
| `tests/test_agent_handlers_extended.py`       | `-n 1 --dist loadfile --timeout=30`                     | 157 passed, 6.71s |
| same, with CI env (`CI=true`, no LLM/OTel vars) | `-n 1 --dist loadfile --timeout=30`                   | 157 passed, 9.43s |

Windows Defender I/O makes a local full-suite run a poor proxy for a Linux
runner, so the hang must be identified from CI evidence.

## Fix

### 1. Worker forensics — `apps/api/tests/ci_integrity.py`

- Writes `START`/`END` per test to `worker-<id>.log`.
- Arms `faulthandler.dump_traceback_later(timeout - 10 s, file=<fd>)` when each
  test starts. The dump goes to a **file descriptor**, which survives
  `os._exit`; it names the in-flight test and prints every thread's stack.
- Calls `faulthandler.enable(file=<same fd>)` so native crashes
  (SIGSEGV/SIGABRT) also leave a stack.
- Cancels the timer when a test ends normally.

### 2. Controller watchdog — same plugin

- `--ci-watchdog-timeout=SECONDS` (default `0`, disabled).
- Armed at `pytest_sessionstart`; any logstart/logreport/node-down refreshes the
  activity clock. Arming must not use `pytest_collection_finish`: the xdist
  controller never calls that hook (only `looponfail` does), which silently
  disabled the watchdog under the `-n 2` configuration CI uses. Session start
  also bounds a hung collection, and CI collection (~70 s) has ample room under
  the 300 s threshold.
- On silence, writes `CONTROLLER-STALL.log` (banner, JSON state, all-thread
  stacks) and exits with **66** — distinct from pytest's 0–4, so a stall can
  never be read as a test failure, interrupt, internal error, or usage error.
- Reports the last nodeid the controller saw start, the last report, call
  counts, active workers, and pending work units.

### 3. Registration — `apps/api/conftest.py`

`pytest_plugins = ["tests.ci_integrity"]` in the rootdir conftest, because xdist
workers configure plugins before collecting `tests/conftest.py`.

### 4. Workflow — `.github/workflows/ci-backend.yml`

- Dropped `-q`; added `PYTHONUNBUFFERED=1` and `PYTHONFAULTHANDLER=1`.
- Added `--ci-watchdog-timeout=300` (above the 180 s per-test timeout).
- Added `--junitxml` and a step-scoped `CI_INTEGRITY_DIR`; evidence is uploaded
  with `actions/upload-artifact@v7` under `if: always()`.
- `--cov-fail-under=0` in the test step plus a separate
  `python -m coverage report --fail-under=80` step that only runs if the suite
  passed. A lost worker can no longer masquerade as a coverage failure.
- Installs Playwright Chromium. `test_latex_compiler_fallback` exercises the
  HTML→PDF fallback and failed every run with `PlaywrightUnavailableError`
  because API CI never installed the browser.

### 5. `.gitignore`

`.ci-integrity/` — uploaded as an artifact, never committed.

## Verification

```text
# worker dump survives the timeout kill
worker-gw0.log:
  WORKER gw0 pid=... hang_dump_after=1.0s
  START ... test_integrity_synthetic.py::test_hangs_forever
  Timeout (0:00:01)!
  Thread 0x...:
    File ".../test_integrity_synthetic.py", line 5 in test_hangs_forever
    ...

# controller watchdog (serial and xdist; CI runs xdist)
EXIT=66
CI INTEGRITY: the test controller stopped making progress.
  no activity for 6.5s (threshold 5s)
  last started : ...::test_hangs_forever
  active workers: ['gw0']
...
CONTROLLER-STALL.log written with stacks and JSON state

# guard suite
pytest tests/test_ci_integrity_guard.py -o addopts="" -q
5 passed in 45.23s

# scoped end-to-end run through the real root conftest
pytest tests/agents/test_document_agent.py -o addopts="-n 2 --dist loadfile" \
  --timeout=30 --ci-watchdog-timeout=60
10 passed in 3.85s
run-integrity.json: {"exitstatus": 0, "complete": true, "node_down": []}

ruff check apps/api/tests/ci_integrity.py apps/api/tests/test_ci_integrity_guard.py apps/api/conftest.py
All checks passed!
```

**Regression caught during validation:** with arming on
`pytest_collection_finish`, an xdist run held a worker in a 60 s sleep and the
watchdog stayed silent; only `pytest-timeout` ended it. Moving the arm to
`pytest_sessionstart` produced the exit-66 run above. The guard suite now
parameterizes the watchdog case over serial and xdist so this cannot regress
unnoticed.

## Why this is not a symptom fix

It does not guess which test hangs. It removes every reason the previous logs
could not answer that question, bounds a stall to 300 s instead of 45 minutes,
and guarantees the next occurrence carries a nodeid and a stack. The hang fix is
a separate, evidence-gated change.

## Residual / next actions

1. Merge this instrumentation, then download `api-ci-evidence` from the first
   run. The hanger is the last `START` without a matching `END` in
   `worker-gwN.log`; its stack is directly below it.
2. If the watchdog fires instead, `CONTROLLER-STALL.log` names
   `last_started` and the surviving workers.
3. Fix the named hang and re-run; keep the watchdog and the artifact upload.
4. Pre-existing failures observed in run `42814603061`, unrelated to the
   crashes: `test_mvp_scope.py` (2), `test_idempotency.py` (2), and
   `test_overleaf_integration.py::test_latex_compiler_fallback` (fixed here by
   installing Chromium).
5. Keep `--ci-watchdog-timeout` above `--timeout` plus restart overhead. The
   current 300 s vs 180 s leaves 120 s of headroom.
