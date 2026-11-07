<!-- /autoplan restore point: none — no prior plan file existed for this invocation; this is the normalized plan. -->
<!-- Review pipeline COMPLETE 2026-10-18: CEO + Design + DX + Eng amendments integrated (see Review pipeline status). Eng phase added F-0 (P0) + corrected C2/D1/H1 and the execution topology. -->

# Skills Feature — Master Plan (pages, subpages, components, design system, backend, integration)

**Source:** user request (this conversation) + 4-parallel-agent production audit
(`docs/Audits/skills-feature-production-audit.md`), then CEO-phase review
amendments. **Branch:** `master` — collaborative dirty tree; existing
uncommitted changes under `apps/api/src/api/` are user work and must NOT be
reverted or edited beyond the plan's explicit scope.

## Objective

Take the workspace Skills feature from ~5.8/10 to production-grade: complete the
design system across its pages/subpages/components, make every surface
end-to-end dynamic against the real API, close the chat/agent/memory integration
gaps, finish the backend contract, and prove behavior with tests that exercise
the real request path.

## Hard constraints (repo invariants)

1. Never hand-edit generated artifacts (`*.generated.ts`, committed OpenAPI).
   Regenerate.
2. Honesty rules: exact expected status codes; negative controls in security
   tests; no fabricated numbers in docs; do not edit expectations to make tests
   green.
3. Skills docs are injected as **untrusted** prompt layer — never widen trust.
4. `workspace_capabilities` is FORCE-RLS; every new table needs RLS + policy +
   migration `_assert_schema_wide_coverage` compliance. No new tables planned in
   this pass.
5. Commit only when explicitly asked. No `git add -A`. Do not touch unrelated
   dirty files.
6. Run commands from repo root with `uv run --project apps/api …` /
   `pnpm --filter …`.

## Verified facts the plan depends on (measured this session)

- Catalog = **28** entries (`skill_catalog_service.py:199-1133`; class def at
  144; pinned by `test_skill_catalog.py:95`).
- `rg '/skill:' apps/api/src` → **0 hits**. Pinning does not exist server-side.
- Three request builders parse slash tokens via `SLASH_COMMAND_AGENT_MAP`:
  `chat.py:80-82`, `agents.py:650-652`, `agents.py:708-711`. **CORRECTED
  (Eng):** the stream builder (`agents.py:707-712`) builds NO `UserRequest` — it
  classifies locally and builds its own `AgentRequest` at `agents.py:888`; only
  `chat.py:85` and `agents.py:665` funnel into `router.handle`. A single
  orchestrator seam does NOT exist → C2 uses the shared helper at all 3 sites.
- **F-0 (P0, Eng — verified this session):** skill injection is inert on
  PostgreSQL request paths. Buffered: `AgentRequest` built without `db`
  (`router.py:814-825`, `supervisor.py:185`); stays `None` → skip at
  `loop.py:1519` guard. Stream: passes the session committed (`agents.py:698`)
  and closed (`:700`) before the generator as `db=db` (`:894`) — reusable after
  close, but GUCs are `set_config(...,true)` transaction-scoped and applied only
  by explicit calls (`tenant.py:38-81`, `database.py:220-233`; no event
  listener) → PG reads get zero rows **silently**; SQLite (all tests) is
  RLS-free → green. In-repo fix pattern: `_lookup_approval_internal` opens its
  own `scoped_session` (`loop.py:350-353`).
- Sort comparator at `capabilities/page.tsx:164-178` is **correct** (never-used
  sorts last). B4 = regression test + audit-report correction only.
- `getAgentForSkill` (`SkillIntegrationBar.tsx:18`, non-null `!` at
  31/36/45/59/64) is called from `ChatWindow.tsx:91`,
  `SkillPlaygroundDrawer.tsx:77`, `SkillIntegrationBar.tsx:90` — crash risk on
  unmapped names.
- Trigger matching drift in TWO components: `TriggerSimulatorModal.tsx:42` and
  `SkillPlaygroundDrawer.tsx:142` (contiguous `includes`), vs backend
  `_trigger_hits` token-set containment.
- No `gen_tokens.py --check` step in `.github/workflows/`.
- `conversation_service.py:239` discards `/skill:` turns from auto-memory.

## Workstreams

### A. Design system completion — skill surfaces (UI/UX)

- A1. **TriggerSimulatorModal → ui-kit `Modal`**
  (`TriggerSimulatorModal.tsx:65-66` declares `aria-modal="true"` with no
  trap/Escape/scroll-lock — the ONLY skills overlay lacking containment).
  Acceptance: Tab cycles inside, Escape closes, body scroll locked, initial
  focus set. Preserve copy/testids.
- A2. **SkillPlaygroundDrawer → ui-kit `Drawer`**: containment already present
  (line 65) — scope is scrim + sizing tokens instead of
  `sm:w-[480px] lg:w-[560px]`
  - `shadow-2xl` only.
- A3. Replace emoji icons (⚡💬🤖🧠📄) with ui-kit `icons`; verified mapping
  covers 5 of 7 spots; **icon gaps: no chat/message icon, no zap icon** — add
  `MessageIcon` + `ZapIcon` to the set (taste #7 / T2) or substitute; remove
  emoji from accessible names; decide `ConnectorDetailDrawer.tsx:382` (⚡)
  fold-in vs separate.
- A4. Canonicalize selection styling on `--surface-selected` fill (exists in all
  3 themes, currently unused; selected card uses `text-primary` + left border —
  drop those per taste #8 / T3); apply to rows + filter pills consistently.
- A5. Normalize radii (`rounded-card/container/pill`), border/surface alphas,
  and elevation (`shadow-elevation-*`) across the 8 skill components.
- A6. A11y (non-modal items — modal-specific gaps are covered by A1/A2):
  `aria-pressed` on category pills; roving `tabindex` + arrow-key focus in the
  skill list; `role="progressbar"` + `aria-valuenow/max` on the token gauge;
  `aria-live="polite"` for playground results; `MIN_TOUCH_TARGET` on
  chips/pills.
- A7. Delete dead code: unused imports (SkillFilterBar, SkillIntegrationBar,
  SkillPlaygroundDrawer, SkillMarkdownViewer); dead props
  `onEditDoc`/`isEditing`; dead union member `'local'`; unreachable `warning`
  branch; dedupe `useSafeRouter` into one shared module; extract the 5
  duplicated async handlers (workbench + subpage) into a shared hook.
- A8. SkillMarkdownViewer: catch clipboard failures; unique per-block ids; fix
  h2 conflicting classes `text-sm`+`text-2xs` and
  `tracking-tight`+`tracking-wider` (`SkillMarkdownViewer.tsx:47` — one silently
  wins by stylesheet order).
- A9. Trust filter: expose all **7** classes (source: `skill-row-helpers.ts:25`
  `VALID_TRUST_CLASSES`) in `SkillFilterBar.tsx:33-37`, replacing the 2-class
  list.

### B. Pages / subpages / states

- B1. Add `capabilities/skills/page.tsx` index route (redirect → parent
  `?category=skills`, mirroring the legacy shim; no 404 via catch-all).
- B2. Add `loading.tsx` + `error.tsx` for `capabilities/skills/[skillId]/`.
- B3. Subpage: destructure SWR `error`; render `ErrorState` with retry; keep
  not-found only for resolved-missing.
- B4. **Regression test only** (audit claim falsified): pin ordering
  `used-new → used-old → never` for `sortSkillRows`; correct the audit report.
- B5. Playground: hold `key` not stale row snapshot; re-derive row from merged
  SWR data so install/enable updates reflect live.
- B6. Detail actions: pending/disabled states (double-fire prevention) on
  subpage, parity with workbench.
- B7. Offline provenance: when server list fails, label seed rows as offline
  fallback (wire `getStorageHealth`).
- B8. Trigger matching: extract **one shared token-set matcher** used by
  `TriggerSimulatorModal` and `SkillPlaygroundDrawer`, aligned with backend
  `_trigger_hits` semantics; **rewrite the simulator footer copy** to state the
  real matcher behavior (currently claims whitespace-collapsed containment while
  the matcher is contiguous `includes`); distinct "no installed skills" empty
  state; add a fixture matrix shared with backend tests.
- B9. Register `capabilities/skills/[skillId]` in `route-manifest.ts`; keep
  legacy `/skills` redirect with a test.
- B10. **Document the pane↔subpage IA contract** (workbench detail pane vs
  full-page skill route: which actions live where, deep-link behavior both ways)
  and pin it with tests before B5/B6 refactors touch those surfaces.

### C. Chat ↔ skill contract (end-to-end dynamic)

- C0. **F-0 (P0 — blocks C2; Wave 0):** make skill injection actually read rows
  on PostgreSQL. In `_try_react_loop` (`loop.py:2566-2578`), open a short-lived
  `scoped_session(workspace_id=…, tenant_id=…, user_id=…)` (repo worker pattern,
  `database.py:165-248`; parity with `_lookup_approval_internal`,
  `loop.py:350-353`) and run `build_skill_directive` on it instead of relying on
  the request `db` — fixes both the buffered path (`db=None` → currently
  skipped) and the stream path (post-close session → GUC-less zero rows on PG).
  **Deliberate contract change, documented:** the guard at `loop.py:1512-1513`
  ("no db ⇒ zero lookups" + a test asserting call count 0) changes to "no
  `workspace_id` ⇒ skip"; update those pins in the same change — not silently.
  Tests: T-1/T-2 (see E1).
- C1. Producers for the existing `?skill=` consumer: `SkillIntegrationBar` and
  `SkillPlaygroundDrawer` "Launch in Chat" push `&skill=<slug>`. **Define and
  test the draft-conflict behavior** (ChatWindow.tsx:96,111 silently no-ops when
  a draft exists — choose: prefill-overwrite confirm vs append) and assert
  producer URLs in tests.
- C1b. **Null-safe agent mapping**: `getAgentForSkill` returns `undefined` when
  unmapped (remove the 5 non-null assertions); all 3 production call sites
  (`ChatWindow.tsx:91`, `SkillPlaygroundDrawer.tsx:77`,
  `SkillIntegrationBar.tsx:90`) handle absence explicitly (omit agent param /
  hide per-site copy). Add tests for mapped + unmapped.
- C2. Backend pinning (depends on C0 — inert on PG until F-0 is fixed): parse
  leading `/skill:<slug>` from the user message, strip the full token from
  classification text, thread as `pinned_skill` into `build_skill_directive`.
  **No single seam exists (Eng-falsified):** shared helper
  `parse_skill_pin(message) -> (residual, slug | None, malformed: bool)` called
  at all 3 tokens sites **before `full_message` is composed** (`chat.py:647`,
  `agents.py:647`, `agents.py:712`), so every downstream consumer sees the
  residual: `classify_intent` (`router.py:665`), `_is_multi`/supervisor
  (`agents.py:750`), `route_intent_and_plan` (`agents.py:785`),
  `detect_adversarial_prompt` (`agents.py:852`), the conversational fallback
  (`agents.py:815`), and `retrieve_memory_and_vault_context` (`agents.py:634` —
  strip before retrieval; D-2 strip-before-retrieve ordering). Threading:
  `UserRequest.pinned_skill` (`router.py:110-121`) → copied into `AgentRequest`
  (`router.py:814`; new field `loop.py:431`) → `_try_react_loop` passes into
  `build_skill_directive(pinned_skill=…)` (`loop.py:1523`); stream builder
  passes it at `agents.py:888`. Supervisor inherits via stripped message only; a
  pin routed to the supervisor records provenance
  `applied=false, reason=supervisor_route` (D-5) — never silent. Semantics: a
  row whose resolved name == pinned slug is eligible **regardless of trigger
  state**, still subject to `enabled`, prohibited-domain block, granted
  `required_scope`, `markdown_doc`, and the shared budget drop (bypasses the
  trigger gate only). Unknown slug → `SkillSkip(slug, "pinned_unknown")` + log
  `SKILL_INJECTION pinned_unknown=<slug>`; no error, no 500. Pinned + budget
  drop → skip reason `token_budget_exceeded` and pin provenance records
  not-applied. Malformed vectors (`/skill:`, `//skill:x`, `/skill:../`, case
  variants, leading whitespace, pin-not-leading) → residual unchanged,
  `slug=None`, `malformed=True`; frozen as vectors in C3/E2. Pin==trigger row
  injects once (single-pass loop — no double-injection). **Pin provenance
  (H5):** record pin outcome (`requested` + `applied` + gate reason when not) in
  run provenance; non-blocking chat notice when a `/skill:` pin is not applied
  (minimum: provenance only — taste #14 / T10).
- C3. Tests: pinned skill injects without trigger match; unknown slug harmless;
  `/skill:` no longer pollutes classified text; negative controls for each pin
  gate.

### D. Backend completion

- D1. **Static-path parity → replaced with a documented non-goal (Eng).** The
  static fallback (`loop.py:2587-2616` → `_dispatch_agent` `loop.py:2661+`,
  per-agent if/elif over ~22 agents) has **no shared prompt-assembly seam** —
  injecting there means editing N agent implementations (unbounded blast radius)
  for a path that runs only when ReAct fails or is disabled
  (`agent_react_enabled` defaults True, `config.py:213`). Instead: (a) document
  "skills apply on the ReAct act-path only" in the author contract (E4); (b)
  provenance pin: static-fallback runs carry `skill_directive=not_applied`
  (non-blocking; today the SKILL_INJECTION log is simply absent —
  indistinguishable from a no-matching-skills run); (c) test pin: static path
  (react disabled) asserts no directive claim + the provenance marker.
  `usage_run_id` note: the ReAct pass-site already passes
  `usage_run_id=request_id` (`loop.py:1529`) — nothing to change (satisfies the
  DX-6 correction).
- D2. Fix stale comments: `skill_injection.py:109-117` budget rationale (cite
  the measured **28** entries, recompute or date-stamp) and
  `skill_injection.py:226-227` docstring citing dead `loop.py:1331` — actual
  pass-site is `loop.py:1529` (the loop DOES pass `usage_run_id=request_id`
  today; over-count only occurs for callers that omit it, i.e. the H1 probe by
  design).
- D3. Replace dangling `check_catalog_fidelity.py` reference with the real
  enforced invariant (`test_skill_catalog` disk⊆catalog pin).
- D4. `markdown_doc` size cap (256KB, matching GitHub sync) on create/update
  → 400.
- D5. HTTP test for `POST /capabilities/sync-github`: owner-only 403,
  `extra="forbid"` 422, rate limit, mocked success.
- D6. Typed response model for `GET /capabilities/catalog`.
- D7. Reword exact overclaim UI strings ("Triggers routed via:", "Cross-Page
  Agent Wiring") to match runtime truth (trigger-gated, agent-agnostic;
  `agent_name` param in `build_skill_directive` documented as reserved) — plus a
  copy regression test.
- D8. Defensive LIMIT guard on `GET /capabilities` (hard cap, e.g. 500, with
  explicit truncation signal) — pagination itself stays deferred.
- D9. **Token-budget display honesty** (`SkillPlaygroundDrawer.tsx`): stale
  hardcoded `1500` fallbacks (lines 115/156) and static copy "1,500 tokens"
  (line 329) vs the runtime constant `SKILL_DIRECTIVE_TOKEN_BUDGET = 4000`
  (`skill_injection.py:131`). Render the server-reported `token_budget` when
  present (endpoint reports it, `capabilities.py:1849`); make fallback + copy
  consistent with 4000 semantics or show "—" when unknown (taste #9 / T5).

### E. Proof — tests + docs

- E1. Integration test: install skill via API → run the real agent path (mock
  LLM fixture) → assert injected directive text reached the compiled prompt
  layer and `usage_count` incremented. **Eng additions: T-1** — unit-assert the
  injection call opens `scoped_session` with
  `(workspace_id, tenant_id, user_id)` and reads rows with request `db=None` and
  with a closed-session db; **explicit boundary note: PG policy behavior is not
  provable on SQLite** (optionally a PG-marked case via the `verify:pg` harness
  — taste #18). **T-2 (P0, fail-before/pass-after):** buffered-path parity —
  POST `/agents/chat` (and the `/orchestrator` chat path) with a pinned skill
  reaches the directive; this test FAILS before C0 and passes after.
- E2. **Full pin-gate matrix**: pinned skill reaches the prompt without trigger
  match; each gate (disabled / scope-missing / trust-ceiling / budget-exhausted)
  produces a hard, named exclusion. **H6:** assert the frozen `/skill:` parse
  contract at all three builders (`chat.py:80`, `agents.py:650`,
  `agents.py:708`) and probe↔runtime agreement (same gate verdicts via H1 as via
  the loop — via the shared evaluator). **Eng additions: T-3** stream
  early-strip — supervisor `_is_multi`, `route_intent_and_plan`, and
  `detect_adversarial_prompt` receive the residual (no `/skill:` visible
  upstream); **T-4** probe records no usage (exact count assertion, including
  with `input.pin`); **T-5** probe↔runtime agreement across the full gate matrix
  (one code path — structural); **T-7** pin==trigger skill injects once + pinned
  budget-drop names the skill in `skipped` and in provenance.
- E3. Frontend jest: sort-null ordering (B4); index redirect; launch-URL
  includes `skill=`; playground live-row behavior; null-safe agent mapping;
  shared trigger-matcher matrix; **error-state spec for the subpage
  (server-error vs not-found) with retry assertion; containment regression for
  the simulator modal; IA pins (Open Full Page link, mobile pane swap); copy
  regression for B8/D7/D9**.
- E4. Docs (strengthened per H3): full author contract in
  `docs/API_REFERENCE.md` — Capabilities endpoint group; skill frontmatter
  fields; trigger semantics; gate table (enabled/domain/scope/trust/budget);
  **frozen `/skill:<slug>` syntax**; **the D1 non-goal stated explicitly
  ("skills apply on the ReAct act-path only; the static fallback carries
  `skill_directive=not_applied`")**; install paths; copy-paste quickstart; "add
  catalog skill #29" maintainer runbook.
- E5. Update `AGENTS.md` only if an invariant it states changes (truth-keeping).
- E7. Jest pin: frontend seed skill slugs vs an explicit allowlist — the offline
  seed is a fallback, not a catalog mirror (seed currently carries
  engineering-tooling slugs the backend catalog deliberately excludes); pin so
  drift is visible (H4).

### G. Memory bridge (new — CEO expansion; gate-taste #1)

- G1. `conversation_service.py:239`: stop discarding `/skill:` turns outright —
  strip the pin token via the shared helper, add `"skill_slug": slug` to the
  metadata dict (`:283`) as provenance, and ingest the residual message under
  existing auto-memory rules; pure `/skill:x` → empty residual → skipped exactly
  as today. Site confirmed (Eng): caller gate `:210` (user role, `len > 10` —
  `/skill:abcdef` = 13 chars passes), `<15` return `:234-236`. Tests (T-6): 3
  vectors + provenance present + non-`skill` slash commands unchanged.

### H. DX — skill-author surfaces (new — DX phase)

- H1. **Gate dry-run probe** (P1): extend `POST /capabilities/{id}/test` for
  skills with an optional `message` (+ optional `input.pin`) — evaluate the real
  gates in order (enabled → domain → scope → pin → trigger → budget), return
  per-gate verdicts + directive preview. **CORRECTED (Eng):** "pass no `run_id`"
  does NOT disable telemetry — `record_injected_usage` records + warns on
  `run_id=None` (`skill_injection.py:577-581`, call `:661`) and the endpoint
  calls `record_usage` unconditionally (`capabilities.py:1680-1681`, before any
  category branch). Fix = extract a pure evaluator
  `evaluate_skill_gates(rows, granted, haystack, pinned, budget) -> (injected, skipped)`
  from `build_skill_directive`: runtime wraps it and records usage; the probe
  calls the evaluator and never records; the endpoint skips `record_usage` for
  skill message-probes. This makes probe↔runtime agreement **structural** (one
  code path), not a duplicated-logic test. Probe is per installed workspace row
  (`cap_id`); catalog-only skills are not probeable — note it, don't widen
  scope. Return shape: per-gate verdict list reusing `SkillSkip.reason/detail` +
  directive preview + explicit `recorded_usage: false`. Endpoint confirmed
  (`capabilities.py:1630`, skill branch `:1773-1862`, rate-limited 10/min
  `:1634`; `input.message` already accepted `:1789-1791`). (taste #11 / T11 —
  extend `/test`, no new endpoint, never client-side gates.)
- H2. **Actionable scope errors** (P1): the 400 for invalid `required_scope`
  must enumerate the valid vocabulary — embed
  `sorted(tool_scope_vocabulary())` + point at
  `GET /capabilities/tools/definitions` (autonomy/trust 400s already enumerate
  theirs). (taste #12 / T12 — embed all ~25 scopes + pointer.)

### F. Verification gates (run in order, from repo root)

- F1. `pnpm typecheck` and `pnpm lint`.
- F2. `cd apps/web && npx jest` (full web suite).
- F3. Backend serial scoped:
  `uv run --project apps/api python -m pytest apps/api/tests/test_skill_*.py apps/api/tests/test_capabilities*.py apps/api/tests/test_orchestrator.py apps/api/tests/test_react*.py -q -o addopts=""`;
  then full serial `apps/api/tests/ -q -o addopts=""` if runtime is acceptable;
  report honestly either way.
- F4. API-level real-path E2E through the FastAPI app (httpx AsyncClient):
  create → install → pin → run → evidence; note mock-LLM boundary explicitly.
- F5. Wire `python scripts/gen_tokens.py --check` into
  `.github/workflows/ci-frontend.yml` (token drift currently has no CI gate).
- F6. **Browser pass** on the skills surfaces at 375 / 768 / 1280 (playwright
  tool): capture before/after evidence for A1–A6 changes; manual by nature —
  record honestly.

## Execution topology (Eng-corrected — file ownership is the unit of disjointness)

1. **W0 (serial, ONE owner) — contract + seam freeze:** `parse_skill_pin`
   helper + **F-0 scoped-session fix (C0)** + `pinned_skill` threading +
   `evaluate_skill_gates` extraction + deliberate test-contract update
   (`loop.py:1512` pin) + C2/E2 frozen vectors. Files: `routers/chat.py`,
   `routers/agents.py`, `orchestrator/router.py`, `orchestrator/loop.py`,
   `services/skill_injection.py`, `tests/test_skill_injection*.py`,
   `tests/test_orchestrator.py`. Tests green before any parallel work.
2. **W1 (parallel, disjoint file sets):**
   - **Agent-1 Frontend components:** A1–A9, B5, B6, B8, C1, C1b, D9, ui-kit
     icons; **B10 IA-contract doc + pins authored FIRST in this agent**, before
     B5/B6 refactors touch the surfaces. Files: `components/**/skill*`,
     `SkillIntegrationBar.tsx`, `ChatWindow.tsx`, `TriggerSimulatorModal.tsx`,
     `SkillPlaygroundDrawer.tsx`, ui-kit icon set, new shared matcher module.
   - **Agent-2 Frontend pages:** B1, B2, B3, B7, B9 + page-level jest. Files:
     `app/**/capabilities/skills/**` (new), `route-manifest.ts`, subpage
     `loading.tsx`/`error.tsx`.
   - **Agent-3 Backend extensions (depends on W0):** D2–D6, D8, H1, H2, G1 +
     tests. Files: `routers/capabilities.py`, `routers/agents.py`
     (capabilities/test branch — different hunk from W0's chat builders),
     `services/conversation_service.py`. Collisions from the old partition
     resolved: `TriggerSimulatorModal.tsx` single owner = Agent-1;
     `SkillPlaygroundDrawer.tsx` single owner = Agent-1 (B5/B8/D9 together);
     C1/C1b now have an owning bucket.
3. **W2 (serial) — proof:** Agent-4 owns E1, E4, E5, E7 + T-1…T-7 additions;
   then **F1→F6 strictly serial** after ALL writers stop — no fix-forward while
   a parallel agent is writing.

## Taste decisions collected (for final approval gate)

1. **G1 depth** — strip + extract + provenance ingest (rec) vs strip-only vs
   defer.
2. **Pinning trust** — any enabled + scope-passing class incl. `untrusted` (rec)
   vs first-party/community only.
3. **B4** — test-only + correct audit (rec) vs change comparator to match the
   report.
4. **ADR-047 minimal** this pass (rec) vs defer. (ADR-046 is taken —
   `ADR-046-capabilities-ownership-authorization.md` exists.)
5. **Trust filter** — all 7 (rec) vs keep 2 with rationale.
6. **Pagination** — keep deferral + D8 LIMIT guard (rec) vs pull full pagination
   in.
7. **T2 emoji/icon strategy** — add `MessageIcon` + `ZapIcon` to ui-kit (rec) vs
   substitute nearest existing icons.
8. **T3 selection convention** — `--surface-selected` fill, drop
   `text-primary` + left border (rec) vs keep current.
9. **T5 token number** — server-driven display with 4000-consistent fallback
   (rec) vs drop the number from copy entirely.
10. **T4 draft conflict** (from C1) — prefill-overwrite with confirm (rec) vs
    append.
11. **T10 pin-failure visibility** — provenance + subtle chat notice (rec) vs
    provenance only.
12. **T11 probe surface** — extend `/test` (rec) vs new endpoint (client-side
    gates are banned — drift).
13. **T12 scope-error verbosity** — embed all ~25 scopes + pointer (rec) vs
    terse.
14. **H1 H2 latency** — probe + scope-errors included this pass (rec) vs
    fast-follow.
15. **F-0 fix shape (Eng)** — `scoped_session` per injection (rec) vs re-init
    GUCs on the request session (rejected: relies on session-reuse semantics
    after close).
16. **D1 replacement (Eng)** — documented non-goal + provenance pin (rec) vs
    attempted static parity (rejected: unbounded per-agent edits) vs drop D1
    entirely (rejected: loses the honesty pin).
17. **Wave-0 scope (Eng)** — absorb F-0 + evaluator + pin into ONE serial wave
    (rec) vs ship pin first and fix F-0 as a follow-up (rejected: pinning is
    dead on PG without F-0 — shipping an inert feature behind green SQLite tests
    is the dishonest option).
18. **E1 evidence boundary (Eng)** — SQLite + mock-LLM with explicit boundary
    note (rec, repo convention) vs add a PG-gated live injection test to the
    `verify:pg` harness this pass (stronger, slower — if chosen, scope it to the
    F-0 read path only).

## Deferred (explicitly out of this pass)

- Full pagination / server-side search for capability lists (D8 guard only).
- Version history table + rollback UI; analytics/run-history UI beyond the card.
- GitHub sync persistence + scheduling.
- Phase-contract / ADR / prose architecture docs for workspace skills (ADR-046 =
  gate).

## Risks

- **F-0 (P0, top risk):** injection is silent-inert on PG until C0 lands —
  mitigate: W0 first (serial, one owner), T-1/T-2 fail-before/pass-after pair,
  deliberate documented update of the `loop.py:1512` contract pin.
- **D1:** replaced by non-goal + provenance pin — no orchestrator-fallback edits
  in this pass (old "mirror the ReAct block exactly" risk removed).
- **C2** touches message classification at 3 builders — mitigate: shared helper
  strips before `full_message` composition so the router never sees the token;
  tests for `/skill:` + normal text, distress guard, malformed vectors.
- **G1** touches conversation ingestion — mitigate: provenance field + skip-rule
  tests; rollback = revert one call site.
- **A2/A1** replace interactive primitives — mitigate: keep DOM contracts
  (roles, labels) that existing tests query; run component suites after each
  swap.
- Dirty tree: work only in files named in this plan; never `git add -A`.

## Review pipeline status

- Phase 0 intake: complete (audits + this plan).
- Phase 1 CEO: **complete** — mode SELECTIVE EXPANSION; 1 audit claim falsified
  (sort), C2 widened to 3 sites, G1 memory bridge added, A9/B8 amended. Review:
  `skills-feature-review-ceo.md`.
- Phase 2 Design: **complete** — overall 7.0 → projected 8.8; A1–A4/A8
  sharpened, B8/B10/D9/E3/F6 amended. Review: `skills-feature-review-design.md`.
- Phase 3 DX: **complete** — 5.5 → projected 7.5; workstream H added (H1 gate
  dry-run probe, H2 scope errors), H3→E4, H4→E7, H5→C2, H6→E2; DX-6 partially
  falsified (loop passes usage_run_id today; stale docstring only). Review:
  `skills-feature-review-dx.md`.
- Codex dual voice: **unavailable** (CLI not installed) — single-voice;
  degradation documented.
- Phase 4 Eng: **complete (final)** — verdicts: C2 amended (no single seam —
  shared helper at 3 sites; "Verified facts" corrected), D1 replaced (non-goal +
  provenance pin), H1 corrected (evaluator extraction, NOT "no run_id"), G1
  confirmed feasible, **F-0 (new P0) — injection inert on PG request paths**
  (re-verified this session by direct reads, code-trace confidence high; runtime
  PG proof deferred to taste #18/T-1). Execution topology corrected to
  file-owned W0/W1/W2; taste decisions +15–18. Review:
  `skills-feature-review-eng.md`.
- **All four review phases complete → single final approval gate (18 taste
  decisions, 16 with recommendations) before implementation.**

## Taste decision carry-notes (fresh-agent context, if this plan resumes cold)

- T11/T12 (DX), T2/T3/T5/T4 (Design), T10/T14 (CEO/DX pin-visibility), T-1…T-7
  (Eng) are folded into workstream items above — the gate only needs the 18
  numbered items.
- Probe and runtime MUST share `evaluate_skill_gates` — do not re-derive gate
  logic in the endpoint. Telemetry must stay off for probes
  (`recorded_usage: false`).
- The `loop.py:1512-1513` comment + its call-count test pin the OLD contract;
  updating them is part of C0, not an accident.
