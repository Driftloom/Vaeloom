# 16. Overlays: Modal, Drawer, Tooltip, Popover, Dropdown

## 1. Modal Dialogs

- Centered dialogs for focused, blocking tasks (e.g. destructive actions,
  credentials configuration).
- Sizes: `sm` (400px), `md` (540px), `lg` (720px), `xl` (960px), `full` (95vw).
- Focus trap enabled, `Esc` to close, backdrop click dismisses (unless
  configured as strict confirmation).
- Accessible title and description linked via `aria-labelledby` and
  `aria-describedby`.

## 2. Drawers / Slide-Over Panels

- Edge-docked panels sliding in from the right.
- Width: `400px` standard, `600px` wide, `800px` inspector.
- Ideal for: Agent run inspection, memory entity details, document preview,
  provenance source audit.

## 3. Tooltips & Popovers

- `<Tooltip>`: Lightweight informational hover/focus labels for icon buttons and
  truncated text. Never contains interactive elements.
- `<Popover>`: Interactive floating panels triggered by click (e.g. filter
  menus, date pickers).
- `<Dropdown>`: Action menus with keyboard navigation (`Up`/`Down`, `Enter`,
  `Esc`).
