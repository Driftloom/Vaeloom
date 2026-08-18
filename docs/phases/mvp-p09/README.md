# MVP-P09 — README

## Status

DESIGN BASELINE — re-audited 2026-08-18. Original gate 88/100 (2026-08-10);
re-audit ~88/100 (2 minor corrections applied). Implementation at P10; testing
at P14. Gate: see `09-gate-report.md`.

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
| Re-audit evidence                           | `reaudit-2026-08-18.md`                            |
| Research evidence register                  | `research-register.md`                             |

## Evidence snapshot (EVD-MVP-P09-001 + RA-001)

Repo `master` @ `a0b9f26` (re-audit). Web surface inventoried (live file
listing):

- **Routes (23 pages):** login, signup, status + 18 workspace pages (dashboard,
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
- **Web shared:** EmptyState, ErrorState, ProgressBar, **ApprovalCard**
  (approve/reject + expiry + T3 warnings — re-audit: renamed from ProposalCard),
  SearchInput, StatusBadge, Table, Toggle (focus ring), ConfidenceMeter,
  DiffViewer, ExpiryTimer, ProvenanceBadge, SkipLink, Toast.
- **Tokens:** tailwind theme — dark-first (`#0a0a0f` bg, `#8b9af0` periwinkle
  primary, `#ff7b72` coral accent, `#e2e8f0` text), `l-*` light palette,
  `class`-based dark mode.
- **A11y present:** focus-visible rings on interactive components, kbd shortcuts
  (`g d|m|j|r|s|c`, `/`, `n`, `?`, `Esc`), aria-labels/roles in parts,
  skip-link, reduced-motion.
- **A11y gaps found (design targets):** emoji-only icons (aria-hidden needed),
  no focus trap in Modal, no focus management on route change, ErrorBoundary
  fallback a11y unverified.
- **Tests:** 32/32 pass (Toast, Modal, ApprovalCard, Sidebar, Connectors,
  useWorkspace).

## Re-audit corrections (2026-08-18)

| Item           | Original     | Corrected               | Evidence                                          |
| -------------- | ------------ | ----------------------- | ------------------------------------------------- |
| Route count    | 27           | **23** `page.tsx` files | `apps/web/src/app/**/page.tsx`                    |
| Component name | ProposalCard | **ApprovalCard**        | `apps/web/src/components/shared/ApprovalCard.tsx` |

## Decisions this phase

- **BQ-P09-01 (BQ-06):** desktop-first responsive web; English only (i18n en
  preserved); screen readers (NVDA/Win, VoiceOver/macOS) + keyboard-only =
  supported assistive tech; modern evergreen browsers
  (Chrome/Edge/Firefox/Safari). User-approved 2026-08-10.
- Design targets: approval diff + expiry, provenance/confidence/correction,
  scopes, data-right states (phase rule §13).
- **DEC-P09-RA-001:** Route count corrected to 23; ProposalCard renamed to
  ApprovalCard (re-audit 2026-08-18).
