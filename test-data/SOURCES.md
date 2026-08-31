# Vaeloom Test Corpus — SOURCES

**Generated:** 2026-08-30
**Corpus root:** `test-data/`
**Strategy:** §5 P0/P1/P2 + §6 0-5 scoring (weighted). Prefer openly licensed + synthetic; minimize PII per §4.
**Validation rule:** Do not select source merely because large — 5 MB high-signal > 5 GB noise (§6).

---

## Source Evaluation Scoring (0-5 per dimension)

Dimensions (§6): `Vaeloom relevance | Realism | Data diversity | Quality | License clarity | Privacy safety | Format usefulness | Edge-case value | Integration value | Maintenance/freshness`

`source_score = mean` (Vaeloom relevance ×2 on tie-break). Reject if `source_score <3.0` or `License ≤2` or `Privacy ≤2`.

---

## Selected Sources (P0 Essential, P1 Important)

### S-01 — Synthetic Persona/Resume/Certificate/Transcript/Project Corpus (Vaeloom-generated)

- **Source name:** Vaeloom Synthetic Corpus (Faker-inspired, Jinja2 + python-docx + PyMuPDF)
- **Publisher:** Vaeloom test-data generator (`generate_corpus.py`)
- **URL:** `test-data/PERSONAS/*`, `RESUMES/*`, `CERTIFICATES/*`, `TRANSCRIPTS/*`, `PROJECTS/*`
- **Source type:** synthetic (intentionally fictional, internally consistent)
- **License:** `CC0-1.0` (`https://creativecommons.org/publicdomain/zero/1.0/`) — waived
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Retrieved:** 2026-08-30
- **Data type:** persona.json, resume.pdf/docx/md/txt, certificate.pdf/png, transcript.pdf/docx/csv/png, project.pdf/md
- **Size:** ~180 files, ~3.2 MB (PDF via PyMuPDF, DOCX via python-docx)
- **Why selected:** §2 PERSON/EDUCATION/CAREER/PROJECTS/DOCUMENTS taxonomy; exercises ingestion → chunking 1000/200 → pgvector 1536 → KG hub → hybrid retrieval → resume ATS. Cross-source consistency §22 (Acme internship appears in resume + certificate + email-018 + github-002 + graph).
- **Vaeloom feature tested:** Onboarding, file ingestion (PDF/DOCX/MD/image), organization/dedup, memory 6 types, KG aliases (`React/React.js/ReactJS`, `PostgreSQL/Postgres`, `Python/Python 3`), RAG 6 strategies, resume generation, conflict detection (resume 2027 vs transcript 2025)
- **Privacy considerations:** `synthetic-no-pii` — all `@example.com`, fake names, no real contact. No passwords/tokens. For `MEMORY.content EncryptedString` path, content is synthetic.
- **Known limitations:** Synthetic language lacks real-world noise; supplemented by real public job/repo data below.
- **Allowed usage:** Unrestricted (CC0)
- **Scores:** relevance 5, realism 4, diversity 5, quality 4, license 5, privacy 5, format 5, edge 5, integration 5, freshness 5 → **4.8 P0 SELECTED**

### S-02 — Kaggle `ravindrasinghrana/job-description-dataset` (synthetic, CC0) — *schema reference, slice-inspired*

- **Publisher:** Ravender Singh Rana (Kaggle)
- **URL:** https://www.kaggle.com/datasets/ravindrasinghrana/job-description-dataset
- **License:** `CC0: Public Domain` (Kaggle page footer “License: CC0”)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Retrieved:** 2026-08-30 (websearch verified page states “License CC0: Public Domain”, 1.74 GB, 23 cols, Usability 10.0)
- **Data type:** CSV 23 cols (`Job Id, Experience, Qualifications, Salary Range, Location, Work Type, Company Size, Job Title, Role, Job Description, Skills, Responsibilities, Company Name …`)
- **Size:** Full 1.74 GB; **used slice:** 0 — we **did NOT bulk-download** per §3. Used **schema inspiration only** to shape `test-data/JOBS/*.json` synthetic slice (42 jobs) — captures same fields (`title, company, location, remote, employment_type, experience, required_skills …` per §14).
- **Why selected:** Most Vaeloom-relevant job schema (23 cols maps to §14 JSON). CC0 allows synthetic derivation without PII. Provides realistic distributions for entry/mid/senior, full-time/part-time/contract, company sizes.
- **Vaeloom feature tested:** Job search/ranking, duplicate jobs (`apply_url` dedup), expired jobs, location/skill mismatch, ATS high/med/low/keyword-trap/synonym (Postgres↔PostgreSQL, JS↔JavaScript, ML↔Machine Learning)
- **Privacy:** CC0 synthetic — Faker-generated, no real PII (page notes “Faker library, synthetic”). `personal_data_risk = LOW`
- **Known limitations:** 3 years old (updated 3y ago), synthetic not real postings; not suitable for real-world hiring signals (page note). Treated as template, not ground truth.
- **Scores:** 5/4/5/4/5/5/4/4/5/3 → **4.4 P0 SELECTED (schema-inspired)**

### S-03 — Kaggle/HuggingFace `Qarera Most In-Demand Job Skills 2026` (CC-BY 4.0)

- **Publisher:** Qarera (https://www.qarera.com) via Zenodo DOI 10.5281/zenodo.21204423 + Kaggle/HF `yash2111/most-in-demand-skills-2026`
- **URL:** https://www.kaggle.com/datasets/alpha21/most-in-demand-job-skills-2026  & https://huggingface.co/datasets/yash2111/most-in-demand-skills-2026
- **License:** `CC BY 4.0` (page “License Attribution 4.0 International”, Zenodo citation)
- **License URL:** https://creativecommons.org/licenses/by/4.0/
- **Retrieved:** 2026-08-30 (verified page footer CC BY 4.0, files `skills-2026-overall.csv` etc., 360,336 postings Dec 2025–Jun 2026)
- **Size:** 23.7 kB, 3 CSVs (250 skills overall, 30×15 role families, 8 seniority levels)
- **Why selected:** Fresh (Dec 2025–Jun 2026), empirical skill-demand frequencies (AI 19.8%, Python 18.6%, SQL 11.7%, AWS 11.3%) — calibrates `JOBS.required_skills` realism and `ATS.extract_missing_hard_skills` gazetteer coverage. Grounds seniority buckets (Internship 24.49% AI, Principal 39.51%).
- **Feature tested:** ATS synonym/missing-skill, job ranking preference weights, career skill-gap analysis
- **Privacy:** Aggregated counts, no PII.
- **Scores:** 4/5/4/5/5/5/3/3/4/5 → **4.3 P1 SELECTED (calibration reference, not ingested raw)**

### S-04 — HuggingFace `datasetmaster/resumes` (MIT) + Innovatiana Resume Dataset (CC0)

- **Publishers:** `datasetmaster` (HF, 4,817 rows, 16.3 MB) + Innovatiana (2,485 resumes text/HTML/PDF, 26 categories)
- **URLs:** https://huggingface.co/datasets/datasetmaster/resumes , https://huggingface.co/datasets/snehaanbhawal/resume-dataset (Kaggle mirror), https://www.innovatiana.com/en/datasets/resume-dataset
- **Licenses:** HF `datasetmaster/resumes` = **MIT** (dataset card “License: MIT”), Innovatiana/Kaggle = **CC0 Public Domain** (page “Licence CC0: Public Domain”)
- **License URLs:** MIT https://opensource.org/licenses/MIT , CC0 https://creativecommons.org/publicdomain/zero/1.0/
- **Retrieved:** 2026-08-30 (verified HF card: curated by datasetmaster, 4817 rows, real+synthetic via Faker; Innovatiana page: “Licence CC0” table)
- **Size:** Not downloaded bulk; **schema reference** for resume structures: 26 professional categories, multi-format (txt/html/pdf+CSV metadata), one-/two-page, academic CV, keyword-stuffing variants inform our `RESUMES/*` clean vs poor vs ATS trap.
- **Why selected:** High-signal resume archetypes (one-page, two-page, academic, internship, poorly formatted, duplicate sections) per §12. MIT/CC0 allow synthetic derivation.
- **Feature tested:** Resume extraction/normalization, master resume generation, tailoring, ATS `audit_ats_formatting` (tables/graphics/whitespace/dates/contact heuristics)
- **Privacy:** Real resumes anonymized (HF card: “PII removed”); we use **synthetic-derived only** — no real names carried.
- **Scores:** 5/4/4/4/4/4/4/5/4/4 → **4.2 P0 SELECTED (archetype reference)**

### S-05 — GitHub `octocat/Hello-World` + synthetic persona repos (MIT / public)

- **Publisher:** GitHub (octocat) + synthetic persona repos (`aarav-mehta/vaeloom-brain`, `emily-carter/orderflow`, etc.)
- **URL:** https://github.com/octocat/Hello-World (API `https://api.github.com/repos/octocat/Hello-World` shows `"license":{"key":"mit","spdx_id":"MIT"}`)
- **License:** **MIT License** (GitHub API `license.key=mit`, page shows 3,780 stars, 3 commits, minimal `README: Hello World!`)
- **License URL:** https://github.com/licenses/mit
- **Retrieved:** 2026-08-30 (verified via websearch API excerpt)
- **Size:** 3 commits, 1 README (tiny); synthetic repos add meaningful commits/branches/issues/PRs/releases for connector depth
- **Why selected:** §18 GITHUB test data — public, permissive, no private data. Tests `Repository → Project → Skills → Career evidence` via `clients/github` + `github_agent` tools (`fetch_github_repo`, `get_github_profile`, `list_github_issues`, etc.) and graph `Project uses_skill Python`.
- **Feature tested:** GitHub connector, contribution history, multi-language, empty commits (`persona-f`), branches, issues/PRs, releases
- **Privacy:** `real_public` minimal PII; synthetic persona repos use `@example.com` collaborators only.
- **Scores:** 4/5/4/5/5/5/4/3/4/5 → **4.4 P1 SELECTED**

### S-06 — Government / Official Career Pages (USAJOBS API style, public domain — reference)

- **Publisher:** U.S. Government (USAJOBS), official company career pages (Greenhouse/Lever board tokens)
- **URLs:** https://www.usajobs.gov (public domain), `jobs_board`, `greenhouse`, `lever` client stubs in `clients/{greenhouse,lever,job_board}_client.py`
- **License:** U.S. Gov public domain (17 USC §105); Greenhouse/Lever board content is public postings (no auth)
- **Retrieved:** 2026-08-30 — **not bulk-scraped**; used to shape `JOBS[].source ∈ {greenhouse,lever,jobs_board}` and `application_url` patterns (`https://acme.example.com/careers/001` mirrors `search_greenhouse_jobs(board_token)` fan-out + dedup by `apply_url` per `job_search_agent`)
- **Feature tested:** `JobSearchAgent` fan-out, `browser_tools` `verify_application_link`, `scrape_company_insights` (SSRF-guarded `utils/url_guard.py` https-only + quota 20/h)
- **Scores:** 4/5/3/4/5/5/3/3/5/4 → **4.1 P1 SELECTED (pattern reference)**

---

## Rejected Sources (with reason)

| Source | URL | License / Risk | Reason to reject (per §24/§5) |
| :--- | :--- | :--- | :--- |
| Kaggle `benhamner/nips-papers` (full PDFs) | kaggle | ODC-BY but 2GB, research papers off-track for MVP job/resume core | **REJECT — P2, low Vaeloom relevance vs size**, better to use synthetic research papers for persona-d |
| CommonCrawl `oscar`/`c4` samples | HF | ODC-BY/CC0 but noisy, huge, high PII risk if unfiltered | **REJECT — §24: mostly irrelevant, too noisy, privacy risk** |
| Scraped LinkedIn job dump (unauthorized) | unknown | No clear license, scraped personal info | **REJECT — §4: private/scraped without permission, legal risk** |
| Leaked Gmail mbox / breach compilation | dark | Breached data | **REJECT — §4 forbidden: leaked/breached** |
| Private resume dump (real PII) | unknown | Contains real contact, sensitive | **REJECT — §4: private resumes, sensitive personal info** |
| UCI adult dataset (CSV) | UCI | CC-BY but demographics off-track | **REJECT — low integration value; CSV edge already covered by transcript CSV edge-case** |
| Kaggle `snehaanbhawal/resume-dataset` bulk PDFs 2.4k | Kaggle CC0 | CC0 OK but bulk 2.4k PDFs redundant with S-04 synthetic archetypes | **REJECT — duplicate, §5 over-collect** (keep archetype reference, not bulk) |

---

## Provenance & Retrieval Dates

- All synthetic generation: `2026-08-30` (`generate_corpus.py`, `generate_jobs_emails.py`, `generate_manifest.py`)
- Websource verification: `2026-08-30` via live `websearch` (Kaggle/HF/GitHub pages fetched, licenses checked in excerpts)
- No source claimed suitable until actual `LICENSE`/`About` checked (§29 step 1–7) — excerpts quoted above.
- `last_verified_at` = `2026-08-30` for all; time-sensitive jobs marked `published_at` + `retrieved_at` per job JSON; historical listings retained deliberately for `expired` lifecycle test (§30).

---

## Traceability

Each artifact in `DATA-MANIFEST.json` records `source, source_url, license, license_url, retrieval_date, real_or_synthetic`. Example:

```json
{
  "id": "github-github-001.json",
  "source": "github.com/octocat/Hello-World",
  "source_url": "https://github.com/octocat/Hello-World",
  "license": "MIT",
  "license_url": "https://github.com/licenses/mit",
  "real_or_synthetic": "real_public",
  "privacy_classification": "public-no-pii-minimal"
}
```

All other 294 entries: `source=synthetic`, `license=CC0-1.0`, `privacy_classification=synthetic-no-pii`, no real contact.

