# MVP-P10 — 10. Handoff to P11

> Generated 2026-08-19 (post-fix deep audit)

## What P11 receives

### Frontend code (all verified, tests passing)

- 12 P10 components in `apps/web/src/components/shared/`
- ChatWindow with AI disclosure + auto-scroll
- Settings page with typed-confirm delete + T3 gated toggle
- Applications page wired to real API (paginated, case-normalized)
- MemoryCorrectionPanel wired to live memoryApi.update
- Modal with focus trap + inert backdrop
- Toast with timer leak fix + pause-on-hover + Escape
- SkipLink imported in layout.tsx

### Typed client

- `api-client.ts` with all P10 interfaces
- `postQuery()` method for POST with query params
- `applicationApi`, `consentApi`, `gdprApi` typed wrappers

### What P11 must wire

1. **ApprovalCard → live approval API** — UI designed, backend endpoints exist,
   no wiring yet
2. **Consent scope toggles → backend** — currently cosmetic only
3. **Connector permissions → backend** — currently local state only

### What P11 must verify

1. **Contract tests** — generated client vs OpenAPI spec
2. **API error handling** — all typed wrappers handle 4xx/5xx gracefully

### Restrictions carried from P10

- No new routes/deps without change control
- Enterprise surfaces stay gated
- Gmail stays draft-only
- T3 toggle stays disabled until consent wiring

### Deep audit findings for P11 awareness

- Shared types (Memory, Agent, Connector) diverge from backend models — P11 may
  need to reconcile
- Inline interfaces in api-client.ts use snake_case (transformKeys handles at
  runtime)
- Settings consent scope revocation needs API wiring
- Applications Kanban is read-only (no drag-and-drop)
