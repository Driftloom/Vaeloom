# Skills Feature — DX Review (Phase 3)

Date: 2026-10-18. Phase: Developer Experience review of
`skills-feature-master-plan.md`, run after the CEO review (phase 1) and Design
review (phase 2). Commit: not captured (no git commands per session
constraints).

## Degradation note

- **Codex dual-voice UNAVAILABLE.** Single-voice review with an explicit
  self-falsification pass (below), same substitution the Design phase used.
- **No live competitive web scan.** The 0C benchmark leans on prior knowledge of
  Claude Agent Skills, Claude Code slash commands, and GPT Actions; it is
  flagged as unverified in-session.
- **TTHW is inferred from plan + code inventory, not measured.** There is no
  running app and this is a plan review; every minute figure below is marked
  inferred. No fabricated measurements.
- **No review-log JSONL / gstack persistence.** Sole-artifact rule (same as
  prior phases).

## Method

Plan-review mode (pre-implementation). Persona, empathy narrative, four pass
questions, scorecard, findings, amendments (H-series), falsification, taste
decisions routed to the gate. Primary "developer" for this phase is the **skill
author** — the Vaeloom engineer or power user who writes a markdown skill pack
and must get it to fire; secondary is the API/integration consumer; tertiary is
the maintainer adding catalog skill #29.

### Persona (0A)

**Maya, workspace power user / internal skill author.** She has the workbench
open, a markdown doc with Mission / Operating Rules / Triggers / Output
Contract, and one question after every edit: _"did it actually fire, and if not,
which gate stopped it?"_ Today the answer lives in server logs she cannot see.
Her mental model: save → get a verdict → use it — not "read the API reference
and tail the orchestrator".

### Empathy narrative (0B)

Maya edits her doc, clicks Validate, and gets structured violations with rule
ids and line numbers — genuinely good. She installs the skill, opens chat, types
her trigger phrase. Something fires... or nothing does. No chip, no notice, no
badge. She checks usage count — 0. The skill could be disabled, out of scope,
trigger-unmatched, or budget-dropped; the only artifact that distinguishes these
is `SKILL_INJECTION ... skipped=<skill>=<reason>` in server logs
(`loop.py:1542-1549`). Maya gives up and asks an engineer. The feature's gate
architecture is _stronger_ than the competition (scope, trust, budget, domain
policy) and _less legible_ than all of it.

### Competitive benchmark (0C) — prior knowledge, not verified in-session

| System                       | Authoring loop                                | Failure legibility             | Gate richness             |
| ---------------------------- | --------------------------------------------- | ------------------------------ | ------------------------- |
| Claude Agent Skills          | folder + SKILL.md, in-session errors          | errors surface in the session  | none (no runtime gates)   |
| Claude Code slash commands   | command file; unknown command = visible error | visible in UI                  | none                      |
| OpenAI GPT Actions           | builder UI with live debugger                 | debugger shows call traces     | auth-level only           |
| **Vaeloom (today)**          | validate + install; last mile log-gated       | **server logs only**           | **highest**               |
| **Vaeloom (after H1/H2/H5)** | probe proves firing in-app                    | per-gate verdicts + pin notice | unchanged (still highest) |

Competitive rank: **Needs Work** on failure legibility today → **Competitive**
after the amendments. Champion is reachable once the probe lands because the
gate layer is the differentiator. Product type: internal developer tool. Mode:
**POLISH** (two bounded additions, no scope expansion beyond the H-items).

## What already exists (reuse, do not rebuild)

1. `POST /capabilities/validate` + structured violations (`rule`, `message`,
   `line`, `severity`) — rendered in `AddCapabilityModal.tsx:1297-1362`. Rule
   example:
   `SKILL-PLACEHOLDER "Unresolved placeholder {label} on line {line_no}"`.
2. `POST /capabilities/{cap_id}/test` with honest `executed=false` semantics;
   skills take the validation-only branch (`capabilities.py:1647-1649`), so it
   stays open to members and needs no owner gate. Rate-limited 10/min.
3. `GET /capabilities/tools/definitions` (`capabilities.py:941-963`) already
   emits `required_scope` per tool — the scope vocabulary exists as an API.
4. `SkillSkip(name, reason, detail)` (`skill_injection.py:303-307`) — the skip
   objects **already carry human-readable detail strings** ("enabled is false",
   "skill declares no required_scope", ...) produced at
   `skill_injection.py:602-647`. A probe can return these strings verbatim; no
   new taxonomy needed.
5. Catalog self-check: every entry must pass its own validator
   (`test_skill_catalog.py:229`), on-disk docs must be catalog members
   (`:115-131`), catalog size pinned at 28 (`:95`), no engineering tooling
   (`:98-113`).
6. Trigger-matcher tests (12 in `test_skill_trigger_matching.py`) and 63 in
   `test_skill_catalog.py`; F3 already scopes their command.
7. B7 offline provenance, B8 shared matcher, D9 budget-honesty, F6 browser pass
   — all planned; do not duplicate.
8. Usage telemetry: `record_injected_usage` counts injected skills per
   workspace+run (`skill_injection.py:199-228`, called at `:661`).

## DX scorecard (initial → projected, amendments applied)

| Pass | Dimension                    | Initial | Projected | What a 10 looks like for THIS plan                                                                                                     |
| ---- | ---------------------------- | ------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Getting Started              | 6.0     | 8.0       | Author goes from blank doc to _proven_ firing in one in-app loop (validate → probe → install → chat), no server logs, ~20 min inferred |
| 2    | API/CLI/SDK                  | 5.5     | 7.5       | One probe endpoint answers "would this fire?"; vocabulary endpoint referenced from errors; typed catalog response (D6)                 |
| 3    | Error Messages               | 5.5     | 8.0       | Scope error lists valid scopes like its siblings; every gate denial has a reason string reachable without logs                         |
| 4    | Documentation                | 3.0     | 7.5       | API_REFERENCE carries the full author contract (fields, sections, gates, pin syntax, quickstart); "add a catalog skill" runbook exists |
| 5    | Upgrade Path                 | 6.0     | 6.5       | Version drift between installed row and catalog entry is at least _visible_; reinstall action explicitly deferred                      |
| 6    | Dev Environment (maintainer) | 6.5     | 8.0       | Skill #29 path documented and pinned in both stacks; fallback seed cannot drift silently                                               |
| 7    | Community                    | N/A     | N/A       | Internal feature; no external ecosystem dimension                                                                                      |
| —    | **Overall**                  | **5.5** | **7.5**   | Mean of scored dimensions (7 of 8; Community N/A)                                                                                      |

```
TTHW (inferred, not measured): author-to-verified-firing
  today:   unbounded (last mile requires server-log access)
  after H1: ~20 min target
Install-a-catalog-skill path (inferred): ~5 min
Magical moment: "prove it fired, in-app, on my own message"
  vehicle: H1 probe + H5 pin provenance + telemetry card — currently MISSING
DX principles:  Zero Friction (gap, H1) | Learn by Doing (gap→H1) |
  Fight Uncertainty (gap→H2/H3/H5) | Opinionated + Escape Hatches (covered:
  defaults + raw POST/MD paths) | Code in Context (covered: markdown) |
  Magical Moments (gap→H1)
```

## Findings

### DX-1 (P1, observability): gate verdicts are born in the loop and die in logs

Single production call site `loop.py:1523`; the skips are consumed only by
`logger.info` at `loop.py:1542-1549`. Reason codes exist and are complete
(`skill_injection.py:602-647`: `disabled`, `domain_policy_exclusion`,
`no_required_scope`, `scope_not_granted`, `no_markdown_doc`,
`trigger_not_matched`, `token_budget_exceeded`) — none of them reach any API
response, UI surface, or per-row store (searched consumers; loop.py is the only
reader of `.skipped`). After D1, the fallback path will at best mirror the
logging. The C2 `pinned_unknown` log inherits the same problem. → H1.

### DX-2 (P1, error vocabulary): the scope error doesn't teach

`capabilities.py:1168-1183`: the `required_scope` 400 names the offender and
explains the consequence but lists no valid values — while its sibling errors
enumerate theirs (`:1186-1190` autonomy, `:1192-1197` trust_class). The
vocabulary is real and measured this session: 25 distinct scopes across 67 tool
definitions (`tools/definitions.py`), canonically served by
`GET /capabilities/tools/definitions` — which nothing in the error or UI
references. The most frequent rookie mistake is the one error with the least to
copy from. → H2.

### DX-3 (P1, documentation): zero author-facing documentation exists

`docs/API_REFERENCE.md` (≈21 KB) has endpoint groups for Health, Auth,
Workspaces, Agents, Memory, ..., Plugins — **there is no Capabilities group at
all** (verified TOC). `required_scope` appears in docs only in ADR-046,
`docs/ai/MCP.md`, the generated OpenAPI, and the audit. Plan item E4 is a single
line ("add workspace-skills section") and understates the contract an author
needs: frontmatter fields, required doc sections, trigger semantics, the gate
table, the `/skill:` syntax, install paths, a quickstart, and the maintainer
runbook. → H3.

### DX-4 (P1, contract): `/skill:` is a UI-first promise the backend doesn't keep yet

Frontend today: popup inserts `/skill:<slug>` (`ChatComposer.tsx:134`), a regex
`^\/skill:([a-zA-Z0-9_-]+)` drives the active-skill chip
(`ChatComposer.tsx:119,455-475`), deep-links build the same token
(`ChatWindow.tsx:97-101`). The token is then sent as plain message text — the
backend has no parser (grep of `apps/api`: none). `conversation_service.py:239`
drops every `/`-prefixed turn from memory ingestion wholesale (that is G1). So
the chip is UI state, the promise is cosmetic, and the token even pollutes
trigger matching today. C2 fixes the server side; what C2 does not yet fix: the
unknown-slug outcome stays log-only, and the exact parse contract
(leading-token-only, charset, strip-before-classification, lowercase slugs vs
the frontend regex allowing uppercase) is not frozen anywhere. → H5
(visibility), H3(e) (contract text), H6 (E2 pins it).

### DX-5 (P1, feedback loop): there is no way to ask "would this message inject this skill?"

`/test` for skills validates the document only (`capabilities.py:1647-1649`).
The playground drawer re-runs validation, not injection. The author's actual
question — given _this workspace's_ enables, scopes, trust, and _this message's_
triggers and budget, would this skill reach the prompt? — has no in-app answer.
This is the single biggest TTHW lever and the reason Getting Started only
projects to 8. → H1.

### DX-6 (P2, honesty + telemetry): a naive probe would inflate usage counts, and the docstring it would mislead against is stale

`record_injected_usage` counts **every injection** when `run_id` is None, with a
WARNING (`skill_injection.py:220-228`). Any probe built on
`build_skill_directive` without a telemetry guard would silently inflate
`usage_count`. Worse, that same docstring claims "Until the loop passes
`usage_run_id=request.id` at `loop.py:1331`" — the loop _does_ pass it, at
`loop.py:1529`; the referenced line is stale. → H1 (guard is an acceptance
criterion), H2b (fix docstring, or fold into D2 which fixes the sibling stale
comment at `skill_injection.py:109-117`).

### DX-7 (P2, maintainer): adding skill #29 has no runbook, and the frontend fallback seed is unpinned

Backend path is good: catalog entry + doc + self-check + two deliberate pins
(`== 28` count, disk⊆catalog) force attention. But nothing documents the steps,
and the frontend seed (`capabilities-data.ts`) carries **39 skill rows**
(measured this session) including engineering-tooling slugs the catalog
explicitly bans (`skill-agent-building`, `skill-check-work`,
`skill-ui-ux-pro-max` — `test_catalog_contains_no_engineering_tooling`,
`:98-113`). The seed is a fallback/showcase list, not a catalog mirror — so a
maintainer must _know_ which is which; no test expresses the relationship, so
the fallback can drift silently. B7 labels provenance but does not pin it. →
H4 + H3(h).

### DX-8 (P2, upgrade path): installed skill docs snapshot the catalog with no drift surfacing

Rows carry `version` (`capabilities.py:306`, `:374` shows catalog version), but
nothing compares an installed row's doc/version against the catalog entry, and
no "update from catalog" action exists. An author's v2.1.0 fix never reaches
workspaces that installed v2.0.0 unless someone reinstalls. Cheapest honest
step: show version/doc drift on the detail surface (display only) + document the
gap; the update action is a real feature, deferred. → deferred item, see below.

### DX-9 (P2, API completeness): the GitHub-sync authoring flow dead-ends at "here is JSON, go POST it"

`POST /capabilities/sync-github` validates remote playbooks but persists nothing
(`capabilities.py:1930-1934` docstring is explicit). For the repo-of-SKILL.md
authoring workflow the loop terminates in a manual copy step. Full
install-from-candidates UI is out of scope this pass; the copy-paste handoff
(exact `POST /capabilities` body) belongs in the H3 guide. → H3(f).

## Plan amendments (by item id)

New items use the H-series (A–G taken by design/CEO phases; F by verification).

| Item                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1 (new, P1)           | **Skill probe.** Extend `POST /capabilities/{cap_id}/test` for `category == "skill"` with optional `message`: dry-run the real gate pipeline — enabled → domain policy → scope (caller grants vs `required_scope`) → pin-gate (per C2) → trigger match (with hit count, B8 matcher) → token budget — and return per-gate verdicts + the directive preview (fenced block as it would appear). MUST execute nothing (no LLM, no tool dispatch) and MUST NOT record usage: add a telemetry-off parameter to `build_skill_directive` (do **not** rely on `run_id=None`; it over-counts per DX-6). Reuse `SkillSkip.reason`/`detail` verbatim. UI: gate rows in `SkillPlaygroundDrawer`. Acceptance: probe agrees with actual injection for every skip code; `usage_count` unchanged after probe.                                                                                                                                                                                                |
| H2 (new, P1)           | **Error vocabulary parity + stale docstring.** `required_scope` 400 (and the validate-ledger scope rule) include `sorted(tool_scope_vocabulary())` — sibling enum errors already embed their sets — plus pointer "canonical list: `GET /api/v1/capabilities/tools/definitions`". Also fix `skill_injection.py:220-228` (loop passes run id at `loop.py:1529`, not 1331; over-count caveat now applies only to non-loop callers such as the new probe) — or hand to D2 which fixes the sibling stale comment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| H3 (strengthen E4, P1) | **E4 becomes the author contract.** (a) New "Capabilities (workspace skills)" endpoint group in `docs/API_REFERENCE.md`; (b) authoring guide: frontmatter fields (slug/name/description/tags/version/required_scope/autonomy/trust_class), required doc sections + placeholder rule; (c) trigger semantics = token-set matcher with filler tolerance (post-B8); (d) gates table: every `SkillSkip` reason code + pin-gate reasons + what the user sees; (e) `/skill:` frozen contract from C2: leading token only, slug charset `[a-z0-9-]`, strip-before-classification at all three builders, unknown slug = logged + user-visible per H5; (f) install paths incl. sync-github → exact `POST /capabilities` handoff (DX-9); (g) copy-paste quickstart (validate → create → probe (H1) → chat) with expected outputs; (h) "Adding a catalog skill #29" runbook: files to touch, the two pinned counts (`test_skill_catalog.py:95`, disk⊆catalog), seed-vs-catalog rule (DX-7), F3 command. |
| H3c (new, P1)          | **ADR number collision.** Plan lines 211/227 say "ADR-046" but `docs/adr/ADR-046-capabilities-ownership-authorization.md` already exists. The skills ADR becomes **ADR-047** (or the contract lives in the H3 doc and the ADR defers — see T13).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| H4 (new, P2)           | **Maintainer pins.** Add one jest pinning `capabilities-data.ts` seed skill slugs against an explicit allowlist (seed ≈ fallback/showcase, catalog = career-facing server truth), so the fallback cannot drift silently (DX-7). No behavior change; complements B7 (provenance labels) and H3(h).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| H5 (amend C2, P2)      | **Pin-failure visibility.** C2's unknown-slug (and pin-gate denial) currently ends at the `SKILL_INJECTION pinned_unknown=` log. Include pin outcome (requested vs applied + reason) in the run response/provenance, and render a non-blocking chat notice ("/skill:x was not applied — <reason>") when a requested pin did not apply. Minimal acceptable fallback: provenance field only. See T10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| H6 (amend E2, P2)      | **Pin matrix asserts the frozen contract.** E2 must pin, at all three builder sites: leading-token-only parse, charset, strip-before-classification, unknown-slug proceeds, and probe (H1) agreement with real injection for the pin path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Amend D2               | Optional fold-in: DX-6's stale docstring is the same defect class as D2's (`skill_injection.py:109-117`); fix both in one item if convenient.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Deferred (explicit, with recommendation): **DX-8 upgrade path** — display-only
version/doc drift badge on the skill detail surface; full "update from catalog"
action deferred with the update-flow feature. **DX-9 install UI** — copy-paste
handoff documented (H3f); candidates-install UI deferred. **DX-probe for
non-skill categories** — out of scope; probe is skill-gated.

## Falsification pass (substitute for Codex dual-voice)

1. "Skip reasons may already surface somewhere else (API/DB/telemetry)."
   **Falsified as a concern — claim holds.** Searched all service/router
   consumers of `skipped`; `loop.py` is the only reader; telemetry counts
   injected only.
2. "The streaming loop lacks skill injection while the standard loop has it — a
   bigger gap than D1." **Partially falsified.** Both paths reach
   `_try_react_loop` via `_act_phase_inner` (`loop.py:2563`, gated on
   `agent_react_enabled`); injection lives inside `_try_react_loop`. The real
   parity gap remains the non-ReAct fallback — already D1. No new finding.
3. "The frontend seed is a catalog mirror, so every catalog change needs a
   frontend change." **Falsified.** The seed contains engineering-tooling slugs
   the catalog bans; it is a fallback/showcase list. Downgraded to a drift-pin
   (H4), not a mirror requirement.
4. "The playground is already a sandbox, so TTHW is short." **Partially
   falsified.** The drawer exists but validates only; no injection proof. This
   is why Getting Started projects to 8, not higher.
5. "`usage_run_id=None` is a safe probe path." **Falsified.**
   `record_injected_usage` over-counts with a WARNING when no run id is
   supplied; the probe needs an explicit telemetry-off flag (H1).
6. "E4 as written is sufficient." **Falsified by the doc audit.** No
   Capabilities group exists in API_REFERENCE at all; "add a section"
   understates the contract. Strengthened H3.
7. TTHW figures could not be verified live (plan review, no running app); they
   remain labeled **inferred**. No number in this review was measured by running
   the product.

Residual uncertainty: the validate-ledger scope rule's exact message was not
re-read this session (only the 400 path verified) — H2 applies to both, so the
gap is covered either way. Probe agent-context selection (which `allowed_scopes`
set) is an implementation decision flagged in H1; default to the same agent
context the chat path uses, expose an `agent` param only if C2's pin-gate needs
it.

## Taste decisions for the gate (recommendations attached; never blocking)

| #   | Decision                    | Options                                                                                                      | Recommendation                                                                                                                                                                                                             |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T10 | Pin-failure visibility (H5) | (a) silent + logged, plan as-is; (b) provenance field in response only; (c) provenance + subtle chat notice  | **c.** The state is already computed at zero marginal cost; a typed `/skill:` token that visibly does nothing is the exact confusion this phase exists to kill. (b) is the acceptable minimum if wave-0 must stay smaller. |
| T11 | Probe surface (H1)          | (a) extend `POST /{cap_id}/test`; (b) new `/probe` endpoint; (c) client-side re-implementation of gates      | **a.** Existing endpoint, existing authorization story (skills run nothing), existing rate limit. (c) re-creates the drift B8 just eliminated.                                                                             |
| T12 | Scope-error verbosity (H2)  | (a) embed all scopes + endpoint pointer; (b) endpoint pointer only                                           | **a.** Sibling enum errors embed; the list is ~25 short strings today (measured); copy-paste beats a lookup for the highest-frequency rookie error.                                                                        |
| T13 | Skills ADR (H3c)            | (a) minimal ADR-047 now (pin contract + probe + gate observability); (b) defer, contract lives in the H3 doc | **b** unless C2/D1 land this cycle, then (a). Supersedes the number in plan line 211: whatever the timing, it cannot be ADR-046 (taken).                                                                                   |

## NOT in scope

- Full install-from-candidates UI for GitHub sync (H3f documents the handoff;
  DX-9).
- "Update from catalog" action for installed skills (DX-8 deferred with a
  display-only recommendation).
- Probe mode for non-skill categories; marketplace/discovery features; RTL /
  i18n; version history — all already deferred or out of feature scope.
- Community dimension: internal feature, no external ecosystem to build.

## Implementation tasks

Estimated effort, labeled as estimates (no measurement possible in this
session).

- [ ] **H1 (P1, human: ~1d / CC: ~1h)** — Skill probe on `/test` with
      telemetry-off dry-run
  - Surfaced by: DX-1, DX-5, DX-6 — gates die in `loop.py:1542-1549` logs
  - Files: `apps/api/src/api/routers/capabilities.py`,
    `apps/api/src/api/services/skill_injection.py`,
    `apps/web/src/components/capabilities/skills/SkillPlaygroundDrawer.tsx`
  - Verify: new tests — probe verdicts match injection for every skip code;
    `usage_count` unchanged after probe; F3 command green
- [ ] **H2 (P1, human: ~1h / CC: ~10min)** — Scope vocabulary in errors + stale
      docstring fix
  - Surfaced by: DX-2, DX-6 — `capabilities.py:1168-1183` lists nothing;
    `skill_injection.py:220-228` cites dead line 1331
  - Verify: unit test asserting the 400 detail contains the vocabulary;
    comment-only change for the docstring
- [ ] **H3 (P1, human: ~4h / CC: ~30min)** — API_REFERENCE author contract +
      runbook (+ H3c renumber)
  - Surfaced by: DX-3, DX-4, DX-7, DX-9 — no Capabilities group exists
  - Verify: doc contains copy-pasteable validate → create → probe → chat
    quickstart; ADR number collision resolved
- [ ] **H4 (P2, human: ~1h / CC: ~15min)** — Seed-slug drift pin
  - Surfaced by: DX-7 — 39 seed skill rows vs 28-entry catalog, no pin
  - Verify: `npx jest` — new spec fails on unlisted seed slug addition
- [ ] **H5 (P2, human: ~3h / CC: ~25min)** — Pin outcome in provenance + chat
      notice (per T10)
  - Surfaced by: DX-4 — `/skill:` failures end at a log line
  - Verify: response carries requested/applied; UI test for the notice
- [ ] **H6 (P2, human: ~2h / CC: ~20min)** — E2 pins the frozen pin contract
  - Surfaced by: DX-4 — parse semantics unfrozen (case, charset, position)
  - Verify: matrix tests at all three builder sites + probe agreement

## Completion summary

```
+====================================================================+
|            DX PLAN REVIEW - COMPLETION SUMMARY                     |
+====================================================================+
| System audit         | API_REFERENCE has NO Capabilities group     |
| Step 0               | persona = skill author; focus = last mile   |
| Pass 1 (Get Started) |  6.0/10 -> 8.0/10 after H1                  |
| Pass 2 (API/SDK)     |  5.5/10 -> 7.5/10 after H1/H2/D6            |
| Pass 3 (Errors)      |  5.5/10 -> 8.0/10 after H2/H5               |
| Pass 4 (Docs)        |  3.0/10 -> 7.5/10 after H3                  |
| Pass 5 (Upgrade)     |  6.0/10 -> 6.5/10 (drift visible; action deferred)|
| Pass 6 (Dev Env)     |  6.5/10 -> 8.0/10 after H4/H3h              |
| Pass 7 (DX Meas.)    |  6.0/10 -> 7.5/10 after H1                  |
+--------------------------------------------------------------------+
| TTHW (inferred)      | author last mile: unbounded -> ~20 min      |
| Competitive rank     | Needs Work -> Competitive                   |
| Magical moment       | MISSING -> H1 probe + H5 notice + telemetry |
| NOT in scope         | written (4 items)                           |
| What already exists  | written (8 assets to reuse)                 |
| Decisions made       | 9 findings; 6 amendments (H1-H6); 1 collision (H3c) |
| Decisions deferred   | DX-8 update action, DX-9 install UI         |
| Taste calls to gate  | 4 (T10-T13), recommendations attached       |
| Overall DX           | 5.5/10 -> 7.5/10                            |
+====================================================================+
```

Status: DONE_WITH_CONCERNS — single-model (Codex unavailable); TTHW figures
inferred, not measured; H1's telemetry guard is the sharpest acceptance
criterion (a naive probe silently corrupts `usage_count`). No blocking
decisions; all taste calls carry recommendations and can proceed under
auto-decision if the gate is skipped.
