# Memory & Sync Production Overhaul Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the Memory and Vault-Sync surfaces from audit score 5/10 to production readiness: kill the phantom-token visual breakage, make every async surface honest (loading/empty/error/truncation), complete the missing sync capabilities (conflict history, devices, retry), fix the cross-system integration contract breaks (chat drawer, agent tool fabrication, loop priority), then verify with real-world use cases.

**Architecture:** Two waves. Wave 0 lands a source-scanning token guardrail (red until Wave 1). Wave 1 runs five file-disjoint lanes in parallel: (A) main memory page, (B) vault-sync FE+BE end-to-end incl. migration 0070 conflict history, (C) corrections + detail page, (D) graph + scale, (E) integration + backend gaps. Wave 2 verifies, Wave 3 exercises real user flows.

**Tech Stack:** Next.js 15 App Router, React 19, SWR, Tailwind (`tailwind.config.ts` semantic classes), Jest + RTL, FastAPI, SQLAlchemy async, Alembic, pytest.

**Spec:** [docs/superpowers/specs/2026-10-18-memory-sync-production-overhaul-design.md](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/docs/superpowers/specs/2026-10-18-memory-sync-production-overhaul-design.md) — the mapping table (§1.1), graph palette (§2), honesty rules (§3), state model (§4) are binding.

## Global Constraints

- Never run bare `pnpm dev`. Web tests: `pnpm --filter @vaeloom/web test`. Typecheck: `cd apps/web && npx tsc --noEmit`. BE scoped tests: `uv run --project apps/api python -m pytest apps/api/tests/<file> -q` from repo root.
- `globals.css` is the token source; **zero additions there**. `python scripts/gen_tokens.py --check` must stay green (proves the fix is consumer-side).
- Never hand-edit `*.generated.ts`. Memory types come from `CAREER_TYPES` / `memory.generated.ts` union.
- Honesty rules of AGENTS.md apply: exact status assertions, no expectation edits to force green. The ONE deliberate expectation change is Task E3 (sync_vault fabrication test → honesty test), documented there.
- Do not trust `-n 4` totals on Windows; scope pytest per file.
- Migration 0070 must carry RLS `ENABLE` + `FORCE` + policy AND end with the carried-forward coverage re-assertion — copy the `_assert_coverage` tail from `0069_memory_workspace_isolation.py:307` (keep the exact literal `incomplete RLS coverage`, required by `test_migration_chain_pg.py:259`; the guard moves to every new head because 0066 is no longer terminal).
- `motion-reduce:transition-none`, WCAG AA contrast, `MIN_TOUCH_TARGET` for new touch targets.

## Audit Summary (2026-10-18, evidence in session)

| Area | Score | Headline |
|---|---|---|
| Memory FE | 5/10 | phantom vars, false-empty error states, no pagination, invalid type option |
| Sync FE+BE | 4.5/10 | invisible errors, no history/devices, fabricated badge, tool writes fake state |
| Memory BE | 7/10 | strong isolation; contract bugs at seams (bare array, loop priority) |
| Design adherence (memory area) | 4/10 | 447 class usages + ~53 inline styles of nonexistent `--color-*` vars; 15 hexes in graph/legend |
| Integration | 6/10 | drawer always empty, sync_vault fabricates, P2_RETRIEVAL invalid |
| **Overall** | **5/10** | parts are enterprise-grade; the seams are broken |

## Decisions (locked; autoplan 6-principle pass, Codex unavailable → Claude-voice only)

- **D1 Scope:** Complete overhaul of memory+sync surfaces as user requested ("complete", "production level"). Modularization refactors and publish pipelines are OUT (see Out of Scope).
- **D2 Tokens:** Replace phantom `var(--color-*)` with existing Tailwind semantic classes per spec §1.1 (repo idiom `text-text*`, `bg-surface*`, `border-border*`). No new CSS vars. (Evidence: all 447 usages live in exactly 11 memory-area files; every needed color already exists in `tailwind.config.ts`. P4 bias-to-action: mechanical, high-confidence.)
- **D3 Conflict history:** New table `vault_sync_conflict_history` + migration 0070 with RLS (0067-0069 workspace-scoped pattern). Columns derived from the REAL record shape — conflicts live only in `connector.config["conflicts"]` JSON (`VaultClientConflict` `:258-264`: `{file, conflict_file, local_head, remote_head, detected_at}`); no conflicts table exists. Resolve inserts-once (idempotent by `(connector_id, conflict_id)`) then removes from the active ledger; copy = "resolution recorded — local client applies on next sync". (CEO amendment 2; P2 honesty.)
- **D4 sync_vault tool honesty (widened by DX):** Remove fabricated writes across ALL sites in `apps/api/src/api/tools/executor.py:965-1051` — update-path `:1015-1017`, creation seed `:990-996` (incl. invented `~/Documents/VaeloomVault` path), `:1009`, log claim `:1019-1024`, result `:1033`; mirror the router's `executed:false` shape (`vault_sync.py:463-475`); fix the live descriptions (`definitions.py:200`, `memory_agent/handler.py:37`). Rewrite `test_agent_memory_vault_tools.py:326-337` to assert honesty — deliberate, documented expectation change. Keep the tool name. (P1 completeness.)
- **D5 Chat drawer:** FE-side fix — accept bare array from `GET /workspaces/{id}/memories` (no BE contract change; verify no other consumer expects an envelope first). (P3: compatible side chosen.)
- **D6 Truncation honesty everywhere:** "Load more" on mains list; "Showing X of N" on graph; feed truncation (BE returns `total` — `routers/memory.py:163,252`) gets the same treatment. (P1: silent truncation misleads.)
- **D10 Devices registry:** `report` merges per-machine state (`cfg["devices"][machine] = {client_version, last_heartbeat, status, last_pull_time, last_push_time, last_error}`); today it overwrites single-slot (`:1002-1014`) and replaces the ledger wholesale (`:1016-1017`). Top-level fields remain alias of latest reporter (back-compat). `status.devices` derives from the map. FE labels "last reported device", never "current". Survives the gate unless user descopes to a single client card. (CEO challenge 1.)
- **D11 Search wiring:** query box → `POST /memories/search` (exists; wrapper `api-client.ts:314`), 300ms debounce + stale-guard + type filter; client-side filter only serves the zero-query list mode. Prevents the post-pagination false-empty (`page.tsx:167-184` filters loaded rows only). (CEO challenge 2; P1.)
- **D12 One shared SWR key:** tile (`page.tsx:139-143`, today `vault-sync-status-${workspaceId}`/15s) and panel (`VaultSyncPanel.tsx:35-39`, today `['vault-sync-status', workspaceId]`/5s) both move to literal `['vault-sync-status', workspaceId]`, one fetcher, ONE `refreshInterval: 15000`. (CEO amendment 6; kills the double poll.)
- **D13 Error/empty surfaces use ui-kit `ErrorState`/`EmptyState`** — no hand-rolled error cards across lanes (siblings already use them: `GraphViewer.tsx:379`, `ScaleMemoryViewer.tsx:188-196`). Verify the export exists in `packages/ui-kit/src/index.ts` first. (CEO amendment 7.)
- **D7 Guardrail:** Source-scan Jest test, scoped to memory dirs, banning phantom vars + raw hex in class/style literals. Red in Wave 0, must be green after Wave 1. (P4: makes regression impossible.)
- **D8 Download-client:** REMOVE the affordance (DX amendment 6, evidence-backed: `@vaeloom/vault-sync` is `"private": true` — `packages/vaeloom-sync/package.json:5`; `dist/` gitignored; the endpoint serves an `npm install -g @vaeloom/vault-sync` payload for a package that isn't published — `vault_sync.py:1111`; `downloadClientUrl` (`api-client.ts:525-526`) has zero callers and targets an auth-required endpoint, so a plain anchor 401s). Endpoint stays as-is; dead helper stays (AGENTS.md: mention dead code, don't delete). The button must not promise a download that cannot exist.
- **D9 Parallelism:** 5 Wave-1 lanes, disjoint file sets (ownership map below). Single writer per file.

## Facts (verified this session) & Assumptions

- **F1 (verified):** `globals.css` defines only `--color-focus-ring[-offset]` among `--color-*`; repo-wide `*.css` grep empty. Tailwind maps the runtime triplet vars. (grep evidence in session)
- **F2 (verified):** `workspaces.py:120` returns a bare `[MemoryResponse]` array; `ChatMemoryDrawer.tsx:43-58` reads `.memories`/`.items` → always `[]`.
- **F3 (verified):** `loop.py:1001` `priority="P2_RETRIEVAL"` — not a `CognitivePriority` member.
- **F4 (verified):** mirror of the mapping table: counts `text-[var(--color-text-primary)]` 127, `border-[var(--color-border)]` 113, `text-…muted` 62, `text-…secondary` 51, `bg-…surface-subtle` 34, `bg-…surface` 30, `bg-…surface-sunken` 30, `bg-…surface-hover` 17, plus small fill/divide + 53 inline `--color-brand-primary`.
- **F5 (agent-audited, spot-verified):** conflict resolve filters the JSON ledger (`vault_sync.py:1077-1088`); `machine` stored but not surfaced; `download-client` endpoint has no FE caller; vault page static claims at lines 35-40, 505, 788, 482; graph hexes `GraphViewer.tsx:12-21`, `graph/page.tsx:59-79`; `memory/page.tsx:802` offers `task`; `MemoryCorrectionPanel.tsx:36` never sends `include_superseded`; `:229-232` checks `supersedesId` while API returns snake_case.
- **F6 (CEO-verified):** conflicts ledger lives ONLY in `connector.config["conflicts"]` (no table exists); `report` REPLACES the ledger (`vault_sync.py:1016-1017`) and overwrites single-slot machine/times (`:1002-1014`); one `vault_sync` connector per workspace (`:186-217`).
- **F7 (CEO-verified):** memory search is client-side over loaded rows (`page.tsx:167-184`); list capped 100 (`:126`); feed capped 50 (`:111`) though BE returns `total`; `POST /memories/search` exists with FE wrapper (`api-client.ts:314`).
- **F8 (CEO-verified):** status response already carries `last_error` (`vault_sync.py:349`) and heartbeat data (`:359`) — surface both.
- **F9 (CEO-verified):** tile and panel use different SWR keys and poll intervals (D12).
- **A1:** `/workspaces/{id}/memories` has no other FE consumer than ChatMemoryDrawer — E1 verifies before choosing the compat fix.
- **A2:** Backend supports `limit/offset` (list) and `page_size` (graph) query params — verified in implementation step E/A.
- **A3:** Migration head is `0069_memory_workspace_isolation.py`; 0070 is the next number.

## End State After This Plan

Memory area renders correctly in all three themes with zero phantom tokens (guardrail green). Every async surface has honest states. Corrections can see and re-correct superseded memories. Graph reports `Showing X of N` and uses semantic colors. Sync page offers conflict history, device list, real retry; agent `sync_vault` no longer fabricates. Chat memory drawer works. Real-world use-case checklist (below) passes against live servers.

## Review Focus

1. Phantom migration completeness: `rg "var\(--color-" apps/web/src` returns only `--color-focus-ring` hits; guardrail test green.
2. No fetch failure renders as empty or "not connected" anywhere in the area (manual error-state drill: stop API, watch every surface).
3. Truncation honesty: >100 memories — list shows total with Load More; graph shows `Showing X of N`.
4. Light + dark + high-contrast theme walk of all 6 memory routes — borders and panel fills visible everywhere.
5. `sync_vault` tool invocation returns honest payload and writes nothing fake (pytest + manual agent run).

---

## Wave 0 — Foundation

### Task F1: Token guardrail (red until Wave 1)

**Files:**
- Create: `apps/web/src/__tests__/design-tokens.guardrail.test.tsx`
- Read: `docs/superpowers/specs/2026-10-18-memory-sync-production-overhaul-design.md` §1.1, §7

**Steps:**
- [ ] Write a Jest test scanning `apps/web/src/app/workspace/[workspaceId]/memory/**` and `apps/web/src/components/memory/**`, EXCLUDING `__tests__/**` and `*.test.*` files (honesty tests legitimately contain phantom strings as negative fixtures):
  1. FAIL if `/var\(--color-(?!focus-ring)/` matches any scanned file.
  2. FAIL if `/#[0-9a-fA-F]{6}\b/` matches ANY string literal in scanned files — the graph palette hexes live in const maps and `fill=`/`stroke=` attrs, not just `className`/`style` (`GraphViewer.tsx:12-21`, `graph/page.tsx:59-79`). (CEO amendment 5.)
  3. FAIL if `/rgba?\(\s*\d/` matches any scanned file (`rgb(var(--x))` is the only legal form). (Design amendment 8.)
- [ ] Run: `pnpm --filter @vaeloom/web test -- design-tokens.guardrail`
- [ ] Expected: **FAIL** with ~11 files named (this is the fail-before evidence; do not weaken the test to pass).

---

## Wave 1 — Five parallel lanes (disjoint files)

### Task A: Main memory page (`memory/page.tsx`)

**Files:**
- Modify: `apps/web/src/app/workspace/[workspaceId]/memory/page.tsx`
- Modify: `apps/web/src/app/workspace/[workspaceId]/memory/not-found.tsx`
- Modify: `apps/web/src/app/workspace/[workspaceId]/memory/__tests__/memoryPage.honesty.test.tsx`

**Interfaces consumed:** mapping table spec §1.1; `MEMORY_TYPES`/golden filter union already imported by this page; SWR.

**Steps:**
- [ ] Replace all phantom `var(--color-*)` class usages with spec §1.1 classes.
- [ ] Create modal (~`:802`): FIRST check for existing `type='task'` rows (query the list endpoint with that type, or `POST /memories/search` for it) — if any exist, keep a legacy read path/notice so they are not orphaned; then replace the option with the canonical generated union (same constant the filter row uses). (CEO amendment 9.)
- [ ] Error states: list/feed/lineage/vault-stat SWRs — destructure `error`, render ui-kit `ErrorState` + Retry (`mutate`) per D13. A failed fetch must never render "Your Memory is ready" / empty states. **ready(stale) rule (design amendment 6):** `ErrorState` only when `!data`; a failed revalidation with last-good data keeps the data + stale marker/toast.
- [ ] Pagination: read `total` from list response (envelope `{memories, total, …}`); add "Load more" (append) beyond first page (100). Use `limit/offset` (verify param names against `list_memories` in `memory_service.py`).
- [ ] Feed truncation honesty: FEED caps at 50 but BE returns `total` — same pattern (read `total`, show `Showing X of N` or Load more for feed page). (CEO amended D6.)
- [ ] Search wiring per D11 (refined by design amendment 5): when the query is non-empty, call `POST /memories/search` — response is a bare `list[{memory, score}]` with NO `total` and defaults `top_k=10`/`threshold=0.7` (`routers/memory.py:868-904`, `schemas/memory.py:156-157`). Pin an explicit `top_k`; 300ms debounce + stale-response guard + type filter param; zero-query keeps list mode. Copy: "No strong matches" (never "No records match"); label results "top N matches" when the cap is hit; failure → `ErrorState` (imperative, not SWR); `aria-busy` while in flight.
- [ ] `?query=` deep-link: sync from `useSearchParams()` effect so a mounted page updates the search box when the URL changes (CommandCenter flow).
- [ ] Vault stat tile (~`:139-143,469`): adopt the D12 shared SWR key/interval (one literal, one fetcher); render error state; show `last_error` + last-contact age from status fields (F8).
- [ ] Caption honesty: remove/replace "30s auto-push & rebase" (~`:482`) — state only what happens (manual sync request; no server-side git engine).
- [ ] Tests: extend `memoryPage.honesty.test.tsx` —
  - create-modal type options ⊆ canonical union (regression for `task`);
  - caption does not claim automatic push/rebase;
  - list fetch error renders error+retry, not ready state (mock SWR reject);
  - server-search path: typing calls the search endpoint (mock); cap-hit renders "top N matches", below-threshold renders "No strong matches"; paginated window does not produce a false "No records match";
  - ready(stale): fetch succeeds, then revalidation rejects → data stays rendered, no ErrorState (design amendment 6).
- [ ] Run: `pnpm --filter @vaeloom/web test -- memoryPage.honesty` → PASS.

### Task B: Vault-sync end-to-end (FE + BE + migration)

**Files:**
- Modify: `apps/web/src/components/memory/VaultSyncPanel.tsx`
- Modify: `apps/web/src/components/memory/__tests__/VaultSyncPanel.honesty.test.tsx`
- Modify: `apps/web/src/app/workspace/[workspaceId]/memory/vault/page.tsx`
- Modify: `apps/web/src/lib/api-client.ts` (lane B owns it: add history wrapper to `vaultSyncApi` beside `getStatus` `:466`/`getConflicts` `:491`; lane D reuses EXISTING helpers only)
- Modify: `apps/api/src/api/routers/vault_sync.py`
- Modify: `apps/api/src/api/models/schema.py` — add `VaultSyncConflictHistory` model, `__tablename__ = "vault_sync_conflict_history"`, columns mirroring 0070 exactly (eng review blocker 3: SQLite tests build schema from ORM metadata, `conftest.py:111,265` — `Base.metadata.create_all`; without the model every resolve/history test dies `no such table`; `test_migration_chain_pg.py:187-207` pins ORM↔table parity, so model and migration must match)
- Create: `apps/api/alembic/versions/0070_vault_sync_conflict_history.py`
- Create/Modify: `apps/api/tests/` vault-sync router test file (discover existing name, likely `test_vault_sync.py`; follow it)

**Frozen contract (FE codes against this; BE realizes it — field names derive from the REAL shapes; go read `VaultClientConflict` `:258-264` and current `report` `:1002-1017` before writing):**
- Conflict source record (in `connector.config["conflicts"]`): `{id, file, conflict_file, local_head, remote_head, detected_at}`. History item shape: `{id, connector_id, conflict_id, file, conflict_file, local_head, remote_head, detected_at, resolved_at, resolution}`.
- `POST /api/v1/vault-sync/conflicts/{conflict_id}/resolve` — the path param is the CLIENT conflict id (`VaultClientConflict.id`, equal to history `conflict_id`); the history row `id` (server row) is NEVER accepted in this path (live route filters the active ledger by client id — `vault_sync.py:1061-1062, 1078`). Server RECORDS, does not apply: copy = "resolution recorded — local client applies on next sync". Insert-once into history, idempotent by `(connector_id, conflict_id)`. **First-wins (DX taste #1 auto-decided):** re-resolve never mutates the recorded row; the resolve response echoes the originally recorded `resolution`.
- `GET /api/v1/vault-sync/conflicts/history?workspace_id=&limit=&offset=` → `{items: HistoryItem[], total}`; `total` = all workspace history rows before pagination; `resolution` ∈ `{"keep-local","accept-incoming"}` (the recorded `ConflictResolveRequest.strategy` value, `:254-255`). Sibling GETs all require `workspace_id` (status `:302`, logs `:480`, conflicts `:1046`).
- `POST /api/v1/vault-sync/report` merge semantics (D10): `cfg["devices"][machine] = {client_version, last_heartbeat, status, last_pull_time, last_push_time, last_error}`; missing `machine` (`machine: str | None = None`, `:285`) stores under key `"unknown"`; top-level `machine`/timestamps keep working as alias of latest reporter (back-compat).
- `GET /api/v1/vault-sync/status` gains `devices: [{machine, client_version, last_heartbeat, status, last_pull_time, last_push_time, last_error}]` derived from the registry, sorted by `last_heartbeat` desc; per-device `status` domain = the same coarse set as top-level (`in_sync|conflict|syncing|error`, cf. `:1021-1028`); all existing fields kept.

**Backend steps:**
- [ ] Migration 0070: `vault_sync_conflict_history` columns per frozen contract (derived from the real `VaultClientConflict` shape + `resolved_at`, `resolution`); `ENABLE` + `FORCE` RLS + workspace-scoped policy following the 0067-0069 pattern (there is NO conflicts table to mirror); indexes on `(connector_id, detected_at)`; **`downgrade()` = exact reverse of `upgrade()`** (drop table, indexes, policies — 0069's downgrade is the pattern; `verify:pg` round-trips `downgrade -2` + re-upgrade, a missing/no-op downgrade reds the script); **ends with the carried-forward coverage re-assertion tail copied from `0069:307`** (exact literal `incomplete RLS coverage`). Verify: `pnpm verify:pg` (requires Docker for the disposable pg16 container `vaeloom-pg-verify` — if Docker is unavailable, record that + the CI run link).
- [ ] `resolve`: idempotent insert-once into history by `(connector_id, conflict_id)`, first-wins (re-resolve with a different strategy never mutates the recorded row; response echoes the recorded `resolution`), then remove from active ledger (same transaction).
- [ ] `report`: merge into `cfg["devices"]` per D10 instead of single-slot overwrite; keep ledger semantics but do not let an idempotent re-report resurrect an already-resolved conflict (dedupe against history by `(connector_id, conflict_id)`).
- [ ] `status`: expose `machine` (kept) + `devices` from the registry. Do NOT add new status polling fields beyond this.
- [ ] History endpoint with pagination + tenant scoping identical to siblings.
- [ ] BE tests: resolve→history roundtrip; re-resolve does not duplicate history (idempotency negative control); resolved conflict does not resurrect on re-report; history tenant isolation (negative control: other tenant sees 0, exact 200/403); status includes devices; two machines report → both retained, latest reporter marked (D10).
- [ ] Run: `uv run --project apps/api python -m pytest apps/api/tests/ -k "vault_sync" -q -o addopts=""` → PASS.

**Frontend steps (VaultSyncPanel.tsx):**
- [ ] Phantom swap per spec §1.1.
- [ ] Remove dead `DiffViewer` import (verify zero usage first with grep).
- [ ] All three SWRs: destructure `error`; error → `ErrorState` + Retry (`mutate`) per D13 (ready(stale) rule applies: keep last-good data on transient revalidation failure); use `statusLoading` for genuine loading skeleton. Adopt D12 shared key/interval (tile in lane A moves to the same literal).
- [ ] New sections treatment (design amendment 6): history + devices get loading skeleton, `ErrorState` + Retry, `total`-driven "Showing X of N"/Load more; Resolve + "Request sync" disabled while in flight.
- [ ] Badge honesty: replace hardcoded "Installed" state with derived status (connected/disconnected/error from real fields).
- [ ] Error state offers "Request sync" → existing `POST /vault-sync/sync`, render honest `executed:false` copy ("request recorded"), then revalidate panel SWRs. (CEO amendment 1 — retry is now owned.)
- [ ] Surface `last_error` text + last-contact age ("last heartbeat 12m ago") from status fields (F8) in panel.
- [ ] New sections: Conflict history (from new endpoint; empty state "No resolved conflicts yet"), Devices list (from `status.devices`, sorted by `last_heartbeat` desc; labels the LAST-REPORTED device by `machine` equality with top-level `machine` — machine names are client-reported, a browser cannot know "current"; render `devices[].last_pull_time`/`last_push_time` per frozen contract).
- [ ] Download-client: REMOVE the affordance per D8 (evidence-backed — no installable artefact exists). Endpoint stays; `downloadClientUrl` stays as known-dead helper.
- [ ] Honesty test updates: badge reflects API status (negative control: status fetch reject → no "Installed"); fabricated path/claims gone; resolve copy says "recorded", not "applied".
- [ ] `memory/vault/page.tsx` static claims (lines ~35-40, 505, 788): replace with derived/neutral truth; phantom swap.
- [ ] Run: `pnpm --filter @vaeloom/web test -- VaultSyncPanel` → PASS.

### Task C: Corrections + memory detail

**Files:**
- Modify: `apps/web/src/components/memory/MemoryCorrectionPanel.tsx`
- Modify: `apps/web/src/app/workspace/[workspaceId]/memory/[memoryId]/page.tsx`
- Modify: `apps/web/src/app/workspace/[workspaceId]/memory/corrections/page.tsx`

**Steps:**
- [ ] Phantom swap per spec §1.1.
- [ ] `MemoryCorrectionPanel`: request `include_superseded=true` (BE supports it — `schemas/memory.py:142-147` defaults exist, `test_memory_filters.py` covers it); superseded filter now returns rows; "Re-Correct" reachable.
- [ ] `supersedesId` row (~`:229-232`): read the camelCased field (`supersedesId` after `transformKeys`) — add explicit fallback for both casings; render "Supersedes: <link>" with workspace-prefixed href.
- [ ] Default correction reason: sensible non-empty default in the reason select/input.
- [ ] Detail page (`:283`): remove `prose-invert` — `@tailwindcss/typography` is NOT installed (`tailwind.config.ts:392`); use the installed `.markdown-body` (`globals.css:529-567`), which follows all 3 themes. (Design amendment 3.)
- [ ] Detail page fallback links (`:350-354, 392-396`): `/memory/<id>` → `../memory/<id>` relative or workspace-prefixed absolute.
- [ ] Detail page lineage SWR: error state + retry; supersede action confirmation.
- [ ] Tests: new unit test file `apps/web/src/components/memory/__tests__/MemoryCorrectionPanel.test.tsx` — superseded rows render, Re-Correct enabled, supersedes link href includes workspaceId.
- [ ] Run: `pnpm --filter @vaeloom/web test -- MemoryCorrectionPanel` → PASS.

### Task D: Graph + scale

**Files:**
- Modify: `apps/web/src/components/memory/GraphViewer.tsx`
- Modify: `apps/web/src/app/workspace/[workspaceId]/memory/graph/page.tsx`
- Modify: `apps/web/src/components/memory/ScaleMemoryViewer.tsx`
- Modify: `apps/web/src/app/workspace/[workspaceId]/memory/scale/page.tsx`

**Steps:**
- [ ] Phantom swap per spec §1.1 (incl. `text-white` misuse and `#818cf8` fallbacks).
- [ ] Graph fetch: pass explicit params (workspace filter + intended page size); read `total` from response; badge prints `Showing X of N` when page < total, plain counts otherwise; add Refresh button.
- [ ] Palette per spec §2 (keyed to the real 8-type union): replace 9 node hexes (`GraphViewer.tsx:12-21`) and 6 legend hexes (`graph/page.tsx:59-79`) with the family table; colliding HC pairs (entity/concept, document/event) get shape/dash second channels; edges use `border`/`border-subtle` only; selection = ring + scale, never a color swap; legend renders from the SAME const map as nodes; SVG attrs use `rgb(var(--x))`/class.
- [ ] Remove "Semantic Graph Engine v2" versioned badge (~`graph/page.tsx:33-35`) — non-versioned honest copy (§3). (Design amendment 7.)
- [ ] `ScaleMemoryViewer`: wire via EXISTING `api-client` helpers (lane B owns `api-client.ts` — add nothing there); remove `text-white`; phantom swap.
- [ ] `scale/page.tsx`: "Wavelength Levels 0—3" badge → reflect the real 6-tier model (or remove badge).
- [ ] Tests: new `GraphViewer` test — truncation renders `Showing 20 of 21` when total=21; legend covers all 8 rendered types; const-map unit test asserts per-theme pairwise-distinct `(fill, stroke-dash, shape)` across the 8 types (design amendment 1); no hex literals in rendered classNames.
- [ ] Run: `pnpm --filter @vaeloom/web test -- GraphViewer ScaleMemoryViewer` → PASS.

### Task E: Integration seam + backend gaps

**Files:**
- Modify: `apps/web/src/components/chat/ChatMemoryDrawer.tsx` (+ nearest test file)
- Modify: `apps/api/src/api/orchestrator/loop.py` (~line 1001)
- Modify: `apps/api/src/api/tools/executor.py` (`sync_vault` handler `:965-1051` — DX-verified real path; `agents/memory/` has NO `tools/` package)
- Modify: `apps/api/src/api/tools/definitions.py` (`:198-219` definition, `:200` description, `:208-216` output_schema)
- Modify: `apps/api/src/api/agents/memory_agent/handler.py` (`:37` — live description claim via `orchestrator/agent_discovery.py:23`)
- Triage: `apps/api/src/api/orchestrator/proposals_engine.py:111-127` (binds `sync_vault {force:true}` to "Resolve Vault Conflicts" copy)
- Modify: `apps/api/tests/test_agent_memory_vault_tools.py`
- Create: `apps/api/tests/test_memory_endpoint_coverage.py` (feed/history/chunks) — or extend nearest memory test file if one exists; follow repo layout.

**Steps:**
- [ ] Verify no other FE consumer of `/workspaces/{id}/memories` expects an envelope (rg); then fix drawer: `Array.isArray(data) ? data : (data?.memories ?? data?.items ?? [])`, keep typed.
- [ ] Drawer test: mock bare-array response → drawer renders items (fail-before against current code).
- [ ] `loop.py:1001`: replace `P2_RETRIEVAL` with the correct `CognitivePriority` member for retrieval-grounding writeback — read the enum + surrounding context; most likely `P3_DYNAMIC_MEMORY` (verify against how the value is consumed; add no comment unless the choice is non-obvious).
- [ ] `sync_vault` tool honesty (D4, widened by DX amendments 1-2): in `apps/api/src/api/tools/executor.py` remove ALL fabricated writes — update-path `:1015-1017`; creation seed `:990-996` (drop `in_sync` AND the invented `~/Documents/VaeloomVault` path — banned by spec §3 and already removed from the router, `vault_sync.py:202-213`); `:1009` `files_updated = files_synced if force`; sync_logs claim `:1019-1024` (reword to "sync request recorded; files found: N"); result `:1033` `status: "completed"`. Pin the honest result shape mirroring the router's `executed:false` contract (`vault_sync.py:463-475`). Update `definitions.py:200` description + `:208-216` output_schema + `memory_agent/handler.py:37` in the same change (the definition text is what the model reads). Rewrite `test_agent_memory_vault_tools.py:326-337` to assert absence of `last_pull_time`/`last_push_time`/`in_sync`/`vault_path` writes AND pin the `conn.status == "CONNECTED"` assertion (`:336`) deliberately. Keep the tool NAME (DX taste #2 auto-decided: zero ripple through `card_registry.py:277`/`capability_registry.py:194`). Record fail-before run in the commit message.
- [ ] Triage `proposals_engine.py:111-127`: retitle the copy and/or re-bind the proposal away from `sync_vault {force:true}` ("Resolve Vault Conflicts" is now false); if deferred, say so explicitly in the PR description — no silent lie left in a live proposal.
- [ ] BE tests for untested endpoints: `GET /memories/feed` (envelope shape + pagination), `GET /memories/{id}/history`, `GET /memories/{id}/chunks` — happy path + tenant isolation negative control (404/0 rows across tenants, exact codes).
- [ ] Run: `uv run --project apps/api python -m pytest apps/api/tests/test_agent_memory_vault_tools.py apps/api/tests/test_memory_endpoint_coverage.py -q -o addopts=""` → PASS; `pnpm --filter @vaeloom/web test -- ChatMemoryDrawer` → PASS.

---

## Wave 2 — Integration verification

### Task V1: Green-all pass (single verifier agent)

- [ ] `python scripts/gen_tokens.py --check` → PASS (proves no source mutation of tokens).
- [ ] `python scripts/gen_memory_type_union.py --check` → PASS.
- [ ] `pnpm --filter @vaeloom/web test -- design-tokens.guardrail` → PASS (was red in F1).
- [ ] `pnpm --filter @vaeloom/web test` (memory-related suites at minimum) → PASS.
- [ ] `cd apps/web && npx tsc --noEmit` → clean.
- [ ] `pnpm lint` → clean (or scoped ESLint if root lint is slow; record scope).
- [ ] Scoped pytest: vault_sync, memory, agent memory tool files + `apps/api/tests/test_memory_endpoint_coverage.py` by path (eng review risk 3: `-k` under-selects it) with `-o addopts=""` → PASS with exact counts recorded.
- [ ] `pnpm verify:pg` → PASS (eng review blocker 4: migration proof must run here, not first in CI; requires Docker — if unavailable record that + the CI run link in the Wave-2 report).
- [ ] D12 convergence grep (eng review risk 2): the exact literal `['vault-sync-status', workspaceId]` + `refreshInterval: 15000` appears in BOTH `memory/page.tsx` and `VaultSyncPanel.tsx` — no string-key remnant, no 5000ms remnant.
- [ ] Manual error drill: stop API; walk memory list/detail/corrections/graph/scale/vault + sync panel → every surface shows error+retry (screenshot evidence). (Design amendment 9: corrections route was missing.)
- [ ] Theme walk: light/dark/high-contrast × 6 memory routes incl. `/memory/corrections` → no invisible borders/fills; graph node identity legible in HC (screenshot evidence).

## Wave 3 — Real-world use cases (verification agent + browser)

Each scenario runs against live `pnpm dev:be` + `pnpm dev:web` with a seeded workspace:

**Seeding recipe (required for scenarios 6-8; exact commands recorded in the report; DX amendment 7):** TWO sequential authenticated `POST /api/v1/vault-sync/report` calls — one per machine name (`machine` is a scalar, `vault_sync.py:285`) — each with `sync_state`, `logs[]`; put the 2+ real `VaultClientConflict` entries (`id/file/conflict_file/local_head/remote_head/detected_at`) in the FINAL report because each report REPLACES the ledger (`:1016-1018`). Walk: devices registry shows BOTH machines (proves merge retention); conflicts/resolve/history operates on the final ledger. For scenario 8, seed >100 memories via looped `POST /memories`.

1. **Create & find:** create memory of a valid type → appears in list + feed; attempt invalid type via API → UI shows human error (422 mapped), no crash.
2. **Search deep-link:** from CommandCenter, `/memory?query=<term>` opens with box populated and results filtered (fresh AND already-mounted navigation); >100-memory workspace: a term matching only an unloaded memory still returns it (server search, no false-empty).
3. **Corrections loop:** supersede a memory → corrections UI: superseded filter shows it, "Supersedes" link renders, re-correct works; the superseded memory no longer appears in memory search results (vector purge).
4. **Graph honesty:** workspace with >20 graph nodes → badge shows `Showing 20 of N`; refresh works; node click lands on workspace-prefixed detail.
5. **Scale:** all 6 tiers visible incl. Sub-Daily; no `text-white` on light theme.
6. **Sync truth:** panel error state on API kill; "Request sync" records honestly (`executed:false` copy); resolve a conflict → appears under history with timestamp, re-resolve does not duplicate; devices list shows BOTH seeded machines, marked as last-reported (never "current"); `last_error` + last-contact age visible; no "Installed" without a real status.
7. **Chat ↔ Memory:** chat memory drawer lists memories (was always empty); an agent run that writes memory → new item appears in memory feed afterwards; `sync_vault` tool run → honest result, no fake timestamps in connector config.
8. **Pagination:** seed >100 memories → list Load More reaches all.

**Required e2e additions (not optional — CEO cherry-pick 2):** (a) chat drawer renders memories from the bare-array response; (b) vault panel shows error + retry with the API down. Mocked unit tests cannot catch the CSP/casing silent-failure classes AGENTS.md documents.

Evidence: screenshots + exact command output captured under each scenario; report appended to this plan's verification section.

---

## Parallel Execution Map

| Wave | Lane | Agent | Owned files (single writer) |
|---|---|---|---|
| 0 | F1 | 1 agent | `apps/web/src/__tests__/design-tokens.guardrail.test.tsx` |
| 1 | A | agent A | `memory/page.tsx`, `memory/not-found.tsx`, memoryPage honesty test |
| 1 | B | agent B | `VaultSyncPanel.tsx` (+test), `memory/vault/page.tsx`, `api-client.ts`, `vault_sync.py`, `models/schema.py` (history model), `0070_*`, vault-sync BE tests |
| 1 | C | agent C | `MemoryCorrectionPanel.tsx` (+new test), `[memoryId]/page.tsx`, `corrections/page.tsx` |
| 1 | D | agent D | `GraphViewer.tsx`, `graph/page.tsx`, `ScaleMemoryViewer.tsx`, `scale/page.tsx`, their new tests |
| 1 | E | agent E | `ChatMemoryDrawer.tsx` (+test), `loop.py`, `api/tools/executor.py`, `api/tools/definitions.py`, `memory_agent/handler.py`, `proposals_engine.py` (triage), agent tool tests, new memory endpoint tests |
| 2 | V1 | 1 verifier | none (read-only + report) |
| 3 | R1 | 1 verifier | required e2e additions: chat-drawer bare-array; vault error+retry (CEO cherry-pick 2) |

File sets are disjoint; `memory/page.tsx` ↔ `VaultSyncPanel` share ONLY the frozen SWR literal `['vault-sync-status', workspaceId]` + fetcher + `refreshInterval: 15000` (D12, convergence checked in V1). `api-client.ts` is lane-B-only; lane D reuses existing helpers. No two lanes edit the same file.

## Verification Commands (Windows)

```powershell
pnpm --filter @vaeloom/web test -- design-tokens.guardrail
pnpm --filter @vaeloom/web test -- memoryPage.honesty VaultSyncPanel MemoryCorrectionPanel GraphViewer
cd apps/web; npx tsc --noEmit; cd ../..
pnpm lint
python scripts/gen_tokens.py --check
python scripts/gen_memory_type_union.py --check
uv run --project apps/api python -m pytest apps/api/tests/ -k "vault_sync or agent_memory" -q -o addopts=""
uv run --project apps/api python -m pytest apps/api/tests/test_memory_endpoint_coverage.py -q -o addopts=""
pnpm verify:pg
```

### Task D step reference (amended)

D "wire to api-client" means REUSE existing `api-client.ts` helpers only (lane B owns that file; no new shared-file edits from lane D).

## Out of Scope (deliberate)

- `packages/agent-memory` modularization (separate plan).
- ui-kit token JSON pipeline rewire / `generateCssVariables()` adoption app-wide.
- Adopting unused `MemoryEntity`/`MemoryRelationship`/`MemoryEvidence` components.
- Publishing `@vaeloom/vault-sync` to npm (copy stays honest instead).
- Any phantom-var work outside the memory area (none found — scope is exactly 11 files).
- Enterprise auth (SAML/RBAC), unrelated subsystems.

## GSTACK REVIEW REPORT

Pipeline: `/autoplan` in degraded mode (win32/PowerShell, no Skill tool). Single outside voice per phase (Claude subagent); Codex CLI unavailable → no cross-model check. Phases run sequentially; user is interrupted once, at the final gate.

### Phase 1 — CEO review (Claude voice) — **AMEND** (2026-10-18)

Verdict: plan shape + honesty spine right; three structural lies would have shipped verbatim. All amendments applied to this plan:

| # | Finding | Resolution |
|---|---|---|
| C1 | Devices list structurally can't be honest (single-slot overwrite `:1002-1014`; one connector/workspace) | **D10** per-machine registry merge; FE labels "last reported"; test "two machines → both retained" |
| C2 | Pagination + client-side search = new false-empty after Load more | **D11** wire `POST /memories/search` (debounce + stale-guard); search stays client-side only for zero-query mode |
| C3 | Migration 0070 specified against a conflicts table that doesn't exist; history field names didn't match real record | Frozen contract rewritten from real `VaultClientConflict` shape; idempotent insert-once by `(connector_id, conflict_id)`; resolve copy = "recorded", not "applied"; RLS per 0067-0069 pattern, not "mirror" |
| A1 | Retry promised in Goal/End State but unowned | Task B: "Request sync" → `POST /vault-sync/sync`, honest `executed:false` copy |
| A5 | Guardrail would miss the biggest hex sites (const maps, `fill=`/`stroke=` attrs) and trip on honesty-test fixtures | F1 hardened: exclude tests; ban hex in ALL string literals |
| A6 | Tile and panel used different SWR keys + intervals (double poll) | **D12** one literal `['vault-sync-status', workspaceId]`, one interval 15s |
| A7 | Hand-rolled error cards risk across lanes | **D13** mandate ui-kit `ErrorState`/`EmptyState` (verify export exists first) |
| A8 | Wave 3 scenarios 6-7 unexecutable on a fresh workspace | Scripted `POST /vault-sync/report` seeding recipe with exact commands |
| A9 | Removing `task` option could orphan existing rows | Query first; legacy path/notice if rows exist |
| — | Feed truncation silent (cap 50, BE returns `total`) | Task A: same honesty pattern as D6 |
| — | `last_error` + heartbeat age never surfaced despite being in the status response | Task A tile + Task B panel bullets (F8) |
| — | R1 e2e "if needed" | Required: chat-drawer bare-array + vault error+retry specs |

**Taste decisions queued for the gate (auto-decided, user can reverse):**
1. **Devices = multi-machine registry** (D10) — build it, vs. descope to a single honest "client" card. *Auto: build* (small diff vs overwrite; panel already tells users to install per machine).
2. **Search = server-side wiring** (D11) — vs. label "searches loaded memories". *Auto: wire it* (it is the user's end-to-end-dynamic ask; one bounded task in an owned file).
3. **Design-system artifact** — spec file doubles as the area's design system; no duplicate `docs/design/` document. *Auto: single spec* (avoid two sources of truth).

### Phase 2 — Design review (Claude voice) — **AMEND** (2026-10-18)

Verdict: mapping + lanes sound; §2 mapped a taxonomy the graph doesn't have; HC theme collapses two identity pairs; three §4/§5 instructions unbuildable or dishonest. All 9 amendments applied (spec §1.1, §2, §4, §5, §7; plan Tasks A-D, F1, V1):

- **§2 rewritten** to the real 8-type union (`GraphViewer.tsx:10-22`); colliding HC pairs (accent≡ai-proposed, info≡ai-processing — `globals.css:317/342, 337/345`) get shape/dash second channels; neutral-node ≈ edge-stroke collision fixed (`border`/`border-subtle` edges); legend + nodes from one const map; pairwise-distinctness test.
- **§1.1 rule 5:** token fill ⇒ `-fg` partner (`bg-accent text-accent-fg`); `text-white` on fills banned (HC white-on-yellow ≈1.07:1). All `-fg` tokens verified in 3 themes.
- **§4:** `ready(stale)` state (no blanking on transient revalidation failure); search contract pinned — bare list, no `total`, `top_k=10/0.7` defaults → pin `top_k`, "No strong matches", "top N matches", imperative-fetch `ErrorState`, `aria-busy`; vault new sections get full state treatment.
- **§5:** `.markdown-body` replaces the unbuildable `prose-invert` (plugin not installed — `tailwind.config.ts:392`); raised rungs require shadow; `surface-50` dropped from well guidance.
- **F1:** add numeric `rgb(`/`rgba(` ban.
- **Task D:** remove "Semantic Graph Engine v2" versioned badge; selection = ring + scale (accent = entity fill).
- **V1:** add `/memory/corrections` to error drill + theme walk.

**Taste decisions queued for the gate (auto-decided):**
1. **Amber on humans/orgs:** *none* — `warning` reserved for UI state; person/organization/project use neutral rungs + shapes.
2. **Accent channel:** entity fill + ring/scale selection (not reserving accent for selection).
3. (from Phase 1) devices registry, server-side search, single design doc — unchanged.

### Phase 3 — DX review (Claude voice) — **AMEND** (2026-10-18)

Verdict: honesty spine right; Task E as scoped would still have shipped a fabricating tool (wrong executor path in the plan + 4 untouched lie sites + 2 live descriptions), the frozen contract left 4 fields unpinned for the parallel lanes, and D8's evidence already existed in-repo. All 7 amendments applied (plan D4, D8, Task B contract + steps, Task E files/steps, execution map, Wave 3 recipe):

- **Real executor path:** `apps/api/src/api/tools/executor.py:965-1051` (`agents/memory/` has NO `tools/` package — plan's dup-handler step deleted). Removal list widened: creation seed `:990-996` (incl. invented vault path), `:1009`, log claim `:1019-1024`, result status `:1033`. Descriptions fixed where the model reads them (`definitions.py:200` + output_schema `:208-216`, `memory_agent/handler.py:37`). `proposals_engine.py:111-127` triaged (its "Resolve Vault Conflicts" copy is false post-fix).
- **Contract pinned:** resolve path param = client `conflict_id` (history row `id` NEVER accepted — the exact collision that would keep a seeded idempotency test green while broken); history needs `workspace_id` query (all siblings do) + `total` semantics + `resolution` ∈ `{keep-local, accept-incoming}`; devices `status` domain pinned, null machine → `"unknown"`, sorted `last_heartbeat` desc, FE marks latest by top-level `machine` equality.
- **D8 resolved from evidence:** remove the affordance — package `private: true`, `dist/` gitignored, endpoint serves an install command for an unpublished package, `downloadClientUrl` uncalled + auth-gated. Endpoint + dead helper stay.
- **Wave 3 recipe:** two sequential report calls (ledger is replaced per report — devices walk proves registry retention).

**Taste decisions queued for the gate (auto-decided):**
1. **Re-resolve policy:** first-wins (recorded resolution immutable; response echoes it) — keeps idempotency and UI/API agreement trivially provable.
2. **`sync_vault` name:** kept with request-recorder semantics (cross-cutting rename through card/capability registries is unbudgeted; judge whether the tool still earns its place).

### Phase 4 — Eng review (Claude voice) — **AMEND → LOCKED** (2026-10-18)

Verdict: lane map + frozen contracts sound; four execution-mechanics gaps would have burned the lane agents mid-run. All 4 blockers + 3 risk mitigations applied; plan locked for execution:

| # | Blocker | Resolution |
|---|---|---|
| E1 | 0070 `downgrade()` unspecified — `verify:pg` round-trips `downgrade -2` + re-upgrade (`verify_pg_migrations.py:963-992, 1009-1024`) | Task B 0070 step: `downgrade()` = exact reverse of `upgrade()` (0069 pattern) |
| E2 | Coverage-guard tail misattributed to 0066 — the head must carry it (`test_migration_chain_pg.py:259` literal; 0069's carried tail `:307/:217`) | Plan heading + Task B now: 0070 ends with the copied `_assert_coverage` tail, exact literal `incomplete RLS coverage` |
| E3 | Lane B missing `models/schema.py` — SQLite tests build from ORM metadata (`conftest.py:111,265`), all resolve/history tests would die `no such table` | Added file + `VaultSyncConflictHistory` model; ORM↔table parity pinned by `test_migration_chain_pg.py:187-207` |
| E4 | Migration proof had no guaranteed runner (V1 lacked `verify:pg`; Docker required) | V1: `pnpm verify:pg` → PASS (or Docker-unavailable record + CI link); Docker requirement noted in Task B |

Risk mitigations: `api-client.ts` pre-assigned to lane B (D reuses existing helpers only — map + Task D updated); D12 convergence grep added to V1 (exact literal + interval in both files, no string-key / 5000ms remnant); `test_memory_endpoint_coverage.py` added by path to the V1 scoped pytest + consolidated command — MUST run as TWO invocations (`-k` filters every collected arg, so a trailing path arg is still deselected; the single-command form above was corrected during V1 execution).

**Taste decision queued for the gate (auto-decided):**
1. **Docker-off fallback:** if Docker is unavailable at execution time, Wave 2 proceeds with the CI migration-chain run link as the proof (vs. blocking sign-off until a local `pnpm verify:pg` is possible). *Auto: proceed + record* (CI runs the same script per `ci-backend.yml`; local absence is an environment fact, not a quality signal).

### Final Gate — APPROVED (2026-10-18)

User verdict on the queued taste decisions: **"proceed"** — all auto-decisions locked, none reversed:

| # | Decision | Locked choice |
|---|---|---|
| 1 | Devices storage | Multi-machine `devices{}` registry merge (D10), "last reported" labeling |
| 2 | Search | Server-side `POST /memories/search` wiring, debounce + stale-guard (D11) |
| 3 | Design artifact | Spec doubles as the design system; no duplicate doc |
| 4 | Amber on humans/orgs | None — `warning` reserved for UI state |
| 5 | Accent channel | Entity fill + ring/scale selection |
| 6 | Re-resolve policy | First-wins (recorded resolution immutable; echo on re-resolve) |
| 7 | Docker-off fallback | Proceed + record — moot: Docker was up in Wave 2, `verify:pg` ran locally and PASSED |

All four phases complete: **AMEND ×4, zero REJECTs.** Execution: Wave 0 (F1 red) → Wave 1 (lanes A-E) → Wave 2 (V1) → Wave 3 (R1, 8 scenarios). Results appended below.

---

## Execution Log

### Wave 0 — F1 guardrail (fail-before)
- Created `apps/web/src/__tests__/design-tokens.guardrail.test.tsx` (phantom-var ban w/ focus-ring allowlist; hex-in-string-literals ban; numeric `rgb()/rgba()` ban; guard-the-guard `files > 15`).
- **RED run: 473 phantom `var(--color-*)` offenders + 66 raw-hex offenders** across the memory area (2 of 4 assertions failed); full output captured in session tool log.

### Wave 1 — lanes A-E (parallel, disjoint file sets; all 5 reported complete)
Fail-before/pass-after evidence per lane (exact commands in lane reports, session log):
- **A** memory page: server search (debounce + stale-guard), windowed pagination "Showing X of N", truncation caption, deep-link, vault tile real status; `memoryPage.honesty` 15/15 (8 new); tsc clean. Deviations: page/page_size pagination (wrapper types), legacy `task` chip with probe.
- **B** vault sync: devices registry (sorted last_heartbeat desc, "last reported"), `GET /conflicts/history` + panel section, record-only first-wins resolve, D8 affordance removed, D12 literal; `test_vault_sync.py` 27/27 (fail-before: 8 failed), FE 14/14; migration `0070_vault_sync_conflict_history.py` (reverse downgrade + carried `_assert_coverage` tail) + ORM model.
- **C** corrections/detail: token purge, `include_superseded` + own SWR key, supersedes workspace link, `markdown-body`, confirm dialog on supersede; 4/4 negative-control tests; tsc clean.
- **D** graph/scale: token palette + shape/dash second channels (8 types pairwise-distinct, proven per theme), honest badges/legend, real tiers, rollup windows 7/30d; 29 tests; tsc clean.
- **E** integration/BE: drawer bare-array fixed + regression test; `loop.py` `"P2_RETRIEVAL"` → `"P3_DYNAMIC_MEMORY"`; `sync_vault` fabrication removed (executor, definitions, handler, proposal triage); `test_memory_endpoint_coverage.py` added; scoped pytest 24/24; FE 30/30 (fail-before captured).

### Wave 2 — V1 green-all (verified 2026-10-18)

| Check | Command | Result |
|---|---|---|
| Token artifact | `python scripts/gen_tokens.py --check` | OK (3 themes × 57 values) |
| Type-union artifact | `python scripts/gen_memory_type_union.py --check` | OK (24 members) |
| F1 guardrail | `npx jest src/__tests__/design-tokens.guardrail.test.tsx --ci` | **4/4 PASS** (was RED in Wave 0) |
| Memory suites | `npx jest memoryPage.honesty VaultSyncPanel MemoryCorrectionPanel GraphViewer ScaleMemoryViewer graph-palette chat-components-enterprise --ci` | **84/84 PASS (7 suites)** |
| Web typecheck | `npx tsc --noEmit` (apps/web) | clean |
| Scoped pytest | two invocations: `-k "vault_sync or agent_memory"` + endpoint file by path | **65 passed + 8 passed** (5193 deselected, serial) |
| Head pin | `test_dr_scopes.py` after pin bump | 8/8 PASS |
| Migration proof | `pnpm verify:pg` | **VERIFICATION PASSED** — steps 0-8: upgrade head, live pg suite, rollback probe, downgrade-must-fail + failure shape, downgrade, re-upgrade, invariant re-assert (Docker started locally; no fallback needed) |
| D12 convergence | rg exact literal + interval | `['vault-sync-status', workspaceId]` at `VaultSyncPanel.tsx:83` + `memory/page.tsx:213`; `refreshInterval: 15000` both — no 5000ms remnant |
| Lint (scope recorded) | root `pnpm lint` (nx) killed at 900s — same nx-runner family as the documented `pnpm dev` hang; scoped: `next lint --file` (each lane) + `pnpm --filter @vaeloom/web lint` + `ruff` | Overhaul files clean. Web-wide lint exits 1 on ONE pre-existing error in an unowned dirty file: `ConnectorDetailDrawer.tsx:283` `react/jsx-no-comment-textnodes` — `//` comment lines are literal JSX children (render as visible text); introduced by pre-existing uncommitted WIP, HEAD clean at that line — flagged, not silently fixed. Backend: ruff clean on 7/8 changed files; `dr_drill_runner.py` shows pre-existing HEAD debt only (`git diff` = 1 line). |
| Error drill + theme walk | live browser | executed with Wave 3 (same live session; screenshot evidence there) |

Fixes made during V1 (all justified, recorded): `EXPECTED_ALEMBIC_HEAD` `"0057"` → `"0070"` (`apps/api/scripts/dr_drill_runner.py:37` — stale pin, now green); AGENTS.md migration-head row → `0070_vault_sync_conflict_history.py`; `memoryApi.list` type gained `include_superseded?: boolean` (lane C's documented workaround is now typed).

### Wave 3 — R1: 8 scenarios, live servers (verified 2026-10-18)

**Seeding:** 117 memories (111 active + 2 superseded + 4 soft-deleted probe rows kept as evidence), supersession chain `5e797634…` → `4bc82b0d…` → `191a5d53…` (head active), 111 KG nodes / 14 edges, weekly SCALE rollup node `702aeca3…`, vault rig parked in genuine `error` state ("Merge halted: manual conflict resolution required (2 files)", 1 conflict). The API was killed/restarted mid-drill; the e2e launcher reseeded `e2e.db` (new workspace `dbd65a22…`; pre-reseed workspace `1700e604…` no longer in DB). All evidence persists as screenshots under `.playwright-mcp/` plus session logs.

**Scenarios (screenshots `wave3-s1…s8-*`):**

| # | Surface | Outcome |
|---|---|---|
| 1 | Chat drawer, real corpus | PASS — bare-array fetch renders, "quokkaz" search positive/negative, static seed title absent |
| 2 | Drawer timestamps | **F-timestamp-skew** — API returns naive `DateTime`; rendered time offset vs stored |
| 3 | Corrections + lineage | **F-lineage** — forwards edges fetched but never rendered; superseded root mislabeled "Current Version" (`memory/[memoryId]/page.tsx:376`) |
| 4 | Graph workbench | PASS — 109/111 nodes rendered, 8 type shapes pairwise-distinct per theme |
| 5 | Dark theme | PASS — token sanity, zero `text-white` in memory area |
| 6 | Vault panel, live rig | PASS — real status, honest "last reported", history section (`wave3-s6-vault-panel.png`) |
| 7 | Chat vault tab + honesty probes | **F-vault-tab-static** (hard-coded seeds + false "connected" banner), **F-slice-stats** (KPI superseded/agent counts a page slice, not corpus: `routers/memory.py:246-249`), `sync_vault` honest, `ConnectorDetailDrawer` clean |
| 8 | Pagination | PASS — "Showing X of N", All (111) (`wave3-s8-pagination-all-111.png`) |

**Required e2e specs (new):** `apps/web/e2e/memory-honesty.spec.ts` — (1) drawer renders route-fulfilled bare-array payload (dialog-scoped, nonce marker, filter +/−), (2) vault panel honest error + retry (status 500 + sync 503; alert title present; no invented "Sync Engine" block; retry re-fires status). Run: `E2E_WEB_MODE=dev npx playwright test e2e/memory-honesty.spec.ts --project=chromium` → **2 passed (9.0s / 11.4s)**, eslint-clean.

**Theme walk:** 18/18 captures = {light, dark, high-contrast} × {memory notes, corrections, vault, scale, graph, detail} into `.playwright-mcp/wave3-theme-*.png` (131-178 KB each; lazy routes re-captured behind readiness gates after a first pass caught mid-load states). Visually verified: HC graph (109/111 nodes, shape+color identity, labels legible), HC notes, light detail (lineage badge visible).

**V1 error drill** (per-surface outage via 503 on `**/api/v1/workspaces/{ws}/**`, `**/api/v1/memories/**`, `**/api/v1/cognition/**`, `**/api/v1/knowledge-graph/**`, `**/api/v1/vault-sync/**`; auth + workspace list kept alive):

| Surface | Outage behavior | Verdict |
|---|---|---|
| `/memory` notes | vault tile honest alert + "Try Again"; KPI cards render **invented zeros** | **F-memory-zeros-on-outage** |
| `/memory` Corrections tab | honest alert + "Refresh Memories" | PASS |
| `/memory/corrections` route | first-drill capture showed "No memories found" + All (0)/Active (0)/Superseded (0); **retracted** — see corrections below | **RETRACTED** (not a defect) |
| `/memory/vault` | designed `ErrorState` + "Request sync" | PASS |
| `/memory/scale` | "Failed to load SCALE memory nodes … Try Again" | PASS |
| `/memory/graph` | "Failed to load graph … Try Again" (one retry pair, then stable) | PASS |
| `/memory/{id}` | "Failed to load memory … Try Again" | PASS |
| Chat drawer | "No memories found" — failure masquerades as empty | minor (F-silent-swallow family) |
| Chat vault tab | green "Obsidian Vault Connected · 5 Grounded Notes" + seed cards while all memory APIs 503 | **F-vault-tab-static** (starkest evidence) |

**Full-API-down (port 8000 killed):** **F-api-down-reload-loop** — infinite `/workspace` ⇄ `/login` full-page reload (~3.5 s cycles; `/auth/me` 500 → stub auto-logout after 1.5 s → `location.replace('/login')`; `middleware.ts` bounces login→workspace on cookie presence alone). No error surface, no retry; self-heals when the API returns. Evidence: console log `console-2026-10-18T15-48-41-783Z.log` (5+ cycles); screenshot impossible — page never settles. Recommendation: keep error+retry UI on 5xx/network; auto-logout only on 401.

**Amendments & corrections:**
- **Amendment 9 (route enumeration):** `/memory/corrections` has a dedicated route (`workspace/[workspaceId]/memory/corrections/page.tsx`, h1 "Memory Corrections & Supersessions") that was missing from the original design route list. Drill traversed it.
- First-drill "graph stuck on Loading workspace…" was a capture artifact (quiescence gate used ASCII `'...'` vs page's Unicode `'…'`, plus an expired browser session in the re-probe) — **retracted**; re-probed clean: honest error state within ~9 s.
- **F-corrections-silent-empty retracted (2026-10-19):** the `/memory/corrections` empty-state capture was a drill-interception artifact. The drill's `**/api/v1/memories/**` glob cannot match the panel's `GET /api/v1/memories?workspace_id=…` request (a `/` is required after `memories`; the URL has `?`), so the panel's only fetch was never 503'd in that capture — and a rejection cannot render that empty state, because the panel's error branch (`MemoryCorrectionPanel.tsx:228`, present since `d648c5ea` 2026-10-05, unchanged through the capture) renders `ErrorState` whenever `loadError` is set. The capture is explained by the post-reseed window: the API was back up and the freshly reseeded workspace was still empty, so the request resolved to a genuine zero-row list and the empty state was the honest rendering. The same branch produced the tab's observed "honest alert + Refresh Memories" during the real kill window (plan row above), and a new negative-control test (`MemoryCorrectionPanel.test.tsx`: rejected list → `role="alert"`, `No memories found` absent) re-proves it on current HEAD. No code change; the final verification pass re-drills this surface with a pattern that matches the bare `/memories` request.
- **F-supersede-fork closed as by-design (2026-10-19):** a second supersede of an already-superseded row returns 201 and forks the chain (the root gains a second child while the first still reads current). During Phase-2 review an "only the current version can be superseded" 409 guard was implemented (service exception + router mapping) and proven fail-before/pass-after — then **deliberately reverted before commit** per user decision: re-correcting superseded rows is a legitimate correction flow (End State: "Corrections can see and re-correct superseded memories"), so branches are accepted, not corruption. Consequences: multi-head chains can exist; "which version is current" disambiguation — including the soft-deleted-row resurrection edge (supersede of a `deleted` row still recreates an active successor) — is deferred UX work, not a defect. The lineage forward walk already tolerates multi-child chains (frontier BFS, `routers/memory.py` forward-children walk).
- **F-slice-stats fixed (2026-10-19):** `aeb3b6b7` — `list_memories` and the new `count_memory_stats` share `_memory_conditions` (`services/memory_service.py`); `/feed` stats are COUNTs over the full corpus (same tenant/workspace/RLS scoping), not sums over the page slice. Fail-before: with page_size=2 the slice sums read 0/0 while the corpus held 1 superseded + 1 agent-sourced memory. Endpoint-coverage suite 9/9; filters/versioning/workspace-isolation 34/34; service/enterprise 35/35; ruff clean.
- **F-lineage fixed (2026-10-19):** `14295a62` — the detail strip and the corrections modal share `buildLineageTimeline`/`lineageLabel` (`apps/web/src/components/memory/lineageTimeline.ts`): chronological order (oldest ancestor → viewed version → successors), "Current Version" derives from each record's own `status`, the viewed record reads "This Version", `chainForwards` successors now render instead of being fetched and dropped, and both strips carry `data-testid="lineage-chain"`. Fail-before: the new detail suite could not find the successor card at all, and the modal test found "Current Active" where "Current Version" belongs. Jest 20/20 (2 detail + 18 honesty), tsc + eslint clean.
- **F-export-tags-null (new finding, fixed 2026-10-19):** `a1df2bb6` — `GET /memories/export` answered 500 whenever any exported row had `tags is NULL`, because `MemoryExportItem.tags` was a non-optional list while the column is NULL on every tagless create (the service forwards `tags=None` explicitly, which suppresses the column default, and `from_attributes` then hands the schema `None`). The route was previously untested; discovered by the new export coverage test. Fix: before-validator coerces NULL to `[]`. Endpoint-coverage suite 10/10; ruff clean.
- **F-timestamp-skew fixed (2026-10-19):** `27e216d0` — SQLite-backed environments (local dev, the e2e launchers) hand SQLAlchemy naive datetimes, so the wire ISO strings carried no offset and JavaScript parsed them as *local* time; the chat drawer and memory cards rendered stored times offset by the viewer's UTC offset (pg `timestamptz` was already aware). `MemoryResponse`, `MemoryExportItem`, and `MemoryExportResponse` now serialize `created_at` / `updated_at` / `deleted_at` / `exported_at` via `_ensure_utc_iso` (naive → stamped UTC, aware → converted UTC; `when_used="json"` so python-side `.model_dump()` callers are unaffected). OpenAPI shape unchanged (regen diff empty for this commit). Fail-before: both new endpoint-coverage tests failed on `'2026-10-19T12:19:53'`-style values before the helper; 12/12 after (13 with `test_memory.py`); memory regression batch 58/58; ruff clean. History endpoint (`MemoryVersion`) left as-is: no frontend consumer.
- **F-status-mutation fixed (2026-10-19):** `4d692ec4` — the three caller-facing status surfaces (`MemoryCreate.status`, `MemoryUpdate.status` on `PUT /memories/{id}`, `POST /memories/bulk-status`) accepted any string, so a typo (`"actve"`) or a case variant borrowed from the documents vocabulary (`"ACTIVE"`, `"Archived"`) landed on the row and vanished it from every filtered view (the default filter admits only `active`/`READY`/`PROCESSING`) with no UI path back. The vocabulary is now pinned in the service (`MEMORY_STATUSES` = the five system-written statuses + user-only `archived`; exact match) via `MemoryStatusRejected` → 422 mapped per handler, mirroring `MemoryTypeRejected`; `deleted_at` is now an exact function of status on all three paths (set on `deleted`, cleared on restore) — the grounding dossier filters on `deleted_at` alone, so a PUT-deleted memory previously kept grounding chat answers and a bulk restore kept the stamp forever (session's "deleted-leak" minor, closed). Fail-before: 6 new tests red (create 201, PUT 200, bulk 200 on junk statuses; `deleted_at` None after PUT delete; stamp retained after a bulk restore; the grounding positive control passed first). Green: endpoint coverage 18/18, memory batch 166/166, ruff clean. Service-layer validation → no OpenAPI delta (no schema enum added).
- **F-panel-cap fixed (2026-10-19):** `6da46714` — the corrections panel requested one `page_size=100` window and dropped the response's `total`, so on a workspace with more than 100 memories every superseded row beyond the first window — exactly what this surface exists to re-correct — was unreachable and silent. It now accumulates windows (`loadedPages`-keyed, mirroring the memory list page) and reads the server total: "Showing X of N memories" plus Load more until reached; the Load-more gate compares fetched rows to the total (not the client-filtered count), so search/status filters can neither fake a truncated window nor leave a dead button. Fail-before: 2 new tests red (no footer; a page-2 request was impossible). Green: panel suite 7/7, combined with the memory-page honesty suite 25/25, tsc + eslint clean.
- **F-kpi-staleness fixed (2026-10-19):** `ef3bddbc` — the global SWR policy (Phase 02A / F-15, `SWRProvider.tsx`) sets `revalidateOnFocus: false` and no interval, and the feed query — the sole source of the three KPI cards and the activity feed — never opted back in. A page left open showed "Autonomous background extractions" frozen at the first load while agents kept writing; `ac409cd8` had only fixed the *fabrication* half (offline zeros). The feed query now adopts `swrClass.LIVE` (the sanction mechanism the policy file exports for this; first consumer), restoring focus revalidation and adding a 30 s poll that SWR pauses while the tab is hidden. Fail-before: new honesty test advances 31 s with fake timers and asserts the count moves 57 → 61; on the old call site the query never refetches. Green: 19/19 honesty + panel 7/7 (26/26 combined), tsc + eslint + prettier clean.

Screenshots: `wave3-v1-*-apidown.png` (10 files, incl. vault-retry, chat-vault-tab, chat-drawer). Method note: full-API-down prevents surface-level walking (reload loop), so per-surface honesty was verified by family-level 503 interception with auth alive.

### Post-run artifact completion (2026-10-18)

- **OpenAPI regenerated** (`pnpm gen:openapi`): 296 paths. The committed specs were stale — the new `GET /api/v1/vault-sync/conflicts/history` path was missing entirely. Diff = exactly that one new path + `/report` and `/status` description updates from lane B (+118/−3 per file; `specs/api/openapi.yaml` and `docs/backend/openapi.yaml` mirrored). Two consecutive runs are **byte-stable** (file hashes identical), so the CI freshness gate (`ci-backend.yml:35` — `gen_openapi.py && git diff --exit-code`) is satisfied as soon as the branch is committed; it would have failed without this regen.
- **ADR-047 added** — `docs/adr/ADR-047-vault-sync-conflict-history-record-only.md`: record-only resolve (server records, daemon applies), idempotent first-wins by `(connector_id, conflict_id)`, device-registry merge in `report`, "last reported" labeling, and the no-resurrection rule. ADR index (`docs/adr/README.md`) updated to 47 and backfilled with ADR-046 (was on disk but never linked — index said 45 while 046 existed).
