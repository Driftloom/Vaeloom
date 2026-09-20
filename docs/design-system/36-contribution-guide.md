# 36. Contribution & Extension Guide

## 1. Contribution Workflow

1. **RFC / Proposal**: For any new component or token addition, open a proposal
   detailing:
   - Problem statement and user need.
   - Figma design link and component contract.
   - Accessibility considerations (keyboard interaction, ARIA roles).
2. **Implementation**:
   - Create component in `packages/ui-kit/src/components/<Category>/`.
   - Add unit tests with 100% branch coverage and `jest-axe` a11y tests in
     `__tests__/`.
   - Export component and TypeScript props from `src/index.ts`.
3. **Review & Gate**:
   - Must pass all 8 design system release gates (`DS-GATE-01` through
     `DS-GATE-08`).
   - PR must include zero raw hex colors and zero inline SVGs.
