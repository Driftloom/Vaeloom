# MVP-P02 — 03. Data & Source Feasibility (WS-02.3)

> Research date: 2026-08-07. Feeds P07 (data architecture) and P03 requirements.

## 1. MVP data inventory (what Vaeloom stores per INT-02)

| Artifact                                       | Sensitivity                   | Basis                                               | Retention                                           | Notes                        |
| ---------------------------------------------- | ----------------------------- | --------------------------------------------------- | --------------------------------------------------- | ---------------------------- |
| Resume / profile data (user-uploaded or built) | Personal + possibly sensitive | User-provided                                       | User-controlled; default until deletion             | PII-stripped for eval        |
| Gmail messages (read-only ingestion)           | Personal, confidential        | Consent + purpose (deadline/application extraction) | Extract-only, no full-body retention beyond purpose | Draft-only; no send          |
| Deadline/application facts (extracted)         | Personal                      | Derived                                             | Until purpose ends / user deletion                  | Structured, owned by user    |
| Job postings / saved opportunities             | Public data                   | User-saved                                          | Until user removes                                  | From user paste/manual entry |
| Interview/negotiation/onboarding records       | Personal                      | User-entered                                        | User-controlled                                     | Suggest-mode only            |
| Telemetry                                      | Behavioral                    | Consent                                             | Anonymized                                          | No cross-user data (INT-02)  |
| Evaluation datasets                            | Non-PII (synthetic/consented) | License-reviewed                                    | Versioned in repo                                   | See §3                       |

## 2. Source feasibility summary

| Source                          | Feasible for MVP?         | Means                                | Constraint                                 |
| ------------------------------- | ------------------------- | ------------------------------------ | ------------------------------------------ |
| Gmail (deadlines/applications)  | ✅                        | Official API, polling, read + drafts | Consent, scopes, quota (RQ-02-01 answered) |
| Naukri/LinkedIn/Indeed jobs     | ⚠️ user-performed         | Manual paste/save + tracking         | No consumer API (RQ-02-02/03 answered)     |
| Resume parsing eval data        | ✅                        | Open datasets + synthetic generation | License check per dataset (RQ-02-04)       |
| Interview/negotiation knowledge | ✅                        | Public guidance + user records       | Not user-data-derived claims               |
| Cohort user data                | ✅ (pending VB-07 signup) | Consent-first onboarding             | Volunteer cohort only                      |

## 3. Recommended evaluation datasets (free, licensing checked)

| Dataset                                                                    | Source                    | License      | Size      | Use                                                     |
| -------------------------------------------------------------------------- | ------------------------- | ------------ | --------- | ------------------------------------------------------- |
| `datasetmaster/resumes` (real + Faker-synthetic, normalized JSON)          | Hugging Face              | MIT          | 4,817     | Resume parsing/classification eval                      |
| CareerCorpus (annotated resumes, 6 categories)                             | Mendeley Data (CC-BY-4.0) | CC-BY-4.0    | 302       | Resume classification cross-check                       |
| `ai-resume-screening-and-hiring-analytics` (synthetic end-to-end pipeline) | Kaggle                    | synthetic    | large     | Pipeline simulation (P07 test data)                     |
| `saugataroyarghya/resume-dataset`                                          | Kaggle                    | **CC BY-NC** | ~2,400    | ⚠️ Non-commercial — eval reference only, NOT in product |
| Self-generated synthetic resumes (Faker)                                   | In-repo tooling           | MIT (own)    | unlimited | Deadline extraction + privacy-safe CI tests             |

Rules: any dataset used in shipped eval must be license-compatible
(MIT/Apache/CC-BY/CC0 or generated); CC BY-NC excluded from product use (prompt
§18: validate licensing).

## 4. Data-flow constraints for design

1. **No cross-user data** — workspace-scoped everything (INT-02).
2. **Extract, don't retain:** Gmail body processed in-memory; only structured
   deadline/application facts persisted, tied to consent purpose.
3. **Deletion lifecycle:** user deletion purges primary + projections
   (vector/graph/search caches) — P07 requirement.
4. **Provenance:** each fact records source message/upload + extraction
   timestamp (prompt §17).
5. **Draft-only:** no `gmail.send` scope; drafts created only via explicit user
   action (DEC-P01-03).
6. **Eval data hygiene:** no real cohort PII in CI; synthetic/consented only.

## 5. Evidence links

| Claim                             | Source URL                                                                                      | Verified   |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| Resume dataset (MIT, 4,817)       | https://huggingface.co/datasets/datasetmaster/resumes                                           | 2026-08-07 |
| CareerCorpus (CC-BY-4.0, 302)     | https://www.sciencedirect.com/science/article/pii/S2352340926001204                             | 2026-08-07 |
| Kaggle synthetic pipeline dataset | https://www.kaggle.com/datasets/sarveshchhetri/ai-resume-screening-and-hiring-analytics-dataset | 2026-08-07 |
| Resume dataset CC BY-NC           | https://www.kaggle.com/datasets/saugataroyarghya/resume-dataset                                 | 2026-08-07 |
