# Skills Feature — Production Readiness Audit

**Scope:** The workspace Skills feature end-to-end — frontend pages/routes/components,
backend catalog/injection/endpoints, chat/agent/memory integration, tests, docs.
**Method:** 4 parallel deep-dive audits (frontend, backend, integration, design system),
with critical claims independently re-verified in-session (file:line evidence below).
**Date:** 2026-10-18 · **Branch:** `master` (dirty tree, user work in progress preserved)

Scores below are **audit completeness estimates** grounded in measured evidence
(counts and file:line references), not test-coverage percentages.

---

## 1. What the feature is

Vaeloom workspace **Skills** = markdown instruction documents with `triggers`,
`required_scope`, `autonomy`, `trust_class`, stored in `workspace_capabilities`
(`category='skill'`), injected into agent prompts as an **untrusted** prompt layer
during ReAct runs. A bundled catalog of **28 skills** (measured: 28 `SkillCatalogEntry`
instances in `skill_catalog_service.py`) ships in the backend; the frontend also carries
a 39-row offline seed (`apps/web/src/lib/capabilities-data.ts`) for SSR fallback.

## 2. Scores

| # | Area | Score | One-line verdict |
|---|------|------:|------------------|
| 1 | Frontend routes / pages | 7.0/10 | Workbench tab + full-page detail wired; missing skills index route, route-level loading/error |
| 2 | Frontend components | 7.8/10 | All core surfaces real and functional; hand-rolled drawer/modal, dead code |
| 3 | UI states (loading/empty/error) | 7.5/10 | Strong on workbench; subpage misreports server errors as "not found" |
| 4 | Accessibility | 6.0/10 | Playground focus trap good; TriggerSimulator modal breaks its `aria-modal` promise |
| 5 | Design token compliance | 7.0/10 | Zero raw hex in skill components; but emoji icons, mixed selection idioms, alpha/radius drift |
| 6 | Backend endpoints | 7.5/10 | CRUD + validate + test + catalog solid; no pagination, no typed `/catalog` response, no doc size cap |
| 7 | Data model | 7.5/10 | Single coherent RLS-protected table; no versions or execution history |
| 8 | Injection / execution runtime | 7.5/10 | Rigorous gates (scope/trigger/trust/budget/audit); **only ReAct path injects** |
| 9 | Backend tests | 8.5/10 | 191 dedicated test functions across 7 files; missing HTTP tests for sync + static-path omission |
| 10 | GitHub sync | 5.0/10 | Validate-only by design, well documented; no persistence, no frontend wiring, no HTTP test |
| 11 | Chat UI | 7.0/10 | `/skill:` composer, chip, deep-link consumer all work |
| 12 | Chat ↔ backend contract | 1.5/10 | **`/skill:<slug>` is never parsed server-side; chip selection does not pin injection** |
| 13 | Memory integration | 1.0/10 | Name overlap only; no usage→memory loop; `/skill:` messages excluded from auto-memory |
| 14 | Usage telemetry | 6.5/10 | `usage_count`/`last_used_at` counted and shown; process-local dedupe; no history |
| 15 | Navigation | 5.5/10 | Reachable only via Capabilities workbench; legacy `/skills` alias orphaned and untested |
| 16 | Frontend API client | 9.0/10 | Full surface incl. catalog merge; a few defined-but-unused functions |
| 17 | Docs / specs | 1.5/10 | OpenAPI only; no phase contract, ADR, or API reference for workspace skills |
| 18 | E2E proof | 1.0/10 | **No test proves an injected skill changes agent behavior** |

**Aggregate: 5.8/10.** Core CRUD + injection safety is genuinely strong (7.5–8.5).
The drag is integration and proof: chat contract, memory loop, and E2E evidence are
near-zero. That is exactly the "connect everything" gap this work must close.

## 3. Confirmed defects (severity-ranked)

### Corrections after review (2026-10-18, CEO phase)

- **~~Recent sort shows never-used skills first~~ — FALSIFIED, not a bug.** Re-derived
  from `capabilities/page.tsx:164-178`: comparator is
  `(b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')`. For any used-vs-never pair,
  `'x'.localeCompare('')` = +1 → the used row wins regardless of argument order;
  never-used rows sort **last**, and used rows order newest-first. Correct behavior.
  Action: add a regression test pinning `used-new → used-old → never`; no code change.
- **Catalog count re-verified: 28** (`SkillCatalogEntry(` constructor calls at lines
  199–1133; 29th match is the class definition at line 144; pinned by
  `test_skill_catalog.py:95` `len(SKILL_CATALOG) == 28`). The stale comment's "33" is
  wrong; 28 is the number to cite.

### P0 — correctness / trust
1. **Skill injection silently absent on non-ReAct path.** `build_skill_directive` has
   exactly one call site — `loop.py:1523` inside `_try_react_loop`. The static-dispatch
   fallback (`loop.py:2587+`) never injects. When ReAct is disabled or fails, the UI
   still shows skills as active but they are not applied.
2. **`/skill:<slug>` is cosmetic.** `rg '/skill:' apps/api/src` → **0 hits**; no backend
   parsing exists. Three request-building sites treat it as a generic slash token via
   `SLASH_COMMAND_AGENT_MAP` (`chat.py:80`, `agents.py:650`, `agents.py:708`), then the
   router strips `^[@/]\w+\s*` leaving the `:slug` residue in classified text.
   **Update 2026-10-22 (rework Task 20):** no longer cosmetic — the consumer seam is
   committed (`orchestrator/loop.py` carries `pinned_skill` end to end: `AgentRequest`
   field + C2 comment at loop.py:446-467, act-phase pass-throughs at :1278 and
   :2482-2522, entry `getattr(request, "pinned_skill", None)` at :2669/:2727). The
   producer — `parse_skill_pin` (called from `routers/chat.py`, implemented in
   `services/skill_injection.py`) — is in the rework's working set at this commit and
   had not landed at `2ca9ff78`; re-verify before citing this finding as fully closed.
3. **Subpage swallows server errors.** `capabilities/skills/[skillId]/page.tsx:28-36`
   never destructures SWR `error`; a failed fetch renders "Skill not found" with no retry.
4. **`TriggerSimulatorModal` violates `aria-modal="true"`** — no focus trap, no Escape,
   no initial focus (`TriggerSimulatorModal.tsx:63-70`).

### P1 — integration gaps
6. **Deep-link consumer without producer.** ChatWindow handles `?skill=` (`ChatWindow.tsx:81-116`,
   tested) but no production code pushes it — `SkillIntegrationBar.tsx:102-108` and
   `SkillPlaygroundDrawer.tsx:75-82` send only `agent` + `prompt`.
7. **No `/capabilities/skills` index route** — falls to catch-all 404.
8. **No `loading.tsx` / `error.tsx`** for the skills subpage.
9. **`getAgentForSkill` crash risk.** Five `SPECIALIST_AGENTS.find(...)!` non-null
   assertions (`SkillIntegrationBar.tsx:31,36,45,59,64`).
10. **Stale rationale in production comments.** `skill_injection.py:109-117` justifies
    the 4000-token budget with "33 entries … ~16,056 tokens"; the catalog has 28.
    Budget constant itself is correct and test-pinned.
11. **Dangling reference.** `skill_catalog_service.py:218` points at
    `vaeloom-skills/scripts/check_catalog_fidelity.py`, which does not exist.
12. **No markdown-doc size cap on create/update** (`capabilities.py` `_validate_config_claims`)
    while GitHub sync caps at 256KB.
13. **Playground stale snapshot.** `SkillsView.tsx:121/385-391` keeps a `SkillRow`
    snapshot; after install the open drawer still renders "Catalog" + install button.
14. **Detail actions can double-fire** — subpage has no pending state (workbench has one).
15. **Trigger simulator drift.** Frontend uses contiguous `includes()`; backend uses
    token-set containment (`_trigger_hits`). Two replicas, documented as "same rule".
16. **Trust filter covers 2 of 7 trust classes** (`SkillFilterBar.tsx:33-37`).
17. **No extraction/no E2E proof** that injected skills change agent behavior.
18. **Usage→memory loop absent**; `/skill:` messages excluded from chat auto-memory
    (`conversation_service.py:239`).

### P2 — design system / cleanliness
19. Hand-rolled drawer/modal instead of ui-kit `Drawer`/`Modal` (loses focus trap,
    scroll-lock, scrim consistency on the simulator).
20. Emoji as icons (⚡💬🤖🧠📄) vs the ui-kit icon set (52 icons).
21. Two selection languages: `primary` tokens (SkillCard) vs `action` tokens (filter pills).
22. Alpha/radius/spacing drift (`rounded-2xl` vs `rounded-xl`, `border-border/40|50|60`,
    `shadow-2xl` vs elevation tokens).
23. Dead code: unused imports in 4 files; `onEditDoc`/`isEditing` dead props;
    `'local'` dead union member; unreachable `warning` branch; duplicated `useSafeRouter`
    ×2; five async handlers duplicated between workbench and subpage.
24. A11y polish: no `aria-pressed` on category pills, no roving focus in the skill list,
    no `role="progressbar"` on the token gauge, no `aria-live` for playground results,
    sub-minimum touch targets, emoji in accessible names.
25. Missing api-client wiring: `capabilitiesApi.catalog()` and `toggleCapability()` unused.

### P3 — deferred (explicitly scoped out of this pass)
26. Pagination / server-side search for `GET /capabilities` (workspace-scale lists ≤ ~50 rows).
27. Version history table + rollback UI.
28. Analytics/run-history UI beyond the telemetry card.
29. GitHub sync persistence + scheduled sync.
30. Prose docs/phase contract/ADR for workspace skills.

## 4. Measured facts (this session)

- Catalog: **28** entries (`rg -c 'SkillCatalogEntry\('` = 29 minus the class definition).
- Backend skill tests: **191** `def test_` functions across 7 files
  (`test_skill_catalog`, `test_skill_injection`, `test_skill_usage_counting`,
  `test_skill_prompt_layer`, `test_github_skills_sync`, `test_skill_trigger_matching`,
  `test_skill_capacity_selection`).
- `build_skill_directive` call sites: **1** (`loop.py:1523`).
- Trust classes in code: 7 (`skill-row-helpers.ts` `VALID_TRUST_CLASSES`); filter exposes 2.
- ui-kit: 55 components + 52 icons; skills feature imports ~17 components, 0 icons.
- Token drift enforced? `gen_tokens.py --check` advertised as CI gate but absent from
  `.github/workflows/` — drift caught only indirectly by jest guardrail tests.

## 5. Non-goals (honesty)

- No claim of live-provider verification: agent-path tests run against the mock LLM
  fixture; live suites require MinIO/Ollama credentials and are out of scope here.
- No fabricated coverage numbers; every count above is reproducible with the noted command.
