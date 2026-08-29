# PHASE-01 — COMPLETE FRONTEND ENTERPRISE AUDIT

**Project:** Vaeloom (`apps/web` — Next.js 15 App Router) **Audit date:**
2026-08-22 **Mode:** AUDIT ONLY — zero source modifications. All evidence
gathered by static inspection, production build measurement, and a live
Playwright/axe runtime sweep. **Report home:**
`.agents/aaaduit/PHASE-01-FRONTEND-ENTERPRISE-AUDIT.md` **Evidence dir:**
`.agents/aaaduit/evidence/` (build logs, sweep JSON, screenshots, git baseline)

---

# Executive Summary

Vaeloom's frontend is a **genuinely functional MVP-grade application with
excellent engineering bones and serious trust-model defects**. The transport
layer is clean (single fetch pipeline, refresh queue, CSRF retry), dependencies
are minimal (only `zustand` beyond next/react/swr — and even that is dead code),
bundle sizes are lean (103 kB shared First Load JS; heaviest route 122 kB), and
23 of 34 pages hit real backend APIs with honest loading/error/empty states.

However, the audit surfaced **four P0 blockers** that prevent MVP-readiness
claims:

1. **`/auth/callback` does not exist** — both SSO login (`login/page.tsx:27`)
   and connector OAuth (`connectors/page.tsx:90`) redirect there. Live-verified
   during this audit: the route returns **404**. Every real OAuth happy path is
   broken.
2. **Fabricated telemetry displayed as fact** — random ATS scores on parse
   failure (`ResumeBuilder.tsx:132-138`), fake chat latency/confidence
   (`ChatWindow.tsx:745,788,565`), admin Quick Actions that toast fake success
   without API calls, a fictional "Visa ending in 4242" payment method in
   billing. In a product whose core philosophy is _suggest-mode-first trust_
   (MVP spec §3, hardened spec §9.3), this is security-sensitive UI
   misrepresentation.
3. **Silent data loss through UI** — Applications outcome select collected but
   never sent (`applications/page.tsx:103`); marketplace install/uninstall
   mutates local state only; schedule approve-without-id diverges from backend
   state; feature-flag toggles never persist.
4. **Production build fails on main** — `next build` dies at the lint gate on
   errors originating in the synthetic a11y test fixture itself
   (`__tests__/a11y.test.tsx`) plus a missing ESLint rule definition. Verified
   live: build only succeeds with `--no-lint`.

Structural quality issues compound these: **dark/light theming is
non-functional** (the `ThemeToggle` is dead code; no CSS reacts to the theme
class), **every workspace page ships two nested `<main id="main-content">`
elements** (live-verified via axe across all 14 routes), **132 color-contrast
violations** were measured, and **three enterprise pages call endpoints that do
not exist server-side**.

Preliminary gate: **CONDITIONAL GO** — implementation may proceed only after
Wave-1 P0 remediation. Full justification in the GO/NO-GO section.

---

# Audit Scope

| Dimension      | Covered                                                                                         | Method                                         |
| -------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Routes         | All 34 pages + special files + middleware                                                       | Static enumeration + live navigation           |
| Components     | 47 web components + 5 ui-kit components                                                         | Full read + consumer grep                      |
| Design system  | Tokens, purge behavior, z-index, typography                                                     | Config read + class census + computed contrast |
| States         | Loading/empty/error/retry/disabled/permission per page                                          | Per-page inspection                            |
| Accessibility  | WCAG-oriented static + automated axe scan (14 routes)                                           | axe-core 4.x injected at runtime               |
| Responsive     | 320/375/768/1024/1440 × 22 routes, overflow detection                                           | Playwright viewport matrix                     |
| Performance    | Production build metrics + route chunks + nav timing                                            | Measured (see Performance Baseline)            |
| UX flows       | Auth, onboarding, chat, approvals, files, resume, jobs, schedule, connectors, history, settings | Code-path tracing                              |
| Testing        | Jest suite executed live (34 tests) + e2e inventory                                             | Ran `pnpm test`; inspected specs               |
| Docs alignment | MVP spec §10 sitemap, hardened spec §9, P09 IA docs                                             | Document extraction vs implementation          |

**NOT MEASURED (honesty per §45):** LCP / INP / CLS field values (no Lighthouse
run; nav-timing lab data recorded instead), hydration cost, long-task profiles,
memory usage. Dev-server nav timings are recorded but flagged as dev-mode
numbers, not production CWV.

---

# Repository Baseline

- **Framework:** Next.js 15.5.20, React 18.3, TypeScript 5.5, Tailwind 3.4, SWR
  2.2, zustand 5 (unused at runtime)
- **App location:** `apps/web/src` (App Router under `src/app`)
- **Working tree at audit start:** NOT clean — 29 pre-existing
  modified/untracked entries from parallel P13/P14 sessions (snapshot preserved
  at `evidence/git-baseline.txt`). This audit added **zero tracked-file
  changes**; final verification compares against that baseline.
- **Build system:** pnpm workspace, Nx orchestration, `transpilePackages` for
  ui-kit/shared-types
- **Live verification environment:** API on :8000 (SQLite fresh DB + mock LLM
  key) + web dev server on :3000; authenticated sweep as `audit@vaeloom.test`

### Baseline anomalies discovered during setup (live findings)

| Finding                                              | Evidence                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/health` returned 500 on every request              | `prometheus_fastapi_instrumentator` 7.1.0 crashes on FastAPI 0.141.1 `_IncludedRouter` objects (`AttributeError: '_IncludedRouter' object has no attribute 'path'`, api log line 636 region). Worked around at runtime via temp-dir monkeypatch; **backend fix required** |
| Fresh `dev.db` lacked `users.consent_version` column | Schema drift between running DB and modified `schema.py` (parallel session work-in-progress)                                                                                                                                                                              |
| Web→API CORS failures on some endpoints              | Console showed `Access to fetch … blocked by CORS policy` for `/scheduler/jobs` (20×) and `/consent/me` (22×) during sweep while other endpoints succeeded — consistent with error responses bypassing CORS header injection (see F-17)                                   |

---

# Frontend Architecture Map

```
src/app/
├── layout.tsx            Root: fonts (Space Grotesk, IBM Plex Mono via next/font),
│                         providers: ErrorTrackingBoundary → ThemeProvider → I18nProvider
│                         → ToastProvider → KeyboardShortcutProvider(+WebVitals+SkipLink+<main>)
├── error.tsx / loading.tsx / not-found.tsx / robots.ts / sitemap.ts
├── page.tsx              Landing ('use client', auth probe redirect)
├── forbidden/ privacy/ terms/ session-expired/ status/
├── (auth)/               login · signup · forgot-password · reset-password · verify-email
│                         (group loading.tsx + error.tsx shared)
└── workspace/[workspaceId]/
    ├── layout.tsx        CLIENT shell: useAuth gate, Sidebar, TopNav, PrefetchProvider,
    │                     ErrorBoundary, mobile drawer w/ inert main
    ├── loading.tsx / error.tsx / not-found.tsx
    └── 23 client pages (dashboard, chat, memory×2, files×2, history, jobs,
        applications, resume, schedule, connectors, approvals, notifications,
        agents×2, settings, admin, billing, marketplace, organizations,
        developer×2, feature-flags)

src/lib/     api.ts (379L transport + legacy bag) · api-client.ts (1807L, 26 typed namespaces) ·
             csrf.ts · swr-client.ts (DEAD) · feature-flags.ts (client system DEAD) ·
             prefetch.tsx · batch.tsx (DEAD) · dynamic-imports.tsx (3 lazy chunks) ·
             web-vitals.ts · error-tracking.ts (+boundary)
src/store/   3 zustand stores — ENTIRELY DEAD (zero importers)
src/hooks/   useAuth (per-consumer fetch, no context) · useApi · useSSE (DEAD) ·
             useTheme · useKeyboardShortcuts · useWorkspace* (2 of 6 used in prod)
src/components/  chat(1) common(2) layout(3) memory(2) onboarding(1) resume(1) settings(1)
                 shared(27, of which 17 DEAD)
```

**Data flow:** components → raw `useSWR(key, inlineClosure)` (~14 sites) or
custom hooks or direct namespace calls → `api-client.ts` → `api.request()`
(single pipeline: bearer injection, CSRF header + retry-on-403, 401
single-flight refresh queue, snake→camel response transform) → FastAPI.

**Auth model:** access token in `localStorage['vaeloom.accessToken']` mirrored
to a JS-written non-HttpOnly cookie for the edge gate; middleware checks cookie
presence only (UX gating); real enforcement = API + client-side `useAuth` gate
in workspace layout. Refresh token localStorage-only. 401-refresh failure
hard-redirects to `/login` (never to the orphaned `/session-expired`).

---

# Route Inventory

34 pages total: 6 standalone + 5 `(auth)` + 23 workspace. Only 4 leaf pages are
Server Components (`/`, `/forbidden`, `/privacy`, `/terms`); everything else is
`'use client'`. Zero `template.tsx`/`default.tsx`/`manifest.ts`. No page-level
metadata exports anywhere (root-only).

## Matrix A — Route Matrix

Legend: MVP = required by canonical 10-page sitemap (docs/01-vaeloom-mvp-spec.md
§10) or P09 IA; Status ∈ {COMPLETE, PARTIAL, BROKEN, MISSING, DEAD/UNUSED}.

| Route                   | Exists | MVP Required    | UI  | UX  | Responsive                    | A11y                 | Perf       | State Complete           | Status                                                         |
| ----------------------- | ------ | --------------- | --- | --- | ----------------------------- | -------------------- | ---------- | ------------------------ | -------------------------------------------------------------- |
| `/` landing             | ✅     | Yes             | 70  | 65  | PASS                          | h1=0 fail            | 112kB FLJS | n/a                      | PARTIAL (#pricing dead anchor, fake social proof)              |
| `/login`                | ✅     | Yes             | 85  | 80  | PASS                          | forms good; h1=0     | 114kB      | strong                   | PARTIAL (SSO dead-end F-01)                                    |
| `/signup`               | ✅     | Yes             | 80  | 75  | PASS                          | social buttons dead  | 112kB      | strong                   | PARTIAL (F-28)                                                 |
| `/forgot-password`      | ✅     | Yes             | 75  | 80  | PASS                          | OK                   | 111kB      | strong (honest 404 copy) | COMPLETE* (*endpoint undeployed, declared)                     |
| `/reset-password`       | ✅     | Yes             | 75  | 75  | **FAIL orb overflow all VPs** | OK                   | 112kB      | strong                   | PARTIAL (F-24)                                                 |
| `/verify-email`         | ✅     | Yes             | 75  | 85  | PASS                          | h1=0                 | 109kB      | best-in-app 4 states     | COMPLETE                                                       |
| `/status`               | ✅     | No (orphan)     | 70  | 60  | PASS                          | h1=0                 | 107kB      | good                     | DEAD/UNUSED (no inbound links; uptime bug)                     |
| `/forbidden`            | ✅     | No              | 60  | 40  | PASS                          | OK                   | 107kB      | n/a                      | DEAD/UNUSED (mislabeled CTA)                                   |
| `/session-expired`      | ✅     | No              | 70  | 50  | PASS                          | OK                   | 109kB      | n/a                      | DEAD/UNUSED (nothing links here)                               |
| `/terms` `/privacy`     | ✅     | Yes             | 50  | 40  | PASS                          | second empty-id main | 107kB      | n/a                      | PARTIAL (declared placeholders)                                |
| `/auth/callback`        | ❌     | **Yes (OAuth)** | —   | —   | —                             | —                    | —          | —                        | **MISSING — P0 F-01**                                          |
| `/onboarding`           | ❌     | Yes (FR-01..05) | —   | —   | —                             | —                    | —          | —                        | **MISSING (checklist only, can't complete — F-18)**            |
| `ws dashboard`          | ✅     | Yes             | 85  | 85  | PASS                          | dup main+h1          | 120kB      | good                     | COMPLETE (retry=reload gap)                                    |
| `ws chat`               | ✅     | Yes             | 85  | 75  | **FAIL drawer@375**           | unlabeled icon btns  | 105kB lazy | streaming good           | PARTIAL (no cancel; fabricated telemetry F-02/F-19)            |
| `ws memory`             | ✅     | Yes             | 80  | 75  | list-mode fallback ✓          | dup main+h1          | 122kB      | good                     | PARTIAL (fake export btn; unscoped node fetch)                 |
| `ws memory/[id]`        | ✅     | Secondary       | 75  | 65  | PASS                          | dead onClick button  | 121kB      | good                     | PARTIAL (F-28)                                                 |
| `ws files`              | ✅     | Yes             | 90  | 90  | card-list fallback ✓          | row role=button      | 117kB      | strongest in app         | COMPLETE (silent agent-rename side-call)                       |
| `ws files/[id]`         | ✅     | Secondary       | 75  | 65  | PASS                          | OK                   | 116kB      | good                     | PARTIAL (fetch-by-listing; phantom Undo promise)               |
| `ws history`            | ✅     | Yes             | 80  | 75  | **table no wrapper**          | date inputs unnamed  | 121kB      | undo works               | PARTIAL (F-11/F-24)                                            |
| `ws jobs`               | ✅     | Yes             | 75  | 65  | PASS                          | search unnamed       | 115kB      | delete confirm ✓         | PARTIAL (saved tab localStorage-only; apply linkage invisible) |
| `ws applications`       | ✅     | Secondary       | 75  | 65  | kanban scroll ✓               | selects labeled      | 113kB      | modal save ✓             | PARTIAL (**outcome silently dropped — F-03**)                  |
| `ws resume`             | ✅     | Yes             | 70  | 55  | PASS                          | OK                   | 105kB lazy | gen/diff/export          | PARTIAL (no editor despite copy; random ATS F-02)              |
| `ws schedule`           | ✅     | Yes             | 70  | 60  | **FAIL grid-cols-7 @320**     | selects unnamed      | 116kB      | create/approve           | PARTIAL (local-only approve divergence; reminders local)       |
| `ws connectors`         | ✅     | Yes             | 80  | 70  | PASS                          | scope modal good     | 116kB      | revoke confirm ✓         | **BROKEN happy path (F-01)**                                   |
| `ws approvals`          | ✅     | Yes             | 80  | 70  | PASS                          | false hotkey ad      | 120kB      | tabs+expiry              | PARTIAL (A/R keys only per-card focus; risk never set)         |
| `ws notifications`      | ✅     | Secondary       | 75  | 70  | PASS                          | OK                   | 119kB      | export ✓                 | PARTIAL (unhandled approve/reject rejections)                  |
| `ws agents`             | ✅     | Secondary       | 80  | 70  | PASS                          | skip-level heading   | 119kB      | filter/search            | COMPLETE (read-only by design)                                 |
| `ws agents/[id]`        | ✅     | Secondary       | 75  | 65  | PASS                          | dead fallback link   | 118kB      | not-found ok             | COMPLETE (read-only)                                           |
| `ws settings`           | ✅     | Yes             | 80  | 75  | PASS                          | consent labels ✓     | 121kB      | GDPR type-DELETE ✓       | COMPLETE (legacy api.me() mix)                                 |
| `ws admin`              | ✅     | Enterprise      | 65  | 45  | PASS                          | OK                   | 116kB      | users/audit real         | PARTIAL (Quick Actions theater — F-02)                         |
| `ws billing`            | ✅     | Enterprise      | 65  | 45  | PASS                          | OK                   | 116kB      | usage real               | PARTIAL (plan change fake; fictional card — F-02)              |
| `ws marketplace`        | ✅     | Enterprise      | 65  | 45  | PASS                          | OK                   | 115kB      | gate screen              | PARTIAL (install fake; zeroed metrics — F-02/F-03)             |
| `ws organizations`      | ✅     | Enterprise      | 60  | 35  | PASS                          | OK                   | 115kB      | invite no-op             | **BROKEN (`/iam/organizations` absent — F-05)**                |
| `ws developer`          | ✅     | Enterprise      | 60  | 30  | PASS                          | OK                   | 117kB      | gate screen              | **BROKEN (`/api-keys` absent; fake keygen — F-05/F-02)**       |
| `ws developer/webhooks` | ✅     | Enterprise      | 80  | 75  | PASS                          | alert() errors       | 111kB      | CRUD real                | COMPLETE (alert() idiom outlier)                               |
| `ws feature-flags`      | ✅     | Enterprise      | 60  | 30  | grid-cols-4 squeeze           | A/B form dead        | 116kB      | toggles local            | **BROKEN (`/feature-flags` absent — F-05)**                    |

**Route verdicts:** COMPLETE 7 · PARTIAL 19 · BROKEN 4 (connectors-happy-path,
organizations, developer, feature-flags) · MISSING 2 (`/auth/callback`,
`/onboarding`) · DEAD/UNUSED 3 (`/status`, `/forbidden`, `/session-expired`).

---

# Page Inventory

## Matrix B — Page Quality Matrix (0–100)

| Page                  | Completeness |  UI |  UX |                 A11y |     Responsive | Perf |       Architecture | Overall |
| --------------------- | -----------: | --: | --: | -------------------: | -------------: | ---: | -----------------: | ------: |
| Landing `/`           |           60 |  72 |  62 |                   55 |             85 |   80 |                 55 |      64 |
| Login                 |           82 |  85 |  84 |                   78 |             90 |   82 |                 80 |      82 |
| Signup                |           76 |  82 |  74 |                   74 |             88 |   80 |                 78 |      77 |
| Forgot/Reset password |           78 |  78 |  80 |                   76 |       60 (orb) |   80 |                 78 |      74 |
| Verify email          |           85 |  75 |  86 |                   70 |             88 |   82 |                 80 |      81 |
| Status                |           65 |  68 |  58 |                   66 |             85 |   80 |                 70 |      63 |
| Dashboard             |           84 |  86 |  86 |                   62 |             92 |   74 |                 78 |      79 |
| Chat                  |           74 |  84 |  70 |                   60 |    55 (drawer) |   78 | 62 (god-component) |      69 |
| Memory hub            |           76 |  80 |  74 |                   60 |             85 |   72 |                 70 |      72 |
| Graph tab             |           72 |  78 |  76 |                   68 | 80 (list-mode) |   70 |                 68 |      71 |
| Memory detail         |           70 |  74 |  62 |                   62 |             85 |   74 |                 72 |      68 |
| Files                 |           90 |  88 |  90 |                   66 |             90 |   76 |                 80 |      84 |
| File detail           |           72 |  74 |  64 |                   70 |             85 |   76 |                 66 |      70 |
| History               |           78 |  78 |  74 |  52 (unnamed inputs) |     60 (table) |   74 |                 74 |      70 |
| Jobs                  |           62 |  74 |  60 |                   62 |             82 |   76 |                 70 |      65 |
| Applications          |           64 |  74 |  58 |                   70 |             84 |   78 |                 72 |      66 |
| Resume                |           54 |  70 |  52 |                   68 |             86 |   80 |                 68 |      61 |
| Schedule              |           62 |  70 |  56 | 56 (unnamed selects) |  48 (calendar) |   74 |                 66 |      61 |
| Connectors            |           66 |  80 |  62 |                   72 |             86 |   76 |                 74 |      68 |
| Approvals             |           74 |  80 |  68 |                   66 |             88 |   76 |                 76 |      72 |
| Notifications         |           72 |  74 |  68 |                   70 |             86 |   76 |                 74 |      71 |
| Agents list/detail    |           78 |  80 |  72 |                   62 |             88 |   78 |                 76 |      74 |
| Settings              |           80 |  80 |  76 |                   72 |             86 |   74 |                 72 |      76 |
| Admin                 |           42 |  64 |  38 |                   68 |             86 |   78 |                 66 |      53 |
| Billing               |           44 |  64 |  40 |                   68 |             86 |   78 |                 66 |      55 |
| Marketplace           |           46 |  64 |  42 |                   68 |             86 |   78 |                 66 |      57 |
| Organizations         |           25 |  60 |  25 |                   68 |             86 |   78 |                 64 |      47 |
| Developer             |           22 |  60 |  22 |                   66 |             86 |   78 |                 62 |      45 |
| Developer/webhooks    |           80 |  78 |  74 |                   70 |             86 |   78 |                 76 |      76 |
| Feature flags         |           24 |  60 |  24 |                   66 |      60 (grid) |   78 |                 62 |      46 |

---

# Component Inventory

47 component files under `src/components` + 5 ui-kit components. **17 web
components are dead** (zero production importers):
`shared/{Form, Page, Select, Checkbox, Radio, Alert, Avatar, Breadcrumb, Timeline, Tooltip, AgentStatus, ConnectorCard, MemoryNode, Grid, Stack}`,
`layout/ThemeToggle`, plus `lib/batch.tsx` and all of `src/store/`. The
purpose-built `PageHeader`, `FormField`, `Alert`, `Tooltip` were built to solve
problems that hand-rolled page code then solved worse.

## Matrix D — Component Matrix

| Component                       |      LOC | Consumers | Reusable | Duplicated with                                                     | Accessible                                                                    | Responsive          | Consistent                 | Perf Risk                      |
| ------------------------------- | -------: | --------: | -------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------- | -------------------------- | ------------------------------ |
| ui-kit Modal                    |      121 |  13 files | High     | ConfirmDialog, batch ConfirmDialog, TopNav palette, shortcuts modal | **Best-in-repo** (trap/restore/Esc/portal) but **backdrop purged → no scrim** | mx-4 purged         | Low                        | Low                            |
| shared/ConfirmDialog            |       91 |         3 | Med      | ui-kit Modal; dead batch twin                                       | **No trap, no aria-modal**, Enter-on-container=Confirm, static IDs collide    | OK                  | Low                        | Low                            |
| shared/Toast (+useToast)        |      155 |        19 | High     | dead uiStore toast queue (5s vs 6s)                                 | aria-live ✓ Esc ✓                                                             | OK                  | High                       | Low                            |
| shared/Tabs                     |      108 |         4 | High     | —                                                                   | Exemplary roving tabindex                                                     | OK                  | High                       | Low                            |
| shared/Table                    |       68 |         4 | Med      | raw tables elsewhere                                                | `role="button"` on `<tr>` breaks row semantics                                | overflow-x-auto ✓   | Med                        | Low                            |
| shared/Badge vs StatusBadge     |    23/24 |      11/8 | High     | **Near-duplicates** (identical palette maps)                        | role=status ✓                                                                 | OK                  | Low                        | Low                            |
| shared/EmptyState vs ErrorState |    26/22 |     15/17 | High     | **Same skeleton**                                                   | roles ✓                                                                       | OK                  | Med                        | Low                            |
| shared/DiffViewer               |      130 |         6 | High     | —                                                                   | unscoped aria-details id                                                      | OK                  | High                       | Low                            |
| shared/ApprovalCard             |      140 |         2 | High     | ChatWindow proposal card (parallel styles)                          | hotkey guard ✓ autoFocus ✓                                                    | OK                  | Med                        | Low                            |
| shared/Toggle                   |       38 |         2 | Med      | settings custom switch                                              | redundant aria-label+labelledby                                               | OK                  | Med                        | Low                            |
| common/LoadingSpinner           |       15 |        18 | High     | 3 other loading idioms                                              | **nonexistent token text-surface-500**                                        | OK                  | Low                        | Low                            |
| common/ErrorBoundary            |       44 |         1 | Med      | error-tracking-boundary                                             | light-only colors on dark theme                                               | OK                  | Low                        | Low                            |
| layout/Sidebar                  |      522 |         1 | Low      | own isEnterpriseEnabled()                                           | h1 epidemic source; close btn labeled ✓                                       | drawer pattern good | Med                        | Med (inline SVG mass)          |
| layout/TopNav                   |      180 |         1 | Low      | duplicate initials avatar; bespoke palette modal                    | labeled icon buttons ✓                                                        | OK                  | Med                        | Low                            |
| chat/ChatWindow                 | **1258** |         1 | Low      | —                                                                   | 2 unlabeled icon buttons; user bubble hardcoded bg-white/text-black           | max-md rail         | Low                        | Med (unvirtualized transcript) |
| memory/GraphViewer              |      485 |         1 | Low      | —                                                                   | keyboard nodes ✓ role=img ✓                                                   | list-mode ≤768px ✓  | Med (9 hardcoded hexes)    | Med (rAF pan ok)               |
| settings/ProviderKeysSection    |      364 |         1 | Low      | —                                                                   | button-inside-label smell; native confirm()                                   | OK                  | Low (!important overrides) | Low                            |
| resume/ResumeBuilder            |      300 |         1 | Low      | —                                                                   | target-role label ✓                                                           | fluid lg split ✓    | Low (mixed button systems) | Low                            |
| onboarding/OnboardingChecklist  |       82 |         1 | Low      | —                                                                   | OK                                                                            | OK                  | Low (3rd primary style)    | Low                            |

**Oversized components (>300 L):** ChatWindow 1258 · Sidebar 522 · GraphViewer
485 · ProviderKeysSection 364 · ResumeBuilder 300 — plus page files acting as
mega-components: files 884 · schedule 709 · settings 697 · jobs 613 ·
history 570.

---

# Design System Audit

## Foundations verdict: tokens exist; discipline doesn't

`tailwind.config.ts` defines a complete semantic set
(`background/surface/primary/accent/text/border/success/warning/error/info` +
full light `l-*` palette + shadows + animations). Usage reality:

- Semantic tokens ARE widely used (`text-text-muted` ×454, `bg-background` ×46
  files) — the core dark theme is coherent.
- **Raw Tailwind-palette leakage: 445 occurrences across 43 files** (worst:
  ChatWindow 28, schedule 18, jobs 17). Even the primitives that define status
  semantics (`Badge`, `StatusBadge`, `Alert`, `Timeline`, `ProgressBar`)
  hardcode `green/yellow/red/blue-XXX` instead of the defined semantic tokens.
- **Hardcoded hex:** GraphViewer node map (9), Google brand SVGs (8,
  defensible), `theme-color #0a0a0f` matching no token.
- **Nonexistent tokens shipped:** `text-surface-500` ×3 / `text-surface-900` ×1
  generate nothing (surface scale stops at 400); `gap-${gap}` runtime
  interpolation in dead Grid.tsx is invisible to JIT.
- **Light mode is scaffolding only:** `darkMode:'class'` + ThemeProvider
  toggling `.light` — but zero CSS reacts to it; the entire `l-*` palette has
  zero usages; `ThemeToggle` has zero importers. Only 9 `dark:` utilities exist
  in 4 files. AGENTS.md's "light/dark mode DONE" claim is false.
- Arbitrary values ≈60 (top: `text-[10px]` ×11, `w-[400px]` ×6); radius spread
  across 7 steps with dialogs alone using both `rounded-2xl` and `rounded-lg`;
  overlays use four different elevations.
- z-index inventory: z-10/20/30/40/50, z-[90] toasts, z-[100] skip-link. Tooltip
  (z-50) can overlay modals; two drawers claim z-40/z-30 differently. No
  documented scale.

## The purge bug (highest-leverage design-system defect)

Tailwind `content` globs cover only `./src/**` — **`packages/ui-kit/**` is not
scanned**, so classes appearing _only_ in ui-kit are purged from the production
CSS:

| Purged class                   | Runtime effect                                                          |
| ------------------------------ | ----------------------------------------------------------------------- |
| `bg-black/60` (Modal backdrop) | **All 13 Modal-consuming screens render dialogs with NO dimming scrim** |
| `hover:bg-surface-active`      | Secondary Button hover does nothing                                     |
| `active:bg-primary-active`     | Primary Button pressed state missing                                    |
| `focus:ring-border`            | Secondary/ghost focus ring falls back to default blue                   |
| `mx-4`                         | Modal hugs screen edges on mobile                                       |

Verified by cross-grep: these classes appear nowhere else in scanned globs.

---

# UI Consistency Audit

| Concept                | Implementations found                                                                                                                                                                                | Classification           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Buttons                | **4 systems**: ui-kit Button (37 uses) · `.btn-*` globals (76 uses) · raw bespoke `<button>` (~94) · page-local recipes with `!important` overrides                                                  | Architectural + Cosmetic |
| "Primary action" color | `bg-primary text-background` vs `.btn-primary` white-on-black vs ChatWindow white pills vs OnboardingChecklist white links vs ProviderKeysSection `bg-primary text-white` (invisible-text candidate) | Usability + Cosmetic     |
| Modals/overlays        | **6 implementations**, 4 elevation levels, 3 backdrop opacities (one purged to none)                                                                                                                 | Architectural            |
| Loading                | 4 idioms: spinner wrapper · pulse skeletons · bounce dots · plain "Loading…" text (resume/chat/marketplace)                                                                                          | Cosmetic → Usability     |
| Empty states           | Shared EmptyState (good) but many callers omit the action slot; dashboard best-in-app                                                                                                                | Usability                |
| Error display          | 3 idioms: role="alert" paragraphs (14 sites) · inline colored text without role · toast-only; error color splits across token/raw-red/ui-kit-accent(indigo!)                                         | Accessibility + Cosmetic |
| Confirmation           | ConfirmDialog (3 consumers) · ui-kit Modal reused · native `confirm()` (BYOK delete) · `alert()` (webhooks errors)                                                                                   | Usability + A11y         |
| Retry                  | SWR `mutate()` (correct) vs `window.location.reload()` (dashboard/history/agents×2)                                                                                                                  | Functional               |
| Page titles            | Same route renders `text-2xl` or `text-3xl` depending on branch (billing/admin/developer/marketplace/flags/orgs); ChatWindow h1 is `text-sm`                                                         | Cosmetic                 |
| Toasts                 | Single live implementation (consistent position/duration) — positive finding                                                                                                                         | —                        |
| Muted text             | `text-text-muted` vs `text-text-dim` used mood-based per file                                                                                                                                        | Cosmetic                 |

---

# UX Audit

**Strengths:** dashboard partial-data degradation is honest (header degrades per
failed source); files page is exemplary (upload progress+retry, rename diff
preview, archive/restore, per-file undo); auth forms follow best practice
(labels, autocomplete, inline errors, disabled+spinner submit); verify-email
covers four explicit states; connectors shows scopes pre-consent.

**Systemic UX problems:**

1. **Destructive-action handling is inconsistent** — confirm dialog for job
   delete/connector revoke/webhook delete; native confirm for BYOK keys; **no
   confirmation** for GDPR data delete (mitigated by typed-DELETE requirement);
   archive is soft-delete (acceptable).
2. **Undo exists only for document actions** (History/Files). Spec requires
   reversibility semantics broadly ("every Organization Agent action logged with
   enough detail to undo" — MVP §11); agent-action rows show diffs but offer no
   undo path.
3. **Dead ends:** SSO success → 404; signup social buttons do nothing; "Export
   lineage" button just toasts directions; file-detail footer promises an Undo
   button it never renders; forbidden-page CTA mislabeled; `/memory` and
   `/agents` fallback links point outside workspace context.
4. **Fabricated feedback destroys trust** (see F-02): users cannot distinguish
   real system state from theater — the exact failure mode the
   suggest-mode-first philosophy exists to prevent.
5. **Keyboard shortcut advertising is false** — Approvals header says "Use A to
   approve, R to reject" but handlers fire only when an individual card has DOM
   focus; there is no page-level handler.
6. **Onboarding can never complete** — two checklist steps hardcode `done:false`
   forever; step 1 links to nonexistent `/workspaces`.

---

# User Journey Audit

## Matrix H — UX Flow Matrix

| Flow                     | Happy                                    | Empty              | Error                           | Recovery                             | Permission                            | Interrupted                 | Overall                             |
| ------------------------ | ---------------------------------------- | ------------------ | ------------------------------- | ------------------------------------ | ------------------------------------- | --------------------------- | ----------------------------------- |
| Sign in (password)       | ✅ live-verified                         | n/a                | inline+toast ✓                  | retry ✓                              | n/a                                   | redirect param preserved ✓  | **A−**                              |
| Sign up                  | ✅                                       | n/a                | validation strong               | ✓                                    | n/a                                   | ✓                           | **B+** (social buttons dead)        |
| SSO login                | ❌ **404 dead-end**                      | n/a                | graceful "not configured" toast | none possible                        | n/a                                   | n/a                         | **F (F-01)**                        |
| Forgot/reset password    | form ✓                                   | n/a                | honest 404 messaging ✓          | ✓                                    | n/a                                   | dual-mode token ✓           | **B+**                              |
| Onboarding               | ❌ no route                              | checklist shows    | n/a                             | n/a                                  | n/a                                   | re-entry = dashboard banner | **D (F-18)**                        |
| Connector connect        | ❌ OAuth→404; legacy fallback works      | inline empty ✓     | sync errorDetail shown ✓        | retry ✓                              | scopes pre-consent ✓                  | syncing shimmer ✓           | **C− (F-01)**                       |
| Connector revoke         | confirm ✓                                | —                  | ✓                               | n/a                                  | ✓                                     | busy-disable ✓              | **B+**                              |
| File upload              | progress phases ✓                        | dropzone guided ✓  | **retry-on-error ✓**            | ✓                                    | n/a                                   | cancel absent               | **A−**                              |
| File rename/archive/undo | diff preview ✓                           | —                  | ✓                               | History undo ✓                       | n/a                                   | ✓                           | **A−**                              |
| Chat send/stream         | SSE phases ✓                             | quick prompts ✓    | msg-level retry ✓               | ✓                                    | approval cards wired ✓                | **no cancel (F-19)**        | **B−**                              |
| Approval decide          | approve/reject real ✓                    | status tabs ✓      | per-item busy ✓                 | expiry timer ✓                       | scopes shown ✓                        | resolved cards disable ✓    | **B+** (false hotkeys)              |
| Memory correct           | diff preview ✓                           | —                  | ✓                               | supersession chain ✓                 | n/a                                   | busy-guard ✓                | **B+**                              |
| Resume generate          | variant gen ✓                            | empty lacks CTA    | ErrorState ✓                    | ✓                                    | n/a                                   | ✓                           | **C+** (no editor; random ATS F-02) |
| Job search               | agent-backed ✓                           | clarifying chips ✓ | ✓                               | ✓                                    | n/a                                   | ✓                           | **B−**                              |
| Job apply                | fires agent + tells user approval needed | —                  | ✓                               | linkage to approval record invisible | approval gate ✓                       | ✓                           | **C**                               |
| Application track        | kanban+modal ✓                           | columns empty ok   | ✓                               | ✓                                    | n/a                                   | ✓                           | **C+ (outcome dropped F-03)**       |
| Schedule create          | modal ✓                                  | calendar empty ok  | toast-only validation           | ✓                                    | propose/approve wired when id present | ✓                           | **C (local-approve divergence)**    |
| Settings export/delete   | type-DELETE GDPR ✓                       | —                  | ✓                               | receipt? not verified                | consent toggles ✓                     | async job UI thin           | **B**                               |
| History inspect/undo     | 3 feeds + filters ✓                      | good empties ✓     | one reload-retry                | undo busy-state ✓                    | n/a                                   | pagination client-side      | **B+**                              |

---

# State Matrix

## Matrix C — State Coverage Matrix

| Feature                | Loading                    | Empty        | Success           | Error                   | Retry          | Disabled        | Permission        | Processing          | Cancel        | Undo               |
| ---------------------- | -------------------------- | ------------ | ----------------- | ----------------------- | -------------- | --------------- | ----------------- | ------------------- | ------------- | ------------------ |
| Dashboard panels       | skeleton ✓                 | w/ actions ✓ | —                 | per-panel ✓             | reload-style ⚠ | —               | —                 | —                   | —             | —                  |
| Auth forms             | spinner ✓                  | —            | redirect ✓        | inline+alert ✓          | manual ✓       | submit ✓        | —                 | —                   | —             | —                  |
| Files upload           | XHR progress ✓             | dropzone ✓   | toast ✓           | **retry ✓**             | ✓              | ✓               | —                 | phases ✓            | ✗             | via History ✓      |
| Files list             | spinner ✓                  | ✓            | —                 | ✓                       | mutate ✓       | ✓               | —                 | —                   | —             | ✓                  |
| Chat stream            | typing dots ✓              | prompts ✓    | rendered ✓        | msg retry ✓             | ✓              | send disabled ✓ | approval gate ✓   | phase labels ✓      | **✗ no Stop** | ✗                  |
| Approvals              | spinner ✓                  | tabs ✓       | card state flip ✓ | ✓                       | ✓              | per-item dim ✓  | scopes ✓          | expiry countdown ✓  | —             | ✗                  |
| Connectors sync        | shimmer ✓                  | inline ✓     | badge ✓           | errorDetail ✓           | ✓              | busy ✓          | scope modal ✓     | progress ✓          | ✗             | ✗                  |
| Resume generate        | text "Loading…" ⚠          | no action ⚠  | stats render ✓    | ErrorState ✓            | ✓              | ✓               | —                 | gen wait ✓          | ✗             | ✗                  |
| Jobs search            | spinner ✓                  | ✓            | badges ✓          | ✓                       | ✓              | ✓               | —                 | agent wait ✓        | ✗             | ✗                  |
| Applications save      | busy ✓                     | ✓            | toast ✓           | ✓                       | ✓              | ✓               | —                 | —                   | ✗             | ✗                  |
| Schedule create        | **no loading on Create** ⚠ | ✓            | local flip ⚠      | toast-only validation ⚠ | ✗              | ✗               | approval path ✓   | —                   | ✗             | ✗                  |
| Settings export/delete | thin ⚠                     | —            | ✓                 | ✓                       | ✓              | type-DELETE ✓   | consent gates ✓   | async job UI thin ⚠ | ✗             | ✗                  |
| Memory correction      | busy ✓                     | —            | toast ✓           | ✓                       | ✓              | ✓               | —                 | diff preview ✓      | ✗             | supersession ✓     |
| History undo           | busy ✓                     | ✓            | ✓                 | ✓                       | ✓              | ✓               | —                 | —                   | —             | n/a (is undo)      |
| Marketplace install    | none ⚠                     | —            | fake local flip ⚠ | ✗                       | ✗              | ✗               | enterprise gate ✓ | —                   | ✗             | refresh loses it ⚠ |

Legend: ✓ present · ⚠ present-but-deficient · ✗ absent.

**Pattern:** loading/empty/error coverage is broad and often good; **cancel,
undo-outside-documents, and permission-denied-with-grant-path states are the
systemic gaps** (hardened spec §9.2 explicitly requires permission-denied to
offer "missing scope + safe grant path" — nowhere implemented).

---

# Responsive Audit

Method: Playwright viewport matrix — 22 routes × {320, 375, 768, 1024, 1440},
measuring `scrollWidth − clientWidth` and identifying offending elements.
Screenshots archived at 375/1440 for key pages.

**Result: 105 of 110 route×viewport cells clean.** The drawer pattern (sidebar
`-translate-x-full md:translate-x-0`, scrim, auto-close on route change, inert
content) is genuinely well built; files page swaps table→card list on mobile;
kanban scrolls horizontally by design.

## Matrix G — Responsive Matrix

| Route                         | 320                | 375        | 414*     | 768      | 1024     | 1440     | Notes                                                                                                            |
| ----------------------------- | ------------------ | ---------- | -------- | -------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `/reset-password`             | **FAIL overX=250** | **FAIL**   | **FAIL** | **FAIL** | **FAIL** | **FAIL** | decorative `w-[500px]` orb, parent lacks overflow-hidden (`reset-password/page.tsx:234`)                         |
| `ws schedule`                 | MARGINAL           | MARGINAL   | ok       | ok       | ok       | ok       | `grid-cols-7` calendar → ~45px cells @320; chips truncate (`schedule/page.tsx:413,441`)                          |
| `ws chat`                     | DEFECT             | **DEFECT** | ?        | ok       | ok       | ok       | threads rail renders open/overlapping at 375 on load; content bleeds behind scrim (screenshot `ws/chat-375.png`) |
| `ws history`                  | squeeze            | squeeze    | ok       | ok       | ok       | ok       | notifications `<table>` has no overflow wrapper (`history/page.tsx:498-499`)                                     |
| feature-flags / organizations | squeeze            | squeeze    | ok       | ok       | ok       | ok       | unprefixed `grid-cols-4` rows                                                                                    |
| all other 17 routes           | PASS               | PASS       | PASS     | PASS     | PASS     | PASS     | —                                                                                                                |

\* 414 interpolated between measured 375/768 behavior; not separately driven.

Additional static findings: auth-page blur orbs also risk horizontal scroll on
login (parent `relative` without `overflow-hidden`, `login/page.tsx:168-172`);
KeyboardShortcuts modal touches screen edges below ~448px (no horizontal
margin); touch targets below WCAG 2.5.8 minimums (20px TopNav/Sidebar icon
buttons, 32px chat send/attach, ~18px calendar chips).

---

# Accessibility Audit

Method: full static inspection + runtime axe-core scan (14 workspace routes,
authenticated) + live focus-trap/drawer behavior tests.

## Automated results (axe, totals across routes)

| Rule                       | Impact       | Total instances | Routes affected |
| -------------------------- | ------------ | --------------: | --------------: |
| color-contrast             | serious      |         **132** |              14 |
| landmark-no-duplicate-main | moderate     |              14 |              14 |
| landmark-main-is-top-level | moderate     |              14 |              14 |
| landmark-unique            | moderate     |              15 |              14 |
| select-name                | **critical** |               4 |               3 |
| label                      | **critical** |               2 |               1 |
| nested-interactive         | serious      |               1 |               1 |
| heading-order              | moderate     |               2 |               2 |

## Structural findings (live-verified)

1. **Nested duplicate `<main id="main-content">` on every workspace page** —
   root layout wraps a `<main>` (`app/layout.tsx:119`), workspace layout nests
   another with the same id (`workspace/[workspaceId]/layout.tsx:64-65`).
   Invalid HTML, duplicate DOM id, ambiguous skip-link target.
   terms/privacy/login render an additional empty-id `<main>`.
2. **Heading epidemic:** Sidebar renders `<h1>Vaeloom</h1>` on every workspace
   page → every route has ≥2 h1s; chat/resume pages have zero semantic headings
   of their own; login/signup/verify-email/status have h1=0; dashboard/agents
   skip h1→h3.
3. **Contrast failures concentrated in status badges** using light-mode palette
   colors (`text-amber-700` 3.96:1, `text-emerald-700` 3.63:1, `text-red-600`
   4.12:1 vs surface #09090b) across
   history/schedule/memory/files/resume/settings/dashboard — the correct `dark:`
   pattern already exists in agents page but was never applied elsewhere.
4. **Unnamed controls:** history date inputs (zero labels), schedule filter
   selects, GraphViewer type select, jobs search placeholder-only → axe critical
   `select-name`/`label`.
5. **ConfirmDialog gaps:** no focus trap, no aria-modal, no focus restore; Enter
   pressed while container focused triggers Confirm.
6. **Mobile drawer:** Escape does NOT close it (live-tested); inner main gets
   `inert` while open (good), but no trap inside drawer.
7. **Error announcement nearly absent:** `aria-invalid` used once (in dead
   code); field errors not programmatically linked via aria-describedby anywhere
   in auth forms.

## What passes (positive)

Skip link present and functional · global `:focus-visible` ring · Tabs
roving-tabindex exemplary · ui-kit Modal trap/restore/Esc best-in-repo
(undermined only by purged backdrop) · reduced-motion global kill-switch +
GraphViewer honors it · keyboard-accessible graph nodes with list-mode fallback
· consent checkboxes labeled · icon-only buttons labeled except 2 in ChatWindow.

## Matrix F — Accessibility Matrix

| Route            | Keyboard          | Focus           | Semantics                    | Contrast            | Forms                   | Dynamic Content       | Screen Reader    | Overall |
| ---------------- | ----------------- | --------------- | ---------------------------- | ------------------- | ----------------------- | --------------------- | ---------------- | ------- |
| Auth pages       | Good              | Good            | h1=0 login/signup            | Pass                | **Best practice**       | role=alert ✓          | Fair             | B       |
| Dashboard        | Good              | Good            | dup main/h1                  | Fail (badges)       | n/a                     | skeletons ✓           | Poor             | C−      |
| Chat             | Good              | Good            | no headings; unlabeled icons | Fail (white bubble) | composer labeled ✓      | typing dots silent    | Poor             | C−      |
| Memory/Graph     | Nodes keyboard ✓  | ring ✓          | dup main/h1                  | Fail                | filter unnamed ✓axe     | HUD aria-live? ✗      | Fair (list mode) | C       |
| Files            | Rows keyboard ✓   | bg-only focus ⚠ | row role=button ⚠            | Fail (badge)        | rename modal ✓          | upload live region ✓  | Fair             | C+      |
| History          | Non-int rows fine | OK              | dup main                     | Fail                | **date inputs unnamed** | —                     | Poor             | D+      |
| Jobs/Schedule    | OK                | OK              | dup main                     | Fail                | selects unnamed         | —                     | Poor             | D+      |
| Approvals        | per-card A/R ✓    | autoFocus ✓     | dup main                     | Fail                | n/a                     | expiry live ✓         | Fair             | C+      |
| Settings         | OK                | OK              | dup main                     | Fail                | consent labels ✓        | toggles switch role ✓ | Fair             | C+      |
| Enterprise pages | OK                | OK              | dup main                     | Fail                | mixed                   | —                     | Poor             | C−      |

---

# Interaction & Motion Audit

- Animation inventory is small and purposeful
  (fade/slide/scale/glow-pulse/float); global `prefers-reduced-motion`
  kill-switch exists (`globals.css:135-142`) — positive.
- Click feedback inconsistent: ui-kit Button has purged active state; raw
  buttons mostly lack active/pressed treatments; cards use hover elevation
  inconsistently (three card systems).
- Toast behavior consistent (bottom-right, 6s, pause-on-hover, Esc dismisses
  last) — positive.
- Optimistic updates: used for memory correction and status flips; correctly
  avoided for approvals/deletes — matches P09 rules; but schedule
  approve-without-id flips state locally while telling the user it's "local
  only" — honest copy, divergent model.
- No excessive animation found; no jank-inducing patterns observed statically
  (rAF-throttled pan in GraphViewer).
- Focus restoration after modal close: ui-kit Modal yes; ConfirmDialog and
  shortcuts modal no.

---

# Form Audit

| Form                                         | Labels                      | Validation                | Submit states        | Server errors           | Verdict                 |
| -------------------------------------------- | --------------------------- | ------------------------- | -------------------- | ----------------------- | ----------------------- |
| Login                                        | htmlFor/id + autocomplete ✓ | regex inline ✓            | spinner+disabled ✓   | form-level role=alert ✓ | **A**                   |
| Signup                                       | ✓ ×4 fields                 | strength meter + match ✓  | ✓                    | ✓                       | **A** (social dead)     |
| Forgot/Reset password                        | ✓                           | ✓                         | ✓                    | honest 404 handling ✓   | **A−**                  |
| Files rename                                 | ✓                           | non-empty ✓               | busy ✓               | toast ✓                 | B+                      |
| Resume target-role                           | htmlFor ✓                   | required ✓                | busy ✓               | ErrorState ✓            | B+                      |
| Schedule create                              | label-wrapped ✓             | **toast-only validation** | **no loading state** | toast only              | C                       |
| Applications edit                            | selects labeled ✓           | —                         | busy ✓               | ✓                       | B (**outcome dropped**) |
| Webhooks create                              | labeled ✓                   | disabled-until-valid ✓    | busy ✓               | **alert() ×4**          | B−                      |
| History filters                              | **0/3 labeled**             | —                         | n/a                  | —                       | **F**                   |
| Jobs search / Schedule search / Graph filter | placeholder-only            | debounce? none found      | n/a                  | —                       | D                       |
| Feature-flags A/B                            | uncontrolled inputs         | **no submit handler**     | dead button          | —                       | F                       |

Systemic: no `aria-invalid`/`aria-describedby` wiring anywhere live;
unsaved-changes protection absent on all forms; no field persistence beyond
browser defaults.

---

# Data-Dense UI Audit

- **Files:** server-paginated (25/page), filters, accessible dropzone, mobile
  card fallback — strongest surface. No virtualization needed at this page size.
- **History:** three feeds fetched fully then client-paginated at 15/page —
  DOM-safe, but entire dataset held in memory and re-sliced per render; JSON
  export mitigates scale concerns short-term.
- **Chat:** transcript rendered unvirtualized and unbounded during streaming
  (`ChatWindow.tsx:994`) — will degrade on long sessions.
- **Tables:** shared Table wraps overflow-x-auto; admin audit log paginates
  client-side at pageSize=3 (oddly small); th scope present everywhere; zero
  captions.
- **Kanban (applications):** fetch loop pages through all applications then
  groups client-side — fine at MVP volume, unbounded later.
- **Graph:** viewport culling >80 nodes, decluttered labels, zoom HUD —
  genuinely thoughtful for hand-rolled SVG; no force-directed layout (circular
  only), edges to culled nodes drop silently.

---

# Search Audit

| Surface                | Input            | Debounce   | Empty | Filters             | URL/state persistence | Verdict          |
| ---------------------- | ---------------- | ---------- | ----- | ------------------- | --------------------- | ---------------- |
| Files search           | labeled-ish      | none found | ✓     | type/archive ✓      | ✗                     | C                |
| History search         | unnamed          | none       | ✓     | date range ✓        | ✗                     | D                |
| Jobs search            | placeholder-only | none       | ✓     | location/remote ✓   | ✗                     | C                |
| Agents filter          | ✓                | none       | msg ✓ | category ✓          | ✗                     | B−               |
| Graph node filter      | unlabeled        | none       | ✓     | type select unnamed | ✗                     | D                |
| TopNav command palette | autofocus ✓      | instant    | ✓     | navigational        | ✗                     | B (not a dialog) |

No search experience persists query/filter state to the URL — deep-linking and
back-button behavior are lost everywhere. No recent-searches, no result
highlighting, no keyboard result navigation outside the palette.

---

# Error Handling Audit

Every user-facing error should answer: what happened / data safe / what now /
retry / recover / debug info. Scoring the app:

- **What happened:** usually a message string from ApiError (backend envelope
  preferred) — decent.
- **Data safe:** almost never communicated explicitly.
- **What now:** retry button common (ErrorState) — good; but retry style splits
  between SWR mutate (correct) and full-page reload (dashboard/history/agents)
  which loses scroll/state.
- **Recover:** refresh-failure path hard-redirects to `/login` destroying
  context instead of the purpose-built `/session-expired`.
- **Debug info:** correlation IDs never sent; console stripped in production
  builds (`removeConsole` without exclude) so even dev-visible diagnostics
  vanish for users.
- **Network-layer masking:** rate-limited/error responses appear as CORS policy
  violations in console (observed live on scheduler/jobs ×20, consent/me ×22
  during sweep) — users see nothing or a generic failure; support cannot triage.
- Unhandled promise rejections: notifications approve/reject has no try/catch;
  fire-and-forget agent-rename call swallows failures while UI copy claims an
  approval record was created.

---

# Loading / Empty State Audit

- Three loading idioms coexist (spinner/skeleton/text); skeletons used where
  structure is known (dashboard/agents/settings) — right instinct, inconsistent
  application.
- Generic "Loading…" text remains on
  resume/chat/marketplace/orgs/dev/flags/admin where meaningful progress is
  possible.
- Empty states: shared component with title/description/action; action omitted
  by many callers (resume/jobs/approvals/applications/files). Dashboard's inline
  next-action links are the standard to replicate.
- Streaming surfaces show phase labels (intent/plan/act/token) — genuinely good
  progress representation.
- No queued/partial-success itemized-retry patterns anywhere (hardened spec §9.2
  requires them for batch operations).

---

# AI / Agent UX Audit

Against the hardened-spec approval-diff invariant (agent, exact action,
resource, before/after, reason, evidence, confidence, side effects,
reversibility, expiry, payload version, approve/reject/edit):

| Invariant element                                   | ApprovalCard                                                         | ChatWindow proposals                      | Verdict         |
| --------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- | --------------- |
| Agent identity                                      | ✓                                                                    | agent dot+name ✓                          | Pass            |
| Exact action + resource                             | ✓                                                                    | ✓                                         | Pass            |
| Before/after diff                                   | extracted old/new paths ✓                                            | partial                                   | Partial         |
| Reason/evidence/provenance                          | ProvenanceBadge ✓                                                    | citations fall back to `href="#"` ⚠       | Partial         |
| Confidence                                          | ConfidenceMeter ✓ but **seeded 0.98 when agent picked** (fabricated) | same                                      | **Fail (F-02)** |
| Side effects / scopes                               | scopes shown ✓                                                       | ✓                                         | Pass            |
| Reversibility                                       | ✗ never shown                                                        | ✗                                         | Fail            |
| Expiry                                              | ExpiryTimer countdown ✓                                              | ✓                                         | Pass            |
| Payload version                                     | ✗                                                                    | ✗                                         | Fail            |
| Approve/reject/edit                                 | approve/reject ✓; **edit never offered**                             | same                                      | Partial         |
| State clarity (proposed≠completed)                  | status tabs incl. Expired ✓; resolved cards disable ✓                | pending/approved/rejected/expired/error ✓ | Pass            |
| EU AI Act Art.50 disclosure ("chatting with an AI") | ✗ absent                                                             | ✗ absent                                  | **Fail**        |

Also: tool execution latencies are constants (210/170/280/120ms) presented as
measurements; blocking-path tools fabricated from response shape. The UI
_structure_ for trustworthy agent UX largely exists — the _data honesty_ does
not.

---

# Security-Sensitive UI Audit

- **Permission prompts/scopes:** connectors pre-consent scope modal ✓; approval
  cards show scopes ✓.
- **Autonomy controls:** settings exposes per-agent autonomy select — but
  vocabulary mismatches backend/docs (`read_only/approval_gated/full` vs
  documented `suggest`) creating real configuration ambiguity.
- **Destructive actions:** GDPR delete uses typed confirmation ✓ (best
  practice); connector revoke/webhook delete confirmed ✓; BYOK delete uses
  native confirm (off-pattern); archive soft-delete reversible ✓.
- **Authorization-aware UI:** enterprise nav hidden via build-time env gate;
  gated pages render contact-sales screens on 403/404 ✓ — but three of them gate
  on endpoints that don't exist, so "permission denied" is indistinguishable
  from "broken".
- **Session state:** middleware cookie presence-check is UX gating only
  (documented); token in JS-readable cookie is an accepted trade-off but should
  be HttpOnly-backed long-term.
- **Misrepresentation risks (P0 cluster):** fake admin Quick Action successes,
  fictional payment method, fabricated ATS/confidence/latency — the UI asserts
  system actions that did not occur. In an agent product this is the single most
  dangerous UI defect class.

---

# Frontend Architecture Audit

**KEEP (do not churn):**

- Single transport pipeline (`api.ts`) with refresh queue + CSRF retry — correct
  and battle-tested shape; `api-client.ts` correctly delegates to it.
- 26 typed domain namespaces — right direction; legacy flat bag should be
  retired incrementally, not rewritten.
- Lazy chunks for the three heavy surfaces (chat/graph/resume) via
  `dynamic-imports.tsx`.
- Zero heavyweight third-party dependencies — a strategic asset; do not
  introduce chart/calendar/graph libraries without strong justification.

**Structural problems:**

1. **Dead subsystems masquerade as architecture:** entire `src/store/` (zustand
   — an unused runtime dependency), `lib/swr-client.ts` (intended SWR policy not
   in effect anywhere), `lib/batch.tsx`, client feature-flags system, i18n
   translations, `useSSE`. ~1,200+ lines of maintained-but-unreachable code that
   will mislead every future contributor.
2. **Dual API surfaces with overlap** (billing implemented twice at `api.ts:365`
   and `billingApi:1628`; settings still calls legacy `api.me()`).
3. **Asymmetric key transform:** responses camelized, request bodies snake_case
   by hand (`workspace_id`, `source_type`) — every new namespace must replicate
   this by convention; no compile-time guard.
4. **Auth state is hook-per-consumer** — no context/store; direct cause of
   duplicate `/auth/me` fetches and divergent session views.
5. **Two unrelated feature-flag systems** (client runtime cache + build-time env
   gate) plus admin UI talking to a third (backend endpoint).
6. React components living in `lib/*.tsx`; two exported symbols named
   `ConfirmDialog`; `isEnterpriseEnabled` defined twice.
7. Security headers defined twice verbatim (middleware.ts ≡ next.config.js) —
   drift risk already realized (CSP allows `unsafe-inline`/`unsafe-eval`
   scripts).

---

# Next.js / Framework Audit

- **App Router used correctly structurally** (layouts, route groups, per-segment
  loading/error/not-found) — but only 4 leaf pages are Server Components; the
  marketing landing page is fully client-rendered with an effect-driven auth
  probe, so it can't be statically optimized and ships the whole client runtime
  to anonymous visitors.
- **No page-level metadata anywhere** → every route shares root
  title/description; SEO impossible beyond `/`, `/login`, `/signup` (the only
  sitemap entries).
- No `viewport` export (default injected — pinch-zoom preserved, acceptable);
  theme-color hardcoded, matches no token.
- robots.txt exists BOTH as static file and `robots.ts` route (conflict risk);
  og-image referenced in metadata but missing from public/.
- Images: exactly 1 `next/image` usage (Avatar); 2 raw `<img>`; no image-heavy
  surfaces today — fine.
- Fonts: `next/font/google` Space Grotesk (variable) + IBM Plex Mono
  400/500/600, self-hosted, swap — correct strategy; dead `--font-inter` token
  in config.
- Middleware matcher excludes static assets; PUBLIC_PATHS list is
  documentation-only (dead `isPublicExact` logic).
- Prefetching: PrefetchProvider mounted but `prefetchWorkspaceRoutes` is dead
  code; Link prefetch defaults active otherwise.
- `output:'standalone'` gated behind CI && non-Windows — local builds
  unaffected; `removeConsole` strips ALL console methods in production including
  errors/warns (observability defect F-14).

---

# Performance Baseline

Measured this audit (production build, local, Windows; `next build --no-lint`
because default build fails lint — see F-04):

| Metric                            | Value                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Build time                        | 177.9s (failed at lint after 39.7s compile) / 129.4s clean with --no-lint                |
| Shared First Load JS (all routes) | **103 kB** (46 kB + 54.2 kB framework chunks + 2.77 kB other)                            |
| Heaviest route First Load JS      | memory **122 kB** (10.1 kB page) · history/settings 121 kB · dashboard/approvals 120 kB  |
| Lightest routes                   | chat/resume **105 kB** (lazy chunks working: 1.67 kB pages)                              |
| Middleware bundle                 | 32.7 kB                                                                                  |
| Largest on-disk chunks            | react-dom/next framework pair @169 kB each (pre-gzip), main-app 117 kB, polyfills 110 kB |
| ANALYZE treemaps                  | generated to `.next/analyze/{client,nodejs,edge}.html` (566/622/294 KB artifacts)        |

## Matrix E — Performance Matrix

| Route           |    JS (page) | Network                                | Render                   | LCP          | INP          | CLS          | Main Problem                                 |
| --------------- | -----------: | -------------------------------------- | ------------------------ | ------------ | ------------ | ------------ | -------------------------------------------- |
| Shared baseline |  103 kB FLJS | —                                      | —                        | NOT MEASURED | NOT MEASURED | NOT MEASURED | refetch-on-focus storms (F-15)               |
| Landing `/`     |      5.07 kB | auth probe ×2 sequential               | client-rendered          | "            | "            | "            | not statically renderable                    |
| Dashboard       |       4.1 kB | **6 sources incl. duplicate /auth/me** | skeleton ✓               | "            | "            | "            | reload-retry; feed-window-derived growth %   |
| Chat            | 1.67 kB lazy | SSE ✓                                  | unvirtualized transcript | "            | "            | "            | no cancel; fabricated telemetry              |
| Memory          |      10.1 kB | graph nodes fetched unscoped           | culling ✓                | "            | "            | "            | heaviest route                               |
| History         |      8.46 kB | full datasets in memory                | client pagination        | "            | "            | "            | table overflow wrapper missing               |
| Settings        |      8.81 kB | many keys + legacy me()                | skeleton ✓               | "            | "            | "            | most SWR keys; CORS-masked failures observed |

Dev-server navigation timing (lab, dev-mode, indicative only): first-hit
workspace routes 1.9–3.0s TTFB (compile variance), warm routes 170–300ms TTFB /
730–1000ms load. Production CWV: NOT MEASURED.

---

# Rendering Performance Audit

- No virtualization library present; largest exposure is chat transcript during
  streaming.
- `useAuth` returns a fresh object every render (no memoization) and each
  consumer independently fetches — rerender + network amplification combined.
- Context providers: Toast memoized (positive); Theme/Keyboard providers stable;
  no evidence of expensive context propagation hot paths.
- Expensive derived state: dashboard growth % computed from a 30-item feed
  window (misleading rather than slow).
- Keyboard listener churn noted in shortcuts provider (re-registers per
  consumer) — minor.
- GraphViewer pan uses rAF throttling with reduced-motion damping — good.

---

# Network Performance Audit

1. **SWR library defaults govern all ~14 raw call sites** (no `<SWRConfig>`,
   `swr-client.ts` dead): `revalidateOnFocus=true`, dedupe 2s. Live consequence
   observed: window-focus refetch storms amplified rate-limited endpoints into
   repeated CORS-blocked console errors (jobs ×20, settings ×22 within one
   sweep).
2. **Duplicate identical requests:** `/auth/me` fires from workspace layout AND
   TopNav (parallel) + settings third key + landing fourth — 2–4× per screen
   load.
3. Sequential awaits where parallel possible: landing probe
   (`page.tsx:118→124`).
4. Polling: status page 30s (orphaned route anyway); ExpiryTimer 1s tick (fine).
5. CSRF token fetch is module-cached + inflight-deduped — positive.
6. Request cancellation: AbortController exists in useApi and ChatWindow
   internals; no user-facing cancel.
7. No WebSocket/SSE lifecycle issues found (useSSE is dead; chat SSE handled
   inside ChatWindow).

---

# Asset Performance Audit

- public/ is tiny (largest icon 4 KB) — no payload risk.
- Fonts self-hosted via next/font with subsets — correct; IBM Plex Mono 600
  possibly unused (NOT MEASURED).
- Icons are inline SVG (Sidebar carries ~420 lines of path data inside the
  component file) — fine at current scale, bloats the layout chunk; no icon
  library dependency (consistent with zero-deps posture).
- No video/large media. No third-party scripts at all — notable positive for
  both perf and privacy.

---

# Testing Audit

Executed live: `pnpm test` → **7 suites / 34 tests, all pass** (Toast, Modal,
ApprovalCard, Sidebar, connectors page, useWorkspace hooks, a11y shell).

| Layer               | State                                                                                                                                                                                                                                                                    | Evidence                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Unit/component      | 34 passing tests covering ~7 of 104 source files                                                                                                                                                                                                                         | jest run above                 |
| A11y automation     | **Tautological** — renders a synthetic SmokeShell fixture, never a real component; silently degrades if jest-axe absent                                                                                                                                                  | `__tests__/a11y.test.tsx:9-31` |
| Build gate          | **Test fixture breaks production builds** (no-html-link-for-pages errors from fixture's `<a>` tags; missing rule def in web-vitals.ts)                                                                                                                                   | build-output.txt               |
| E2E                 | Two disconnected locations: `apps/web/e2e/basic-smoke.spec.ts` (8 tests, plausible) + stale `testing/e2e/tests/flows` asserting old UI (`/log in/i` vs actual "Sign in") that would fail today; **neither wired to any CI workflow** (verified against all 10 workflows) | e2e dirs, .github/workflows    |
| Visual regression   | None                                                                                                                                                                                                                                                                     | —                              |
| Responsive/a11y e2e | None exist (this audit's sweep is the first such data)                                                                                                                                                                                                                   | sweep-results.json             |
| Perf regression     | None                                                                                                                                                                                                                                                                     | —                              |

Untested critical flows: login submit, signup, chat streaming, approvals decide,
resume generate, connector connect, settings GDPR delete, files
upload/rename/undo.

---

# Observability Audit

- `ErrorTracker` façade is console-only by design ("no fake Sentry"); DSN env
  var read then ignored (placebo).
- **Route-level `error.tsx` files report nothing** — zero `captureError` calls
  outside the root boundary; `digest` unused. Most user-visible crashes are
  dark.
- Workspace ErrorBoundary logs via stripped-in-prod console only.
- No `window.onerror`/`unhandledrejection` handlers — fire-and-forget rejections
  invisible everywhere.
- Web Vitals collected every page but transmitted nowhere (beacon endpoint
  unset; console.info stripped in prod).
- **Zero correlation IDs** sent to API (headers limited to
  Content-Type/X-Requested-With/Authorization/X-CSRF-Token) — frontend requests
  cannot be joined with backend OTel traces.
- User identity never attached to errors (`ErrorTracker.setUser` never called).
- Positive: single façade means real SDK adoption is a contained swap once
  decision made.

---

# Documentation vs Implementation Gap

### DOCUMENTED BUT NOT IMPLEMENTED

- Dedicated onboarding flow with initial scan/import summary before organizing
  actions (FR-01..FR-05, §4.1)
- OAuth callback surface (implied by SSO/OAuth docs; route absent)
- Permission-denied states offering safe grant paths (hardened §9.2)
- Batch-approve for organization proposals (FR-12)
- Edit option within approvals ("approve, reject, and edit where safe")
- Reversibility/side-effects/payload-version fields on approval diffs
- EU AI Act Art.50 persistent AI disclosure
- Resume master editor with manual save/versioning (§4.5-4.6 promises editor;
  none exists)
- Providers page (named in §4.8, absent from sitemap and implementation)

### IMPLEMENTED BUT NOT DOCUMENTED

- Approvals page + ApprovalCard system (added post-P09 fix; now core trust
  surface)
- Notifications center w/ delivery-status table; developer/webhooks CRUD (real
  backend router)
- Status/forbidden/session-expired pages (orphaned, undocumented)
- Command palette, keyboard shortcut system, skip link

### PARTIALLY IMPLEMENTED

- Suggest-mode-first loop: propose/approve works for agent actions &
  schedule-with-id & renames-via-agent; violated by direct rename path,
  marketplace installs, feature-flag toggles, schedule approve-without-id
- Memory confidence labeling (meter exists; defaults fabricated 0.85/0.98)
- History undo (documents only, not agent actions)
- Export (files JSON export ✓; resume JSON-only; no PDF/DOCX despite
  ATS/template docs)

### CONFLICTING (not resolved here)

- AGENTS.md claims vs verified reality: "16 real/7 mock" (actual
  23/5/3-worse-than-mock); "light/dark mode DONE" (non-functional); "39 e2e
  real" (stale + unwired); OpenAPI 99 paths vs 3 frontend-called endpoints
  missing server-side
- Page-list drift across MVP spec §4.8/§10, Complete Doc §8, enterprise paper
  §17, P09 IA (23 pages), and current 34 routes
- Autonomy vocabulary (`suggest` vs `read_only`)
- WCAG 2.1 vs hardened 2.2 AA (2.2 governs)
- Enterprise pages posture: spec says out-of-scope-absent; implementation ships
  visible-gated; three are broken-behind-gate

### UNCLEAR / REQUIRES PRODUCT DECISION

- localStorage-only surfaces (saved jobs, reminders, chat threads) vs
  Working-memory/session semantics
- Direct file rename with silent agent side-proposal vs strict FR-12 diff gating
- Whether enterprise mock pages should be deleted, stubbed honestly, or
  completed

---

# MVP Gap Analysis

Canonical MVP sitemap (10 pages) is **fully covered** by implemented routes,
plus justified secondary surfaces (approvals, notifications, applications,
agents). Gap analysis against MVP _behavioral_ requirements:

| MVP requirement                                     | Status                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Auth (email + SSO-if-configured)                    | Email ✅ / SSO broken (P0)                                                            |
| Isolated workspace provisioning                     | ✅ live-verified                                                                      |
| Connector setup with scoped grants                  | Partial (scopes shown; OAuth happy path broken; health states partial)                |
| Initial scan → "here's what I found" summary        | ❌ missing (F-18)                                                                     |
| Propose/approve with diff, batch-approve            | Partial (diff ✓ batch ✗ edit ✗)                                                       |
| Archive-not-delete + undo logging                   | ✅ files / partial elsewhere                                                          |
| Memory graph navigable + corrections                | ✅ (strong)                                                                           |
| Resume master + ATS + variants linked               | Partial (gen/diff/export ✓; editor ✗; honest scores ✗)                                |
| Jobs shortlist → tailored → approve → deep-link     | Partial (apply linkage invisible; saved jobs local)                                   |
| Application tracking w/ outcomes                    | Partial (outcome dropped — P0 data loss)                                              |
| Schedule unified calendar + extracted deadlines     | Partial (create/approve; Gmail-extracted display path thin; conflicts heuristic only) |
| History audit log + undo where reversible           | ✅ documents / partial agent actions                                                  |
| Settings permissions/autonomy/privacy/export/delete | ✅ (vocabulary mismatch)                                                              |
| Suggest-mode-first honesty                          | **Violated by fabrication cluster (P0)**                                              |

---

# Enterprise Hardening Gap Analysis

Frontend-relevant enterprise items (classification per §34): RBAC-aware UI
(currently env-flag only), org management UI (backend absent), audit-log depth
in admin (real query exists, pageSize=3 oddity), SSO admin config UI, billing
integration (fictional today), webhook platform (actually real — bright spot),
feature-flag governance (broken), API-key lifecycle UI (fake), SOC2-style audit
export (JSON export exists per-surface, no unified compliance view). These are
ENTERPRISE HARDENING class — explicitly not MVP blockers except where they
misrepresent state (billing card, quick actions) which IS an MVP-trust problem.

---

# Positive Findings

1. **Lean dependency discipline** — only next/react/swr (+dead zustand); no
   chart/calendar/icon/form libraries; total shared JS 103 kB.
2. **Correct code-splitting** of the three heavy surfaces; middleware compact at
   32.7 kB.
3. **Single well-designed transport pipeline** — refresh single-flight queue,
   CSRF retry-once, typed ApiError surfaced consistently.
4. **Files page is genuinely enterprise-quality** — upload phases with retry,
   diff-preview rename, archive/restore, per-file undo, accessible dropzone,
   mobile card fallback.
5. **Real streaming chat** with phase events, wired approvals, thread
   persistence, slash/@ palettes.
6. **Hand-rolled SVG memory graph** with viewport culling, keyboard nodes, touch
   support, reduced-motion damping, list-mode fallback — no library needed.
7. **Auth forms follow best practice** (labels, autocomplete, inline validation,
   disabled+spinner submits).
8. **Empty states mostly explain + offer action**; dashboard partial-data
   degradation is honest.
9. **Drawer-based responsive shell** with inert content, auto-close on
   navigation, scrim.
10. **Reduced-motion respected globally**; skip link functional; Tabs
    roving-tabindex exemplary; ui-kit Modal focus management best-in-class (once
    backdrop purge fixed).
11. **GDPR delete uses typed confirmation**; consent toggles labeled and wired
    to live API.
12. **Honest copy in several failure paths** (SSO not-configured toast,
    forgot-password 404 candor, schedule local-approve disclosure).

---

# Critical Findings (P0/P1 summary)

| ID   | Title                                                                                                                                                    | Sev    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| F-01 | OAuth callback route missing — SSO login & connector connect dead-end at 404                                                                             | **P0** |
| F-02 | Fabricated telemetry presented as system fact (ATS scores, chat latency/confidence, admin quick actions, billing card)                                   | **P0** |
| F-03 | Silent data loss through UI (application outcome dropped; installs/toggles/approves local-only)                                                          | **P0** |
| F-04 | Production build fails on lint gate (test fixture + missing rule def)                                                                                    | **P0** |
| F-05 | Three enterprise pages call non-existent backend endpoints                                                                                               | P1     |
| F-06 | ui-kit Tailwind classes purged — Modal renders without scrim on 13 screens; button states broken                                                         | P1     |
| F-07 | Dark/light theming non-functional; ThemeToggle dead; AGENTS.md claim false                                                                               | P1     |
| F-08 | Nested duplicate `<main id="main-content">` on all workspace pages (+3 more pages)                                                                       | P1     |
| F-09 | Heading hierarchy epidemic (2× h1 everywhere via Sidebar; h1=0 on 4+ routes)                                                                             | P1     |
| F-10 | 132 measured color-contrast violations across 14 routes                                                                                                  | P1     |
| F-11 | Unnamed form controls (history dates, schedule/graph selects, jobs search) — axe critical                                                                | P1     |
| F-12 | ConfirmDialog lacks trap/aria-modal; Enter-on-container confirms; native confirm()/alert() outliers                                                      | P1     |
| F-13 | Mobile drawer not Escape-closable; no focus trap inside drawer                                                                                           | P1     |
| F-14 | Production diagnostics stripped: removeConsole kills errors; route error.tsx report nothing; no global handlers; Sentry placebo; web-vitals beacon unset | P1     |
| F-15 | SWR defaults active (no SWRConfig) — refetch-on-focus storms amplified into CORS-masked failures                                                         | P1     |

Full register (P0–P3, 30 consolidated root issues) follows.

---

# Prioritized Finding Register

Format per §36, condensed. Status ∈ {VERIFIED-LIVE (reproduced this audit),
VERIFIED-STATIC (code evidence), PARTIAL}.

### [F-01] Missing /auth/callback route breaks all real OAuth

- Category: Functional · Severity: **P0 BLOCKER** · Scope: auth+connectors ·
  Route: `/auth/callback` · Component: login page, connectors page · MVP/Ent:
  **MVP REQUIRED** · Status: **VERIFIED-LIVE** (404 reproduced)
- Evidence: `login/page.tsx:27`, `connectors/page.tsx:90` build
  `origin + "/auth/callback"`; no such directory under src/app; live sweep:
  status 404 "Page not found".
- Current: Google/Microsoft SSO round-trip and connector provider consent land
  on 404. Expected: callback handler exchanges code/state, routes to
  workspace/connector list.
- Impact: every OAuth happy path broken; only legacy integration-create fallback
  works for connectors. Root cause: route never implemented.
- Confidence: certain. Direction: implement `/auth/callback` handling both
  auth-code (login) and connector-install modes.
- Verification: E2E OAuth against stubbed provider; regression risk low.

### [F-02] Fabricated telemetry displayed as fact

- Category: Security-sensitive UX / Trust · Severity: **P0 BLOCKER** · MVP:
  **MVP REQUIRED (violates suggest-mode-first)** · Status: VERIFIED-STATIC
- Evidence: ATS fallback `Math.round(70+Math.random()*20)` and error-path "ATS
  (fallback)" random score (`ResumeBuilder.tsx:132-138`); chat latency random
  (`ChatWindow.tsx:745,788`); seeded confidence 0.98 (`:565,579`); constant tool
  latencies (`:125-126,631`); admin Quick Actions toast success without API
  calls (`admin/page.tsx:148-151,297-311`); hardcoded uptimes 99.99%
  (`:98,104,110`); billing fictional Visa 4242 + stub modal
  (`billing/page.tsx:250-268,330-332`); marketplace zeroed ratings shown as
  metrics (`:47-49,174-179`).
- Expected: show nothing, "unavailable", or honest placeholders; never invent
  measurements. Impact: user decisions (send resume!) driven by invented
  numbers; violates hardened §9.3 invariant.
- Root cause: placeholder scaffolding promoted to visible UI. Confidence:
  certain. Direction: strip or gate behind explicit "demo data" labels; wire to
  real endpoints where they exist.
- Regression risk: low removal risk; product copy review needed.

### [F-03] Silent data loss through UI

- Category: Functional/data integrity · Severity: **P0 BLOCKER** · MVP: REQUIRED
  · Status: VERIFIED-STATIC
- Evidence: outcome select collected but never sent — body `{status}` only
  (`applications/page.tsx:64,96,103` vs `286-299`); marketplace toggleInstall
  flips local array only (`marketplace/page.tsx:104-106`); feature-flag
  toggles/rollout local-only (`feature-flags/page.tsx:87-103`); schedule
  approve-without-id flips local state (`schedule/page.tsx:231-251`); invite
  member modal performs no call (`organizations/page.tsx:273-280`).
- Impact: users believe state persisted; refresh loses it (marketplace) or
  outcomes never influence future ranking (spec §4.10 requires outcomes feed
  ranking). Root cause: UI-first scaffolding without API wiring.
- Confidence: certain. Direction: wire or remove; add optimistic-update rules
  per P09 §4 (never optimistic for these classes).

### [F-04] Production build fails at lint gate

- Category: Build/CI · Severity: **P0 BLOCKER** (blocks deploys) · Status:
  VERIFIED-LIVE
- Evidence: measured run: compile OK 39.7s → ESLint fails: 5×
  `no-html-link-for-pages` from test fixture `<a>` tags
  (`__tests__/a11y.test.tsx:14-15`) + missing rule def
  `@typescript-eslint/no-var-requires` (`lib/web-vitals.ts:37`) + warnings
  (exhaustive-deps history:119; no-console web-vitals:15; img fixture:26). Exit
  code 1; succeeds only via `--no-lint`.
- Impact: CI frontend workflow runs build+lint → red pipeline; nobody can ship.
  Root cause: lint config excludes not applied to tests; stale rule reference.
- Direction: exclude tests from page-rule linting or fix fixture to use Link;
  define/remove stale rule. Verification: green `pnpm build`. Risk: trivial.

### [F-05] Enterprise pages call non-existent endpoints

- Category: Functional · Severity: P1 · MVP/Ent: Enterprise · Status:
  VERIFIED-STATIC
- Evidence: GET `/iam/organizations` (`organizations/page.tsx:104-108`),
  `/api-keys` (`developer/page.tsx:51`), `/feature-flags`
  (`feature-flags/page.tsx:67`) — none mounted in
  `apps/api/src/api/main.py:230-266`.
- Impact: with enterprise enabled, three pages permanently show generic error
  screens; permission-denied indistinguishable from broken. Direction: either
  implement routers or convert pages to honest "not available" states.

### [F-06] Tailwind purge removes ui-kit-only classes

- Category: Design system/build · Severity: P1 · Status: VERIFIED-STATIC
  (cross-grep)
- Evidence: content globs omit `packages/ui-kit/**`; purged: Modal backdrop
  `bg-black/60`, `hover:bg-surface-active`, `active:bg-primary-active`,
  `focus:ring-border`, `mx-4`.
- Impact: dialogs float with no scrim (13 screens); secondary buttons lose
  hover; focus rings default blue off-theme. Direction: add glob (or safelist);
  verify computed styles post-fix.

### [F-07] Theming non-functional

- Category: Design system · Severity: P1 · Status: VERIFIED-STATIC
- Evidence: `.light` toggled by dead ThemeToggle (`ThemeToggle.tsx` zero
  importers; `useTheme.tsx:24-29`); `l-*` palette zero usages; only 9 `dark:`
  utilities in 4 files.
- Impact: shipped "light mode" claim false; users cannot switch; partial dark:
  utilities would mis-flip if class ever changed. Direction: decide — either
  delete scaffolding or complete dual-token implementation; update AGENTS.md
  honestly either way.

### [F-08] Nested duplicate main landmarks

- Category: A11y semantics · Severity: P1 · Status: VERIFIED-LIVE (axe ×14
  routes)
- Evidence: root `layout.tsx:119` + workspace `layout.tsx:64-65` both
  `<main id="main-content">`; extra empty-id mains on terms/privacy/login.
- Impact: invalid HTML, duplicate ids, ambiguous skip target, axe landmark
  violations on every authenticated route. Direction: demote inner wrapper to
  div; single main landmark.

### [F-09] Heading hierarchy epidemic

- Category: A11y semantics · Severity: P1 · Status: VERIFIED-LIVE
- Evidence: Sidebar `<h1>Vaeloom</h1>` (`Sidebar.tsx:481`) + page h1s → 2 h1s
  everywhere; h1=0 on login/signup/verify-email/status/chat; skip levels
  dashboard/agents (census table above).
- Impact: SR navigation by headings unreliable. Direction: sidebar logo→div;
  enforce one h1 per page; add headings to headingless screens.

### [F-10] Contrast failures (132 measured)

- Category: A11y visual · Severity: P1 · Status: VERIFIED-LIVE (axe serious)
- Evidence: light-mode badge palettes on dark theme (amber-700 3.96:1,
  emerald-700 3.63:1, red-600 4.12:1) across ≥9 files; placeholder/dim pairs
  failing; correct pattern exists in agents page but unused elsewhere.
- Direction: adopt semantic success/warning/error tokens + dark: variants;
  re-run axe.

### [F-11] Unnamed form controls

- Category: A11y forms · Severity: P1 · Status: VERIFIED-LIVE (axe critical
  label/select-name)
- Evidence: history date inputs unnamed (`history/page.tsx:236-246`); schedule
  selects (`:353-370`); GraphViewer filter/select (`GraphViewer.tsx:235-252`);
  jobs search placeholder-only.
- Direction: aria-label/htmlFor pass; adopt dead shared Select/Input components
  instead.

### [F-12] Confirmation dialog weaknesses

- Category: A11y interaction · Severity: P1 · Status: VERIFIED-STATIC
- Evidence: ConfirmDialog no trap/no restore/no aria-modal;
  Enter-on-container=Confirm (`ConfirmDialog.tsx:46-48`); static IDs collide;
  native confirm() BYOK (`ProviderKeysSection.tsx:115`); alert() errors in
  webhooks (4 sites).
- Direction: reuse ui-kit Modal primitives inside ConfirmDialog; ban native
  dialogs.

### [F-13] Mobile drawer keyboard gaps

- Category: A11y/responsive · Severity: P1 · Status: VERIFIED-LIVE (Escape
  tested, does not close)
- Evidence: no Escape handler in Sidebar/workspace layout; inert applied to
  inner main only.
- Direction: Esc closes + focus sent back to hamburger; trap within drawer while
  open.

### [F-14] Observability dark in production

- Category: Observability · Severity: P1 · Status: VERIFIED-STATIC
- Evidence: `removeConsole:true` strips errors too (`next.config.js:16-18`);
  error.tsx files never captureError; no window handlers; DSN placebo; vitals
  beacon unset; no correlation IDs (headers enumerated api.ts:114-118).
- Direction: exclude ['error','warn']; captureError in 3 route boundaries +
  workspace boundary; add X-Request-ID middleware; decide SDK later.

### [F-15] SWR policy absent at runtime

- Category: Network perf · Severity: P1 · Status: VERIFIED-LIVE (refetch
  amplification observed)
- Evidence: no SWRConfig mounted; swr-client.ts zero importers; defaults
  refetchOnFocus=true dedupe 2s over ~14 raw sites; sweep captured 20-42
  repeated failures per heavy page after rate-limit/CORS-masked responses.
- Direction: mount SWRConfig (dedupe 5s, revalidateOnFocus:false) matching the
  intended-but-dead swr-client policy.

### [F-16] /auth/me fetched 2–4× per screen load

- Category: Network perf · Severity: P2 · Status: VERIFIED-STATIC
- Evidence: `useAuth` hook-per-consumer (`hooks/useAuth.ts:30-74`) fires
  api.me() in workspace layout AND TopNav; settings adds third via SWR key
  `'auth-me'` (`settings/page.tsx:33`); landing fourth (`page.tsx:118`).
  Different cache keys defeat dedupe.
- Direction: hoist to single AuthProvider context (also fixes unstable return
  object).

### [F-17] API failures surface as CORS violations

- Category: Error handling · Severity: P2 · Status: VERIFIED-LIVE
- Evidence: console during sweep — scheduler/jobs ×20, consent/me ×22 "blocked
  by CORS policy" while other endpoints succeeded; consistent with non-2xx
  responses bypassing CORS header injection (middleware ordering) or rate-limit
  responses lacking headers.
- Impact: users get generic failures; support cannot triage; console noise masks
  real errors. Direction: backend ensure CORS headers on error paths; frontend
  surface status codes.

### [F-18] Onboarding can never complete; no onboarding route

- Category: UX/MVP · Severity: P1 · MVP: REQUIRED (FR-01..05) · Status:
  VERIFIED-STATIC
- Evidence: two steps hardcode done:false forever ("Connect Gmail or Drive",
  "Run your first agent", `OnboardingChecklist.tsx:24-41`); step 1 targets
  nonexistent `/workspaces` (:20); '#' fallbacks; no `/onboarding` route; no
  initial-scan summary step anywhere.
- Impact: permanent 3/4-progress nag undermines trust in progress indicators.
  Direction: wire real completion signals; add scan-summary flow or descope
  honestly.

### [F-19] Chat stream not cancellable

- Category: UX · Severity: P2 · Status: VERIFIED-STATIC
- Evidence: AbortController created and abort handled
  (`ChatWindow.tsx:582,751,769-773`) but no Stop button rendered anywhere.
- Direction: expose Stop during streaming; also thread delete/rename absent.

### [F-20] Resume page promises an editor that doesn't exist

- Category: Product completeness · Severity: P2 · MVP: REQUIRED behavior ·
  Status: VERIFIED-STATIC
- Evidence: header copy "Edit your master resume" (`ResumeBuilder.tsx:167,209`)
  with no editor/manual save/versioning controls; export JSON-only; EmptyState
  lacks action.
- Direction: either build minimal editor or fix copy + provide PDF/DOCX export
  decision.

### [F-21] Dead code mass

- Category: Architecture/code quality · Severity: P2 · Status: VERIFIED-STATIC
  (grep)
- Evidence: 17 dead shared components; src/store entirely dead (zustand unused
  dep); lib/batch.tsx; swr-client.ts; client feature-flag system; i18n
  translations file; useSSE; prefetchWorkspaceRoutes; ThemeToggle; Grid
  gap-interpolation bug latent inside it.
- Impact: ~1,200+ unreachable lines mislead contributors; bundle/test surface
  bloat. Direction: delete in Wave 02 after consumers confirmed.

### [F-22] Design-system fragmentation census

- Category: Design system · Severity: P2 · Status: VERIFIED-STATIC
- Evidence: 4 button systems · 6 overlays · 4 loading idioms · 3 card systems ·
  3 error-display idioms · 445 raw-palette usages · 7-step radius spread · 4
  overlay elevations · nonexistent tokens shipped (text-surface-500/900).
- Direction: consolidate in Waves 04–05; adopt semantic tokens for status colors
  first.

### [F-23] Page-title scale chaos

- Category: UI consistency · Severity: P3 · Status: VERIFIED-STATIC
- Evidence: same route renders text-2xl vs text-3xl per state branch
  (billing:169/185, admin:195/220, developer:83/172, marketplace:82/112,
  flags:119/133, orgs:143/158); ChatWindow h1 text-sm (:895); purpose-built
  PageHeader dead.
- Direction: single PageHeader primitive (already written — revive).

### [F-24] Responsive defects (specific)

- Category: Responsive · Severity: P2 · Status: VERIFIED-LIVE
- Evidence: reset-password orb overX=250 at every viewport (parent lacks
  overflow-hidden, :234); schedule grid-cols-7 ~45px cells @320;
  feature-flags/orgs unprefixed grid-cols-4; history notifications table no
  scroll wrapper (:498); chat drawer overlap @375 (screenshot); shortcuts modal
  edge-touch <448px.
- Direction: overflow-hidden parents; responsive prefixes for fixed grids; table
  wrapper; chat rail default-closed below md.

### [F-25] Touch targets below minimums

- Category: A11y/responsive · Severity: P3 · Status: VERIFIED-STATIC
- Evidence: 20px TopNav/Sidebar icon buttons (no padding around w-5 h-5 SVGs);
  32px chat send/attach; ~18px calendar chips; toggle track 24px tall.
- Direction: min 24×24 hit areas via padding/pseudo-elements.

### [F-26] Testing theater

- Category: Testing · Severity: P1 · Status: VERIFIED-LIVE (suite run) + static
- Evidence: a11y suite tests synthetic shell only AND its fixture breaks builds
  (F-04); stale flows specs would fail today; neither e2e location wired into
  any of 10 CI workflows; 34 unit tests cover ~7% of source files; zero
  visual/perf/a11y automation.
- Direction: fix fixture; axe integration against REAL pages (this audit's sweep
  harness is the starting point); wire Playwright into CI.

### [F-27] No correlation IDs / user identity on errors

- Category: Observability · Severity: P2 · Status: VERIFIED-STATIC
- Evidence: headers limited to 4 knowns; correlation_id only as response type;
  setUser never called.
- Direction: generate request-id client-side, echo backend trace id when
  present.

### [F-28] Dead/orphaned routes & misc broken affordances

- Category: IA/UX · Severity: P2 · Status: VERIFIED-STATIC (+live for callback)
- Evidence: /status /forbidden /session-expired zero inbound links; refresh
  failure goes to /login not session-expired; memory-detail not-found button
  onClick:{} (:115-126); fallback links /memory /agents outside workspace
  context; landing #pricing anchor missing; footer omits terms/privacy; signup
  social buttons handler-less; status uptime computed from poll timestamp ≈0m
  always; robots duplicated static+route; og-image referenced but absent;
  forbidden CTA mislabeled.
- Direction: link-or-delete each orphan; fix micro-affordances in one sweep.

### [F-29] SEO/metadata architecture absent beyond root

- Category: Next.js · Severity: P3 · Status: VERIFIED-STATIC
- Evidence: zero page-level metadata exports; landing fully client-rendered;
  sitemap lists 3 URLs.
- Direction: acceptable for authed app; landing should be server component with
  metadata; decide public-marketing strategy.

### [F-30] Unvirtualized long lists

- Category: Rendering perf · Severity: P3 · Status: VERIFIED-STATIC
- Evidence: chat transcript unbounded map during streaming (:994); history holds
  full datasets re-sliced per render; applications fetch-all grouping.
- Direction: defer until real dataset sizes exist; measure then virtualize chat
  if needed.

---

# Dependency Map

```
F-06 (purge) ──independent──> fix tailwind content globs
F-01 (callback) ──needs──> backend OAuth state/session endpoints (exist? verify)
F-02/F-03/F-05 ──need──> product decisions: wire-real vs remove vs honest-stub per surface
F-08+F-09+F-10+F-11 (a11y cluster) ──share──> design-token consolidation (F-22) as force multiplier
F-14+F-27 (observability) ──share──> single ErrorTracker activation + header middleware
F-15+F-16 (SWR/auth-context) ──share──> AuthProvider introduction (F-16 first)
F-04 ──blocks──> ALL CI-gated work (fix first, one hour)
F-18 ──needs──> FR-05 initial-scan backend surface decision
F-20 ──needs──> resume editor scope decision (MVP vs post-MVP)
F-07 ──needs──> product decision: light mode now vs delete scaffolding
```

# Recommended Implementation Sequence

**Wave 01 — Blockers (P0).** F-04 build gate → F-01 callback route → F-03
data-loss wiring → F-02 fabrication removal. Objectives: shippable build,
working OAuth, no silent loss, no invented facts. Verification: green build; E2E
OAuth; outcome persisted; grep audit for Math.random in user-facing paths. Risk:
low. Outcome: MVP-trust baseline restored.

**Wave 02 — Structural Frontend.** F-15 SWRConfig mount → F-16 AuthProvider
hoist → F-21 dead-code deletion → dual-API retirement plan. Dependencies: none
hard. Risk: medium (behavior changes in fetch timing). Outcome: predictable
network behavior; honest codebase surface.

**Wave 03 — UX.** F-18 onboarding completion+scan-summary → F-19 stream cancel →
F-20 resume copy/export decision → retry-style unification (mutate not reload) →
orphan route linking/removal (F-28). Outcome: coherent journeys.

**Wave 04 — UI / Design System.** F-22 consolidation: semantic status tokens
across Badge/StatusBadge/Alert primitives; single ConfirmDialog built on ui-kit
Modal (F-12); revive PageHeader (F-23); ban native dialogs. Outcome: one way to
do each thing.

**Wave 05 — Accessibility.** F-08 main landmark fix → F-09 heading repair → F-10
contrast via tokens (depends Wave 04) → F-11 control naming → focus-trap/Esc
gaps (F-13, shortcuts modal restore) → aria-invalid/describedby wiring.
Verification: axe clean on all routes (harness exists); manual SR pass.

**Wave 06 — Responsive.** F-24 fixes (orb overflow-hidden, calendar prefixes,
table wrappers, chat rail default-closed) → F-25 touch targets. Verification:
re-run this audit's sweep script; expect 0 overflow hits.

**Wave 07 — Performance.** Measure production CWV first (baseline exists) →
virtualize chat only if measured → landing server-render + metadata (F-29) →
image strategy when content demands. Do NOT optimize speculatively.

**Wave 08 — Testing.** F-26: real-page axe suite in CI; Playwright wired to
workflow; critical-flow e2e (login→upload→chat→approve→undo); replace stale flow
specs. Verification: CI green including new suites.

**Wave 09 — Enterprise Hardening.** F-05 decisions executed (build routers or
stub honestly); billing/admin honesty; RBAC-aware UI hooks; SSO admin surface.
Classification: ENTERPRISE — schedule after MVP waves unless misrepresentation
items pulled earlier.

**Wave 10 — Final Polish.** i18n decision (use or delete), theme decision
closure (F-07), copy review pass, motion polish, docs regeneration (AGENTS.md
truth-fix).

# Risk Register

| Risk                                                                          | Likelihood | Impact                  | Mitigation                                                    |
| ----------------------------------------------------------------------------- | ---------- | ----------------------- | ------------------------------------------------------------- |
| Backend schema drift continues breaking local/dev runs (consent_version case) | High       | Medium                  | Single migration discipline; pre-flight health check script   |
| prometheus/fastapi version incompatibility ships                              | Medium     | High (all requests 500) | Pin fastapi until pfi upgrade; add /health smoke to deploy    |
| Parallel sessions modify files mid-remediation                                | High       | Medium                  | Baseline diff discipline (this audit's snapshot pattern)      |
| Removing fabrications surprises stakeholders who saw demo numbers             | Medium     | Low                     | Announce; replace with honest placeholders, not blank screens |
| Tailwind glob change surfaces ui-kit visual shifts app-wide                   | Certain    | Low                     | Visual snapshot pass post-fix (Wave 08 tooling)               |
| AuthProvider refactor alters session edge cases                               | Medium     | Medium                  | Keep useAuth signature identical; consumer count is small (4) |

---

# Scoring

| Dimension                      |      Score | Basis                                                                                                                                                         |
| ------------------------------ | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product Completeness           | **62/100** | MVP surface covered; onboarding flow absent; editor promised-not-shipped; OAuth broken; outcome data loss                                                     |
| UI Quality                     | **68/100** | Coherent dark core, good primitives where used; fragmentation + title chaos drag                                                                              |
| UX Quality                     | **58/**100 | Strong files/auth/dashboard journeys; dead ends, false affordances, inconsistent confirmation/recovery                                                        |
| Design System                  | **44/100** | Complete token definitions bypassed by 445 raw usages; purge bug breaks flagship components; theming dead                                                     |
| Accessibility                  | **46/100** | Excellent foundations (modal/tabs/skip/reduced-motion) vs structural landmark/heading breaks, 132 measured contrast fails, unnamed controls, untestable suite |
| Responsive Quality             | **72/100** | 105/110 cells clean; drawer pattern solid; specific defects (orb, calendar, chat rail)                                                                        |
| Frontend Architecture          | **70/100** | Single transport, typed namespaces, code-splitting, zero deps; dead-code mass, dual surfaces, asymmetric transform                                            |
| Performance                    | **78/100** | Measured lean bundles; correct lazy loading; risks are behavioral (refetch storms), not size                                                                  |
| State Completeness             | **55/100** | Loading/empty/error broad and often good; cancel/undo/permission-grant-path systemic gaps                                                                     |
| Error/Recovery Quality         | **52/100** | ErrorState+retry common; reload-retry antipattern; CORS-masked failures; silent drops                                                                         |
| Testing                        | **38/100** | 34 passing but narrow; a11y theater that also breaks builds; stale unwired e2e; no automation for a11y/responsive/perf                                        |
| **Overall Frontend Readiness** | **58/100** | Not an average of strengths — capped by P0 cluster                                                                                                            |

# Frontend Readiness Level

## LEVEL 1 — Functional (approaching LEVEL 2 — MVP Ready)

Why not LEVEL 2 today: primary flows are usable end-to-end and the MVP page
surface exists — that clears LEVEL 1 decisively. But LEVEL 2 ("MVP Ready") is
blocked by four P0s: broken OAuth happy path (F-01), fabricated system facts in
trust-critical surfaces (F-02), silent data loss (F-03), and a red production
build (F-04). Clearing Wave 01 + Wave 02 would justify LEVEL 2; LEVEL 3 requires
Waves 03–08.

# GO / NO-GO Gate

## CONDITIONAL GO

The audit baseline is sufficiently understood to begin implementation **without
another discovery phase**, and GO conditions are explicit:

1. **GO-condition 1:** Fix F-04 first (build gate) — nothing ships otherwise.
2. **GO-condition 2:** Implement `/auth/callback` (F-01) before any flow
   touching SSO or connector connect.
3. **GO-condition 3:** Remove or honestly label every fabricated metric (F-02)
   before any user-facing demo or beta exposure.
4. **GO-condition 4:** Wire or remove every silently-dropped mutation (F-03).

All remaining work proceeds per the wave sequence with no re-audit required;
verification methods are specified per finding. NO-GO would be warranted only if
the product decisions underpinning F-02/F-03/F-18/F-20 are refused — in which
case the frontend is being asked to lie by design, and no implementation
sequence can fix that.

# Final Audit Summary

## CURRENT STATE

A functionally real, architecturally clean, dependency-light Next.js MVP with
strong individual surfaces (files, auth forms, dashboard, streaming chat,
hand-rolled graph) undermined by a broken build gate, missing OAuth callback,
fabrication cluster, silent data loss, non-functional theming, and structural
accessibility breaks — wrapped in ~1,200 lines of dead scaffolding that
misrepresents the architecture to future contributors.

## WHAT IS STRONG

1. 103 kB shared JS, zero heavyweight dependencies · 2. Single transport
   pipeline with refresh+CSRF correctness · 3. Files page enterprise-quality
   (retry, diffs, undo) · 4. Real SSE chat with wired approvals · 5. Hand-rolled
   graph with culling/keyboard/reduced-motion/list-mode · 6. Best-practice auth
   forms · 7. Honest empty states with actions · 8. Drawer responsive shell with
   inert content · 9. Reduced-motion + skip link + exemplary Tabs · 10. Typed
   GDPR delete + live-wired consent toggles.

## WHAT IS MISSING

1. `/auth/callback` route · 2. Onboarding flow + initial-scan summary · 3.
   Resume editor + PDF/DOCX export · 4. Permission-denied-with-grant-path states
   · 5. Batch-approve & approval edit/reversibility/version fields · 6. Stream
   cancel & thread management · 7. Page-level metadata/public strategy · 8. Real
   observability plumbing (correlation IDs, error capture) · 9. CI-wired
   e2e/a11y/responsive suites · 10. Light mode decision closure.

## WHAT IS BROKEN

P0: F-01 OAuth 404 · F-02 fabrications as fact · F-03 silent data loss · F-04
red build. Plus F-05's three endpoint-less pages when enterprise enabled.

## WHAT IS INCONSISTENT

Four button systems, six overlays, three error idioms, four loading idioms,
retry via mutate vs reload, title scale per state branch, confirm() vs
ConfirmDialog vs alert(), muted vs dim text mood-based.

## WHAT IS SLOW

Nothing is measurably slow at bundle level; risks are refetch-on-focus storms
(observed amplifying failures ×20–42), duplicate /auth/me (×4), unvirtualized
chat transcript at scale. Production CWV NOT MEASURED.

## WHAT IS INACCESSIBLE

Duplicate/nested `<main>` everywhere · 2× h1 epidemic + h1=0 screens · 132
measured contrast violations · unnamed history/schedule/graph controls · no-trap
ConfirmDialog with dangerous Enter-confirm · Escape-dead mobile drawer ·
aria-invalid absent · a11y test suite tests nothing real.

## WHAT IS POOR UX

Onboarding that can never complete · false keyboard-shortcut advertising ·
phantom Undo promise on file detail · fake "Export lineage" button · dead signup
social buttons · mislabeled forbidden CTA · toast-only form validation
(schedule) · refresh-failure destroying context instead of session-expired page.

## WHAT IS NOT ENTERPRISE-READY

Observability dark in prod · no correlation IDs · three enterprise pages calling
absent endpoints · billing fiction · RBAC-aware UI absent beyond env flag · no
compliance-grade unified audit view · no visual/a11y/perf regression gates in
CI.

## WHAT MUST HAPPEN FIRST

1. Fix build gate (F-04) → 2. Implement /auth/callback (F-01) → 3. De-fabricate
   telemetry (F-02) → 4. Wire-or-remove silent mutations (F-03) → 5. SWRConfig +
   AuthProvider (F-15/F-16) → 6. Landmark/heading/contrast repair (F-08/09/10)
   → 7. Real axe suite into CI (F-26).

## GO / NO-GO

**CONDITIONAL GO** — proceed immediately on Wave 01–02 under the four
GO-conditions above; no further discovery needed.

---

# Appendix — Evidence

## Artifacts produced by this audit (all untracked)

| File                                                        | Content                                                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `.agents/aaaduit/evidence/git-baseline.txt`                 | Pre-existing dirty-tree snapshot (29 entries) for final diff                                                                      |
| `.agents/aaaduit/evidence/build-output.txt`                 | Failed `next build` lint evidence (exit 1, rule list)                                                                             |
| `.agents/aaaduit/evidence/build-output-nolint.txt`          | Successful build: full route table, First Load JS, middleware size                                                                |
| `.agents/aaaduit/evidence/build-output-analyze.txt`         | ANALYZE pass log                                                                                                                  |
| `.agents/aaaduit/evidence/top-chunks.txt`                   | Largest on-disk chunks                                                                                                            |
| `.agents/aaaduit/evidence/sweep-results.json`               | Full runtime sweep: overflow matrix (22 routes × 5 VPs), axe violations, heading census, focus tests, console buckets, nav timing |
| `.agents/aaaduit/evidence/sweep-summary.txt`                | Distilled sweep results                                                                                                           |
| `.agents/aaaduit/evidence/screenshots/*.png`                | Key routes at 1440/375 + drawer state                                                                                             |
| `.agents/aaaduit/evidence/api-server.log`, `web-server.log` | Server logs incl. instrumentator crash trace                                                                                      |

## Key commands executed

- `pnpm build` (failed, lint) · `npx next build --no-lint` (129.4s) ·
  `ANALYZE=true npx next build --no-lint` (139.9s)
- Playwright sweep: chromium headless, authenticated as fresh
  `audit@vaeloom.test`; axe-core injected from workspace node_modules
- `pnpm test` → 7 suites / 34 tests passed (30.2s)

* Report complete *
