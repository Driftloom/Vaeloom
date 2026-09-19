# Vaeloom Web Application (`@vaeloom/web`)

The Next.js 15 frontend application for Vaeloom — the personal intelligence and career co-pilot platform.

## Quick Start

```bash
# Run the web frontend (Fastest: 2-5s startup)
pnpm dev:web

# Or directly in apps/web
cd apps/web && pnpm next dev -p 3000

# Typecheck and lint
pnpm --filter @vaeloom/web typecheck
pnpm --filter @vaeloom/web lint
```

> **CRITICAL:** Do NOT run `pnpm dev` from the repository root (it triggers Nx across 25 packages). Always use `pnpm dev:web`.

## Architecture Overview

- **Framework:** Next.js 15 (App Router)
- **UI & Motion:** React 18, Tailwind CSS, `@vaeloom/ui-kit`, `motion`, `react-resizable-panels`, `three` (knowledge graph canvas)
- **Data Fetching & Caching:** SWR (`swr`) with typed API client (`apps/web/src/lib/api-client.ts`)
- **Key Serialization Rule:**
  Backend FastAPI endpoints serialize models in `snake_case` (e.g. `access_token`, `workspace_id`).
  The frontend expects `camelCase` (e.g. `accessToken`, `workspaceId`).
  Both `lib/api.ts` and `lib/api-client.ts` include automatic `transformKeys()` to seamlessly map responses.

## Route Structure (41 Page Routes)

- **Authentication (`app/(auth)`):** `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/mfa`
- **Workspace Navigation (`app/workspace/[workspaceId]`):**
  - Core: `/chat`, `/memory`, `/resume`, `/jobs`, `/applications`, `/approvals`
  - Management: `/files`, `/connectors`, `/notifications`, `/history`, `/settings`, `/profile`, `/vault`, `/schedule`
  - Enterprise: `/admin`, `/organizations`, `/marketplace`, `/developer`, `/feature-flags`, `/billing`
- **Public & System:** `/`, `/privacy`, `/terms`, `/status`, `/session-expired`, `/forbidden`

## Testing

```bash
# Run component & unit tests
cd apps/web && pnpm test

# Run Playwright E2E tests
pnpm exec playwright test
```

## Related Specifications & Documentation

- [Frontend Architecture Guide](../../docs/frontend/Frontend-Architecture.md)
- [Design System Specification](../../specs/frontend/Design-System.md)
- [Component Library Contract](../../specs/frontend/Component-Library.md)
- [Accessibility Compliance (WCAG 2.1 AA)](../../specs/frontend/Accessibility.md)
- [API Reference](../../specs/api/API-Reference.md)
