# 39. Design System Audit Protocol

## 1. Audit Frequency & Triggers

A design system audit is executed:

- Prior to every minor and major release.
- Whenever a new product surface is introduced.
- As a continuous automated check in CI.

## 2. Audit Verification Checks

1. **Hex Color Scan**: Run `ripgrep` for raw hex codes (`#[0-9a-fA-F]{3,8}`)
   across `apps/web/src/app/`. Expected count: 0.
2. **Inline SVG Scan**: Run `ripgrep` for `<svg` elements outside
   `@vaeloom/ui-kit/icons`. Expected count: 0.
3. **Hardcoded Spacing Scan**: Verify that all margins, paddings, and gaps use
   token values (multiples of 4px).
4. **Accessibility Violations**: Execute Playwright axe audit across all
   canonical routes. Expected violations: 0.
5. **Component Duplication**: Verify that no duplicate primitive components
   exist in `apps/web/src/components/shared/`.
