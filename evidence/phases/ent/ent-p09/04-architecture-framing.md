# ENT-P09 — 04 Architecture Framing — Design System & UI Architecture Synthesis

> **Phase:** `ENT-P09` (UI/UX and Design System)  
> **Deliverable:** Supporting Architecture Framing Specification  
> **Owner:** Principal Enterprise UI Architect & Design Director  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Unified UI Architecture & Monorepo Package Topology

The Vaeloom user interface is built on a clean, decoupled component hierarchy
that separates design token definitions and accessible headless primitives from
application-specific route layouts:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS 15 WEB APPLICATION                     │
│  - App Router: Route Handlers, SSR Layouts, Page Controllers           │
│  - SWR Data Hydration + Optimistic Mutation State                      │
│  - Real-Time Server-Sent Events (SSE) Streaming Hooks                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Imports UI Components & Layouts
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        @VAELOOM/UI-KIT (PACKAGE)                       │
│  - Accessible Component Primitives (Button, Dialog, Dropdown, Toast)  │
│  - Headless Radix UI Primitives (Focus trapping, ARIA state binding)   │
│  - Tailwind CSS Preset & Responsive Layout Grid Utilities              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Powered By
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DESIGN TOKEN FOUNDATION                         │
│  - Tier 1: Primitives (Raw Hex Palettes, Rem Spacing Scales)           │
│  - Tier 2: Semantic Tokens (Theme-Adaptive CSS Custom Properties)      │
│  - Tier 3: Component Scoped Tokens (Card elevation, Button radius)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core UI/UX Architecture Invariants

### Invariant 1: WCAG 2.2 Level AA Non-Negotiable Floor (INV-UI-01)

- Every page surface and interactive component must achieve 100% compliance with
  W3C WCAG 2.2 Level AA standards.
- Automated Axe-core scans in Playwright must detect zero critical and zero
  serious accessibility violations on every commit.

### Invariant 2: Zero Horizontal Scroll Overflow (INV-UI-02)

- No page surface or dialog may generate horizontal scroll overflow
  (`scrollWidth > clientWidth`) across any viewport width from 320px to 1440px+.
- All mobile layouts stack into single-column flows with fluid touch targets
  ($44\text{px}$ minimum).

### Invariant 3: Sovereign Vault Visual Isolation (INV-UI-03)

- The Candidate Sovereign Vault experience and the Institutional Admin Portal
  must maintain distinct visual languages and color systems (Indigo/Slate vs
  Navy/Zinc).
- Visual indicators must clearly inform candidates when they are viewing private
  data versus institutional shared assets.

### Invariant 4: Mandatory Five-State Component Coverage (INV-UI-04)

- Every data-fetching view and card must implement all five deterministic UI
  states: Loading Skeleton, Empty with CTA, Partial Streaming, Active Loaded,
  and RFC 7807 Error.
- Unhandled `undefined` states or blank screens are strictly prohibited.

### Invariant 5: EU AI Act Grounded Provenance Attribution (INV-UI-05)

- All AI-generated, AI-summarized, or AI-tailored content must display visible
  transparency attribution badges.
- Every tailored resume bullet must expose an interactive provenance anchor
  linking back to the verified source document.

---

_Signed: Principal Enterprise UI Architect & Design Director — 2026-09-29_
