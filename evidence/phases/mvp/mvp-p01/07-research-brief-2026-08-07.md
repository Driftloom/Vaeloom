# MVP-P01 — 07. Research Brief (R-1 desk research, 2026-08-07)

> Free-tooling-only research (DEC-P01-07). Every claim below carries its source.
> Marketing claims are marked as claims, not evidence. No interviews conducted
> yet (R-2 pending cohort — DEC-P01-06).

## 1. Market context — India (launch region, BQ-03/04)

| Fact | Value | Source |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Youth (15–29) unemployment, usual status, 2025 | **9.9%** (down from 10.3% in 2024); urban youth **13.6%** | MoSPI PLFS Annual Report 2025 (PIB press release, 2026-03-27) |
| Youth (15–29) unemployment, CWS, Oct 2025 | **14.9%** (monthly revamped PLFS) | MoSPI via Ministry of Labour & Employment, Rajya Sabha USQ 2174 (2025-12-18) |
| Educated (secondary+) unemployment, 15+, 2025 | **6.5%** (down from 7.0%) | MoSPI PLFS Annual Report 2025 |
| Youth not in employment, education or training (NEET) | **~25% of 15–29** | PLFS analysis (studyiq.com summary of PLFS 2025) |
| Higher education enrolment 2023-24 | **4.50 crore (45M)** — record; GER 30 (18–23); female GER 31.2, GPI 1.08 | AISHE 2023-24 (Ministry of Education, released 2026-07-08) |
| Labour search behavior | Top job-search effort: "apply to employers/answer job advertisements" + "seek help from relatives/friends" | MoSPI PLFS 2025 press note |

**Interpretation (marked as inference):** a large, growing graduate pool (45M
enrolled; ~25% NEET) faces double-digit youth unemployment concentrated among
the educated — i.e., high application volume per job seeker, consistent with the
disconnected-inputs problem (PS-01) being a real, large-population pain. Not
proof of willingness-to-pay or product-market fit.

## 2. ATS reality for Indian job seekers

| Fact | Value | Source |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Resumes filtered before human review | **~75%** (3 in 4) | Naukri career-advice citing Naukri data from 91M+ profiles (2026-06-05) |
| AI screening at large Indian firms | **80%+ of India's top 1,000 firms** run AI scan on every post | Naukri citing NASSCOM 2026 IT Sector Outlook |
| Applications per opening | **250+** resumes per job opening (avg) | ResumeGyani statistics page (2026-06-27) |
| Fresher keyword gap | **61% of freshers** omit job-description keywords; **34%** have ATS-breaking formatting | ResumeGyani scan data (2026-06-27) |
| ATS awareness | **45% of job seekers don't know what ATS is** | ResumeGyani user survey (2026-06-27) |
| Optimization effect | optimized users report **3.2× more interview calls**; 78% of 80+ ATS scores get callbacks | ResumeGyani platform data (2026-06-27) |

**Interpretation:** resume/ATS optimization is a demonstrated, measurable value
point for Indian freshers, but tools exist and are free (below). Vaeloom must
not position "resume builder" as the wedge — it is table stakes. The
memory-assisted re-use of profile/career data (PS-02) is the defensible
differentiator.

## 3. Competitive landscape (observable, 2026)

| Product | Model | Pricing | Observable capability | Gap vs. Vaeloom wedge |
| ---------------------------- | ------------------------------------------------ | ---------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naukri (India) | Job board + alerts + resume maker + AI ATS score | Free + paid services | Search, apply, tracking, AI resume scan | Portal-centric; **no memory-first personal assistant, no Gmail deadline extraction** |
| WorkIndia / Apna | Blue-collar job apps | Free | Direct HR contact, local jobs | Different segment (blue/grey collar) |
| Teal | Job-search workspace | Free tier; ~$29/mo premium | Resume tailoring + application tracking | Tracking/optimization, **no memory-first personalization, no deadline extraction** |
| Jobscan | ATS optimization | $49.95/mo premium; free 5 scans/mo | Match scoring vs. real ATSs | Point tool; no assistant loop |
| Resume Worded / Kickresume | Resume writing/health | Free limited; $24–49/mo | Line-level writing analysis | Point tools |
| Autojob / LazyApply / Sonara | Auto-apply | $2.95–29.99/mo | Mass auto-submission | **Trust-negative** (LazyApply ~52% 1-star reviews); violates Vaeloom's approved-integration + user-approval contract; risk of bot-detection rejection |
| Scale.jobs | Human-assisted applications | $199–$1,099 one-time | Reverse-recruiter service | Pricey, human-scale; validates demand for application management but not productizable to $0 |
| Resumly | Autopilot job search agent | paid | Automated application tracking by scanning email | Closest adjacency; **email-scan tracking without memory-first trust architecture; not India-focused** |

Sources: Naukri.com (product pages, 2026-06-05 guide), Google Play/App Store
listings (2026), scale.jobs blog (2026-07-14), bestjobsearchapps.com
(2026-08-03), jobscan.co (2026-06-30), Resumly.ai.

**Trust signal:** auto-apply tools carry a measurable trust deficit (LazyApply
mixed reviews; "recruiters reject sloppy AI auto-filled applications" —
Scale.jobs). This supports PS-03 (trust blocks adoption) and Vaeloom's
suggest-mode-first + draft-only + payload-bound-approval design as a deliberate
differentiation.

## 4. Regulatory overlay (India launch)

| Item | Status | Source |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| DPDP Act 2023 + DPDP Rules 2025 | Staged commencement; notice/consent, rights, child-data duties apply to India scope | INT-02 standards overlay; meity.gov.in |
| EU AI Act resume-screening classification | Resume screening = **high-risk AI**; obligations from ~Aug 2026 | Pin.com citing Greenberg Traurig analysis (2026) — **note: not applicable to India launch; re-check on EU expansion** |
| FERPA / COPPA | NOT_APPLICABLE for India 18+ launch; re-check on region/age expansion | CF-P01-02 |

## 5. Wedge statement (from evidence, not vibes)

**Ingest → organize → remember → assist for individual Indian job seekers
(18+):** a memory-first assistant that (a) reuses profile/career/document memory
so users never re-enter data (PS-02), (b) extracts deadlines from Gmail and
tracks applications (PS-01), and (c) stays suggest-mode-first with draft-only
Gmail and approved-integration-only submission (PS-03 trust). Resume
optimization is a free/table-stakes feature, not the wedge. **No
product-market-fit claim** — this is a hypothesis to validate with the free
volunteer cohort (VB-01..06).

## 6. Sources list

1. MoSPI PLFS Annual Report 2025 — pib.gov.in PressReleasePage.aspx?PRID=2246009
 (2026-03-27)
2. MoSPI PLFS 2025 press note (PDF, mospi.gov.in, 2026-03-27)
3. Rajya Sabha USQ 2174, Ministry of Labour & Employment (2025-12-18) —
 dge.gov.in
4. AISHE 2023-24, Ministry of Education (2026-07-08) — dohe-education.gov.in /
 dashboard.aishe.gov.in
5. Naukri "AI ATS Guide for India 2026" (2026-06-05) — naukri.com/career-advice
6. ResumeGyani "Resume & Job Market Statistics India 2026" (2026-06-27)
7. scale.jobs "10 AI Tools… 2026" (2026-07-14)
8. bestjobsearchapps.com comparisons (2026-08-03/05); jobscan.co (2026-06-30);
 Resumly.ai (2024-09)
9. Google Play / App Store: Naukri, WorkIndia listings (2026)
10. Pin.com resume-parsing tools (EU AI Act note, 2026)
