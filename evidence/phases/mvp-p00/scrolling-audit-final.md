# Vaeloom — Enterprise Scrolling & Viewport Audit: Final Report

> **Status: COMPLETE — Phase 3 Hardening Done** Generated: 2026-10-01  
> Build: ✓ `pnpm --filter @vaeloom/web build` exit code 0, 57 routes compiled, 0
> errors  
> Audit: ✓ 37/37 routes PASS, 0 FAIL, 0 ERROR  
> Metrics: `docDiff=0 docDiffX=0` on all 31 workspace routes

---

## 1. Architecture Established

### Canonical Scroll Ownership Model (Pattern B — Application Viewport)

```
Browser
  └── html.app-shell-locked (overflow: hidden !important)
       └── body.app-shell-locked (overflow: hidden !important)
            └── #main-content (overflow: hidden, h-full, min-h-0) [root layout.tsx]
                 └── workspace layout div (flex h-screen h-[100dvh] overflow-hidden)
                      ├── Sidebar (h-screen h-[100dvh], flex flex-col)
                      │    ├── Header: shrink-0
                      │    ├── Nav: flex-1 min-h-0 overflow-y-auto overscroll-y-contain  ← SCROLL OWNER
                      │    └── Footer: shrink-0
                      └── workspace-main-content (flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden)
                           ├── TopNav (shrink-0, h-14)
                           └── contentRef div (flex-1 focus:outline-none min-h-0)
                                ├── FULL-BLEED: overflow-hidden p-0 → page h-full flex flex-col
                                └── NORMAL: overflow-y-auto overscroll-y-contain p-4 sm:p-6  ← SCROLL OWNER
```

### Full-Bleed Routes (no outer padding, h-full chain):

- `/chat` and `/chat/*`
- `/capabilities` and `/capabilities/*`
- `/resume/[id]/edit`
- `/files/[documentId]`
- `/applications`

### Normal Scroll Routes:

All remaining workspace routes — scroll owned by the `contentRef` div.

---

## 2. Files Modified

| File                                                                              | Change                                                                                                        | Why                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web/src/styles/globals.css`                                                 | Added `.app-shell-locked` CSS class (html/body/main-content lock)                                             | Zero-trust scroll isolation for workspace shell                      |
| `apps/web/src/styles/globals.css`                                                 | Added `scroll-padding-top: 3.5rem` on `.overflow-y-auto, .overflow-auto, .scroll-region`                      | Prevent TopNav (h-14 = 56px) from covering focused/anchored elements |
| `apps/web/src/styles/globals.css`                                                 | Added `.scroll-mt-topnav`, `.pb-safe`, `.mb-safe`, `.pb-safe-plus-4` utilities                                | iOS safe-area insets + scroll-margin utility                         |
| `apps/web/src/app/layout.tsx`                                                     | `min-h-0 h-full w-full` on `<main id="main-content">`                                                         | Force main bounded by parent, critical for flex chain                |
| `apps/web/src/app/workspace/[workspaceId]/layout.tsx`                             | `app-shell-locked` useEffect, `isFullBleed` logic, `min-h-0 min-w-0 h-full overflow-hidden` on workspace main | Zero-trust workspace shell                                           |
| `apps/web/src/components/capabilities/SkillsView.tsx`                             | `overscroll-y-contain pb-12/16`                                                                               | Prevent scroll chaining from capabilities tab panels                 |
| `apps/web/src/components/capabilities/AgentsView.tsx`                             | `overscroll-y-contain pb-12/16`                                                                               | Same                                                                 |
| `apps/web/src/components/capabilities/ToolsView.tsx`                              | `overscroll-y-contain pb-12/16`                                                                               | Same                                                                 |
| `apps/web/src/components/capabilities/McpView.tsx`                                | `overscroll-y-contain pb-12/16`                                                                               | Same                                                                 |
| `apps/web/src/components/capabilities/ConnectorsView.tsx`                         | `overscroll-y-contain pb-16`                                                                                  | Same                                                                 |
| `apps/web/src/components/capabilities/PluginsView.tsx`                            | `overscroll-y-contain pb-16`                                                                                  | Same                                                                 |
| `apps/web/src/components/resume/ResumeBuilder.tsx` L526                           | `lg:max-h-[60vh]` → `lg:max-h-[60dvh] overscroll-y-contain`                                                   | Mobile viewport height correctness                                   |
| `apps/web/src/components/resume/ResumeBuilder.tsx` L619                           | `h-[70vh]` → `h-[70dvh]` (iframe preview)                                                                     | Mobile viewport height correctness                                   |
| `apps/web/src/app/workspace/[workspaceId]/files/[documentId]/page.tsx` L168, L176 | `min-h-[50vh]` → `min-h-[50dvh]`, `h-[70vh]` → `h-[70dvh]`                                                    | Mobile viewport height correctness                                   |
| `apps/web/src/components/memory/GraphViewer.tsx` L314                             | `min(65vh, 560px)` → `min(65dvh, 560px)`                                                                      | Mobile viewport height correctness                                   |
| `apps/web/src/components/capabilities/AddCapabilityModal.tsx` L930                | `max-h-[90vh]` → `max-h-[90dvh]`                                                                              | Modal height correctness on iOS                                      |
| `apps/web/src/components/chat/ChatWindow.tsx` L1882                               | Added `pb-safe` to chat input footer                                                                          | iOS home indicator safe-area inset                                   |
| **39 `loading.tsx` / `error.tsx` / `not-found.tsx` files**                        | `min-h-[60vh]` → `min-h-[60dvh]`, `min-h-[70vh]` → `min-h-[70dvh]`, etc.                                      | Enterprise-wide mobile dvh correctness                               |

---

## 3. Audit Results

### Metrics Table (37 Routes Audited)

| Route                          | Type                  | docDiff | docDiffX | Verdict                       |
| ------------------------------ | --------------------- | ------- | -------- | ----------------------------- |
| /login                         | public                | 0       | 0        | ✅ PASS                       |
| /signup                        | public                | 0       | 0        | ✅ PASS                       |
| /forgot-password               | public                | 0       | 0        | ✅ PASS                       |
| /status                        | public                | 85      | 0        | ✅ PASS (doc-scroll expected) |
| /privacy                       | public                | 1264    | 0        | ✅ PASS (doc-scroll expected) |
| /terms                         | public                | 1085    | 0        | ✅ PASS (doc-scroll expected) |
| /workspace/*/dashboard         | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/chat              | workspace (fullbleed) | 0       | 0        | ✅ PASS                       |
| /workspace/*/capabilities      | workspace (fullbleed) | 0       | 0        | ✅ PASS                       |
| /workspace/*/agents            | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/memory            | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/files             | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/search            | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/approvals         | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/notifications     | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/settings          | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/settings/security | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/billing           | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/tasks             | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/history           | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/schedule          | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/vault             | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/profile           | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/career            | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/jobs              | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/applications      | workspace (fullbleed) | 0       | 0        | ✅ PASS                       |
| /workspace/*/resume            | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/email             | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/connectors        | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/help              | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/developer         | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/marketplace       | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/admin             | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/cognition         | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/council           | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/feature-flags     | workspace             | 0       | 0        | ✅ PASS                       |
| /workspace/*/organizations     | workspace             | 0       | 0        | ✅ PASS                       |

**Summary: 37/37 PASS, 0 FAIL, 0 ERROR**

---

## 4. Pre-Verified Components (No Changes Required)

These were audited and confirmed already correct:

| Component                      | Scroll Pattern                                        | Status         |
| ------------------------------ | ----------------------------------------------------- | -------------- |
| `Sidebar.tsx`                  | `flex-1 min-h-0 overflow-y-auto overscroll-y-contain` | ✅             |
| `ChatWindow.tsx` scroll region | `flex-1 min-h-0 overflow-y-auto overscroll-y-contain` | ✅             |
| `GraphViewer.tsx`              | `overflow-hidden touch-none overscroll-contain`       | ✅ (dvh fixed) |
| `Modal.tsx` (ui-kit)           | `max-h-[90dvh] flex flex-col` + `lockScroll()`        | ✅             |
| `scrollLock.ts`                | Reference-counted, scrollbar-width-compensating       | ✅             |
| `TopNav.tsx` dropdown          | `max-h-[calc(100dvh-5rem)] overflow-y-auto`           | ✅             |
| `applications/page.tsx`        | `flex flex-col h-full min-h-0 p-4` (fullbleed)        | ✅             |
| `OverleafEditor.tsx`           | `flex flex-col h-full min-h-0 flex-1 overflow-hidden` | ✅             |

---

## 5. CSS Utilities Added (globals.css)

```css
/* Scroll padding to prevent TopNav (h-14=56px) covering anchor targets */
.overflow-y-auto,
.overflow-auto,
.scroll-region {
  scroll-padding-top: 3.5rem;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

/* Individual element scroll-margin for focused inputs / validation errors */
.scroll-mt-topnav {
  scroll-margin-top: 3.5rem;
}

/* iOS safe-area insets */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.mb-safe {
  margin-bottom: env(safe-area-inset-bottom, 0px);
}
.pb-safe-plus-4 {
  padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
}
```

---

## 6. Invariants Guaranteed

- ✅ **No document scroll** in any workspace page (`docDiff=0` on all 31
  workspace routes)
- ✅ **No horizontal overflow** (`docDiffX=0` on all 37 routes)
- ✅ **No double-scrollbar traps** — every scroll container is explicit and
  intentional
- ✅ **No viewport height clipping on iOS** — all `vh` replaced with `dvh` (39
  files)
- ✅ **Chat input not overlapped by iOS home indicator** — `pb-safe` on footer
- ✅ **Modal content not clipped** — `max-h-[90dvh]`
- ✅ **AddCapabilityModal not clipped** — `max-h-[90dvh]`
- ✅ **Anchor targets not hidden** — `scroll-padding-top: 3.5rem` on all scroll
  containers
- ✅ **Sidebar footer always reachable** — `shrink-0` footer, scrollable nav
  only
- ✅ **iOS momentum scrolling** — `-webkit-overflow-scrolling: touch` applied
- ✅ **Scroll chain prevention** — `overscroll-y-contain` on all internal scroll
  regions
- ✅ **Mobile sidebar body lock** — `useScrollLock(sidebarOpen)` active
- ✅ **Modal body lock** — `lockScroll()` / `unlockScroll()` reference-counted
- ✅ **Build: 0 TypeScript errors** — `exit code 0`, 57 routes

---

## 7. Known Pre-Existing Warnings (Not Scroll-Related)

The following are pre-existing ESLint warnings unrelated to this phase:

- `react-hooks/exhaustive-deps` in several components (pre-existing)
- `no-img-element` in `files/[documentId]/page.tsx` and `TwoFactorAuthCard.tsx`
  (pre-existing)
- `no-console` in trigger files and callback routes (pre-existing)

None affect scrolling behavior.
