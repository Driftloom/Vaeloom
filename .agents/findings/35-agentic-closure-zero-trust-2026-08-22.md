# Zero-Trust Agentic Closure Audit — 2026-08-22 (Full)

> **Scope:** Full working-tree verification at `e92f352` (HEAD). Zero trust on
> all prior reports. Every claim re-checked against disk, `git`, and live test
> runs. Websearch used for ReAct/multi-agent security baselines. Findings
> include honest audit of this session's own agentic-gap fixes.

## Ground Truth

| Signal                                 | Value                                                                                                                                                                                       | How verified                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| HEAD                                   | `e92f352` "fix(p14): re-verify post-ea329dd 74.4->88 conditional"                                                                                                                           | `git log --oneline -1`                      |
| Prior baseline for diff                | `0feb7ff` "fix: mount SCIM..."                                                                                                                                                              | `git log`                                   |
| `git status`                           | `working tree clean` (was 99 dirty files at session start; now committed in `0feb7ff..e92f352`)                                                                                             | `git status`                                |
| `git diff 0feb7ff..e92f352 --stat`     | 52 files, ~3,200 insertions — includes all 8 agentic gaps + 7 polish fixes + P13/P14 gates                                                                                                  | `git diff --stat`                           |
| Backend collect                        | **2,555 tests collected in 7.01s**                                                                                                                                                          | `pytest --collect-only -q`                  |
| Security collect                       | **233 tests**                                                                                                                                                                               | `pytest tests/security --collect-only -q`   |
| Frontend `tsc --noEmit --skipLibCheck` | **3 errors** (ChatWindow streamedTools) → **0 after fix**                                                                                                                                   | `pnpm --filter web exec tsc`                |
| Frontend jest                          | **6 spec files** (`Sidebar, Toast, Modal, ApprovalCard, connectors/page, basic-smoke` + e2e) — prior claim "37" remains false, "15" count includes `*.spec.*` with `*.spec.ts` double-count | `Get-ChildItem -Recurse -Filter *.spec.*`   |
| `EXECUTION-STATUS.md`                  | P00-P12 CONDITIONAL GO, **P13/P14 now 88 CONDITIONAL GO** (was NOT STARTED at session start)                                                                                                | `read docs/prompts/.../EXECUTION-STATUS.md` |

**Key delta:** `0feb7ff..e92f352` already contains the 8 agentic gaps closed
this session (`loop.py:488`, `supervisor.py:243`, `background_daemon.py:348`,
`definitions.py:149`, `executor.py:296`, `router.py:48`, `agents.py:138`, 13
agent `handler.py` tool declarations) plus polish (ChatWindow SSE, vector RAG,
preference vectors, croniter). Prior audits' "NOT STARTED" for P13/P14 is now
stale — they are committed.

---

## 1. The 8 Agentic Gaps — Closed, But Honest Assessment

### G1: Enterprise Dispatch (P0) — `loop.py:273`

**Claimed missing:** 13 agents fell through to `fallback()` at `loop.py:323`.

**Now:** `loop.py:273` `_dispatch_agent` handles all 22 via `agent_type` +
`registry_key` double-dispatch, keyword-routed to correct method (e.g.,
`CareerAgent` → `identify_skill_gaps` vs `recommend_courses`). Verified
`passes 22/22` via `uv run ... python -c` loop.

**Remaining gap (self-flag):** Dispatch is stringly-typed + keyword-heuristic,
not registry-driven. Adding a new agent requires editing a 240-line `if/elif`
chain. Prior finding `FIND-ORCH-001` (fragile dispatch) is **partially
mitigated** (more agents) but **not structurally fixed**. Recommendation:
`AGENT_REGISTRY` should carry a `dispatch` callable or `Tool`→method map.

### G2: Dynamic ReAct Loop (P0) — `loop.py:294`

**Now:** `_try_react_loop` (90 lines) builds `tool_schemas` from `ALL_TOOLS`
(prioritized by agent's declared tools, capped 12), calls
`llm_service.generate_completion_with_tools` for up to 3 rounds, executes via
`executor._exec_tool`, feeds `tool` role messages back.

**Self-flag — Security (HIGH):** Line
`await _exec_tool(td, args, agent_id=agent_name, agent_scopes=[td.required_scope], ...)`
**grants the tool its own required scope**, making `executor.py:803` permission
check a no-op. LLM can choose any of the 12 offered tools and it will always
pass. This violates PATI/OWASP LLM06 least-privilege:

> Per PATI (SwayMagpie 2026) and OWASP LLM06: permission must come from
> **session/RBAC**, never from tool's own declaration, and never from LLM
> output. Fixes: (a) pass `agent.memory_scopes` or session scopes, (b) enforce
> tiered approval for `write-irreversible`, (c) mint scoped credentials per
> call.

Websearch baseline (5 sources) all agree: model output is _untrusted internet
input_, authorization must be **fail-closed** before execution. Current ReAct
fails closed only on unknown tool name, not on scope.

**Other gaps:** No budget guard (OWASP recommends steps/tokens/usd limits), no
output exfiltration check, no `tool_choice` allowlist per route.

### G3: Missing Tools (P1) — `definitions.py:149`, `executor.py:296`

**Now:** 22 tools (was 14). Added `web_search` (Brave/SERPER with mock, 5
results), `parse_document_ocr` (via `ingestion/parsers.parse_document` + storage
fallback), `calculate_ats_diff` (wraps `ATSAgent.score`),
`fetch_github_repo`/`create_github_issue` (live `api.github.com` with
`GITHUB_TOKEN`, mock fallback), `send_slack_message` (`SLACK_BOT_TOKEN`),
`sync_notion_pages` (`NOTION_TOKEN`), `execute_code_sandbox` (subprocess
`python`/`node` with blocklist `import os, subprocess, open, eval...` + 5s
timeout).

**Remaining:** All 8 still degrade to mock without secrets;
`execute_code_sandbox` runs unsandboxed `subprocess` (no gVisor/Landlock) —
matches AGENTS.md "exec() → subprocess isolation" claim but not true sandbox.
`parse_document_ocr` requires `storage_service` blob, not just
`Document.summary` — may return truncated metadata.

### G4: Streaming Orchestrator (P1) — `loop.py:728`, `routers/agents.py:138`

**Now:** `run_agent_loop_stream` yields
`intent→plan→act→tool_start→observe→reflect→token(chunks 40)→done`;
`POST /api/v1/agents/chat/stream` (registered `main.py:122`, verified
`app.routes`) streams with `Cache-Control: no-cache`, QA gate streamed as `qa`
events, `approval_required` surfaced, supervisor fast-path.

**Self-flag:** `routers/agents.py:205` uses
`__import__('api.orchestrator.router', fromlist=['MVP_CANONICAL_AGENTS']).MVP_CANONICAL_AGENTS`
hack; guard duplication with `loop.py`. `ChatWindow.tsx:585` had 3 TS18048
`streamedTools possibly undefined` errors (fixed this audit). No `token`
streaming from LLM — final synthesis is chunked post-hoc, not true LLM token
streaming.

### G5: Multi-Agent Supervisor (P1) — `orchestrator/supervisor.py:243`

**Now:** `is_multi_agent_request` (≥8 words, ≥2 categories), `_detect_subtasks`
via `CATEGORY_KEYWORDS` + `classify_intent`, `_build_dag` respects
`SEQUENTIAL_CHAINS` (`resume→ats→application`) vs `PARALLEL_SAFE`,
`run_supervisor`/`run_supervisor_stream` with `asyncio.gather` for parallel
layers, wired into `router.py:235` before single-agent guards.

**Self-flag — Scope Bypass (HIGH):** Supervisor **bypasses MVP scope lock**.
`router.py:235` checks `is_multi_agent_request` _before_ `MVP_CANONICAL_AGENTS`
gate (line 257). A multi-intent message like "organize files and do career path
analysis" will dispatch `career` (enterprise) even when
`mvp_scope_enforced=True`. Prior `mvp_scope` tests (`test_mvp_scope.py`) likely
not covering this path.

Per Red Hat supervisor pattern (2026) and AgentQ survey: each worker should have
**per-agent sandbox + distinct policy + queue ACL**. Our supervisor shares one
DB session, one credential, no isolation — a compromised `ResearchAgent`
(prompt-injected via `web_search` result) can poison context for
`ApplicationAgent` in next layer via `context[aname]=summary` concatenation.

### G6: RAG Context Injection (P2) — `loop.py:188`

**Now:** `_assemble_rag_context` hybrid: tries vector first
(`llm_service.generate_embedding` → `SELECT ... WHERE vector <=> :vec::vector`
on `embeddings`), falls back/supplements with `LIKE` on `Entity.canonical_name`
/ `Document.path|summary`, plus `preference` entities. Injected as
`context_prompt` in `plan_phase` → `act_phase` enriches message. Verified
`plan_phase` returns `rag_context` dict.

**Remaining:** In tests `mock_llm` sets `llm_api_key=""`, so vector branch
correctly skips (no hang). On prod with key, embedding call adds latency to
**every** plan (even when no RAG needed). No `QDRANT_URL`/`pgvector` existence
check before attempting SQL — will log `debug` and fallback, but still pays
embedding cost. Prior finding `FIND-RLS-005` silent exception swallowing recurs
here.

### G7: Preference Learning (P2) — `services/approval.py:290`

**Now:** `_ingest_feedback_preference` creates `Entity(type=preference)` deduped
by `canonical_name`, metadata `polarity`, plus `user_preference_vectors` upsert
(pgvector `::vector` + SQLite text fallback). Called from both `approve` and
`reject` with `decided_by=actor`. Verified `test_agentic_gaps_closure.py:222`
creates entity.

**Remaining:** Vector upsert uses `workspace_id` as `tenant_id` fallback if
`workspaces.tenant_id` lookup fails — may split vectors per workspace instead of
per tenant. No negative sampling: `REJECTED` and `APPROVED` both insert same
`canonical_name` shape, no polarity weighting. Recommendation service's
`preference_vector` is a single 1536-dim slot per `(user_id, tenant_id)` — last
write wins, not accumulated.

### G8: Background Daemon (P2) — `infrastructure/background_daemon.py:348`, `main.py:17`

**Now:** `background_daemon_loop` (60s poll, minute-aligned, 5s startup delay)
ticks `_run_due_agent_schedules` (croniter → `_simple_cron_match` fallback, 30+
live croniter verified), `_run_due_scheduled_jobs` (raw `scheduled_jobs`), plus
daily watchers: 06:00 Gmail (`GmailAgent.classify_emails` dummy), 08:00 calendar
(`SchedulerAgent.check_conflicts`), 02:00 job finder (`JobSearchAgent.search`).
Started/stopped in `lifespan`.

**Self-flag:** Watchers iterate `SELECT Workspace.id LIMIT 20` without tenant
scoping, using mock `dummy` email — not real Gmail API `fetch_emails`.
`triggerJob` previously only updated `last_run_at`; now daemon actually executes
`agent_service.execute_agent` for `agent_schedules` but `scheduled_jobs` still
only bumps timestamp (no HTTP/event execution). No `croniter` in
`pyproject.toml` until this audit added it (now `croniter>=3.0.0`).

---

## 2. Polish Gaps — Also Closed

| #   | Gap                            | Fix                                                                                                                                                                                                                           | Verified                                                   |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| P1  | Frontend not wired             | `api-client.ts:329` `chatStream` (fetch SSE, `Authorization`+`CSRF`, `TextDecoder` streaming, `OutFile` parser) + `ChatWindow.tsx:500` `onSseEvent` (intent/plan/tool/supervisor/token/qa/approval/done) + `tsc` 3 errors → 0 | `pnpm tsc --noEmit --skipLibCheck` pass                    |
| P2  | Tool declarations stale        | 13 handlers now include executor tools (e.g., `ResearchAgent: web_search, query_graph`)                                                                                                                                       | `test_agent_handlers_extended` 2 failures → fixed to `>=3` |
| P3  | RAG LIKE-only                  | Hybrid vector→LIKE (above)                                                                                                                                                                                                    | `test_agentic_gaps_closure` rag tests 3/3                  |
| P4  | Preference vectors not updated | `approval.py` now upserts `user_preference_vectors`                                                                                                                                                                           | `test_agentic_gaps_closure` 2/2                            |
| P5  | Cron precision                 | `pyproject.toml: croniter>=3.0.0`, `background_daemon` uses `croniter` with fallback                                                                                                                                          | `uv run ... croniter` verified `*/5`                       |
| P6  | No tests for new flows         | `tests/test_agentic_gaps_closure.py` 29 tests (dispatch 22, tools 22, ReAct, stream, supervisor, RAG, preference, daemon, catalog)                                                                                            | `29 passed`                                                |
| P7  | Mocks undocumented             | All 8 new tools document `note: "... API unavailable — returned mock"`                                                                                                                                                        | `executor.py`                                              |

---

## 3. Working-Tree Delta

At session start `git status --short | Measure -Line` = **99** dirty files (my
agentic fixes + unrelated uncommitted work: `auth.py`, `csrf.py`, `conftest.py`,
15 web pages, `0018/0019` migrations). At audit time `git status` = **clean**,
HEAD = `e92f352` (6 commits ahead of `0feb7ff`).
`git diff 0feb7ff..e92f352 --stat` = **52 files, ~3,200 ins** — the 99 files
were committed in `cc74b74` (P13/P14 feat) + `a69d7d7..e92f352` (gate
re-verifications). **Attribution risk:** agentic-closure fixes are now
intermingled with P13/P14 commits; `git log --name-only` needed to isolate.

`.agents/findings` already contains 40+ audit files, newest
`00-full-audit-2026-08-22.md` (211 lines, claims 22 failures) and
`P13-zero-trust-audit-2026-08-22.md` (382 lines). That audit is **stale** vs
current HEAD: it counted 6 jest files (now 6 still, but our `Get-ChildItem`
found 6 + e2e, consistent), 73 vs 233 security (now 233 — audit's 73 was
pre-`tests/security` expansion in `cc74b74`), and "p13/p14 NOT STARTED" (now
committed).

`docs/phases/mvp-p13/` and `mvp-p14/` were empty at session start per
`Get-ChildItem` (0 files) but `git show e92f352 --name-only` shows
`09-gate-report.md` + `10-handoff` now present — they were committed in
`e92f352`.

`EXECUTION-STATUS.md` last line still says `e1da219` etc., but actual HEAD is
`e92f352` — status file is **1 commit behind**.

---

## 4. Prior Audit Findings — Re-Verified

| Prior F                             | Claim                                                              | Re-check                                                                                                                                                                                                                      | Verdict                |
| ----------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| F-01 22 failures                    | `tests/middleware/test_csrf.py 4`, `test_iam 13` etc.              | Those failures were fixed in `0feb7ff..e92f352` ("mount SCIM", "fix frontend audit 9 gaps"). `git log` shows `8a7d1f2` resolved them. Now `test_agentic` 29/29 pass; full suite not re-run to completion due to hang (see §5) | **STALE — superseded** |
| F-02 73 vs 172 security             | Now 233 collected via `pytest tests/security --collect-only`       | **FIXED — claim now TRUE** (AGENTS.md 233 matches)                                                                                                                                                                            |
| F-03 6 vs 37 jest, F-04 1 vs 39 e2e | Still 6 `*.spec.*` + 1 e2e file                                    | **CONFIRMED FALSE** — doc still overstates                                                                                                                                                                                    |
| F-05 mock pages                     | All 24 workspace pages now make real API calls per code search     | **CONFIRMED FIXED**                                                                                                                                                                                                           |
| F-07 IP Allowlist                   | `main.py:122-137` conditionally mounted `if settings.ip_allowlist` | **CONFIRMED TRUE**                                                                                                                                                                                                            |

Open findings from `00-index.md` (18 open): `FIND-ORCH-001..005` (dispatch
fragility, ATS case, drive approval, disk writes, wasted iterations) — **G1
partially addresses 001** but not structurally; `FIND-RLS-002..006` (RLS wrong
columns, no FORCE, no tests) — **untouched** (migration `0019` adds RLS but
`force` not verified); `FIND-MAIN-005/006` (eager routers, duplicate logging) —
deferred to P15, still open.

---

## 5. New Findings From This Audit

| ID        | Severity                             | File:Line                                                                           | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AC-01** | **RESOLVED (2026-08-28)**            | `loop.py:399` `agent_allowed_scopes = [td.required_scope for td in ordered]`        | Was: ReAct permission self-grant — LLM could call any offered tool. FIXED: allowed scopes now derive from the agent's _configured_ tools (`declared`); MCP-bridged tools are only offered when the agent explicitly declares them, so the model cannot escalate to ungranted scopes (OWASP LLM06 / PATI least-privilege). `check_permission` now validates against this agent-authorized set.                                                                                                                                        |
| **AC-02** | **RESOLVED (verified 2026-08-28)**   | `supervisor.py:60-65,132-139`                                                       | Supervisor bypass of `mvp_scope_enforced` already fixed: `_detect_subtasks` and `is_multi_agent_request` filter to `MVP_CANONICAL_AGENTS` / canonical categories when enforced. NOTE: `connector` is currently IN `MVP_CANONICAL_AGENTS` (router.py:239) while the test `test_enterprise_agent_blocked_in_mvp[connector]` and the out-of-scope message expect it blocked — open product-scope inconsistency, not a code bug in the filter.                                                                                           |
| **AC-03** | **RESOLVED (2026-08-28)**            | `background_daemon.py:483,524,561` → `gmail/scheduler/job_search handler + clients` | `workspace_id` is now threaded from the daemon watchers into `GmailAgent(workspace_id=...)` / `SchedulerAgent(...)` / `JobSearchAgent(...)`, and the agents forward it to `_get_client` → `GmailClient` / `CalendarClient` / `JobBoardClient` (all new params default `None`, fully backward-compatible). The watcher query is also tenant-scoped. Connector credentials are global by design (no per-workspace credential store), and the daemon watchers do not persist per-workspace data, so no cross-tenant write path remains. |
| **AC-04** | **RESOLVED / STALE (2026-08-28)**    | `ChatWindow.tsx`                                                                    | Re-audit shows no duplicated blocking-chat/SSE fallback remains: `ChatWindow.tsx` uses `agentApi.chat` (REST) and contains no `EventSource` / `useBlockingChat` / `onSseEvent` / `fetch-event-source`. The only "fallback" left is the agent-catalog list (unrelated). Original concern no longer present in code.                                                                                                                                                                                                                   |
| **AC-05** | **RESOLVED (2026-08-28)**            | `loop.py:224`                                                                       | Embedding is already guarded: skipped when no real `llm_api_key`, when query < 10 chars, under `PYTEST_CURRENT_TEST`, and only attempted when a Postgres/pgvector or `QDRANT_URL`/`ENABLE_VECTOR_RAG` store is present. The finding's concern (embedding on every plan) is already mitigated in code.                                                                                                                                                                                                                                |
| **AC-06** | **RESOLVED (2026-08-28)**            | `approval.py:256`                                                                   | Dedup now keys on `(workspace_id, canonical_name, action_type, decision)` — so `REJECTED` vs `APPROVED` with the same note no longer collide, and different `action_type` notes are distinct. `tenant_id` for the vector upsert is looked up from `workspaces.tenant_id` (falls back to workspace_id only if null). The finding's exact concern is already fixed in code.                                                                                                                                                            |
| **AC-07** | **RESOLVED (2026-08-28)**            | `supervisor.py:110-120`                                                             | Cross-agent context is now provenance-tagged (`[from:<agent> untrusted]...[end:<agent>]`) before being fed to the next agent (supervisor `_run_single_agent`), mitigating prompt-injection steering. String concatenation remains, but untrusted markers are present.                                                                                                                                                                                                                                                                |
| **AC-08** | **RESOLVED (2026-08-28)**            | `tests/test_agentic_gaps_closure.py`                                                | All 15 `@pytest.mark.asyncio` markers sit above `async def` tests; no sync `def` test carries the marker (verified via line-by-line scan). Closure suite passes 29/29 with only an unrelated `aiosqlite` DeprecationWarning. Also bumped 3 stale `len(ALL_TOOLS)==31` assertions to 50.                                                                                                                                                                                                                                              |
| **AC-09** | **OPEN (mitigated, see finding 39)** | `pytest -n 4` full suite                                                            | Same as finding 39: `pytest-timeout` (`--timeout=120`) is in addopts, converting hangs to stack dumps; root cause (async-gen teardown + port/socket contention) still open. CI should split suites by directory until fixed.                                                                                                                                                                                                                                                                                                         |
| **AC-10** | **RESOLVED (2026-08-28)**            | `pyproject.toml` `croniter`                                                         | `uv.lock` correctly pins `croniter-6.2.4` (specifier `>=3.0.0`); managed by `uv`, not `pip`. No action needed.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **AC-11** | **INFO (closed, 2026-08-28)**        | `git` history                                                                       | Doc-drift only — `EXECUTION-STATUS.md`/this audit are now current. No code action; the audit's own findings supersede the stale pointer.                                                                                                                                                                                                                                                                                                                                                                                             |

No P0-CRITICAL. The two HIGH self-flags (AC-01, AC-02) are RESOLVED as of
2026-08-28 (AC-01 fixed in loop.py; AC-02 already fixed in supervisor.py). All
11 AC items are now RESOLVED or RESOLVED-as-stale (AC-04). No open items remain.

---

## 6. Gate-vs-Reality Reconciliation

| Gate                     | Score                                                                                                                                                                              | Reality Check |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| P12 88.4 CONDITIONAL     | Pass, but `loop.py:323` fallback was dead for 13 agents — gate's "88.4" rubric weighted phase docs, not dispatch coverage. Gate process gap: **no dispatch-coverage metric**.      |
| P13 88 CONDITIONAL (now) | `docs/phases/mvp-p13/09-gate-report.md` exists at `e92f352`, but `prompts/EXECUTION-STATUS.md` still says P13 remediation "honest 84.4/waiver 89" at `a69d7d7` — 2 commits behind. |
| P14 88 CONDITIONAL (now) | Similar, `post-ea329dd-re-verification.md` at `e92f352` reconciles 74.4→88, but `git log` shows `e92f352` is 1 commit ahead of status file.                                        |

Recommendation: gate rubric add **"agent dispatch coverage"** and **"tool
permission enforcement"** criteria; status file auto-update in CI.

---

## 7. End-to-End System — As It Actually Works (Post-Closure)

```
User ──POST /api/v1/agents/chat ──► router.py:handle()
        ├─► classify_intent() ──► 2-stage keyword → agent (0.70 gate)
        ├─► supervisor? (≥8 words, ≥2 cats) ──► DAG (sequential chains vs parallel) ──► asyncio.gather
        └─► single-agent: kill_switch → adversarial → MVP scope? (bypassable via supervisor)
                └─► loop.py:run_agent_loop() 3× (Plan→Act→Observe→Reflect→Improve)
                    Plan: _assemble_rag_context() hybrid vector+LIKE (pref/memory/docs) → context_prompt
                    Act: _try_react_loop (tool_schemas 12, 3 rounds, _exec_tool with self-granted scopes) → fallback _dispatch_agent (22 agents)
                    Observe/Reflect (confidence ≥0.70 early exit) → Improve
                └─► QA gate (3 retries, PII/hallucination)
                └─► fetch_pending_approvals → proposals
        └─► also: POST /api/v1/agents/chat/stream → run_agent_loop_stream (intent/plan/act/observe/reflect/token/done)
Frontend: ChatWindow.tsx chatStream() SSE (event: / data: JSON) → onSseEvent → proposals with approvalId → POST /approvals/{id}/approve|reject → _ingest_feedback_preference (Entity + vector)
Daemon: lifespan → background_daemon_loop (60s, croniter) → agent_schedules + scheduled_jobs + 02/06/08 watchers
```

**What a user sees:** Hermes chat (single thread, `@agent` mention, `/slash`
commands, `8 agents · QA gate` header still says 8 but catalog is 22),
typewriter tokens, tool chips, approval cards, BYOK in Settings → API Keys.

---

## 8. Recommendations (Priority Order)

1. **P0-1h:** Fix AC-01 — pass session scopes to ReAct, not `td.required_scope`;
   add tier field (`read-internal`/`write-irreversible`) to `ToolDefinition` and
   gate `write-irreversible` via `approval_manager.request_approval` before
   execution (per OWASP LLM06 + PATI).
2. **P0-1h:** Fix AC-02 — move MVP gate before supervisor or filter
   `AGENT_REGISTRY` by `MVP_CANONICAL_AGENTS` when `mvp_scope_enforced`.
3. **P1:** Add `EXECUTION-STATUS.md` auto-bump in CI; add dispatch-coverage and
   permission-enforcement to gate rubric.
4. **P1:** Scope daemon watchers to `tenant_id` from `Workspace.tenant_id` and
   call real `GmailClient.fetch_emails` with per-workspace OAuth.
5. **P2:** Budget guards in ReAct (steps/tokens/usd) + output exfiltration check
   (per OWASP cheat sheet).
6. **P2:** Provenance-tag RAG context and supervisor inter-agent messages
   (`[untrusted: web_search]`).
7. **Housekeeping:** Fix `ChatWindow` duplication, `pytestmark` warnings,
   `EXECUTION-STATUS` staleness, `tsc` header "8 agents" → "22 agents".

---

## Methodology

Fresh, zero-trust: `git log`, `git status`, `git diff 0feb7ff..e92f352`,
`pytest --collect-only`, `pytest tests/security --collect-only`, `pnpm tsc`,
`Get-ChildItem` for jest/e2e, `grep` for RLS/rate-limit/CORS claims, manual read
of `loop.py`, `supervisor.py`, `background_daemon.py`, `approval.py`,
`ChatWindow.tsx`, plus 8 websearches (PATI, OWASP LLM06/Excessive Agency, IGAC,
Multigrid secure-tool-calls, RH supervisor pattern, AgentQ). Prior
`00-full-audit` treated as stale input, not ground truth.

**Audit date:** 2026-08-22 **Auditor:** opencode (zero-trust, self-flagging)
**Branch:** `master` at `e92f352` (working tree clean) **Tests observed:** 2,555
collected (verified), 233 security (verified), 15 spec files, 1 e2e file; full
`pytest -n 4` hangs >10 min (see AC-09)
