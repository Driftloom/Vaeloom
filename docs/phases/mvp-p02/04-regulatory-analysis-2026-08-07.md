# MVP-P02 — 04. Regulatory & AI-Risk Analysis (WS-02.4)

> Research date: 2026-08-07 · **No self-claimed compliance** (prompt §16;
> professional legal review required before any public compliance claim). This
> is a design-input mapping, not a legal opinion.

## 1. India DPDP Act 2023 + DPDP Rules 2025 — status (RQ-02-05)

**Status (verified 2026-08-07):** DPDP Rules 2025 notified **13 Nov 2025** by
MeitY (PIB official release), with phased enforcement:

| Phase   | Effective   | Scope                                                                                                                       |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 | 13 Nov 2025 | DPDP Rules notified; Data Protection Board of India (DPBI) established; definitions                                         |
| Phase 2 | 13 Nov 2026 | Consent Manager registration opens (Rule 4)                                                                                 |
| Phase 3 | 13 May 2027 | Full enforcement: consent, notice, security safeguards, breach notification, Data Principal rights, penalties (₹10k–₹250cr) |

**Core obligations relevant to Vaeloom (design now, verify at P04/P13 with
counsel):**

- **§5 Notice** — plain-language privacy notice, purpose-specific, standalone,
  includes rights + withdrawal + grievance contact (Rule 3).
- **§6 Consent** — free, specific, informed, unconditional, unambiguous;
  affirmative action; withdrawal with easy mechanism; consent record-keeping.
- **Reasonable security safeguards** (Rule 6) — encryption, access control, IAM,
  logging.
- **Breach notification** — 72-hour notification duty (full enforcement 2027).
- **Children's data** — special rules (verified-user consent); MVP audience is
  18+ (BQ-03/04), but onboarding must verify age.

**Design implications:** consent-first onboarding (notice + specific consent per
purpose: Gmail read, resume storage, telemetry), consent withdrawal UX, deletion
lifecycle, breach-response runbook, and audit logging — all already in MVP
backlog; DPDP phases give time before penalties but **obligations are being
operationalized now** (design-to-both posture, UNK-P02-01).

## 2. EU AI Act — applicability to resume/ATS assist (RQ-02-06)

- Resume-screening/recruitment AI = **high-risk** under EU AI Act (Annex III);
  obligations apply Aug 2026; transparency duties from Aug 2026.
- **Vaeloom India-launch posture:** MVP launch is India-only (BQ-03/04) → EU AI
  Act NOT_APPLICABLE to MVP launch; re-check on EU expansion (already flagged
  RISK-P00-11/P01 CF-P01-02). Keep AI disclosure + human-in-the-loop as default
  design anyway (cheaper than retrofitting).
- ATS/AI limits: for the _user-facing_ assistant (helping the candidate
  optimize), it is **not** employer-side screening — reduces high-risk
  classification surface; professional review confirms before any claim.

## 3. Student privacy (FTC/COPPA-analogous, US)

- Not applicable to India launch (18+ users); re-check on expansion (carried
  CF-P01-02). No U.S. student-data posture until US launch.

## 4. Platform ToS / lawful-use boundaries (prompt §16 hard rule)

| Activity                               | Allowed? | Basis                                                    |
| -------------------------------------- | -------- | -------------------------------------------------------- |
| Gmail read + draft via official API    | ✅       | User consent + scopes                                    |
| Scraping Naukri/LinkedIn/Indeed        | ❌       | ToS breach; scraping vendors being sued (Proxycurl case) |
| Credential replay / account automation | ❌       | ToS breach; unauthorized access                          |
| Automated job submission               | ❌       | DEC-P01-04; platform ToS                                 |
| Tracking user-performed applications   | ✅       | User-entered + Gmail confirmation parsing                |

## 5. Evidence links

| Claim                                                          | Source                                                                                                                     | Verified   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| DPDP Rules 2025 notified 13 Nov 2025 (PIB)                     | https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf                              | 2026-08-07 |
| Phased enforcement timeline (Phase 3 = 13 May 2027, penalties) | https://digitalanumati.com/insights/is-dpdp-act-in-force/ ; https://www.dpdp.ind.in/rules.php                              | 2026-08-07 |
| §5 notice / §6 consent / Rule 6 safeguards / Rule 3 notices    | https://www.dpdp.ind.in/rules.php ; https://www.dpo-india.com/Resources/privacy_laws_in_India/DPDP-Rules-2025-Notified.pdf | 2026-08-07 |
| EU AI Act high-risk timeline                                   | P01 research brief (carried)                                                                                               | 2026-08-07 |
