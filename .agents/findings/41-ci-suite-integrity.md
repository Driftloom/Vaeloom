# F-41 — API CI worker deaths are undiagnosable and the controller waits forever

**Severity:** P1 (CI reliability / diagnosability) **Area:**
`.github/workflows/ci-backend.yml`, `apps/api/tests/ci_integrity.py`,
`apps/api/conftest.py` **Found:** 2026-11-13 while investigating repeated
`API CI :: test` cancellations **Status: FIXED** — confirmed by run
`43409549651`: the core suite completed in 2185.64 s with no watchdog fire, no
exit 66, and no worker deaths. The stall was a process-global `asyncio.Lock`
poisoned by an abandoned detached task across pytest-asyncio's per-test loop
teardown; the lock is now scoped per event loop.

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
the next CI run will name the test and print its stack. That run happened
(`43400920642`); the hang it exposed is diagnosed and fixed in
[Second instrumented run](#second-instrumented-run--43400920642-the-hang-is-a-poisoned-lock).

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

## First instrumented CI run — `43391392028` (2026-11-13)

The instrumentation worked, and it changed the diagnosis from a guess to a
named test:

| Time     | Event                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------ |
| 08:15:13 | Core suite step starts (job cap 08:57:20)                                                              |
| 08:19:14 | `[gw0] node down: Not properly terminated` — 241 s after start, i.e. ~60 s collection + one 180 s timeout |
| 08:48:59 | progress at 99%                                                                                        |
| 08:52:16 | `[gw1] node down`; `replacing crashed worker gw1` → `gw3`                                              |
| 08:57:17 | watchdog fires after 301.5 s of silence; `last_started` = `tests/test_versions.py::TestVersions::test_document_versioning_and_restore`; active `['gw3']`; lost `gw0`, `gw1` |
| 08:57:22 | job hits `timeout-minutes: 45` → `The operation was canceled.`                                          |

The `last_started` test passes locally in 5.48 s, so it is environment-specific
or the worker is stuck outside the test body. `last_report` is
`test_orchestrator.py::TestStatePersistence::test_load_or_create_existing` — the
known loadscope crashitem artifact, not the executing test. The worker stack is
still required to distinguish "stuck inside the test" from "idle worker whose
scheduler never delivers more work".

Two operational defects in the first attempt, both fixed here:

1. **No artifact was uploaded.** `CI_INTEGRITY_DIR` was `.ci-integrity`, and
   `upload-artifact` skips hidden files by default. Every log written on the
   runner was discarded. The directory is now `ci-integrity/`.
2. **The watchdog fired 2 s before the job cap.** The 45-minute cap covers
   setup (~3 min) plus the suite (~37 min). 300 s of silence therefore landed at
   42 min into the step. The threshold is now 240 s, leaving ~60 s for exit 66
   and the artifact upload.

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
  the 240 s threshold. The threshold is capped by the job budget, not just the
  per-test timeout: setup consumes ~3 min of the 45-minute job cap, a normal
  suite run is ~35-37 min, and 300 s fired 2 s before cancellation on run
  `43391392028`. 240 s keeps 60 s above `--timeout` and leaves room to upload
  evidence before the cap.
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
- Added `--ci-watchdog-timeout=240` (above the 180 s per-test timeout and below
  the 45-minute job cap minus a normal suite run).
- Added `--junitxml` and a step-scoped `CI_INTEGRITY_DIR`; evidence is uploaded
  with `actions/upload-artifact@v7` under `if: always()`. The directory is
  `ci-integrity/`, not `.ci-integrity/`: `upload-artifact` skips hidden files by
  default, which is why run `43391392028` uploaded nothing.
- `--cov-fail-under=0` in the test step plus a separate
  `python -m coverage report --fail-under=80` step that only runs if the suite
  passed. A lost worker can no longer masquerade as a coverage failure.
- Installs Playwright Chromium. `test_latex_compiler_fallback` exercises the
  HTML→PDF fallback and failed every run with `PlaywrightUnavailableError`
  because API CI never installed the browser.

### 5. `.gitignore`

`ci-integrity/` — uploaded as an artifact, never committed.

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
5 passed in 86.28s

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

**A second race caught during validation:** a 2 s watchdog threshold fired
during collection (`phase=armed`, `last_started=null`) and named no test. That
is correct behavior — a hung import is a stall — but the banner read like
missing evidence. It now prints `last started : <none: no test started
(collection or worker startup)>`, and the guard test uses a 15 s threshold,
comfortably above the ~5 s startup+collection measured on Windows, so it still
asserts the named-test guarantee.

## Second instrumented run — `43400920642`: the hang is a poisoned lock

The instrumentation paid off immediately. The watchdog fired on its own terms
(the job was **not** cancelled), uploaded `api-ci-evidence`, and the worker
dumps named the in-flight tests.

| Worker | In-flight test when killed at 180 s | Fate |
| ------ | ----------------------------------- | ---- |
| `gw0` | `tests/test_orchestrator.py::TestRunAgentLoop::test_max_iterations_qa_failure_is_explicit` | node down, 241 s after start |
| `gw1` | `tests/test_product_closure_e2e.py::test_A_new_user_journey` | node down |
| `gw2` | `tests/test_orchestrator.py::TestStatePersistence::test_load_or_create_existing` | node down |

Three different tests in three workers. `test_document_version_model_invariants`
died on one worker but passed **64 ms later** on another. The victim is
whatever writes a checkpoint first after a shared resource is poisoned, not a
slow test.

`faulthandler` dumps in `worker-gw{0,1,2}.log` show the main thread in
`selectors.select` inside `pytest_asyncio`, with **no `/tests/` or `/src/api/`
frames**, and 7–11 idle `aiosqlite` worker threads. That is an async coroutine
awaiting something that never resolves — not CPU, not DB I/O. faulthandler
cannot see async stacks, so the wait object had to be found by source.

### Causal chain

1. `get_state_store()` is a **process-wide singleton**. With the default
   `VAELOOM_STATE_BACKEND=file`, that singleton is one `FileStateStore`.
2. `FileStateStore` cached **one** lazily-created `asyncio.Lock` on the
   instance (`state_store.py`, pre-fix `self._lock`), shared by every coroutine
   in every event loop in the worker.
3. `_eval_ok()` (`loop.py:4058`) schedules `_save_eval_phase(state)` as a
   detached task via `loop.create_task(...)` (`loop.py:4068`). That task calls
   `save_checkpoint` → `FileStateStore.save`, which acquires the singleton lock.
4. pytest-asyncio 0.26 tears down each test's loop with
   `shutdown_asyncgens()` + `loop.close()` in `_provide_event_loop`'s
   finalizer. It **does not cancel pending tasks**. `_BACKGROUND_TASKS` in
   `loop.py` is never drained either.
5. An abandoned `_save_eval_phase` task can therefore be frozen mid-lock when
   its loop closes. The lock stays `_locked=True` forever.
6. The next checkpoint save in that worker — in a later test, on a fresh loop —
   awaits the dead loop's lock. No timer is armed for that wait, so the new loop
   parks in `select` until `pytest-timeout` kills the worker at 180 s.

Confirmed with a minimal repro (`exp-ci-integrity/repro_state_lock.py`):

```text
loop1: lock acquired; locked = True
loop1 closed without release
loop2: HANG - save never completed (lock starved)
```

### Fix

`FileStateStore` now keeps a
`weakref.WeakKeyDictionary[event loop, asyncio.Lock]` and resolves the lock from
`asyncio.get_running_loop()`. A dead loop's abandoned lock becomes irrelevant:
the next save gets a fresh lock on its own loop and completes.

CAS semantics are preserved. The lock exists to serialize the
read-check-write window *within one loop* (all production writers for a request
in one process share that loop); cross-process races were always best-effort
for the file backend. Regression tests pin both halves:

```text
# post-fix
pytest tests/test_state_store_loop_safety.py -o addopts="" -q
4 passed in 2.32s

# same tests against HEAD's pre-fix state_store.py (temporarily swapped in)
3 failed, 1 passed in 12.43s   # TimeoutError on all cross-loop cases
```

Tests: `apps/api/tests/test_state_store_loop_safety.py`
(`test_lock_from_a_closed_loop_does_not_block_a_live_loop`,
`test_cas_survives_loop_rollover`,
`test_concurrent_writers_in_one_loop_stay_serialized`,
`test_save_checkpoint_after_poisoned_singleton`).

Neighbour suites and guard suite:

```text
pytest tests/test_state_durability.py tests/test_database_state_store.py \
       tests/test_state_store_loop_safety.py -o addopts="" -q
8 passed in 18.21s

pytest tests/test_ci_integrity_guard.py -o addopts="" -q
5 passed in 78.78s

ruff check apps/api/src/api/orchestrator/state_store.py \
           apps/api/tests/test_state_store_loop_safety.py
All checks passed!
```

### Residual (not required for this fix)

- **Abandoned tasks still exist.** The loop-scoped lock makes them harmless to
  checkpointing, but `_BACKGROUND_TASKS` is still never drained, so a task can
  outlive its loop and emit `Event loop is closed` from an aiosqlite worker
  thread. A test-harness drain would need to override pytest-asyncio's
  `event_loop` fixture; 0.26 deprecates that override, so it is deferred rather
  than added speculatively.
- **Per-test aiosqlite threads and the global engine pool** are separate
  lifecycle debt in `tests/conftest.py`/`api/database.py`. They explain the
  thread count and closed-loop warnings but not the hang.
- **Confirmation:** run `43409549651` met the gate: the suite completed, the
  watchdog did not fire, and `node_down` is empty. The remaining failures are
  the 3 fixed test bugs and the 4 pre-existing product gaps listed above.

## Third run — `43409549651`: acceptance gate passed

The fix was pushed as `e6eab694` and CI ran. The core suite **completed**:
`7 failed, 4980 passed, 81 skipped, 2 xfailed in 2185.64s (0:36:25)`. The job
failed on test results, not on a stall. `ci-integrity/run-integrity.json`:

```json
{
  "reason": "session-finished",
  "elapsed_seconds": 2185.7,
  "call_reports": 5015,
  "failed_reports": 7,
  "node_down": [],
  "exitstatus": 1,
  "complete": false
}
```

No exit 66, no `CONTROLLER-STALL.log`, no 240 s watchdog fire, no
`node down`, no 180 s worker kills. `complete: false` reflects the 7 test
failures only; the session ended normally.

### The 7 failures, classified

| Failure | Class | Cause | Disposition |
| ------- | ----- | ----- | ----------- |
| `test_orchestrator.py::TestStatePersistence::test_save_checkpoint_writes_file` | test bug | asserted on module-level `STATE_DIR`, captured at import, while the store resolves `VAELOOM_STATE_DIR` at call time | fixed: read `tmp_path` |
| `test_prompt_manager.py::TestPromptManager::test_fallback_to_base_for_unknown_agent` | test bug | process-global card registry can already contain `unknown_agent` from an earlier agent-loop test in the same worker | fixed: monkeypatch `card_registry.get_agent_card` |
| `tests/eval/test_ws_comprehensive.py::test_concurrency_10_and_25` | test bug | asserted `sum(successes) <= 10`, but released slots are re-acquired, so total successes legitimately exceed the limit (`assert 15 <= 10`) | fixed: assert peak in-flight instead |
| `test_mvp_scope.py::...test_canonical_agent_passes_scope_gate[conversation]` | pre-existing product gap | `conversation` is absent from the MVP scope roster but present in the canonical registry | not masked; follow-up |
| `test_mvp_scope.py::...test_canonical_roster_matches_int02` | pre-existing product gap | same roster drift (`conversation`) | not masked; follow-up |
| `test_idempotency.py::...test_replay_returns_stored_response` | pre-existing product gap | replay does not return the stored `true` response | not masked; follow-up |
| `test_idempotency.py::...test_same_key_different_payload_conflicts` | pre-existing product gap | returns `200` instead of `422` for a conflicting payload | not masked; follow-up |

The four product failures were present in the pre-branch baseline run
`42814603061`, so they are not regressions from this change. The three test
bugs are isolation/assertion defects exposed once the suite stopped dying.
After the fixes:

```text
pytest tests/test_orchestrator.py::TestStatePersistence::test_save_checkpoint_writes_file \
       tests/test_prompt_manager.py::TestPromptManager::test_fallback_to_base_for_unknown_agent \
       tests/eval/test_ws_comprehensive.py::test_concurrency_10_and_25 \
       -o addopts="" -q
3 passed in 3.74s
```

Residual noise: the job summary still shows `Event loop is closed` annotations
at suite end, emitted by aiosqlite worker threads from abandoned tasks. That is
the documented `_BACKGROUND_TASKS` debt below; it does not block completion and
no longer poisons checkpointing.

## Fourth run — `43416419730`: post-test-fix confirmation

Commit `d26a17b9` re-ran the suite after the three test-isolation fixes:

```text
4 failed, 4983 passed, 81 skipped, 2 xfailed, 2332 warnings in 1868.54s (0:31:08)
```

The failure count moved 7 → 4 and passes moved 4980 → 4983: exactly the three
fixed tests converted, with no new failures. The remaining four are the
pre-existing product gaps classified above. `ci-integrity/run-integrity.json`:

```json
{
  "reason": "session-finished",
  "phase": "running",
  "elapsed_seconds": 1868.6,
  "call_reports": 5015,
  "failed_reports": 4,
  "node_down": [],
  "exitstatus": 1,
  "complete": false
}
```

The job failed with exit code 1 (test results), not 66 (watchdog), and was not
cancelled. The suite finished 22 minutes inside the 45-minute job cap with the
240 s watchdog armed the whole time.

## Why this is not a symptom fix

It does not guess which test hangs. It removes every reason the previous logs
could not answer that question, bounds a stall to 240 s instead of 45 minutes,
and guarantees the next occurrence carries a nodeid and a stack. The instrumented
run then named the mechanism — a process-global lock surviving its event loop —
and the fix removes that mechanism instead of masking the symptom (the bug also
affects any embedder that calls `asyncio.run` per unit of work, not just tests).

## Residual / next actions

1. Keep the watchdog and artifact upload regardless of the fix: they are the
   observability layer for any future stall. Runs `43409549651` and
   `43416419730` are the reference for a healthy completion (`node_down: []`,
   `reason: session-finished`, no exit 66).
2. Drain `_BACKGROUND_TASKS` at shutdown (or bound `_save_eval_phase` with a
   timeout) so abandoned tasks stop producing `Event loop is closed` noise from
   aiosqlite threads. The per-loop lock already makes them harmless to
   checkpointing.
3. Four pre-existing product failures remain, reproduced in baseline
   `42814603061` and not masked here. Follow-up PRs were agreed with the user:
   - **MVP scope (2):** `test_mvp_scope.py` expects 11 canonical agents
     including `conversation` (updated in `29defcf9`), but
     `MVP_CANONICAL_AGENTS` in `orchestrator/router.py` still has 10. Result:
     greetings, ambiguous requests, and emotional containment are blocked as
     `out_of_scope` when `mvp_scope_enforced=True`. Fix is the roster plus its
     comment/out-of-scope message and the docs that say "10".
   - **Idempotency (2):** the middleware's `_store` opens a second transaction
     while the request transaction still holds the SQLite write lock; on CI it
     fails with `database is locked` after the 5 s busy timeout and correctly
     passes the response through with `Idempotency-Stored: false`. Replay is
     therefore not durable in the SQLite test backend (production Postgres is
     unaffected). Fix belongs in middleware transaction/backoff design or test
     DB serialization, with a regression test that asserts
     `Idempotency-Stored: true`.
4. Keep `--ci-watchdog-timeout` above `--timeout` plus restart overhead, and
   below the job cap minus a normal suite run. The current 240 s vs 180 s keeps
   60 s of headroom while still firing before cancellation.
