# Capabilities Workbench Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the capabilities-workbench audit gaps (68/100 → ≥80/100): backend-served tool truth, one plugin registry, real telemetry, skill injection on both dispatch paths, one UI system (shell/modal/error/form/a11y), and repo hygiene.

**Architecture:** Contract-first: Tasks 1–5 pin the data-source and shell interfaces the rest consumes. Then three independent lanes (backend wiring 6–10, UI system 11–16, hygiene 17–20) whose file sets do not overlap, followed by close-out (21) and re-audit (22). Lane tasks 6–16 or 17–20 may run in parallel; tasks within a lane are sequential.

**Tech Stack:** Next.js 15 + SWR + Tailwind (config-extended tokens), FastAPI + SQLAlchemy/alembic, pytest (serial `-o addopts=""` for whole-area), jest. Python via `uv run --project apps/api` from repo root (never inside `apps/api`).

**Spec:** `docs/superpowers/specs/2026-10-18-capabilities-workbench-rework-design.md` (read alongside; anchors in this plan key to audit `docs/Audits/2026-10-18-capabilities-workbench-enterprise-audit.md`).

## Global Constraints

- Python 3.12 through uv only: `uv run --project apps/api ...` from repo root.
- Web tests: `cd apps/web && npx jest <path>`; typecheck: `cd apps/web && npx tsc --noEmit`; root checks: `pnpm lint`, `pnpm typecheck`.
- Backend full-area runs are serial: `uv run --project apps/api python -m pytest apps/api/tests/ -q -o addopts=""`. Never trust `-n 4` totals on Windows.
- Honesty: assert exact status codes; no invented numbers, scopes, or tool names anywhere; fallback seed rows keep `isSeed` semantics and `usageCount: 0` / `lastUsedAt: null`.
- The whitelist for strategies lives in the service layer, not Pydantic; never re-add a drift-prone hand-written tool list outside the generated manifest.
- Generated artifacts (`*.generated.ts`) are never hand-edited; `.prettierignore` gains any new generated file.
- No new runtime dependency without an ADR. CSP/CSRF/auth allowlist tables unchanged unless a task says so explicitly.
- Every changed wire-site uses `invalidateCapabilities` (Task 2), not bespoke `mutate` key lists.
- UI copy states limits truthfully ("not reported", "0 executed", "enterprise-gated") per spec §1.

## Review Focus

1. **Unknown tool name in URL** — `tools/[toolName]` with a non-existent name must render an explicit not-found panel, never the old `def=null` half-page. Pinned: Task 3.
2. **Enterprise-off plugin creation** — must return 403 with a stated reason and no stored rows; modal copy must state the gate. Pinned: Task 6.
3. **Empty sync-github result** — UI must show "Nothing was fetched, compiled or executed" verbatim (the backend's own message class), not fabricated counts. Pinned: Task 9.
4. **Cross-pane staleness** — a toggle from agent deep-link or skills tab must refresh the Tools gate view via the registry; one-shot `useEffect` fetch is banned. Pinned: Task 2.
5. **Error-token resolution in all four themes** — `danger`/`error` collapse must verify `:root/.dark/.light/.high-contrast` first; if neither resolves everywhere, fix globals.css in the same task. Pinned: Task 12.

---

# Phase 1 — Contracts (sequential; the whole repo waits)

### Task 1: Generated tool-fallback manifest

**Files:**
- Create: `scripts/gen_tool_fallback.py`
- Create: `apps/web/src/lib/tool-fallback.generated.ts`
- Modify: `apps/web/src/lib/capabilities-data.ts` (tool rows of `SEED_CAPABILITIES` consume the manifest)
- Modify: `.prettierignore` (add `apps/web/src/lib/tool-fallback.generated.ts`)
- Test: `apps/api/tests/test_gen_tool_fallback.py` (script-level), `apps/web/src/lib/__tests__/capabilities-data.test.ts` (extend)

**Interfaces:**
- Consumes: `apps/api/src/api/tools/definitions.ALL_TOOLS` (67 ToolDefinition entries).
- Produces: `TOOL_FALLBACK: readonly ToolSeedRow[]` in `tool-fallback.generated.ts` — rows keyed by tool `name`, `requiredScope` = the scope the backend emits, `usageCount: 0`, `lastUsedAt: null`, `isSeed: true`.
- Produces: `python scripts/gen_tool_fallback.py` writes; `--check` exits 1 on byte-diff.

- [ ] **Step 1: Write the failing script test** — `apps/api/tests/test_gen_tool_fallback.py`: invoke the script's main with `--check` against a temp copy where one tool name is altered; assert return code 1. Second test: generate to a tmp dir, assert every `ALL_TOOLS` name appears in the output text.
- [ ] **Step 2: Run** `uv run --project apps/api python -m pytest apps/api/tests/test_gen_tool_fallback.py -q` → FAIL (module missing).
- [ ] **Step 3: Implement the script** — reads ALL_TOOLS by importing `api.tools.definitions` (append `apps/api/src` to `sys.path`), renders the TS manifest from a template string; `--check` compares bytes.
- [ ] **Step 4: Run script, wire the consumer** — regenerate; in `capabilities-data.ts`, replace the 6 hand-written tool rows (search_documents, query_graph, calculate_semantic_ats_score, browse_job_page, execute_code_sandbox, draft_email currently) with the 67 manifest rows behind the same `CapabilityItem` shape. No hand-edit of the generated file.
- [ ] **Step 5: Extend `capabilities-data.test.ts`** — every fallback tool name exists in `tool-fallback.generated.ts` imports; zero rows with `requiredScope` not present in the manifest. 
- [ ] **Step 6: Run** `cd apps/web && npx jest src/lib/__tests__/capabilities-data.test.ts` → PASS; commit `feat(capabilities): generate tool fallback manifest from backend registry`.

### Task 2: SWR key registry + invalidation helper

**Files:**
- Create: `apps/web/src/lib/queries/capability-keys.ts`
- Modify: `apps/web/src/app/workspace/[workspaceId]/capabilities/page.tsx` (mutation sites :412, :455, :491, :545, :609, :870, :919; refresh handler :664-676; fetch keys :244, :249)
- Modify: `apps/web/src/components/capabilities/AgentsView.tsx`, `PluginsView.tsx`, `ConnectorsView.tsx` (reload-through-helper)
- Test: `apps/web/src/lib/queries/__tests__/capability-keys.test.ts` (new), existing page/AgentsView/PluginsView specs updated where key strings change

**Interfaces:**
- Produces: `capabilityKeys = { list(id), skills(id), agentCatalog(id), pluginRegistry(id) }` returning stable array refs, and `invalidateCapabilities(wsId: string, scope?: 'all' | 'list' | ...) => Promise<void>` calling SWR global `mutate(key, undefined, { revalidate: true })` over the registry.
- Owns: `['capabilities', wsId, scope]` shape replaces `['workspace-capabilities', wsId]` and `['agent-capability-rows', wsId]`; `'plugin-registry'` becomes `['capabilities', wsId, 'plugin-registry']`.

- [ ] **Step 1: Write failing helper tests** — `invalidateCapabilities('ws-1')` issues one revalidate call per registered key, no duplicate calls; `scope:'skills'` only touches the skills key. Use the real global mutate mock on `swr`.
- [ ] **Step 2: Run jest** → FAIL.
- [ ] **Step 3: Implement the helper.**
- [ ] **Step 4: Wire all sites** — list the exact seven page.tsx mutate sites plus refresh handler, AgentsView, PluginsView; Tools gate fetch currently a one-shot `useEffect` at ToolsView.tsx:60-81 converts to a capabilityKeys-backed SWR call (Task 3 finishes its data change; this task only moves it onto the key).
- [ ] **Step 5: Run jest for** capability-keys test + page.spec + AgentsView/PluginsView/ToolsView specs → PASS. Commit `refactor(capabilities): single capability key registry and invalidation`.

### Task 3: Tools tab from backend definitions

**Files:**
- Modify: `apps/web/src/components/capabilities/ToolsView.tsx` (:84 static suites, :108-109 static defs), `apps/web/src/lib/tool-definitions-catalog.ts` (shrink to suite-labels map + types only; rows deleted)
- Modify: `apps/web/src/app/workspace/[workspaceId]/capabilities/tools/[toolName]/page.tsx` (drop `def=null` path)
- Modify: `apps/web/src/lib/api-client.ts` — `listToolDefinitions` (:5143) gains a typed response; no other method changes
- Test: `apps/web/src/components/capabilities/__tests__/ToolsView.test.tsx` (update), `tools/[toolName]/page.spec.tsx` (update)

**Interfaces:**
- Consumes: `capabilitiesApi.listToolDefinitions()` → `GET /capabilities/tools/definitions` (backend unchanged: responses from capabilities.py:941).
- Produces: suite grouping rule — suite key = the scope's first dotted segment (e.g. `system.browser.read` → `system`); labels map `TOOL_SUITE_LABELS` copied verbatim from the suite names in the current `tool-definitions-catalog.ts` at edit time; scopes with no label land in `other: 'Other'`. Workspace-gated toggles keep writing capability rows through the existing `capabilitiesApi.update` path.

- [ ] **Step 1: Update failing ToolsView tests** — mock `listToolDefinitions` returning a fixture with ≥2 scopes plus one unlabeled scope; assert: rendered suite headers match labels map; unlabeled scope renders under "Other"; zero assertions on catalog-derived names; phantom names absent (list the 12: eval_python, take_screenshot, delegate_to_agent, broadcast_message, playback_state, queue_track, create_task_card, cursor_click, read_workspace_file, write_workspace_file, fetch_webpage_content, execute_custom_capability).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement ToolsView grouping + fetch on the Task-2 key; slim the catalog file** to labels/types.
- [ ] **Step 4: Fix `[toolName]` subpage** — unknown name → NotFound panel (reuse the page's existing error-state pattern); no `def=null` branch remains.
- [ ] **Step 5: Run ToolsView + subpage specs, then** `npx tsc --noEmit` → PASS. Commit `feat(capabilities): tools tab served from GET /capabilities/tools/definitions`.

### Task 4: CapabilityDetailLayout + MetaRow; migrate tools and agents subpages

**Files:**
- Create: `apps/web/src/components/capabilities/CapabilityDetailLayout.tsx` (exports `CapabilityDetailLayout`, `MetaRow`, and shared constants)
- Modify: `tools/[toolName]/page.tsx`, `agents/[agentId]/page.tsx` (`:383-405` inline autonomy controls replaced by `AgentAutonomySelector`; `:142-144`/`:171` re-sync from `selectedAgent.defaultAutonomy` when `'agent-catalog'` resolves)
- Test: `apps/web/src/components/capabilities/__tests__/capability-detail-layout.test.tsx` (new); `agents/[agentId]/page.spec.tsx` (update)

**Interfaces:**
- Produces: `<CapabilityDetailLayout eyebrow backHref breadcrumbs meta actions rail tabs footer?>` contract — props decide rendering; canonical values inside the component: `border-border-subtle`, rail `w-[350px]` at every breakpoint, content `max-w-6xl`, metadata via `<MetaRow>`. Eyebrow uses a new `.eyebrow` utility added once in `globals.css` adjacent to the `h6` rule (:626).
- Consumes: `AgentAutonomySelector` (existing component remains the single autonomy UI).

- [ ] **Step 1: Failing layout test** — renders eyebrow/breadcrumbs/rail/tablist wiring with `aria-controls`; asserts canonical border+rail+width classes appear exactly once in output.
- [ ] **Step 2: Run** → FAIL. 
- [ ] **Step 3: Implement layout + MetaRow + `.eyebrow`.**
- [ ] **Step 4: Migrate tools/[toolName] page onto the layout** (breadcrumb, status card, rail actions, tabs preserved 1:1).
- [ ] **Step 5: Migrate agents/[agentId]:** swap inline autonomy buttons for `AgentAutonomySelector`; add an effect re-syncing `autonomyMode` from `selectedAgent.defaultAutonomy` on catalog resolution; optimistic save keeps the existing wire (write back via `capabilitiesApi.update` then `invalidateCapabilities(wsId,'list')`).
- [ ] **Step 6: Run both corresponding page specs + layout test** → PASS. Commit `refactor(capabilities): shared detail shell, tools+agents migrated`.

### Task 5: Migrate connectors, mcp, plugins subpages; skills adapter smoke

**Files:**
- Modify: `connectors/[connectorId]/page.tsx`, `mcp/[serverId]/page.tsx`, `plugins/[pluginId]/page.tsx`, `skills/[skillId]/page.tsx` (adapter call on `SkillDetailPane`)
- Test: the three corresponding spec files (update shells only); one skills-subpage smoke assertion remains healthy through refits

**Interfaces:**
- Consumes: Task 4-component contract with no shape changes.
- Produces: `mcp/[serverId]` Transport/status tabs render the connector's live `config` for configured servers (template only when unconfigured, `:236`/`:275-286` evidence), and `plugins/[pluginId]` renders only the true `entry_point` (delete the `(plugin as any).entrypoint ?? `${plugin.name}.py`` fakes at :249/:330-331 — "Not reported (by the registry)" stays verbatim).

- [ ] **Step 1: Failing subpage assertions** — mcp: a configured fixture renders its own transport string; plugins: an entry_point-less fixture renders the not-reported string, never `${name}.py`.
- [ ] **Step 2: Run** → FAIL. 
- [ ] **Step 3: Migrate all three shells; skills page wraps `SkillDetailPane` with the layout adapter (no pane refactor).**
- [ ] **Step 4: Run all three specs + smoke** → PASS. Commit `refactor(capabilities): all detail pages on the shared shell`.

# Lane 1 — Backend wiring

### Task 6: One plugin registry

**Files:**
- Modify: `apps/api/src/api/routers/capabilities.py` (create path; the site writing plugin Category rows)
- Modify: `apps/web/src/components/capabilities/AddCapabilityModal.tsx` (enabled-category copy for enterprise-off)
- Test: `apps/api/tests/routers/test_capabilities_plugin_registry.py` (new); `page.spec.tsx` plugin-create case

**Interfaces:**
- Produces: `POST /capabilities` with `category: 'plugin'` creates the `workspace_capabilities` row AND upserts a `plugins` registry row (name from payload; `entry_point` from config when provided) in one transaction when `settings.enterprise_routes_enabled`; enterprise off → HTTP **403** with `detail` naming the gate: "Plugin runtime is enterprise-gated".
- Consumes: existing `plugins` table/`plugin_service` semantics unchanged.

- [ ] **Step 1: Failing backend tests** — enterprise-on create asserts both rows exist (capability + registry) with matching name; enterprise-off create asserts `res.status_code == 403` and zero rows written; malformed plugin payload without required name asserts 422. Exact statuses.
- [ ] **Step 2: Run pytest** → FAIL. 
- [ ] **Step 3: Implement the upsert + gate.**
- [ ] **Step 4: Frontend copy** — when create returns 403, modal shows the detail text and keeps the row-storing off; page.spec asserts create never called followed by silent success states.
- [ ] **Step 5: Run backend test + page.spec** → PASS. Commit `feat(capabilities): plugin capability creation binds the executable registry`.
- [ ] **Step 6 (fixture): fix `pluginsApi.register` orphans? NO — out of scope; leave dead wrapper for Task 17 deletion.**

### Task 7: Usage telemetry from real executions

**Files:**
- Create: `apps/api/src/api/services/capability_usage.py` (`record_capability_usage(workspace_id: str, name: str) -> None`)
- Modify: `apps/api/src/api/tools/executor.py` (invocation points where a capability/tool executes), `apps/api/src/api/routers/capabilities.py:1680` and `apps/api/src/api/routers/agents.py:352-355` (refactor to call the shared service — one writer)
- Test: `apps/api/tests/services/test_capability_usage.py` (new), executor-area test extension

**Interfaces:**
- Produces: `record_capability_usage(wsId, name)` performs the same durable `usage_count += 1 / last_used_at = now` write the diagnostic endpoints perform today; missing capability name → no-op with a debug log (fail-open); never raises into execution semantics. The 15s TTL gate cache is untouched.

- [ ] **Step 1: Failing service tests** — existing row increments `usage_count` and sets `last_used_at`; unknown name is a silent no-op; failure in the write never propagates to the caller (monkeypatch the session to raise; function returns normally).
- [ ] **Step 2: Run** → FAIL. 
- [ ] **Step 3: Implement the service; refactor both diagnostic call sites onto it; call it from the executor path that dispatches a named capability/tool.**
- [ ] **Step 4: Extend an executor test** — one execution bumps the row for the executed tool gate name; run the executor area scoped.
- [ ] **Step 5: Commit** `feat(capabilities): execution-path usage telemetry through a single record_capability_usage`.

### Task 8: Skill injection on the static dispatch path

**Files:**
- Modify: `apps/api/src/api/orchestrator/loop.py` (extract ReAct-side guard block (:1549 region) into a module function; call from `_dispatch_agent`)
- Test: `apps/api/tests/orchestrator/test_skill_static_injection.py` (new file, or extend the strongest existing loop test module if it names pinned_skill already)

**Interfaces:**
- Produces: `_skill_directive_if_present(context) -> str | None` in `loop.py` — same trust/allowlist guards as the ReAct site; static path behavior becomes byte-identical to ReAct-side injection.
- Consumes: `build_skill_directive` (skill_injection.py) unchanged.

- [ ] **Step 1: Failing tests** — with `agent_react_enabled = False` and a workspace skill enabled: static dispatch output contains the injected directive; with no matching permission for that skill: no directive and no crash. Adapter pin: `settings.agent_react_enabled = False` per repo rule for static-ladder tests.
- [ ] **Step 2: Run** → FAIL. 
- [ ] **Step 3: Extract and re-call from both paths; keep the ReAct call byte-identical (no behavior change in default-on path).**
- [ ] **Step 4: Run the loop-area scoped pytest + the ReAct revival safety tests** (`apps/api/tests/test_react_revival_safety.py`) → PASS. Commit `feat(orchestrator): skill directive enforced on the static dispatch path`.

### Task 9: sync-github wired into Import

**Files:**
- Modify: `apps/web/src/lib/api-client.ts` — add `capabilitiesApi.syncGithub(workspaceId) => POST /capabilities/sync-github`
- Modify: `apps/web/src/components/capabilities/AddCapabilityModal.tsx` (Import pane gains the action + result rendering)
- Test: `AddCapabilityModal` spec (import cases), `api-client-capabilities.test.ts` (endpoint assert)

**Interfaces:**
- Consumes: backend response — a summary object with pulled/compiled/executed counts and the "Nothing was fetched, compiled or executed …" empty case (capabilities.py:1914).
- Produces: after success the modal calls `invalidateCapabilities(wsId,'skills')` (`'list'` too if rows changed category).

- [ ] **Step 1: Failing frontend tests** — success fixture renders exact counts; empty result renders the backend's empty-form message verbatim; failure renders the error and keeps the drawer interactive. Zero fabricated numbers in any rendered string.
- [ ] **Step 2: Run** → FAIL. 
- [ ] **Step 3: Implement method + pane.** 
- [ ] **Step 4: Run specs + tsc** → PASS. Commit `feat(capabilities): GitHub skills sync available from the Import pane`.

### Task 10: Composio refresh + disconnect actions

**Files:**
- Modify: `apps/web/src/lib/api-client.ts` — `connectorsApi.composioRefresh(id)`, `connectorsApi.composioDisconnect(id)`
- Modify: `apps/web/src/components/capabilities/connectors/InstalledConnectorsTab.tsx` + `ConnectorCard.tsx` (actions on the installed composio card; `ConfirmationDialog` for disconnect)
- Test: `McpConnectorsViews.test.tsx` composio section (extend)

**Interfaces:**
- Consumes: `POST /connectors/composio/refresh` (:374), `POST /connectors/composio/disconnect` (:343). Refresh failure → surfaces re-auth state using the existing OAuth link flow (`composio authUrl`).

- [ ] **Step 1: Failing tests** — refresh success keeps row enabled and shows feedback; refresh 401/failed renders the re-auth affordance + exact flow call; disconnect gated by `ConfirmationDialog` (cancel = no call; confirm = DELETE returns invalidated connector list reloaded through the registry helper).
- [ ] **Step 2: Run** → FAIL. 
- [ ] **Step 3: Implement wrappers + card actions.**
- [ ] **Step 4: Run connector specs + tsc** → PASS. Commit `feat(connectors): composio token refresh and disconnect controls`.

# Lane 2 — UI system

### Task 11: Overlay recipe + backdropBlur guard

**Files:**
- Modify: `AddCapabilityModal.tsx` (hand-rolled shell/Tab-trap/Escape :1923-1936 and scrim :2577 → ui-kit `Modal`), `TriggerSimulatorModal.tsx` (:64-69 → ui-kit `Modal`), `ConnectorDetailDrawer.tsx:226` (scrim baseline)
- Modify: `apps/web/tailwind.config.ts` (add `backdropBlur` scale row matching first-party shadow handling), `apps/web/src/__tests__/design-system-guardrails.test.ts` (key check)
- Test: `AddCapabilityModal` spec (Trap/Escape assertions now free via primitive), guardrails test

**Interfaces:**
- Consumes: ui-kit `Modal` (portal + scroll-lock + `useFocusTrap` + Escape). Scrim = `bg-black/60` everywhere; `backdrop-blur-*` classes removed from this surface entirely.

- [ ] **Step 1: Update failing tests** — both modals render through ui-kit Modal (assert via its portal root); Escape closes; focus trapped; guardrails asserts the `backdropBlur` config row exists and rejects a banned `backdrop-blur-xs` class string.
- [ ] **Step 2: Run** → FAIL. 
- [ ] **Step 3: Migrate the two modals; remove dead blur classes (ConnectorDetailDrawer:226, TriggerSimulatorModal:68); add config row + guardrails line.**
- [ ] **Step 4: Run modal specs + guardrails + tsc** → PASS. Commit `refactor(capabilities): one modal overlay recipe with blur guard`.

### Task 12: Single error family

**Files:**
- Modify: the 31 sites (`text-error` ×22, `text-danger` ×9 over 11 components incl. AddCapabilityModal, ConnectorDetailDrawer, SkillPlaygroundDrawer, McpView, agents pane files…)
- Modify: `globals.css` **only if** Step 1's verification shows neither family resolves in all four theme blocks
- Modify: `design-system-guardrails.test.ts` (mixed-family ban)
- Test: guardrails test; spot-check one migrated component's spec for class assertions

**Interfaces:**
- Produces: decision constant — the family verified resolving in `:root/.dark/.light/.high-contrast` wins; all 31 sites converted to it; converting colors only, not copy.

- [ ] **Step 1: Verify tokens** — read globals.css theme blocks; record which family resolves in high-contrast/dark prior to any conversion; if neither resolves everywhere, add the missing token first.
- [ ] **Step 2: failing guardrails** — banned: two error-family color classes in the same capabilities subtree.
- [ ] **Step 3: Convert all sites (one mechanical pass, rg-driven), final check zero mixed** 
- [ ] **Step 4: jest guardrails + touched component specs + tsc** → PASS. Commit `refactor(capabilities): single danger/error family across the workbench`.

### Task 13: Form atoms rollout

**Files:**
- Modify: `ToolSuiteAccordion.tsx:63`, `ConnectorsDirectory.tsx:93-104` (select + chevron deleted), `McpActivityLog.tsx:62`, `mcp/[serverId]/page.tsx:369-379`, `McpManifestTab.tsx:64`, `McpToolInspectPanel.tsx:349`, `AddCapabilityModal.tsx` (7 inputs per :1451 f.), `CustomProtocolModal.tsx` (7 inputs), `AgentAutonomySelector.tsx:167` stays bespoke only if ui-kit Input cannot express its describedby contract — priority is ui-kit
- Test: component specs for each touched file (class/behavior assertions cheap — one per site)

**Interfaces:**
- Consumes: ui-kit `FormField`, `Input`, `Select`, `Textarea`. The two justified inline styles are untouched: AgentCard.tsx:45, AgentDetailPane.tsx:308 (hue glyph), SkillPlaygroundDrawer.tsx:325 (meter width).

- [ ] **Step 1: Failing per-file assertions on one exemplar** (CustomProtocolModal): inputs become ui-kit atoms with same labels/contracts; hand-rolled chevron gone from ConnectorsDirectory.
- [ ] **Step 2: Roll out mechanically across the list; keep aria contracts (AgentAutonomySelector aria-invalid/describedby preserved).**
- [ ] **Step 3: Run all touched specs + tsc** → PASS. Commit `refactor(capabilities): ui-kit form primitives across workbench surfaces`.

### Task 14: Regression repairs (autonomy re-sync already in Task 4) — status dots, confirm dialog, tab roving

**Files:**
- Modify: `ConnectorDetailDrawer.tsx:359`, `AgentDetailPane.tsx:634`, `SkillTelemetryCard.tsx:97` (dot inside button), `TriggerSimulatorModal.tsx:152,197` → ui-kit `StatusDot`
- Modify: `ConnectorDetailDrawer.tsx` destructive rollback `window.confirm` site (~:148) → ui-kit `ConfirmationDialog`
- Modify: `ConnectorsHeader.tsx:38-77` (arrow-key roving, `aria-controls` + keyboard nav `tabPattern.a11y.test.tsx` pattern)
- Test: respective specs; `tabPattern.a11y.test.tsx` extended to ConnectorsHeader

**Interfaces:**
- Consumes: `StatusDot` (supports size/hue/pulse composites matching visual), `ConfirmationDialog`, existing a11y pattern module.

- [ ] **Step 1: Failing tests** — dot renders via StatusDot in all five sites; rollback confirm shows dialog with exact labels, Enter proceeds, Escape cancels and does not invoke the rollback; ConnectorsHeader responds to ArrowLeft/ArrowRight keys and keeps `aria-selected` truth-consistent.
- [ ] **Step 2: Implement.** 
- [ ] **Step 3: jest + tsc** → PASS. Commit `fix(capabilities): status dots, safe confirm, roving tabs`.

### Task 15: Language + icon batch

**Files:**
- Modify: `SkillIntegrationBar.tsx:120-151` (emoji → real icons from ui-kit's icon set), three inline SVG sets (`CustomProtocolsTab.tsx:295-307`, `McpServerCard.tsx:184-233`, `SkillTelemetryCard.tsx:107-131` → shared icon imports)
- Modify: `SkillMarkdownViewer.tsx` — theme classes to shared `.markdown-body` set (globals.css :554-562); `text-[11px] font-mono` sites → `<MetaRow>` (Task 4); eyebrow class sites across six subpages → `.eyebrow`
- Test: one per touched file asserting icon idiom + no emoji glyphs in markup (transparent assert would be too broad — assert per file), markdown-body class on viewer output

**Interfaces:**
- Consumes: ui-kit icons; `.eyebrow`; `.markdown-body`; Task 4's MetaRow.

- [ ] **Step 1: Failing assertions (per file, list the file names).**
- [ ] **Step 2: Convert.** 
- [ ] **Step 3: jest + tsc** → PASS. Commit `refactor(capabilities): one icon idiom, one markdown theme, one small-print language`.

### Task 16: double-check mode — MCP config truth was done in Task 5; this task verifies lane-2 leaf coverage

**Files:** none new (verification only covering Tasks 11–15 outcomes)
- [ ] **Step 1: Run combined route:** guardrails, a11y suites, `pnpm lint`, `npx tsc --noEmit`. Fix any residual lane-2 issue per task code. Commit only if fixes were needed: `chore(capabilities): lane-2 residuals`.

# Lane 3 — Hygiene

### Task 17: Dead code deletions (web)

**Files (Delete):** `mcp/McpConfigModal.tsx` (+ its barrel export line); `capabilities-data.ts:2212-2574` localStorage layer except `getStoredCapabilities` (header reflects its single dup-name use, AddCapabilityModal.tsx:1885)
**Files (Modify):** `api-client.ts` — delete `capabilitiesApi.toggleCapability`, `capabilitiesApi.getCatalog`, `connectorsApi.getSyncStatus`; `capabilities/page.tsx:368-372` comment + seed MCP rows (:1983-2074) removed; SEED becomes 59 rows; `marketplace/page.tsx` dead id-branches and pseudo-id counting deleted (:112-139, :155-255 region)
**Test:** `capabilities-data.test.ts`, `api-client-capabilities.test.ts`, page.spec, marketplace-page spec

- [ ] **Step 1: rg-verify zero references for each delete target (tests included)** before every deletion; adjust the references, never the test copies.
- [ ] **Step 2: failing tests** — SEED composition assertions (agents 10; tools == manifest length; plugins 4; mcp 0; skills unchanged until Task 18); no McpConfigModal export; marketplace grid counts from listed titles only.
- [ ] **Step 3: Delete; run the four suites + tsc** → PASS. Commit `chore(capabilities): delete unreachable code paths (modal, storage layer, wrappers, seeds, branches)`.

### Task 18: Seed skills truth trim + catalog reference fix

**Files:**
- Modify: `apps/web/src/lib/capabilities-data.ts` — remove the 11 seed-only skills (acceptance-criteria-review, accessibility-testing, frontend-design, ui-ux-pro-max, agent-building, agentic-workflows, autoplan, check-work, deep-learning-rag-evals, llm-engineering, system-design)
- Modify: `apps/api/src/api/services/skill_catalog_service.py:218` — delete the reference to the nonexistent external script and any code path that would call it; keep the catalog-fidelity assertions intact
- Test: `capabilities-data.test.ts` (composition: agents 10, tools == manifest length, plugins 4, mcp 0, skills 28), skills-area backend test run

- [ ] **Step 1: Failing asserts** — seed skill count = 28; every seed slug present in `skill_catalog_service.SKILL_CATALOG`; `rg "check_catalog_fidelity|vaeloom-skills"` zero hits in apps/api.
- [ ] **Step 2: Trim + fix; run jest lib tests + scoped api skill tests** → PASS. Commit `chore(capabilities): seed skills equal the installable 28; drop stale external reference`.

### Task 19: Archive orphan TS packages

**Files:**
- Move: `integrations/*` (6), `connectors/*` (3), `skills/` transpiler root → `archive/` (following ADR-036/037 DEPRECATED.md precedent)
- Create: `docs/adr/ADR-046-ts-integration-package-archival.md`
- Modify: `pnpm-workspace.yaml` globs as needed; CI yml references
- Test: none code — verification commands

**Interfaces:**
- Produces: no `@vaeloom/integration-*` / `@vaeloom/connector-*` workspace members; `agents/*` directory untouched (investigation note inside the ADR, one-line); `plugins/*` remains.

- [ ] **Step 1: Pre-flight rg** — zero imports of the 10 packages under `apps/`, `packages/`, CI yml. Log any hit; if a hit exists, stop and surface before moving.
- [ ] **Step 2: Move + ADR + workspace config repair; write DEPRECATED.md pointers in archive entries.**
- [ ] **Step 3: Verify:** `pnpm install` clean (lockfile diff only from workspace changes), `pnpm lint`, `pnpm typecheck`, `pnpm gen:openapi` unchanged. Commit `chore: archive orphan TS integration packages and skills transpiler (ADR-046)`.

### Task 20: Documentation maintenance

**Files:**
- Modify: `AGENTS.md` commands table (`gen_tool_fallback.py` `--check`), repo map line if paths changed
- Modify: `docs/Audits/skills-feature-production-audit.md` P0-2 marked fixed with date + link to loop.py wiring
- Modify: `docs/Audits/2026-10-18-capabilities-workbench-enterprise-audit.md` — annotate each finding as addressed-by-task (light footer table)
- Test: rg — no stale AGENTS commands

- [ ] **Step 1: Edits; verify all referenced paths exist in the committed tree.** Commit `docs: capabilities rework artifacts cross-referenced`.

# Phase 3 — Close-out

### Task 21: Badges count server-first

**Files:**
- Modify: `capabilities/page.tsx:357-376` (`categoryCounts` prefers server rows; seed fills only categories with no server rows; MCP badge reads McpView's live builtin+workspace servers through the Task 2 key)
- Test: `page.spec.tsx` count cases — server row present suppresses seed count; seed-only category still shows fallback count

- [ ] **Step 1: Failing count tests.** 
- [ ] **Step 2: Implement merge-precedence counts.** 
- [ ] **Step 3: spec + tsc + lane-1 interaction spot check** → PASS. Commit `fix(capabilities): badges report live rows first`.

### Task 22: Verification battery + re-audit v2

**Files:**
- Modify: `docs/Audits/2026-10-18-capabilities-workbench-enterprise-audit-v2.md` (new artifact)

- [ ] **Step 1: Full battery** — `pnpm lint`; `pnpm typecheck`; `cd apps/web && npx jest` (full formal run); `uv run --project apps/api python -m pytest apps/api/tests/ -q -o addopts=""`. Record each command's tail counts verbatim in the artifact; window-crash on `-n4` known, avoid.
- [ ] **Step 2: Re-run the 4-agent read-only audit** (IA/completeness, design system, dynamism, skills inventory) against HEAD; write v2 artifact with the same scorecard; pass bar ≥ 80; every score < 80 is reported with evidence and a follow-up recommendation, never smoothed.
- [ ] **Step 3: Commit** `docs: capabilities rework audit v2`.

---

## Notes for executors

- Any line marked NO (Task 6 step 6) is an explicit out-of-scope reminder, not an instruction to skip review.
- Lane parallelization applies across lanes only (6–10 | 11–16 | 17–20); Tasks 1–5 and Phase 3 are strictly sequential.
- If a task discovers hidden complexity (e.g., the executor dispatch surface differs from audit evidence), stop and report — do not silently widen scope; re-classify per repo brainstorming rules.
