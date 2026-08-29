# 01 — Implementation Baseline (2026-08-29)

> Captured BEFORE any Phase 01 changes.

## Environment

| Field      | Value                                      |
| ---------- | ------------------------------------------ |
| Commit     | `ca727d274956d5fb645e7716f10609faf028bceb` |
| Branch     | `master`                                   |
| Node       | v24.19.0                                   |
| pnpm       | 9.12.0                                     |
| Next.js    | ^15.0.0                                    |
| Three.js   | 0.170.0                                    |
| Motion     | ^13.1.1                                    |
| Git status | Clean (only untracked audit docs)          |

## Performance Baseline

> **NOT MEASURED** — Lighthouse/Web Vitals not available in current environment.
> Metrics below are estimates from Phase 00 audit. Formal measurement deferred
> to post-implementation.

| Metric                   | Estimated | Formal?  |
| ------------------------ | --------- | -------- |
| Lighthouse Performance   | —         | NO       |
| LCP                      | —         | NO       |
| CLS                      | —         | NO       |
| INP                      | —         | NO       |
| TTFB                     | —         | NO       |
| JS transferred (initial) | ~100KB    | NO       |
| CSS transferred          | ~18KB     | NO       |
| 3D JS (lazy)             | ~750KB    | NO       |
| Fonts                    | ~40KB     | NO       |
| FPS (desktop)            | —         | NO       |
| FPS (mobile)             | —         | NO       |
| Draw calls               | ≤12       | ESTIMATE |
| Memory                   | —         | NO       |

## 3D Architecture Baseline

| Component           | Status                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| StageProvider       | LIVE — single WebGL context                                                                                            |
| StageSlot beats     | 7 (hero, journey, memory, agents, connectors, growth, cta)                                                             |
| DustField           | LIVE — separate ambient context                                                                                        |
| Dead Scene wrappers | 7 (MemoryCoreScene, KnowledgeGraphScene, AgentOrbitScene, ConnectorFlowScene, JourneyScene, GrowthScene, CtaCoreScene) |
| Dead mountStage     | 1 (stageScene.ts:354)                                                                                                  |
| Total dead symbols  | 8                                                                                                                      |

## Section Baseline

| #   | Section             | 3D Beat    | Has Reveal           |
| --- | ------------------- | ---------- | -------------------- |
| 1   | HeroSection         | hero       | NO (parallax)        |
| 2   | ProblemSection      | —          | YES                  |
| 3   | PrinciplesStrip     | —          | YES                  |
| 4   | ProductDifference   | —          | YES                  |
| 5   | HowItWorks          | journey    | YES (IO + Reveal)    |
| 6   | MemorySection       | memory     | YES                  |
| 7   | AgentSection        | agents     | YES                  |
| 8   | ConnectorSection    | connectors | YES                  |
| 9   | OrganizationSection | —          | YES                  |
| 10  | ResumeSection       | —          | YES                  |
| 11  | CareerSection       | —          | YES                  |
| 12  | SchedulerSection    | —          | YES                  |
| 13  | TrustSection        | —          | YES                  |
| 14  | ProductPreview      | —          | YES                  |
| 15  | CompoundingSection  | growth     | NO (scroll-scrubbed) |
| 16  | FAQSection          | —          | YES                  |
| 17  | FinalCTA            | cta        | YES                  |
| 18  | LandingFooter       | —          | NO                   |

## Accessibility Baseline

| Check             | Status                                              |
| ----------------- | --------------------------------------------------- |
| Tab ARIA linkage  | MISSING (AgentSection, ProductPreview)              |
| Hero eyebrow      | NOT RENDERED                                        |
| Hero CTAs         | NOT RENDERED                                        |
| Hero credibility  | NOT RENDERED                                        |
| Reduced motion    | 3-layer (CSS + Framer + useSyncExternalStore)       |
| Skip link         | IMPLEMENTED                                         |
| sr-only fallbacks | 4 (HowItWorks, Memory, Compounding, Footer heading) |
