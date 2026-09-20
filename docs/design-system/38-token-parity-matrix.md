# 38. Token Parity Matrix

## 1. Parity Verification

This matrix tracks the 1:1 mapping between Primitive, Semantic, and Theme tokens
across Dark, Light, and High-Contrast modes.

| Semantic Token         | Dark Mode Value | Light Mode Value | High-Contrast Value | CSS Variable             |
| :--------------------- | :-------------- | :--------------- | :------------------ | :----------------------- |
| `color.bg.canvas`      | `#08080a`       | `#f8f9fc`        | `#000000`           | `--color-bg-canvas`      |
| `color.bg.surface`     | `#111114`       | `#ffffff`        | `#0a0a0a`           | `--color-bg-surface`     |
| `color.bg.elevated`    | `#18181c`       | `#f1f3f7`        | `#141414`           | `--color-bg-elevated`    |
| `color.text.primary`   | `#f4f4f5`       | `#09090b`        | `#ffffff`           | `--color-text-primary`   |
| `color.text.secondary` | `#a1a1aa`       | `#52525b`        | `#e4e4e7`           | `--color-text-secondary` |
| `color.text.muted`     | `#71717a`       | `#71717a`        | `#d4d4d8`           | `--color-text-muted`     |
| `color.border.subtle`  | `#27272a`       | `#e4e4e7`        | `#52525b`           | `--color-border-subtle`  |
| `color.border.strong`  | `#3f3f46`       | `#d4d4d8`        | `#ffffff`           | `--color-border-strong`  |
| `color.action.primary` | `#3b82f6`       | `#2563eb`        | `#60a5fa`           | `--color-action-primary` |
| `color.status.success` | `#10b981`       | `#059669`        | `#34d399`           | `--color-status-success` |
| `color.status.warning` | `#f59e0b`       | `#d97706`        | `#fbbf24`           | `--color-status-warning` |
| `color.status.danger`  | `#ef4444`       | `#dc2626`        | `#f87171`           | `--color-status-danger`  |
| `color.ai.accent`      | `#6366f1`       | `#4f46e5`        | `#818cf8`           | `--color-ai-accent`      |
| `color.focus.ring`     | `#3b82f6`       | `#2563eb`        | `#ffffff`           | `--color-focus-ring`     |
