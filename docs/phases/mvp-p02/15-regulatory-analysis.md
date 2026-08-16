# MVP-P02 — 15. Regulatory & AI-Risk Analysis (WS-02.4, DEL-MVP-P02-04)

> **Research date:** 2026-08-13 (baseline `4aa6c71`). **Supersedes /
> refreshes:** `docs/phases/mvp-p02/04-regulatory-analysis-2026-08-07.md` (prior
> run kept as historical record). **Honesty contract (prompt §16):** every legal
> claim carries an official source URL + access date; anything not verifiable is
> marked `UNVERIFIED` with date. **No compliance self-claims anywhere.** Every
> obligation row is a design-input mapping only, and **professional legal review
> is required before any compliance claim** (gate: RISK-MVP-P02-04). This
> document is research evidence, not a legal opinion.

## 0. Label legend

| Label               | Meaning                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXTERNAL_VERIFIED` | Verified this session (2026-08-13) against official/authoritative sources below                                                                             |
| `SOURCE_DERIVED`    | Derived from official text/URL identified but full text not independently opened this session; consistent across multiple independent corroborating sources |
| `UNKNOWN`           | Cannot verify; honest open row with date                                                                                                                    |
| `NEW_DESIGN`        | Vaeloom design decision/control proposed by this phase (not a legal claim)                                                                                  |

---

## 1. Verification status — the two mandated re-verifications

### 1.1 India DPDP Rules 2025 — in-force status at 2026-08-13 — `EXTERNAL_VERIFIED`

**Notified:** DPDP Rules 2025 notified by MeitY via Gazette Notification
**G.S.R. 846(E) dated 13 November 2025**; official PIB release confirms
notification (PIB PRID 2148944 / 2190014; official Rules PDF hosted on
meity.gov.in). The DPDP Act, 2023 and the Rules commence in **three phases**
(Section 1(2)/(3) appoint different dates):

| Phase | Date        | What is in force                                                                                                                                                                                                                    | At 2026-08-13                         |
| ----- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1     | 13 Nov 2025 | DPDP Rules 2025 notified; Data Protection Board of India established (Act Ss. 18–26); definitions (S. 2); transitional/misc. provisions (Ss. 35, 38–43, 44(1)/(3)); Rules 1, 2, 17–21                                               | **IN FORCE**                          |
| 2     | 13 Nov 2026 | Board enforcement powers (Ss. 27–28), penalty provisions (Ss. 29–34), Ss. 36–37, S. 1(3); Rule 4 Consent Manager registration opens                                                                                                 | **NOT yet in force** (≈3 months away) |
| 3     | 13 May 2027 | Substantive obligations: notice (S. 5), consent (S. 6), security safeguards + breach notification (S. 8), children (S. 9), SDF (S. 10), Data Principal rights (Ss. 11–14), cross-border transfers (S. 16); Rules 3, 8, 10–15 et al. | **NOT yet in force** (≈9 months away) |

**Precision note (`UNKNOWN` detail):** sources conflict on the exact calendar
day — notification dated **13 Nov 2025** (ssrana/Gazette G.S.R. 846(E); KPMG
guidance; vratex; DLA Piper), while a minority of law-firm materials and the PIB
key-takeaways say **14 Nov 2025** (PIB summary; AmSSardul) with corresponding
Phase 2/3 dates at 14 Nov 2026 / 14 May 2027. Month/year and the three-phase
structure are verified across ≥5 independent sources including the official PIB
release; **the exact day (13th vs 14th) is UNVERIFIED at 2026-08-13** — confirm
with the Gazette notification at P04/P13.

**Practical posture:** substantive obligations are NOT yet enforceable, but the
Board can issue corrective-measure notices even pre-penalty, and compliance
operationalization is expected before 13 May 2027 (KPMG, Vratex, ssrana).
Vaeloom designs to the Phase-3 regime now ("design-to-both" posture, carried
from UNK-P02-01).

### 1.2 EU AI Act — timeline at 2026-08-13 — `EXTERNAL_VERIFIED`

Regulation (EU) 2024/1689 (AI Act), entered into force 1 Aug 2024; **staggered
application**. Critical 2026 update: the **Digital Omnibus on AI — Regulation
(EU) 2026/1744** (adopted by Parliament 16 Jun 2026 and Council 29 Jun 2026,
published in OJ 24 Jul 2026, **in force since 27 Jul 2026**) moved the Annex III
high-risk application date.

| Obligation                                                                                     | Date                                                     | Status at 2026-08-13                                                      |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| Entry into force                                                                               | 1 Aug 2024                                               | passed                                                                    |
| Prohibited practices (Art. 5) + AI literacy (Art. 4)                                           | 2 Feb 2025                                               | passed — in force                                                         |
| GPAI model provider obligations (Ch. V) + penalty regime operative                             | 2 Aug 2025                                               | passed — in force                                                         |
| **Transparency obligations (Art. 50)** — interaction disclosure, AI-generated content rules    | **2 Aug 2026**                                           | **IN FORCE since 2 Aug 2026** (Commission guidelines adopted 20 Jul 2026) |
| Art. 50(2) machine-readable marking for generative systems already on market before 2 Aug 2026 | 2 Dec 2026 (grace)                                       | not yet                                                                   |
| **High-risk Annex III obligations (Ch. III)** incl. employment (Annex III pt. 4)               | **2 Dec 2027** (moved from 2 Aug 2026 by Reg. 2026/1744) | not yet                                                                   |
| High-risk Annex I (embedded in regulated products)                                             | 2 Aug 2028 (moved)                                       | not yet                                                                   |
| New Art. 5(1)(ba)/(bb) prohibitions (non-consensual intimate imagery / CSAM generation)        | 2 Dec 2026                                               | not yet; **NOT_APPLICABLE to Vaeloom**                                    |

**Net change vs the prompt overlay's snapshot:** the overlay ("transparency
obligations applicable from 2026-08-02; other timelines must be re-verified") is
confirmed for transparency; the "other timelines" have changed — Annex III
high-risk moved to 2 Dec 2027, which supersedes the prior run's "obligations
apply Aug 2026" statement (see §9).

---

## 2. India DPDP Act 2023 + DPDP Rules 2025 — obligation map for a consumer AI assistant

Scope hook (S. 3(b)): the Act applies to processing of digital personal data
within India, **and** to processing outside India in connection with offering
goods/services to persons in India (foreign-entity hook). Vaeloom: India launch,
operator may be a non-India entity → within territorial scope.
`EXTERNAL_VERIFIED` (DLA Piper; techprescient).

### 2.1 Notice (S. 5; Rule 3) — applicable, enforceable Phase 3

- Plain-language notice, itemized purposes, standalone prominence, in the
  languages used by the data principal; includes rights, consent withdrawal
  mechanism, grievance/DPO contact. `SOURCE_DERIVED` (KPMG mapping; ssrana).
- **Consent language needed for career data (design input, `NEW_DESIGN`):** per
  purpose-specific consent (S. 6: free, specific, informed, unconditional,
  unambiguous, affirmative) the onboarding flow must itemize and separately
  obtain consent for: (a) Gmail read for deadline extraction + draft creation
  (draft-only), (b) resume/career-document storage + AI processing, (c) memory
  persistence across sessions, (d) telemetry/observability. Each must have an
  independent, easy withdrawal path; withdrawal ≠ data erasure (rights differ),
  and processing must stop on withdrawal.

### 2.2 Consent (S. 6; Rules 3–5) — applicable, enforceable Phase 3

- Free, specific, informed, unconditional, unambiguous + affirmative action;
  **no bundled consent** (S. 6(3)); easy withdrawal (S. 6(4)–(6)); consent
  record-keeping. `SOURCE_DERIVED`.

### 2.3 Data Principal rights (Ss. 11–14) — applicable, enforceable Phase 3

- Access summary (S. 11), correction/erasure (S. 12), grievance redressal (S.
  13), nomination (S. 14). Design impact: export, edit, hard-delete UX for all
  22 memory types; correction/supersession history preserved (prompt §17).
  `SOURCE_DERIVED`.

### 2.4 Breach notification (S. 8(6); Rules) — applicable, enforceable Phase 3

- Duty to inform the Data Protection Board of India and each affected Data
  Principal; **72-hour timeline** per the DPDP Rules. `EXTERNAL_VERIFIED`
  (ssrana; myitmanager 2026-07-23). **`UNKNOWN` detail:** sources disagree on
  the implementing rule number (Rule 7 vs Rule 14) — exact rule numbering to be
  confirmed with counsel at P04/P13.

### 2.5 Security safeguards (S. 8(5); Rule 6) — applicable, enforceable Phase 3

- Reasonable safeguards: encryption, access control, IAM, logging/audit,
  minimization, retention limits. Carried into P05 controls. `SOURCE_DERIVED`.

### 2.6 Data fiduciary duties (Ss. 8, 17) — applicable

- Purpose limitation, data minimization, storage limitation, accuracy, security,
  accountability; no retention beyond purpose (retention per Rule 8
  - Seventh Schedule exceptions for State purposes — not relevant to Vaeloom).
    `SOURCE_DERIVED`.

### 2.7 Children (S. 9) — **NOT_APPLICABLE to Vaeloom MVP, with reasoning**

- "Child" = person who has not completed 18 years (S. 2(a)) — `SOURCE_DERIVED`
  (Act definition; consistently reported). Children's-data processing (incl.
  verifiable parental consent, no behavioral tracking, no detrimental-effect
  processing; Rule 10–12) attaches only to under-18 data principals.
- **Vaeloom min age is 18 (BQ-03/04, ASP-01, re-affirmed 2026-08-13) → the
  children regime does not apply to the user base.** `NEW_DESIGN` control:
  enforce an 18+ onboarding gate so Vaeloom does not _unknowingly_ process a
  child's data (which would flip this analysis on). Recorded 2026-08-13.

### 2.8 Cross-border transfer (S. 16; Rule 15) — permitted-by-default; monitor

- **Negative-list/blocklist model:** transfers are permitted to any country
  **unless** the Central Government notifies restricted countries/territories
  under S. 16(2). **As of 2026-08-13 no restricted-country list has been
  notified** (Lexology 2026-06-16; ComplyDP 2026-08-04; Ahlawat). Phase-3
  enforcement from May 2027; data fiduciary remains accountable for overseas
  processing; contracts with processors/sub-processors required.
  `EXTERNAL_VERIFIED`.
- Radar: re-check for a restricted-list notification at P04/P13.

### 2.9 Significant Data Fiduciary (S. 10; Rule 12–13) — NOT_APPLICABLE at MVP

- Thresholds (volume of data principals / children at scale, as notified) are
  far above a closed MVP cohort; SDF due-diligence duties (incl. algorithmic-
  software review) not engaged at MVP scale. Re-check at P19/scale.
  `SOURCE_DERIVED`.

---

## 3. EU AI Act — classification analysis for Vaeloom (candidate-side assistant)

### 3.1 Is Vaeloom an "AI system"? — Yes (`SOURCE_DERIVED`)

Art. 3(1): a machine-based system designed to operate with varying levels of
autonomy and that may generate outputs — the LLM-driven assistant qualifies
where the Act is otherwise in scope.

### 3.2 Territorial scope at MVP — NOT_APPLICABLE at launch (`NEW_DESIGN` position)

- Art. 2(1)(a): provider **placing on the EU market / putting into service in
  the Union** — MVP launch is India-only, no EU placement.
- Art. 2(1)(c): third-country providers/deployers **where the output is used in
  the Union** — an EU-resident user accessing the product would engage this
  hook; a geo/region gate (India-first, per BQ-03/04) avoids it in practice.
- **Conclusion: EU AI Act not engaged for the India-only MVP; if EU-resident use
  occurs, provider-side Art. 50 transparency duties are the operative surface
  (below).**

### 3.3 High-risk vs minimal-risk — the job-seeker distinction (`NEW_DESIGN` analysis, `SOURCE_DERIVED` law)

**Annex III, point 4(a)** (official text, EC AI Act Service Desk, accessed
2026-08-13):

> "AI systems intended to be used for the **recruitment or selection of natural
> persons**, in particular to place targeted job advertisements, to analyse and
> filter job applications, and to evaluate candidates."

Key distinction — analyzed explicitly:

| Question                                                                | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Basis                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does Vaeloom screen/filter/evaluate **candidates** for an **employer**? | **No.** Vaeloom assists the **job seeker**: it drafts/optimizes the _user's own_ resume and application materials and tracks the _user's own_ applications. It is not used by an employer to analyse/filter/evaluate applicants.                                                                                                                                                                                                                                             | Annex III(4)(a) is employer-side recruitment/selection tooling (EC draft guidelines on high-risk AI in employment, 2026: classification turns on "material influence on employment-related decision-making" — Vaeloom exercises none in any employer's decision chain) |
| Is the **user** a "deployer" with obligations?                          | **Excluded.** Art. 2(10): "This Regulation does not apply to obligations of deployers who are natural persons using AI systems in the course of a purely personal non-professional activity." A private individual's job search is personal non-professional activity.                                                                                                                                                                                                       | Art. 2(10) text (FLI official-text mirror, accessed 2026-08-13)                                                                                                                                                                                                        |
| Is Vaeloom **high-risk** (Annex III(4)(a))?                             | **Reasoned conclusion: NO** — intended purpose is candidate-side assistance, not recruitment/selection by an employer; no profiling of third-party candidates with employment effects; no material influence on hiring decisions.                                                                                                                                                                                                                                            | Art. 6(2) + Annex III(4)(a) + EC employment guidelines                                                                                                                                                                                                                 |
| If EU use occurs, what **does** apply (provider side)?                  | **Minimal-risk + transparency duties:** Art. 50(1)(a) — inform users they are interacting with an AI system (unless obvious — for an explicit AI assistant, document the disclosure anyway); Art. 50(2) — generative text output machine-readable marking/detectability (transitional relief to 2 Dec 2026 for systems on market before 2 Aug 2026); Art. 4 AI literacy measures for the operating team; GPAI obligations sit with the upstream model provider, not Vaeloom. | Art. 50 text; EC transparency guidelines (20 Jul 2026); EC FAQ (24 Jul 2026)                                                                                                                                                                                           |
| Would an **employer-side** variant be high-risk?                        | **Yes — from 2 Dec 2027** (Reg. (EU) 2026/1744): recruitment/screening tooling is Annex III(4)(a) high-risk; the Art. 6(3) derogation is usually unavailable because candidate evaluation is profiling. This is an explicit **future-boundary**: Vaeloom MVP must not add employer-side screening features.                                                                                                                                                                  | Annex III(4)(a); Reg. 2026/1744; EC employment guidelines                                                                                                                                                                                                              |

**Professional-review gate:** the position in §3.3 is a reasoned design
analysis, **not a legal claim**; professional legal review (RISK-MVP-P02-04) is
required before stating the classification publicly or in a compliance
instrument.

### 3.4 Timeline impact of the AI Omnibus (`EXTERNAL_VERIFIED`)

Even had Vaeloom been employer-side, Chapter III obligations would not be
enforceable until **2 Dec 2027** (Annex III stand-alone) / **2 Aug 2028** (Annex
I embedded) per Reg. (EU) 2026/1744, in force 27 Jul 2026. The **2 Aug 2026**
date remains live for Art. 50 transparency — which Vaeloom designs in anyway (AI
disclosure, machine-readable output labels).

---

## 4. ATS / AI limits and platform ToS interplay

### 4.1 ATS/AI restrictions (`EXTERNAL_VERIFIED` + `NEW_DESIGN`)

- **Employer-side AI screening systems** (CV screening, ranking, scoring,
  targeted job ads, candidate evaluation): high-risk under Annex III(4)(a) from
  2 Dec 2027; deployer employers also face Art. 26(7) worker-notification, GDPR
  Art. 22 (solely-automated decisions), and equality law duties. These
  obligations sit on **employers and ATS vendors — not on Vaeloom**.
- **User-side assistance** (what Vaeloom does): outside the employment-side
  high-risk category (see §3.3). No GDPR Art. 22 engagement: Vaeloom makes no
  decisions with legal/significant effects about the user (it suggests; the user
  decides and submits). `NEW_DESIGN`: preserve this boundary — no scoring of
  third-party candidates, no employer-side shortlisting, no "fit score" outputs
  that could be consumed by an employer's process.
- ATS _interoperability_ (resume export for ATS-friendly formatting) is a
  product feature, not employer-side AI — no restriction under the AI Act;
  platform ToS still govern submission behavior (below).

### 4.2 Platform ToS interplay (`EXTERNAL_VERIFIED` where checked / `NEW_DESIGN`)

| Activity                                                                                        | Allowed? | Basis                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gmail read + **draft creation only** via official Gmail API, user-OAuth, least-privilege scopes | ✅       | Google API ToS + User Data Policy compliance; user consent; draft-only means no send/automatic submission (DEC-P01-04, ASP-05)                                                                                               |
| Scraping Naukri/LinkedIn/Indeed                                                                 | ❌       | ToS breach (carried from prior run; unchanged)                                                                                                                                                                               |
| Credential replay / account automation on job platforms                                         | ❌       | ToS breach; unauthorized access; prompt hard rule                                                                                                                                                                            |
| Automated job submission                                                                        | ❌       | DEC-P01-04; only via an approved official integration with payload-bound user approval, at MVP restricted to Gmail-draft + user-submits model                                                                                |
| Tracking user-performed applications                                                            | ✅       | User-entered + Gmail confirmation parsing                                                                                                                                                                                    |
| AI-generated job-application content                                                            | ⚠️       | Allowed for the user's own materials; **platform-specific AI-content policies must be checked per platform** (e.g., LinkedIn AI-generated-content policy) — `UNKNOWN` per-platform detail, verified per connector at P05/P13 |

---

## 5. Student privacy — FERPA, COPPA, DPDP children

### 5.1 FERPA — NOT_APPLICABLE at MVP (reasoned; professional review retained)

- FERPA (20 U.S.C. §1232g; 34 CFR §99.3) defines **"education records"** as
  records directly related to a student that are **maintained by an educational
  agency or institution, or by a party acting for the institution**
  (studentprivacy.ed.gov glossary, accessed 2026-08-13).
- Vaeloom is (1) not an educational agency or institution; (2) **not acting on
  behalf of one** (no institutional contracts; institution administration is
  explicitly out of MVP scope); (3) stores the **user's own** career documents
  in a user-controlled personal workspace — these are not institution-maintained
  education records.
- **Reasoning recorded:** a student's copies of transcripts/letters in their own
  personal tool are not "education records" because the records are not
  maintained by the institution or an institution-directed party.
- **Re-evaluation trigger:** if an institution ever contracts Vaeloom (future
  enterprise scope), FERPA obligations flow to the _institution_ (34 CFR
  §99.31(a)(1) school-official/contractor analysis) and would need contractual
  handling — explicitly deferred, professional review before any US-student
  claims.

### 5.2 COPPA — NOT_APPLICABLE at MVP (reasoned)

- COPPA (15 U.S.C. §§6501–6505; 16 CFR Part 312) applies to operators of online
  services **directed to children under 13** or with **actual knowledge** of
  collecting personal information from under-13 children. Amended rule:
  published in Federal Register 22 Apr 2025, effective 23 Jun 2025, **full
  compliance deadline 22 Apr 2026 (now in full effect)** (FTC; Finnegan
  2026-05-15; Latham 2025-05-14). `EXTERNAL_VERIFIED`.
- Vaeloom: min age 18, not child-directed, India launch, no actual knowledge of
  under-13 users → **not covered**. There is **no COPPA age-verification duty**
  for general-audience services; Vaeloom's 18+ gate is a product/DPDP control,
  not a COPPA requirement. `NEW_DESIGN` + reasoning recorded.
- Radar: FTC policy statement (25 Feb 2026) offering enforcement discretion for
  age-verification-only data collection, and planned age-verification rulemaking
  — relevant only if Vaeloom ever collects age-verification data.

### 5.3 DPDP children — NOT_APPLICABLE (18+), reasoning recorded

- See §2.7. "Child" <18; Vaeloom min age 18 → children regime (verifiable
  parental consent, S. 9; Rules 10–12) does not apply to the user base; 18+
  onboarding gate prevents unknowing child-data processing. Recorded 2026-08-13.

---

## 6. GDPR — applicable-with-proviso (EU residents could use the product)

**Status: APPLICABLE-WITH-PROVISO.** Vaeloom is a web app; nothing prevents an
EU-resident individual from signing up. GDPR applies to processing of personal
data of individuals in the EU (Art. 3(2) offering goods/services or monitoring)
regardless of the operator's location. Professional review required before any
claim (RISK-MVP-P02-04). `EXTERNAL_VERIFIED` (GDPR Art. 3; multiple 2026 sources
incl. myitmanager 2026-07-23).

| Topic                                    | Analysis                                                                                                                                                                                                                                                                                                                                                                                                           | Evidence/design  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Roles                                    | Operator (founder entity) = **controller** (decides purposes/means of the service); the user is a data subject, not a controller.                                                                                                                                                                                                                                                                                  | Art. 4(7)        |
| Lawful bases                             | Consent (Art. 6(1)(a)) for career-data processing features (Gmail read, AI processing, memory); necessity for core account/security operation (Art. 6(1)(b)/(f)) — consent-first design matches DPDP S. 6.                                                                                                                                                                                                         | `NEW_DESIGN`     |
| Special-category data                    | Resumes/Gmail may contain Art. 9 data (health, ethnicity, religion, union membership, disability). Rule: no Art. 9 processing without explicit consent or another Art. 9 ground; design: input-sweep guidance, minimization, explicit-consent framing if the user opts in.                                                                                                                                         | `NEW_DESIGN`     |
| Data subject rights                      | Access, rectification, erasure, restriction, portability, objection — align with DPDP rights UX (export/edit/hard-delete for all memory types).                                                                                                                                                                                                                                                                    | Art. 15–21       |
| Automated decision-making                | Art. 22 NOT_APPLICABLE: Vaeloom suggests; the user decides and approves — no solely-automated decision with legal/significant effects about the user.                                                                                                                                                                                                                                                              | reasoned, review |
| **International transfers (EU ↔ India)** | India has **NO EU adequacy decision** (EDPB adequacy page; legiscope 2026-07-30; tmpartners 2026-02-10) → transfers of EU personal data to India-hosted processing require **Art. 46 safeguards: SCCs (Commission Implementing Decision 2021/914) + transfer impact assessment (Clause 14) + supplementary measures**, or an EU-region-hosting design (data-residency option) to avoid outbound transfer entirely. | Art. 44–49       |
| EU representative                        | Art. 27 representative may be required if EU users at scale — determine if/when EU usage is detected.                                                                                                                                                                                                                                                                                                              | Art. 27          |
| DPIA                                     | Art. 35: career data of EU residents processed by an AI assistant is plausibly high-risk processing → DPIA required before EU-user processing; document as design artifact.                                                                                                                                                                                                                                        | Art. 35          |
| Breach                                   | 72-hour notification to the supervisory authority; coincide with DPDP 72-hour runbook.                                                                                                                                                                                                                                                                                                                             | Art. 33/34       |

**Proviso framing:** at MVP launch (India-only, no EU marketing), GDPR is
engaged _only if_ an EU resident self-registers; the design maps GDPR controls
into the same consent/rights/retention/breach machinery as DPDP (dual-compliance
posture, `NEW_DESIGN`), with professional review before any GDPR compliance
claim.

---

## 7. OWASP mapping — Agentic Top 10 2026 (ASI01–ASI10) + LLM Top 10 2025 (LLM01–LLM10)

**Sources (accessed 2026-08-13):** OWASP Top 10 for Agentic Applications 2026
(genai.owasp.org, released 2025-12-09); OWASP Top 10 for LLM Applications 2025
(genai.owasp.org, v2.0 released 2024-11-18, designations LLM01:2025–LLM10:2025).
Note: an **OWASP GenAI LLM Top 10 2026 edition now exists (current)** per the
OWASP project page — adopt at P05/P12; content not yet reviewed here (`UNKNOWN`
detail, radar).

| Risk category                    | OWASP IDs                                                          | Relevance to Vaeloom MVP                                                                                                                                                                                                   | Control design                                                                                                                                                                                                                                                 | Phase owner                          |
| -------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Prompt injection**             | LLM01:2025; ASI01 Agent Goal Hijack                                | **Highest relevance**: resumes, job descriptions, webpages, emails and Gmail content are ingested as untrusted data — indirect injection via documents is the primary agentic attack; user prompts can also be adversarial | All ingested content treated as untrusted data (prompt §16); no instruction-channel overlap; prompt-boundary hardening; deterministic output/schema validation; suggest-mode (no autonomous action) + draft-only bounds blast radius; hostile-input eval suite | P12 (eval/red team) + P05 (pipeline) |
| **Tool misuse & exploitation**   | LLM06:2025 Excessive Agency; ASI02                                 | Gmail is the only consequential tool at MVP; misuse = wrong-recipient drafts, forged content, exfiltration via drafts                                                                                                      | Gmail **draft-only** enforcement; approved-integration allowlist only; per-tool least-privilege scope; tool-parameter validation; no auto-send/no auto-submit (DEC-P01-04)                                                                                     | P13                                  |
| **Memory/context poisoning**     | LLM04:2025 Data/Model Poisoning; ASI06 Memory & Context Poisoning  | Six memory types persist user career data — poisoned memory (via injected docs) corrupts future suggestions and could leak                                                                                                 | Provenance-carrying memory writes (source doc id/version); versioned memory; user-visible memory review/edit/delete; ingest sweeps; no cross-user memory (single-user, workspace-scoped)                                                                       | P05 + P12                            |
| **Excessive agency**             | LLM06:2025                                                         | Suggest-mode-first; agents must not act outside approval                                                                                                                                                                   | Immutable **payload-bound expiring approval** + idempotency for every consequential action; kill switch + feature flags with owner/expiry/audit; no autonomous job submission                                                                                  | P13                                  |
| **Identity & privilege abuse**   | ASI03; LLM06                                                       | Confused-deputy risk between user identity (OAuth) and workload identity                                                                                                                                                   | User vs workload identity separation; Gmail OAuth with least-privilege draft-only scope; per-agent scoped credentials; no credential reuse/replay; revocation UX                                                                                               | P13 + P05                            |
| **Supply chain**                 | LLM03:2025; ASI04                                                  | Model providers, MCP servers, connectors, npm/pip deps, agent frameworks                                                                                                                                                   | Version-pinned model/tool/MCP/connector registry (P02 source register); AIBOM/SBOM; SLSA provenance for builds; dependency scanning; approved-integration-only; model fallback policy (circuit breaker)                                                        | P05 (+CI gates)                      |
| **Unexpected execution**         | ASI05; LLM05:2025 Improper Output Handling                         | Agents must never execute code or trigger unexpected tool paths                                                                                                                                                            | No code execution by agents; structured tool-call contracts only; output schema validation; no shell/OS integration in MVP; sandbox for any future plugin parsing                                                                                              | P05 + P12                            |
| **Cascading risks**              | ASI08 Cascading Failures; ASI07 Insecure Inter-Agent Communication | 8-agent orchestration — a compromised sub-agent could influence the Orchestrator                                                                                                                                           | Inter-agent trust boundaries; orchestrator fan-out caps; per-agent rate/budget limits; immutable audit log of agent actions; kill switch; correlated-incident telemetry                                                                                        | P05                                  |
| _Human-agent trust exploitation_ | ASI09                                                              | Users may overtrust suggestions (approval UX must not train rubber-stamping)                                                                                                                                               | Transparent AI-disclosure in UX; payload preview before approval; undo; "AI-generated" labeling                                                                                                                                                                | P13 + UX (P09)                       |
| _Rogue agents_                   | ASI10                                                              | Compromised/misaligned agent acting legitimately                                                                                                                                                                           | Immutable per-agent identity in logs; no unlogged consequential action; approval binding to payload hash                                                                                                                                                       | P05                                  |

---

## 8. NIST AI RMF 1.0 + Generative AI Profile — mapping with owners

**Sources (accessed 2026-08-13):** NIST AI 100-1 (AI RMF 1.0, released 26 Jan
2023; **currently being revised** — radar); NIST AI 600-1 (GenAI Profile,
released 26 Jul 2024, 12 GenAI risk categories); NIST AI Agent Standards
Initiative (Feb 2026) — radar for agent-specific guidance.

| RMF function | Vaeloom actions                                                                                                                                                                                                                                                                  | Owner                  | Evidence                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------- |
| **GOVERN**   | Risk posture: suggest-mode-first, draft-only, approval-gated actions; AI inventory (21 agents registered / 8 MVP-canonical / 22 memory types / model + tool versions); policies: data minimization, retention, deletion, incident response; accountable person = founder (BQ-01) | Founder + Security     | This doc; P01 registers; P04 requirements |
| **MAP**      | Context: single-user job-seeker assistant, India, 18+; assets: 22 memory types, Gmail, resumes/JDs; intended purposes: ingest → organize → remember → assist; risk taxonomy: OWASP ASI/LLM (§7); third-party dependencies: model providers, Gmail API, connectors                | P02 (this phase) → P04 | §3–§7 of this doc                         |
| **MEASURE**  | Metrics: hostile-input/prompt-injection eval pass rate, approval-UX completion, memory-accuracy and deadline-extraction accuracy (BQ-06c pivot trigger), false-draft rates, telemetry; baseline + regression suites                                                              | P12                    | P12 eval design                           |
| **MANAGE**   | Mitigations: approval UX (below), draft-only enforcement, retention/deletion lifecycle, breach runbook (DPDP/GDPR 72h), model rollback, kill switch, continuous monitoring                                                                                                       | P13 + P19              | P05/P13 artifacts                         |

**Human oversight design (approval UX, `NEW_DESIGN`):**

- Every consequential action is a **suggestion card** showing the immutable,
  hash-bound payload (what will be drafted/done, to whom), an **expiry**, and an
  explicit user confirm — never a "proceed-all" default.
- Idempotency keys so double-clicks/retries cannot double-act; **undo** and full
  user-visible audit of agent actions; user can reject and edit payloads.
- Human-in-the-loop is the system's default operating mode (suggest-mode), not
  an exception; no autonomous consequential actions (matches OWASP ASI02/06 and
  EU AI Act Art. 14 design intent for high-risk — kept as default design despite
  Vaeloom not being high-risk).

---

## 9. Obligations summary table

> Every row: source URL + access date 2026-08-13 (unless noted); applicability
> is a design-input position; **professional legal review required before any
> compliance claim (RISK-MVP-P02-04)**; owner per row.

| Obligation                                                              | Source (official)                                                                                                                                     | Applicability at MVP                                                                            | Evidence location                      | Prof. review required? | Owner                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------- | ---------------------- |
| DPDP notice (S. 5; Rule 3)                                              | meity.gov.in Rules PDF (`meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf`); PIB `static.pib.gov.in/...doc20251117695301.pdf` | APPLICABLE (enforceable 13 May 2027; design now)                                                | This doc §2.1 → P04 requirements → P05 | YES                    | Founder + Privacy      |
| DPDP consent incl. career-data consent language (S. 6; Rules 3–5)       | same                                                                                                                                                  | APPLICABLE (design now)                                                                         | §2.2 → P04 → P13 onboarding UX         | YES                    | Founder + Privacy      |
| DPDP data-principal rights access/correction/erasure (Ss. 11–14)        | same                                                                                                                                                  | APPLICABLE (design now)                                                                         | §2.3 → P04/P13 export/delete UX        | YES                    | Founder + Privacy      |
| DPDP breach notification (S. 8(6); 72h)                                 | same (rule number `UNKNOWN`)                                                                                                                          | APPLICABLE (design now)                                                                         | §2.4 → P13 runbook                     | YES                    | Founder + Security     |
| DPDP security safeguards (S. 8(5); Rule 6)                              | same                                                                                                                                                  | APPLICABLE (design now)                                                                         | §2.5 → P05                             | YES                    | Security               |
| DPDP fiduciary duties (Ss. 8, 17)                                       | same                                                                                                                                                  | APPLICABLE                                                                                      | §2.6 → P04                             | YES                    | Founder                |
| DPDP children (S. 9)                                                    | same                                                                                                                                                  | **NOT_APPLICABLE** (18+; reasoning §2.7)                                                        | §2.7                                   | YES (before any claim) | Founder + Privacy      |
| DPDP cross-border (S. 16; Rule 15; no restricted list as of 2026-08-13) | same; DLA Piper 2026-02-13; Lexology 2026-06-16                                                                                                       | APPLICABLE-monitor (permitted by default; processor contracts; re-check list)                   | §2.8                                   | YES                    | Founder + Security     |
| DPDP Significant Data Fiduciary (S. 10)                                 | same                                                                                                                                                  | NOT_APPLICABLE at MVP scale                                                                     | §2.9                                   | YES (at scale)         | Founder                |
| EU AI Act Art. 50 transparency (from 2 Aug 2026)                        | EC FAQ `digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act` (24 Jul 2026); guidelines page (20 Jul 2026)          | NOT_APPLICABLE at India-only launch; design-in (AI disclosure + machine-readable output labels) | §3.2/§3.3 → P05/P13                    | YES                    | Founder + AI/ML        |
| EU AI Act Annex III(4)(a) high-risk employment                          | EC AI Act Service Desk Annex III `ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3`; Reg. 2026/1744 (OJ 24 Jul 2026)                                | **NOT_APPLICABLE** — candidate-side assist, not employer screening; reasoning §3.3              | §3.3                                   | YES (before any claim) | Founder                |
| EU AI Act Art. 4 AI literacy (since 2 Feb 2025)                         | Latham 2025-01-31; agentliability 2026-06-14                                                                                                          | NOT_APPLICABLE at launch; design note (team onboarding/eval docs)                               | §3.3                                   | YES (if EU use)        | Founder                |
| GDPR (controller; rights; Art. 22 N/A; Art. 35 DPIA; Art. 27 rep)       | GDPR eur-lex `eur-lex.europa.eu/eli/reg/2016/679/oj`; EDPB adequacy page                                                                              | **APPLICABLE-WITH-PROVISO** (EU-resident users possible)                                        | §6 → P04/P13                           | YES                    | Founder + Privacy      |
| GDPR transfers EU↔India (no adequacy; SCCs 2021/914 + TIA)              | EDPB `edpb.europa.eu` adequacy page; legiscope 2026-07-30                                                                                             | Conditional (if EU users) — SCCs + TIA or EU-region hosting                                     | §6 → P13/P19                           | YES                    | Founder + Security     |
| FERPA                                                                   | studentprivacy.ed.gov glossary (34 CFR §99.3); CRS R46799 (Jun 2026)                                                                                  | **NOT_APPLICABLE** (user-controlled records; reasoning §5.1)                                    | §5.1                                   | YES (before any claim) | Founder                |
| COPPA (amended rule, full effect 22 Apr 2026)                           | FTC `ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa`; Federal Register 22 Apr 2025                                 | **NOT_APPLICABLE** (18+, not child-directed; reasoning §5.2)                                    | §5.2                                   | YES (before any claim) | Founder                |
| Google/Gmail API ToS + User Data Policy; draft-only scopes              | Google (verify scopes at P05)                                                                                                                         | APPLICABLE — draft-only OAuth scopes, no send                                                   | §4.2 → P05/P13                         | YES (connector)        | Security + Integration |
| Job-platform ToS (no scraping/automation)                               | Platform ToS per platform (`UNKNOWN` per-platform detail)                                                                                             | APPLICABLE — hard prohibition                                                                   | §4.2                                   | YES                    | Founder                |
| 18+ onboarding gate                                                     | `NEW_DESIGN` (DPDP S. 9 alignment + cohort)                                                                                                           | APPLICABLE — product control                                                                    | §2.7 → P13                             | no (product)           | Product                |
| OWASP ASI/LLM control program                                           | genai.owasp.org (both lists, accessed 2026-08-13)                                                                                                     | APPLICABLE (voluntary)                                                                          | §7 → P05/P12/P13                       | no                     | Security               |
| NIST AI RMF 1.0 + GenAI profile                                         | `nist.gov/itl/ai-risk-management-framework`; NIST AI 600-1 (Jul 2024)                                                                                 | APPLICABLE (voluntary)                                                                          | §8 → P04/P05                           | no                     | Founder + Security     |

---

## 10. Contradictions vs the 2026-08-07 prior run (`04-regulatory-analysis-2026-08-07.md`)

| #    | Prior run (2026-08-07)                                                                                    | Re-verified (2026-08-13)                                                                                                                                                                                                                                                                            | Severity            |
| ---- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| C-01 | "Resume-screening/recruitment AI = high-risk under EU AI Act (Annex III); **obligations apply Aug 2026**" | **Superseded**: the Digital Omnibus (Reg. (EU) 2026/1744, in force 27 Jul 2026) moved Annex III obligations to **2 Dec 2027** (Annex I: 2 Aug 2028). Prior run omitted the Omnibus entirely.                                                                                                        | High — date changed |
| C-02 | "transparency duties from Aug 2026"                                                                       | **Confirmed** — Art. 50 transparency applied 2 Aug 2026 (EC FAQ, 24 Jul 2026; guidelines 20 Jul 2026); 50(2) marking grace to 2 Dec 2026.                                                                                                                                                           | None                |
| C-03 | EU AI Act "NOT_APPLICABLE to MVP launch" (India-only) with thin reasoning                                 | **Retained with depth**: added Art. 2(1)(c) territorial hook, Art. 2(10) personal non-professional deployer exclusion, intended-purpose analysis vs Annex III(4)(a), EC draft employment-guidelines reference.                                                                                      | Refined             |
| C-04 | Student privacy treated as one US blob ("FTC/COPPA-analogous… not applicable to India launch")            | **Split and deepened**: FERPA (education-records definition, 34 CFR §99.3), COPPA (amended rule now in full effect 22 Apr 2026), and DPDP S. 9 children (18+ reasoning) each analyzed separately.                                                                                                   | Refined             |
| C-05 | DPDP phases 13 Nov 2025 / 13 Nov 2026 / 13 May 2027 from secondary sources                                | **Confirmed month/year** via PIB + MeitY + KPMG/DLA Piper/vratex; **day ambiguity (13 vs 14 Nov) now flagged `UNVERIFIED`**; breach rule-number conflict (Rule 7 vs 14) newly flagged                                                                                                               | Detail              |
| C-06 | GDPR not analyzed in prior 04 doc                                                                         | **Added**: applicable-with-proviso, controller analysis, rights, SCCs + TIA for EU↔India (no adequacy decision), Art. 27/35, special-category data                                                                                                                                                  | New scope           |
| C-07 | — (not covered)                                                                                           | **New findings**: DPDP S. 16 negative-list model (no restricted countries notified as of 2026-08-13); OWASP ASI01–ASI10 pinned (2026); OWASP LLM Top 10 2026 edition exists; NIST AI RMF being revised + Agent Standards Initiative (Feb 2026); FTC age-verification policy statement (25 Feb 2026) | New scope           |

---

## 11. External-dependency radar (per phase overlay)

| Item                                                                                                | Trigger                                                | Owner             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------- |
| DPDP restricted-country list notification (S. 16)                                                   | Re-check at P04 and P13                                | Founder + Privacy |
| DPDP Phase 2/3 commencement notifications (Nov 2026 / May 2027; exact-day 13 vs 14)                 | Re-check at P04 and P13                                | Founder           |
| EU: Commission Annex III classification guidelines (draft) + any Omnibus follow-up                  | Re-check at P13/P19                                    | Founder           |
| EU: possible India adequacy assessment (2026–2027 per analysts)                                     | Re-check at P19                                        | Founder           |
| OWASP GenAI LLM Top 10 2026 (current edition; content `UNKNOWN` to this doc)                        | Adopt at P05/P12                                       | Security          |
| NIST AI RMF revision + Agent Standards Initiative (Agent Interoperability Profile expected Q4 2026) | Adopt at P05                                           | Security          |
| FERPA 2024 final regulations                                                                        | Only if US student data ever enters scope (not at MVP) | Founder           |
| FTC age-verification rulemaking + Feb 2026 policy statement                                         | Only on US expansion                                   | Founder           |
| Platform AI-content policies (e.g., LinkedIn AI-generated content policy)                           | At each connector approval (P05/P13)                   | Integration       |

---

## 12. Evidence links (all accessed 2026-08-13)

| Claim                                                                               | Source                                                                                                                                                                                                                                                                                                | Label                                                                                                            |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| DPDP Rules 2025 notified (G.S.R. 846(E), 13 Nov 2025)                               | https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf (PIB) + https://ssrana.in/articles/meity-notifies-final-digital-personal-data-protection-rules-2025                                                                                                     | `EXTERNAL_VERIFIED`                                                                                              |
| DPDP Act 2023 + Rules 2025 official text                                            | https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf ; https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf                                                                                                                           | `SOURCE_DERIVED` (full text not opened this session; section-level claims corroborated by KPMG/ssrana/DLA Piper) |
| DPDP phased commencement + Act Ss./Rules mapping                                    | https://assets.kpmg.com/content/dam/kpmgsites/in/pdf/2025/11/dpdp-rules-2025-guidance-to-dpdp-act-implementation.pdf (KPMG, Nov 2025); https://www.dlapiperdataprotection.com/?c=IN&t=law (2026-02-13)                                                                                                | `EXTERNAL_VERIFIED`                                                                                              |
| EU AI Act Art. 50 applies 2 Aug 2026                                                | https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act (EC FAQ, 24 Jul 2026)                                                                                                                                                                                  | `EXTERNAL_VERIFIED`                                                                                              |
| AI Omnibus Reg. (EU) 2026/1744 adopted/in force 27 Jul 2026; Annex III → 2 Dec 2027 | https://ishighriskai.com/digital-omnibus (reviewed 4 Aug 2026); https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-omnibus-vii-deadline-delay-20260 (8 Jul 2026); Council press release 29 Jun 2026 (referenced); OJ citation https://eur-lex.europa.eu/eli/reg/2026/1744/oj | `EXTERNAL_VERIFIED`                                                                                              |
| EU AI Act Art. 2(10) personal-use exclusion; Annex III(4)(a) text                   | https://artificialintelligenceact.eu/article/2/ ; https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3 (EC official)                                                                                                                                                                            | `EXTERNAL_VERIFIED`                                                                                              |
| EC draft guidelines high-risk AI in employment (2026)                               | https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/eu-commission-publishes-draft-guidelines-on-high-risk-ai-in-employment                                                                                                                                       | `EXTERNAL_VERIFIED`                                                                                              |
| GDPR + no India adequacy; SCCs 2021/914                                             | https://edpb.europa.eu/topics/international-transfers-and-international-cooperation/adequacy-decision_en ; https://www.legiscope.com/blog/india-eu-data-transfers.html (2026-07-30)                                                                                                                   | `EXTERNAL_VERIFIED`                                                                                              |
| FERPA "education records" definition (34 CFR §99.3)                                 | https://studentprivacy.ed.gov/glossary ; https://www.congress.gov/crs-product/R46799 (Jun 2026)                                                                                                                                                                                                       | `EXTERNAL_VERIFIED`                                                                                              |
| COPPA amended rule (FR 22 Apr 2025; full effect 22 Apr 2026)                        | https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule ; https://www.finnegan.com/en/insights/articles/coppas-amended-rule-is-now-in-full-effect-what-operators-need-to-know.html (2026-05-15)                                                      | `EXTERNAL_VERIFIED`                                                                                              |
| OWASP Agentic Top 10 2026 (ASI01–ASI10)                                             | https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026 (release 2025-12-09)                                                                                                                                                                                                  | `EXTERNAL_VERIFIED`                                                                                              |
| OWASP LLM Top 10 2025 (LLM01–LLM10)                                                 | https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf (2024-11-18); 2026 edition: https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/                                                                                       | `EXTERNAL_VERIFIED` (2025); `UNKNOWN` content (2026)                                                             |
| NIST AI RMF 1.0 (26 Jan 2023, being revised) + GenAI Profile AI 600-1 (26 Jul 2024) | https://www.nist.gov/itl/ai-risk-management-framework                                                                                                                                                                                                                                                 | `EXTERNAL_VERIFIED`                                                                                              |

---

## 13. Open unknowns (`UNKNOWN` rows — honest, not placeholders)

| ID         | Unknown                                                                             | Status at 2026-08-13                    | Due     |
| ---------- | ----------------------------------------------------------------------------------- | --------------------------------------- | ------- |
| UNK-REG-01 | DPDP Phase 2/3 exact commencement day (13 vs 14 Nov/May)                            | Source conflict; month/year verified    | P04     |
| UNK-REG-02 | DPDP breach-notification implementing rule number (Rule 7 vs 14)                    | Source conflict                         | P04     |
| UNK-REG-03 | DPDP S. 16 restricted-country list                                                  | None notified as of 2026-08-13; monitor | P04/P13 |
| UNK-REG-04 | Platform AI-content policies per job platform                                       | Verify per connector                    | P05/P13 |
| UNK-REG-05 | OWASP GenAI LLM Top 10 2026 content                                                 | Edition exists; content not reviewed    | P05     |
| UNK-REG-06 | Whether EU residents self-register at MVP (triggers GDPR proviso + Art. 50 surface) | No telemetry of residency at MVP design | P13/P19 |

**Final statement for this deliverable:** WS-02.4 research complete —
`DEL-MVP-P02-04` written as design-input evidence; **no compliance claims
made**; professional legal review gate (RISK-MVP-P02-04) applies to every
obligation row before any claim. Handoff: carry §9 table + §10 contradictions +
§11 radar into P03/P04 requirements; register rows into
`06-registers-2026-08-07.md` at phase close.
