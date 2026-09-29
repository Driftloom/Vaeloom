# ENT-P10 — 01 Source Register — Authoritative Source Inventory

> **Phase:** `ENT-P10` (Frontend Implementation)  
> **Deliverable:** Supporting Source Register  
> **Owner:** Lead Web Applications Architect & Monorepo Specialist  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Internal Canonical Sources

| Source ID  | Document / Source Name                                          | Author / Authority           | Frontend Implementation Constraints Extracted                                                              |
| :--------- | :-------------------------------------------------------------- | :--------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **INT-01** | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Vaeloom Governance Board     | Defines 32-section phase prompt structure, §28 12-category weighted gate scorecard, and entry audit rules. |
| **INT-02** | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Core Architecture Team       | Establishes the authoritative MVP hardening baseline, zero-trust UI requirements, and test suites.         |
| **INT-03** | `vaeloom-mvp-e2e.md`                                            | Engineering Leadership       | Records baseline frontend route wiring and API client integrations.                                        |
| **INT-04** | `vaeloom-enterprise-e2e.md`                                     | Enterprise Architecture Team | Outlines the 22-phase enterprise progression roadmap and institutional admin portal requirements.          |
| **INT-05** | `01-vaeloom-mvp-spec.md`                                        | Product Management           | Canonical scope boundary separating MVP core capabilities from advanced enterprise features.               |
| **INT-06** | `06-vaeloom-enterprise-paper.md`                                | Product Strategy             | Canonical enterprise vision: institutional multi-tenancy, candidate sovereign vaults, and 28 agents.       |
| **INT-07** | `apps/web`                                                      | Frontend Engineering         | Next.js 15 App Router codebase with 18+ verified live pages and SWR hydration.                             |
| **INT-08** | `packages/ui-kit`                                               | UI Platform Team             | Monorepo design system library containing tokens, primitives, and accessible React 19 components.          |
| **INT-09** | `DEL-ENT-P08-01`                                                | API Architecture Team        | OpenAPI 3.2.0 endpoint contracts, request/response models, and status code semantics.                      |
| **INT-10** | `DEL-ENT-P09-03`                                                | Design Systems Team          | Three-tier design token definitions, color schemes, and Radix component specifications.                    |

---

## 2. External Standards & Regulatory Frameworks

| Source ID  | Standard / Authority                     |  Verified Snapshot   | Required Frontend Implementation Controls                                                    |
| :--------- | :--------------------------------------- | :------------------: | :------------------------------------------------------------------------------------------- |
| **EXT-01** | Next.js 15 App Router Architecture       |     Vercel Docs      | React 19 Server Components, streaming SSR, route handlers, error boundaries.                 |
| **EXT-02** | SWR v2 Data Fetching Library             |      Vercel SWR      | Stale-while-revalidate client caching, optimistic mutation rollbacks, automatic dedup.       |
| **EXT-03** | TypeScript 5.5 Specification             | Microsoft TypeScript | Strict mode (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`).               |
| **EXT-04** | Tailwind CSS Framework                   |    Tailwind Labs     | Utility-first CSS architecture with customized `@vaeloom/ui-kit` preset and CSS variables.   |
| **EXT-05** | Playwright Test Automation               | Microsoft Playwright | Headless browser functional tests, responsive overflow assertions, axe-core scans.           |
| **EXT-06** | W3C Server-Sent Events (SSE)             |     W3C Standard     | Real-time unidirectional streaming connection for LLM reasoning thoughts and tool calls.     |
| **EXT-07** | W3C WCAG 2.2 Level AA                    |  W3C Recommendation  | Full accessibility compliance: 4.5:1 text contrast, zero keyboard traps, focus rings.        |
| **EXT-08** | RFC 7807 (Problem Details for HTTP APIs) |    IETF Standard     | Client-side error state translation mapping API error types to actionable user microcopy.    |
| **EXT-09** | Web Vitals Standard                      |  Google Chrome Team  | LCP $\le 1.8\text{s}$, INP $\le 150\text{ms}$, CLS $\le 0.10$ measured on production builds. |
| **EXT-10** | Node.js 20 LTS Runtime                   |     Node.js TSC      | Server-side rendering runtime executing Next.js standalone server with zero memory leaks.    |

_Signed: Lead Web Applications Architect & Monorepo Specialist — 2026-09-29_
