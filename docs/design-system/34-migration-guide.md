# 34. Migration Guide for Product Surfaces

## 1. Migration Overview

This guide provides step-by-step instructions for migrating legacy Vaeloom
frontend surfaces from ad-hoc styles and `apps/web/src/components/shared/` to
the canonical `@vaeloom/ui-kit`.

## 2. Step-by-Step Migration Pattern

### Step 1: Replace Imports

Replace imports from `@/components/shared/*` with `@vaeloom/ui-kit`:

```typescript
// BEFORE
import { Badge } from '@/components/shared/Badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Table } from '@/components/shared/Table';

// AFTER
import { Badge, ConfirmationDialog, DataTable } from '@vaeloom/ui-kit';
```

### Step 2: Replace Hardcoded Hex Colors

Replace raw hex codes with semantic Tailwind classes or CSS variables:

- `#08080a` / `#0f0f12` -> `bg-[var(--color-bg-canvas)]` or
  `bg-[var(--color-bg-surface)]`
- `#3b82f6` -> `text-[var(--color-action-primary)]`
- `#10b981` -> `text-[var(--color-status-success)]`
- `#ef4444` -> `text-[var(--color-status-danger)]`

### Step 3: Replace Inline SVG Icons

Replace raw inline `<svg>` elements with canonical icons from
`@vaeloom/ui-kit/icons`:

```typescript
// BEFORE
<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">...</svg>

// AFTER
import { CheckIcon, ChevronDownIcon, SearchIcon } from '@vaeloom/ui-kit/icons';
<CheckIcon size={16} />
```

### Step 4: Verification

Run TypeScript typecheck and verify that the page renders without visual
regression.
