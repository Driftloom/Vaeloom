# UI Architecture

> **Purpose:** Define the UI architecture and component hierarchy for Vaeloom
> **Status:** âœ… Upgraded to enterprise quality
> **Owner:** Frontend Team
> **Last Updated:** 2026-07-13

## UI Architecture

```mermaid
graph TD
    classDef app fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef layout fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef page fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px
    classDef shared fill:#f3e5f5,stroke:#6a1b9a,color:#000,stroke-width:1px
    classDef render fill:#ffebee,stroke:#c62828,color:#000,stroke-width:1px

    subgraph App["ðŸ“± App Root"]
        direction TB
        LAYOUT["Layout"]
        SIDEBAR["Sidebar<br/>Navigation"]
        TOPNAV["TopNav<br/>Search, User Menu"]
        MAIN["Main Content Area"]
    end

    subgraph Pages["ðŸ“„ Pages (per route)"]
        P1["Dashboard"]
        P2["Workspace"]
        P3["MemoryGraph"]
        P4["Resume"]
        P5["Chat"]
        P6["Settings"]
    end

    subgraph Shared["ðŸ”— Shared Components"]
        U1["AgentProposalCard"]
        U2["FileViewer"]
        U3["MemoryNode"]
        U4["StatusBadge"]
        U5["ConfirmDialog"]
    end

    subgraph Rendering["ðŸ”„ Rendering Strategy"]
        R1["Dashboard: SSR<br/>Fast first paint"]
        R2["Workspace: SSR + Hydration<br/>File tree needs JS"]
        R3["Chat: CSR<br/>Real-time interaction"]
        R4["Memory Graph: CSR<br/>Heavy canvas rendering"]
        R5["Settings: SSR<br/>Simple form"]
    end

    LAYOUT --> SIDEBAR & TOPNAV & MAIN
    MAIN --> P1 & P2 & P3 & P4 & P5 & P6
    P1 & P2 & P3 & P4 & P5 & P6 -.-> U1 & U2 & U3 & U4 & U5
    P1 & P2 & P3 & P4 & P5 & P6 -.-> R1 & R2 & R3 & R4 & R5

    class LAYOUT,SIDEBAR,TOPNAV,MAIN layout
    class P1,P2,P3,P4,P5,P6 app
    class U1,U2,U3,U4,U5 shared
    class R1,R2,R3,R4,R5 render
```

> **Diagram:** Component hierarchy showing **Layout** (Sidebar + TopNav + Main Content) â†’ **Pages** (6 primary routes with SSR/CSR strategies) â†’ **Shared Components** reused across pages. **Rendering strategy** varies by page â€” SSR for content pages, CSR for interactive/canvas-heavy pages.

---

## Component Hierarchy

```text
App
â”œâ”€â”€ Layout
â”‚   â”œâ”€â”€ Sidebar (navigation)
â”‚   â”œâ”€â”€ TopNav (search, user menu)
â”‚   â””â”€â”€ Main Content
â”œâ”€â”€ Pages (one per route)
â”‚   â”œâ”€â”€ Dashboard
â”‚   â”œâ”€â”€ Workspace
â”‚   â”œâ”€â”€ MemoryGraph
â”‚   â”œâ”€â”€ Resume
â”‚   â”œâ”€â”€ Jobs
â”‚   â”œâ”€â”€ Applications
â”‚   â”œâ”€â”€ Chat
â”‚   â”œâ”€â”€ Schedule
â”‚   â”œâ”€â”€ Connectors
â”‚   â”œâ”€â”€ History
â”‚   â””â”€â”€ Settings
â””â”€â”€ Shared Components
    â”œâ”€â”€ AgentProposalCard
    â”œâ”€â”€ FileViewer
    â”œâ”€â”€ MemoryNode
    â”œâ”€â”€ StatusBadge
    â””â”€â”€ ConfirmDialog
```

## Rendering Strategy

| Page | Strategy | Reason |
|------|----------|--------|
| Dashboard | SSR | Fast first paint, SEO not needed |
| Workspace | SSR + client hydration | File tree needs JS |
| Chat | CSR | Real-time interaction |
| Settings | SSR | Simple form |
| Memory Graph | CSR | Heavy canvas rendering |

## Routing

Next.js App Router with parallel routes where needed:

- `/dashboard` â€” Dashboard page
- `/workspace` â€” File browser
- `/resume` â€” Resume management
- `/chat` â€” Agent chat

## Common Mistakes

| Mistake | Why It's a Problem |
|---------|-------------------|
| Using the wrong rendering strategy for a page | CSR for content-heavy pages delays first paint; SSR for interactive pages adds unnecessary server load â€” choose based on the page's primary interaction model |
| Missing error boundaries around component trees | A single uncaught error in the Chat component can unmount the entire React tree, taking down unrelated parts of the UI |
| No lazy loading for heavy, non-critical components | Loading the Memory Graph (500KB+ bundle) on every page navigation wastes bandwidth and CPU for users who rarely visit it |
| Inconsistent layout patterns across pages | If Dashboard uses a 3-column grid and Workspace uses a different layout system, users must re-learn the interface for each page |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Choose SSR or CSR per page based on interactivity needs | Dashboard (SSR for fast first paint), Chat (CSR for real-time updates), Memory Graph (CSR for canvas rendering) â€” each page gets the right strategy |
| Error boundaries at every layout nesting level | Wrap the Sidebar, TopNav, main content area, and each page in separate error boundaries â€” no single failure takes down unrelated parts |
| Use component composition over inheritance | Build complex UIs by composing smaller, focused components â€” prefer `Page > Card > List > Item` over large monolithic components |
| Maintain a consistent page layout structure across routes | Every page should share the same shell (Sidebar + TopNav + ContentArea) so users navigate with muscle memory, not conscious thought |

## Security

| Concern | Mitigation |
|---------|------------|
| Route-level access control bypass | Access control on client-side routes is a UX convenience, not a security boundary â€” every API endpoint behind a route must independently verify permissions |
| API endpoint exposure through client-side bundle | Route patterns and API endpoint paths are visible in the compiled Next.js bundle; never hardcode secrets, keys, or internal URLs |
| Layout-based privilege escalation | A shared layout component should not render admin-only UI elements and rely on CSS to hide them â€” conditional rendering based on user role is the only safe approach |

## Performance

| Concern | Guideline |
|---------|-----------|
| Bundle splitting per page via dynamic imports | Use `next/dynamic` with `ssr: false` for components that are heavy or only used in certain routes (knowledge graph, file viewer) |
| SSR optimization with streaming and Suspense | Use React 18's streaming SSR to send HTML progressively â€” the sidebar and TopNav render before slower content sections |
| Hydration overhead monitoring | Track Time to Interactive (TTI) for each page; pages with heavy client-side re-rendering may need selective hydration or islands architecture |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Route-level access control bypass | Access control on client-side routes is a UX convenience, not a security boundary â€” every API endpoint behind a route must independently verify permissions |
| API endpoint exposure through client-side bundle | Route patterns and API endpoint paths are visible in the compiled Next.js bundle; never hardcode secrets, keys, or internal URLs |
| Layout-based privilege escalation | A shared layout component should not render admin-only UI elements and rely on CSS to hide them â€” conditional rendering based on user role is the only safe approach |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Bundle splitting per page via dynamic imports | Use `next/dynamic` with `ssr: false` for components that are heavy or only used in certain routes (knowledge graph, file viewer) |
| SSR optimization with streaming and Suspense | Use React 18's streaming SSR to send HTML progressively â€” the sidebar and TopNav render before slower content sections |
| Hydration overhead monitoring | Track Time to Interactive (TTI) for each page; pages with heavy client-side re-rendering may need selective hydration or islands architecture |

## Goals

- Establish a consistent layout shell across all 11 page routes with predictable navigation patterns
- Achieve 100% error boundary coverage at every layout nesting level
- Reduce unused JavaScript shipped per route through SSR/CSR strategy selection
- Maintain shared component library with zero page-specific dependencies
- Achieve Time-to-Interactive under 3s for SSR pages and under 5s for canvas-heavy CSR pages

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| Component hierarchy and layout architecture | Backend API response format design |
| Page-specific rendering strategy (SSR vs CSR) | Third-party UI library integration |
| Error boundary placement at every nesting level | Animation and transition specifications |
| Shared component catalog and composition patterns | Accessibility compliance audit |
| Routing structure with Next.js App Router | Mobile responsive breakpoints |

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| UI-F1 | Every page shall share the same layout shell (Sidebar + TopNav + ContentArea) | P0 |
| UI-F2 | Every route segment and layout level shall have its own error boundary | P0 |
| UI-F3 | Pages shall use SSR or CSR based on their primary interaction model | P0 |
| UI-F4 | Heavy, non-critical components shall use lazy loading with dynamic imports | P1 |
| UI-F5 | Shared components shall not fetch data directly â€” data comes via props | P1 |

## Non-Functional Requirements

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| UI-N1 | Layout consistency across all pages | 100% pages share shell | Visual regression test |
| UI-N2 | Error boundary isolation | No single crash takes down > 1 segment | Error propagation test |
| UI-N3 | Lazy-loaded component activation latency | < 200ms on interaction | Dynamic import timing |
| UI-N4 | SSR-to-CSR page ratio appropriate to interaction model | Audit passes per page | Architecture review |
| UI-N5 | Shared component reusability | Zero duplicate implementations | Component usage scan |

## Components

| Component | Responsibility | Technology | Scale Strategy |
|-----------|---------------|------------|---------------|
| Layout Shell | Sidebar, TopNav, Main Content Area | Next.js root layout | Single instance, no scaling needed |
| Page Components | Route-specific content and interaction | Next.js page components | Dynamic imports per route |
| Shared Component Library | Reusable UI primitives (cards, badges, dialogs) | React + Tailwind CSS | Versioned npm package |
| Error Boundary Container | Catch render errors per segment | React Error Boundary | Nested at every layout level |
| Skeleton Loader | Show loading state matching page layout | Tailwind + CSS animations | Route-specific skeleton components |

## Data Flow

1. User navigates to a URL â€” Next.js App Router matches the route and renders the root layout (Sidebar + TopNav + ContentArea)
2. Layout shell renders immediately with cached or static data â€” Sidebar gets workspace info, TopNav gets user context
3. Content area renders the matched page component which either SSR-renders initial data or shows a loading skeleton
4. Shared components within the page receive data via props from the page component, never fetching independently
5. On route change, Next.js leverages the App Router's client-side navigation to swap only the content area without re-rendering the layout shell

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|--------------|--------------|---------------|
| Page routes | 11 routes | Parallel routes with route groups | Nested layouts with route interception |
| Shared components | 5 core components | Expand to 20+ with design system | Micro-frontend shared component library |
| Error boundary instances | 15 boundaries | 1 per layout level + 1 per page | Automatic boundary generation per component |
| Lazy-loaded components | 3 dynamically imported | All non-critical components lazy | Webpack module federation |

## Error Handling

| Error Scenario | Detection | Mitigation | Recovery |
|----------------|-----------|------------|----------|
| Page component render crash | Error boundary at page level catches error | Show fallback for crashed page, nav unaffected | User can navigate away, error logged |
| Layout component crash (Sidebar) | Error boundary at layout level catches error | Show simplified layout without Sidebar | Auto-retry mount after 30s |
| Shared component crash | Error boundary wrapping that component | Component renders as fallback placeholder | Refresh that section via remount |
| Canvas/CSR component memory leak | Performance monitoring detects FPS drop | Show memory warning, offer tab reload | Component unmount on navigation away |

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Error boundary activation rate | > 0.5% of sessions | Warning | UI Error Tracking |
| Layout shell render time | > 500ms | Warning | Layout Performance |
| Lazy-loaded component failure rate | > 1% of interactions | Warning | Dynamic Import Health |
| Canvas FPS for Memory Graph | < 30 FPS | Warning | Canvas Performance |
| SSR page TTI | > 4s | Critical | User Experience |

## Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| UI_LAYOUT_CACHE_ENABLED | Whether layout data is cached client-side | true | No |
| UI_ERROR_BOUNDARY_FALLBACK | Fallback component path for error boundary | default-segment-fallback | No |
| UI_SSR_TIMEOUT_MS | Timeout for SSR page render before fallback | 5000 | Yes |
| UI_LAZY_LOAD_THRESHOLD | Viewport distance to trigger lazy load (px) | 200 | No |
| UI_SKELETON_ANIMATION | Enable skeleton loading animations | true | No |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Layout inconsistency when new pages are added | Medium | Medium | Shared layout template, code review checklist |
| Error boundary nesting causing silent failures | Low | Medium | Monitor boundary activation, log full error context |
| Over-use of CSR causing poor initial load experience | Medium | High | SSR audit per page in code review process |
| Component duplication across feature teams | Medium | Medium | Shared component catalog with usage lint rules |

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| No component-level hot reload for shared library | Developer iteration speed reduced | Use Next.js Fast Refresh | Separate component library with Storybook |
| Canvas (Memory Graph) requires full JS bundle before rendering | Delayed interactivity for graph-heavy pages | SSR wrapper with loading skeleton | WebAssembly for canvas rendering |
| Error boundary cannot catch async errors in event handlers | Async failures may go uncaught | Wrap async operations in try/catch with error state | React error boundaries for async in React 19 |
| No mobile-specific layout variant in MVP | Mobile users get desktop layout | Basic responsive CSS | Dedicated mobile layout shell |

## Overview

The Vaeloom UI architecture defines how the application is structured from root layout to individual page components. Every page shares a consistent shell â€” Sidebar for primary navigation, TopNav for search and user context, and a Main Content Area that renders the matched route. This consistent layout means users build muscle memory on day one; the sidebar and TopNav remain stable while the content area swaps between Dashboard, Workspace, Memory Graph, Chat, and Settings.

The rendering strategy varies per page based on its primary interaction model. Content-focused pages (Dashboard, Settings, Resume) use SSR for fast first paint. Highly interactive pages (Chat with real-time messaging, Memory Graph with canvas rendering) use CSR since the bulk of their value comes from client-side JavaScript interaction. This hybrid approach ensures that every page gets the right balance of initial load speed and interactive capability.

For Vaeloom's AI workflows, the UI architecture directly supports the agent-proposal interaction pattern. Shared components like `AgentProposalCard`, `FileViewer`, `MemoryNode`, and `StatusBadge` are used across multiple pages â€” a proposal card for file organization appears in the Workspace, while a proposal for resume tailoring appears in the Resume page. These shared components receive data via props, never fetching independently, which keeps them reusable and testable.

Error boundaries wrap every layout level and page route, ensuring that a render crash in the Chat component doesn't take down the Sidebar or TopNav. This isolation is critical for an application where some pages (Memory Graph with heavy canvas rendering) are inherently more crash-prone than others (Settings with simple forms).

## Examples

### Layout Shell with Error Boundaries

```tsx
function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary fallback={<SidebarError />}>
      <Sidebar />
    </ErrorBoundary>
    <ErrorBoundary fallback={<TopNavError />}>
      <TopNav />
    </ErrorBoundary>
    <main id="main-content">
      <ErrorBoundary fallback={<PageError />}>
        {children}
      </ErrorBoundary>
    </main>
  );
}
```

### SSR vs CSR Rendering Strategy

```tsx
// Dashboard â€” SSR for fast first paint (server component)
async function DashboardPage() {
  const summary = await fetchDashboardSummary();
  return <DashboardContent summary={summary} />;
}

// Chat â€” CSR for real-time interaction (client component)
'use client';
function ChatPage() {
  const ws = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  return <ChatInterface messages={messages} ws={ws} />;
}

// Memory Graph â€” CSR with lazy loading (client component, dynamically imported)
const MemoryGraph = dynamic(() => import('@/features/memory/MemoryGraph'), {
  ssr: false,
  loading: () => <MemoryGraphSkeleton />,
});
```

### Shared Component with Props-Based Data

```tsx
// Shared component receives data via props â€” never fetches independently
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'error' | 'pending';
  label: string;
}

function StatusBadge({ status, label }: StatusBadgeProps) {
  const colorMap = {
    active: 'var(--accent-success)',
    inactive: 'var(--text-muted)',
    error: 'var(--accent-error)',
    pending: 'var(--accent-warning)',
  };

  return (
    <span
      className="badge"
      style={{ backgroundColor: colorMap[status] }}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
```

---

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Storybook component library with visual regression tests | Medium | Medium | Q3 2026 |
| Mobile-specific layout shell with responsive breakpoints | Medium | Medium | Q4 2026 |
| WebAssembly memory graph renderer for 60 FPS | Low | High | Q2 2027 |
| Component-level error boundaries for async failures (React 19) | High | Low | Q3 2026 (React 19 upgrade) |
| Drag-and-drop layout customization per user | Low | High | Q1 2027 |

## Related Documents

- [Frontend Architecture.md](./Frontend-Architecture.md)
- [Navigation.md](./Navigation.md)
- [`/Docs/Vaeloom-Complete-Documentation.md#42-frontend`](../../Docs/Vaeloom-Complete-Documentation.md#42-frontend)
