# Vaeloom End-to-End Test Corpus — README

**Generated:** 2026-08-30 — **F-40 FIXED (GO)**
**Mode:** Synthetic-first, public-minimal, high-signal not maximal (§5, §24)
**Spec:** Your 36-section acquisition brief (RESEARCH → SOURCE VALIDATION → ACQUISITION → NORMALIZATION → TEST-CORPUS DESIGN) — **21/21 COVERED**

> **Goal:** Break Vaeloom if any of `ingest → parse → OCR → entity → memory (6 types) → knowledge graph → vector → hybrid retrieval → agent → organization/dedup → resume/ATS → job rank → application lifecycle → Gmail/schedule → GitHub → permissions → audit` is wrong (§35).

---

## Quick Start

```bash
# Inspect
ls test-data/PERSONAS/          # 6 fictional personas (India+US locales)
cat test-data/DATA-MANIFEST.json | head -n 100
cat test-data/SOURCES.md        # scored 0-5 ×10, weighted
cat test-data/COVERAGE-MATRIX.md # 21 capabilities, present/real/synthetic/edge/e2e

# Run validation (privacy, duplicates, broken PDFs, missing attribution, …)
python test-data/validate-corpus.py

# Use with API ingestion (PDF/DOCX/MD/image only — F-40 gap for TXT/CSV/XLSX/PPTX)
curl -X POST "http://localhost:8000/api/v1/documents?workspace_id=..." \
     -H "Authorization: Bearer $TOKEN" -H "X-CSRF-Token: $CSRF" \
     -F "file=@test-data/RESUMES/persona-a-resume-clean.pdf"

# Check expected outputs (semantic, not brittle)
cat test-data/EXPECTED/*.json
cat test-data/GRAPH/rag-*.json
```

---

## Structure (per §25, adapted to repo)

```
test-data/
├── README.md, SOURCES.md, LICENSES.md, DATA-MANIFEST.json, COVERAGE-MATRIX.md, TEST-DATA-RESEARCH-REPORT.md
├── validate-corpus.py
├── PERSONAS/{persona-a..f}/persona.json + projects.json      # 6 fictional, India+US
├── RESUMES/          # 32: per persona clean + poor + conflict + 1p/2p/academic/keyword-stuffed (PDF/DOCX/MD/TXT)
├── CERTIFICATES/     # 24: 8 certs ×3 formats (PDF/PNG OCR/DOCX) incl Acme internship (cross-source link)
├── TRANSCRIPTS/      # 18: 6 personas ×3 (PDF/DOCX/MD) + CSV + PNG OCR
├── PROJECTS/         # ~14: per project PDF+MD (+DOCX tables)
├── DOCUMENTS/        # 22: messy-filename scenario (§04) 11 names ×2 + markdown pass
├── GITHUB/           # 8: 1 real (octocat/Hello-World MIT) + 7 synthetic repos (commits/branches/issues/PRs/releases)
├── JOBS/             # 39 jobs + _all_jobs.{json,csv} (dedup + expired + remote + missing deadline)
├── ATS/              # 6 cases: high/medium/low/keyword-trap/synonym (Postgres↔PostgreSQL)/missing-skill (Docker/K8s/AWS)
├── APPLICATIONS/     # 13 lifecycle: discovered→shortlisted→tailoring→submitted→interviewing→resolved{offer/rejected/withdrawn/expired/duplicate}
├── EMAIL/            # 33: interview/offer/rejection/confirmation/reminder/recruiter/reschedule/assessment/doc-request/cert/university + spam/newsletter/irrelevant/urgent/ambiguous/phishing SAFE
├── CALENDAR/         # 7 events: interview/exam/deadline/assignment/cert expiration/conflicting (event-001↔004/006)/expired
├── MEMORY/           # 9: profile/document/career/episodic/preference/working across personas (conflict 2027 vs 2025)
├── GRAPH/            # graph-persona-a.json (10 nodes 11 edges) + 6 RAG queries (keyword/semantic/graph/temporal/combined/conflict)
├── EXPECTED/         # 4 expected outputs (entities/relationships/memory types, semantic)
├── NEGATIVE/         # 12: malformed.pdf, empty.{pdf,docx}, corrupt.png, huge-file-meta.json, sample.{pptx,xlsx} placeholders, prompt-injection.{pdf,md,txt}
└── EDGE-CASES/       # 11: dup-a/b/c, multilingual, table-heavy, ambiguous-dates, ocr-mistakes, ocr-blurry.png, extremely-short/long
```

**Single source of truth:** `test-data/` only. No copies in `apps/api/` (ingestion fixtures live here; use `@test-data/...` in tests or copy ad-hoc).

---

## Personas (6 fictional — §21)

| Persona | Archetype | Locale | Strengths | Intentional gap | Preference signal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | CS Student | Mumbai, India | Python/React/PostgreSQL/TensorFlow, GitHub, AI project (Vaeloom) | GPA edge | — |
| **B** | Backend-focused | San Francisco, US | Java/Spring/PostgreSQL/Docker/AWS/K8s, prefers backend | Rejects frontend ×5 | **Preference memory:** backend remote, no relocation |
| **C** | Data/ML Student | Bengaluru, India | Python/SQL/PyTorch/pandas/MLflow | Sparse certs | — |
| **D** | Researcher | Boston, US | Papers 3, citations 47, PyTorch | **Conflict:** resume 2027 vs transcript 2025-05-30 | — |
| **E** | Early-career Eng | Hyderabad→Remote US | Go/PostgreSQL/AWS/K8s, 3 companies promotions | Resume evolution | Staff track |
| **F** | Messy User | Austin, US | Mixed, aliases `React/React.js/ReactJS`, `PostgreSQL/Postgres` | Dup/conflicting `GPA 3.2 vs 3.6`, 11 messy filenames | Unclear — tests failure mode |

**Cross-source consistency (§22):** `Acme Backend Intern Jun-Aug 2025` appears in `persona-a RESUMES` + `CERTIFICATES/acme-internship` + `EMAIL/email-018` + `GITHUB/aarav-mehta/vaeloom-brain` + `GRAPH` + `APPLICATIONS` → exercises whether Vaeloom connects, not just parses.

---

## Key Invariants

1. **Every artifact has a manifest entry** (`DATA-MANIFEST.json` 318 rows) with `source, license, retrieval_date, real_or_synthetic, related_artifacts, expected_memory_types, agents_tested, privacy_classification`.
2. **Expected outputs are semantic** not brittle string equality (`EXPECTED/*.json` + `GRAPH/rag-*.json`).
3. **Real public = 1 file** (`GITHUB/github-001.json` octocat/Hello-World MIT, 3 commits); rest synthetic CC0 `@example.com`.
4. **F-40 FIXED 2026-08-30** — `PDF/DOCX/MD/TXT/CSV/XLSX/PPTX/JPG/JPEG/PNG/GIF/WEBP/SVG` all through `run_pipeline` (21/21 `audit_e2e_v2.py` OK); `NEGATIVE` stubs now fallback parse not unsupported.

---

## Connector / Agent / Memory Coverage

- **Connectors:** GitHub (`github_agent` ×7 tools), Gmail (30-email inbox per `gmail_agent` draft-only), Google Drive pattern via `RESUMES/CERTIFICATES` as Drive-like docs, Greenhouse/Lever/jobs_board via `JOBS[].source`
- **Agents tested:** `memory`, `organization`, `resume`, `ats`, `job_search`, `application`, `gmail`, `scheduler`, `reminder`, `github`, `research`, `recommendation` (see manifest `agents_tested`)
- **Memory 6 types:** profile/document/career/episodic/preference/working in `MEMORY/`
- **Browser tools:** `JOBS[].application_url` + `GITHUB` `verify_application_link`/`scrape_company_insights` pattern (SSRF guard `https-only + global-IP` not exercised here)

---

## Validation

```bash
python test-data/validate-corpus.py   # checks duplicates, broken PDFs, invalid JSON, missing licenses, PII leaks, impossible dates, duplicate jobs/emails
```

See `TEST-DATA-RESEARCH-REPORT.md` §18 for results, §19 remaining gaps, §20 recommended next datasets.

---

## License

- **318 artifacts total:** 317 synthetic `CC0-1.0` + 1 real public `MIT` (`octocat/Hello-World`). No private emails/leaked/breached data. See `LICENSES.md` + `SOURCES.md` per-artifact attribution.

---

## Why This Corpus Breaks Vaeloom

Per §34: every important behavior has data that can **exercise, succeed, fail, edge, conflict, recover, persist, and cross-source reason**:

```
Public/Synthetic Source
  → Raw Artifact (PDF/DOCX/MD/image/CSV/JSON)
  → Ingestion (10MB guard, dedup) → Parsing (PyMuPDF/docx/Markdown/Image) → OCR
  → Organization (rename/archive/undo + versioned)
  → Entity Extraction (aliases React/Postgres) → Memory (6 types) → Knowledge Graph (hub doc + 11 edges)
  → Vector Store (chunk 1000/200, 1536 dims, cosine) → Hybrid Retrieval (keyword/semantic/graph/temporal/combined/conflict)
  → Agent (job rank, ATS 60/40, Gmail classify, scheduler conflict) → Decision/Proposal → User Approval
  → Action → Audit/History → Memory Update → Future Retrieval
```

If any link is wrong, this corpus shows it.

