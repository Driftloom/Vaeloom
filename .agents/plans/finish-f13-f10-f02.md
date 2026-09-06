# Finish F-13 / F-10 / F-02 — Plan (autoplan, SELECTIVE EXPANSION)

- Branch: `master` | Base: `origin/master` (GitHub Driftloom/Vaeloom)
- Date: 2026-09-06 | Mode: SELECTIVE EXPANSION | Reviewers: single (this session
  only)
- Source of truth: `docs/temporal/langgraph-gap-closure-2026-08-29.md` (L1
  updates through `d2aaf2a` intact on master)
- UI scope: NO. This work is backend only (OTel exporter, LLM credentials, graph
  topology). Design phase skipped with reason logged.
- DX scope: NO. No API/CLI/SDK surface changes; env/config plus internal graph
  topology only. DX phase skipped with reason logged.
- Dual voices: Codex and Claude-subagent voices are unavailable in this
  environment (no subagent runner, Codex CLI unverified). Reviews below are
  tagged `[single-reviewer]`. No consensus table is claimed where only one voice
  ran.

## 0. Intake: what I am working with

Close the last three gap-closure items to a high standard: F-13 (tracing
exporter live delivery), F-10 (real LLM reasoning), F-02 (native langgraph
`Send` fan-out). Prior L1 work (F-06 pgvector, ZT-01 fail-closed, F-01 durable
run, F-12 Redis quota) is committed and pushed through `d2aaf2a`.

Current system state (verified this session):

- `master` moved ahead since the L1 session: P0/P1 zero-trust tracks
  (`e93d81c`..`a141767`) plus eval/infra commits. Our L1 commits are ancestors
  of `master`. Nothing lost.
- One uncommitted file: `apps/api/src/api/routers/agents.py` (+35, workspace
  IDOR guard `_verify_workspace_access` on `/chat`). Not ours. Do not touch, do
  not stage, do not include in any commit.
- Docker daemon is DOWN. The L1 stack (postgres, redis, temporal, otelcol) must
  be restarted before any live verification.
- New commits that may interact with this plan: `684674b` (OTel plan span +
  workspace limiter in orchestrator), `57e3e18` (concurrency limiter), `98f0128`
  (approval HMAC + tsvector migration 0026). A regression step is included.
- `TODOS.md` does not exist. Deferred items live in the gap-closure doc
  (`Discovered blockers`, Stop/Block note).

## 1. Work items and acceptance criteria

### F-13 — tracing exporter live delivery (currently L1 partial)

- Goal: prove a span emitted by `setup_opentelemetry()` arrives at the
  collector, or record an honest partial with a recheck trigger.
- Accept: (a) span observed in collector logs via the debug exporter, then
  update the report to L1 closed; or (b) documented partial (collector up,
  exporter confirmed OTLP, host delivery unobservable) with recheck-on-Linux
  trigger.
- Ordered diagnostics: verify `curl.exe` works at all; POST OTLP/HTTP JSON to
  `:4318/v1/traces`; confirm receiver independently of the Python SDK; then
  retry the SDK emit; revert the temporary `loglevel: debug` + `debug` exporter
  afterwards.
- Optional expansion (in blast radius, trivial): one-line info log of the
  resolved OTLP endpoint in `setup_opentelemetry()` so a misconfigured endpoint
  is visible in prod logs.

### F-10 — real LLM reasoning (currently BLOCKED on creds)

- Goal: run the durable graph with a real model key if one is supplied;
  otherwise verify the mock path and keep the blocked status honest.
- Accept with key: `DurableAgentRunWorkflow` on `vaeloom-agent-q` with
  `LANGGRAPH_ENABLED=true` and a real `LLM_API_KEY` returns `completed` with
  model-generated content; worker log grepped for key leakage (expect none,
  `SECRET_KEYS` redaction already unified).
- Accept without key: mock-path verification (graph degrades gracefully, already
  seen in the F-01 run) plus report stays BLOCKED. The key travels by env only,
  never in chat logs beyond the user paste, never committed.
- Never: manufacture evidence with a fake key, echo the key into logs, or mark
  L1 on mock output.

### F-02 — native `Send` fan-out (currently code gap)

- Goal: implement bounded native `Send` fan-out in the graph supervisor so
  multi-agent branches run as framework-native parallel branches with reducer
  fan-in.
- Accept: `route_fanout` conditional edge returns `list[Send]` targeting the
  existing worker node; N clamped to 8 per §14 with a warn log on clamp; results
  collected through an `Annotated[..., add]` reducer; one failing branch does
  not lose the others; unit tests green; a 2-task durable run completes on
  `vaeloom-agent-q`; gap-closure doc updated.
- Non-goals: changing Temporal durability ownership (Temporal still owns
  durability; graph never becomes a second durable engine), dynamic unbounded N,
  touching the approval gate.

## 2. CEO review (SELECTIVE EXPANSION, [single-reviewer])

### Premises, named and evaluated

| #   | Premise                                                          | Verdict                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | OTLP delivery is provable on this Windows host                   | CHALLENGED. Evidence: TCP open on :4317/:4318, zero spans observed across gRPC and HTTP SDK emits. Plan diagnoses the receiver first and accepts a partial if the host is the limit.                                                                                                        |
| P2  | The user will supply an LLM key                                  | UNKNOWN. Plan carries both branches; default is mock-path plus documented blocked status.                                                                                                                                                                                                   |
| P3  | Native `Send` is required for correctness                        | CHALLENGED. The supervisor DAG already executes bounded fan-out durably. `Send` buys framework-native dynamic fan-out and removes hand-rolled branching. Six-month view: static supervisor calcifies as agents multiply; `Send` keeps topology data-driven. Recommend implementing bounded. |
| P4  | `temporal_enabled` / `langgraph_enabled` stay `False` by default | ACCEPT. Safe default stands; L1 always uses explicit opt-in.                                                                                                                                                                                                                                |
| P5  | `master` HEAD is compatible with the L1 changes                  | VERIFY. P0/P1 touched orchestrator OTel, concurrency limits, and migrations. A regression subset runs before any L1 claim.                                                                                                                                                                  |

### Existing-code leverage map

- F-13: `apps/api/src/api/infrastructure/opentelemetry.py` (real
  `OTLPSpanExporter` already), `infra/monitoring/otelcol-config.yaml`, prior
  probe scripts recreated under Temp (never committed).
- F-10: `temporal/activities.py::durable_agent_run` gating,
  `services/llm_service.py`, unified `SECRET_KEYS`, the F-01 start-workflow
  pattern (`vaeloom-agent-q`, correct queue name).
- F-02: `graph/__init__.py` (supervisor wiring), `graph/contracts.py`
  (parallel/sequential/mixed strategy, fan-out bound), `graph/nodes.py`
  (existing worker node to reuse as the `Send` target), `graph/state.py`
  (reducer key lives here), `temporal/queues.py` (`vaeloom-agent-q`, max_conc 8
  matches the §14 bound).

### Alternatives considered

- F-13: (a) container-side receiver probe then SDK retry; (b) accept partial
  now; (c) endpoint log line. Take (a) plus (c); (b) is the fallback, not the
  plan.
- F-10: (a) live key run; (b) mock-path plus documented blocked. Default (b)
  unless a key arrives in the gate.
- F-02: (a) bounded native `Send`; (b) document the gap only. Default (a); the
  user asked to complete the work.

### Scope decisions and NOT in scope

- In: infra restart, F-13 diagnostics, F-10 live-or-mock run, F-02 `Send` plus
  tests, report updates, conventional commits. Push only if the user asks (prior
  pattern).
- NOT in scope: J7 chaos and perf gates, the Alembic RLS 0010 `workspace_id` fix
  (flagged earlier, separate change), the `agents.py` WIP, Temporal Cloud,
  Grafana dashboards, procuring an LLM key, any frontend work.

### What already exists

Durable execution on real Temporal (F-01), real pgvector (F-06), fail-closed
Temporal client (ZT-01), Redis quota (F-12), secret-key unification (F-11),
connector `not_configured` states (F-08). This plan adds no new infrastructure
and no new durable engine.

### Dream-state delta

After this plan, every provable durable-path gate has L1 evidence; the only open
items need a credential (F-10) or a Linux host recheck (F-13). The twelve-month
ideal adds chaos/perf gates and `Send`-driven dynamic topologies; this plan lays
the `Send` foundation for the latter.

### Error and rescue registry

| Failure                    | Named signal                          | Rescue                                                                   |
| -------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| Collector receiver down    | connection refused on :4317/:4318     | `docker compose` status check, restart otelcol, re-run curl probe        |
| SDK export silently drops  | `force_flush` True but no span logged | debug exporter plus curl receiver probe isolates SDK vs receiver vs host |
| Invalid LLM key            | 401 from provider                     | fail fast, no retry storm, report stays blocked                          |
| Key leaks into logs        | key substring in worker log           | `SECRET_KEYS` redaction already unified; grep worker log after the run   |
| Branch raises (F-02)       | exception in one `Send` target        | per-branch containment, error recorded, fan-in still completes           |
| N > 8 (F-02)               | clamp path hit                        | clamp plus warn log, never unbounded                                     |
| Empty fan-out (F-02)       | zero `Send` objects                   | skip fan-out, go direct to fan-in                                        |
| Secrets in fan-out payload | `validate_no_secrets` ValueError      | fail closed before `start_workflow`, same as today                       |
| Stale container worker     | old image serves the queue            | stop container worker, run worker from source for L1 runs                |

### Failure modes registry

- Docker Desktop down blocks all L1 steps. Rescue: start Desktop, wait for
  daemon, `compose up` with `temporal` and `monitoring` profiles.
- Wrong task queue (`agent` vs `vaeloom-agent-q`) hangs a workflow with no
  worker. Rescue: always use `TASK_QUEUES` names; the F-02 L1 run targets
  `vaeloom-agent-q`.
- `DATABASE__URL` mixup (SQLite vs Postgres double-underscore var) silently
  changes the backend. Rescue: echo the resolved URL host before each L1 run.
- Approval gate untouched; no second durable engine introduced (graph stays
  topology-only).

### CEO completion summary

Three items, each with a primary path and an honest fallback. No scope expansion
beyond the optional one-line endpoint log. Two hard dependencies on the user
(LLM key for F-10 full close; gate choices for F-13 target and F-02 scope).
Premise challenges recorded above; nothing queued as a user challenge because
the plan already carries both branches for each unknown.

**Phase 1 complete.** Codex: unavailable. Claude subagent: unavailable.
Single-reviewer mode. Passing to Phase 3 (Eng is the required gate and runs
last; Phase 2 skipped, no UI scope; Phase 2.5 skipped, no developer-facing
scope).

## 3. Eng review ([single-reviewer], runs last)

### Step 0: scope challenge

1. Existing code per sub-problem: see leverage map. Nothing is built parallel to
   an existing flow; F-02 reuses the current worker node as the `Send` target.
2. Minimum changes: F-13 needs zero code changes (diagnostics plus optional log
   line); F-10 needs zero code (env plus run); F-02 touches about four files
   (`graph/__init__.py`, `graph/state.py`, tests, report) with one new edge
   function.
3. Complexity check: F-02 stays under the smell threshold (about 4 files, one
   new function, no new service or infra). Proceed, no reduction question.
4. Search check: ran. The documented best practice is `Send` from a conditional
   edge plus reducer-based fan-in with a bound (sources: LangGraph branching
   docs, 2026 fan-out guides, LangChain forum best-practice thread). Our §14
   bounds (fan-out ≤ 8, depth ≤ 5) stay in force. Rating: [Layer 1] (framework
   built-in).
5. TODOS cross-reference: `TODOS.md` absent. Deferred items live in the
   gap-closure doc; none block this plan. This plan creates one follow-up if
   F-13 stays partial (Linux recheck) and one if F-10 stays blocked (key
   procurement), both recorded in the report, not silently dropped.
6. Completeness: full version throughout (bound, failure isolation, reducer
   merge, unit plus L1 tests). No shortcut proposed.
7. Distribution: no new artifact type. N/A.

### Section 1: architecture

F-02 topology (only structural change in this plan):

```
START -> supervisor -> route_fanout --+-- Send(worker, task_1) --+--> fan_in -> finalize -> END
                                      +-- Send(worker, task_2) --+
                                      (0..8 Sends; clamp + warn above 8)
worker  = existing agent node, reused unchanged
fan_in  = reducer merge over Annotated[..., add] results key
shell   = DurableAgentRunWorkflow -> durable_agent_run activity -> graph.ainvoke (unchanged)
```

Coupling: the edge function reads the supervisor task list and returns `Send`
objects; it owns no LLM, DB, or connector calls. Temporal retry policy and the
120s activity timeout are unchanged. Cancellation propagates the same as today.

### Section 2: code quality

- One guard in the edge function (clamp plus empty-list bypass) beats guards in
  every caller.
- Reducer key must be list-typed with `add`; parallel writes to a scalar key
  would silently lose data (the documented footgun). The unit test pins list
  concat.
- ASCII diagram goes in a comment above `route_fanout` and stays maintained with
  the change.
- No new dependency. `Send` ships with the installed langgraph.

### Section 3: test review (never skipped)

Test diagram, codepath by codepath:

| Codepath                    | Test                                                                      | Exists?        |
| --------------------------- | ------------------------------------------------------------------------- | -------------- |
| `route_fanout` with 9 tasks | unit: 8 Sends plus warn log                                               | to write       |
| `route_fanout` with 0 tasks | unit: empty list, direct fan-in                                           | to write       |
| one branch raises           | unit: others recorded, fan-in completes                                   | to write       |
| reducer merge               | unit: order-independent list concat                                       | to write       |
| 2-task fan-out end to end   | L1 durable run on `vaeloom-agent-q` completes                             | to run         |
| F-13 receiver vs SDK        | curl probe plus SDK emit, debug exporter verdict                          | to run         |
| F-10 live or mock           | live run with key, or mock-path verification                              | to run         |
| regressions                 | fast subset: langgraph, executor/quota, temporal client, connector states | exists, to run |

Test plan (embedded; no separate artifact file): run new unit tests serially,
then the L1 durable run with Docker stack up, then the regression subset. Any
red test stops the line; fix forward, no scope cut to make it green.

### Section 4: performance

- Fan-out ≤ 8 matches `vaeloom-agent-q` max_conc 8. No queue starvation by
  construction.
- Activity budget unchanged (120s start-to-close, 30s heartbeat, 2 attempts).
- Parallel LLM calls trade latency for token cost; percent-gating
  (`LANGGRAPH_AGENT_RUN_PERCENT`) contains the blast radius. Note the tradeoff
  in the report; no new throttle needed for this change.

### Eng completion summary

Scope is minimal and fully mapped to existing code. The only structural change
(F-02 edge) follows the framework built-in pattern with bounds and tests.
Failure paths are named with rescues. Test coverage is specified per codepath,
not summarized away.

**Phase 3 complete.** Codex: unavailable. Claude subagent: unavailable.
Consensus: single-reviewer; no disagreements to surface. Passing to Phase 4
(Final Gate).

## 4. Execution steps (in order)

0. Start Docker Desktop, wait for daemon, `compose up` (postgres, redis,
   temporal DBs, temporal, otelcol, temporal-ui) with `temporal` and
   `monitoring` profiles. Stop the container temporal-worker if stale; run the
   worker from source for L1 runs.
1. F-13 diagnostics per Section 1; revert temporary collector config; record
   verdict (closed or partial with recheck trigger).
2. F-10: live run if the gate supplies a key, else mock-path verification; grep
   worker log for leakage either way.
3. F-02: implement, unit-test, L1-run, regression subset.
4. Update the gap-closure matrix; commit conventionally (never stage
   `agents.py`); push only if asked.
5. Leave the stack running or stop it per the user.

## 5. Decision audit trail

| #   | Phase | Decision                                    | Classification   | Principle | Rationale                                                           | Rejected                  |
| --- | ----- | ------------------------------------------- | ---------------- | --------- | ------------------------------------------------------------------- | ------------------------- |
| 1   | 0     | Mode SELECTIVE EXPANSION                    | mechanical       | P6        | Baseline is the three named items; expansions need opt-in           | expansion/reduction modes |
| 2   | 0     | Skip /office-hours                          | mechanical       | P3, P6    | Three precisely specified findings; a 10-min discovery adds nothing | running it                |
| 3   | 0     | Skip Design phase                           | mechanical       | scope     | No UI surface in this work                                          | running it                |
| 4   | 0     | Skip DX phase                               | mechanical       | scope     | No developer-facing surface change                                  | running it                |
| 5   | 0     | Single-reviewer, no dual voices             | environment fact | —         | No subagent runner or verified Codex CLI here                       | claiming consensus        |
| 6   | 1     | F-13 default: retry local proof first       | taste            | P1        | A cheap probe may still close it; fallback stays partial            | accept-partial-first      |
| 7   | 1     | F-10 default: mock-path plus blocked        | taste            | honesty   | No key in hand; never manufacture LLM evidence                      | marking L1 on mock        |
| 8   | 1     | F-02 default: implement bounded Send        | taste            | P1, P5    | User asked to complete it; bound keeps it explicit and safe         | document-only             |
| 9   | 3     | F-02 complexity: proceed, no reduction gate | mechanical       | threshold | About 4 files, one function, no new infra                           | scope-reduction stop      |

## 6. Gate outcome (filled after Phase 4)

User replied "proceed and complete that things". Recorded as D4=A (approve
as-is) with recommended defaults for the open choices: D1=A (retry local proof
first), D2=B (mock-path verification, no key supplied), D3=A (implement bounded
Send). No overrides, no revision, no reject.
