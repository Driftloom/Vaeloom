# CEO Review — Skills Feature Master Plan

- **Phase:** 01 of the autoplan review pipeline (CEO / founder mode)
- **Date:** 2026-10-18
- **Artifact under review:** `skills-feature-master-plan.md`
- **Evidence base:** `docs/Audits/skills-feature-production-audit.md` +
  independent re-verification in this session (every load-bearing claim below
  was re-checked against source; see Falsification Pass)
- **Degradation note:** the Codex dual-voice review was **unavailable** (CLI not
  installed on this machine). This is a **single-voice review** that compensates
  with its own adversarial falsification pass. Treat it as one strong opinion
  plus empirical verification — not as two independent reviewers agreeing.
- **Adaptation note:** the skill's git-history system audit step was replaced
  with direct source verification because the session ran under a no-git
  constraint. All claims are file/line anchored.

---

## Mode

**SELECTIVE EXPANSION.**

Why: this is an existing feature with a working skeleton (31 of 33 catalog
skills are wired, chat deep-links exist, injection runs in the ReAct path). The
user's verbatim intent — "connect agent, chat, memory etc", "complete backend",
"add missing" — licenses cherry-picked expansions, not a scope-conservative HOLD
and not a full dream-state EXPANSION. Concretely:

- **Hold** everything the plan already frames correctly (design-system
  completion, subpage states, gates).
- **Expand** exactly where the audit and this review found the loop's back half
  absent: server-side `/skill:` pinning (C2), the memory bridge (new G1), and
  the static-path injection gap (D1).
- **Reduce** one item the audit got wrong: B4's "fix recent-sort" is a non-bug
  (falsified below) — it becomes a regression test, not a fix.

### Premise challenge

The plan's implicit premise is "the chat ↔ skill loop is ~80% done and mostly
needs polish." Evidence contradicts the "done" part: the `/skill:` token is
**client-side decoration only** — no backend code reads it
(`rg "/skill:" apps/api/src` → 0 hits), the message reaches the orchestrator as
literal text, and it is then excluded from memory extraction by the generic
`startswith("/")` guard. The review therefore re-frames the pass as: _close the
loop first (pin → inject → count → remember → surface), then polish_. The plan's
A/B workstreams are un-changed in content; C/D/E gain the missing closure items.
No user-facing scope was removed.

---

## Findings and amendments

Format: issue → severity → **concrete amendment** (exact plan item or new item).
"New" items are additions to the plan, numbered in the same scheme.

### F-1. C2 is under-scoped: the `/skill:` token must be normalized at three router sites, not one (P0)

Current reality (verified): `ChatComposer.tsx:119` parses `/skill:<slug>`,
`ChatWindow.tsx:81-116` seeds the input via `?skill=&prompt=` deep links — but
the backend never parses the token. Worse, **three** router entry points treat
any `/…` message as a slash command for agent mapping (`chat.py:80-82`,
`agents.py:650-652`, `agents.py:708-709`), and `conversation_service.py:239`
excludes every `/`-message from memory. A single parse site (as the plan
implies) cannot cover this.

**Amendment (C2):** introduce one shared helper
`parse_pinned_skill_token(message) -> (slug | None, residual)` in a service
module, and call it at all three router entries before `UserRequest`
construction; the `residual` flows as the message, the raw token is retained
only for telemetry. Pinning gates, explicitly:
`enabled ∧ required_scope ⊆ granted ∧ trust-ceiling ∧ shared token budget`.
Extend E2 with the full matrix: pinned skill without trigger match **injects**;
disabled pinned skill **does not**; scope-missing pinned skill **does not**;
malformed slugs (`..`, whitespace, >64 chars, unicode) are refused without 5xx;
token-only message (`/skill:slug`) injects and leaves classification untouched.

### F-2. The memory bridge is absent from the plan despite the user asking for "memory" (P0)

Verified: `conversation_service.py:239` (`cleaned.startswith("/")`) silently
discards every `/skill:`-prefixed turn before memory extraction; audit #18
scored the memory loop 1.0/10. The plan contains no item that touches this.

**Amendment (new G1):** in `conversation_service.py`, strip a leading
`/skill:<slug>` before the slash-command/greeting checks, run extraction on the
residual, and tag the resulting memory row with a `skill_slug` provenance field.
Test: a `/skill:ats-audit audit my resume` turn produces a memory row; a bare
token with no residual produces none; the existing length/cue gates (`:210-217`)
still apply to the residual, not the raw text.

### F-3. `getAgentForSkill` can crash the deep-link effect (P1)

Verified: five non-null assertions on `SPECIALIST_AGENTS.find(...)` at
`SkillIntegrationBar.tsx:31,36,45,59,64`; this function is also called inside
`ChatWindow.tsx:91` — a crash there is a React effect throw, i.e. a broken chat
page for a skill whose name doesn't match the mapping.

**Amendment (new C1b):** replace the assertions with a null-safe fallback; unit
test with a name matching no special agent. (This is the "connect agent"
correctness item the user asked for.)

### F-4. B4 is a non-bug — falsified (P1)

The audit claims "Recent sort shows never-used skills first." Empirically false:
`page.tsx:171`'s comparator
`(b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')` yields
`new, old, never` (node-verified this session; `''` is smaller than any ISO date
and the operand order is already descending). The lib test comparator at
`capabilities-data.test.ts:228-234` also places nulls last.

**Amendment (B4 re-scope):** drop the "fix." Add a page-level regression test
pinning nulls-last ordering (E3). Add one line to the audit-correction log:
audit finding #3 was inverted; do **not** change working behavior to match a
wrong report (repo honesty rule).

### F-5. The simulator drift exists in **two** components, not one (P1)

Verified: `TriggerSimulatorModal.tsx:41-42` uses contiguous substring matching;
`SkillPlaygroundDrawer.tsx:140-142` does the same. Backend `_trigger_hits`
(`skill_injection.py:481-496`) is **token-set containment** — documented there
because substring broke on a single filler word.

**Amendment (B8):** one shared TS matcher mirroring token-set containment,
consumed by **both** surfaces; shared test vectors including filler-word cases
("summarize my CV please" must match trigger "summarize CV").

### F-6. Trust filter exposes 2 of 7 classes (P1)

Verified: `SkillFilterBar.tsx:33-37` renders `core_trusted` + `community` only;
`skill-row-helpers.ts:25` defines seven.

**Amendment (new A9):** render all `VALID_TRUST_CLASSES` plus "all"; spec
asserts every class is selectable and filters correctly.

### F-7. D2's numbers are stale — and the fix should not re-introduce drift-prone numbers (P2)

Verified: the budget comment (`skill_injection.py:109-117`) cites "33 entries";
`rg -c "SkillCatalogEntry\("` → **29**. The mean/sum token figures inherit the
same rot.

**Amendment (D2):** replace the frozen table numbers with a recompute
instruction (`len(SKILL_CATALOG)`, measure-before-citing) and record the
measurement command next to the table. Cite 29 today only as the verified
current value.

### F-8. D7 must name the exact overclaiming strings (P2)

Verified: `SkillIntegrationBar.tsx` renders "Cross-Page Agent Wiring:" (~115)
and "Triggers routed via: {agent}" (~159) — both imply runtime routing that is
deliberately trigger-gated and agent-agnostic by design (D7's own rationale).

**Amendment (D7):** reword to suggestion semantics ("Suggested agent",
"Handoff"), keep `agent_name` documented as reserved, and add a spec asserting
the routing-overclaim strings are gone.

### F-9. D7/A6 overlap: the simulator already has aria; the real gap is focus containment (P2)

Verified: `TriggerSimulatorModal.tsx:65-67` already sets `role="dialog"`,
`aria-modal`, `aria-label` — inside a raw div overlay with no trap.

**Amendment (fold A6 into A1):** route the simulator through ui-kit `Modal`
(exists: `packages/ui-kit/src/components/Modal.tsx`), which supplies the trap +
Escape; spec adds focus-return assertion. A6 as a separate item is deleted to
avoid double work.

### F-10. E6/F5: the token CI gate is absent and has a home (P2)

Verified: no `gen_tokens` in `.github/**`; there IS a `ci-frontend.yml` job
matrix to extend.

**Amendment (E6/F5):** add `python scripts/gen_tokens.py --check` to CI and to
the local gate list; the generator only guards UI tokens, so this belongs to
workstream A's exit criteria.

### F-11. Deep-link silently no-ops when a draft exists (P2)

Verified: `ChatWindow.tsx:96,111` gate on `!store.input`; producers
(`SkillIntegrationBar.tsx:107`, `SkillPlaygroundDrawer.tsx:82`) push
`/chat?skill=…` correctly, so the no-op is the only observable gap.

**Amendment (C1):** define behavior (append or explicit notice) when a draft
exists; spec it. Also assert both producers' query keys (`skill`, `prompt`) in
the existing producer test file.

---

## Falsification pass (adversarial, this session)

| #   | Claim tested                                                                            | Method                                                                                      | Result                                                                                                         |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | "Recent sort shows never-used first" (audit #3 → plan B4)                               | node repro of the exact comparator                                                          | **Falsified** — `new, old, never`. B4 re-scoped (F-4).                                                         |
| 2   | "`/skill:` pinning exists and needs only contract tightening" (plan C2 framing)         | `rg "/skill:"` across `apps/api/src` → 0 hits; three router sites confirmed                 | **Partially falsified** — the server side does not exist; C2 expanded (F-1).                                   |
| 3   | "The simulator implements the wrong matching rule" (B8)                                 | substring vs token-set read in both components + backend docstring                          | **Confirmed, and larger** — two components, not one (F-5).                                                     |
| 4   | "Budget comment is stale" (D2)                                                          | `rg -c` entry count                                                                         | **Confirmed** — 33 claimed, 29 actual (F-7).                                                                   |
| 5   | "Trust filter is incomplete" (audit #16)                                                | options vs `VALID_TRUST_CLASSES`                                                            | **Confirmed** — 2 of 7 (F-6).                                                                                  |
| 6   | "`initialPrompt` deep-link wiring is missing on the subpage" (early working assumption) | `rg initialPrompt` → 0 hits; found the real mechanism (`?skill=&prompt=` → ChatWindow seed) | **Hypothesis retired** — the mechanism exists; the real gap is the draft no-op (F-11) and producer assertions. |
| 7   | "Static-path injection is absent" (D1)                                                  | single call site at `loop.py:1521-1523`; no static-dispatch caller                          | **Confirmed** — D1 stands as written.                                                                          |

Where the audit and the code disagreed (row 1), the code wins; the plan is
amended to the code's reality. No test expectation was edited to make anything
green.

---

## Execution topology (parallel agents)

Per the user's "multiple agents in parallel" directive:

- **Wave 0 (serial, contract freeze):** signatures for
  `parse_pinned_skill_token` (F-1) and the shared TS matcher (F-5). Two files,
  no overlap.
- **Wave 1 (parallel, disjoint ownership):**
  - Agent B1 — backend loop/injection: D1, D2 (`skill_injection.py`, `loop.py`).
  - Agent B2 — backend entry/memory: C2 routers, G1 (`chat.py`, `agents.py`,
    `conversation_service.py`).
  - Agent F1 — skills components: A9, C1b, B8 both surfaces, D7 strings, A1/A6
    fold (`components/capabilities/skills/*`).
  - Agent F2 — chat deep-link: C1 producer assertions + draft no-op
    (`components/chat/*`).
- **Wave 2 (serial, single owner):** E1–E3, E6 test additions; depends on Wave 1
  file shapes.
- **Wave 3:** F gates en bloc.

No two agents write the same file; B2 owns every edit to the three router files,
so the slash-command sites never see concurrent writers.

---

## Taste decisions for the gate

1. **Memory bridge depth (G1):** (a) strip + extract + provenance tag
   _(recommended)_ vs (b) strip only, no provenance vs (c) defer. — Recommend
   (a): provenance is one nullable column and makes the "did the skill help"
   question answerable later.
2. **Pinnable trust classes (C2):** (a) any enabled skill passing scope,
   including `untrusted` _(recommended — the user explicitly pinned it; document
   layer already fences it as untrusted)_ vs (b) first-party + community only.
3. **B4 disposition:** (a) regression test only + audit correction
   _(recommended)_ vs (b) change the comparator anyway to "match the report."
4. **ADR-046 now or later:** (a) write the minimal ADR this pass covering
   pinning + static-path injection contract _(recommended — AGENTS.md
   documentation rule requires it when invariants change)_ vs (b) defer to the
   docs phase.
5. **Trust filter breadth (A9):** (a) all seven classes + all _(recommended)_ vs
   (b) keep two + all and document why.
6. **Pagination deferral:** (a) keep the deferral, add an F-gate check that the
   list endpoint carries a LIMIT guard _(recommended)_ vs (b) pull pagination
   into this pass.

---

_Master plan, source, and repository were not modified by this review. Findings
are reproducible from the file/line anchors above._
