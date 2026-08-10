# MVP-P09 — 06. Content & Error Copy (DEL-MVP-P09-04)

> Owner: Content Designer. Plain-language-first; ties to RFC 9457 error envelope
> (P08 §03) and state taxonomy (04).

## 1. Voice & tone

- Plain, human, no jargon: "we", "you", short sentences; avoid anthropomorphism
  of agents as people (they are AI assistants — AI disclosure required).
- Honest about capability: suggestions are proposals, never commands.
- Readability: grade ≤ 8 (automated check at P10/P14).

## 2. Error copy pattern (from RFC 9457 `detail`)

| Component | Rule                                           | Example                                                                 |
| --------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| Title     | short, outcome-first                           | "Approval expired"                                                      |
| Detail    | what happened + why, plain language            | "This suggestion expired after 4 hours. Ask again to create a new one." |
| Action    | single next step                               | button: "New approval"                                                  |
| Trace     | `instance`/correlation id in expandable footer | "Reference: req_9f2c…"                                                  |

Forbidden: raw exception strings, `400/500` codes as primary message, stack
traces, internal class names (logging redaction §P17).

## 3. Trust & approval copy (phase rule)

| Surface         | Copy requirement                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Approval diff   | "Approve sending this draft to {recruiter} for {job} at {company}? Draft: {subject}. Expires {time}." + scope line |
| Reject          | "Not approved. Nothing was sent."                                                                                  |
| Expiry          | "Expired {time}. No action was taken."                                                                             |
| Send-class (T3) | explicit warning: "This sends an email. Consent scope: gmail.send. You approved email sending in Settings."        |
| AI disclosure   | "AI-generated suggestion — verify facts before acting" on every agent output                                       |
| Correction      | "You corrected this memory. The previous version is kept in History as superseded."                                |
| Consent revoke  | "{Scope} will stop. Connected data will remain until you delete it."                                               |
| Delete          | typed confirm: "Type DELETE to permanently erase your data and stop all agents." + backup-expiry note (BQ-P07-01)  |

## 4. Empty/partial/offline copy

- Empty: "{Surface} is ready — here's your first step" + primary action
  (EmptyState component).
- Partial: "3 of 5 items imported. Retry failed?" (per-item StatusBadge).
- Offline: "You're offline. Changes are saved and will sync." (queued jobs).

## 5. i18n readiness

English only (BQ-P09-01); all strings routed through existing I18nProvider (en
locale) so future locales (backlog) need no copy refactor.
