# MVP-P09 — README

## Status

DESIGN BASELINE — executed as design phase against live web app (no runtime
changes; implementation at P10, testing at P14). Gate: see `09-gate-report.md`.

## Deliverables

| ID                                          | File                                               |
| ------------------------------------------- | -------------------------------------------------- |
| DEL-MVP-P09-01 IA/journeys                  | `03-ia-journeys.md`                                |
| DEL-MVP-P09-02 Screen/state specs           | `04-screen-state-specs.md`                         |
| DEL-MVP-P09-03 Design system                | `05-design-system.md`                              |
| DEL-MVP-P09-04 Content/errors               | `06-content-errors.md`                             |
| DEL-MVP-P09-05 WCAG/usability evidence plan | `07-wcag-usability-plan.md`                        |
| Registers                                   | `08-registers.md`                                  |
| Gate report                                 | `09-gate-report.md`                                |
| Handoff                                     | `10-handoff-to-p10.md`                             |
| Source register + entry audit               | `01-source-register.md`, `02-predecessor-audit.md` |

## Evidence snapshot (EVD-MVP-P09-001)

Repo `master` @ `305ebfb` (P08). Web surface inventoried (live file listing):

- **Routes (27 pages):** login, signup, status + 18 workspace pages (dashboard,
  files, memory, resume, jobs, applications, chat, schedule, connectors,
  history, settings, admin, billing, organizations, feature-flags, marketplace,
  developer, developer/webhooks, notifications)
  - global/workspace error·loading·not-found + robots/sitemap.
- **Layout:** `layout/Sidebar` (17 nav links, emoji icons), `TopNav`,
  `ThemeToggle`; root layout: Space Grotesk + IBM Plex Mono (next/font),
  ThemeProvider, I18nProvider (en), KeyboardShortcutProvider + `?` modal,
  WebVitals, ErrorTrackingBoundary.
- **ui-kit:** Button (primary/secondary/ghost/danger, focus rings), Card, Input,
  Modal, Spinner.
- **Web shared:** EmptyState, ErrorState, ProgressBar, ProposalCard
  (approve/reject only — no diff/expiry), SearchInput, StatusBadge, Table,
  Toggle (focus ring).
- **Tokens:** tailwind theme — dark-first (`#0a0a0f` bg, `#8b9af0` periwinkle
  primary, `#ff7b72` coral accent, `#e2e8f0` text), `l-*` light palette,
  `class`-based dark mode.
- **A11y present:** focus-visible rings on interactive components, kbd shortcuts
  (`g d|m|j|r|s|c`, `/`, `n`, `?`, `Esc`), aria-labels/roles in parts.
- **A11y gaps found (design targets):** no skip link, emoji-only icons
  (aria-hidden needed), no focus trap in Modal, no reduced-motion handling, no
  focus management on route change, ErrorBoundary fallback a11y unverified.

## Decisions this phase

- **BQ-P09-01 (BQ-06):** desktop-first responsive web; English only (i18n en
  preserved); screen readers (NVDA/Win, VoiceOver/macOS) + keyboard-only =
  supported assistive tech; modern evergreen browsers
  (Chrome/Edge/Firefox/Safari). User-approved 2026-08-10.
- Design targets: approval diff + expiry, provenance/confidence/correction,
  scopes, data-right states (phase rule §13).
