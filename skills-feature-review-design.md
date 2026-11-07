# Skills Feature — Phase 2 Design Review

**Date:** 2026-10-18 **Scope:** `skills-feature-master-plan.md` (workstreams A
and B primarily; C/D/E/G/F touched where the design contract reaches them)
**Reviewer:** single-model design review (gstack `/plan-design-review`
methodology, adapted) **Target:** workspace Skills feature: capabilities
workbench skills tab, skill detail pane, skill detail subpage
(`capabilities/skills/[skillId]`), simulator modal, playground drawer,
integration bar, telemetry card, markdown viewer.

## Degradation note

- **Codex dual-voice unavailable** (CLI not installed; documented in the master
  plan's pipeline status). This review substitutes a rigorous self-falsification
  pass (section below) in place of the cross-model litmus scorecard. Findings
  below survived it; several earlier candidates did not and are recorded there.
- **Visual mockups not generated** (gstack designer binary not present in this
  environment). Ratings are grounded in source evidence, not rendered
  screenshots. Two claims are explicitly marked not-independently-verified:
  playground validate-error states, and card-grid breakpoints.
- **gstack telemetry / review-log JSONL artifacts skipped** per session
  constraints (sole-artifact rule; no git commands). The Implementation Tasks
  section below is embedded so `/autoplan` can aggregate from this file.

## Method

Every finding cites a file and line verified in this session. Ratings answer two
questions per dimension: what does the PLAN specify, and what does the CODE
actually do. Where the feature already exists and does the right thing, that
counts toward the rating and is listed under "What already exists" so the plan
does not re-litigate it.

## What already exists (reuse, do not rebuild)

| Asset                                                                                                                                        | Evidence                                                                  | Use in plan                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| DESIGN.md contract (semantic tokens, 4px grid, radii families, Inter)                                                                        | `DESIGN.md`                                                               | Calibration base for A4/A5                                         |
| `--surface-selected` token in all 3 themes + Tailwind mapping                                                                                | `globals.css:53,177,285`; `tailwind.config.ts:101`                        | A4's chosen token; already shipped, just not applied               |
| ui-kit `Modal` with focus trap, Escape, scroll lock, `role="dialog"`, `aria-modal`                                                           | `Modal.tsx:26,45-46`                                                      | A1 migration target                                                |
| ui-kit `Drawer` with focus trap + `aria-labelledby` pattern + close button at `MIN_TOUCH_TARGET`                                             | `Drawer.tsx:38,52-93`                                                     | A2 migration target and parity reference                           |
| Focus-trap facility + dedicated test                                                                                                         | `layout/useFocusTrap.ts`; `components/__tests__/DrawerFocusTrap.test.tsx` | Containment tests already exist to extend                          |
| `MIN_TOUCH_TARGET` (WCAG 2.5.8 helper)                                                                                                       | `layout/touchTarget.ts:10`                                                | A6                                                                 |
| 52-icon set (BrainIcon, CpuIcon, FileTextIcon, PlayIcon, SparklesIcon, TerminalIcon...)                                                      | `icons/index.tsx` (52 exports enumerated)                                 | A3 mapping; see DG-4 for the two gaps                              |
| Workbench empty states: 4 differentiated variants ("No skills available" / "match this search" / "installed" / "match filters") + pane empty | `SkillsView.tsx:221-247,291`; `SkillDetailPane.tsx:107`                   | Pass 2 credit; do not add more                                     |
| Skeleton parity: route `loading.tsx` delegates to `CapabilitiesWorkbenchSkeleton`; code-split pane fallback uses same skeleton               | `capabilities/loading.tsx`; `capabilities/page.tsx` (dynamic imports)     | Pass 2 credit                                                      |
| Route-level error boundary (`ErrorState` + `captureError`)                                                                                   | `capabilities/error.tsx`                                                  | B2 pattern reference; see DG-2 caveat                              |
| Pane to subpage bridge: "Open Full Page" link                                                                                                | `SkillDetailPane.tsx:225-230`                                             | Pass 1 credit; pin with test (DG-9)                                |
| Mobile workbench behavior: in-place pane swap via `mobileDetailOpen`, responsive column widths                                               | `SkillsView.tsx:262-263,347-348`                                          | Pass 6 credit; document as contract (B10)                          |
| Playground drawer containment already fixed (`useFocusTrap`; comment documents the prior bug)                                                | `SkillPlaygroundDrawer.tsx:13,63-65`                                      | A2 remains for tokens/scrim only; do not re-claim containment here |

## Dimension ratings (initial, then projected with amendments applied)

| Pass | Dimension                        | Initial | Projected | What a 10 looks like for THIS plan                                                                                                                                      |
| ---- | -------------------------------- | ------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Information architecture         | 7.5     | 9.0       | Pane to subpage rule documented as a contract (not implicit in code); scan line of each surface free of glyph noise; labels state what they do ("Router" badge renamed) |
| 2    | Interaction state coverage       | 7.0     | 9.0       | Every surface's states named: loading, empty, error, success, partial; error copy distinct from not-found copy on the subpage; error-state spec exists                  |
| 3    | User journey and emotional arc   | 7.0     | 8.5       | Every handoff between surfaces either works or explains why not: install to launch carries the skill; draft conflict prompts; displayed numbers are true at runtime     |
| 4    | AI slop risk (APP UI classifier) | 7.0     | 9.0       | Zero emoji as design elements; selection expressed via the selected-surface token; no decorative left-border accent on card bodies                                      |
| 5    | Design system alignment          | 7.5     | 9.0       | All overlays on ui-kit primitives; selection token applied consistently; no conflicting utility classes; icon vocabulary complete                                       |
| 6    | Responsive and accessibility     | 6.0     | 8.5       | `aria-modal` promises containment everywhere it is declared; pressed semantics on every toggleable control; breakpoints verified in a browser pass                      |
| 7    | Unresolved design decisions      | -       | -         | 4 taste calls routed to the gate with recommendations; 2 items deferred with rationale; 0 silently defaulted                                                            |
| -    | **Overall**                      | **7.0** | **8.8**   | Initial matches the audit's route-level 7.0; projected reflects amendments below                                                                                        |

## Findings

### DG-1 (P1, a11y): Simulator modal declares `aria-modal="true"` with no containment

`TriggerSimulatorModal.tsx:65-66` sets `role="dialog"` + `aria-modal="true"`.
Verified: no `useFocusTrap`, no Escape handler, no scroll lock in the file. This
is now the **only** skills overlay still in this state: ui-kit `Modal`/`Drawer`
ship the trap (`Modal.tsx:26`; `Drawer.tsx:38`), and the playground drawer was
already fixed (`SkillPlaygroundDrawer.tsx:63-65`, comment documents the earlier
bug). An `aria-modal` dialog that traps nothing is an ARIA lie: Tab walks into
the background. Fix is already scoped (A1); elevate its acceptance criteria and
add a containment regression test.

### DG-2 (P1, states): Subpage fetch errors render as "not found"

`skills/[skillId]/page.tsx` uses SWR with `shouldRetryOnError: false` and
destructures no `error`; a 500 or offline fetch renders the same "not found" UI
as a true 404. `page.spec.tsx` covers happy path + not-found only. B3 already
plans the fix; the gap this review adds: (a) commit to distinct copy ("Couldn't
load this skill" + retry vs "not found"), (b) add the error-state spec to E3,
(c) note that route `error.tsx` (B2) does **not** catch SWR fetch failures, B3
is the only path for them.

### DG-3 (P1, honesty): Playground token budget is hardcoded 1,500 vs runtime 4,000

`SkillPlaygroundDrawer.tsx:115` fallback `1500`, `:156-157` `tokenBudget: 1500`
and `withinBudget: approxTokens <= 1500`, `:329` copy "Skills are allocated a
bounded slice (1,500 tokens)". Runtime directive budget is 4000
(`SKILL_DIRECTIVE_TOKEN_BUDGET`, `skill_injection.py`; plan verified-facts line
109-117 adjacency). Not confirmed a lie: the estimate endpoint may report its
own budget (test fixture mocks `token_budget: 1500`). Verify endpoint semantics
first, then either server-drive the displayed number or drop the number. A
hardcoded fallback that silently disagrees with runtime is a trust problem
either way. New plan item D9.

### DG-4 (P1, design system): A3 lacks two icons in the ui-kit inventory

All 52 icon exports enumerated. Present: `BrainIcon` (164), `FileTextIcon`
(471), `CpuIcon` (179), `PlayIcon` (296), `SparklesIcon` (750), `TerminalIcon`,
`ShieldIcon`. **Absent: any chat/message bubble, any lightning/zap.** A3's
"verify exact icon names before use" resolves to: 5 of 7 emoji spots map to
existing icons; `💬 Launch in Chat` has no faithful equivalent and `⚡` (Test
Playground, Install and Activate) has no exact one. Decision needed (T2): add
`MessageIcon` (+ optionally `ZapIcon`) to ui-kit, or map ⚡ to
`PlayIcon`/`SparklesIcon` and drop `💬`. Also: `ConnectorDetailDrawer.tsx:382`
uses the same ⚡ pattern (adjacent, not skills scope; DG-10).

### DG-5 (P2, selection): A4 decision is cheap and already has its answer

`--surface-selected` exists in all three themes and is mapped in Tailwind
(`globals.css:53,177,285`, `tailwind.config.ts:101`) and is not applied in the
skills surfaces. `SkillCard` selected row uses
`bg-primary/10 border-l-2 border-primary text-primary`; `text-primary` on the
whole card body reduces scanning contrast; the left border is selection, but
`bg-primary/10` + token color is a cleaner pair. Recommendation in T3: rows to
`bg-surface-selected` (drop `text-primary` from body, keep accent only on the
name if at all); filter pills keep the filled `bg-action` treatment + gain
`aria-pressed` (A6). Pills and rows stay distinct families on purpose.

### DG-6 (P2, typography): SkillMarkdownViewer h2 carries conflicting classes

`SkillMarkdownViewer.tsx:47`:
`text-sm font-semibold tracking-tight ... uppercase text-2xs tracking-wider`.
Both size classes are real (`text-2xs` defined at `tailwind.config.ts:306`), so
one silently wins by stylesheet order; same for `tracking-tight` vs
`tracking-wider`. The label intent is clearly
`text-2xs uppercase tracking-wider`. Extend A8.

### DG-7 (P2, copy): Simulator containment claim must be rewritten with B8

`TriggerSimulatorModal` footer claims whitespace-collapsed substring
containment; the implemented match is contiguous `includes` (`:42`), and backend
`_trigger_hits` is token-set containment. B8 already replaces the matcher;
extend B8 so the footer copy is re-derived from the shared matcher's actual
semantics, pinned by a copy regression (D7 mechanism).

### DG-8 (P2, verification): No browser pass in the gate list

F1-F5 cover typecheck/lint/tests only. For a design-system completion plan, add
F6: browse pass at 375/768/1280 over the skills surfaces (workbench, pane,
subpage, simulator modal, playground drawer), verifying responsive behavior,
focus containment manual check, and contrast on the selected states. This also
closes the "not independently verified" gaps above.

### DG-9 (P3, coverage): Pin existing IA behaviors before refactors land

"Open Full Page" link (`SkillDetailPane.tsx:225-230`) and mobile in-place pane
swap (`SkillsView.tsx:262-263,347-348`) exist and are correct. B5/B6 refactor
the same components; add one test each to E3 so the refactors cannot silently
break them.

### DG-10 (P3, adjacency): ConnectorDetailDrawer shares the ⚡ emoji pattern

`ConnectorDetailDrawer.tsx:382`. Out of skills scope. Decide deliberately in A3:
fold in or file separately. Do not let it sit as an undocumented same-pattern
outlier.

## Plan amendments (by item id)

| Item      | Change                                                                                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1        | Strengthen: DG-1 evidence (lines 65-66, only overlay still uncontained); acceptance = Tab cycles inside, Escape closes, scroll locked, testids preserved; add containment regression to E3.                                                         |
| A2        | Right-size: containment already present (`SkillPlaygroundDrawer.tsx:65`, prior fix documented). Scope = sizing/scrim/radius tokens and close-button parity via ui-kit Drawer only. Do not re-claim the containment gap here.                        |
| A3        | Amend with verified mapping: 🤖 to CpuIcon, 🧠 to BrainIcon, 📄 to FileTextIcon, ⚡(Test Playground) to PlayIcon, ⚡(Install and Activate) to SparklesIcon or new ZapIcon, 💬 to new MessageIcon or text-only (T2). Resolve DG-10 fold-in question. |
| A4        | Decide per T3; apply `--surface-selected` to rows, drop `text-primary`/left-border emphasis from the card body.                                                                                                                                     |
| A8        | Extend: dedupe conflicting classes at `SkillMarkdownViewer.tsx:47` (keep `text-2xs uppercase tracking-wider`).                                                                                                                                      |
| B8        | Extend: after the shared matcher lands, rewrite the simulator footer copy from actual semantics; pin with copy regression (D7 mechanism).                                                                                                           |
| B10 (new) | Document the pane to subpage IA contract ("Open Full Page" is the bridge; mobile uses in-place pane swap) and keep it as the rule, with tests per DG-9.                                                                                             |
| D9 (new)  | Token-budget display honesty: verify endpoint semantics, then server-drive or remove the number; copy regression per DG-3 and T5.                                                                                                                   |
| E3        | Extend: subpage error-state spec (error distinct from not-found); simulator containment regression; pane link + mobile swap pins; token-budget copy test if a number remains.                                                                       |
| F6 (new)  | Browser pass at 375/768/1280 over skills surfaces (responsive, containment manual check, selected-state contrast).                                                                                                                                  |
| C1        | Unchanged scope; make the draft-conflict decision per T4 before implementation.                                                                                                                                                                     |
| G1        | Unchanged; no design-phase findings.                                                                                                                                                                                                                |

## Falsification pass (substitute for Codex dual-voice)

Candidate findings this review generated and then killed or corrected on
evidence:

1. "Workbench empty states are missing." **Falsified.** Four differentiated
   empty states exist (`SkillsView.tsx:221-247,291`). Rating raised; nothing to
   plan.
2. "Playground drawer lacks focus containment." **Falsified.** `useFocusTrap`
   present (`SkillPlaygroundDrawer.tsx:65`); the comment documents a prior fix.
   A2 rescoped to tokens. The real remaining gap is DG-1 (simulator).
3. "No mobile design; mobile must navigate to the subpage." **Falsified.**
   In-place pane swap via `mobileDetailOpen` and responsive widths exist
   (`SkillsView.tsx:262-263,347-348`). Downgraded to "document and pin" (B10,
   DG-9).
4. "The 1,500-token copy contradicts the 4,000 runtime budget." **Partially
   falsified.** Endpoint semantics unverified; estimate-budget vs
   injection-budget divergence is plausible. Reframed as DG-3 verify-then-align,
   not a confirmed contradiction.
5. "Pane to subpage relationship is ambiguous." **Falsified.** "Open Full Page"
   link exists (`SkillDetailPane.tsx:225-230`). Downgraded to coverage item
   DG-9.
6. "`text-2xs` is undefined." **Falsified** (`tailwind.config.ts:306`). The
   duplicate-class conflict stands as DG-6.

Residual uncertainty (not falsified, not fully confirmed): playground
validate-error and install-failure states (not re-read this session; assume
handled until a read proves otherwise); card-grid breakpoint classes (not
enumerated this session; F6 covers by observation).

## Taste decisions for the gate (recommendations attached; never blocking)

| #   | Decision                               | Options                                                                                                                            | Recommendation                                                                                                                                                |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T2  | Emoji to icon strategy (A3)            | (a) Map to existing + add `MessageIcon` only; (b) add both `MessageIcon` + `ZapIcon`; (c) text-only labels                         | (b). The kit is the canonical vocabulary home; two small SVGs beat semantic mismatches (`TerminalIcon` is not a chat). Low contention; auto-approvable.       |
| T3  | Selected-state convention (A4)         | (a) `--surface-selected` fill + no text tint; (b) keep `bg-primary/10` + left border + `text-primary`; (c) fill + keep left border | (a). Token exists for exactly this; `text-primary` on the card body measurably hurts scan contrast; filters keep their filled treatment as a distinct family. |
| T4  | Draft-conflict behavior on launch (C1) | (a) Prefill-overwrite with confirm; (b) silent append; (c) open new chat window                                                    | (a). Non-destructive by default, explicit user intent, matches existing composer affordances; (b) silently mangles user work.                                 |
| T5  | Token number display (D9)              | (a) Server-driven value only; (b) approximate ("about 1.5k"); (c) drop the number, keep "bounded slice"                            | (a) if the endpoint reports it; (c) otherwise. A number in UI that disagrees with runtime is worse than no number. Verify endpoint first.                     |

## NOT in scope

- ConnectorDetailDrawer emoji absorption (DG-10) unless decided in A3; separate
  component, separate sweep.
- RTL/i18n; native mobile apps; pagination UI; version history and rollback UI
  (already deferred in the master plan).
- Playground validate-error state design (not verified this session; reopen if a
  read shows a gap).
- Design token regeneration (no new tokens needed; `--surface-selected` already
  exists).

## Implementation tasks

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** - TriggerSimulatorModal: migrate to
      ui-kit `Modal`; containment regression test
  - Surfaced by: DG-1 - `TriggerSimulatorModal.tsx:65-66` aria-modal without
    trap
  - Files:
    `apps/web/src/components/capabilities/skills/TriggerSimulatorModal.tsx`, its
    test file
  - Verify: component test (Tab cycles, Escape closes) +
    `cd apps/web && npx jest`
- [ ] **T2 (P1, human: ~2h / CC: ~20min)** - Subpage: error branch distinct from
      not-found + spec
  - Surfaced by: DG-2 - no SWR `error` destructure; spec lacks error case
  - Files:
    `apps/web/src/app/workspace/[workspaceId]/capabilities/skills/[skillId]/page.tsx`,
    `page.spec.tsx`
  - Verify: new spec asserts distinct copy + retry for a rejected fetch
- [ ] **T3 (P1, human: ~1h / CC: ~10min)** - Token-budget display: verify
      endpoint, then server-drive or remove number
  - Surfaced by: DG-3 - hardcoded 1,500 at lines 115/156-157/329 vs runtime 4000
  - Files: `SkillPlaygroundDrawer.tsx`, related API types/tests
  - Verify: copy test pins displayed value to response value; manual check
- [ ] **T4 (P2, human: ~3h / CC: ~25min)** - Emoji to icons per T2 decision
      (incl. ui-kit icon additions)
  - Surfaced by: DG-4 - no chat/zap icons in 52-icon set; 7 emoji spots
  - Files: `SkillIntegrationBar.tsx`, `SkillDetailPane.tsx:192`,
    `SkillPlaygroundDrawer.tsx:398,408`, `packages/ui-kit/src/icons/index.tsx`
  - Verify: jest snapshots/roles; grep shows zero emoji in component labels
- [ ] **T5 (P2, human: ~2h / CC: ~15min)** - Selected-state token applied per T3
  - Surfaced by: DG-5 - `--surface-selected` exists, unused; `text-primary` on
    card body
  - Files: `SkillCard.tsx`, `SkillFilterBar.tsx`
  - Verify: visual check + class assertion in tests
- [ ] **T6 (P2, human: ~1h / CC: ~10min)** - SkillMarkdownViewer class dedupe
      (A8 extension)
  - Surfaced by: DG-6 - `text-sm` + `text-2xs`, `tracking-tight` +
    `tracking-wider` on one h2
  - Files: `SkillMarkdownViewer.tsx:47`
  - Verify: jest render test asserting final class set
- [ ] **T7 (P2, human: ~2h / CC: ~15min)** - Shared trigger matcher + honest
      footer copy (B8 extension)
  - Surfaced by: DG-7 - footer claims containment; matcher is contiguous
    includes
  - Files: `TriggerSimulatorModal.tsx`, `SkillPlaygroundDrawer.tsx:142`, shared
    helper
  - Verify: fixture matrix test shared with backend expectations
- [ ] **T8 (P3, human: ~2h / CC: ~15min)** - IA pins: pane link + mobile swap
      tests (DG-9)
  - Files: workbench/subpage spec files
  - Verify: `npx jest`
- [ ] **T9 (P3, human: ~30min / CC: ~5min)** - F6 browser pass procedure at
      375/768/1280 (DG-8)
  - Verify: screenshots/manual log attached to phase evidence

## Completion summary

```
+====================================================================+
|         DESIGN PLAN REVIEW - COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | DESIGN.md present; UI scope = skills surfaces|
| Step 0               | initial 7.0/10; focus: states, a11y, honesty |
| Pass 1 (Info Arch)   |  7.5/10 -> 9.0/10 after fixes                |
| Pass 2 (States)      |  7.0/10 -> 9.0/10 after fixes                |
| Pass 3 (Journey)     |  7.0/10 -> 8.5/10 after fixes                |
| Pass 4 (AI Slop)     |  7.0/10 -> 9.0/10 after fixes                |
| Pass 5 (Design Sys)  |  7.5/10 -> 9.0/10 after fixes                |
| Pass 6 (Responsive)  |  6.0/10 -> 8.5/10 after fixes                |
| Pass 7 (Decisions)   | 4 routed to gate, 2 explicitly deferred      |
+--------------------------------------------------------------------+
| NOT in scope         | written (4 items)                            |
| What already exists  | written (11 assets)                          |
| TODOS.md updates     | N/A this session (sole-artifact constraint)  |
| Approved Mockups     | 0 generated (designer unavailable)           |
| Decisions made       | 8 auto-decided, 4 taste calls to gate        |
| Decisions deferred   | 2 (playground error states, DG-10 sweep)     |
| Overall design score | 7.0/10 -> 8.8/10                             |
+====================================================================+
```

Status: DONE_WITH_CONCERNS - single-model (Codex unavailable); DG-3 endpoint
semantics need backend verification before T3; DG-8/F6 is a manual gate, not
automatable in this environment. No unresolved blocking decisions; all taste
calls carry recommendations and can proceed under auto-decision if the gate is
skipped.
