# 10. Accessibility & WCAG 2.2 AA Compliance

## 1. Compliance Target

Vaeloom targets **WCAG 2.2 Level AA** compliance across 100% of product
surfaces.

## 2. Contrast Ratios

- **Normal Body Text (<18px / <14px bold)**: Minimum `4.5:1` contrast against
  its background.
- **Large Text (>=18px / >=14px bold)**: Minimum `3.0:1` contrast against its
  background.
- **Interactive UI Components & Borders**: Minimum `3.0:1` contrast against
  adjacent colors.
- **Focus Visible Indicators**: Minimum `3.0:1` contrast against both the
  component and the page background.

## 3. Keyboard Navigation & Focus Rings

- Every interactive control is keyboard focusable via `Tab` / `Shift+Tab`.
- Focus rings are styled uniformly with a `2px` ring and `2px` offset using
  `var(--color-focus-ring)`.
- Custom components must never use `outline: none` without providing an explicit
  `:focus-visible` replacement.
- Modals and Drawers trap focus with `aria-modal="true"` and restore focus to
  the triggering element upon dismissal.
- Skip links are provided at the top of the AppShell to bypass navigation
  directly to main content (`#main-content`).

## 4. Screen Reader Support & ARIA

- Purely decorative icons must include `aria-hidden="true"`.
- Actionable icon-only buttons must declare an `aria-label` or visually hidden
  label via `<VisuallyHidden>`.
- Asynchronous state changes (agent runs, notifications) broadcast via
  `aria-live="polite"` or `role="status"`.
- Critical alerts broadcast via `role="alert"` / `aria-live="assertive"`.
