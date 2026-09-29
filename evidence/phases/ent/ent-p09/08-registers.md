# ENT-P09 — 08 Registers — Risk, Decision, Assumption & Traceability

> **Phase:** `ENT-P09` (UI/UX and Design System)  
> **Deliverable:** `DEL-ENT-P09-08` — Consolidated Governance Registers  
> **Owner:** UI/UX Governance Custodian & Design Standards Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Enterprise Risk Register

| Risk ID             | Risk Description                                                                                                       | Severity |         Impact          | Mitigation Strategy                                                                                            | Owner           |     Status     |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------- | :------: | :---------------------: | :------------------------------------------------------------------------------------------------------------- | :-------------- | :------------: |
| **RISK-ENT-P09-01** | Rapid streaming tokens from LLMs cause severe layout shifts (CLS) and screen reader stutter.                           |   High   |  Poor user experience   | Container fixed height reserve; `StreamingCard` with debounced RAF animation and polite ARIA region.           | Frontend Lead   | **CONTROLLED** |
| **RISK-ENT-P09-02** | Accessibility regression introduced in custom component primitives fails institutional procurement audit.              | Critical |  Enterprise deal block  | Automated Axe-core scans in Playwright CI (`quality.spec.ts`); zero-tolerance gate on critical/serious issues. | A11y Lead       | **CONTROLLED** |
| **RISK-ENT-P09-03** | Visual overlap between candidate sovereign vault and institutional views confuses user about data boundaries.          |   High   |  Candidate trust loss   | Distinct color tokens (Indigo/Slate vs Navy/Zinc); explicit sovereign lock icons on candidate private data.    | Design Director | **CONTROLLED** |
| **RISK-ENT-P09-04** | Complex data tables and multi-column forms cause horizontal scroll overflow on narrow mobile devices ($320\text{px}$). |  Medium  | Mobile usability defect | Responsive layout adaptation; mobile card transformation; verified 0px horizontal overflow suite.              | UI Engineer     | **CONTROLLED** |
| **RISK-ENT-P09-05** | Candidates accidentally trigger irreversible cryptographic purge without understanding consequences.                   | Critical | Irreversible data loss  | High-friction HITL modal requiring typed string confirmation ("DELETE MY DATA") before DEK shredding.          | Product Lead    | **CONTROLLED** |

---

## 2. Enterprise Decision Register

| Decision ID        | Decision Title                               | Context & Alternatives                                                                                                                              | Chosen Rationale                                                                                                      |    Status    |
| :----------------- | :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- | :----------: |
| **DEC-ENT-P09-01** | **Headless Radix UI Primitives**             | Alt A: Monolithic UI library (MUI / AntD).<br>Alt B: Headless Radix UI primitives wrapped in `@vaeloom/ui-kit`.                                     | Chose Alt B. Provides 100% accessible ARIA semantics while allowing bespoke enterprise Tailwind styling.              | **APPROVED** |
| **DEC-ENT-P09-02** | **Three-Tier Design Token Architecture**     | Alt A: Hardcoded Tailwind hex values.<br>Alt B: DTCG-compliant three-tier tokens (Primitive -> Semantic -> Component).                              | Chose Alt B. Enables seamless Dark Mode adaptation and institutional theme customization.                             | **APPROVED** |
| **DEC-ENT-P09-03** | **Dual-Experience Visual Language**          | Alt A: Monolithic single-theme design across all user types.<br>Alt B: Dual-experience design separating Candidate Vault from Institutional Admin.  | Chose Alt B. Emotionally supports candidate career empowerment while providing dense analytical oversight for admins. | **APPROVED** |
| **DEC-ENT-P09-04** | **EU AI Act Persistent Badging & Citations** | Alt A: Hidden AI attribution in footer.<br>Alt B: Visible AI attribution badges with interactive provenance source anchors.                         | Chose Alt B. Exceeds EU AI Act Article 50 transparency mandates and prevents synthetic hallucination deception.       | **APPROVED** |
| **DEC-ENT-P09-05** | **Zero-Tolerance Playwright Quality Gate**   | Alt A: Manual accessibility audits.<br>Alt B: Automated CI quality gate asserting 1 `<h1>`, 0 a11y violations, and 0px overflow across 6 viewports. | Chose Alt B. Eliminates human oversight and prevents accessibility regressions from reaching production.              | **APPROVED** |
| **DEC-ENT-P09-06** | **Mandatory Five-State UI Coverage**         | Alt A: Ad-hoc component loading states.<br>Alt B: Strict 5-state requirement (Loading, Empty, Partial, Active, Error) on every surface.             | Chose Alt B. Eliminates white screens and unhandled runtime exceptions.                                               | **APPROVED** |

---

## 3. Enterprise Assumption Register

| Assumption ID      | Statement of Assumption                                                                                                 | Validation Method                                                                 | Invalidation Action                                                                     |    Status     |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- | :-----------: |
| **ASM-ENT-P09-01** | Modern enterprise desktop and mobile browsers fully support CSS Custom Properties and CSS Grid layout.                  | Cross-browser compatibility testing via Playwright (Chromium, Firefox, WebKit).   | Provide polyfill or simplified Flexbox fallback for legacy browsers if required.        | **VALIDATED** |
| **ASM-ENT-P09-02** | Screen readers (VoiceOver, NVDA, JAWS) reliably announce ARIA live regions with `aria-live="polite"`.                   | Empirical manual testing with VoiceOver on macOS/iOS and NVDA on Windows.         | Add fallback visual toast notifications alongside screen reader announcements.          | **VALIDATED** |
| **ASM-ENT-P09-03** | Institutional administrators prefer high-density information tables over oversized marketing cards.                     | User research interviews with 15 university career services directors.            | Provide layout density toggle (Comfortable, Compact, Dense) in admin settings.          | **VALIDATED** |
| **ASM-ENT-P09-04** | Candidate users on mobile devices require touch targets of at least $44 \times 44\text{px}$ for error-free interaction. | Usability benchmarking following Apple Human Interface Guidelines and WCAG 2.5.5. | Enforce minimum $44\text{px}$ padding and margin utility wrappers in `@vaeloom/ui-kit`. | **VALIDATED** |

---

## 4. Requirements Traceability Matrix Summary

| Requirement Baseline | Category        | Primary Deliverable    | Implementing Spec / Policy                      | Verification                          |    Status    |
| :------------------- | :-------------- | :--------------------- | :---------------------------------------------- | :------------------------------------ | :----------: |
| **ENT-P09-R01**      | IA & Journeys   | `DEL-ENT-P09-01`       | `01-information-architecture.md`                | Dual-experience site map & 4 journeys | **VERIFIED** |
| **ENT-P09-R02**      | Screen Specs    | `DEL-ENT-P09-02`       | `02-screen-state-specs.md`                      | 8 Surfaces & 5 mandatory UI states    | **VERIFIED** |
| **ENT-P09-R03**      | Design Tokens   | `DEL-ENT-P09-03`       | `03-design-system-tokens.md`                    | DTCG 3-tier tokens & Radix components | **VERIFIED** |
| **ENT-P09-R04**      | Content & Voice | `DEL-ENT-P09-04`       | `04-content-microcopy-errors.md`                | Voice pillars & EU AI Act badging     | **VERIFIED** |
| **ENT-P09-R05**      | Error Microcopy | `DEL-ENT-P09-04`       | `04-content-microcopy-errors.md`                | RFC 7807 user translation dictionary  | **VERIFIED** |
| **ENT-P09-R06**      | WCAG 2.2 AA     | `DEL-ENT-P09-05`       | `05-accessibility-wcag-usability.md`            | Zero critical Axe-core violations     | **VERIFIED** |
| **ENT-P09-R07**      | Quality Suite   | `DEL-ENT-P09-07`       | `quality.spec.ts`                               | 1 h1, 0px overflow across 6 viewports | **VERIFIED** |
| **ENT-P09-R08**      | Quality Gate    | `DEL-ENT-P09-06`, `09` | `06-gate-report.md`, `09-handoff-to-ent-p10.md` | Score: 99.31 / 100 (Full GO)          | **VERIFIED** |

---

_Signed: UI/UX Governance Custodian & Design Standards Lead — 2026-09-29_
