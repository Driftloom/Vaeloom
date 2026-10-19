# Capabilities Workbench — Enterprise Audit

**Date:** 2026-10-18 · **Scope:** `/workspace/{id}/capabilities` main page, 6 category tabs, 7 detail subpages, 49 components, plus the backend surfaces they depend on.
**Method:** 4 parallel read-only audit agents (IA/completeness, design system, e2e dynamism, skills inventory). Every count below was measured this session; audit-doc-derived numbers are attributed. Unverified items are marked UNVERIFIED.

---

## Scorecard

**Overall: 68 / 100 — "Solid core, structural debt." Demos well, not yet enterprise-grade.**

| # | Dimension | Weight | Score | Notes |
|---|-----------|-------:|------:|-------|
| 1 | IA & route completeness | 15 | 85 | Zero broken links; all 7 detail routes exist; alias redirects work |
| 2 | End-to-end dynamism | 20 | 55 | Biggest weakness: static tool catalog, dual plugin registries, dead sync |
| 3 | Design-system adherence | 15 | 68 | Token pipeline solid, zero raw colors; 6 divergent detail shells |
| 4 | Accessibility | 10 | 65 | Model citizens exist alongside untrapped/unescapable modals |
| 5 | Resilience & UI states | 10 | 75 | Honest fallbacks + skeletons; stale-at-mount seams remain |
| 6 | Hygiene (dead code) | 10 | 60 | ~800 lines dead web code + ~15 orphan packages repo-wide |
| 7 | Skills/capability inventory fit | 10 | 60 | Core story healthy; 12 phantom tools, 11 seed-only skills |
| 8 | Test & quality gates | 10 | 85 | Deep, precise specs incl. honesty tests (measured: page.spec ~1,130 lines, ~1,100-line MCP suite) |
| | **Weighted total** | **100** | **68.45 → 68** | |

Bands used: 80–100 enterprise-grade · 65–79 solid core, structural debt · 50–64 demo-grade · <50 not releasable.

---

## Dimension 1 — IA & completeness (85)

**Verified strengths:**
- All 7 detail subpages exist with spec files: `agents/[agentId]`, `connectors/[connectorId]`, `mcp/[serverId]`, `plugins/[pluginId]`, `skills/[skillId]`, `tools/[toolName]` + main page (941 lines).
- **Zero broken internal links.** All 20 link sites resolved against real routes (incl. `CommandCenter.tsx:201,447`, sidebar, dashboard empty state).
- Alias routes converge traffic: `/skills` and `/connectors` redirect into `capabilities?category=…`; legacy `?tab=` mapped.

**Gaps:**
1. Duplicate agent surfaces: `/workspace/{id}/agents/*` remains live while `agents/[agentId]` lives inside capabilities too; reconciled for skills/connectors only via redirects, not for agents/tools/plugins.
2. The 4 seed MCP rows (`capabilities-data.ts:1983-2074`) are loaded (`page.tsx:283-285`) but no tab ever renders them — permanently invisible (63 seed rows, 4 dead on arrival).
3. Badge counts (`page.tsx:357-376`) conflate seed fallbacks with live rows (agents badge = 10 seeded agents regardless of live catalog).

## Dimension 2 — End-to-end dynamism (55)

**Wired and real (measured map, client → router):** `capabilitiesApi` list/listSkills/create/update/delete/validateDraft/testCapability → `GET/PATCH/POST/DELETE /capabilities*` (capabilities.py:1111/1255/1412/1552/992/1630); agents probe → `/agents/capabilities/test`; connectors/MCP/composio endpoints all wired; plugins list/execute wired.

**Structural gaps (ranked):**
1. **Tools tab shows a fictional toolset.** 67 backend tools (`tools/definitions.py`); Tools tab mirrors 19, of which **12 are phantom names** (`eval_python`, `take_screenshot`, `delegate_to_agent`, …). Toggling a phantom writes a gate row the executor never consults; meanwhile `GET /capabilities/tools/definitions` exists but has **zero frontend callers**.
2. **Two plugin registries.** Workbench "Add Plugin" writes a `WorkspaceCapability` row (`page.tsx:853`); the `plugins` table + `POST /plugins` (`pluginApi.register`) is a parallel registry PluginsView reads but nothing reconciles. Seed plugins have no registry rows → execution paths 403/409 by design.
3. **`POST /capabilities/sync-github` is dead from the UI** — "Import" registers a URL string only (`page.tsx:925`).
4. **`usage_count` only increments on diagnostic probes** (`capabilities.py:1680`, `agents.py:352-355`); real execution never bumps it → "Most used" sort misleads. (Compensating: `_audit` durably records mutations in `audit_events`.)
5. **Persistent-agent CRUD (list/create/execute/run/cancel) fully orphaned** — governance happens only via capability rows.
6. Composio `disconnect`/`refresh` endpoints orphaned; can't refresh tokens from UI.
7. **Cross-pane SWR keys diverge** (`workspace-capabilities` vs `agent-capability-rows` vs `plugin-registry`); `Refresh from server` (page.tsx:664-676) misses connectors/MCP; `revalidateOnFocus:false` + no polling → server-side changes invisible until remount.
8. ToolsView gate fetch is a one-shot `useEffect` (ToolsView.tsx:60-81) — toggles elsewhere don't refresh it.
9. Legacy `api.ts` second client still live for integrations alongside `api-client.ts` (different transform paths).
10. Marketplace → Composio never connects (`MarketplaceService.execute_plugin_action:459-462` handles `composio-` slugs no listing ever has; listing PKs are UUIDs).

**Static data inventory:** `capabilities-data.ts` seed is honest fallback (tested); `tool-definitions-catalog.ts` (948 lines) hand-mirrors backend; `connectors-catalog.tsx` (3,150 lines, ~201 rows, no `isSeed` provenance); `MCP_CATALOG_TEMPLATES` (builtin list itself is live).

## Dimension 3 — Design system (68)

**Strengths:** tokens generated one-way from `globals.css` → `packages/ui-kit/src/tokens/**` with `--check`; **zero raw hex/rgb/arbitrary colors** across the entire workbench; 31/48 components import `@vaeloom/ui-kit`; guardrail test exists (`design-system-guardrails.test.ts`).

**Debt (ranked):**
1. `backdrop-blur-xs` class is silently purged (ConnectorDetailDrawer.tsx:226, McpConfigModal.tsx:180) — same defect class as the already-fixed `shadow-xs`; no `backdropBlur` row in the guardrail key check.
2. **6 detail-page shells for 7 detail routes** — only skills reuses `SkillDetailPane`; 5 pages re-implement ~150 lines each with 3 border idioms (`border-border` / `-subtle` / `/NN`) and rail widths 350/360/390/400/410.
3. Two `error` families coexist: `text-error` ×22 vs `text-danger` ×9 (both inside AddCapabilityModal).
4. Three overlay scrims: `bg-black/60`, `bg-background/80 backdrop-blur-sm`, `bg-background/80 backdrop-blur-xs(purged)`.
5. Raw form controls bypassing ui-kit: 4 `<select>`, 2 `<textarea>`, 15 `<input>` sites incl. all 7 in CustomProtocolModal; hand-rolled chevron in ConnectorsDirectory:93-104.
6. Inline status dots ×5 bypassing `StatusDot` (one inside a Button: SkillTelemetryCard.tsx:97).
7. Icon chaos: emoji as icons (SkillIntegrationBar:120-151), three inline SVG sets, two markdown theming systems.
8. `text-2xs` ×176, `text-[11px] font-mono` ×4 routes, `uppercase tracking-wider` eyebrows ×28 — three small-print idioms.
9. `window.confirm` for destructive rollback (ConnectorDetailDrawer) vs `ConfirmationDialog` elsewhere.
10. Container-width drift (`max-w-7xl` vs `max-w-6xl`) between sibling connector tabs.

## Dimension 4 — Accessibility (65)

- **Critical:** `McpConfigModal.tsx` (credential entry!) and `TriggerSimulatorModal.tsx` have **no focus trap, no Escape close**; add-capability modal traps+escapes but lacks portal; drawers do it right (`useFocusTrap`). ui-kit Modal used correctly in ConnectorModals.
- `agents/[agentId]/page.tsx:383-405` re-introduces the exact autonomy-picker bug `AgentAutonomySelector.tsx:35-38` documents as fixed (no radiogroup/aria-checked; every chip tabbable).
- `ConnectorsHeader.tsx:38-77` tablist without arrow-key roving; sibling implementations have it (UNVERIFIED exact roving detail in McpView/Drawer).
- Existing suites: `a11y.test.tsx`, `tabPattern.a11y.test.tsx`, `AgentAutonomySelector.a11y.test.tsx` (internals not fully read — UNVERIFIED scope).

## Dimension 5 — Resilience & states (75)

Skeletons match shapes; error.pyx/loading.tsx exist on main page; empty/error states honest ("Never"/"Unknown" instead of fabricated telemetry — enforced by `capabilities-data.test.ts:42-160`).
Gaps: agent autonomy state stale-at-mount (+ optimistic save without re-sync, agents/[agentId]/page.tsx:142-144,171); plugin subpage re-invents an entrypoint path it explicitly refused to guess elsewhere (`plugins/[pluginId]/page.tsx:249,330-331` — mixes `entrypoint` vs API's `entry_point`); PluginsView correctly shows ErrorState when `/plugins` is enterprise-disabled; MCP subpage shows template config for configured servers instead of live config.

## Dimension 6 — Hygiene / dead code (60)

- `mcp/McpConfigModal.tsx` — 420 lines, zero references outside barrel re-export.
- `capabilities-data.ts:2212-2574` — ~360 lines of versioned localStorage write path with zero production callers (writes go to server now); only `getStoredCapabilities` survives as a dup-name check.
- Dead client methods: `capabilitiesApi.getCatalog`, `toggleCapability` (dup of update), `connectorsApi.getSyncStatus` (long syncs unobservable), legacy `api.connectors.*`.
- Repo-wide orphans (from skills audit): 6 `@vaeloom/integration-*` + 3 `connector-*` + 5 `plugin-*` TS packages with 0 imports in apps/; 27/28 root `agents/*` packages unwired (1, `career-agent`, used via pytest pythonpath); root `skills/` transpiler legacy, 0 refs; `marketplace` page dead `composio-`/`native-*` id branches.
- Zero TODO/FIXME markers in the capabilities tree (verified).

## Dimension 7 — Skills & capability inventory fit (60)

- Core story healthy: 28-entry backend bundled catalog (pinned by test), workspace-authored skills CRUD, trigger-gated injection into the ReAct seam, `/skill:` pinning parsed server-side (`chat.py:74`, `agents.py:637/704`).
- **Static dispatch fallback never injects skills** — `build_skill_directive` has one call site (`loop.py:1549` in `_try_react_loop`); with `agent_react_enabled=False` skills show "active" in UI but apply nothing.
- 39-skill frontend seed vs 28-entry catalog: **11 rows can never be server-backed** (4 web-only: `acceptance-criteria-review`, `accessibility-testing`, `frontend-design`, `ui-ux-pro-max`; 7 in `.agents/skills` only: `agent-building`, `agentic-workflows`, `autoplan`, `check-work`, `deep-learning-rag-evals`, `llm-engineering`, `system-design`).
- `.agents/skills/` (69 dirs) = dev-agent tooling, zero product references; `skill_catalog_service.py:218` references a nonexistent external script.
- Backend truth per flow: 28 skills ✓, 67 tools ✓ (60 not surfaced), 356 Composio apps ✓, 2 builtin MCP servers ✓, 9 marketplace listings ✓ — the flows are *capable*; the UI *overstates and understates* different parts of it.

## Dimension 8 — Tests & gates (85)

~1,130-line main page spec with exact wire assertions (PATCH/POST paths, 404/409 surfacing, category mapping); ~1,100-line MCP/connectors suite; honesty tests pin seed scopes/tool-names against backend; a11y suites at layout + module level; backend tests cover routers. Stale docs exist: published audit `docs/Audits/skills-feature-production-audit.md` P0-2 (`/skill:` server parsing) is now fixed but unmarked.

---

## Removal candidates (evidence-based)

| Candidate | Risk | Evidence |
|---|---:|---|
| `integrations/*`, `connectors/*`, `plugin-*` TS packages (14) | low-med | 0 imports anywhere in apps/; ADR-036/037 deprecations exist |
| `mcp/McpConfigModal.tsx` (420 lines) | low | dead; manifest editor replaced it |
| localStorage write layer (~360 lines) | low | server persistence replaced it |
| 12 phantom tool entries in `tool-definitions-catalog.ts` | low | never existed backend; gates on them are inert |
| `capabilitiesApi.getCatalog`, `toggleCapability`, `getSyncStatus` wrappers | low | zero callers |
| marketplace page dead `composio-`/`native-*` branches | low | unreachable vs UUID PKs |
| 11 seed-only skills | low | promote-or-remove decision needed |
| root `agents/*` 27 packages, `skills/` transpiler | med | `career-agent` needed by tests — investigate convention first |
| legacy `api.ts` integrations members | med | still live call sites — needs migration first |

**Keep:** `.agents/skills` (dev tooling), `agents/career-agent`, `plugins/*` SDK examples, all Python capability machinery.

## Missing-capability register (flow → missing piece)

1. Long-running connector sync → no status UI (`getSyncStatus` orphaned).
2. Tool catalog truth → served from static TS mirror, not `GET /capabilities/tools/definitions`.
3. GitHub skills sync → backend exists, no UI entry.
4. Composio token lifecycle → no disconnect/refresh UI.
5. Real usage telemetry → executor never records usage.
6. Skill enforcement on static path → no injection call there.
7. Plugin execution for capability-created plugins → no registry rows.

## Prioritized remediation backlog

- **P0 (truth/correctness):** serve Tools tab from backend definitions (or regenerate the mirror by script + CI check); wire `sync-github` into Import (or delete); refresh `skills-feature-production-audit.md` stale findings; fix `entrypoint`/`entry_point` + invented path on plugin subpage.
- **P1 (unification):** extract `CapabilityDetailLayout` (kills 5 shells + rail drift); collapse error/danger to one family; one modal/drawer/scrim recipe on ui-kit Modal + trapped overlays; route Tab-style components to backend suites; unify SWR keys + single invalidate helper (replaces dead localStorage layer).
- **P2 (completeness):** plugin registry reconciliation (or gate Add-Plugin clearly); usage telemetry from executor or rename the sort; autonomy picker re-sync; backend-driven badges; marketplace slug strategy.
- **P3 (repo hygiene):** archive orphan TS packages per ADR; remove dead wrappers/modals; guardrail test gains backdropBlur + error-family checks.

## Excellent, preserve as-is

Zero raw colors; honest seed protocol (`isSeed`, zero-invented-numbers test); alias-route convergence; MCP template placeholder guard; `AgentAutonomySelector` component quality; connectors `Promise.allSettled` local consistency; audit-event durability on mutations.

## Appendix — UNVERIFIED items

Exact roving-tabindex internals of McpView/Drawer tabrows; AddCapabilityModal full Tab-order matrix under dynamic DOM; dark/high-contrast resolution of `*-error` vs `*-danger` tokens; whether `capabilities.py` validates tool `name` on create (phantom rows bounded or not); whether any operator seeds `composio-*` listings directly in DB; seed-vs-live row-id parity for agents on a seeded DB; runtime behavior of `capabilitiesApi.test` category routing (read from comments, not executed).
