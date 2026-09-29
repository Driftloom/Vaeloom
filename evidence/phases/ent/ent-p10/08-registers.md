# ENT-P10 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P10` (Frontend Implementation)  
> **Deliverable:** `DEL-ENT-P10-08` — Consolidated Governance Registers  
> **Owner:** Frontend Governance Custodian & Web Release Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                                   | Severity |            Impact             | Mitigation Strategy                                                                                         | Owner              |     Status     |
| :------------------ | :------------------------------------------------------------------------------------------------- | :------: | :---------------------------: | :---------------------------------------------------------------------------------------------------------- | :----------------- | :------------: |
| **RISK-ENT-P10-01** | Client-side memory leaks caused by unclosed Server-Sent Events (SSE) stream connections.           |   High   |       Browser tab crash       | Ensure `eventSource.close()` triggers on unmount or on `final_response`/`error` events in `useAgentStream`. | Frontend Architect | **CONTROLLED** |
| **RISK-ENT-P10-02** | Stale-While-Revalidate (SWR) cache retains stale data after user logs out or switches workspaces.  |   High   |    Cross-user data leakage    | Clear global SWR cache (`mutate(() => true, undefined, { revalidate: false })`) on `/auth/logout`.          | Security Lead      | **CONTROLLED** |
| **RISK-ENT-P10-03** | Third-party npm dependencies inadvertently increase First Load JS bundle beyond the 150 KB budget. |  Medium  |      Mobile load latency      | Next.js `optimizePackageImports` configuration; automated bundle analyzer checks in CI build pipeline.      | Web SRE            | **CONTROLLED** |
| **RISK-ENT-P10-04** | Port collisions on local developer workstations block `pnpm dev:web` Next.js startup on port 3000. |   Low    |    Developer velocity drop    | Documented process kill command (`Get-Process node \| Stop-Process -Force`); pre-flight port checks.        | Tooling Lead       | **CONTROLLED** |
| **RISK-ENT-P10-05** | Form submission race conditions result in duplicate resume creation or tailoring requests.         |  Medium  | Resource waste / DB duplicate | Form submit button disables upon submission; backend accepts `Idempotency-Key` header with Redis dedup.     | Frontend Lead      | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                            | Context & Alternatives                                                                                                    | Chosen Rationale                                                                                                      |    Status    |
| :----------------- | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------- | :----------: |
| **DEC-ENT-P10-01** | **Next.js 15 App Router + React 19 RSC**  | Alt A: Pages Router or SPA Vite client.<br>Alt B: Next.js 15 App Router with React Server Components.                     | Chose Alt B. Maximizes initial page load speed, enables zero-bundle layout shells, and supports streaming SSR.        | **APPROVED** |
| **DEC-ENT-P10-02** | **SWR v2 for Client Data Hydration**      | Alt A: Redux Toolkit or Zustand global state.<br>Alt B: SWR v2 with optimistic UI mutations and automatic deduping.       | Chose Alt B. Eliminates boilerplate state synchronization; natively supports stale-while-revalidate caching.          | **APPROVED** |
| **DEC-ENT-P10-03** | **Next.js Route Handler Reverse Proxy**   | Alt A: Direct client CORS requests to FastAPI on port 8000.<br>Alt B: Next.js internal `/api/proxy` bridge.               | Chose Alt B. Eliminates cross-origin cookie complications, provides SSRF isolation, and hides internal backend IPs.   | **APPROVED** |
| **DEC-ENT-P10-04** | **Tree-Shakable Monorepo UI-Kit Package** | Alt A: In-app UI component folder.<br>Alt B: Independent `@vaeloom/ui-kit` package inside monorepo.                       | Chose Alt B. Enables cross-package reuse between candidate web portal, admin portal, and documentation apps.          | **APPROVED** |
| **DEC-ENT-P10-05** | **Native W3C Server-Sent Events (SSE)**   | Alt A: WebSocket bidirectional connection.<br>Alt B: Server-Sent Events (SSE) for unidirectional agent thought streaming. | Chose Alt B. Simpler protocol, native HTTP/2 multiplexing, automatic browser reconnection, and proxy-friendly.        | **APPROVED** |
| **DEC-ENT-P10-06** | **Standalone Output Gated by CI**         | Alt A: Always build standalone container locally.<br>Alt B: `output: 'standalone'` gated behind `process.env.CI`.         | Chose Alt B. Local development builds remain instantaneous (2-5s) while production CI produces minimal Docker images. | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                               | Validation Method                                                                  | Invalidation Action                                                                            |    Status     |
| :----------------- | :---------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P10-01** | Modern evergreen browsers support Server-Sent Events (SSE) without third-party polyfills.             | Review of browser compatibility tables (caniuse.com: 98.4% global support).        | Implement long-polling fallback hook in `useAgentStream` if legacy browser detected.           | **VALIDATED** |
| **ASM-ENT-P10-02** | SWR deduping interval of 2000ms prevents duplicate concurrent GET requests during route transitions.  | Network inspection during rapid navigation across dashboard tabs.                  | Adjust `dedupingInterval` per hook instantiation where real-time accuracy is required.         | **VALIDATED** |
| **ASM-ENT-P10-03** | Standalone Next.js Node.js server consumes less than 250 MB RAM under 100 concurrent SSR requests.    | Memory profiling of Docker container running `node apps/web/server.js` under load. | Scale container replicas horizontally in Kubernetes and configure Node `--max-old-space-size`. | **VALIDATED** |
| **ASM-ENT-P10-04** | Fast developer commands (`pnpm dev:web` and `make dev-web`) start the web application in 2–5 seconds. | Empirical timing across developer workstations (measured 2.4s to 4.1s).            | Retain fail-fast ban on root `pnpm dev` command to prevent full-monorepo process hangs.        | **VALIDATED** |

---

## 4. Requirements Traceability Matrix Summary

| Requirement Baseline | Category           | Primary Deliverable    | Implementing Spec / Policy                      | Verification                        |    Status    |
| :------------------- | :----------------- | :--------------------- | :---------------------------------------------- | :---------------------------------- | :----------: |
| **ENT-P10-R01**      | App Router         | `DEL-ENT-P10-01`       | `01-frontend-code-app-router.md`                | 18+ verified live routes            | **VERIFIED** |
| **ENT-P10-R02**      | Typed Client       | `DEL-ENT-P10-02`       | `02-typed-client-state-architecture.md`         | `ApiClient` & SWR optimistic hooks  | **VERIFIED** |
| **ENT-P10-R03**      | SSE Streaming      | `DEL-ENT-P10-02`       | `02-typed-client-state-architecture.md`         | `useAgentStream` ReAct trajectories | **VERIFIED** |
| **ENT-P10-R04**      | UI-Kit Package     | `DEL-ENT-P10-03`       | `03-component-library-uikit.md`                 | 149 / 149 unit tests green          | **VERIFIED** |
| **ENT-P10-R05**      | Accessibility      | `DEL-ENT-P10-04`       | `04-accessibility-quality-testing.md`           | 0 Axe-core violations & 1 h1        | **VERIFIED** |
| **ENT-P10-R06**      | Overflow Invariant | `DEL-ENT-P10-04`       | `04-accessibility-quality-testing.md`           | 0px overflow across 6 viewports     | **VERIFIED** |
| **ENT-P10-R07**      | Performance        | `DEL-ENT-P10-05`       | `05-performance-deploy-readiness.md`            | 114.2 KB bundle & Web Vitals        | **VERIFIED** |
| **ENT-P10-R08**      | Quality Gate       | `DEL-ENT-P10-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p11.md` | Score: 99.31 / 100 (Full GO)        | **VERIFIED** |

---

_Signed: Frontend Governance Custodian & Web Release Lead — 2026-09-29_
