# ENT-P09 — 01 Source Register — Authoritative Source Inventory

> **Phase:** `ENT-P09` (UI/UX and Design System)  
> **Deliverable:** Supporting Source Register  
> **Owner:** Lead Design Systems Architect & Accessibility Specialist  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Internal Canonical Sources

| Source ID  | Document / Source Name                                          | Author / Authority           | UI/UX & Design System Constraints Extracted                                                                |
| :--------- | :-------------------------------------------------------------- | :--------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **INT-01** | `Universal_Enterprise_Phase_Prompt_Generator_and_Gatekeeper.md` | Vaeloom Governance Board     | Defines 32-section phase prompt structure, §28 12-category weighted gate scorecard, and entry audit rules. |
| **INT-02** | `vaeloom-mvp-e2e-enterprise-hardened.md`                        | Core Architecture Team       | Establishes the authoritative MVP hardening baseline, zero-trust UI requirements, and test suites.         |
| **INT-03** | `vaeloom-mvp-e2e.md`                                            | Engineering Leadership       | Records baseline user journeys across candidate and institutional interfaces.                              |
| **INT-04** | `vaeloom-enterprise-e2e.md`                                     | Enterprise Architecture Team | Outlines the 22-phase enterprise progression roadmap and institutional admin portal requirements.          |
| **INT-05** | `01-vaeloom-mvp-spec.md`                                        | Product Management           | Canonical scope boundary separating MVP core capabilities from advanced enterprise features.               |
| **INT-06** | `06-vaeloom-enterprise-paper.md`                                | Product Strategy             | Canonical enterprise vision: institutional multi-tenancy, candidate sovereign vaults, and 28 agents.       |
| **INT-07** | `packages/ui-kit`                                               | UI Platform Team             | Monorepo design system library containing tokens, primitives, and accessible React 19 components.          |
| **INT-08** | `apps/web`                                                      | Frontend Engineering         | Next.js 15 App Router implementation covering 18+ verified routes and SWR hydration.                       |
| **INT-09** | `DEL-ENT-P08-01`                                                | API Architecture Team        | OpenAPI 3.2.0 endpoint contracts, request/response models, and status code semantics.                      |
| **INT-10** | `apps/web/e2e/quality.spec.ts`                                  | QA Engineering               | Automated Playwright accessibility (WCAG AA), responsive overflow, and h1 header checks.                   |

---

## 2. External Standards & Regulatory Frameworks

| Source ID  | Standard / Authority                     |   Verified Snapshot    | Required UI/UX Implementation Controls                                                                    |
| :--------- | :--------------------------------------- | :--------------------: | :-------------------------------------------------------------------------------------------------------- |
| **EXT-01** | W3C WCAG 2.2 Level AA                    |   W3C Recommendation   | Full compliance: 4.5:1 text contrast, 3:1 UI component contrast, zero keyboard traps, focus rings.        |
| **EXT-02** | WAI-ARIA 1.2 Authoring Practices         |        W3C APG         | Keyboard navigation patterns for modal dialogs, comboboxes, tabs, menus, and disclosure widgets.          |
| **EXT-03** | Radix UI Primitives Specification        |  WorkOS / Radix Team   | Headless, unstyled accessible UI primitives with built-in ARIA state management.                          |
| **EXT-04** | Design Tokens Format (DTCG)              |  DTCG Community Group  | Standardized JSON token format for primitive, semantic, and component token layering.                     |
| **EXT-05** | Tailwind CSS Framework                   |     Tailwind Labs      | Utility-first CSS architecture with customized `@vaeloom/ui-kit` preset and CSS variables.                |
| **EXT-06** | Nielsen Norman Group Heuristics          |      NNG Research      | 10 Usability heuristics: visibility of system status, error prevention, recognition over recall.          |
| **EXT-07** | EU Artificial Intelligence Act           | Official 2026 Guidance | Article 50 transparency: explicit disclosures when users interact with generative AI or tailored outputs. |
| **EXT-08** | RFC 7807 (Problem Details for HTTP APIs) |     IETF Standard      | Standardized user-facing error state translation mapping API error types to actionable UI microcopy.      |
| **EXT-09** | Google Material Design 3 Elevation       |    Material Design     | Systematic surface elevation, shadow tokens, and dark mode contrast ratios.                               |
| **EXT-10** | Apple Human Interface Guidelines         |       Apple Inc.       | Touch target sizing (minimum $44 \times 44\text{px}$) and responsive layout behavior across viewports.    |
| **EXT-11** | OpenTelemetry RUM Semantic Conventions   |     CNCF Standard      | Real User Monitoring (RUM) metrics: Largest Contentful Paint (LCP), Interaction to Next Paint (INP).      |
| **EXT-12** | India DPDP Act 2023 Consent UI           |    MeitY Government    | Granular, unambiguous consent modal checkboxes with accessible multi-lingual explanations.                |
| **EXT-13** | US Section 508 Rehabilitation Act        |    US Access Board     | Federal accessibility compliance for higher education institutional deployments.                          |

_Signed: Lead Design Systems Architect & Accessibility Specialist — 2026-09-29_
