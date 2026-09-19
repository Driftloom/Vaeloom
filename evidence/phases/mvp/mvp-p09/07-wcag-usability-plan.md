# MVP-P09 — 07. WCAG & Usability Evidence Plan (DEL-MVP-P09-05)

> Owner: Accessibility Specialist + QA. Target: WCAG 2.2 Level AA (EXT-05) on
> the boundary in BQ-P09-01. **Plan defined here; executed at P14.**

## 1. Compliance baseline (from repo inspection)

| Area | Current evidence | Gap (design targets) |
| -------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| Keyboard | shortcuts (g*, /, n, ?, Esc); focus rings on components | skip link; modal focus trap; focus mgmt on route change |
| Semantics | aria-labels/roles in parts (ApprovalCard, Toggle) | audit all interactive components; heading order; landmark regions |
| Contrast | tokens contrast-verified by design (§05.2) | automated + manual P14 |
| Icons | emoji-only nav (CF-P09-03) | aria-hidden emoji / SVG with labels |
| Motion | none handled | `prefers-reduced-motion` respect |
| Zoom/reflow | responsive classes exist | 200% zoom + 320px reflow tests |
| Screen readers | unverified | NVDA (Win) + VoiceOver (macOS) passes on J1–J9 journeys |
| Auth | forms exist | accessible auth: labels, error announcements, no timeouts on password entry |

## 2. Automated audit (P14 — axe-core + jest-axe)

- CI job: axe on every rendered route (23 pages), WCAG 2.2 AA ruleset, zero
 critical/serious violations.
- Contrast + `aria` + focus checks in component tests (jest-axe in web jest
 config — jest.config.js exists).

## 3. Manual testing matrix (P14)

| Test | Method | Pass criteria |
| ------------------------ | --------------------------------- | ------------------------------------------------------------------ |
| Keyboard-only | full journeys J1–J9 without mouse | every action reachable; visible focus; no traps |
| NVDA / VoiceOver | journeys J1–J9 | correct announcements, labels, live regions, no unlabeled controls |
| Zoom 200% + reflow 320px | resize checks | no content loss, no horizontal scroll |
| Reduced motion | OS-level flag | no vestibular-triggering animation |
| Error recovery | force failure states | readable copy + recovery action (per §04 taxonomy) |
| Touch targets | mobile web viewport | ≥44px targets |

## 4. Usability validation (P14, small-cohort honesty)

- 5 representative users (from N≈10–20 cohort) × 5 tasks: ingest doc, correct
 memory, approve a suggestion, review draft, export data.
- Metrics: task success ≥80%, SUS ≥70 (targets), 0 critical errors on
 trust/approval/rights journeys.
- Evidence: recorded commands/sessions, results table, fixes tracked to P14
 gate.

## 5. Enforcement

- a11y checklist gate: new/edited pages blocked if any WCAG 2.2 AA automated
 violation or skip-link/focus regression.
- Keyboard shortcuts documented in UI (`?` modal exists) and must not conflict
 with screen-reader/AT combos.
