# MVP-P02 — 01. Evidence Plan

> Research phase: nothing here is runtime implementation; every claim must carry
> a source, date, and reproducibility step (prompt §9, §15, §18, §23).

## 1. Research questions

| RQ       | Question                                                                                                                                   | Source of truth                                           | Done by |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------- |
| RQ-02-01 | What are the current Gmail API rules for push watch, renewal, quota, and draft creation (draft-only contract)?                             | Official Google Gmail API docs                            | WS-02.2 |
| RQ-02-02 | Which official job-platform APIs exist (Naukri/LinkedIn/etc.), what do they allow for an individual job seeker, and what do they prohibit? | Official developer/partner docs of each platform          | WS-02.2 |
| RQ-02-03 | Are there lawful, sanctioned ways to track job applications (email parsing, manual entry, platform-native trackers)?                       | Platform docs + product policies                          | WS-02.2 |
| RQ-02-04 | What open/consented datasets exist for eval (resume parsing, deadline extraction, ATS matching) without PII?                               | Official dataset sources                                  | WS-02.3 |
| RQ-02-05 | Which data fields/artifacts does Vaeloom need to store, classify, and retain per DPDP + EU AI Act obligations?                             | DPDP Act 2023, DPDP Rules 2025, EU AI Act guidance        | WS-02.4 |
| RQ-02-06 | Is resume screening/ATS assist high-risk under EU AI Act for India launch? Student privacy (FERPA/COPPA analogies) applicability?          | EU AI Act official guidance; professional review required | WS-02.4 |
| RQ-02-07 | Which $0 build components (OSS + official free tiers) cover eval, retrieval, storage, and orchestration with acceptable limits?            | Official vendor docs                                      | WS-02.5 |

## 2. Workstream plan

| WS      | Workstream                  | Key tasks                                                                            | Output                      |
| ------- | --------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| WS-02.1 | User/domain research        | R-1 evidence from P01; R-2 interviews — **BLOCKED: cohort signup needs user action** | P01 brief + blocked item    |
| WS-02.2 | Platform/standards research | Gmail push/quota/draft research; job-platform API research; MCP connector rules      | `02-platform-research.md`   |
| WS-02.3 | Data/source feasibility     | Data inventory, sensitivity, retention; eval-set plan                                | `03-data-feasibility.md`    |
| WS-02.4 | Legal/privacy/AI-risk       | DPDP mapping, EU AI Act classification, ATS/AI limits, student privacy               | `04-regulatory-analysis.md` |
| WS-02.5 | Build-buy evidence          | OSS/free-tier comparison for eval, retrieval, storage, orchestration                 | `05-build-buy.md`           |
| —       | Gate                        | Weighted gate 95–100 GO; 88–94 conditional                                           | `07-gate-report.md`         |

## 3. Evidence register (template)

| EVD             | Claim                                              | Requirement | Type                   | Location                     | Result | Date       | Verified by        |
| --------------- | -------------------------------------------------- | ----------- | ---------------------- | ---------------------------- | ------ | ---------- | ------------------ |
| EVD-MVP-P02-001 | Gmail push watch rules                             | MVP-P02-R01 | official docs          | `02-platform-research.md`    | TBD    | 2026-08-07 | Security Architect |
| EVD-MVP-P02-002 | Job-platform API status                            | MVP-P02-R01 | official docs          | `02-platform-research.md`    | TBD    | 2026-08-07 | Security Architect |
| EVD-MVP-P02-003 | Eval datasets free/consented                       | MVP-P02-R03 | official sources       | `03-data-feasibility.md`     | TBD    | 2026-08-07 | Data Architect     |
| EVD-MVP-P02-004 | DPDP/EU-AI applicability                           | MVP-P02-R04 | official text + review | `04-regulatory-analysis.md`  | TBD    | 2026-08-07 | Compliance         |
| EVD-MVP-P02-005 | $0 stack limits verified                           | MVP-P02-R05 | vendor docs            | `05-build-buy.md`            | TBD    | 2026-08-07 | AI/ML Engineer     |
| EVD-MVP-P02-006 | Automation tier decision (DEC-P02-05, "all above") | MVP-P02-R06 | user decision          | `09-automation-blueprint.md` | DONE   | 2026-08-07 | User (approver)    |
| EVD-MVP-P02-007 | Scraping legal precedent (Proxycurl)               | MVP-P02-R06 | documented case        | `02-platform-research.md` §2 | DONE   | 2026-08-07 | Security Architect |

## 4. Validation backlog for P02 (cohort-dependent)

| ID    | Item                                           | Needs | Status  |
| ----- | ---------------------------------------------- | ----- | ------- |
| VB-07 | Interview session signup (founder network)     | User  | BLOCKED |
| VB-08 | Eval-set consent + synthetic-resume generation | User  | BLOCKED |
