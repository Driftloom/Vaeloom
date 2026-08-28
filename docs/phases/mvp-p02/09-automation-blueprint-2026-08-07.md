# MVP-P02 — 09. Automation Blueprint (DEC-P02-05)

> **Decision:** User approved automation breadth = **"all above"** (2026-08-07,
> sole approver). Amends DEC-P01-02 (suggest-mode-first) and DEC-P01-04 (no
> auto-apply). Implementation is **tiered with kill-switches** so the product is
> shippable lawfully while later tiers land behind gates.

## 1. Tier overview

| Tier | Name | What it automates | Status | Gate |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------ |
| **T1** | Orchestrated lawful automation | Gmail watch, deadline extraction, application tracking, auto-drafts, reminders, follow-up drafting, URL job ingest, offer/negotiation timeline | MVP core | Ship in MVP |
| **T2** | Read-side discovery scraping | Scrape public job listings (Apify-style) for DISCOVERY only — title, company, description, URL, deadline. Apply stays user/submit-engine driven | Feature flag AUTO-02, per-user opt-in | P13 + legal review |
| **T3** | Auto-apply engine | LLM-generated application, submitted on user's behalf per application | Approval contract default ON; full-auto mode gated | Post-MVP + legal review per platform |

## 2. Tier 1 — lawful automation (in MVP scope)

| Flow | Tooling | Trigger | User touch |
| --------------------------------- | --------------------------------------- | ----------------------------------------- | ------------------------ |
| Deadline extraction | Official Gmail API (polling) | new mail q=deadline/interview/application | none (read) |
| Application auto-track | Gmail parse → structured fact | confirmation email | none |
| Auto-draft (cover letter / reply) | LLM + `gmail.compose` draft | new job saved / follow-up due | **explicit "edit/send"** |
| Reminder + follow-up scheduler | Rules engine + notifications | deadline ≤ 48h; no-reply 5 days | none (notify only) |
| URL job ingest | Link → profile + keywords + match score | user pastes URL | yes (initiate) |
| Interview prep pack | Memory retrieval + LLM assembler | interview scheduled | none (generates) |
| Offer tracker | Structured timeline | offer email / manual entry | yes |

**Unowned:** everything Tier 1 does runs on official APIs (Gmail read + compose
only). No send scope by default.

## 3. Tier 2 — discovery scraping (flagged, opt-in)

- Read-only extract of public listing pages (Apify-style actors / our own
 fetcher) → normalized job record (title, org, description, URL, deadline,
 source).
- **Controls:** feature flag AUTO-02 (default OFF), per-user opt-in, request
 pacing, no login-session scraping, no anti-bot evasion (prompt §16 forbids
 circumvention), kill switch AUTO-02, per-source pause on demand.
- **Risk accepted (registered):** platform ToS exposure on the read side;
 Proxycurl precedent (Microsoft suit → shutdown 2025-07-04) documented.
 Mitigation: opt-in, pacing, legal review before default-ON in P13.

## 4. Tier 3 — auto-apply engine (approval contract)

- Pipeline: job record → LLM tailored application (resume/cover/answers) →
 **approval step** → submit.
- **Modes:**
 - `review-first` (default): draft generated → user reviews/edits → one-click
 send. Meets DEC-P01-02 intent ("never act without approval").
 - `autopilot` (per-plan): user sets per-platform rules (roles, location,
 max/day) → engine submits without per-application review. **Requires** legal
 review sign-off + explicit per-plan user consent + platform ToS check. Audit
 every submission.
- **Controls:** gmail.send enabled **only** when user enables Tier 3 per
 account; per-platform enable/disable; pacing caps (no spam signals — e.g., max
 N applications/day, human-like schedule); kill switch AUTO-03; immutable audit
 log; stop/pivot criteria from DEC-P01-05 apply.

## 5. Kill switches + flags (prompt §13: scoped, owned, expiry, audit)

| ID | Scope | Owner | Default | Kill action | Expiry |
| ------- | ------------------------- | ---------------- | ------- | ------------------------------------------- | -------------- |
| AUTO-01 | Tier-1 automations | Product | ON | disable all scheduled flows | none (core) |
| AUTO-02 | Tier-2 discovery scraping | Platform | OFF | stop all fetches, purge cache | review at P13 |
| AUTO-03 | Tier-3 auto-apply | Product/Security | OFF | halt submissions immediately; geo/plan-wide | review monthly |

## 6. Where this lands in the roadmap

- T1 → P03 requirements; P07 data; P12/13 implementation; tested P13 (T5 suite).
- T2 → P13 behind AUTO-02; legal review input to P13 gate.
- T3 → post-MVP experimental flag; legal + platform review mandatory; NOT in
 first cohort trial run except review-first mode.
