# Frontend Findings — Zero-Trust Audit

> **Date:** 2026-08-18 · **Method:** Read actual source code line by line

## CRITICAL — Security

### FIND-FE-SEC-001: CSP allows unsafe-inline + unsafe-eval

- **File:** `apps/web/src/middleware.ts:40`
- **Code:** `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
- **Impact:** Defeats CSP entirely. XSS injection can execute arbitrary scripts.
- **Fix:** Remove `unsafe-inline` and `unsafe-eval`. Use nonces or hashes.

### FIND-FE-SEC-002: Token cookie missing HttpOnly and Secure flags

- **File:** `apps/web/src/lib/api.ts:47`
- **Code:** `document.cookie = \`vaeloom.accessToken=${token}; path=/;
  max-age=86400; SameSite=Lax\``
- **Impact:** JavaScript can read the token. XSS can steal auth tokens.
- **Fix:** Set cookie server-side with `HttpOnly` and `Secure` flags.

### FIND-FE-SEC-003: Refresh token stored in localStorage

- **File:** `apps/web/src/lib/api-client.ts:149`
- **Impact:** XSS can steal refresh token and maintain persistent access.
- **Fix:** Use httpOnly cookie for refresh token.

### FIND-FE-SEC-004: Feature flags fetched without auth

- **File:** `apps/web/src/lib/feature-flags.ts:28`
- **Impact:** Anyone can see what features exist and their toggle states.
- **Fix:** Add Authorization header to feature flag requests.

### FIND-FE-SEC-005: Token cookie sent over HTTP in dev

- **File:** `apps/web/src/lib/api.ts:16`
- **Code:** `http://localhost:8000` default
- **Impact:** Token transmitted in plaintext on local network.
- **Fix:** Use HTTPS even in dev, or mark cookie as Secure.

## HIGH — Accessibility

### FIND-FE-A11Y-001: ConfidenceMeter missing progressbar role

- **File:** `apps/web/src/components/shared/ConfidenceMeter.tsx:20`
- **Current:** `role="presentation"`
- **Missing:** `role="progressbar"`, `aria-valuenow`, `aria-valuemin`,
  `aria-valuemax`
- **Impact:** Screen readers cannot read the confidence value.

### FIND-FE-A11Y-002: ProgressBar missing progressbar role

- **File:** `apps/web/src/components/shared/ProgressBar.tsx:30-34`
- **Missing:** `role="progressbar"`, `aria-valuenow`, `aria-valuemin/max`
- **Impact:** Screen readers cannot read progress.

### FIND-FE-A11Y-003: SearchInput missing aria-label

- **File:** `apps/web/src/components/shared/SearchInput.tsx:19`
- **Missing:** `aria-label` or `<label>` element
- **Impact:** Screen readers announce "edit text" with no context.

### FIND-FE-A11Y-004: Table missing scope/aria-sort/keyboard

- **File:** `apps/web/src/components/shared/Table.tsx:30-55`
- **Missing:** `<caption>`, `scope="col"` on `<th>`, `aria-sort` on sortable
  columns, `onKeyDown` for row click
- **Impact:** Table inaccessible to screen readers and keyboard users.

### FIND-FE-A11Y-005: Keyboard shortcuts modal has no focus trap

- **File:** `apps/web/src/hooks/useKeyboardShortcuts.tsx:63-86`
- **Missing:** `role="dialog"`, `aria-modal="true"`, focus trap
- **Impact:** Keyboard users can tab out of modal into background content.

### FIND-FE-A11Y-006: StatusBadge missing role=status

- **File:** `apps/web/src/components/shared/StatusBadge.tsx`
- **Missing:** `role="status"` or `aria-label`
- **Impact:** Screen readers don't announce status changes.

## MEDIUM — Code Quality

### FIND-FE-001: Duplicate auth systems

- **Files:** `hooks/useAuth.ts` + `store/authStore.ts`
- **Impact:** Two competing auth state managers. Confusion about which to use.
- **Fix:** Consolidate to one (prefer Zustand store).

### FIND-FE-002: Duplicate theme systems

- **Files:** `hooks/useTheme.tsx` + `store/uiStore.ts` (theme field)
- **Impact:** Two competing theme state managers.
- **Fix:** Consolidate to one.

### FIND-FE-003: useKeyboardShortcuts re-creates listeners on every keypress

- **File:** `hooks/useKeyboardShortcuts.tsx:148-204`
- **Code:** `heldKeys` state in effect dependency
- **Impact:** Performance degradation. New event listener on every keypress.
- **Fix:** Use `useRef` for heldKeys instead of state.

### FIND-FE-004: DiffViewer O(n*m) LCS without memoization

- **File:** `components/shared/DiffViewer.tsx:17-82`
- **Impact:** Large diffs freeze the UI.
- **Fix:** Memoize computeDiff result or use diff library.

### FIND-FE-005: Error tracking is a stub

- **File:** `lib/error-tracking.ts:19-21`
- **Current:** Sentry commented out, only console.error
- **Impact:** No production error tracking.
- **Fix:** Implement Sentry or similar.

### FIND-FE-006: StatusBadge colors hardcoded

- **File:** `components/shared/StatusBadge.tsx:12-17`
- **Code:** `bg-green-900/30 text-green-400 border-green-500/30`
- **Impact:** Bypasses design token system. Inconsistent with theme.
- **Fix:** Use design tokens (success/warning/error).

### FIND-FE-007: ProgressBar colors hardcoded

- **File:** `components/shared/ProgressBar.tsx:15-16`
- **Code:** `bg-green-500`, `bg-yellow-500`
- **Impact:** Bypasses design token system.
- **Fix:** Use design tokens.

### FIND-FE-008: Enterprise routes have NO server-side gating

- **File:** `components/layout/Sidebar.tsx:58-68`
- **Current:** Visual "gated" badge only
- **Impact:** Any user can navigate to /admin, /billing, etc.
- **Fix:** Add route-level middleware protection.

### FIND-FE-009: GraphViewer has stale closure bug

- **File:** `components/memory/GraphViewer.tsx:35`
- **Code:** `useEffect` with `[workspaceId]` but fetchGraph not memoized
- **Impact:** Fetches stale data.
- **Fix:** Wrap fetchGraph in useCallback.

### FIND-FE-010: MemoryCorrectionPanel type assertion

- **File:** `components/memory/MemoryCorrectionPanel.tsx:58`
- **Code:** `as never` type assertion
- **Impact:** Hides type mismatch. Potential runtime error.
- **Fix:** Fix the type properly.

### FIND-FE-011: useApi eslint-disable for deps

- **File:** `hooks/useApi.ts:84`
- **Code:** `eslint-disable-next-line react-hooks/exhaustive-deps`
- **Impact:** Changing deps won't trigger refetch. Stale data risk.
- **Fix:** Add deps to dependency array or document why.

### FIND-FE-012: useAuth race condition

- **File:** `hooks/useAuth.ts`
- **Impact:** Multiple useAuth() calls each fire independent api.me() checks.
- **Fix:** Use a singleton or context for auth checks.

## LOW — UX Issues

### FIND-FE-013: Chat Enter sends with no Shift+Enter newline

- **File:** `components/chat/ChatWindow.tsx:123`
- **Impact:** Users cannot type multi-line messages.

### FIND-FE-014: Chat message IDs use Date.now()

- **File:** `components/chat/ChatWindow.tsx:23`
- **Impact:** Collision risk if two messages sent within same millisecond.

### FIND-FE-015: Duplicate 'use client' directive

- **File:** `hooks/useKeyboardShortcuts.tsx:2-3`
- **Impact:** Minor. No runtime effect.

### FIND-FE-016: ExpiryTimer re-subscribes if onExpire not memoized

- **File:** `components/shared/ExpiryTimer.tsx:35`
- **Impact:** Potential infinite re-subscriptions.

### FIND-FE-017: TopNav "Enterprise Mode" text hardcoded

- **File:** `components/layout/TopNav.tsx:38`
- **Impact:** Never changes regardless of workspace context.

### FIND-FE-018: EmptyState min-h-[400px] hardcoded

- **File:** `components/shared/EmptyState.tsx:15`
- **Impact:** Inconsistent with design system spacing.

### FIND-FE-019: ResumeBuilder en-US locale hardcoded

- **File:** `components/resume/ResumeBuilder.tsx:9`
- **Impact:** No i18n support for resume.
