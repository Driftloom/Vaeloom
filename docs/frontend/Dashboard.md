# Dashboard

> **Purpose:** Define the Dashboard page and its widgets
> **Status:** ✅ Upgraded to enterprise quality
> **Version:** 2.0
> **Owner:** Frontend Team
> **Last Updated:** 2026-07-17
> **Canonical source:** [`/docs/Vaeloom-Complete-Documentation.md#8-screens`](../../docs/Vaeloom-Complete-Documentation.md#8-screens)

## Overview

```mermaid
graph TD
    classDef widget fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef source fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef layoutClass fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px

    subgraph Sources["📡 Data Sources"]
        S1["Memory Agent<br/>Entity growth, consolidation"]
        S2["Career Memory<br/>Applications, goals"]
        S3["Scheduler<br/>Deadlines, calendar"]
        S4["Audit Log<br/>Recent agent actions"]
        S5["Recommendation Agent<br/>Proactive suggestions"]
    end

    subgraph Widgets["📊 Dashboard Widgets"]
        W1["Memory Health<br/>Growth rate, consolidation"]
        W2["Knowledge Growth<br/>Sparkline of entities"]
        W3["Active Applications<br/>Count + status"]
        W4["Upcoming Deadlines<br/>Next 7 days"]
        W5["Goal Progress<br/>Progress toward goals"]
        W6["Recent Activity<br/>Last 10 agent actions"]
        W7["AI Suggestions<br/>Proactive suggestions"]
        W8["Per-Agent Status<br/>Health check per agent"]
    end

    subgraph Layout["🔲 Dashboard Layout"]
        L1["Row 1: Memory Health | Knowledge Growth"]
        L2["Row 2: Active Apps | Upcoming Deadlines"]
        L3["Row 3: Recent Activity (full width)"]
        L4["Row 4: AI Suggestions (full width)"]
        L5["Row 5: Agent Status | Goal Progress"]
    end

    S1 & S2 & S3 & S4 & S5 --> W1 & W2 & W3 & W4 & W5 & W6 & W7 & W8
    W1 & W2 & W3 & W4 & W5 & W6 & W7 & W8 --> L1 & L2 & L3 & L4 & L5

    class W1,W2,W3,W4,W5,W6,W7,W8 widget
    class S1,S2,S3,S4,S5 source
    class L1,L2,L3,L4,L5 layoutClass
```

> **Diagram:** Dashboard is composed entirely from other modules — **5 data sources** feed **8 widgets** into a **5-row layout**. The dashboard holds no unique logic of its own; it's an aggregation view. Widgets include Memory Health, Knowledge Growth, Active Applications, Upcoming Deadlines, Goal Progress, Recent Activity, AI Suggestions, and Per-Agent Status.

---

The Dashboard is the primary landing page, composed entirely from other modules — it holds no unique logic of its own.

## Widgets

| Widget | Source | Description |
|--------|--------|-------------|
| Memory Health | Memory Agent | Growth rate, consolidation status |
| Knowledge Growth | Memory Agent | Sparkline of entities over time |
| Active Applications | Career Memory | Count and status of active applications |
| Upcoming Deadlines | Scheduler | Next 7 days of deadlines |
| Goal Progress | Career Memory | Progress toward stated goals |
| Recent Activity | Audit Log | Last 10 agent actions |
| AI Suggestions | Recommendation Agent | Proactive suggestions |
| Per-Agent Status | All agents | Health check per agent |

## Layout

```text
┌─────────────────────────────────────────────┐
│  Memory Health  │  Knowledge Growth          │
├────────────────┼────────────────────────────┤
│  Active Apps   │  Upcoming Deadlines         │
├────────────────┴────────────────────────────┤
│  Recent Activity                             │
├─────────────────────────────────────────────┤
│  AI Suggestions                              │
├────────────────┬────────────────────────────┤
│  Agent Status  │  Goal Progress              │
└────────────────┴────────────────────────────┘
```

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard/summary` | Aggregated read across all modules |
| GET | `/dashboard/widget/:id` | Individual widget data for progressive loading |
| POST | `/suggestions/{id}/respond` | Approve/dismiss a suggestion |

## Database

| Entity | Key Fields | Purpose |
|--------|------------|---------|
| `user_preferences` | `user_id (PK)`, `widget_layout (JSONB)`, `updated_at` | Persists widget layout configuration per user |
| `dashboard_cache` | `user_id (PK)`, `widget_id (PK)`, `data (JSONB)`, `cached_at` | Redis-backed widget-level cache entries |
| `suggestion_log` | `id (PK)`, `user_id (FK)`, `suggestion_type`, `response`, `created_at` | Tracks AI suggestion approve/dismiss actions |

## Common Mistakes

| Mistake | Why It's a Problem |
|---------|-------------------|
| Displaying too many widgets on one screen | Information overload causes users to ignore the dashboard entirely — focus on the 5-7 most actionable metrics |
| Stale data without refresh indicators | Users lose trust when they see yesterday's data without knowing it's stale; always show "last updated" timestamps |
| Empty widgets with no guidance | A blank memory health widget should explain what it will show once data is available, not just display a grey box |
| Widgets that aren't clickable | If a user sees a metric they want to explore, every widget should deep-link to its full screen — no dead-end information |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Personalize widget layout based on user behavior | Power users may want Agent Status first; new users benefit from Recent Activity — let users rearrange widgets |
| Cache dashboard aggregates with explicit invalidation | The dashboard is the most-fetched page; cache its aggregated response and invalidate on relevant memory writes, not on a timer |
| Show meaningful empty states with call-to-action | An empty Applications list should prompt "Connect a job platform to start" — never just "No applications found" |
| Surface actionable insights, not raw data | Instead of "14 documents organized," show "14 documents organized — review 3 proposals pending approval" |

## Security

| Concern | Mitigation |
|---------|------------|
| Aggregated data leaking individual record details | Dashboard aggregates (totals, averages) could allow inference of individual records if the user has limited data; ensure thresholds require minimum data points before display |
| Per-agent status revealing system topology | Agent health indicators could expose internal infrastructure to users; scope status visibility to agents the user has permission to interact with |
| Suggestion content containing sensitive references | AI-generated suggestions may reference documents or events the user should not have visibility into; scope suggestion generation to the user's permission level |

## Performance

| Concern | Guideline |
|---------|-----------|
| Lazy-load individual dashboard widgets | Load and render widgets independently — a slow memory health query should not block the entire dashboard from rendering |
| Stale-while-revalidate for aggregate data | Return the last cached dashboard state immediately, then refresh in the background; the dashboard loads instantly even if data is a few seconds stale |
| Widget-level caching with independent TTLs | Memory health can cache for 5 minutes; recent activity needs 30-second freshness — use different staleTime values per widget query |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Aggregated data leaking individual record details | Dashboard aggregates (totals, averages) could allow inference of individual records if the user has limited data; ensure thresholds require minimum data points before display |
| Per-agent status revealing system topology | Agent health indicators could expose internal infrastructure to users; scope status visibility to agents the user has permission to interact with |
| Suggestion content containing sensitive references | AI-generated suggestions may reference documents or events the user should not have visibility into; scope suggestion generation to the user's permission level |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Lazy-load individual dashboard widgets | Load and render widgets independently — a slow memory health query should not block the entire dashboard from rendering |
| Stale-while-revalidate for aggregate data | Return the last cached dashboard state immediately, then refresh in the background; the dashboard loads instantly even if data is a few seconds stale |
| Widget-level caching with independent TTLs | Memory health can cache for 5 minutes; recent activity needs 30-second freshness — use different staleTime values per widget query |

## Components

| Component | Responsibility | Technology | Scale Strategy |
|-----------|---------------|------------|----------------|
| WidgetGrid | Responsive dashboard layout (1→2→3 columns) | CSS Grid + Tailwind | Adaptive per viewport; 1 col mobile, 2 tablet, 3 desktop |
| MemoryHealthCard | Growth rate + consolidation status | Recharts Sparkline + Badge | Instance per widget; SSR skeleton then client hydrate |
| RecentActivityFeed | Last 10 agent actions timeline | Virtualized List | Lazy-loads beyond 10 items; cursor-based pagination |
| AISuggestionsPanel | Proactive agent recommendations | Card list + approve/dismiss | Singleton per dashboard; polls every 30s via refetchInterval |

## Workflows

1. **Dashboard initial load**: User navigates to `/` → server renders skeleton layout → client hydrates widgets in parallel → TanStack Query fires 8 independent queries → each widget renders independently as data arrives → stale-while-revalidate shows cached data immediately
2. **Widget interaction**: User clicks memory health widget → deep-links to `/memory` → Memory Agent context pre-loaded via prefetch → transition with shared element animation
3. **AI suggestion response**: User clicks "Approve" on AI suggestion → optimistic UI updates (proposal disappears) → POST to API confirms → on error, suggestion reappears with toast notification
4. **Custom layout**: User drags widget to new position → layout config saved to localStorage → persisted across sessions → layout state synced to account settings via debounced POST

## Sequence Diagrams

```mermaid
sequenceDiagram
    participant U as User
    participant D as Dashboard
    participant TQ as TanStack Query
    participant API as Vaeloom API

    U->>D: Navigate to Dashboard
    D->>D: Render skeleton layout (8 widget placeholders)
    par Widget 1: Memory Health
        D->>TQ: query memoryHealth
        TQ->>API: GET /dashboard/widget/memory-health
        API-->>TQ: { growthRate: 12%, entities: 340 }
        TQ-->>D: Cached data
        D->>D: Render MemoryHealthCard
    and Widget 2: Knowledge Growth
        D->>TQ: query knowledgeGrowth
        TQ->>API: GET /dashboard/widget/knowledge-growth
        API-->>TQ: { sparkline: [3,5,8,12,15] }
        TQ-->>D: Cached data
        D->>D: Render Sparkline
    end
    D-->>U: Full dashboard visible
```

## Data Flow

1. **Ingestion**: Data pushed to dashboard via connector syncs (Gmail, LinkedIn, GitHub) → stored in PostgreSQL event tables → aggregation layer computes widget metrics
2. **Processing**: Server-side aggregation endpoint (`GET /dashboard/summary`) queries 8 materialized views in parallel → merges into single response (200ms p95) → response cached in Redis with 30s TTL
3. **Storage**: Widget layout preferences stored in `user_preferences` JSONB column → individual widget cache keys per user ID → shared data cached in Redis
4. **Retrieval**: Client requests via TanStack Query with `staleTime: 30s` → individual widget endpoints for progressive loading → stale-while-revalidate pattern for instant paint
5. **Deletion**: User disconnects connector → associated widget data invalidated → widget shows empty state with "Connect [service] to see data here" prompt

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|---------------|--------------|---------------|
| Widgets per dashboard | 8 | Configurable widget limit with pagination | User-customizable dashboard with marketplace widgets |
| Concurrent dashboard queries | 8 per page load | Batch into single aggregated endpoint | Server-side streaming of widget data via SSE |
| Layout configurations | 1 per user | Store in user_profile JSONB; indexed by user_id | Tiered storage — hot layout in Redis, cold layout in PostgreSQL |
| Widget data refresh | 30s polling | Push-based updates via WebSocket on data change | Real-time streaming with differential updates |

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| One widget fails to load | TanStack Query error state for that query | Render widget in error state; other widgets unaffected | Retry button on failed widget; auto-retry with exponential backoff |
| Dashboard aggregation API times out | 5s timeout on `/dashboard/summary` | Fall back to individual widget queries | Cache last successful response; show with "stale data" banner |
| Widget layout corrupted | JSON parse fails on stored config | Reset to default layout; log error | User repositions widgets; new config saved |
| Connector sync delay causes empty widget | Widget shows no data | Render targeted CTA: "Connect Gmail to see upcoming deadlines" | Background sync completes; widget re-renders with data |

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Dashboard time-to-interactive | > 2s | Critical | Grafana — Web Vitals (LCP) |
| Widget query failure rate | > 1% | Warning | Grafana — API Dashboard |
| Stale data display frequency | > 10% of loads | Warning | Amplitude — Dashboard Engagement |
| Widget layout reset events | > 1 per 1000 users | Info | Sentry — Log-level |

## Deployment

| Environment | Strategy | Rollback | Notes |
|-------------|----------|----------|-------|
| Development | Docker Compose local | `git revert` + redeploy | Hot-reload enabled for widget development |
| Staging | Vercel Preview on PR | Automatic rollback on failed E2E | Isolated per-branch dashboard testing |
| Production | Vercel Production deploy | Instant rollback via Vercel dashboard; previous version held for 30 days | Blue-green via Vercel; traffic shifted gradually |
| DR | Secondary region (us-east-1) | Route53 failover; Redis replica promotion | Cross-region Redis replication for cache continuity |

## Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `NEXT_PUBLIC_DASHBOARD_POLL_INTERVAL` | Widget data refresh rate in ms | 30000 | No |
| `DASHBOARD_CACHE_TTL` | Server-side Redis cache expiration in ms | 30000 | No |
| `DASHBOARD_WIDGET_LIMIT` | Maximum widgets per dashboard | 8 | No |
| `DASHBOARD_AGGREGATE_TIMEOUT` | Summary endpoint timeout in ms | 5000 | No |
| `FEATURE_WIDGET_DRAG_DROP` | Enable drag-and-drop layout customization | true | No |
| `DASHBOARD_STALE_THRESHOLD` | Stale data warning threshold in ms | 60000 | No |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Third-party connector outage leaves widgets empty | Medium | High | Show last cached data with "last updated" timestamp; CTA to reconnect |
| Widget performance degradation as data grows | Medium | Medium | Paginate recent activity at 10 items; aggregate time-series data |
| User customizes layout into unusable state | Low | Low | Provide "Reset to default" button; validate layout before save |
| AI suggestion content irrelevant or inappropriate | Medium | High | Human-in-the-loop approval; user feedback mechanism for bad suggestions |

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| Widgets cannot be shared or embedded externally | Users cannot share dashboard views with team members | Manual screenshot export (html2canvas) | Embeddable widget SDK with auth token support |
| Mobile dashboard limited to 4 widgets | Information density too high on small screens | Priority-based widget display; "show all" link to desktop view | Adaptive dashboard with progressive disclosure per viewport |
| No real-time widget updates without polling | Data freshness depends on 30s poll interval | Shorten poll interval for time-sensitive widgets (15s) | WebSocket-backed push model per widget subscription |

## Goals

- Render the full dashboard with all 8 widgets within 2 seconds of page navigation (Time to Interactive)
- Maintain 100% widget independence — a slow or failed widget should never block other widgets from rendering
- Achieve stale-while-revalidate on all widget data so users always see cached content instantly
- Enable user-customizable widget layout with drag-and-drop reordering saved across sessions
- Surface actionable AI suggestions that achieve 40%+ user approval rate

## Scope

### In Scope

- Eight dashboard widgets: Memory Health, Knowledge Growth, Active Applications, Upcoming Deadlines, Goal Progress, Recent Activity, AI Suggestions, Per-Agent Status
- Aggregated data endpoint (`GET /dashboard/summary`) with 30-second Redis cache TTL
- Individual widget-level endpoints for progressive loading and independent error handling
- Widget layout customization via localStorage persistence
- Deep-link navigation from each widget to its full-page view

### Out of Scope

- Real-time streaming widget updates (future improvement with WebSocket push)
- Widget sharing or embedding across users (future improvement)
- Third-party widget marketplace (planned for post-MVP)
- Dashboard export to PDF or screenshot (future improvement)

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DSH-001 | Dashboard shall aggregate data from all 5 data sources (Memory, Career, Scheduler, Audit, Recommendation) | High |
| FR-DSH-002 | Dashboard shall render 8 independent widgets without cross-blocking | High |
| FR-DSH-003 | Dashboard shall display stale data with a "last updated" timestamp indicator | High |
| FR-DSH-004 | Dashboard shall support drag-and-drop widget rearrangement persisted across sessions | Medium |
| FR-DSH-005 | Each widget shall deep-link to its full-page detail view | Medium |
| FR-DSH-006 | AI Suggestions widget shall support approve/dismiss interactions | Medium |
| FR-DSH-007 | Dashboard shall provide a "Reset to default layout" option | Low |

## Non-Functional Requirements

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| NFR-DSH-001 | Dashboard shall load within 2 seconds Time to Interactive | = 2s | Lighthouse TTI |
| NFR-DSH-002 | Individual widget failure shall not block other widgets from rendering | 100% independence | Manual test |
| NFR-DSH-003 | Widget data shall use stale-while-revalidate pattern for instant paint | < 100ms first paint | LCP metric |
| NFR-DSH-004 | Dashboard summary API shall respond within 200ms p95 | = 200ms | APM monitoring |
| NFR-DSH-005 | Widget layout customization shall sync within 1 second of change | = 1s | Debounce + save timing |
| NFR-DSH-006 | Dashboard shall support 3 viewport breakpoints (mobile 1-col, tablet 2-col, desktop 3-col) | All breakpoints | Visual regression |

## Architecture

```mermaid
graph TD
    classDef api fill:#e1f5fe,stroke:#0288d1,color:#000,stroke-width:2px
    classDef widget fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:2px
    classDef layout fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef infra fill:#f3e5f5,stroke:#6a1b9a,color:#000,stroke-width:1.5px

    subgraph Client[" Browser"]
        WGRID["WidgetGrid (CSS Grid)"]
        W1["MemoryHealthCard"]
        W2["KnowledgeGrowthCard"]
        W3["ActiveAppsCard"]
        W4["DeadlinesCard"]
        W5["GoalProgressCard"]
        W6["RecentActivityCard"]
        W7["AISuggestionsCard"]
        W8["AgentStatusCard"]
    end

    subgraph API[" API Layer"]
        SUM["GET /dashboard/summary"]
        WID["GET /dashboard/widget/:id"]
        SUG["POST /suggestions/:id/respond"]
    end

    subgraph Cache[" Cache Layer"]
        REDIS["Redis 30s TTL"]
        TQ["TanStack Query<br/>staleTime: 30s"]
    end

    subgraph Sources[" Data Sources"]
        MEM["Memory Agent"]
        CAR["Career Memory"]
        SCH["Scheduler"]
        AUD["Audit Log"]
        REC["Recommendation Agent"]
    end

    Sources --> SUM & WID
    SUM --> REDIS
    REDIS --> TQ
    WID --> TQ
    TQ --> Client
    WGRID --> W1 & W2 & W3 & W4 & W5 & W6 & W7 & W8

    class SUM,WID,SUG api
    class W1,W2,W3,W4,W5,W6,W7,W8 widget
    class WGRID layout
    class REDIS,TQ infra
```

> **Diagram:** Widget layout architecture � 8 widgets render independently inside a CSS Grid layout. Data flows from 5 backend sources through an API layer with Redis caching and TanStack Query client-side caching. Widgets are isolated via ErrorBoundary so a single widget failure never blocks the rest of the dashboard.

## Examples

### Aggregated Dashboard Query with TanStack Query

```typescript
function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => fetch('/api/dashboard/summary').then(res => res.json()),
    staleTime: 30_000,
  });
}
```

### Widget with Error Boundary Isolation

```tsx
function DashboardPage() {
  return (
    <WidgetGrid>
      <ErrorBoundary fallback={<WidgetError name="Memory Health" />}>
        <MemoryHealthWidget />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="Knowledge Growth" />}>
        <KnowledgeGrowthWidget />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="Active Applications" />}>
        <ActiveApplicationsWidget />
      </ErrorBoundary>
    </WidgetGrid>
  );
}
```

### AI Suggestion with Optimistic Update

```typescript
function useSuggestionResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (suggestionId: string) =>
      fetch(`/api/suggestions/${suggestionId}/respond`, { method: 'POST' }),
    onMutate: async (suggestionId) => {
      await queryClient.cancelQueries({ queryKey: ['dashboard', 'suggestions'] });
      const previous = queryClient.getQueryData(['dashboard', 'suggestions']);
      queryClient.setQueryData(['dashboard', 'suggestions'], (old: any[]) =>
        old.filter(s => s.id !== suggestionId)
      );
      return { previous };
    },
    onError: (err, suggestionId, context) => {
      queryClient.setQueryData(['dashboard', 'suggestions'], context?.previous);
    },
  });
}
```

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Custom dashboard builder with drag-and-drop | High | High | Q3 2027 |
| Shareable dashboard views for team workspaces | Medium | Medium | Q4 2027 |
| Widget recommendations based on usage patterns | Medium | Medium | Q2 2027 |
| Real-time streaming dashboard updates | Low | High | Q4 2027 |

## Related Documents

- [Frontend Architecture.md](./Frontend-Architecture.md)
- [UI Architecture.md](./UI-Architecture.md)
- [Component Library.md](./Component-Library.md)
- [Design System.md](./Design-System.md)
- [Theme System.md](./Theme-System.md)
- [State Management.md](./State-Management.md)
- [Navigation.md](./Navigation.md)
- [Forms.md](./Forms.md)
- [Charts.md](./Charts.md)
- [Animation System.md](./Animation-System.md)
- [Responsive Design.md](./Responsive-Design.md)
- [Mobile Architecture.md](./Mobile-Architecture.md)
- [Accessibility.md](./Accessibility.md)
- [Accessibility Audit.md](./Accessibility-Audit.md)
- [Internationalization.md](./Internationalization.md)
- [UX Guidelines.md](./UX-Guidelines.md)
- [`/docs/Vaeloom-Complete-Documentation.md#8-screens`](../../docs/Vaeloom-Complete-Documentation.md#8-screens)
