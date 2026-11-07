<!-- /autoplan phase 4 — Engineering review of skills-feature-master-plan.md -->
<!-- Degradation: Codex dual-voice UNAVAILABLE (CLI not installed) — single-voice
     review + adversarial self-falsification pass (see Falsification section).
     Same substitution as the CEO/Design/DX phases. -->

# Skills Feature — Engineering Review (Phase 4, final)

**Reviewed:** `skills-feature-master-plan.md` (293 lines, CEO amendments
integrated 2026-10-18), against `docs/Audits/skills-feature-production-audit.md`
and the three prior phase reviews (`skills-feature-review-ceo.md`, `-design.md`,
`-dx.md`). **Method:** every load-bearing technical claim in C2/D1/H1/G1/E1–E3
re-verified against source by reading the actual call sites, not the plan's
citations. Every finding below cites file:line read this session. No runtime
execution was performed (this review is a code-trace; the one PG-only claim is
flagged as such and a live verification is prescribed as a gate, not asserted as
measured). **Mode:** AUTO-DECISION — decisions recorded inline with rationale;
genuine taste calls collected at the end (4). Pipeline must not block.

---

## Verdict summary

| Item                      | Verdict                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **C2** pinning seam       | ⚠️ Needs amendment — single-seam option is **disproven**; and pinning is dead-on-arrival on PG without a P0 seam fix (F-0)              |
| **D1** static-path parity | ❌ Not feasible as written — no instruction-compiler layer exists on the static path; replace with documented non-goal + provenance pin |
| **H1** gate dry-run probe | ⚠️ Feasible with corrections — endpoint exists; "pass no run_id" does **not** achieve "records no usage"                                |
| **G1** memory bridge      | ✅ Feasible as written — site confirmed at `conversation_service.py:222-289`, guard at `:239`                                           |
| **F-0** (new, P0)         | Skill injection is **inert on PostgreSQL request paths today** — both buffered and stream builders. Blocks C2; must be fixed in Wave 0  |

---

## F-0 (P0, blocking C2): the injection seam cannot see rows on PG request paths

This is the heaviest finding of this review. It was not surfaced by the audit or
any prior phase because both looked at `build_skill_directive` in isolation, and
the unit suite runs on SQLite where RLS is a no-op.

**Evidence chain (all read this session):**

1. **Buffered path never calls injection at all.** `router.handle` builds its
   `AgentRequest` at `apps/api/src/api/orchestrator/router.py:814-825` with **no
   `db=` argument** (`AgentRequest` accepts `db`, `loop.py:439`). Both buffered
   builders funnel here: `chat.py:85` → `orchestrator_handle(UserRequest)` and
   `agents.py:665` → `handle(UserRequest)`. In `loop.py:2574`, `_try_react_loop`
   receives `db=getattr(request, "db", None)` → `None` → the injection guard at
   `loop.py:1519` (`if db is not None and workspace_id`) skips the lookup
   entirely.
2. **Stream path passes a post-commit, closed session.** `agents.py:695-700`
   commits and closes the request session in a `finally` _before_ the generator
   runs; then `agents.py:894` passes that same `db` into `AgentRequest`.
   SQLAlchemy sessions are reusable after `close()` (a new
   transaction/connection is checked out lazily), so `_skill_rows` at
   `skill_injection.py:388-408` executes — but **on a new transaction with no
   GUCs**.
3. **GUCs are transaction-scoped by design.** `set_rls_session_vars`
   (`middleware/tenant.py:38-81`) uses `set_config(..., true)` (SET LOCAL
   semantics; comment at :49-51 says so explicitly for PgBouncer). The
   endpoint's `commit()` ends the transaction that carried
   `app.workspace_id`/`app.user_id`.
4. **`workspace_capabilities` is FORCE-RLS with a GUC-keyed policy.** Migration
   `0049_connectors_uq_and_capabilities.py:93-108`:
   `ENABLE + FORCE ROW LEVEL SECURITY`, policy
   `p_capabilities_workspace_isolation` on
   `workspace_id = current_setting('app.workspace_id', …)::uuid OR EXISTS(workspaces…)`.
   With GUCs unset: `NULLIF(NULL,'')::uuid` → NULL → both branches NULL → **zero
   rows, no error** — exactly the fail-closed-but-silent mode AGENTS.md warns
   about.

**Net:** on PostgreSQL, `build_skill_directive` returns `text=""` for every real
request path. On SQLite (all tests) it works. Pinning (C2) built on this seam
would be silently dead in production while green in CI — the worst of both.

**Fix (Wave 0, single owner):** in `_try_react_loop` (`loop.py:2566-2578` the
caller already holds `workspace_id`, `user_id`, `tenant_id`), open a short-lived
`scoped_session(workspace_id=…, tenant_id=…, user_id=…)` — the
repository-sanctioned worker pattern (`database.py:165-248`, cf.
`ranking_weights.py` per AGENTS.md) — and run `build_skill_directive` on that,
instead of relying on the request session. This also makes the buffered path
(db=None) work without threading `db` through `router.handle`. `.agents`
decision: scoped_session over re-initializing GUCs on the request session —
survives close, explicit ids, matches the documented pattern. **Deliberate
contract change:** the comment at `loop.py:1512-1513` pins "no db ⇒ zero
lookups" and a test asserts the call count is 0. That guard changes to "no
`workspace_id` ⇒ skip". The pinning tests must be updated in the same change,
documented — not silently.

---

## C2 — Pinning seam: needs amendment

**Falsified claim:** "verify whether they funnel through one orchestrator entry
— prefer the single seam if so." They do not:

- `chat.py:85` and `agents.py:665` funnel into `router.handle`, **but**
- the stream builder (`agents.py:707-712`) constructs **no `UserRequest`** — it
  classifies locally (`route_intent_and_plan`, `agents.py:784-788`) and builds
  its own `AgentRequest` at `agents.py:888-900` → `run_agent_loop_stream`.
  Supervisor fast-paths (`agents.py:746-777`, `agents.py:722-739`) consume
  `full_message` even earlier.

So the plan's fallback is the correct one: **shared helper at the 3 token
sites.** The plan's "Verified facts" line 36 ("All build `UserRequest`") is
factually wrong and must be corrected.

**Required amendments to C2:**

1. `parse_skill_pin(message) -> (residual, slug|None, malformed: bool)` called
   at the 3 sites **before `full_message` is composed** — i.e. before
   `chat.py:647`, `agents.py:647`, `agents.py:712` — so that all downstream
   consumers see the residual: `classify_intent` (`router.py:665`),
   `_is_multi`/supervisor (`agents.py:750`), `route_intent_and_plan`
   (`agents.py:785`), `detect_adversarial_prompt` (`agents.py:852`), the
   conversational fallback (`agents.py:815`), and
   `retrieve_memory_and_vault_context` (`agents.py:634` — strip before
   retrieval, same reason). Decision: strip first, retrieve second — retrieval
   should not embed the pin token. Rationale: explicit-over-clever; one
   ordering, stated once.
2. Threading: `UserRequest` gains `pinned_skill` (router.py:110-121); `handle`
   copies it into `AgentRequest` (814); `AgentRequest` gains the field
   (loop.py:431); `_try_react_loop` passes `pinned_skill` into
   `build_skill_directive` (loop.py:1523). The stream builder passes it at
   `agents.py:888`. Supervisor inherits it via the stripped message only (no pin
   propagation into `run_supervisor_stream` this pass — document that a pin on a
   message routed to the supervisor applies on the sub-agent ReAct runs via the
   residual, and pin provenance records `applied=false, reason=supervisor_route`
   if not; otherwise silent loss violates H5/T10).
3. `build_skill_directive` gains `pinned_skill: str | None = None`. Semantics in
   the single-pass loop (skill_injection.py:599-634): a row whose resolved name
   == pinned slug is eligible **regardless of `_trigger_state`**, still subject
   to `enabled`, `PROHIBITED_EXTERNAL_DOMAINS`, `required_scope` (granted), and
   `markdown_doc` — and later to the shared budget drop. Bypasses the trigger
   gate **only**. Unknown slug: no row matches → add
   `SkillSkip(slug, "pinned_unknown", …)` so provenance/logging is structural
   (log line `SKILL_INJECTION pinned_unknown=` per spec). No error, no 500.
4. Malformed vectors (`/skill:`, `//skill:x`, `/skill:../`, case variants,
   leading whitespace, pin-not-leading) → helper returns residual unchanged,
   `slug=None`, `malformed=True`; C3/E2 pin these as frozen vectors.

**With F-0 fixed, C2 is a small, surgical change** — the seam, fencing, budget
and `usage_run_id` plumbing already exist and are correct (`loop.py:1523-1530`,
`skill_injection.py:561-668`).

---

## D1 — Static-path parity: not feasible as written; replace

**The plan says:** "if the static path has no instruction-compiler layer, add
the directive to its prompt assembly."

**Reality:** the static fallback (`loop.py:2587-2616`) dispatches through
`_dispatch_agent` (`loop.py:2661+`) — a per-agent `if/elif` over ~22 agents
calling each handler's own policy-coded methods (e.g. `agent.execute(...)` at
:2705). There is **no shared prompt assembly** on this path to hook; the ReAct
path's `system_content` block (`loop.py:1486-1494`) belongs to `_try_react_loop`
alone. Injecting there means editing N agent implementations — unbounded blast
radius for a path that only runs when ReAct fails or is disabled
(`agent_react_enabled` defaults True, `config.py:213`).

**Amendment — replace D1's goal with:**

- **Documented non-goal (E4):** skills apply on the ReAct act-path only; a
  static fallback run carries no skill directive. State this in the author
  contract.
- **Provenance pin:** when the static fallback produces the result, the run
  record must carry `skill_directive=not_applied` (new, non-blocking) — today
  the SKILL_INJECTION log is simply absent, which is indistinguishable from a
  no-matching-skills run.
- **Test pin:** static path (react disabled) → assert no directive claim and the
  provenance marker.
- The `usage_run_id` half of D1 (line 142-144) is moot for the static path (no
  call happens) — retain it only as a note that the ReAct pass-site already
  passes it (`loop.py:1529`), satisfying the original DX-6 correction.

Rationale: honesty rules — do not ship a "parity" line item whose implementation
is per-agent guessing; convert it into a truthful, testable statement.

---

## H1 — Probe endpoint: feasible with corrections

**Confirmed:** `POST /capabilities/{cap_id}/test` exists
(`capabilities.py:1630`, skill branch `:1773-1862`), already accepts
`input.message` (`:1789-1791`), reports `token_budget` at `:1849` (matching D9's
claim), always states `executed` honestly, and is rate-limited 10/min (`:1634`).
The named-endpoint variant `POST /capabilities/test` in `agents.py:313` is a
separate name-based surface; H1 correctly targets the id-based one.

**Correction 1 (plan is wrong as written): "records no usage (telemetry-off path
— pass no `run_id`)."** — `record_injected_usage` still fires and still counts
when `run_id=None` (`skill_injection.py:577-581` docstring, call at `:661`), and
the endpoint _also_ calls `record_usage(db, cap)` + commit unconditionally at
`:1680-1681`, **before** any category branch. Passing no `run_id` achieves a
fake dry-run. **Fix:** extract a pure evaluator —
`evaluate_skill_gates(rows, granted, haystack, pinned, budget) -> (injected, skipped)`
— from `build_skill_directive`; runtime wraps it and records usage; the probe
calls the evaluator and never records; the endpoint skips `record_usage` for
skill requests that carry a `message` probe. This makes E2's "probe ↔ runtime
agreement" **structural** (one code path), not a duplicated-logic test. Plan
text for H1 must be corrected.

**Correction 2:** the plan's gate order includes "pin" — the probe needs the
same `pinned_skill` input. Decision: accept optional `input.pin` (slug) in
addition to `input.message`; evaluate with the same parse helper (frozen in Wave
0). Rationale: the DX use-case ("why didn't my pinned skill apply?") is
precisely the probe's job. **Correction 3:** probe is per workspace row
(`cap_id`); catalog-only (uninstalled) skills are not probeable through this
endpoint — E2's agreement test must use an installed row. Note it; do not widen
scope.

Return shape: per-gate verdict list reusing `SkillSkip.reason/detail` verbatim +
directive preview (rendered block text) + `recorded_usage: false` explicit
field.

---

## G1 — Memory bridge: feasible as written

**Confirmed site:** `conversation_service.py:222-289`. Caller gate at `:210`
(user role, `len > 10`); `:234-236` `<15` return; **`:239`
`cleaned.startswith("/")` returns** — all slash commands skip ingestion today.

**Surgical shape:** in `_extract_chat_cognitive_memory`, replace the `:239`
guard: if the text starts with `/skill:`, run the shared parse helper → slug +
residual; if residual fails the existing gates (`>=15` chars and cue-or-`50` at
`:250`) return; else proceed with `cleaned = residual` (title/summary/content
all derive from residual). Add `"skill_slug": slug` to the metadata dict at
`:283` when present. Pure `/skill:x` → residual empty → skipped (unchanged
behavior for every other `/` command). Tests: 3 vectors + provenance present +
non-`skill` slash unchanged. Rollback = one call site, as the plan states. No
new tables, no new indexes — consistent with RLS invariants (write path is the
already-RLS-scoped request session).

---

## Edge cases (verified against code, not assumed)

1. **Pin collides with a trigger-matched skill** — single-pass loop means one
   eligibility decision per row; no double-injection possible. Test pin it.
2. **Pinned + budget** — pinned skill is dropped by the same whole-skill budget
   rule (`:643-653`); the skip reason must read `token_budget_exceeded` and the
   pin-provenance must record it as not-applied (meets H5/T10 notice
   requirement).
3. **Concurrent runs / retries** — `record_injected_usage` dedupes once per run
   id; `usage_run_id=request_id` already passed (`loop.py:1529`). Two concurrent
   runs count once each; a resumed/replayed run does not double-count. Probe
   path (post-fix) never records.
4. **Message stripping vs `bg_context`** — strip before composing `full_message`
   (`chat.py:647`/`agents.py:647`/`agents.py:712`); residual classification text
   must never contain `bg_context` timing artifacts; pin vectors (C3/E2) assert
   the residual, not the full message.
5. **`/skill:` malformed vectors** — helper never raises; `slug=None` +
   `malformed=True` → treated as plain text (no pin), logged once.
6. **RLS/GUC on every new path** — F-0 fix uses `scoped_session` with explicit
   ids (tenant resolved from context on request paths; explicit values win per
   `database.py:181-183`). Probe runs inside the request transaction (GUCs
   live). G1 runs on the existing ingestion path (GUCs live). No new tables —
   invariant held.
7. **D8 cap vs catalog merge** — `list_capabilities` (`:1128-1145`) has no LIMIT
   today; the 500-cap must apply to the merged response (workspace rows +
   optional catalog), or exclude catalog from the count — pick one and pin the
   choice in the test.
8. **Supervisor route with a pin** — see C2 amendment 2: provenance records
   `applied=false` with reason; never silent.

---

## Performance

- Injection = one indexed select per agent run + one connection check-out for
  the scoped session (F-0 fix). Negligible vs the LLM call; strictly better than
  holding the request connection (the current design's stated intent).
- Probe = validate + one evaluator pass over ≤ workspace rows; rate-limited
  10/min.
- `GET /capabilities` unbounded select (`:1134`) is a real list-growth/DoS
  surface — D8 remains justified; implementation is trivial and correct as
  scoped.
- No hot-loop additions on the static path (D1 replacement adds nothing).

---

## Test plan — sufficiency of E1–E3, and additions

**Judgment:** E2 and E3 are strong. **E1 is currently insufficient as the only
real-path test** — on SQLite it cannot detect F-0 (RLS off), so it would pass
both before and after the fix. Additions:

- **T-1 (P0, F-0):** unit-assert the injection call opens `scoped_session` with
  `(workspace_id, tenant_id, user_id)` and reads rows with request `db=None` and
  with a closed session. Explicit boundary note: PG policy behavior itself is
  not provable on SQLite; optionally hook a PG-marked case into the `verify:pg`
  harness (taste call 4).
- **T-2 (P0):** buffered-path parity — POST `/agents/chat` (and `/orchestrator`
  chat path) with a pinned skill reaches the directive. This test **fails before
  F-0's fix** (db=None) — the mandated fail-before/pass-after pair.
- **T-3:** stream early-strip — supervisor `_is_multi`, `route_intent_and_plan`
  and the adversarial scan receive the residual (no `/skill:` visible upstream).
- **T-4:** probe records no usage (exact count assertion; negative control),
  including with `input.pin`.
- **T-5 (extends E2/H6):** probe↔runtime agreement via the shared evaluator —
  same `SkillSkip` verdicts through both entries for the full gate matrix.
- **T-6:** G1 three vectors + `metadata.skill_slug` present.
- **T-7:** pin==trigger skill injects once; pinned budget-drop names the skill
  in `skipped` and in provenance.

---

## Execution topology — corrected (plan's partition has real collisions)

**Collisions found in the plan's (a)/(b)/(c)/(d) partition:**

1. `TriggerSimulatorModal.tsx` — A1 (a) **and** B8 (b). Same file, two agents.
2. `SkillPlaygroundDrawer.tsx` — A2 (a), B8 (b, matcher at :142), B5 (b), **and
   D9 (c)**. Up to three agents.
3. `ChatWindow.tsx` + `SkillIntegrationBar.tsx` — C1/C1b have **no owning
   bucket** at all (C is represented only by C2 in Wave 0). GAP, not just
   collision.
4. `agents.py` / `skill_injection.py` — Wave 0 (C2) and (c) (D2/H1) touch the
   same files; acceptable only because waves are sequential — keep that ordering
   explicit.
5. F-gates must remain serial after ALL writers stop; "fix-forward" on a tree
   still being written by a parallel agent violates that.

**Corrected partition (disjoint file sets per wave):**

- **W0 (serial, one owner) — contract + seam freeze:** `parse_skill_pin`
  helper + F-0 scoped-session fix + `pinned_skill` threading +
  `build_skill_directive` evaluator extraction + deliberate test-contract update
  (loop.py:1512 pin) + C2/E2 helper vectors. Files: `routers/chat.py`,
  `routers/agents.py`, `orchestrator/router.py`, `orchestrator/loop.py`,
  `services/skill_injection.py`, `tests/test_skill_injection*.py`,
  `tests/test_orchestrator.py`.
- **W1 (parallel, disjoint):**
  - **Agent-1 Frontend components:** A1–A9, B5, B6, B8, C1, C1b, D9, ui-kit
    icons. Files: `components/**/skill*`, `SkillIntegrationBar.tsx`,
    `ChatWindow.tsx`, `TriggerSimulatorModal.tsx`, `SkillPlaygroundDrawer.tsx`,
    ui-kit icon set, shared matcher module (new). **B10 IA-contract doc + pins
    authored first in this agent, before B5/B6 refactors touch the surfaces.**
  - **Agent-2 Frontend pages:** B1, B2, B3, B7, B9 + page-level jest. Files:
    `app/**/capabilities/skills/**` (new files), `route-manifest.ts`, subpage
    `loading.tsx`/`error.tsx`.
  - **Agent-3 Backend extensions (depends on W0):** D2, D3, D4, D5, D6, D8, H1,
    H2, G1. Files: `routers/capabilities.py`, `routers/agents.py`
    (capabilities/test branch — different hunk from W0's chat builders),
    `services/conversation_service.py`, tests for the above.
- **W2 (serial) — proof:** Agent-4 owns E1, E4, E5, E7 + T-1..T-7 additions;
  then F1→F6 in order. E2/E3 largely live in W0/W1 test files; Agent-4 owns only
  new test files + `docs/API_REFERENCE.md` + CI workflow (F5).

Rationale: mitigate-by-construction — file ownership, not workstream letters, is
the unit of disjointness. (Explicit-over-clever; blast-radius minimization.)

---

## Falsification pass (adversarial self-check, single-voice substitution)

What would prove each verdict wrong, and what was actually checked:

- _C2 single seam exists?_ Checked every call site of `handle`/`run_agent_loop`/
  `run_agent_loop_stream` and all token-parse sites — stream builder bypasses
  `router.handle` (agents.py:888). Verdict stands.
- _F-0 might be wrong if GUCs survive commit or a policy branch is permissive._
  `set_config(...,true)` + PgBouncer comment + policy DDL at 0049:96-108 all
  read; the `USING(true)` service-policy migration 0047 predates
  `workspace_capabilities` (created in 0049), so the app role is governed by the
  GUC policy. Code-trace confidence high; **not runtime-executed** — hence T-1
  and the PG verification recommendation rather than a fabricated "confirmed
  live".
- _D1 might have a seam via `agent_context` flowing into handlers._ Checked
  `_dispatch_agent` head: handlers consume `context` pairwise; no shared prompt
  assembly. Even if some handler merged `agent_context`, that is per-agent, not
  the single seam the plan promises. Verdict stands.
- _H1 might not need the endpoint change if `record_injected_usage(None)` were a
  no-op._ Read it: it records and WARNs by design. Verdict stands.
- _G1 could be blocked by the outer `>10` gate._ `/skill:abcdef` (13 chars)
  passes it; residual logic then applies. Verdict stands.

---

## Decisions log (auto-decided, no blocking)

- **D-1:** `scoped_session` for injection lookup (vs GUC re-init) —
  worker-pattern parity, survives session close, explicit identity, documented
  in `database.py`.
- **D-2:** Strip-before-retrieve ordering for the pin (single stated order).
- **D-3:** Extract `evaluate_skill_gates` as a pure function (structural
  probe↔runtime agreement beats duplicated logic).
- **D-4:** D8 cap applies to the merged list response.
- **D-5:** Pin provenance includes `supervisor_route` non-application reason.
- **D-6:** Kept from prior phases without re-litigation: B4 test-only, D8 in
  scope, G1 depth = strip + provenance ingest, T11 = extend `/test`, H2
  included.

## Taste decisions (4, for the final approval gate)

1. **F-0 fix shape** — `scoped_session` per injection (rec) vs re-init GUCs on
   the request session (viable; rejected: relies on session-reuse semantics
   after close).
2. **D1 replacement** — documented non-goal + provenance pin (rec) vs attempted
   static parity (rejected: unbounded per-agent edits) vs drop D1 entirely
   (rejected: loses the honesty pin).
3. **Wave-0 scope** — absorb F-0 + evaluator extraction + pin into ONE serial
   wave (rec) vs ship pin first and fix F-0 as a follow-up (rejected: pinning is
   dead on PG without F-0 — shipping an inert feature behind green SQLite tests
   is the dishonest option).
4. **E1 evidence boundary** — SQLite + mock-LLM with explicit boundary note
   (rec, repo convention) vs add a PG-gated live injection test to the
   `verify:pg` harness this pass (stronger, slower — if chosen, scope it to the
   F-0 read path only).

## Plan amendments required (exact)

1. **Verified facts line 35-36:** correct — the stream builder does not build
   `UserRequest`; only `chat.py` and `agents.py:/chat` funnel through
   `router.handle`.
2. **C2 (line 123-134):** replace the single-seam option with the shared helper
   at the 3 sites; add F-0 as a Wave-0 prerequisite; add `pinned_skill`
   threading path and the supervisor provenance reason.
3. **D1 (line 140-144):** replace with non-goal + provenance + test pin (keep
   the `usage_run_id` note as satisfied-by-existing-code).
4. **H1 (line 201-207):** correct the telemetry-off mechanism (evaluator
   extraction + skip `record_usage`, NOT "no run_id"); add `input.pin`.
5. **E1 (line 170-172):** add T-1/T-2; mark the SQLite blind spot explicitly.
6. **Execution topology (line 226-233):** replace with the W0/W1/W2 partition
   above; keep F-gates serial.
7. **Risks (line 266-277):** add F-0 as the top risk (silent inert feature),
   collision-aware ownership note.
8. **Review pipeline status:** Phase 4 Eng complete.

**Projected outcome:** with W0 as amended, the plan's engineering foundation is
sound and honest; without it, C2 ships an inert pin and H1 ships a probe that
writes telemetry — both invisible under the current SQLite-only proof.
