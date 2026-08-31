# Landing 3D — End-to-End Audit & Implementation Plan (2026-08-29)

> **Status:** DRAFT FOR USER APPROVAL **Mode:** GENERATE_AND_EXECUTE_PHASE
> **Scope:** Complete the landing page 3D experience end-to-end (4 workstreams)
> **Baseline commit:** `git rev-parse HEAD` (run before execution)
> **Owner:** Frontend / Landing experience
> **Evidence basis:** `apps/web/src/components/landing/**`, `apps/web/src/lib/landing/**`

---

## 1. Forensic Audit — What scroll/3D IS implemented

### 1.1 The live scroll engine — `LandingScrollProvider` (`apps/web/src/lib/landing/scroll.tsx`)
- **One** passive `scroll` listener + `requestAnimationFrame` throttle (no idle GPU/CPU burn). `scroll.tsx:56-76`
- Exposes `pageProgressRef` (normalized 0→1 page progress) and a subscriber registry. `scroll.tsx:30-41`
- `useSectionProgress(ref, {viewLead, viewTrail})` reproduces the prior per-section math so existing visuals are unchanged. `scroll.tsx:111-133`
- `usePageScrollProgress()` / `usePageScrollSubscribe(cb)` public hooks.
- **Verdict:** This is the real foundation. Everything reads from it. ✅ LIVE.

### 1.2 The live 3D system — `StageProvider` / `StageSlot` (`apps/web/src/components/landing/3d/SceneShell.tsx`)
- **ONE shared WebGL context** for the whole page (`createStage` in `vanilla/stageScene.ts`).
- An `IntersectionObserver` (thresholds `0..1`, picks max `intersectionRatio`) selects the active "beat"; the `<canvas>` is teleported into that slot; `setActiveBeat(name, getProgress)` feeds per-section `useSectionProgress`. `SceneShell.tsx:225-314`
- `StageSlot` registers each slot with the provider and renders a `StagePoster` fallback (captured PNG) when WebGL is unavailable. `SceneShell.tsx:316-376`
- **7 beats wired** across sections (verified by grep of `StageSlot` usage):

| Section file | Beat | Slot line |
|---|---|---|
| `sections/HeroSection.tsx` | `hero` | `:64` |
| `sections/HowItWorks.tsx` | `journey` | `:58` |
| `sections/MemorySection.tsx` | `memory` | `:43` |
| `sections/AgentSection.tsx` | `agents` | `:52` |
| `sections/ProductStorySections.tsx` | `connectors` | `:79` |
| `sections/TrustCompoundingSections.tsx` | `growth` | `:91` |
| `sections/ClosingSections.tsx` | `cta` | `:22` |

- `DustField` — separate fixed ambient WebGL background, mounted directly in `page.tsx:90`, always live. `SceneShell.tsx:139-148`

### 1.3 Beat → scene factory map (`vanilla/stageScene.ts:77-184`)
| Beat | Factory | Notes |
|---|---|---|
| `hero` | `createMemoryCore(..., true)` | "going inside" camera pull-back |
| `journey` | `createJourney` | scroll-scrubbed pipeline path (`hasPath`) |
| `memory` | `createKnowledgeGraph` | |
| `agents` | `createAgentOrbit` | 7 agent nodes |
| `connectors` | `createConnectorFlow` | |
| `growth` | `createGrowth` | scroll-scrubbed lattice |
| `cta` | `createMemoryCore(..., false)` | calm core |

**Verdict:** The landing page IS an end-to-end scroll-driven 3D story. The architecture is sound; gaps are **coverage**, **continuity**, **dead code**, and **scope beyond landing**.

### 1.4 DEAD CODE — implemented but never wired (audit finding)
| Symbol | Location | Why dead |
|---|---|---|
| `MemoryCoreScene` | `SceneShell.tsx:67` | never imported outside SceneShell |
| `KnowledgeGraphScene` | `SceneShell.tsx:77` | never imported |
| `AgentOrbitScene` | `SceneShell.tsx:100` | never imported |
| `ConnectorFlowScene` | `SceneShell.tsx:168` | never imported |
| `JourneyScene` | `SceneShell.tsx:151` | never imported |
| `GrowthScene` | `SceneShell.tsx:179` | never imported |
| `CtaCoreScene` | `SceneShell.tsx:196` | never imported |
| `mountStage` (Phase B hero) | `stageScene.ts:354` | superseded by `createStage`; unused |

Grep proof: only `DustField` from `SceneShell` is imported in `app/page.tsx`; the 7 `*Scene` wrappers appear in **zero** non-SceneShell files.

### 1.5 Coverage gap (audit finding)
Sections with **NO 3D slot**: `ProblemSection`, `ProductSections` (`PrinciplesStrip`/`ProductDifference`), `TrustSection`, `ProductPreview`, `FAQSection`. `ProductStorySections` has 4 sub-sections (Organization/Resume/Career/Scheduler) sharing a single `connectors` beat.

### 1.6 Continuity gap (audit finding)
- Beat switching **teleports**: `frame()` sets `b.object.visible = i === activeIndex` (`stageScene.ts:283-285`). Only one beat renders at a time; camera lerps *within* a beat only. There is **no continuous fly-through** connecting beats.
- Two progress paths coexist: `StageSlot` uses `useSectionProgress`; `journey`/`growth` factories take a `progressRef`. Mixed but functional.

---

## 2. Plan — 4 Workstreams (all approved by user)

### Workstream A — Fill 3D coverage gaps (every section gets a beat)
**Goal:** No section scrolls past without a 3D presence.
1. Add `StageSlot` beats to: `ProblemSection` (`problem`), `ProductSections` (`principles`, `difference` or one `product` beat), `TrustSection` (`trust`), `ProductPreview` (`preview`), `FAQSection` (`faq`).
2. Split `ProductStorySections` so Organization/Resume/Career/Scheduler each own a beat OR share a parameterized `connectors` variant. Decision: one `connectors` beat is fine; new beats only for the 5 truly-empty sections.
3. For each new beat, add a factory in `vanilla/` (or reuse: e.g. `problem` = inverted `memoryCore` fragment cloud, `trust` = `growth` variant, `preview` = `knowledgeGraph` mini, `faq` = `agentOrbit` lite). Register in `buildStage` beats array (`stageScene.ts:98-176`) with a `z` offset following the `GAP=60` layout.
4. Add poster PNGs to `public/landing/beats/<beat>.png` (capture via `?stageBeat=<beat>` + Playwright).
5. Wire `StageSlot` in each section, behind the same `useSceneAvailable` fallback.

**Acceptance:** Every `<section>` in `page.tsx` contains a `StageSlot`; 0 console errors; reduced-motion/low-tier show posters.

### Workstream B — Continuous fly-through (merge 7 teleports into 1 camera path)
**Goal:** One unbroken scroll-driven camera traveling through all scenes rather than teleporting.
1. Replace the per-beat `visible` toggle (`stageScene.ts:283-285`) with a single `THREE.Group` containing all beat objects laid out along `-Z` by `GAP`.
2. Drive **one** camera from `pageProgressRef` (0→1) mapped to a master spline/keyframe track through all beats (reuse existing `CameraKey` per beat). Add easing/overlap so transitions blend.
3. Keep per-beat `tick(localProgress)` for object animation, but compute `localProgress` from global page progress (segment boundaries), not IntersectionObserver.
4. Retain `IntersectionObserver` only for lazy `start()/stop()` and analytics, not beat selection.
5. Keep `DustField` as the persistent backdrop.

**Acceptance:** Scrolling the full page moves the camera continuously through all beats with no hard cuts; frame rate ≥ 50fps on `high` tier, graceful pause off-screen.

### Workstream C — Audit cleanup + document live path
**Goal:** Remove dead code, lock the architecture in writing.
1. Delete the 7 unused `*Scene` wrappers in `SceneShell.tsx` (`MemoryCoreScene`…`CtaCoreScene`).
2. Delete `mountStage` (`stageScene.ts:354-436`).
3. Add a short `README`/doc-comment block at top of `SceneShell.tsx` stating: *single Stage context, scroll-driven, 7+ beats, DustField ambient, posters as fallback*.
4. Run lint/typecheck: `pnpm --filter web lint` + `tsc` (Next build typecheck).
5. Add a Playwright smoke test capturing `?stageBeat=` for each beat to prevent regressions.

**Acceptance:** `grep` for deleted symbols returns 0 hits outside their own file; `next build` passes; visual regression suite green.

### Workstream D — Extend scroll-3D beyond landing
**Goal:** Reuse the Stage system inside the app interior (workspace, resume builder, memory graph).
1. Extract `LandingScrollProvider` + `StageProvider` + `useSectionProgress` into a shared `packages/` (or `apps/web/src/lib/scroll-3d`) module, de-coupled from `landing` naming.
2. Build a `WorkspaceStageProvider` wrapping `workspace/[workspaceId]` routes; expose `StageSlot` for: memory graph view (`MemorySection` already exists as `GraphViewer.tsx`), resume builder preview (`ResumeBuilder.tsx`), execution timeline.
3. Keep a single shared WebGL context per route tree (one Stage per mounted provider) to respect the "1 context" rule.
4. Respect the same gates (`useSceneAvailable`, reduced-motion, tier).

**Acceptance:** Interior pages render 3D via the shared provider with no duplicate contexts; landing still works; no hydration mismatch under reduced-motion.

---

## 3. Execution Order & Dependencies
```
C (cleanup) ──► A (coverage) ──► B (fly-through) ──► D (beyond landing)
```
- C first: removes confusion, makes A/B diffs clean.
- A before B: B needs the full beat set to build the master spline.
- D last: depends on stabilized shared module from C.

## 4. Risks / Guardrails
- **WebGL context limit:** browsers cap ~16 contexts. Single Stage context + DustField = 2. Do NOT reintroduce per-section contexts.
- **Reduced-motion / low-tier:** must always fall back to `StagePoster` — never blank.
- **Hydration:** scene gates use `useSyncExternalStore` server snapshot `false` (`hooks.ts`) — preserve this pattern when extracting to shared module.
- **Perf:** cap DPR at 1.75 (`dprForTier`), density multiplier per tier; pause off-screen via IO.

## 5. Verification
- `pnpm dev:web` → scroll full landing; confirm continuous camera (B), every section has 3D (A).
- `?stageBeat=<beat>` captures each poster (C/D).
- Reduced-motion OS setting → posters only.
- `pnpm --filter web lint && pnpm --filter web build` green.
- Playwright smoke: load `/`, assert canvas present, no console errors.

---
*Generated 2026-08-29. Predecessor: live `StageProvider`/`LandingScrollProvider` architecture (verified by grep + read). No DB/IaC impact — frontend-only.*
