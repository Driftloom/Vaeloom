# 13. Data Display: DataTable, List, StatCard, Badge, Avatar

## 1. DataTable

The core enterprise workhorse for tabular data display:

- Density controls: `compact` (32px), `comfortable` (44px), `spacious` (52px).
- Column sorting, filtering, selection checkboxes, and sticky headers.
- Pagination and infinite virtualized scrolling support.
- Empty states and loading skeleton rows.

## 2. StatCard & Telemetry Cards

Standardized metrics card for dashboards:

- Key Value / Metric (`font-variant-numeric: tabular-nums`).
- Label / Title.
- Delta indicator (`+12.4%`, `-3.2%`) with semantic color and trend icon.
- Optional sparkline or micro-bar visualization.

## 3. Badge & Status Indicators

- `<Badge>`: Categorical labels with variants (`neutral`, `info`, `success`,
  `warning`, `danger`, `ai`).
- `<StatusDot>`: 6px or 8px colored indicator with pulse animation for active
  operations.
- `<Avatar>`: User, Agent, or Organization glyph with fallback initials.
