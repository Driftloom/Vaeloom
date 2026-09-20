# 04. Typography Scale & Hierarchy

## 1. Typeface Stack

- **UI & Body**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`,
  `Roboto`, `sans-serif`
- **Code, Hashes & Metrics**: `JetBrains Mono`, `Fira Code`, `ui-monospace`,
  `monospace`

## 2. Scale & Line Height Tokens

All font sizes are matched with fixed proportional line-heights to eliminate
baseline jitter:

| Token            | Size             | Line Height | Letter Spacing | Weight           | Typical Use                           |
| :--------------- | :--------------- | :---------- | :------------- | :--------------- | :------------------------------------ |
| `font-size-xs`   | 11px / 0.6875rem | 16px        | 0.02em         | Regular / Medium | Microcopy, badges, timestamps         |
| `font-size-sm`   | 13px / 0.8125rem | 18px        | 0.01em         | Regular / Medium | Table cells, secondary labels, inputs |
| `font-size-base` | 14px / 0.875rem  | 20px        | 0              | Regular / Medium | Primary body text, button labels      |
| `font-size-md`   | 16px / 1.000rem  | 24px        | -0.01em        | Regular / Medium | Lead text, modal headers              |
| `font-size-lg`   | 18px / 1.125rem  | 26px        | -0.01em        | Semibold         | Section headings, panel titles        |
| `font-size-xl`   | 20px / 1.250rem  | 28px        | -0.015em       | Semibold         | Page titles, major cards              |
| `font-size-2xl`  | 24px / 1.500rem  | 32px        | -0.02em        | Bold             | Workspace header, overview titles     |
| `font-size-3xl`  | 30px / 1.875rem  | 36px        | -0.025em       | Bold             | Hero headers, marketing banners       |

## 3. Numeric & Tabular Data

All numbers, counters, timestamps, latency gauges, and financial or resource
metrics must use:

```css
font-variant-numeric: tabular-nums lining-nums;
```

This guarantees alignment across rows in `DataTable` and telemetry panels.
