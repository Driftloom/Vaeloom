# P10 Component Code Bugs

**Audit scope:** 12 P10 component files **Method:** Read every file completely,
verify claims against actual code

## Critical Bug: Applications Page Status Case Mismatch (P0)

**File:** `apps/web/src/app/workspace/[workspaceId]/applications/page.tsx:12-18`

```ts
const columns = [
  { id: 'draft', title: 'Draft' },       // lowercase
  { id: 'shortlisted', title: 'Shortlisted' },
  ...
];
// Filter: a.status === col.id  → expects lowercase
```

**Backend** (`schemas/application.py:10`):

```python
status: str = "DRAFT"  # Uppercase
```

**Impact:** Every application has `status: "DRAFT"` (uppercase). The filter
`a.status === 'draft'` (lowercase) **never matches**. Kanban board always shows
0 cards.

**Fix:** `a.status.toLowerCase() === col.id` or use shared enum constants.

---

## Component Bug Report

### 1. SkipLink.tsx — Dead Code

**File:** `apps/web/src/components/shared/SkipLink.tsx` (9 lines)

The component renders `<a href="#main-content" className="skip-link">`. However,
**it is never imported anywhere**. The actual skip link is hardcoded inline in
`apps/web/src/app/layout.tsx:117`.

**Verdict:** SkipLink.tsx is orphaned dead code. The skip link functionality
works via layout.tsx + CSS, but the P10 component file is unused.

**Severity:** LOW (functionality works, component is dead)

---

### 2. Toast.tsx — Timer Leak

**File:** `apps/web/src/components/shared/Toast.tsx:50`

```ts
window.setTimeout(() => dismiss(id), 6000);
```

**Bug:** The `setTimeout` is never cleaned up on unmount. If the component
unmounts before 6 seconds, the timeout fires and calls `dismiss(id)` on an
unmounted state setter. This causes a React warning and memory leak.

**Also missing:**

- No pause on hover (WCAG 2.2.2 Pause, Stop, Hide applies)
- No Escape key handler for keyboard dismiss

**Severity:** MEDIUM

**What's correct:** `aria-live="polite"` IS present on the container (line 64).
`role="region"` and `aria-label="Notifications"` are present.

---

### 3. DiffViewer.tsx — Algorithm Correct, Accessibility Incomplete

**File:** `apps/web/src/components/shared/DiffViewer.tsx`

**Algorithm (lines 21-48):** Standard O(n*m) LCS with DP table + backtracking.
**Correct.**

**Accessibility issues:**

- `aria-details="diff-summary"` (line 99) — not widely supported by screen
  readers
- No `<ins>`/`<del>` elements — removed/added text is styled via CSS only,
  screen readers hear all text as one stream

**Severity:** MEDIUM (algorithm correct, a11y partial)

---

### 4. ProvenanceBadge.tsx — Not Accessible, No Clamping

**File:** `apps/web/src/components/shared/ProvenanceBadge.tsx`

**Bug 1:** No `aria-label`. Screen reader reads raw text "◎ GitHub 85%" with no
semantic meaning.

**Bug 2:** No confidence clamping. If `confidence` is 1.5 or -0.3, renders
`150%` or `-30%`.

```ts
// Line 15 — no clamping
{Math.round(confidence * 100)}%
```

**Severity:** HIGH (broken display + inaccessible)

---

### 5. ConfidenceMeter.tsx — Correct

**File:** `apps/web/src/components/shared/ConfidenceMeter.tsx`

- Clamps: `Math.min(1, Math.max(0, value))` — line 15 ✅
- `role="progressbar"` — line 22 ✅
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` — lines 23-25 ✅
- `aria-label` — line 26 ✅

**Verdict:** PASS. Clean, correct implementation.

---

### 6. ExpiryTimer.tsx — Two Bugs

**File:** `apps/web/src/components/shared/ExpiryTimer.tsx`

**Bug 1: Interval churn (line 35)**

```ts
useEffect(() => {
  const timer = setInterval(() => { ... }, 30000);
  return () => window.clearInterval(timer);
}, [expiresAt, onExpire]);  // ← onExpire in deps
```

If `onExpire` is an inline function (which it is in ApprovalCard line 88), this
creates a new interval on every render.

**Bug 2: Pre-expired race condition** If `expiresAt` is in the past on mount,
`remaining()` returns `{ expired: true }` immediately (line 22). But `onExpire`
is NOT called until the first interval fires (30 seconds later, line 29-31).
Pre-expired timers have a 30-second delay before firing.

**What's correct:** `aria-live="polite"` present (line 40). Cleanup function
present (line 34).

**Severity:** MEDIUM

---

### 7. ApprovalCard.tsx — Mostly Correct

**File:** `apps/web/src/components/shared/ApprovalCard.tsx`

- Composes DiffViewer, ProvenanceBadge, ConfidenceMeter, ExpiryTimer ✅
- Keyboard shortcuts: `A` approve, `R` reject ✅
- Input guard skips shortcuts in INPUT/TEXTAREA/SELECT ✅
- Disabled when expired ✅

**Issues:**

- No `aria-keyshortcuts` attribute on buttons — screen readers don't announce
  shortcuts
- Inherits ExpiryTimer's interval churn bug (inline callback on line 88)

**Severity:** LOW-MEDIUM

---

### 8. Modal.tsx — Correct

**File:** `packages/ui-kit/src/components/Modal.tsx`

- Focus trap: handles Tab/Shift+Tab cycling ✅
- Focus restore: saves `document.activeElement`, restores on unmount ✅
- `useId()` for `titleId` ✅
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` ✅
- `tabIndex={-1}` on dialog ✅
- Esc closes ✅
- Backdrop click closes ✅
- Scroll lock via `document.body.style.overflow = 'hidden'` ✅

**Minor issue:** No `inert` or `aria-hidden="true"` on background content.
Background elements are technically still focusable via screen reader virtual
buffer.

**Severity:** LOW (functionally correct)

---

### 9. ChatWindow.tsx — Correct Claims, Missing Features

**File:** `apps/web/src/components/chat/ChatWindow.tsx`

- `role="log"` — line 57 ✅
- `aria-live="polite"` — line 58 ✅
- AI disclosure on agent messages — lines 81-85 ✅

**Missing:**

- No auto-scroll when new messages arrive
- No `aria-busy` on log region while loading
- Retry button lacks `aria-label`

**Severity:** LOW

---

### 10. Settings Page — Correct

**File:** `apps/web/src/app/workspace/[workspaceId]/settings/page.tsx`

- T3 toggle: genuinely `<input type="checkbox" disabled>` (line 332) ✅
- Typed-confirm: checks `deleteConfirmText !== 'DELETE'` (line 110), NOT
  `window.confirm` ✅
- Delete button disabled until confirmation matches ✅

**Caveat:** Connector permission toggles (lines 130-139) are **cosmetic only** —
state is never sent to backend.

**Severity:** INFO (correctly implemented; cosmetic toggles are expected
pre-P11)

---

## Summary Table

| #   | Component       | Claim                       | Reality                                       | Verdict         |
| --- | --------------- | --------------------------- | --------------------------------------------- | --------------- |
| 1   | SkipLink        | CSS class + accessible      | CSS exists, component is dead code            | **PARTIAL**     |
| 2   | Toast           | aria-live + auto-dismiss    | Both present; timer leak                      | **PASS w/ bug** |
| 3   | DiffViewer      | Correct LCS                 | Algorithm correct; a11y partial               | **PASS**        |
| 4   | ProvenanceBadge | Accessible                  | No aria-label, no clamping                    | **FAIL**        |
| 5   | ConfidenceMeter | 0-1 clamp + progressbar     | Both present                                  | **PASS**        |
| 6   | ExpiryTimer     | Countdown + no leak         | Timer leak + pre-expired race                 | **PARTIAL**     |
| 7   | ApprovalCard    | Composes + keyboard         | Composes correctly; missing aria-keyshortcuts | **PASS w/ bug** |
| 8   | Modal           | Focus trap + restore        | All correct                                   | **PASS**        |
| 9   | ChatWindow      | AI disclosure + role=log    | Both present; missing auto-scroll             | **PASS**        |
| 10  | Settings        | T3 disabled + typed confirm | Both genuinely implemented                    | **PASS**        |
