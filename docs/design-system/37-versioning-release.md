# 37. Versioning & Release Governance

## 1. Semantic Versioning

`@vaeloom/ui-kit` follows strict Semantic Versioning (`MAJOR.MINOR.PATCH`):

- **MAJOR**: Breaking changes to component APIs, removed tokens, or changed CSS
  variable names.
- **MINOR**: New components, new tokens, new non-breaking props, or
  backward-compatible enhancements.
- **PATCH**: Bug fixes, accessibility enhancements, performance optimizations,
  and documentation updates.

## 2. Release Gates

A release candidate must pass all 8 release gates:

- `DS-GATE-01`: Zero-trust baseline audit completed and verified.
- `DS-GATE-02`: 40 canonical specification documents published and reviewed.
- `DS-GATE-03`: Design token engine passes integrity validation across Dark,
  Light, and High-Contrast themes.
- `DS-GATE-04`: `@vaeloom/ui-kit` contains 60+ components with complete state
  contracts and zero accessibility violations.
- `DS-GATE-05`: Curated SVG icon system in `@vaeloom/ui-kit/icons` completely
  eliminates inline SVGs.
- `DS-GATE-06`: AppShell and navigation fully migrated to canonical tokens and
  components.
- `DS-GATE-07`: 52 product surfaces migrated across all 4 waves.
- `DS-GATE-08`: Zero raw hex colors remain in `apps/web/src/app/`, and all E2E
  tests pass.
