# MVP-P09 — 03. IA & Journeys (DEL-MVP-P09-01)

> Owner: UX Lead + Product Designer. Grounded in live route inventory (23
> pages). **Re-audited 2026-08-18: corrected from 27 to 23 page.tsx files.**

## 1. IA model

MVP = single-workspace personal intelligence product. Information architecture
groups the 18 workspace routes into 6 spaces:

| Space | Routes (existing) | Purpose |
| -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Assist** | dashboard `/workspace/{ws}` · chat | Daily entry: status, suggestions, ask-assistant |
| **Memory** | files · memory (graph) · history | Ingest → organize → remember; provenance & correction |
| **Career** | resume · jobs · applications | Resume value, ATS score, job search, applications |
| **Operations** | schedule · notifications · connectors | Scheduler, reminders, Gmail, deadline extraction |
| **Trust & Rights** | settings (consent, data export/delete, scopes) | DPDP/AI-transparency core journeys (design target) |
| **Enterprise-gated** | admin · billing · organizations · feature-flags · marketplace · developer(+webhooks) · status | Visible-but-gated; NOT primary MVP journeys (CF-P09-02) |

Navigation order (Sidebar redesign target): Assist → Memory → Career →
Operations → Trust & Rights; enterprise group visually separated (divider +
"Enterprise" label, locked states).

## 2. Persona journeys (P1/P2 — requirements baseline)

| Journey | Persona | Steps (map to routes) | Design emphasis |
| ---------------------------- | ------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| J1 Onboarding | both | signup → connector consent → first document → first memory | Consent explainer (scopes, DPDP), empty-state guidance, AI disclosure |
| J2 Ingest | both | files upload → parse progress (jobs 202) → memories created | Loading/partial/failure states; provenance badge |
| J3 Remember & correct | both | memory graph → memory detail → edit → supersession shown | Correction diff, version history, confidence display |
| J4 Resume/ATS value | P2 | resume → ATS score vs JD → improvement suggestions | Score + rationale, confidence, provenance of claim |
| J5 Lawful opportunity assist | P1/P2 | jobs → deadline extracted → **approval request** → approve with diff + expiry | Trust/approval states (design target) |
| J6 Gmail draft-only | P2 | connectors (Gmail OAuth) → deadline facts → draft created → user reviews draft | Draft-only framing, no send path in UI |
| J7 Reminders | P1 | schedule → reminder due → notification → action | Due/overdue/cancelled states |
| J8 Data rights | both | settings → consent scopes · export (async job) · delete (idempotent) | Rights as first-class journeys, confirmation + receipt |
| J9 Ask assistant | both | chat → answer w/ provenance links → memory write w/ approval if consequential | AI disclosure, provenance, correction affordance |

## 3. Future-readiness backlog (governed, NOT in scope)

| Idea | Trigger | Owner |
| ------------------------------- | ----------------------- | ---------------- |
| Hindi locale (stretch) | Cohort evidence of need | Content Designer |
| Cross-user/team memory | P20+ | Product |
| Mobile-native app | P20+ | Product |
| Marketplace/enterprise surfaces | enterprise track | Product |

Each recorded with adoption trigger; none expand MVP scope now.
