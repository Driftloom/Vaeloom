# MVP-P09 — 04. Screen & State Specs (DEL-MVP-P09-02)

> Owner: Product Designer + Accessibility Specialist. State taxonomy covers
> prompt §12.1 across all key screens; implementation at P10, evidence P14.

## 1. State taxonomy (every screen must define)

loading · empty · partial · conflict · stale · offline · denied · expired ·
retry · cancelled · success · failure · undo/rollback.

| State     | Design rule                                                                               | Components                        |
| --------- | ----------------------------------------------------------------------------------------- | --------------------------------- |
| loading   | skeleton or spinner (LoadingSpinner exists); never shift layout; `aria-busy`              | Spinner, ProgressBar (async jobs) |
| empty     | first-run guidance + next action (EmptyState exists)                                      | EmptyState                        |
| partial   | banner "2 of 5 items failed — retry" + per-item status                                    | StatusBadge + ErrorState          |
| conflict  | revision shown, no silent overwrite; "view both" (memory correction)                      | Modal + diff view                 |
| stale     | `stale` chip + "refresh" (data newer than view)                                           | StatusBadge                       |
| offline   | non-blocking banner; queued actions marked pending                                        | TopNav banner                     |
| denied    | 403 state w/ reason + request-access path; enterprise-gated lock                          | ErrorState                        |
| expired   | approval/review expiry + recreate affordance (FR-51)                                      | ApprovalDiff card                 |
| retry     | exponential backoff shown; manual retry for user-initiated ops                            | ErrorState + button               |
| cancelled | confirmation; undo where reversible (FR-68 supersession)                                  | Modal + toast                     |
| success   | toast + confirmation; receipt for rights ops (FR-62)                                      | Toast (new)                       |
| failure   | RFC 9457 `detail` → plain-language message + correlation id                               | ErrorState                        |
| undo      | reversible within window (supersession, draft delete); irreversible ops get typed confirm | Modal                             |

## 2. Key screen specs (trust & approval — phase rule)

### 2.1 Approval card (evolve `ProposalCard`)

Current: approve/reject buttons only. **Design target:**

| Element       | Spec                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Header        | agent + action type + `expires in 4h` countdown (FR-50)                                                          |
| Diff          | payload diff view: action target, source (job id/url), exact fields to change; "what will happen" plain language |
| Risk          | risk explanation line + scopes it touches                                                                        |
| Provenance    | source badges: connector, message id, confidence                                                                 |
| Controls      | Approve / Reject / View details; keyboard: `a` approve, `r` reject (focused card); disabled on expiry            |
| A11y          | `role="region"` + `aria-label`, focus moves into card, live region for status change                             |
| Consequential | send-class actions show T3 warning + consent scope; no silent skip                                               |

### 2.2 Memory correction

- Edit opens diff: old vs new; "This replaces memory #x — previous version kept
  in history (superseded)". Save → success toast + history link. Undo within
  window → restores superseded row.

### 2.3 Data rights (settings)

- Consent scopes list w/ per-connector toggle (existing Toggle) + plain-language
  purpose; revoke → "Gmail watching will pause" warning (matches P08 watcher
  contract).
- Export: button → async job progress (ProgressBar) → download link + manifest
  (NFR-23).
- Delete: typed confirmation (type "DELETE") + idempotent receipt; explains
  backup-expiry semantics (BQ-P07-01).

### 2.4 Chat + AI disclosure

- Assistant replies carry "AI-generated — verify" disclosure (EU AI Act
  transparency; EXT-15), provenance links to memories, correction affordance,
  confidence meter for memory retrieval (BQ-P02-03 ≥80% target).

### 2.5 Gmail draft-only

- Connector card states: not connected → connecting (OAuth PKCE) → connected
  (drafts only) → degraded (watch paused) → error. No send button anywhere
  (DEC-P02-05).

## 3. Responsiveness

Desktop-first (BQ-P09-01): ≥1024px full IA; 768–1023 tablet (sidebar
collapsible); <768 mobile web (bottom nav for primary 5 spaces, hamburger for
rest). No horizontal scroll on mobile; touch targets ≥44px.
