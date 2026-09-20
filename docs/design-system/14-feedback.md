# 14. Feedback & Status: Alert, Banner, Toast, Progress, Skeleton

## 1. Alert & Banner

- `<Alert>`: Contextual inline notice within pages or cards.
  - Variants: `info`, `success`, `warning`, `danger`.
  - Supports title, description, action link/button, and dismissibility.
- `<Banner>`: Full-width high-priority system announcements (e.g. maintenance,
  degraded agent connectivity).

## 2. Toast Notifications

- Ephemeral notification stack managed by a central toast provider.
- Position: Top-right or bottom-right.
- Auto-dismiss: Default 5000ms with manual close action and pause on hover.
- Accessible: Announce polite or assertive notifications to screen readers.

## 3. Progress & Loading

- `<Progress>`: Linear progress bar for deterministic operations (file uploads,
  batch migrations).
- `<Spinner>`: Circular indeterminate loading indicator (`sm`, `md`, `lg`).
- `<Skeleton>`: Structural placeholder matching destination layout geometry to
  prevent cumulative layout shift (CLS).
