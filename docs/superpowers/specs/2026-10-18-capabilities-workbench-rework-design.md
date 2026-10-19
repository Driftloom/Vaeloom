# Capabilities Workbench Rework — Design Spec

**Date:** 2026-10-18 · **Status:** Draft for user review · **Approved approach:** A (contract-first, parallel lanes)
**Baseline evidence:** `docs/Audits/2026-10-18-capabilities-workbench-enterprise-audit.md` (overall **68/100**, four read-only audit agents, all counts measured that session)

## 1. Purpose and understanding

**The user asked for:** rework of the Capabilities page, its subpages, and components into a complete design system; end-to-end dynamic behavior; add what is missing, remove what is unrelated; parallel agents. Enterprise bar.

**Agreed intent (design brief):**
- One consistent system across the workbench: data truth from the backend, one detail shell, one overlay recipe, one error family, one small-print idiom, one icon idiom.
- The UI never shows data the backend does not own: no phantom tools, no invented telemetry, no unexecuted plugins presented as executable, no invisible rows.
- Orphans and dead code are removed (archived where repo convention requires), with mechanism changes recorded (scripts + CI checks) so the drift cannot silently return.
- **Success criteria:** same scorecard re-audit ≥ **80/100**; `pnpm lint`, `pnpm typecheck`, scoped backend pytest (`-o addopts=""`), and web jest all clean after each lane; every changed wire-site asserted with exact status codes per repo honesty rules.

**Selection rationale:** the audit's worst score (dynamism, 55) comes from UI asserting fiction over backend truth. Design-first would rebuild that fiction; backend-only-first would leave the UI drifting again during its rebuild. Contract-first pins the shared interfaces, which is also what makes parallel agent execution safe.

## 2. Scope boundaries

**In scope:** `apps/web/src/app/workspace/[workspaceId]/capabilities/**`, `apps/web/src/components/capabilities/**`, `apps/web/src/lib/{capabilities-data.ts,tool-definitions-catalog.ts,api-client.ts(capabilities/connector/plugin surface)}`, supporting backend endpoints in `apps/api/src/api` (routers/capabilities.py, agents.py, tools, executor, skill_injection.py, connectors composio endpoints), scripts/, and the hygiene set named in §6.

**Out of scope (explicit):**
- Legacy `apps/web/src/lib/api.ts` client migration (still live outside capabilities; separate effort).
- Deep marketplace feature rework (only dead-branch cleanup).
- Root `agents/*` package removal (investigation note only).
- `.agents/skills/**` dev-agent tooling (touches nothing here).
- `plugins/*` SDK examples (remain).
- Any change to the ReAct loop semantics beyond adding the guarded static-path injection call.
- Key renames outside the capabilities SWR surface (only the registry keys in §3.2).

## 3. Phase 1 — Contracts (single-threaded, before lanes)

### 3.1 Tools tab served from the backend
- `ToolsView` stops building suites from the static `TOOL_DEFINITIONS_CATALOG` and consumes `capabilitiesApi.listToolDefinitions()` → `GET /capabilities/tools/definitions` (capabilities.py:941), already wrapped at api-client.ts:5143 (previously zero callers).
- Suites are grouped client-side by scope prefix with one suite-labels map; no backend schema change needed for v1.
- The SSR fallback tool rows become generated: new `scripts/gen_tool_fallback.py` emits a committed TS manifest from Python `ALL_TOOLS`, `--check` enforced in CI (pattern: `gen_memory_type_union.py`). Hand-edits to the manifest are structurally impossible; scope-drift names (e.g. `connector.browser.read` vs backend `system.browser.read`) cannot recur.
- `tools/[toolName]/page.tsx` drops the `def=null` half-page path: unknown tool name → explicit not-found panel.
- ToolsView's one-shot `useEffect` gate fetch (ToolsView.tsx:60-81) moves under the SWR key registry (§3.2).
- Tests: `capabilities-data.test.ts` extended — fallback tool names must equal the generated manifest; ToolsView spec updated to mock `listToolDefinitions`; per-suite phantom-name absence assertion (the 12 names: eval_python, take_screenshot, delegate_to_agent, broadcast_message, playback_state, queue_track, create_task_card, cursor_click, read/write_workspace_file, fetch_webpage_content, execute_custom_capability must all be gone).

### 3.2 SWR key registry + invalidation helper
- New `apps/web/src/lib/queries/capability-keys.ts`: canonical keys `['capabilities', wsId, 'list' | 'skills' | 'agent-catalog' | 'plugin-registry']` and connectors' registered key, plus `invalidateCapabilities(wsId)` (SWR `mutate`, `revalidate:true`).
- Every mutation site switches to the helper: main page toggle/install/save/delete/create/import (~10 sites, page.tsx:412/455/491/545/609/870/919), AgentsView, PluginsView, "Refresh from server" (page.tsx:664-676). Connectors keep their component-local loading but register their key and reload through the helper.
- `revalidateOnFocus:false` and zero polling stay deliberate (no naive realtime in v1).
- Tests: helper unit tests (key set, dedupe); specs updated where mocked keys change names.

### 3.3 `CapabilityDetailLayout` — one shell for six detail pages
- New `apps/web/src/components/capabilities/CapabilityDetailLayout.tsx`: breadcrumb + eyebrow + status header + action rail + tabs/panels contract, props-driven.
- Migrate: agents, connectors, mcp, plugins, tools detail pages. Skills keeps `SkillDetailPane` via adapter (it already models the contract). Shared `<MetaRow>` primitive for the metadata line (replaces `text-[11px] font-mono` ×4).
- Canonical values: borders `border-border-subtle`; rail `350px` at all breakpoints; content container `max-w-6xl` on every detail shell; eyebrow = one shared utility class in globals.css adjacent to the existing `h6` pattern (:626).
- Tests: layout smoke spec; each migrated page spec asserts the same shell markup.

## 4. Phase 2 — Lane 1: backend wiring (parallel)

1. **One plugin registry.** `capabilitiesApi.create` (category=plugin) upserts a registry row in `plugins` (the table `plugin_service` executes from) in the same request when enterprise routes are enabled; capability row = governance view. With enterprise off: HTTP **403** with stated reason; `AddCapabilityModal` reflects the disabled category instead of storing a non-executable row. Plugin subpage fixes: read `entry_point` (not `entrypoint`), delete invented `` `${plugin.name}.py` `` fallbacks (plugins/[pluginId]/page.tsx:249, :330-331) — missing stays "not reported".
2. **Real usage telemetry.** Executor paths call a shared `record_capability_usage` writing the same durable store the diagnostic endpoints use (capabilities.py:1680; agents.py:352-355). Fail-open, no execution-semantics change, 15s TTL cache untouched. "Most used" becomes execution-truth.
3. **Static-path skill injection.** `build_skill_directive` gains a second guarded call in `_dispatch_agent` (loop.py static fallback), same trust/allowlist guards as the ReAct site (loop.py:1549). Tests: static path with enabled skills → directive present; ReAct path unchanged; no injection without permission.
4. **`sync-github` wired into Import.** Skills-tab Import gains "Sync from GitHub" → `POST /capabilities/sync-github` (capabilities.py:1914); result counts surfaced verbatim ("N pulled, M compiled, 0 executed"); empty result stated as such.
5. **Composio lifecycle.** Installed composio connector cards gain Refresh (`POST /connectors/composio/refresh` :374) and Disconnect (`POST /connectors/composio/disconnect` :343) with re-auth flow on refresh failure.
6. Out of scope by decision: `getSyncStatus` long-sync polling UI. The dead wrapper is deleted in Lane 3 and returns only via a future design request.

Lane-1 backend tests (pytest): registry upsert valid; enterprise-off create → exact 403 + reason field; telemetry row effect; injection positive/negative; sync-github counts. Frontend specs updated at each wire with exact endpoint asserts.

## 5. Phase 2 — Lane 2: UI system (parallel)

1. **Overlay recipe:** all capability modals on ui-kit `Modal` (portal + scroll-lock + trap + Escape): AddCapabilityModal hand-rolled trap retired; TriggerSimulatorModal migrated (unescapable-class bug gone); McpConfigModal is deleted (§6), not migrated. Drawers stay on `useFocusTrap` and adopt the shared scrim. Scrim = `bg-black/60`, no blur; all `backdrop-blur-*` usages leave the surface; `tailwind.config.ts` gains the `backdropBlur` scale row + `design-system-guardrails.test.ts` key check.
2. **One error family.** Lane agent first verifies `danger` vs `error` resolution across `:root/.dark/.light/.high-contrast` (globals.css; audit UNVERIFIED), then converts all 31 sites to the resolving family. New guardrail assertion: no mixed families in capabilities.
3. **Form atoms:** 4 selects, 2 textareas, 15 inputs → `FormField/Input/Select/Textarea`; CustomProtocolModal gains real form atoms under its ui-kit Modal; hand-rolled chevron deleted (ConnectorsDirectory:93-104). Two dynamic-value inline styles remain (agent hue glyph AgentCard.tsx:45/AgentDetailPane.tsx:308, meter width SkillPlaygroundDrawer.tsx:325).
4. **Regression repairs:** `agents/[agentId]` renders `AgentAutonomySelector` (radiogroup) instead of inline buttons (:383-405) and re-syncs from `selectedAgent.defaultAutonomy` when the catalog resolves (kills stale-at-mount + optimistic-only save); 5 inline status dots → `StatusDot`; `window.confirm` rollback → `ConfirmationDialog`.
5. **Language:** `text-2xs` = the one tiny idiom; `text-[11px] font-mono` → `<MetaRow>`; eyebrows → shared utility class. Emoji-as-icons (SkillIntegrationBar:120-151) → real icons; three inline SVG sets → shared icon imports. SkillMarkdownViewer keeps ReactMarkdown but adopts the shared `.markdown-body` classes.
6. **Tab pattern:** `ConnectorsHeader` gains arrow-key roving + `aria-controls` (alignment with `tabPattern.a11y.test.tsx`).
7. **MCP subpage truth:** configured servers render live `config` instead of template defaults (mcp/[serverId]/page.tsx:236, :275-286); the template view survives only for unconfigured servers.

Lane-2 tests: extended guardrails (backdropBlur row, single error family), a11y suites extended (trap/Escape on migrated modals, roving tabs), page specs refreshed.

## 6. Phase 2 — Lane 3: hygiene (parallel)

1. Delete `mcp/McpConfigModal.tsx` (420 lines, zero callers) and the localStorage write layer (capabilities-data.ts:2212-2574, ~360 lines); `getStoredCapabilities` survives only for the dup-name check, header comment updated.
2. Delete dead client methods: `capabilitiesApi.toggleCapability`, `capabilitiesApi.getCatalog`, and `connectorsApi.getSyncStatus` (per the §4.5 out-of-scope decision).
3. Delete the 4 never-rendered seed MCP rows (SEED_CAPABILITIES 63→59). Delete the 4 dead marketplace id branches + pseudo-id counting (marketplace/page.tsx:155-255 region, per skills audit).
4. Remove the 11 seed-only skills from the web seed (4 web-only: acceptance-criteria-review, accessibility-testing, frontend-design, ui-ux-pro-max; 7 also in .agents/skills: agent-building, agentic-workflows, autoplan, check-work, deep-learning-rag-evals, llm-engineering, system-design). Productizing any of them is a separate future request. Remove `skill_catalog_service.py:218`'s nonexistent external-script reference.
5. Archive, not delete: `integrations/*` (6) + `connectors/*` (3) TS packages and the root `skills/` transpiler, following the DEPRECATED.md precedent (ADR-036/037); write the archive ADR; fix `pnpm-workspace.yaml` / CI references; verify clean `pnpm install` + no dangling imports. `plugins/*` SDK examples and `.agents/skills/**` remain. Root `agents/*`: investigation note only.
6. Repo docs updated in the same change: AGENTS.md commands table gains `gen_tool_fallback.py`; `docs/Audits/skills-feature-production-audit.md` stale P0-2 marked fixed; this spec linked from the audit.

## 7. Phase 3 — Close-out

- `categoryCounts` (page.tsx:357-376) counts server rows first; seed only fills categories with no server rows; pinned by tests.
- Verification battery: `pnpm lint && pnpm typecheck`; web jest (capabilities suites); backend scoped pytest `-o addopts=""` for touched routers/executor/injection; full-suite serial numbers trusted only as evidence here per repo rules (no -n 4).
- Final re-audit: rerun the same 4-agent read-only audit + scorecard from the baseline artifact; write `docs/Audits/` v2; pass bar ≥ 80/100. Any score below bar is reported with evidence, never fudged.

## 8. Parallel execution rules

- Phase 1 completes and merges before any lane starts (contracts are the interfaces lanes depend on).
- File ownership barriers (approximate, enforced at planning): Lane 1 = backend routers/executor/injection + Import wiring; Lane 2 = components/capabilities UI + config + guardrails + mcp/[serverId] config truth; Lane 3 = deletions, seed edit, packages, docs. Conflicts limited to `capabilities-data.ts` (Lane 3 seed edit vs Lane 1 fallback clip) and `api-client.ts` — the planner must sequence the two deletions there after Lane 1's methods land.
- Each lane runs its scoped tests before handoff; the finisher runs the full battery.

## 9. Risks and mitigations

1. **Key renames break specs** — mocks updated by the same lane edits; helper unit tests pin the registry.
2. **`danger`/`error` tokens might not resolve in high-contrast** — verification-first conversion; if neither resolves everywhere, that is an audit finding to fix in globals.css in the same lane (add token, then collapse).
3. **Enterprise-off plugin 403 UX** — AddCapabilityModal copy states why; no silent stores.
4. **Telemetry write cost in executor hot path** — fail-open single durable update; per-execution, no batching pretense; measure in scoped pytest.
5. **Agent row-id parity (seed vs catalog ids)** — resolved by making live rows authoritative after merge (§7 badge rule + existing merge precedence at page.tsx:320-323).
6. **Package archiving breaks workspace globs** — verify with clean `pnpm install`, lint, typecheck, and CI yaml grep in the same change.

## 10. UNVERIFIED items assigned for verification

- `danger` vs `error` token resolution per theme → Lane 2 §5.2 step 1.
- Route/scope of `capabilitiesApi.test` category routing → confirmed against api-client.ts:5195-5200 during Lane 1 import/probe wiring.
- Whether `capabilities.py` validates tool `name` on create → Lane 1 (add validation if absent; phantom rows unbounded today).
- Roving-tabindex internals of McpView/Drawer tabrows → Lane 2 native reference when fixing ConnectorsHeader.

## 11. Decisions already made (so the plan does not re-ask)

- Approach A over B/C; full-stack scope; 11 seed-only skills removed; orphan TS packages archived not deleted; `plugins/*` and `.agents/skills` untouched; `agents/*` investigation-only; overlay recipe = ui-kit Modal, no blur; skill/detail layout = new feature component (not ui-kit); legacy api.ts migration deferred.
