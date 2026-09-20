# 33. Visual Regression Testing Guide

## 1. Scope and Strategy

Visual regression tests ensure that design token adjustments, component
refactors, or layout updates do not produce unintended visual drift across
product surfaces.

## 2. Playwright Visual Regression Setup

- Tests are located in `apps/web/e2e/visual-regression.spec.ts`.
- Baseline screenshots are captured at fixed dimensions (`1280x800` desktop,
  `375x812` mobile).
- All animations and transitions are disabled during snapshot capture:
  ```css
  *,
  *::before,
  *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }
  ```
- Flakiness mitigation: Font rendering is stabilized via `document.fonts.ready`
  prior to snapshot capture.

## 3. Thresholds & Review

- Pixel difference tolerance: `maxDiffPixelRatio: 0.01` (1%).
- Any deviation exceeding threshold fails CI and requires design review before
  updating baselines.
