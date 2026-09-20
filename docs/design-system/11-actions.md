# 11. Actions: Button, IconButton, ButtonGroup, Link

## 1. Component Overview

Action components trigger operations, submit forms, or navigate across views.
They provide clear tactile affordances and communicate pending/loading states
cleanly.

## 2. Variants & State Matrix

- **Variants**:
  - `primary`: High-emphasis call to action (`var(--button-primary-bg)`). Max 1
    primary action per section.
  - `secondary`: Default action, neutral outlined or subtle fill
    (`var(--button-secondary-bg)`).
  - `ghost`: Minimal visual weight, text-only until hovered.
  - `danger`: Destructive actions (delete, revoke, terminate).
  - `ai`: Agent trigger or AI copilot invocation.
- **Sizes**: `sm` (28px height), `md` (36px height), `lg` (44px height).
- **States**: `default`, `hover`, `active`, `focus-visible`, `disabled`,
  `loading`.

## 3. IconButton & ButtonGroup

- `<IconButton>`: Fixed square ratio (`sm`: 28x28, `md`: 36x36, `lg`: 44x44),
  mandatory `aria-label`.
- `<ButtonGroup>`: Visually and semantically groups related actions (e.g. view
  switchers, undo/redo). Supports `attached` borders.
