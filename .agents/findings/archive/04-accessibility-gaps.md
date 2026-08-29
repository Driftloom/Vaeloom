# Accessibility Gaps — WCAG 2.2 AA Audit

**Audit scope:** All P10 components and key pages **Method:** Verify actual ARIA
attributes, keyboard behavior, screen reader compatibility

## Component-Level A11y Status

### ✅ Correctly Implemented

| Component              | WCAG Criterion               | Implementation                                      |
| ---------------------- | ---------------------------- | --------------------------------------------------- |
| SkipLink CSS           | 2.4.1 Bypass Blocks          | `.skip-link` class with sr-only + focus styles      |
| Toast                  | 4.1.3 Status Messages        | `aria-live="polite"` on container                   |
| ConfidenceMeter        | 1.3.1 Info and Relationships | `role="progressbar"`, full ARIA attributes          |
| Modal                  | 2.4.3 Focus Order            | Focus trap + restore, `role="dialog"`, `aria-modal` |
| ChatWindow             | 4.1.3 Status Messages        | `role="log"`, `aria-live="polite"`                  |
| Settings T3 toggle     | 4.1.2 Name, Role, Value      | Genuinely `disabled` in HTML                        |
| Settings typed-confirm | 3.3.2 Labels or Instructions | Real input, not `window.confirm`                    |

### ❌ Missing or Broken

| Component       | WCAG Criterion               | Issue                                      | Severity |
| --------------- | ---------------------------- | ------------------------------------------ | -------- |
| SkipLink.tsx    | 2.4.1 Bypass Blocks          | Component is dead code — never imported    | LOW      |
| Toast           | 2.2.2 Pause, Stop, Hide      | No pause on hover for auto-dismiss         | MEDIUM   |
| Toast           | 2.1.1 Keyboard               | No Escape key handler                      | LOW      |
| ProvenanceBadge | 1.3.1 Info and Relationships | No `aria-label`, no role                   | HIGH     |
| ProvenanceBadge | 1.4.1 Use of Color           | No non-color indicator of source           | MEDIUM   |
| ExpiryTimer     | —                            | Pre-expired timer doesn't fire immediately | MEDIUM   |
| ApprovalCard    | 2.1.1 Keyboard               | Missing `aria-keyshortcuts` on buttons     | MEDIUM   |
| DiffViewer      | 1.3.1 Info and Relationships | No `<ins>`/`<del>` for screen readers      | MEDIUM   |
| DiffViewer      | 4.1.2 Name, Role, Value      | `aria-details` has poor support            | LOW      |
| ChatWindow      | 2.4.3 Focus Order            | No auto-scroll to new messages             | MEDIUM   |
| ChatWindow      | 4.1.3 Status Messages        | No `aria-busy` while loading               | LOW      |
| Modal           | 4.1.2 Name, Role, Value      | No `inert` on background content           | LOW      |

## Page-Level A11y Status

### Applications Page (newly wired)

| Check               | Status                                               |
| ------------------- | ---------------------------------------------------- |
| Semantic HTML       | ✅ Uses `<h2>`, `<h3>` for headings                  |
| Keyboard navigation | ✅ All interactive elements focusable                |
| Status badges       | ⚠️ Use `<span>` with aria-label — correct but verify |
| Loading state       | ✅ LoadingSpinner component                          |
| Error state         | ✅ ErrorState component                              |
| Empty state         | ✅ EmptyState component                              |

### Settings Page

| Check                | Status                               |
| -------------------- | ------------------------------------ |
| Form labels          | ✅ All inputs have labels            |
| Error messages       | ✅ `role="alert"` on errors          |
| Confirmation flow    | ✅ Typed confirm, not window.confirm |
| Receipt after action | ✅ `role="status"` on receipt        |

## Critical A11y Gaps by WCAG Criterion

### 1.3.1 Info and Relationships (Level A)

- ProvenanceBadge: no semantic meaning for source/confidence
- DiffViewer: no `<ins>`/`<del>` for additions/removals

### 1.4.1 Use of Color (Level A)

- ProvenanceBadge: relies on text only, no icon/shape differentiation

### 2.1.1 Keyboard (Level A)

- Toast: no Escape key handler
- ApprovalCard: keyboard shortcuts not announced via `aria-keyshortcuts`

### 2.2.2 Pause, Stop, Hide (Level A)

- Toast: auto-dismiss not pausable on hover

### 2.4.1 Bypass Blocks (Level A)

- SkipLink.tsx is dead code (functionality exists in layout.tsx)

### 4.1.2 Name, Role, Value (Level A)

- ProvenanceBadge: no accessible name
- Modal: background not inert

### 4.1.3 Status Messages (Level A)

- ChatWindow: no `aria-busy` while loading

## Recommendations

1. **ProvenanceBadge** — Add `aria-label={`Source:
   ${source}, Confidence: ${Math.round(confidence * 100)}%`}`
2. **DiffViewer** — Use `<ins>` and `<del>` elements instead of CSS-only styling
3. **Toast** — Add `onMouseEnter` pause, `onMouseLeave` resume, Escape key
   handler
4. **ApprovalCard** — Add `aria-keyshortcuts="a r"` to the card region
5. **ChatWindow** — Add auto-scroll ref, `aria-busy={isLoading}`
6. **Modal** — Add `inert` attribute to background overlay
7. **SkipLink.tsx** — Either delete the dead code or import it in layout.tsx
