# Component Library

> **Purpose:** Define the component library and usage conventions for Vaeloom
> **Status:** âœ… Upgraded to enterprise quality
> **Owner:** Frontend Team
> **Last Updated:** 2026-07-13

## Component Hierarchy

```mermaid
graph TD
    %% â”€â”€â”€ Class Definitions â”€â”€â”€
    classDef primitive fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:1.5px
    classDef molecule fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef layout fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px
    classDef feature fill:#f3e5f5,stroke:#6a1b9a,color:#000,stroke-width:1.5px
    classDef page fill:#ffebee,stroke:#c62828,color:#000,stroke-width:2px
    classDef shared fill:#e0f7fa,stroke:#00838f,color:#000,stroke-width:1px,stroke-dasharray: 5 3

    %% â”€â”€â”€ Layer 1: Primitives â”€â”€â”€
    subgraph Primitives["ðŸ§± 1. Primitives (Atoms)"]
        direction TB
        P1["Button"] --- P2["Input"] --- P3["Text"] --- P4["Icon"]
        P5["Avatar"] --- P6["Badge"] --- P7["Tooltip"] --- P8["Spinner"]
        P9["Checkbox"] --- P10["Radio"] --- P11["Select"] --- P12["Toggle"]
    end

    %% â”€â”€â”€ Layer 2: Molecules â”€â”€â”€
    subgraph Molecules["ðŸ”© 2. Molecules (Compositions)"]
        direction TB
        M1["Card<br/>Header + Body + Footer"] --- M2["Table<br/>Sort + Filter + Paginate"]
        M3["Form<br/>Input + Validation + Submit"] --- M4["Modal<br/>Overlay + Title + Content"]
        M5["Toast<br/>Message + Type + Timer"] --- M6["Alert<br/>Type + Message + Action"]
        M7["List<br/>Virtualized Items"] --- M8["Breadcrumb<br/>Path + Separator"]
    end

    %% â”€â”€â”€ Layer 3: Layout â”€â”€â”€
    subgraph Layout["ðŸ“ 3. Layout Components"]
        direction TB
        L1["Page<br/>Wrapper + Header + Actions"] --- L2["Grid<br/>Responsive Cols + Gap"]
        L3["Stack<br/>Direction + Spacing"] --- L4["Sidebar<br/>Nav Items + Collapse"]
        L5["Navbar<br/>Logo + Nav + Profile"] --- L6["Tabs<br/>Tab List + Panel"]
    end

    %% â”€â”€â”€ Layer 4: Feature Components â”€â”€â”€
    subgraph Features["âš¡ 4. Feature Components (Templates)"]
        direction TB
        F1["ProposalCard<br/>Agent suggestions + Approve/Reject"] --- F2["AgentStatus<br/>Health + Metrics + Controls"]
        F3["MemoryNode<br/>Entity + Depth + Expand"] --- F4["Citation<br/>Source + Text + Tooltip"]
        F5["ConnectorCard<br/>Status + Sync + Auth"] --- F6["Timeline<br/>Events + Date + Actions"]
    end

    %% â”€â”€â”€ Layer 5: Pages â”€â”€â”€
    subgraph Pages["ðŸ“„ 5. Pages"]
        direction TB
        PG1["WorkspacePage<br/>Dashboard + Activity"] --- PG2["MemoryPage<br/>Graph + Search + Filter"]
        PG3["ConnectorsPage<br/>List + Status + Setup"] --- PG4["SettingsPage<br/>Profile + Preferences + Billing"]
        PG5["LoginPage<br/>OAuth + Consent"] --- PG6["OnboardingPage<br/>Wizard + Connect"]
    end

    %% â”€â”€â”€ Component composition arrows â”€â”€â”€
    P1 & P2 & P3 & P4 & P5 & P6 & P7 & P8 & P9 & P10 & P11 & P12 -.->|compose| M1 & M2 & M3 & M4 & M5 & M6 & M7 & M8
    M1 & M2 & M3 & M4 & M5 & M6 & M7 & M8 -.->|arrange into| L1 & L2 & L3 & L4 & L5 & L6
    L1 & L2 & L3 & L4 & L5 & L6 -.->|build| F1 & F2 & F3 & F4 & F5 & F6
    F1 & F2 & F3 & F4 & F5 & F6 -.->|render in| PG1 & PG2 & PG3 & PG4 & PG5 & PG6

    %% â”€â”€â”€ Shared / cross-cutting â”€â”€â”€
    subgraph Shared["ðŸ”— Shared Utilities"]
        S1["Theme Tokens<br/>Colors + Typography + Spacing"] --- S2["Hooks<br/>useAuth + useQuery + useSync"]
        S3["Icons<br/>Lucide / Custom"] --- S4["Styles<br/>Tailwind + CSS Modules"]
    end

    S1 -.-> P1 & M1 & L1 & F1 & PG1
    S2 -.-> P2 & M2 & L2 & F2 & PG2
    S3 -.-> P3 & M3 & L3 & F3 & PG3
    S4 -.-> P4 & M4 & L4 & F4 & PG4

    %% â”€â”€â”€ Apply styles â”€â”€â”€
    class P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11,P12 primitive
    class M1,M2,M3,M4,M5,M6,M7,M8 molecule
    class L1,L2,L3,L4,L5,L6 layout
    class F1,F2,F3,F4,F5,F6 feature
    class PG1,PG2,PG3,PG4,PG5,PG6 page
    class S1,S2,S3,S4 shared
```

> **Diagram:** Component hierarchy follows atomic design principles across five layers. **Primitives** (ðŸ§±) are the smallest UI atoms. **Molecules** (ðŸ”©) compose primitives into functional units. **Layout** (ðŸ“) components arrange molecules into page structures. **Feature Components** (âš¡) build domain-specific templates. **Pages** (ðŸ“„) assemble features into full views. **Shared Utilities** (ðŸ”—) provide theme tokens, hooks, and styles consumed by every layer.

---

## Component Categories

### Layout Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Page` | `title, actions` | Standard page wrapper with header |
| `Card` | `title, variant` | Content card with optional header |
| `Grid` | `cols, gap` | Responsive grid layout |
| `Stack` | `direction, gap` | Flex-based stacking layout |

### Data Display

| Component | Props | Description |
|-----------|-------|-------------|
| `Table` | `columns, data, sortable` | Data table with sorting |
| `List` | `items, renderItem` | Virtualized list |
| `Tree` | `nodes, expanded` | File tree explorer |
| `Graph` | `nodes, edges` | Knowledge graph visualization |

### AI-Specific Components

| Component | Props | Description |
|-----------|-------|-------------|
| `ProposalCard` | `proposal, onApprove, onReject` | Agent proposal approval |
| `AgentStatus` | `agent, metrics` | Per-agent health status |
| `MemoryNode` | `entity, depth` | Knowledge graph node |
| `Citation` | `source, text` | Clickable source citation |

### Feedback Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Toast` | `message, type, duration` | Temporary notification |
| `Modal` | `isOpen, title, children` | Dialog overlay |
| `Alert` | `type, message, action` | Inline alert |
| `Progress` | `value, max, label` | Progress indicator |

## Component Conventions

- All components accept `className` for styling overrides
- All interactive components support keyboard navigation
- Loading states use skeleton screens, not spinners
- Error states show actionable messages, not generic errors

## Common Mistakes

| Mistake | Why It's a Problem |
|---------|-------------------|
| Prop drilling through 4+ component layers | Creates brittle code where changing one prop requires updating every intermediate component; use Context or composition instead |
| Too many variants of the same component | A Button with 12 variants (size, color, icon, loading, disabled, ghost, outlineâ€¦) becomes a testing and maintenance nightmare |
| Missing loading, empty, and error states | Components that assume data is always available break silently â€” every data-fetching component needs all three states |
| Inconsistent prop naming across similar components | If `onClick` vs `onSelect` vs `onAction` mean different things in different components, developers must constantly check docs |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Use TypeScript generics for typed children and render props | Enables type-safe compound components (e.g., `Table<T>`) without sacrificing flexibility or requiring type assertions |
| Always provide skeleton loading states | Spinners are a poor loading UX for content-heavy pages; skeleton screens that match the final layout feel significantly faster |
| Support keyboard navigation on all interactive components | Every Button, Input, Select, and custom interactive element must be reachable and operable via keyboard alone |
| Expose `className` for styling overrides | Consumers should never need to use `!important` or CSS hacks to adjust a component's appearance in edge cases |

## Security

| Concern | Mitigation |
|---------|------------|
| `dangerouslySetInnerHTML` in rich text components | Any component that renders user-provided HTML (e.g., Markdown renderer, rich text editor) must sanitize input via DOMPurify or similar |
| Prop injection through spread operators | `{...props}` on DOM elements can allow malicious prop injection (e.g., `onLoad=alert(1)`); spread only known, validated props |
| File type validation in upload components | Never trust the file extension or MIME type from the client â€” validate file signature bytes server-side before rendering previews |

## Performance

| Concern | Guideline |
|---------|-----------|
| Code splitting at route and component level | Lazy-load heavy components (MemoryGraph, FileViewer) using `React.lazy()` + `Suspense` â€” saves 100-300KB from the initial bundle |
| Memoize expensive renders with `React.memo` | Components that receive the same props frequently (list items, table rows) benefit from memoization; profile before adding |
| Avoid re-creating callback props | Use `useCallback` for event handlers passed to child components â€” prevents unnecessary re-renders of memoized children |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| `dangerouslySetInnerHTML` in rich text components | Any component that renders user-provided HTML (e.g., Markdown renderer, rich text editor) must sanitize input via DOMPurify or similar |
| Prop injection through spread operators | `{...props}` on DOM elements can allow malicious prop injection (e.g., `onLoad=alert(1)`); spread only known, validated props |
| File type validation in upload components | Never trust the file extension or MIME type from the client â€” validate file signature bytes server-side before rendering previews |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Code splitting at route and component level | Lazy-load heavy components (MemoryGraph, FileViewer) using `React.lazy()` + `Suspense` â€” saves 100-300KB from the initial bundle |
| Memoize expensive renders with `React.memo` | Components that receive the same props frequently (list items, table rows) benefit from memoization; profile before adding |
| Avoid re-creating callback props | Use `useCallback` for event handlers passed to child components â€” prevents unnecessary re-renders of memoized children |

## Workflows

1. **Developer consumes component from library**: Import component from `@vaeloom/ui` â†’ check props via TypeScript types â†’ render with required props â†’ optional `className` for styling overrides â†’ verify keyboard navigation and loading states
2. **Component variant selection**: Choose primitive (Button, Input) with variant prop â†’ semantic variant maps to theme token â†’ CSS variable resolves to correct light/dark value â†’ component renders with contextual styling
3. **Feature component assembly**: Compose `Card` + `List` + `Badge` into `ProposalCard` â†’ add `useMutation` for approve/reject â†’ export as feature component in `@vaeloom/features` â†’ import in page layer
4. **Component deprecation lifecycle**: Mark component `@deprecated` in TypeScript JSDoc â†’ add migration guide in CHANGELOG â†’ keep backward-compatible wrapper for 2 releases â†’ remove in v3 with codemod

## Sequence Diagrams

```mermaid
sequenceDiagram
    participant DEV as Developer
    participant LIB as @vaeloom/ui
    participant T as TypeScript
    participant R as Runtime

    DEV->>LIB: import { Button } from '@vaeloom/ui'
    LIB->>T: Check props interface
    T-->>DEV: âœ… Type-safe props
    DEV->>R: <Button variant="primary" onClick={handleAction}>
    R->>R: Resolve variant to theme token
    R->>R: Apply --btn-primary-bg color
    R-->>DEV: Rendered button with correct styling

    Note over DEV,R: Keyboard interaction
    DEV->>R: Tab to Button
    R->>R: Focus visible applied via :focus-visible
    DEV->>R: Enter key
    R->>DEV: onClick triggered, action dispatched
```

## Data Flow

1. **Ingestion**: Component props received from parent â†’ TypeScript validates prop types at build time â†’ React reconciliation compares with previous props â†’ memoized components skip re-render if props unchanged
2. **Processing**: Component renders JSX â†’ Tailwind classes mapped to CSS custom properties â†’ CSS variables resolve theme-appropriate values â†’ browser paints composited layers
3. **Storage**: Component state managed locally via `useState` or via TanStack Query for server data â†’ no global state for UI-only concerns â†’ URL search params persist filter/page state
4. **Retrieval**: Page imports feature components â†’ feature components compose primitives â†’ primitives reference design tokens â†’ tokens resolve to platform-specific values (web vs mobile)
5. **Deletion**: Component unmounts â†’ `useEffect` cleanup runs â†’ event listeners removed â†’ subscriptions cancelled â†’ DOM removed via React reconciliation

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|---------------|--------------|---------------|
| Unique components in library | 64 | Modularize into sub-packages (`@vaeloom/ui/primitives`, `@vaeloom/ui/composites`) | Auto-generated from design tokens with AI-assisted composition |
| Re-renders per interaction | 1 re-render per state change | Use `React.memo` + `useMemo` for expensive subtrees | Fine-grained reactivity with Signals (Preact signals or Solid.js pattern) |
| Bundle size per route | 120KB (gzipped) | Tree-shake unused components per route via manual chunking | Automatic code-splitting based on page-level usage analysis |
| Props per component | 12 max | Compound component pattern to reduce prop surface | Server components for data-fetching; client components for interactivity only |

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| Missing required prop | TypeScript compilation error | Show clear error message at build time with prop name and expected type | Fix prop in source file |
| Component crashes during render | React Error Boundary catches | Show fallback UI with "Something went wrong" + retry button | Log to Sentry; reset error boundary on retry |
| Invalid variant prop | TypeScript union type violation | Fall back to default variant; log warning | Document valid variants in component JSDoc |
| Context not provided | Error Boundary + console error | Show "ContextProvider missing" fallback with setup instructions | Verify parent component wraps with required provider |

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Component render time (p95) | > 50ms | Warning | Grafana â€” React Profiler |
| Error Boundary activations | > 0 per deploy | Critical | Sentry â€” Component Errors |
| PropType violations in dev | Any | Warning | ESLint + TypeScript build output |
| Bundle size per component | > 5KB gzipped | Warning | bundlesize CI check |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Component API surface grows unmaintainable | Medium | Medium | Enforce prop limits via ESLint; deprecate and remove unused variants quarterly |
| Breaking changes in primitive components cascade | High | High | Follow semver strictly; use codemods for breaking changes |
| Design token changes break component rendering | Medium | Medium | Visual regression tests on all components per token change |
| Third-party React version upgrade breaks components | Low | High | Pin React version; test component suite before upgrade |

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| Server components cannot use hooks or Context | Server-rendered parts of pages cannot access client-side state | Pass data from server component to client child via props | React Server Components with async data patterns; use `use client` boundary |
| Compound components increase learning curve | New developers struggle with sub-component pattern | Clear documentation with interactive examples per compound component | AI-powered component playground with auto-generated examples |
| CSS custom properties cannot be used in media queries | Responsive variants must be hardcoded in component CSS | Use Tailwind breakpoint classes in component files | Container queries (widely supported by late 2026) |

## Overview

The Vaeloom component library is an atomic-design-based collection of reusable UI elements organized into five layers: primitives (atoms like Button, Input, Icon), molecules (compositions like Card, Table, Form), layout components (Page, Grid, Stack), feature components (ProposalCard, MemoryNode, AgentStatus), and pages (WorkspacePage, MemoryPage). This hierarchy ensures that every piece of UI has a clear place in the design system and can be composed predictably.

Components are built with TypeScript strict mode and follow consistent conventions: all accept a `className` prop for styling overrides, support keyboard navigation, provide skeleton loading states instead of spinners, and surface actionable error messages rather than generic failures. The library is published as `@vaeloom/ui` and consumed by both the web frontend and mobile companion app.

The component library directly supports Vaeloom's AI-first workflows. Feature components like `ProposalCard` encapsulate the approve/reject interaction pattern that users engage with dozens of times per session. `AgentStatus` provides real-time health monitoring for each AI agent. `MemoryNode` renders entities in the knowledge graph with expand/collapse and drill-down capabilities.

By enforcing a strict component hierarchy and shared conventions, the library ensures visual consistency across all 11 routes, reduces duplication, and enables parallel development â€” a team building the Dashboard doesn't need to coordinate with the team building Settings as long as both use the same primitive components.

## Goals

- Maintain 100% TypeScript strict mode compliance across all 64+ library components
- Achieve zero prop-drilling beyond 2 component layers through composition and Context
- Ensure every interactive component supports keyboard navigation and screen reader announcements
- Keep individual component bundle size under 5KB gzipped
- Support skeleton loading states for all data-dependent components

## Scope

### In Scope

- Five-layer atomic component hierarchy (primitives, molecules, layout, features, pages)
- TypeScript strict mode with generic compound components (`Table<T>`, `List<T>`)
- Consistent prop patterns (`className`, `variant`, `children`, event handlers)
- Loading (skeleton), empty, error, and edge case states for every data-fetching component
- Keyboard navigation, focus management, and ARIA attributes on all interactive elements

### Out of Scope

- Server components requiring hooks or Context (marked with `use client` boundary)
- Visual regression test suite (covered in E2E Testing)
- Storybook documentation site (planned for future improvement)
- Third-party component wrappers (evaluated per integration)

## Examples

### Button with Skeleton Loading State

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

function Button({ variant = 'primary', loading, disabled, children, onClick }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${loading ? 'btn-loading' : ''}`}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
    >
      {loading ? <Spinner size="sm" /> : children}
    </button>
  );
}
```

### Compound Card Component

```tsx
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className ?? ''}`}>{children}</div>;
}

Card.Header = function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>;
};

Card.Body = function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card-body">{children}</div>;
};

// Usage:
<Card>
  <Card.Header><h2>Agent Proposal</h2></Card.Header>
  <Card.Body><ProposalCard proposal={proposal} /></Card.Body>
</Card>
```

### Feature Component with TanStack Query

```tsx
function ProposalCard({ proposal, onApprove, onReject }: ProposalCardProps) {
  const approveMutation = useMutation({
    mutationFn: () => fetch(`/api/proposals/${proposal.id}/approve`, { method: 'POST' }),
    onMutate: () => onApprove(proposal.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['proposals'] }),
  });

  if (approveMutation.isPending) return <Skeleton variant="proposal" />;

  return (
    <Card>
      <Card.Body>
        <p>{proposal.description}</p>
        <DiffView original={proposal.original} proposed={proposal.proposed} />
      </Card.Body>
      <Card.Footer>
        <Button variant="primary" onClick={() => approveMutation.mutate()}>Approve</Button>
        <Button variant="secondary" onClick={() => onReject(proposal.id)}>Reject</Button>
      </Card.Footer>
    </Card>
  );
}
```

---

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| AI-powered component playground with live prop editing | High | Medium | Q2 2027 |
| Automatic bundle analysis reports per PR | Medium | Low | Q1 2027 |
| Server component migration for data-only pages | High | High | Q3 2027 |
| Fine-grained reactivity migration (Signals) | Low | High | Q4 2027 |

## Related Documents

- [Design System.md](./Design-System.md)
- [Frontend Architecture.md](./Frontend-Architecture.md)
