# ENT-P10 — 04 Architecture Framing — Enterprise Frontend Architecture Synthesis

> **Phase:** `ENT-P10` (Frontend Implementation)  
> **Deliverable:** Supporting Architecture Framing Specification  
> **Owner:** Principal Enterprise Frontend Architect & Web Tooling Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Unified Frontend Architecture Topology

The Vaeloom web application architecture combines Next.js 15 App Router
streaming server rendering with lightweight, accessible client hydration:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS 15 APP ROUTER CORE                      │
│  - React 19 Server Components (RSC) for zero-JS layout shells         │
│  - Isomorphic Route Handlers (/api/proxy) with cookie preservation     │
│  - Dedicated error.tsx and loading.tsx handlers on every route segment │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TYPED DATA FETCHING & STATE TIER                     │
│  - Strongly typed ApiClient (OpenAPI 3.2.0 schema mirroring)           │
│  - SWR v2 Cache Hydration with optimistic mutation rollbacks           │
│  - Real-Time Server-Sent Events (SSE) stream hooks (useAgentStream)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    @VAELOOM/UI-KIT PRESENTATION TIER                   │
│  - Headless Radix UI Primitives (Focus trapping, ARIA accessibility)   │
│  - Three-tier DTCG Design Tokens (Dark mode CSS custom properties)     │
│  - Tailwind CSS utility preset with zero-overflow responsive grid      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Frontend Architecture Invariants

### Invariant 1: Absolute Zero Mock Bypasses in E2E Verification (INV-FE-01)

- 100% of functional Playwright E2E tests execute against authentic live running
  microservices (FastAPI backend on port 8000, Web SSR on port 3000, live MinIO
  S3, authentic cognitive endpoints).
- Mocking or skipping tests in production verification suites is strictly
  prohibited.

### Invariant 2: Mandatory Five-State UI Coverage (INV-FE-02)

- Every route and data-consuming component strictly implements five
  deterministic states: Loading Skeleton, Empty State with Action CTA, Partial
  Streaming, Active Loaded, and RFC 7807 Error.
- Unhandled `undefined` states or blank screens result in immediate build
  rejection.

### Invariant 3: Responsive 0px Horizontal Scroll Overflow Floor (INV-FE-03)

- No application view may generate horizontal scroll overflow
  (`scrollWidth > clientWidth`) across any device resolution from 320px to
  1440px+.
- Validated programmatically across all viewports in CI via `quality.spec.ts`.

### Invariant 4: Sub-150KB First Load JS Bundle Budget (INV-FE-04)

- Total First Load JavaScript delivered to the client across any route must not
  exceed 150 KB.
- Route-specific page chunks must remain below 45 KB, verified via Next.js build
  bundle analyzer.

### Invariant 5: W3C WCAG 2.2 AA Compliance with 0 Axe-Core Violations (INV-FE-05)

- Automated Axe-core accessibility scans in Playwright must detect zero critical
  and zero serious accessibility violations on every commit.
- Every page surface enforces exactly one semantic `<h1>` element.

---

_Signed: Principal Enterprise Frontend Architect & Web Tooling Lead —
2026-09-29_
