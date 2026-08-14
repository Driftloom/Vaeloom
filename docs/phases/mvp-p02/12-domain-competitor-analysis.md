# MVP-P02 — 12. Domain & Competitor Analysis (WS-02.1)

> Research date: 2026-08-13 · Baseline: `master` @ `4aa6c71` · Constraint:
> **$0
> budget** (DEC-P01-08) · Re-run 2026-08-13 fills the WS-02.1 domain-deliverable
> gap left by the prior run (2026-08-07, which referenced only the P01 brief).
> Evidence labels: **[SOURCE_DERIVED]** = derived from workspace docs (path
> cited) · **[EXTERNAL_VERIFIED]** = web-fetched, URL + access date cited ·
> **[UNKNOWN]** = not verifiable with $0
> tooling · **[NOT_EXECUTED]** = planned, not run. Marketing claims are labelled
> as claims, not evidence.

## 1. Domain: how "hiring" actually works for an Indian fresher (2026)

India launch scope (BQ-03/04) [SOURCE_DERIVED:
`../mvp-p01/04-risk-decision-assumption-register.md`].

### 1.1 Market shape

| Fact                                           | Value                                                                   | Evidence                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Youth (15–29) unemployment, usual status, 2025 | 9.9% (urban 13.6%); CWS Oct-2025 14.9%                                  | [SOURCE_DERIVED: `../mvp-p01/07-research-brief-2026-08-07.md` §1, citing MoSPI PLFS 2025 + Rajya Sabha USQ 2174] |
| Educated (secondary+) unemployment             | 6.5% (2025)                                                             | [SOURCE_DERIVED: same, MoSPI PLFS 2025]                                                                          |
| NEET (15–29)                                   | ~25%                                                                    | [SOURCE_DERIVED: same, PLFS analysis]                                                                            |
| Higher-education enrolment 2023-24             | 45M (record), GER 30                                                    | [SOURCE_DERIVED: same, AISHE 2023-24, released 2026-07-08]                                                       |
| Graduate output (engineering)                  | ~1.5M/yr entering the market; campus placements now run through ATS     | [EXTERNAL_VERIFIED: resumefry.com campus-placement guide, 2026-03-20]                                            |
| Hiring index (Naukri JobSpeak)                 | March 2026 +9% YoY; FY26 +8% — hiring is growing, not contracting       | [EXTERNAL_VERIFIED: staffingindustry.com Naukri JobSpeak coverage, 2026-04-14]                                   |
| Fresher hiring trend                           | +7% YoY (May 2026); double-digit fresher growth months in 2026 reported | [EXTERNAL_VERIFIED: staffingindustry.com, 2026-06-23; masaischool.com job-market summary, 2026-08-10]            |

**Interpretation (inference, labelled):** a large graduate pool (45M enrolled)
plus ~25% NEET with double-digit youth unemployment equals very high application
volume per seeker — consistent with the disconnected-inputs pain (PS-01) being
real for a large population. Not willingness-to-pay proof.

### 1.2 The two-level ATS reality in India

| Fact                                 | Value                                                                                                | Evidence                                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resumes filtered before human review | ~75%                                                                                                 | [SOURCE_DERIVED: P01 brief §2, Naukri career-advice 2026-06-05]. Corroborated by international data [EXTERNAL_VERIFIED: TopResume statistics, 2026-08-05] |
| AI screening at top Indian firms     | 80%+ of top 1,000 firms AI-scan every post                                                           | [SOURCE_DERIVED: P01 brief §2, Naukri citing NASSCOM]                                                                                                     |
| Company-ATS penetration (IT)         | ~89% of IT companies use automated screening; ~75% of Indian companies use ATS                       | [EXTERNAL_VERIFIED: ResumeGyani statistics page, refresh 2026-08-07]                                                                                      |
| Fresher-specific gaps                | 61% omit JD keywords; 34% ATS-breaking formatting; 45% unaware ATS exists                            | [SOURCE_DERIVED: P01 brief §2, ResumeGyani 2026-06-27]                                                                                                    |
| Volume per opening                   | 250+ resumes/opening avg                                                                             | [SOURCE_DERIVED: P01 brief §2, ResumeGyani statistics 2026-06-27]                                                                                         |
| Fresh-data corpus (GoodSpace report) | 33,000+ resumes scanned: 43% missing certifications, avg 449 words, 62% one-page                     | [EXTERNAL_VERIFIED: GoodSpace 2026 report, as summarized in pulse-acquisition.com resume-statistics article, 2026-08-05]                                  |
| Auto-rejection myth                  | 92% of the Atusas/ATSes used by surveyed recruiters do **not** auto-reject; ATS ranks, humans reject | [EXTERNAL_VERIFIED: quickcv.io citing Enhancv ATS study, 2026-08-13]                                                                                      |
| Recruiter attention                  | ~7.4 s average first scan (The Ladders study, widely re-reported)                                    | [EXTERNAL_VERIFIED: stylinngcv.com resume statistics article, 2026-08-13]                                                                                 |

**India-specific mechanics (the part that changes product behavior)**

| Mechanic                | Detail                                                                                                                                                    | Evidence                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Two-level screen        | Portal ATS (Naukri, Internshala) filters **first**; company ATS (iON Digital, SAP SuccessFactors, Taleo, Workday, Greenhouse, Lever) filters inside firms | [EXTERNAL_VERIFIED: resumefry.com India ATS guide, 2026-03-20]                  |
| Format filters          | DOCX parses most reliably; two-column/template layouts scramble; tables/images drop                                                                       | [EXTERNAL_VERIFIED: quickcv.io + resumefry.com formatting guidance, 2026-08-13] |
| Hard filters (freshers) | CGPA cutoffs (commonly 6–7), branch/tier filters, notice-period parsing at TCS/Infosys/Wipro-style pipelines                                              | [EXTERNAL_VERIFIED: rezumea.com "ATS guide for Indian job seekers", 2026-05-20] |
| Campus placement flows  | Now ATS-mediated with mock-test portals (e.g., iON-style); recruiters tune parser matchup                                                                 | [EXTERNAL_VERIFIED: resumefry.com campus-placement guide, 2026-03-20]           |

**Domain consequence for Vaeloom (inference):** "ATS compatibility" is a
_hygiene requirement_, not a wedge — it is already served by free tools, and
ATSes rank rather than auto-reject, so keyword-matching hype is over-rated. The
memory + deadline problem (PS-01/PS-02) sits on top of this reality and is
broadly unserved (see competitor table §4).

### 1.3 The frenetic fresher hiring calendar (why deadlines dominate)

| Fact                                                                                                                               | Evidence                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Three application waves/yr: Jan–Mar, Aug–Oct, Nov–Dec; windows last 3–4 weeks                                                      | [EXTERNAL_VERIFIED: Studojo.com hiring-calendar analysis, 2026-04-19 — vendor analysis; treat as directional, not statistical] |
| Some firms open 7 months ahead (e.g., Goldman Sachs SA program) — deadlines arrive while students are mid-semester                 | [EXTERNAL_VERIFIED: same, 2026-04-19]                                                                                          |
| Online assessment (OA) links expire in 5–7 days; late-found emails mean missed windows                                             | [EXTERNAL_VERIFIED: same, 2026-04-19]                                                                                          |
| Internship market: 25% growth in internships 2024, +135% since 2020; avg stipend ₹8,000/mo; 22% of paid internships convert to PPO | [EXTERNAL_VERIFIED: Internshala internship-report coverage (internshala.com blog, 2024 report), re-accessed 2026-08-13]        |
| Internship geography (2024 report): Delhi-NCR 31%, Mumbai 17%, Bangalore 11%                                                       | [EXTERNAL_VERIFIED: same, 2026-08-13]                                                                                          |

## 2. Journey mapping — P1 "The Fresher" (BQ-P02-02)

> Persona source: P1 "The Fresher" — India, 18–24, first job search; P2 "Urban
> Switcher" secondary [SOURCE_DERIVED: `06-registers.md` BQ-P02-02; personas
> P1–P3 are hypotheses from `../mvp-p01/03-evidence-plan.md` §2, **R-2 cohort
> validation pending** (VB-07) — journey friction rows below are P01-brief +
> external evidence, not cohort-confirmed].

| Stage             | Fresher actions                                                                              | Friction (evidence)                                                                                                                                                         | Vaeloom intervention (design)                                                                                                                           | Signal to measure                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| J1 Orient         | Lists platforms (Naukri, Internshala, LinkedIn), asks seniors, joins Telegram/Discord groups | Unknown which source matters; 45% don't know ATS exists [SOURCE_DERIVED: P01 brief §2]; deadlines arrive via email, not dashboards [UNKNOWN: no cohort evidence yet]        | Ingest emails → auto-classify opportunity/deadline signals; zero re-entry onboarding                                                                    | Activation: # emails ingested, # deadlines surfaced                                                                                    |
| J2 Prepare        | Tailors resume per JD, practices aptitude (COCUBES/iON mock tests), saves documents          | 61% omit JD keywords; 34% ATS-breaking format [SOURCE_DERIVED: P01 brief §2]; resume tooling is free/table-stakes [SOURCE_DERIVED: P01 brief §3]                            | Profile/career memory (auto-filled, never re-entered) → produce ATS-clean, JD-tuned drafts; suggestion-first (trust, PS-03)                             | Draft reuse rate; time saved per resume                                                                                                |
| J3 Apply          | Mass-applies across portals + campus drives                                                  | 250+ resumes/opening ⇒ low per-application care; submissions are the _normal_ mode (user-driven), approval contract governs any automation (DEC-P02-05)                     | Track every application from email confirmations; dedupe statuses across portals; suggest-mode drafts [SOURCE_DERIVED: `09-automation-blueprint.md` T1] | Applications auto-tracked; status accuracy                                                                                             |
| J4 Track          | Juggles statuses, deadlines, OA expiry in email/Excel/Notion                                 | OA links expire 5–7 days, waves are 3–4 weeks [EXTERNAL_VERIFIED: Studojo 2026-04-19]; 10K+ internship openings/day to monitor [EXTERNAL_VERIFIED: Internshala, 2026-08-08] | Deadline extraction + reminders; renewal/resurface in app; prep-assembler on cue                                                                        | Deadline capture precision (BQ-06c threshold open — [SOURCE_DERIVED: `../mvp-p01/04-risk-decision-assumption-register.md` DEC-P01-05]) |
| J5 Interview prep | Prepares per firm/role; remembers what was asked                                             | Context scattered (email + DMs + drive) [UNKNOWN: cohort validation pending, VB-07]                                                                                         | Memory-first retrieval of every source the user fed                                                                                                     | Retrieval success in prep                                                                                                              |
| J6 Select/onboard | Documents, joining letters, background checks                                                | Trust-sensitive (PS-03); consequential actions must be user-approved, draft-only                                                                                            | No auto-sends; drafts + approvals only [SOURCE_DERIVED: P01 brief §5; `../mvp-p01/09-problem-statement.md` S-01/S-02]                                   | Trust events (BQ-06a)                                                                                                                  |

## 3. Wedge restatement (evidence-checked)

**Ingest → organize → remember → assist**, for individual Indian job seekers:
(a) memory-first reuse so data is never re-entered (PS-02); (b) Gmail deadline
extraction + application tracking (PS-01); (c) suggest-mode-first, draft-only,
approved-integration-only (PS-03 trust). Resume optimization = table stakes.
**No PMF claim** — hypotheses to validate with the volunteer cohort.

## 4. Competitor landscape (verified 2026-08-13)

| Product                                               | Model / pricing (verified)                                                                | What it does                                               | Gap vs Vaeloom wedge                                                                                                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naukri (India)                                        | Free + paid services; AI ATS score                                                        | Job board + alerts + resume maker + tracking               | Portal-centric; no memory-first personal assistant, no Gmail deadline extraction [SOURCE_DERIVED: P01 brief §3]                                                                                                           |
| Internshala (India)                                   | Free core; AI resume builder                                                              | #1 fresher/internship platform; 10K+ openings/day          | Platform-side; no personal memory layer; deadline tracking absent [EXTERNAL_VERIFIED: internshala.com, 2026-08-08]                                                                                                        |
| Teal                                                  | Free tier (tracker + resumes); Teal+ $29/mo                                               | Tracking + tailoring workspace                             | Matching is keyword-based (non-contextual — ToolChase review 4.2/5, 2026-07-18); no Gmail ingestion, no memory [EXTERNAL_VERIFIED: tealhq.com pricing + ToolChase review, 2026-08-13]                                     |
| Huntr                                                 | Free: 100 tracked jobs, unlimited basic resumes, 2 tailored resumes; Pro $40/mo ($90/qtr) | Kanban tracker + resume builder + AI gated Pro             | 250K+ users, 5M jobs tracked [EXTERNAL_VERIFIED: huntr.co/pricing + jobsearchhq.com, 2026-05-11]. **Conflict:** applyarc.com (2026-04-06) says "40 tracked jobs" free — vendor page wins; mark UNKNOWN until hands-on (⚠) |
| Rezi                                                  | Free demo (1 resume/3 PDFs); Pro $29/mo; Lifetime $149; Enterprise $99/mo/200 users       | Content-based resume builder (universities/career centres) | Builder-only; no inbox ingestion [EXTERNAL_VERIFIED: rezi.ai pricing, 2026-08-13]                                                                                                                                         |
| Jobscan                                               | Free 5 scans/mo; Premium $29.98–49.95/mo                                                  | ATS match scoring vs real ATSes                            | Point tool; no assistant loop [EXTERNAL_VERIFIED: jobscan.co, 2026-08-13]                                                                                                                                                 |
| Resume Worded                                         | Free partial score; Pro $49/mo, $99/qtr, $229/yr                                          | Line-level resume/LinkedIn analysis                        | Point tool [EXTERNAL_VERIFIED: resumeworded.com, 2026-08-13]                                                                                                                                                              |
| LazyApply                                             | ~$99–999/yr; Trustpilot ~2.4/5 (heavy 1-star cluster)                                     | Mass auto-apply (browser)                                  | Trust-negative; LinkedIn account-risk reports; violates approval contract [EXTERNAL_VERIFIED: jobshq.com review, 2026-06-14]                                                                                              |
| Sonara                                                | $2.95 trial → $23.95/mo; Trustpilot 4.1 (bimodal); 25–40% silent failures reported        | Cloud auto-apply                                           | Trust-negative + opaqueness; supports trust-first stance [EXTERNAL_VERIFIED: jobsearchhq.com, 2026-08-06]                                                                                                                 |
| Simplify                                              | Free extension                                                                            | Autofill across Workday/Greenhouse/iCIMS/Lever             | Boilerplate filler ≠ memory assistant [EXTERNAL_VERIFIED: applyarc.com, 2026-04-06]                                                                                                                                       |
| Resumly                                               | Paid autopilot                                                                            | Email-scan + auto-updating application tracker             | **Closest adjacency** on email-scan tracking but no memory-first trust architecture, no India focus [EXTERNAL_VERIFIED: resumly.ai / comparison write-ups, 2026-08-13; SOURCE_DERIVED: P01 brief §3]                      |
| Scale.jobs                                            | $199–1,099 one-time                                                                       | Human reverse-recruiter                                    | Validates demand for application management; human-scale, not $0 [SOURCE_DERIVED: P01 brief §3]                                                                                                                           |
| Notion / Obsidian / Mem (AI-memory pattern reference) | Notion free/paid + AI $10/mo; Obsidian free local-first; Mem free/$14.99+                 | General AI memory                                          | Pattern reference for memory UX: Mem smoothest/least portable, Obsidian most portable/manual, Notion structured [EXTERNAL_VERIFIED: Toolify/Pulsetic comparisons, 2026-08-05 — used for design reference only]            |

**Competitor conclusions (inference, labelled):**

1. Tracking + resume tools are crowded and commoditized; free tiers exist — the
   wedge must stay memory-first, not "tracker #12" [EXTERNAL_VERIFIED: table
   above; SOURCE_DERIVED: P01 brief §3].
2. Email-deadline extraction with a trust architecture (draft-only, approvals)
   is **unoccupied** in the India fresher segment; Resumly's adjacency exists
   but is paid, non-India, and autopilot-oriented.
3. Auto-apply products (LazyApply/Sonara) carry measurable trust damage —
   validates Vaeloom's suggest-mode-first contract and the BQ-06a STOP trigger
   [SOURCE_DERIVED: `../mvp-p01/05-validation-backlog.md`].

## 5. Implications for Vaeloom MVP (scope guard)

| #   | Implication                                                             | Scope effect                                                                                                |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| I-1 | ATS/resume optimization is hygiene; free competitors exist              | Keep builder-tuned drafts, never as the wedge; no ATS-score paywall claims                                  |
| I-2 | Deadlines live in email and portals; OA links expire in days            | Gmail ingestion + deadline extraction is the differentiator; INTERN/p-campus flows prioritized per J3–J4    |
| I-3 | Trust is the moat vs auto-apply                                         | Draft-only sends, approval payloads, no unconsented submission (DEC-P02-05) — measure trust events (BQ-06a) |
| I-4 | 45M enrolled + fresher-hiring growth ⇒ large TAM                        | BUT willingness-to-pay and retention unproven → cohort validation first (VB-01..08)                         |
| I-5 | Free-tier landscape shifts (pricing updates observed while researching) | Pin at P12/13; recheck quotas in build-buy refresh (`16-build-buy.md`)                                      |

## 6. Residual unknowns (registered, honest)

| ID    | Unknown                                                                 | Status                                                                                    |
| ----- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| UNK-1 | Cohort-level friction distribution across J1–J6 (VB-07)                 | [UNKNOWN] — volunteer cohort required (DEC-P01-07)                                        |
| UNK-2 | Huntr free-tier job cap (100 vs 40 reported)                            | [UNKNOWN] — vendor page cited; hands-on at P12 (⚠ conflict noted §4)                      |
| UNK-3 | Fresher-specific deadline-miss rates in India (no public dataset found) | [UNKNOWN] — no $0 dataset; synthetic + cohort labels per `16-build-buy.md` §(f)           |
| UNK-4 | Willingness to pay / retention at $0 MVP                                | [UNKNOWN] — no monetization in MVP; BQ-05 defers budget model to P04                      |
| UNK-5 | Recruiter-side ATS threshold behavior at Indian portals (funnel stats)  | [UNKNOWN] — portal-internal data not public; inferred from Naukri/ResumeGyani claims only |

## 7. Sources (accessed 2026-08-13 unless noted)

| #   | Source                                     | URL                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | P01 research brief + registers (workspace) | `docs/phases/mvp-p01/07-research-brief-2026-08-07.md`, `04-risk-decision-assumption-register.md`, `05-validation-backlog.md`                                                                                                                                           |
| 2   | P02 prior-run docs (workspace)             | `06-registers.md`, `09-automation-blueprint.md`                                                                                                                                                                                                                        |
| 3   | Naukri JobSpeak coverage (Mar-2026)        | https://www.staffingindustry.com/assets/flexible-workforce-news (2026-04-14)                                                                                                                                                                                           |
| 4   | Fresher hiring +7% (May-2026)              | https://www.staffingindustry.com (2026-06-23); https://masaischool.com/blog (2026-08-10)                                                                                                                                                                               |
| 5   | India ATS guides                           | https://rezumea.com/blog (2026-05-20); https://www.resumefry.com (2026-03-20)                                                                                                                                                                                          |
| 6   | ATS statistics                             | https://resumegyani.com (refresh 2026-08-07); https://www.topresume.com/career-advice (2026-08-05); https://stylinngcv.com (2026-08-13); https://quickcv.io (Enhancv study, 2026-08-13)                                                                                |
| 7   | GoodSpace resume report                    | https://goodspace.com (2026, via https://pulse-acquisition.com 2026-08-05)                                                                                                                                                                                             |
| 8   | Hiring calendar / OA expiry                | https://studojo.com (2026-04-19)                                                                                                                                                                                                                                       |
| 9   | Internshala report + openings              | https://internshala.com/blog (2024 report; 2026-08-08 counts)                                                                                                                                                                                                          |
| 10  | Competitor pricing                         | https://tealhq.com, https://huntr.co/pricing, https://rezi.ai, https://jobscan.co, https://resumeworded.com (all 2026-08-13); https://jobsearchhq.com (2026-05-11, 2026-08-06); https://jobshq.com (2026-06-14); https://applyarc.com (2026-04-06); https://resumly.ai |
| 11  | Reviews                                    | https://toolchase.com (Teal 2026-07-18); Trustpilot.com (LazyApply/Sonara, 2026)                                                                                                                                                                                       |
| 12  | AI-memory pattern reference                | https://toolify.ai, https://pulsetic.com (2026-08-05)                                                                                                                                                                                                                  |
