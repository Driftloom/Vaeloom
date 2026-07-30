# ADR-002: Use Next.js 15 for Frontend

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

The Vaeloom web frontend must support server-side rendering, dynamic routing for 16+ pages, image optimization, streaming SSR for AI chat responses, and integrate with a typed API client. The frontend is a monorepo package with shared UI components in a separate `ui-kit` package.

Options considered: Next.js 15, Remix, SvelteKit, Nuxt 3, plain React with Vite.

## Decision

Use **Next.js 15** with the App Router for the frontend application.

Key drivers:
- **Server Components** — reduce client-side JS for static pages (landing, docs, settings)
- **Streaming SSR** — enables progressive rendering of AI chat responses via `loading.tsx` and Suspense boundaries
- **Image Optimization** — built-in `<Image>` component with Sharp for automatic AVIF/WebP conversion
- **Route Groups and Parallel Routes** — support complex dashboard layouts with per-route `error.tsx`, `loading.tsx`, `not-found.tsx`
- **Monorepo-native** — Nx integration via `@nx/next` for build caching across 25 packages
- **Middleware** — enables authentication checks and tenant routing at the edge before pages render

## Consequences

**Positive:**
- All 16 pages have typed API client integration via the shared SDK
- Per-route error boundaries (`error.tsx`) and loading states (`loading.tsx`) provide granular UX fallbacks
- `next.config.js` `output: 'standalone'` enables minimal Docker images for deployment
- Route prefetching and SWR caching (already configured) deliver fast page transitions
- Bundle analysis via `@next/bundle-analyzer` helps identify optimization opportunities

**Negative:**
- Node.js server required at runtime (no static export for full SPA — we need SSR for SEO and streaming)
- Build times increase with page count; mitigated by Nx computation caching
- App Router has a steeper learning curve than Pages Router for team members
