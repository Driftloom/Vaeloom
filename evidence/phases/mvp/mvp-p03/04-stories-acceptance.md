# MVP-P03 — 04. Stories & Acceptance (DEL-MVP-P03-02)

> **MVP-P03 re-run 2026-08-14.** Baseline: repo `master` @ `23cc0b4`. Prior P03
> run 2026-08-07 superseded; historical files preserved as `*-2026-08-07.md`.
> P02 accepted by USER 2026-08-13 (gate 88.20/100, DEC-P02-06) — BQ-P02-01..04
> baked into acceptance criteria below: memory-first value prop, primary persona
> P1 "The Fresher" (P2 secondary), retrieval hit-rate ≥80%, deadline extraction
> ≥90%, zero data-loss, 100% deletion, load 100 / 1,000 concurrent. DEC-P02-05:
> T1 = MVP core; T2/T3 = proposals only (flag-gated AUTO-02/03, never
> default-ON, legal review P13) — US-20/21/22 carry explicit gates. Atomic user
> stories with acceptance criteria. IDs: US-*. Map to FR/NFR via
> `05-traceability-matrix.md`. Priority: P0 release-blocking / P1 MVP must-have
> / P2-P3 gated (proposal-only).

## P0 stories (release-blocking)

| ID | Story | Priority | Acceptance criteria | Impl Status |
| ----- | ------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| US-01 | As a P1 fresher ("The Fresher"), I sign up and consent to Vaeloom processing my data, so my search starts lawfully. | P0 | Notice shown (DPDP §5); explicit consent recorded and withdrawable (DPDP §6, NFR-17); age/region/entity validated (18+, India, individual, FR-01); account created in my workspace | IMPLEMENTED_UNVERIFIED |
| US-02 | As a P1 fresher, I upload my resume and Vaeloom builds my structured profile, so I never re-type my details. | P0 | Parse ≥90% accuracy on eval set (FR-03, BQ-P02-03); profile fields editable (FR-02); corrections versioned with provenance + supersession, never silent overwrite (FR-05, FR-h68) | IMPLEMENTED_UNVERIFIED |
| US-03 | As a P1 fresher, I connect Gmail read-only, so application confirmations and deadlines are auto-tracked. | P0 | OAuth least-privilege, no send scope by default (FR-40, NFR-16); polling watcher runs (FR-40); deadline facts extracted ≥90% with provenance (FR-41, BQ-P02-03); facts land in memory (FR-10/11/12) | IMPLEMENTED_UNVERIFIED |
| US-04 | As a P1 fresher, I get deadline reminders, so I never miss an interview or offer window. | P0 | Reminder fires per schedule (FR-43); mark-done updates memory; duplicate reminders prevented (NFR-h17); calendar writes only with approval (FR-43) | IMPLEMENTED_UNVERIFIED |
| US-05 | As a P1 fresher, every consequential action needs my approval — a suggestion never acts on its own. | P0 | Proposal UI → approve/reject (FR-51); approval record immutable, payload-bound, expiring (FR-50, ADR-009); replay/payload-mutation/expiry fail; untrusted content cannot change policy/approval (FR-13, FR-h70, NFR-18) | IMPLEMENTED |
| US-06 | As a P1 fresher, I can export everything or delete everything, and I get a receipt. | P0 | Export in documented, versioned, importable format (FR-60, NFR-23); erasure 100% across all stores, zero data-loss (FR-61, BQ-P02-03); receipt distinguishes primary vs backup expiry (FR-62, NFR-h20) | PARTIAL |
| US-07 | As a P1 fresher, my data stays in my workspace — no cross-user leakage. | P0 | Isolation suite passes (NFR-15, NFR-h15); RLS + composite constraints + service authz; per-workspace queries verified | PARTIAL |

## P1 stories (MVP must-have)

| ID | Story | Priority | Acceptance criteria | Impl Status |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| US-10 | As a P1 fresher, I paste a job link and Vaeloom extracts the role, skills, and deadline. | P1 | Enrichment record with provenance (source URL, timestamp, FR-04); low-confidence fields labeled, never shown as confirmed fact (FR-11, FR-h64); retrieval hit-rate ≥80% on memory lookup (FR-10, BQ-P02-03) | IMPLEMENTED_UNVERIFIED |
| US-11 | As a P1 fresher, I get ATS match scores and tailoring suggestions for a JD. | P1 | Score reproducible on eval set with explanation (FR-22); tailoring suggestions with rationale; user applies edits (FR-21); file ops proposed, never auto-applied (FR-20) | IMPLEMENTED_UNVERIFIED |
| US-12 | As a P1 fresher, I review a generated cover-letter draft before it is sent. | P1 | Draft created in Gmail drafts (FR-42); send only on my explicit action (DEC-P01-03); no auto-send outside the T3 review-first gate (FR-42) | IMPLEMENTED_UNVERIFIED |
| US-13 | As a P1 fresher, applications I made are tracked with statuses I can update. | P1 | Tracker reflects source-of-truth status (FR-30); updates flow to memory; every application records source, approval, artifact versions, status provenance, timestamps (FR-35) | IMPLEMENTED_UNVERIFIED |
| US-14 | As a P2 switcher (secondary persona), my preferences (roles, salary, location) shape fit-ranking of saved opportunities. | P1 | Ranked list with reasons per profile×JD fit (FR-31); preferences stored in memory (FR-10); no auto-submission (FR-31) | IMPLEMENTED_UNVERIFIED |
| US-15 | As a P1 fresher, I can navigate with keyboard only and screen reader at WCAG 2.2 AA level. | P1 | axe + manual checks pass (NFR-20, NFR-h21): keyboard-only, SR, reduced-motion, zoom, non-color-only | PARTIAL |

## P2/P3 stories (gated — proposals only per DEC-P02-05)

| ID | Story | Priority | Acceptance criteria | Gate | Impl Status |
| ----- | ------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ----------- |
| US-20 | As a P1 fresher, I opt in to auto-discover public job listings. | P2 | AUTO-02 OFF by default (AUTO-02, FR-32); explicit opt-in consent; pacing; kill switch stops fetches; no anti-bot evasion | P2, legal review pre-default-ON (P13) | DESIGN_ONLY |
| US-21 | As a P1 fresher, I review and approve each auto-generated application before send. | P3 | Per-application approval record (FR-33/35); idempotency (NFR-h17); audit trail; send only on my explicit action (FR-42) | P3 gated — AUTO-03, legal review (P13) | DESIGN_ONLY |
| US-22 | As a P1 fresher, I configure autopilot (roles/location/max per day) and it applies within rules. | P3 | Plan config; pacing caps; audit; AUTO-03 kill switch; never default-ON (FR-34, AUTO-03) | P3 gated — legal + platform review sign-off | DESIGN_ONLY |

## Implementation gap stories (added 2026-08-16, zero-trust audit)

| ID | Story | Priority | Acceptance criteria | Impl Status |
| ----- | ----------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| US-30 | As a developer, the middleware stack is complete so security controls are enforced on every request. | P0 | TenantMiddleware, IPAllowlistMiddleware mounted in `main.py`; RBAC covers all protected routes; RLS on all tenant_id tables (FR-71, FR-72, FR-75, FR-73) | NOT_IMPLEMENTED |
| US-31 | As an operator, the /metrics endpoint works so I can monitor the system in production. | P1 | `/metrics` returns Prometheus format; OTel spans created per request; trace context propagated (FR-76, FR-77) | NOT_IMPLEMENTED |
| US-32 | As a QA, test infrastructure exists so I can run comprehensive smoke, security, and regression tests. | P1 | `testing/smoke/`, `testing/security/` each have at least 1 passing test; CI runs them (FR-80) | NOT_IMPLEMENTED |
