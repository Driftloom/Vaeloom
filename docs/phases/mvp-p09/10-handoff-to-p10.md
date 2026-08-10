# MVP-P09 → MVP-P10 Handoff

## Phase Summary

Designed accessible journeys, trust/approval/consent states, failure recovery,
design-system governance and usability evidence — grounded in the live web
surface (27 routes, ui-kit + shared components, tailwind tokens, keyboard
shortcuts, i18n en).

## Evidence

| ID                   | Requirement | Artifact                            |
| -------------------- | ----------- | ----------------------------------- |
| EVD-MVP-P09-001..004 | R01/R02/R04 | README + `05`–`07` (repo-grounding) |
| EVD-MVP-P09-005      | R03         | DEC-P09-01 question-tool record     |
| EVD-MVP-P09-006      | R08         | PENDING user ratification           |

## Gate: CONDITIONAL APPROVED — RESTRICTIONS APPLY (88/100)

| Restriction                                                           | Target phase |
| --------------------------------------------------------------------- | ------------ |
| 1. Approval card w/ diff + expiry + provenance (release-blocking)     | P10          |
| 2. Skip link, modal focus trap, focus mgmt, accessible icons          | P10          |
| 3. WCAG 2.2 AA + usability targets (≥80% task success, SUS ≥70)       | P10/P14      |
| 4. Enterprise nav visible-but-gated; no new routes beyond IA proposal | P10          |

## Open issues carried

- RISK-P09-01..05 (register §1) — owners assigned
- Modal focus trap / skip link / reduced-motion → P10 implementation
- jest-axe/axe-core pinned at P14; usability sessions with cohort at P14
- UNK-02 creds → P19 · UNK-P03-01 legal → P13 · VB-07 cohort → user

## Scope for MVP-P10 (Frontend Implementation)

- Implement the P09 design: nav regrouping (6 spaces, enterprise gated),
  approval card evolution, memory correction + history, data-rights journeys,
  consent scope UI, Gmail draft-only states, AI disclosure in chat, async job
  progress, full state taxonomy.
- Build design-system additions into `packages/ui-kit` (tokens + new components:
  toast, diff-viewer, provenance-badge, confidence-meter, expiry-timer,
  skip-link); dual dark/light tokens.
- Enforce restriction 2 (a11y) and restriction 4 (no new routes beyond IA
  proposal).
- Existing typed client + transformKeys patterns must be reused; no new runtime
  deps unless user-approved (P06 governance).
- Do NOT implement approval API calls before backend exists (P11) — design UI
  against the P08 contract; wire after P11.

## Constraints for successor

- Repo truth: web app is Next.js 15 app-router; jest.config.js exists for
  component tests; SWR caching + prefetching exist (P08 perf) — preserve.
- Follow existing conventions (AGENTS.md: transformKeys, no `pnpm dev`, CSP
  unchanged).
- Restriction 3 (P08, carried): CSRF list untouched.
