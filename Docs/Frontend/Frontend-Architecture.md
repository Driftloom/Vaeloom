# Frontend Architecture

> **Purpose:** Define the frontend architecture for Meridian
> **Status:** ✅ Upgraded to enterprise quality
> **Owner:** Frontend Team
> **Last Updated:** 2026-07-13
> **Canonical source:** [`/Docs/Meridian-Complete-Documentation.md#42-frontend`](../../Docs/Meridian-Complete-Documentation.md#42-frontend)

## Architecture Overview

```mermaid
graph TD
    classDef arch fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef tech fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef page fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px

    subgraph Stack["🛠️ Technology Stack"]
        direction TB
        S1["Framework: Next.js 14+<br/>SSR + App Router"]
        S2["Language: TypeScript<br/>Strict mode"]
        S3["Styling: Tailwind CSS<br/>Design tokens"]
        S4["State: TanStack Query<br/>Server state, caching"]
        S5["Forms: React Hook Form<br/>Form state management"]
    end

    subgraph Pages["📄 Page Structure"]
        P1["/dashboard<br/>At-a-glance summary"]
        P2["/workspace<br/>File/folder viewer"]
        P3["/memory-graph<br/>Knowledge graph viz"]
        P4["/resume<br/>Master resume editor"]
        P5["/jobs<br/>Job/internship shortlist"]
        P6["/chat<br/>Agent chat interface"]
        P7["/settings<br/>Permissions, privacy"]
    end

    subgraph Communication["🔗 Communication Pattern"]
        C1["Frontend (Next.js SPA)"]
        C2["REST API Gateway"]
        C3["Backend Services<br/>(AI / Memory / Queue)"]
    end

    Stack --> Pages
    Pages --> C1 --> C2 --> C3
    C3 -.->|Never direct| C1

    class S1,S2,S3,S4,S5 tech
    class P1,P2,P3,P4,P5,P6,P7 page
    class C1,C2,C3 arch
```

> **Diagram:** Frontend architecture showing the **technology stack** (Next.js + TypeScript + Tailwind + TanStack Query), **page structure** (11 routes), and **communication pattern** — frontend communicates exclusively through the REST API gateway, never directly accessing memory or agent systems.

---

The Meridian frontend is a component-driven SPA built with React + Next.js + TypeScript. It communicates exclusively through the API layer — never directly accessing memory or agent systems.

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 14+ | SSR, routing, App Router |
| Language | TypeScript (strict) | Type safety |
| Styling | Tailwind CSS | Utility-first, design tokens |
| State | TanStack Query | Server state, caching, sync |
| Forms | React Hook Form | Form state management |

## Page Structure

```text
app/
├── dashboard/        # At-a-glance summary
├── workspace/        # File/folder browser with viewer
├── memory-graph/     # Knowledge graph visualization
├── resume/           # Master resume editor
├── jobs/             # Job/internship shortlist
├── applications/     # Application status board
├── chat/             # Agent chat interface
├── schedule/         # Calendar + deadlines
├── connectors/       # Connector management
├── history/          # Audit log
└── settings/         # Permissions, privacy, export/delete
```

## Common Mistakes

| Mistake | Why It's a Problem |
|---------|-------------------|
| Frontend reading from memory or agent stores directly | Bypassing the API layer means the permission engine is never checked — every direct store access is a potential data leak |
| Missing error boundaries around route segments | A render crash in one widget should never take down the entire page; wrap each route segment in its own error boundary |
| No loading states for server-rendered pages | SSR pages that wait for data without showing a loading state feel unresponsive — use Suspense boundaries with fallbacks |
| Tight coupling between pages and shared components | A change to the Sidebar should not require updates to every page that uses it — components should accept props, not assume context |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Communicate exclusively through the REST API gateway | The frontend must never access database, memory, or agent systems directly — all data flows through the API where permissions are enforced |
| Wrap every route segment in an error boundary | A crash in the Memory Graph page should not affect the Dashboard or Workspace; error boundaries at the route level isolate failures |
| Use skeleton loading states for every data-dependent view | Skeleton screens that match the final layout feel instant; generic spinners tell the user nothing about what's loading |
| Keep shared components independent of page-specific logic | Components should receive data via props, not fetch it themselves — this keeps them reusable and testable across different page contexts |

## Security

| Concern | Mitigation |
|---------|------------|
| API key or token exposure in client-side code | Environment variables prefixed with `NEXT_PUBLIC_` are visible in the browser bundle — never expose secrets, only public configuration values |
| Route protection bypass via client-side navigation | Protected routes must verify authentication server-side (Next.js middleware or server components); client-side auth checks can be bypassed |
| Cross-tenant data exposure through shared state | Ensure TanStack Query caches are scoped per workspace — switching workspaces should not serve cached data from the previous workspace |

## Performance

| Concern | Guideline |
|---------|-----------|
| Route-level code splitting with Next.js App Router | Each route should only load its own JavaScript bundle — Next.js automatically code-splits by route, but verify dynamic imports for heavy components |
| Optimize images with Next.js Image component | Use the built-in `next/image` for automatic WebP conversion, lazy loading, and responsive srcset — saves 30-50% on image transfer sizes |
| Regular bundle analysis in CI | Add `@next/bundle-analyzer` to CI and set size thresholds — a PR that adds 50KB to the main bundle should trigger a review |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| API key or token exposure in client-side code | Environment variables prefixed with `NEXT_PUBLIC_` are visible in the browser bundle — never expose secrets, only public configuration values |
| Route protection bypass via client-side navigation | Protected routes must verify authentication server-side (Next.js middleware or server components); client-side auth checks can be bypassed |
| Cross-tenant data exposure through shared state | Ensure TanStack Query caches are scoped per workspace — switching workspaces should not serve cached data from the previous workspace |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Route-level code splitting with Next.js App Router | Each route should only load its own JavaScript bundle — Next.js automatically code-splits by route, but verify dynamic imports for heavy components |
| Optimize images with Next.js Image component | Use the built-in `next/image` for automatic WebP conversion, lazy loading, and responsive srcset — saves 30-50% on image transfer sizes |
| Regular bundle analysis in CI | Add `@next/bundle-analyzer` to CI and set size thresholds — a PR that adds 50KB to the main bundle should trigger a review |

## Goals

- Achieve Lighthouse performance score of 90+ on all page routes
- Maintain bundle size under 250KB (gzipped) per route through code splitting
- Ensure zero client-side access to backend services (API-only communication)
- Achieve 100% TypeScript strict mode compliance across the entire frontend codebase
- Reduce time-to-interactive to under 3s on all SSR pages for first-time visitors

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| Next.js App Router configuration and SSR strategy | Mobile native application development |
| Component architecture and state management | Server-side rendering infrastructure |
| TypeScript strict mode enforcement | Backend API development |
| Route-based code splitting and bundle optimization | Third-party widget integration |
| Error boundary and loading state patterns | End-to-end testing framework |

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FE-F1 | Frontend shall communicate exclusively through REST API gateway | P0 |
| FE-F2 | Every route segment shall be wrapped in an error boundary | P0 |
| FE-F3 | All data-dependent views shall display skeleton loading states | P1 |
| FE-F4 | Frontend shall use server-side rendering for all content routes | P0 |
| FE-F5 | TanStack Query caches shall be scoped per workspace to prevent data leakage | P0 |

## Non-Functional Requirements

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| FE-N1 | Lighthouse performance score | > 90 | Lighthouse CI |
| FE-N2 | Bundle size per route (gzipped) | < 250KB | @next/bundle-analyzer |
| FE-N3 | Time-to-interactive on SSR pages | < 3s | Web Vitals |
| FE-N4 | TypeScript strict mode compliance | 100% | tsc --strict |
| FE-N5 | Error boundary coverage | 100% of route segments | Code coverage scan |

## Components

| Component | Responsibility | Technology | Scale Strategy |
|-----------|---------------|------------|---------------|
| Next.js SSR Renderer | Server-side page rendering with streaming | Next.js 14+ App Router | Auto-scaling with container orchestration |
| API Client | Type-safe HTTP client with caching and retry | TanStack Query + fetch | No scaling needed (stateless) |
| State Manager | Server state caching and workspace scoping | TanStack Query | Per-workspace query key prefixing |
| Form Manager | Form state, validation, and submission | React Hook Form | No scaling needed (client-side only) |
| Error Boundary Tree | Catch and isolate render errors per route segment | React Error Boundary | Component-level granularity |

## Data Flow

1. User navigates to a route — Next.js server renders the page shell with Suspense boundaries and streaming
2. Server components fetch initial data through the API gateway with workspace_id and auth token attached
3. HTML is streamed to the client progressively — sidebar and TopNav render before slower content sections
4. Client hydrates and TanStack Query takes over data fetching for subsequent navigations and mutations
5. All subsequent API calls go through the API gateway where permissions are enforced at the backend level

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|--------------|--------------|---------------|
| Concurrent SSR requests | 100 per instance | Horizontal scaling with auto-scaling groups | Global CDN with edge rendering |
| Client bundle size | 250KB per route | Dynamic imports for heavy components | Module federation for micro-frontends |
| TanStack Query cache | 50MB client-side | LRU eviction with per-workspace keys | IndexedDB for offline support |
| Page routes | 11 routes | Parallel routes and intercepting routes | Nested layouts with route groups |

## Error Handling

| Error Scenario | Detection | Mitigation | Recovery |
|----------------|-----------|------------|----------|
| API gateway timeout | TanStack Query retry detects failure | Show cached data with stale indicator | Auto-retry with exponential backoff |
| React render crash in a route segment | Error boundary catches the error | Show fallback UI for that segment only | Log to error tracking, user can retry |
| SSR page fetch failure | Next.js error during server render | Show static fallback page | Retry on client navigation |
| Cross-workspace cache contamination | Stale data from previous workspace displayed | Clear TanStack Query cache on workspace switch | Scoped query keys prevent recurrence |

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Lighthouse performance score | < 85 | Warning | Frontend Performance |
| Bundle size per route | > 300KB (gzipped) | Warning | Bundle Analysis |
| Time-to-interactive | > 4s for any route | Critical | Web Vitals |
| Error boundary activation rate | > 1% of page views | Warning | Error Tracking |
| API client failure rate | > 5% of requests | Critical | API Client Health |

## Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| NEXT_PUBLIC_API_URL | Public API gateway URL | /api/v1 | Yes |
| NEXT_PUBLIC_WS_URL | WebSocket URL for real-time features | wss://api.meridian.dev/ws | No |
| TANSTACK_STALE_TIME_MS | TanStack Query stale time | 30000 | No |
| TANSTACK_RETRY_COUNT | API client retry count on failure | 3 | No |
| ERROR_BOUNDARY_FALLBACK | Custom fallback UI for error boundaries | default-fallback | No |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Client bundle growing beyond budget with new features | Medium | Medium | CI bundle size gate, code review threshold |
| SSR rendering becoming bottleneck during traffic spikes | Medium | High | CDN caching of static pages, ISR for dynamic content |
| TanStack Query cache leaking data between workspaces | Low | Critical | workspace_id-prefixed query keys, clear on workspace switch |
| Third-party dependency introducing breaking changes | Medium | Medium | Lock dependencies, Dependabot with automated testing |

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| Next.js SSR has higher server cost than fully static sites | Increased hosting costs for dynamic pages | Cache with ISR, use CDN for static assets | Edge rendering for dynamic SSR at lower latency |
| No offline support in MVP | User cannot use app without internet | Service worker for basic navigation | PWA with IndexedDB for offline data access |
| Client-side hydration limits for canvas-heavy pages | Memory Graph needs full client JS before rendering | Dynamic import with loading indicator | WebAssembly for heavy computation |
| No module federation across feature teams | All frontend code lives in one repo | Shared component library with clear boundaries | Micro-frontends with Next.js Module Federation |

## Overview

The Meridian frontend is a component-driven single-page application built with Next.js 14+ (App Router), TypeScript (strict mode), Tailwind CSS, TanStack Query, and React Hook Form. It serves 11 page routes including Dashboard, Workspace, Memory Graph, Resume, Jobs, Applications, Chat, Schedule, Connectors, History, and Settings — each with an SSR or CSR rendering strategy chosen for its interaction model.

The architecture enforces a strict communication boundary: the frontend communicates exclusively through the REST API gateway, never directly accessing databases, memory stores, or agent systems. Every data request passes through the API layer where the permission engine enforces workspace-scoped access control. This one-way data flow prevents data leaks, ensures consistent authorization, and keeps the frontend stateless with respect to backend concerns.

For Meridian's AI-powered workflows, this architecture means that agent proposals, memory graph data, and chat responses are all fetched through the same API gateway pattern. TanStack Query provides consistent caching with workspace-scoped query keys — switching workspaces invalidates caches automatically, preventing cross-tenant data leakage. Error boundaries at every route segment ensure that a crash in the Memory Graph doesn't take down the Dashboard or Workspace.

The frontend uses a shared monorepo structure (`packages/shared`) for TypeScript types, GraphQL fragments, design tokens, and utility functions that are shared between the web application and the React Native mobile companion. This prevents API contract drift and ensures consistent business logic across platforms.

## Examples

### API Client with TanStack Query

```typescript
function useDocuments(workspaceId: string) {
  return useQuery({
    queryKey: ['documents', workspaceId],
    queryFn: () => fetch(`/api/v1/workspaces/${workspaceId}/documents`).then(r => r.json()),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
```

### Error Boundary Wrapping a Route Segment

```tsx
function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary fallback={<WorkspaceError />}>
      <Suspense fallback={<WorkspaceSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
```

### Workspace-Scoped Query Key Pattern

```typescript
// Prevents cross-tenant cache contamination
function useWorkspaceQuery<T>(key: string, workspaceId: string, fetcher: () => Promise<T>) {
  return useQuery({
    queryKey: ['workspace', workspaceId, key],
    queryFn: fetcher,
    staleTime: 30_000,
  });
}
```

---

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Progressive Web App with offline support | Medium | Medium | Q4 2026 |
| Edge rendering for reduced SSR latency | High | Medium | Q3 2026 |
| Micro-frontend architecture with module federation | Low | High | Q2 2027 |
| Real-time collaboration via WebSockets | Medium | High | Q1 2027 |
| Automated visual regression testing in CI | Medium | Low | Q3 2026 |

## Related Documents

- [UI Architecture.md](./UI-Architecture.md)
- [Design System.md](./Design-System.md)
- [`/Docs/Meridian-Complete-Documentation.md#42-frontend`](../../Docs/Meridian-Complete-Documentation.md#42-frontend)
