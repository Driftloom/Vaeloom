# MVP-P10 — 04. Code & Configuration Changes

> Exact diff summary (see commit for full diff). All paths repo-relative.
> Re-executed 2026-08-19; deep audit + 18 fixes applied.

## New files

| File | Purpose |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/web/src/components/shared/SkipLink.tsx` | WCAG 2.4.1 skip link (class in globals.css) |
| `apps/web/src/components/shared/Toast.tsx` | ToastProvider + useToast; `aria-live=polite` region, 6s auto-dismiss |
| `apps/web/src/components/shared/DiffViewer.tsx` | LCS word-level diff; summary line + colored spans; `role=group` + aria-details |
| `apps/web/src/components/shared/ProvenanceBadge.tsx` | source + confidence chip |
| `apps/web/src/components/shared/ConfidenceMeter.tsx` | 0..1 bar, tone by threshold (≥0.8 success, ≥0.5 warning, else danger) |
| `apps/web/src/components/shared/ExpiryTimer.tsx` | countdown, `aria-live=polite`, onExpire callback, 30s tick |
| `apps/web/src/components/shared/ApprovalCard.tsx` | evolved ProposalCard per P09 §04.2.1 |
| `apps/web/src/components/memory/MemoryCorrectionPanel.tsx` | memory list + edit modal + supersession copy |
| `apps/web/src/components/shared/ApprovalCard.spec.tsx` | 7 tests |
| `apps/web/src/components/shared/Modal.spec.tsx` | 4 tests |
| `apps/web/src/components/shared/Toast.spec.tsx` | 2 tests |
| `apps/web/src/components/layout/Sidebar.spec.tsx` | 4 tests |

## Modified files

| File | Change |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/tailwind.config.ts` | + success/warning/info (+ l-* light variants) tokens |
| `apps/web/src/styles/globals.css` | + `.skip-link`, global `:focus-visible`, reduced-motion block, `@keyframes toast-in` |
| `packages/ui-kit/src/components/Modal.tsx` | focus trap (Tab/Shift+Tab), focus restore on close, useId title id, dialog `tabIndex=-1`, aria-hidden backdrop |
| `apps/web/src/components/layout/Sidebar.tsx` | 6-space IA groups; enterprise `gated` label; aria-current; SVG icons; `usePathname` |
| `apps/web/src/app/layout.tsx` | ToastProvider + skip link; imports |
| `apps/web/src/app/workspace/[workspaceId]/layout.tsx` | `<main id="main-content" tabIndex={-1}>` |
| `apps/web/src/app/(auth)/login/page.tsx`, `signup/page.tsx` | same main landmark |
| `apps/web/src/components/chat/ChatWindow.tsx` | AI disclosure line on agent messages; `role="log" aria-live="polite"` |
| `apps/web/src/app/workspace/[workspaceId]/settings/page.tsx` | Consent Scopes section (T3 gated), typed-confirm delete + receipt, reworked handler (no window.confirm) |
| `apps/web/src/app/workspace/[workspaceId]/memory/page.tsx` | + MemoryCorrectionPanel below graph |
| `apps/web/src/lib/api-client.ts` | + `consentApi`, `gdprApi` + interfaces |
| `apps/web/src/app/workspace/[workspaceId]/applications/page.tsx` | Wired to real API (applicationApi.list); Kanban with status badges; **deep audit:** status case normalization, paginated fetch |
| `apps/api/src/api/middleware/tenant.py` | **Deep audit:** `get_current_tenant()` reads `request.state` not `X-Tenant-ID` header |
| `apps/api/src/api/main.py` | **Deep audit:** CSRF cookie `secure=True` (non-local), `httponly=True` |
| `apps/api/src/api/middleware/security_headers.py` | **Deep audit:** Added `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` |
| `apps/api/src/api/schemas/connector.py` | **Deep audit:** Added `name: str = ""` field |
| `apps/api/src/api/schemas/agent.py` | **Deep audit:** Added `duration` alias for `duration_ms` |
| `apps/web/src/components/shared/Toast.tsx` | **Deep audit:** Timer leak fix, pause-on-hover, Escape dismiss |
| `apps/web/src/components/shared/ExpiryTimer.tsx` | **Deep audit:** Ref-based onExpire (no deps churn), pre-expired fires immediately |
| `apps/web/src/components/shared/ProvenanceBadge.tsx` | **Deep audit:** `aria-label`, confidence clamped 0-1 |
| `packages/ui-kit/src/components/Modal.tsx` | **Deep audit:** `inert` on backdrop |
| `apps/web/src/lib/api-client.ts` | **Deep audit:** `postQuery()` method, `auditApi.export` uses query params, memory request types updated |
| `packages/shared-types/src/types/workspace.ts` | **Deep audit:** Added `description?: string` |
| `packages/shared-types/src/types/memory.ts` | **Deep audit:** `KnowledgeGraphNode.description` optional, removed `embedding` |
| `apps/web/src/components/chat/ChatWindow.tsx` | **Deep audit:** Auto-scroll with `scrollRef` |
| `apps/web/src/app/layout.tsx` | **Deep audit:** SkipLink component imported (replaces inline) |

## Deleted files

| File | Reason |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/components/shared/ProposalCard.tsx` | superseded by ApprovalCard (unused — verified zero imports) |
