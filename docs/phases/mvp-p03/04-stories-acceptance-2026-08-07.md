# MVP-P03 — 04. Stories & Acceptance (DEL-MVP-P03-02)

> Atomic user stories with acceptance criteria. IDs: US-*. Map to FR/NFR via
> `05-traceability-matrix.md`.

## P0 stories (release-blocking)

| ID    | Story                                                                                                  | Acceptance criteria                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-01 | As a P1 fresher, I sign up and consent to Vaeloom processing my data, so my search starts lawfully.    | Notice shown (DPDP §5); explicit consent recorded (DPDP §6); age/region/entity validated (18+, India, individual); account created in my workspace |
| US-02 | As a user, I upload my resume and Vaeloom builds my structured profile, so I never re-type my details. | Parse ≥90% accuracy (BQ-P02-03) on eval set; fields editable; corrections versioned with supersession (FR-05/68)                                   |
| US-03 | As a user, I connect Gmail read-only, so application confirmations and deadlines are auto-tracked.     | OAuth least-privilege scopes; polling watcher runs; deadline facts extracted ≥90% accurate with provenance (FR-40/41)                              |
| US-04 | As a user, I get deadline reminders, so I never miss an interview or offer window.                     | Reminder fires per schedule; mark-done updates memory; duplicate reminders prevented (NFR-h17)                                                     |
| US-05 | As a user, every consequential action needs my approval — suggestion never acts on its own.            | Proposal UI → approve/reject; approval record immutable, payload-bound, expiring (FR-50/51); replay fails                                          |
| US-06 | As a user, I can export everything or delete everything, and I get a receipt.                          | Export in documented format (NFR-23); erasure 100% across all stores (FR-61); receipt distinguishes primary vs backup expiry (FR-62, NFR-20)       |
| US-07 | As a user, my data stays in my workspace — no cross-user leakage.                                      | Isolation suite passes (NFR-15/h15); RLS + composite constraints + authz                                                                           |

## P1 stories (MVP must-have)

| ID    | Story                                                                                                | Acceptance criteria                                                                |
| ----- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| US-10 | As a user, I paste a job link and Vaeloom extracts the role, skills, and deadline.                   | Enrichment record with provenance; low-confidence fields labeled (FR-04, 64)       |
| US-11 | As a user, I get ATS match scores and tailoring suggestions for a JD.                                | Score reproducible; suggestions with rationale; user applies (FR-21/22)            |
| US-12 | As a user, I review a generated cover-letter draft before it is sent.                                | Draft created in Gmail drafts; send only on my explicit action (FR-42, DEC-P01-03) |
| US-13 | As a user, applications I made are tracked with statuses I can update.                               | Status provenance recorded; updates flow to memory (FR-30/35)                      |
| US-14 | As a P2 switcher, my preferences (roles, salary, location) shape fit-ranking of saved opportunities. | Ranked list with reasons; preferences stored in memory (FR-31)                     |
| US-15 | As a user, I can navigate with keyboard only and screen reader at AA level.                          | axe + manual checks pass (NFR-20/h21)                                              |

## P2/P3 stories (gated)

| ID    | Story                                                                                      | Acceptance criteria                                                                                 | Gate                            |
| ----- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------- |
| US-20 | As a user, I opt in to auto-discover public job listings.                                  | AUTO-02 OFF default; opt-in consent; pacing; kill switch stops fetches; no anti-bot evasion (FR-32) | P2, legal review pre-default-ON |
| US-21 | As a user, I review and approve each auto-generated application before send.               | Per-application approval record; idempotency; audit (FR-33/35)                                      | P1 review-first                 |
| US-22 | As a user, I configure autopilot (roles/location/max per day) and it applies within rules. | Plan config; pacing caps; audit; AUTO-03 kill; legal+platform review sign-off before enablement     | P3 gated                        |
