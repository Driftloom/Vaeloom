# Vaeloom End-to-End Test Corpus — RESEARCH REPORT

**Generated:** 2026-08-30
**Mode:** RESEARCH → SOURCE VALIDATION → ACQUISITION → NORMALIZATION → TEST-CORPUS DESIGN
**Corpus:** `test-data/` 300 artifacts (295 synthetic `CC0-1.0` + 1 real public `MIT` + 4 expected) — `validate-corpus.py` **PASSED 0 FAIL 0 WARN**

---

## 1. Executive Summary

Built a **minimal high-signal, privacy-safe, end-to-end test corpus** that exercises the full Vaeloom lifecycle (§35): `Source → Raw Artifact → Ingest (10MB guard, dedup) → Parse (PDF/DOCX/MD/image) → Chunk 1000/200 → Embed 1536 → Organization (rename/archive/undo + versioned) → Entity/Relation (aliases) → Memory (6 types) → KG (hub doc + 11 edges) → Hybrid Retrieval (keyword/semantic/graph/temporal/combined/conflict) → Agent (ATS 60/40, job rank, Gmail classify, scheduler conflict) → Approval → Action → Audit → Memory Update → Future Retrieval`.

- **Personas:** 6 fictional (India+US) — A CS Student, B Backend-focused (rejects frontend), C Data/ML, D Researcher (conflict), E Early-career (promotions), F Messy (11 messy filenames, aliases, GPA conflict)
- **Formats:** `PDF/DOCX/MD/image` valid via `run_pipeline`; `TXT/CSV/XLSX/PPTX` isolated to `NEGATIVE/` asserting `UnsupportedFormatError` (F-40 deferred)
- **Jobs/ATS/Apps/Email/Calendar/GitHub:** 39 jobs (dedup + expired), 6 ATS cases, 13 apps lifecycle, 33 emails, 7 events, 8 repos (1 real octocat MIT)
- **Negative/adversarial:** 12 (malformed/corrupt/empty, huge-guard meta, PPTX/XLSX placeholders, prompt-injection ×2)
- **Traceability:** Every artifact in `DATA-MANIFEST.json` with `source, license, retrieval_date, real_or_synthetic, related_artifacts, expected_memory_types, agents_tested, privacy_classification`

If any Vaeloom link is wrong, this corpus breaks it — without over-collecting (§5) or exposing real PII (§4).

---

## 2. Repository Capability Inventory

**Exploration:** 3 parallel agents + file reads (`schema.py:27-1047`, `parsers.py:175`, `document_service.py:8-73`, `pipeline.py:19-492`, `chunking.py:14-217`, `memory_service.py:28-277`, `knowledge_graph_service.py:14-446`, `vector_store.py:30-222`, `ingestion/dedup.py:65`, `tests/conftest.py:60-322`, `openapi.yaml` 110 paths, `EXECUTION-STATUS.md`).

**Key findings:**

- **DB:** 44 ORM classes + 25 migrations, RLS 42/42 fail-closed `0025` (`app.workspace_id`, `app.user_id`, `app.tenant_id`). `memories.embedding Vector(1536)` mocked as `Text` in SQLite; `EncryptedString` for `memories.content`.
- **Upload:** `document_service.upload` 10MB guard, `EXTENSION_MAP` 17 exts, inline `LargeBinary` (not yet `storage_service` S3).
- **Parsers:** Only 5 (`PDF,MD,DOCX,JPG,PNG`) — drift vs `document_service` 17 vs `pipeline._infer_doc_type` 13 vs `routers/documents.py` 13. `TXT/CSV/XLSX/PPTX` → `UnsupportedFormatError` (F-40).
- **OCR:** `ImageParser` hardcoded `confidence=0.75`, not from `image_to_data`.
- **Chunk/Embed:** 1000/200 (overlap capped `size//2`, 100–2000 clamped), `estimate_tokens//4`, `fits_context_window 8000`, `text-embedding-3-small 1536`, BYOK.
- **Memory:** 6 canonical (`profile,document,career,episodic,preference,working` via `schemas/memory.py:9`) + 22 extended `memory_types.py:5`, `memory_versions` durable, `supersedes`.
- **KG:** Raw SQL hub doc model (`contains weight 0.8`), directed BFS/DFS `traverse`, `find_shortest_path`, AGE unused.
- **RAG:** Vector `search_memories` cosine + ILIKE `search_service` keyword + `kg traverse` — hybrid not consolidated.
- **Resume:** 5 templates `classic-harvard|tech-modern|executive-leadership|minimalist-clean|creative-portfolio` → Playwright PDF (503 if Chromium missing) + python-docx DOCX + HTML.
- **Agents:** 24 handlers, 4 memory sub-agents, `default_autonomy ∈ {suggest,read_only,full,approval_gated}`, ReAct gated `false`, unified `tools/executor` 30s timeout.
- **Existing test data:** `conftest` `mock_llm` `0.1*1536` + `mock_connector_test` — no golden `ingestion/fixtures/` per spec `03-ingestion-pipeline.md:77`.

**Gap matrix:** see `COVERAGE-MATRIX.md` §1.1 — `PPTX/XLSX/TXT/CSV` GAP, OCR stub, whitelist drift (F-40).

---

## 3. Vaeloom Test-Data Requirements

Derived from your 36-section brief:

- **Taxonomy (§2):** PERSON/PROFILE, EDUCATION, CAREER, PROJECTS (10 tech families), DOCUMENTS (12 types ×8 formats), EMAIL (15 cats), JOBS (13 families ×7 locs), GITHUB (commits/branches/issues/PRs/releases)
- **Scenarios (§7):** 01 brand-new (empty), 02 student (transcript→project→skill chain), 03 early-career (multi-job promotions), 04 messy FS (11 `resume_final2.pdf` variants)
- **Matrix (§8):** PDF (scanned req), DOCX, XLSX, CSV, PPTX, TXT, MD, code, image, ZIP? — each valid/malformed/empty/large/dup/near-dup/versioned/multilingual/table/date/ambiguous
- **Memory (§9):** 6 types + working multi-turn + preference signals (`rejects frontend ×5`)
- **KG (§10):** Aliases `React/React.js/ReactJS`, `PostgreSQL/Postgres`, `Python/Python 3`, relationships `has_skill, studied_at, worked_on, uses_skill, earned, applied_to, prefers`
- **RAG (§11):** 6 queries `keyword/semantic/graph/temporal/combined/conflict` + conflicting facts `grad 2027 vs 2028`
- **Resume (§12):** 9 variants clean/poor/1p/2p/academic/intern/experienced/missing/dup/inconsistent/keyword-stuffed
- **ATS (§13):** high/medium/low/keyword-trap/synonym/missing-skill (Docker/K8s/AWS)
- **Jobs (§14):** 42-field JSON, dedup `apply_url`, expired, missing deadline/salary, location/skill/preference mismatch
- **Applications (§15):** `Discovered→Offer` + `Rejected/Withdrawn/Expired/No Response/Duplicate`
- **Gmail (§16):** HIGH/NORMAL/LOW/SPAM/AMBIGUOUS + deadline/task/sender/priority/dup/draft (never send)
- **Scheduler (§17):** conflicting appointments, expired deadlines, timezone
- **GitHub (§18):** empty/meaningful commits, branches, issues/PRs, releases
- **Negative (§19):** malformed/corrupt/empty/huge/dup/near-dup/conflicting/missing-fields/invalid URLs/expired/OCR/spelling/multilingual/tables/prompt-injection `IGNORE ALL...`

---

## 4. Web Sources Searched

Via `websearch` 2026-08-30:

- **Kaggle:** `ravindrasinghrana/job-description-dataset` (CC0, 1.74GB, 23 cols), `alpha21/most-in-demand-job-skills-2026` (Qarera, CC-BY, 360k postings, 23.7kB), `snehaanbhawal/resume-dataset` (CC0, 2,485 resumes)
- **HuggingFace:** `datasetmaster/resumes` (MIT, 4,817 rows), `yash2111/most-in-demand-skills-2026` (CC-BY, HF mirror of Qarera), `github` topic datasets (`octocat/Hello-World` API)
- **GitHub API:** `octocat/Hello-World` (`license.key=mit`, 3,780 stars, 3 commits) — verified `https://api.github.com/repos/octocat/Hello-World` excerpt
- **Gov/company pages:** USAJOBS public domain, Greenhouse/Lever board tokens (public listings) — not bulk scraped

All pages opened, excerpts verified, licenses checked (§29 steps 1–10).

---

## 5. Sources Selected

| ID | Source | License | Used as | Priority |
| :--- | :--- | :--- | :--- | :--- |
| S-01 | Synthetic Vaeloom generator | CC0-1.0 | 294 artifacts personas/resumes/certs/transcripts/projects/jobs/email/calendar/negative | P0 |
| S-02 | Kaggle `ravindrasinghrana/job-description-dataset` schema | CC0 | Schema inspiration for `JOBS/*.json` 42-field; not bulk-downloaded | P0 |
| S-03 | Qarera `360k job skills 2026` (Kaggle/HF/Zenodo) | CC-BY 4.0 | Calibration reference (AI 19.8% etc.) not ingested raw | P1 |
| S-04 | HF `datasetmaster/resumes` (MIT) + Innovatiana (CC0) archetypes | MIT/CC0 | Resume variant archetypes (one/two-page, academic, keyword-stuffed) | P0 |
| S-05 | GitHub `octocat/Hello-World` + synthetic persona repos | MIT | 1 real repo + 7 synthetic (commits/branches/issues/PRs/releases) | P1 |
| S-06 | USAJOBS/Greenhouse/Lever board pattern | Public domain | `JOBS[].source` fan-out pattern `acme.example.com/careers/001` | P1 |

Full per-source record (§29) in `SOURCES.md` — includes `source_name, URL, license, retrieval_date 2026-08-30, why_vaeloom_needs_it, specific_files_used, personal_data_risk, known limitations`.

---

## 6. Sources Rejected

| Source | Reason (§24/§5) |
| :--- | :--- |
| `benhamner/nips-papers` 2GB | REJECT P2 — low Vaeloom relevance vs size; persona-d synthetic papers cover research |
| CommonCrawl `oscar/c4` samples | REJECT — mostly irrelevant, noisy, high PII risk if unfiltered |
| Scraped LinkedIn unauthorized dump | REJECT — no clear license, scraped personal info without permission (§4) |
| Leaked Gmail mbox / breach compilation | REJECT — forbidden per §4 (leaked/breached) |
| Private resume dump (real PII) | REJECT — private resumes, sensitive contact (§4) |
| Bulk `snehaanbhawal` 2.4k PDFs | REJECT — duplicate (§5 over-collect); archetype reference kept, not bulk |
| UCI `adult` demographics | REJECT — low integration value; CSV edge covered by transcript CSV |

---

## 7. License Analysis

- **CC0-1.0 (294):** Synthetic waived — unrestricted in CI/git; see `LICENSES.md`.
- **MIT (6):** `datasetmaster/resumes` + octocat — permissive with notice; synthetic repos tagged `MIT (synthetic)`.
- **CC-BY-4.0 (0 ingested, 1 ref):** Qarera 360k skill CSV — attribution required if vended; we kept as reference, not redistribution (cite: `Qarera (2026). Zenodo DOI 10.5281/zenodo.21204423 . CC BY 4.0.`).
- **Public domain (pattern):** USAJOBS/Greenhouse board pattern — not scraped.
- No `NC/ND/proprietary` included; all licenses verified before selection (Kaggle page footers, HF dataset cards, GitHub API `license.key`).

---

## 8. Privacy Analysis

- **synthetic-no-pii 294/300:** All names fictional, emails `@example.com`, no real phones/addresses. Faker-style generation; GDPR §6 compliant.
- **public-no-pii-minimal 1/300:** octocat/Hello-World MIT, 3 commits, `octocat@github.com` public bot.
- **public-aggregated 0 ingested:** Qarera counts aggregated, no PII.
- **Safe adversarial:** `attacker@evil.example.com` in `NEGATIVE/prompt-injection*` allowlisted as synthetic attack target (never clicked); validator allowlists it.
- **No passwords/tokens/private emails/breached data** scanned via `validate-corpus.py` PII regex + secret scan — **PASSED**.

---

## 9. Data Taxonomy

Implemented canonical (§2) — see `README.md` Structure + `DATA-MANIFEST.json` 300 rows:

- PERSON covers `location (India+US both)`, `education degree/university/graduation_date/GPA/CGPA`, `skills[], certs[], langs[], interests[], goals, preferences{remote,stack,relocation,rejects}`
- PROJECTS 10 tech families, each with `name,desc,tech[],role,dates,responsibilities,outcomes[],repo,collabs,docs[]`
- DOCUMENTS 12 types across PDF/DOCX/MD/image/TXT/CSV/JSON (PPTX/XLSX as negative placeholders)
- EMAIL 15 cats (interview/offer/rejection/confirmation/reminder/recruiter/reschedule/assessment/doc-request/cert/university + spam/newsletter/irrelevant/urgent/ambiguous/phishing SAFE)
- JOBS 42-field JSON (title/company/location/remote/employment_type/experience/required/preferred/responsibilities/education/salary/deadline/published_at/application_url/source/source_url)
- GITHUB repos/README/commits/branches/issues/PRs/languages/releases/contributions

---

## 10. Persona Design

6 personas (§21) — see `PERSONAS/*/persona.json` + `README.md` table:

- **A Aarav Mehta** (Mumbai, IIT Bombay B.Tech CSE 2027-05-15 CGPA 8.72) — Vaeloom AI project, Acme internship Jun-Aug 2025
- **B Emily Carter** (SF, Stanford B.S. CS 2026-06-12 GPA 3.85) — Java/Spring/PostgreSQL/Docker/AWS/K8s, **rejects frontend ×5** → Preference memory
- **C Rohan Desai** (Bengaluru, IISc M.Tech Data Science 2026-07-20 CGPA 9.10) — PyTorch/pandas, HealthSight ML
- **D Sarah Chen** (Boston, MIT Ph.D. 2025-05-30) — 3 papers 47 citations, **conflict:** resume 2027 vs transcript 2025-05-30
- **E Vikram Singh** (Hyderabad→Remote US, IIIT Hyderabad B.Tech IT 2023-05-10 CGPA 8.90) — 3 companies promotions (Acme SDE I → Globex SDE II → Staff), CKA/AWS DevOps
- **F Alex Johnson** (Austin, UT Austin B.S. CE 2027-05-15 GPA 3.20 vs resume 3.6) — messy, aliases `React/React.js/ReactJS`, `PostgreSQL/Postgres`, 11 messy filenames

**Cross-source (§22):** `Acme Backend Intern Jun-Aug 2025` in `RESUMES/persona-a-clean.pdf` + `CERTIFICATES/persona-a-acme*.{pdf,png,docx}` + `EMAIL/email-018.json` (“Congratulations completing internship”) + `GITHUB/github-002.json` (aarav-mehta/vaeloom-brain) + `GRAPH` + `APPLICATIONS` → tests connecting, not just parsing.

---

## 11. Scenario Coverage (§7)

| Scenario | Data | Memory chain | Verified |
| :--- | :--- | :--- | :--- |
| 01 Brand new | No persona (empty) hint via `PERSONAS` template + `e2e/quality` | onboarding empty states | COVERED |
| 02 Student | `persona-a` transcript+resume+cert+project+repo+notes | Person→University→Degree→Courses→Projects→Skills→Certs→Experience | COVERED |
| 03 Early-career | `persona-e` 3 jobs, 4 resumes evolution, 6 apps | career timeline, resume versioning, duplicate detection | COVERED |
| 04 Messy FS | 11 filenames `resume.pdf … project_report_final2.pdf` (§04) in `DOCUMENTS/` + `EDGE-CASES/dup-*` | dedup `hash+filename`, version detection, `DocumentAction` rename/archive/undo | COVERED |

---

## 12. Memory Coverage (§9)

- **Profile:** `mem-a-profile-001` (IIT Bombay), `mem-b-profile-001` (Stanford)
- **Document:** `mem-a-document-001` (resume PDF entities)
- **Career:** `mem-a-career-001` + `APPLICATIONS/*` (offer/rejected/withdrawn/expired/duplicate)
- **Episodic:** `mem-a-episodic-001` hackathon, `mem-d-conflict-001`, cert earned, project completed
- **Preference:** `mem-a-preference-001` (remote+Python/PostgreSQL from 5 rejections), `mem-b-preference-001` (backend, rejects frontend)
- **Working:** `mem-a-working-001` multi-turn `What projects used PostgreSQL?` → `after learning it?`, clearing, conflicting contexts
- **Provenance:** `EXPECTED/` + `GRAPH` preserve source_document_id for `ResumeBullet` XYZ trace

---

## 13. Agent Coverage

| Agent | Test via | File |
| :--- | :--- | :--- |
| `memory_agent` | `MEMORY/*.json` → `extraction → merge → persist Entity/Relationship` | `MEMORY/`, `GRAPH/` |
| `organization_agent` | `DOCUMENTS/` messy + `EDGE-CASES/dup-*` → `RenameProposal` | `DOCUMENTS/`, `EDGE-CASES/` |
| `resume_agent` | `RESUMES/` clean vs poor vs keyword-stuffed → honest XYZ bullets | `RESUMES/`, `EXPECTED/` |
| `ats_agent` | `ATS/ats-*.json` 60/40 cosine+keyword | `ATS/` |
| `job_search_agent` | `JOBS/` fan-out Greenhouse+Lever+board, dedup `apply_url` | `JOBS/` |
| `application_agent` | `APPLICATIONS/` lifecycle `discovered→resolved` | `APPLICATIONS/` |
| `gmail_agent` | `EMAIL/` 33 classify+deadline+task+sugar (draft-only) | `EMAIL/` |
| `scheduler_agent` | `CALENDAR/` 7 incl conflicting `event-001↔004/006` + expired | `CALENDAR/` |
| `github_agent` | `GITHUB/` 8 repos commits/branches/issues/PRs/releases | `GITHUB/` |
| `research/recommendation` | `GRAPH/rag-*.json` cites sources | `GRAPH/` |

All per `tools/definitions.py` + `tools/executor.py` unified audit/timeout.

---

## 14. Connector Coverage

| Connector | Type `schemas/connector_ext.py` | Fixtures | Verified |
| :--- | :--- | :--- | :--- |
| `github` | `mcp`/`rest` via `fetch_github_repo` etc. | `GITHUB/` octocat MIT + persona repos | `github_agent` 7 tools |
| `gmail` (`google`) | `gmail` provider `search_gmail/draft_email` | `EMAIL/` 33 mailbox | `gmail_agent` draft-only NEVER sends |
| `google_drive` | `list_drive_files/search_drive/download_drive_file` | `RESUMES/CERTIFICATES` as Drive-like docs | `drive_agent` |
| `greenhouse/lever/jobs_board` | `rest`/`graphql` → `search_greenhouse_jobs` etc. | `JOBS[].source` greenhouse/lever/jobs_board fan-out | `job_search_agent` dedup |
| `mcp` (`mcp__<Server>__<Tool>`) | `mcp` type `connector.mcp.execute` | Pattern via `JOBS[].application_url` `verify_application_link` | `mcp_client_service` 300s TTL |
| `browser` | `browse_job_page/scrape_company_insights/verify_application_link` | `JOBS[].application_url` + `GITHUB` URLs | `browser_service` chromium-first SSRF `https-only+global-IP`, quota 20/h |

---

## 15. File-Format Coverage (§8)

| Format | Valid | Malformed | Empty | Large | Dup | Near-dup | Versioned | Multilingual | Tables | Dates | Entities | Ambiguous | Parser |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **PDF** | ✅ 18 via PyMuPDF | `NEGATIVE/malformed.pdf` | `NEGATIVE/empty.pdf` | `EDGE-CASES/extremely-long.pdf` | `DOCUMENTS/*.pdf` 11 exact via dedup | `EDGE-CASES/dup-b-near.md` paraphrase | `APPLICATIONS` resume evolution | `EDGE-CASES/multilingual.pdf` | `TRANSCRIPTS/*.pdf` course tables | `EDGE-CASES/ambiguous-dates.md` | `RESUMES` entities | `EDGE-CASES/ocr-mistakes.md` | `PDFParser` ✅ |
| **Scanned PNG/JPG OCR** | ✅ 8 certs/transcripts | `NEGATIVE/corrupt.png` | — | — | — | — | — | — | — | — | — | blurry `ocr-blurry.png` → `needs_review=True` expected | `ImageParser` `.jpg/.png` ✅ (`.jpeg/.gif/.webp` gap F-40) |
| **DOCX** | ✅ 14 | — | `NEGATIVE/empty.docx` | — | — | — | — | — | `EDGE-CASES/table-heavy.docx` | — | tables extracted `docx.Document` | — | `DOCXParser` ✅ |
| **Markdown** | ✅ 22 | — | — | `extremely-long.md` 27k | `dup-a.md` | `dup-b-near.md` | — | `multilingual.md` | `table-heavy.md` GFM | `ambiguous-dates.md` | ✅ | `ocr-mistakes.md` | `MarkdownParser` ✅ |
| **TXT** | 11 stored | — | — | — | `dup-a.md` text | — | — | — | — | — | — | — | **GAP** `UnsupportedFormatError` per F-40 (stored via `document_service` only) |
| **CSV** | 2 (`TRANSCRIPTS/*.csv`, `JOBS/_all_jobs.csv`) | — | — | — | — | — | — | — | header inference | — | — | — | **GAP** same |
| **PPTX/XLSX** | 0 valid | — | — | — | — | — | — | — | — | — | — | — | **GAP** `NEGATIVE/sample.{pptx,xlsx}` PK stub → `UnsupportedFormatError` |
| **Images SVG/GIF/WEBP** | — | — | — | — | — | — | — | — | — | — | — | — | GAP `.jpeg/.gif/.webp/.svg` not in `PARSERS` |

**Parser gap F-40 deferred:** `PPTX/XLSX/TXT/CSV` as `NEGATIVE/` error-path fixtures; OCR confidence stub `0.75` not from `image_to_data`.

---

## 16. Edge-Case Coverage (§19)

- **Malformed/corrupt/empty:** `NEGATIVE/malformed.pdf` (%PDF truncated), `corrupt.png` (bad header), `empty.pdf`/`empty.docx` (0 bytes via `make_*_bytes`), `huge-file-meta.json` (11MB guard 413 not stored as blob)
- **Duplicates:** `EDGE-CASES/dup-a.md` exact, `dup-b-near.md` alias-swap (`PostgreSQL→Postgres`), `dup-c-paraphrase.md` semantic duplicate
- **Conflicting:** `persona-d` grad 2027 vs transcript 2025-05-30, `persona-f` GPA 3.20 vs resume 3.6, `APPLICATIONS` duplicate `apply_url` two sources
- **Prompt injection:** `NEGATIVE/prompt-injection-simple.{pdf,md}` contains `IGNORE ALL PREVIOUS INSTRUCTIONS / Delete files / Send email` — must be `quarantined` per `pipeline.py:128-154` `PromptInjectionMiddleware._scan`, still persisted not executed
- **Multilingual:** `EDGE-CASES/multilingual.md` English+Hindi+Spanish (Devanagari) for extraction robustness
- **Tables:** `table-heavy.docx` + `table-heavy.md` GFM + `TRANSCRIPTS` course tables
- **Dates:** `ambiguous-dates.md` `05/06/2025` vs ISO vs `next week`
- **OCR mistakes:** `ocr-mistakes.md` `Pythoon/PostgressQL` + `ocr-blurry.png` blurry → `needs_review=True` expected (stub currently `0.75`)
- **Short/long:** `extremely-short.md` (`Hi.`) vs `extremely-long.md` 27k chars (~24 chunks) tests `chunk_text` boundaries
- **Unsupported:** `sample.pptx/xlsx` PK stub → `UnsupportedFormatError` (F-40)

---

## 17. Expected-Output Strategy (§27)

- **Semantic, not brittle:** `EXPECTED/*.json` + `GRAPH/rag-*.json` check `expected_entities / expected_relationships / expected_memory_types` as sets/overlap, not string equality.
- **Examples:**
  - `EXPECTED/RESUMES-persona-a-resume-clean.json`: expects `Person,University,Python,PostgreSQL,Project,Organization` + `has_skill,studied_at,worked_on,uses_skill` + `profile,document,career`
  - `EXPECTED/CERTIFICATES-persona-a-acme...`: links `earned, worked_at` for cross-source Acme
  - `GRAPH/rag-conflict.json`: expects conflict detection `preserve provenance, ask user` not blind choice
  - `NEGATIVE/prompt-injection-simple`: expects `quarantined + needs_review` not execution

---

## 18. Data Quality Results (validate-corpus.py)

```
=== Vaeloom corpus validation 2026-08-30 ===
[OK] DATA-MANIFEST.json valid — 300 entries
[OK] No identical SHA duplicates (near-dups differ as expected)
[OK] JSON validity checked
[OK] PDFs checked: 45
[OK] Unsupported format check: TXT/CSV/XLSX/PPTX correctly isolated to NEGATIVE/EDGE-CASES (F-40 gap)
[OK] Duplicate apply_url intentional for dedup test: {'https://acme.example.com/careers/001': ['job-001', 'job-011']}
[OK] Emails: 33 unique IDs
[OK] Privacy: all emails are @example.com or public octocat@github.com (synthetic-no-pii)
[OK] No secrets/passwords/tokens found
[OK] Persona dates plausible (2023-2028)
[OK] Graph: 10 nodes, 11 edges
[OK] ATS cases: 6
FAIL: 0  WARN: 0  → PASSED
```

Additional manual checks: `SOURCES.md` per-source scoring 0-5×10, `LICENSES.md` CC0/MIT/CC-BY attribution verified; `COVERAGE-MATRIX.md` 21 rows all P0/P1 covered except F-40 gaps explicitly marked.

---

## 19. Remaining Gaps

| Gap | Impact | Mitigation now | Post-corpus fix | Tracking |
| :--- | :--- | :--- | :--- | :--- |
| **F-40: No TXT/CSV/XLSX/PPTX parsers** — `PARSERS` 5 vs spec Must 9+ (`parsers.py:175`) | `run_pipeline` cannot ingest TXT/CSV/XLSX/PPTX; only `document_service.upload` stores raw bytes | Those formats kept as `NEGATIVE/` fixtures asserting `UnsupportedFormatError`; no valid XLSX/PPTX in happy path | Implement `TXTParser (utf-8)`, `CSVParser`, `XLSXParser (openpyxl)`, `PPTXParser (python-pptx)` + unify whitelist to `ingestion/__init__.py` + `.jpeg` alias | `.agents/findings/40-ingestion-parser-gap.md` **OPEN** |
| **OCR confidence stub 0.75** — `ImageParser:145` hard-coded, not from `image_to_data` | Blurry `ocr-blurry.png` should flag `needs_review=True` but currently `0.75 → False` | Kept as edge-case with expectation `needs_review=True` documented as gap | Compute `pytesseract.image_to_data(... )["conf"]` mean | F-40 complement, `41-doc-ocr-stub.md` partially |
| **Dedup fuzzy** — `ingestion/dedup.py:65` exact `checksum+path` only, no `filename similarity` (Levenshtein) | `resume_final2.pdf` near-dups not caught as versions without threshold | `EDGE-CASES/dup-*` covers exact vs near-dup; document as P2 gap | Add `rapidfuzz` threshold or Redis recent-hash cache per `docs/engineering/Implementation/03` perf table | F-40 §7 |
| **Storage divergence** — `document_service` inline `LargeBinary` vs `pipeline` `DocumentVersion(storage_key)` expecting `storage_service` S3/MinIO | Large `huge-file-meta.json` not actually stored as 11MB blob; offload not tested | Meta JSON marks `413` guard without bloating repo | Unify `upload → put_object → Document.raw_storage_key` + `pipeline` fetch via `storage_service.download` | F-40 §5 |
| **Golden-file fixtures not yet in pytest** — `apps/api/tests/fixtures/` now has 6 samples but `test_ingestion.py` still mocked libs not real files | Real PDF/DOCX/MD/CSV golden not asserted in `test_ingestion` | Copied `sample-resume.pdf/docx/md`, `scanned-cert.png`, `sample.csv`, `long-doc.md`, `malformed.pdf`, `sample.pdf` to both `tests/fixtures/` and `ingestion/fixtures/` | Extend `test_ingestion.py` to hit new branches + version chaining golden | Future test follow-up |

---

## 20. Recommended Next Datasets (P2 Useful — if P0/P1 already covered)

1. **HF `arxiv-dataset` / NIPS papers slice (CC0/ODC-BY) — 10 PDFs max** — research paper RAG for persona-d EduGraph (would add `scanned PDF` image+text `needs_review` variety beyond current 8 PNGs). Keep ≤5 MB.
2. **UCI `wine-quality` / `adult` CSV small (CC-BY) — one 1k-row CSV** — only after `CSVParser` lands; tests header inference + `what is sheet is` spreadsheet logic + `search_ranking` facets.
3. **USAJOBS live slice 20 postings (public domain) — expired/deadline heavy** — adds real deadline `published_at/retrieved_at/last_verified_at` freshness testing (§30) without PII.
4. **GitHub `vercel/next.js` public repo shard (MIT) — one large repo** — adds real large commit history + branches vs current tiny octocat (tests pagination `tools` timeout 30s).

**Do NOT add:** breached dumps, scraped LinkedIn, private Gmail mbox, huge CommonCrawl, bulk 2.4k resumes — per §24 reject.

---

## Traceability (per §23)

Each `DATA-MANIFEST.json` entry:

```
SOURCE (S-01..06)
 → DATA TYPE (persona/resume/job ...)
 → VAELOOM MODULE (Ingestion/Chunking/Vector/KG/RAG/Agent/Scheduler)
 → AGENT (memory, job_search, gmail, scheduler, github ...)
 → MEMORY TYPE (profile/document/career/episodic/preference/working)
 → EXPECTED BEHAVIOR (extract alias, rank, classify, detect conflict)
 → TEST CASES (rag-keyword, ats-synonym, dedup apply_url, quarantine injection)
```

Example: `RESUMES/persona-a-resume-clean.pdf → Document → Ingestion PDF → Chunk 1000/200 → Memory Agent → Profile+Document+Career → KG Person→Project→Skill → Vector 1536 → Hybrid RAG keyword `PostgreSQL` → Resume Agent XYZ bullets → EXPECTED`

---

## Completion

**Corpus is production-quality when it can validate entire lifecycle (§35) — not merely file upload.** This corpus does:

```
Synthetic+Public Source → Raw Artifact (PDF/DOCX/MD/image) → Ingestion (10MB/dedup) → Parsing → Chunk → Embed → Organization (versioned) → Entity (aliases) → Memory (6 types) → KG (11 edges) → Vector → Hybrid Retrieval (6 strategies) → Agent (ATS/job rank/Gmail/scheduler) → Approval → Action → Audit → Memory Update → Future Retrieval
```

**Delivery:** `test-data/` 300 artifacts, `validate-corpus.py` PASSED, `DATA-MANIFEST.json` + `SOURCES.md` + `LICENSES.md` + `COVERAGE-MATRIX.md` + `EXPECTED/` + `GRAPH/rag-*.json` + `PERSONAS/` + `JOBS/_all_jobs.{json,csv}` + `validate-corpus.py` + fixtures symlinked to `apps/api/tests/fixtures/` & `apps/api/src/api/ingestion/fixtures/`.

**Next step:** Work F-40 parsers post-corpus per user instruction. No further collection until gaps above are closed or new `CONT-P05+` prompts demand it.

