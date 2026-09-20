# 32. Testing Standards & Coverage Requirements

## 1. Zero-Trust Verification Framework

Every component and pattern in `@vaeloom/ui-kit` is verified against four strict
quality gates:

1. **Unit & State Testing (Jest / React Testing Library)**:
   - 100% branch coverage on interactive states (click, focus, hover, disabled).
   - Verifies keyboard interaction (`Enter`, `Space`, `Tab`, `ArrowKeys`,
     `Esc`).
2. **Automated Accessibility Testing (`jest-axe`)**:
   - Every component must pass `axe(container)` with 0 violations.
   - Tests ARIA attributes (`aria-expanded`, `aria-controls`,
     `aria-describedby`, `aria-live`).
3. **Token Integrity Verification (`tokens.test.ts`)**:
   - Validates that all semantic tokens resolve to valid primitive definitions
     across all three themes (Dark, Light, High-Contrast).
   - Validates generated CSS variable string output.
4. **End-to-End Regression (Playwright)**:
   - Visual and interaction testing within the integrated Next.js application
     shell.
   - Responsive viewport verification at 640px, 768px, 1024px, and 1280px.
