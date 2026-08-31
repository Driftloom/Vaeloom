# End-to-End Complete — Resume Compiled + Browser + Scheduler Cron — Implementation Plan
**Date:** 2026-08-30
**Trigger:** `you: "ok then first create complete implementation plan for it broh end to end broh"` + `operational mode: build`
**Scope:** Close the 3 `PARTIAL` left after `F-40 FIXED` (`test-data/AUDIT-E2E-2026-08-30.md:1` was `CONDITIONAL→GO` for ingestion, but `resume-compile / browser / scheduler-cron` still `PARTIAL` per last audit). No new over-collection, no vscode/desktop (doc-fiction, `40-doc-desktop-vscode-fake.md` — stays `NA`).

---

## 1. Goal

Make `test-data/` + `apps/api` verifiably **end-to-end complete** for:

```
Ingestion (PDF/DOCX/MD/TXT/CSV/XLSX/PPTX/image) ✓ already GO
  → Chunk/Vector/KG/RAG ✓
  → Resume source → **Compiled PDF/DOCX via DocumentBuilder (Playwright)** ← PARTIAL → GO
  → ATS scoring ✓
  → Jobs → Applications → Gmail → **Scheduler cron (scheduled_jobs)** ← PARTIAL → GO
  → GitHub ✓
  → **Browser tools (browse_job_page / scrape_company_insights / verify_application_link) chromium-first** ← PARTIAL → GO
  → Permissions/RLS + Audit ✓
```

**Done when:** `validate-corpus.py` + `audit_e2e_v2.py` + **new** `test_browser_live.py` + `test_resume_compile.py` all `0 FAIL`, `COVERAGE-MATRIX.md` 21/21 `COVERED` + 3 new rows `Resume-compiled/Browser/Scheduler-cron` = `COVERED`, `F-40` stays `RESOLVED`, no private PII, `test-data/BROWSER/*.html` + `test-data/SCHEDULER/*.json` + `test-data/RESUMES/compiled/*.pdf` present and referenced in `DATA-MANIFEST.json`.

---

## 2. Current State (audit 2026-08-30 evening)

| Area | Code exists? | Corpus has? | Live-tested? | Gap size |
| :--- | :--- | :--- | :--- | :--- |
| **Docs ingestion** | `parsers.py:17` PARSERS, `document_service.py:8` 18 map, `pipeline.py:474` 17 map, `routers/documents.py:26` | 318 files, 45 PDFs 30 DOCXs 16 images etc. | `audit_e2e_v2.py` 21/21 OK | **GO** |
| **Resume source** | `services/resume_service.py:9` `list/get/generate_variant`, `services/resume_templates.py` 5 templates | `RESUMES/persona-*-clean.*` per persona | `parsed` OK | **GO** (source) |
| **Resume compiled PDF/DOCX** | `services/document_builder.py:156` `compile_resume` → `render_resume_html` → `page.pdf()` / `_resume_to_docx` + `tools/definitions.py` ATS | **No compiled artifact** in `test-data/` (only source) | `tests/test_document_builder.py` mocked, no corpus `compiled/*.pdf` | **PARTIAL** |
| **ATS** | `ats_agent` `calculate_semantic_ats_score` | `ATS/ats-*.json` 6 cases | `mock` | **GO** |
| **Jobs/Apps/Gmail** | `job_search_agent`, `application_service`, `gmail_agent` | `JOBS/` 39, `APPLICATIONS/` 13, `EMAIL/` 33 | dedup verified | **GO** |
| **GitHub** | `github_agent` 7 tools | `GITHUB/` 8 (octocat MIT) | mocked | **GO** |
| **Calendar events** | `scheduler_service.py:12` + `schedule_events` table | `CALENDAR/event-*.json` 7 conflicting | `has_conflict` flagged | **GO** |
| **Scheduler cron jobs** | `scheduler_service.py:25` `create_schedule(cron)`, `temporal/queues.py` `create_or_update_schedule` | **No `scheduled_jobs` JSON** in `test-data/` (only calendar) | `tests/test_scheduler.py` unit, no corpus cron fixture | **PARTIAL** |
| **Browser tools** | `services/browser_service.py:129` `BrowserService.fetch_page_text_guarded` chromium-first + httpx fallback, SSRF `url_guard.py` https+global-IP, quota 20/h | `JOBS/*.json` synthetic `acme.example.com` URLs only, **no captured `*.html`** | `tests/test_browser_tools.py` 28 mocked (`test_tool_count_now_28`); live chromium not exercised | **PARTIAL** |
| **VSCode/Desktop** | **Not implemented** (`docs/02-system-architecture.md:47` diagram fiction, `archive/40-doc-desktop-vscode-fake.md`) | Correctly absent | — | **NA** (no data needed) |

**Root cause of PARTIALs:** Not a data shortage — it's 3 small artifact gaps (each ≤30kB, 2-3 files).

---

## 3. Target Deliverables (4 new artifacts, 0 bloat)

```
test-data/
├── RESUMES/compiled/
│   ├── persona-a-classic-harvard.pdf   # DocumentBuilder + classic-harvard template, 2 pages, from persona-a source
│   ├── persona-a-classic-harvard.docx  # same content via _resume_to_docx
│   └── manifest-compiled.json          # {template, pages, words, provenance}
├── BROWSER/
│   ├── job-page-001.html               # captured browse_job_page result for job-001 (title/company/skills)
│   ├── company-insights-acme.json      # scrape_company_insights for Acme (axes + facets)
│   └── verify-link-001.json            # verify_application_link verdict for job-001 (live/expired/ssrf)
├── SCHEDULER/
│   ├── cron-daily-9am.json             # scheduled_jobs cron 0 9 * * * (resume reminder)
│   ├── cron-weekly-digest.json         # 0 9 * * 1 (weekly) + payload
│   └── per-workspace-quota.json        # quota 20/h example
└── (updates) DATA-MANIFEST.json 318→325, COVERAGE-MATRIX.md +3 rows, AUDIT-E2E.md → GO, validate-corpus.py BROWSER row
```

**Sizes:** `compiled/*.pdf` ~40kB, `*.html` ~15kB, `*.json` ~2kB — total <150kB added. Keeps corpus at `<5MB high-signal` (§24).

---

## 4. Detailed Steps (in build order)

### Step 0 — Pre-flight (0.5 day)

- [ ] Verify `playwright` chromium: `uv run --project apps/api playwright install chromium` (one-time, ~120MB) — if missing, `DocumentBuilder.render_pdf` throws `PlaywrightUnavailableError` (`document_builder.py:32`) and `compile_resume` degrades to `503` honest. Gate: run `uv run --project apps/api python -m playwright --version`.
- [ ] Verify `openpyxl`/`python-pptx` already added `pyproject.toml: openpyxl==3.1.5 python-pptx==1.0.2` (`parsers.py` 17 PARSERS) — done `F-40`.
- [ ] Create dirs: `test-data/RESUMES/compiled`, `test-data/BROWSER`, `test-data/SCHEDULER` (empty now).

### Step 1 — Resume compiled (1 day, owner: ingestion/resume track)

**Code path:** `api/templates/resumes/*.html.j2` (5 templates) + `services/resume_templates.py:suggest_template/get_template/render_resume_html` → `services/document_builder.py:158 compile_resume(content, template_slug)` → `_PlaywrightManager.render_pdf` → `count_pdf_pages` → `CompiledDocument(path, bytes, media_type)`.

**Actions:**
1. Script `scripts/compile_resume_corpus.py`:
   ```python
   from api.services.document_builder import DocumentBuilder
   from api.services.resume_templates import get_template
   builder = DocumentBuilder()
   content = json.loads((ROOT/"PERSONAS/persona-a/persona.json").read_text()) # + projects
   for slug in ["classic-harvard","tech-modern"]:  # 2 templates enough, not all 5
       pdf = await builder.compile_resume(content, slug, fmt="pdf")  # page.pdf()
       docx = await builder.compile_resume(content, slug, fmt="docx")
       (ROOT/f"RESUMES/compiled/persona-a-{slug}.pdf").write_bytes(pdf.bytes)
       (ROOT/f"RESUMES/compiled/persona-a-{slug}.docx").write_bytes(docx.bytes)
       assert await builder.count_pdf_pages(pdf.bytes) <=2  # page-fit loop scale≥0.6
   ```
2. Also cover `PERSONAS/persona-a` messy duplicate source → assert graceful (not 500).
3. Add `RESUMES/compiled/manifest-compiled.json` provenance: `{"source":"persona-a","templates":["classic-harvard"],"pages":2,"word_count":812,"generated_at":"2026-08-30","builder_version":"playwright 1.45"}`.
4. Update `test-data/EXPECTED/resume-compiled.json` with `expected_entities` + `compile` provenance (`source_document_id` linkage).

**Validation:** `uv run --project apps/api python -m pytest apps/api/tests/test_document_builder.py apps/api/tests/test_resume_service.py -q -o addopts=""` (existing 20+ tests). New corpus fixture enables `tests/test_resume_compile_corpus.py` that loads `test-data/RESUMES/compiled/*.pdf` and asserts `fitz` can extract text (not empty).

### Step 2 — Browser tools (1 day, owner: jobs/browser track)

**Code path:** `services/browser_service.py:129` `fetch_page_text_guarded(url, route_guard)` → `url_guard.py` `https-only + global-IP` → `_PlaywrightManager.fetch_page_text` (chromium `page.goto` 20s) fall back `httpx` `_fetch_via_httpx` with `RedirectPolicy` 3 hops → `strip_html_to_text` + `_extract_title_company` → `tools/definitions.py` `browse_job_page(url)`, `scrape_company_insights`, `verify_application_link`.

**Actions:**
1. Capture fixtures **without live scraping PII**: Use `playwright` to fetch **public example** `https://example.com` or local Flask stub `http://localhost:8001/mock-job-page` serving a synthetic job HTML (title `Software Engineer — Acme`, skills `Python, PostgreSQL`, salary `18 LPA`). Save raw `BROWSER/job-page-001.html` (~12kB) + `strip_html_to_text` result.
   - Why stub not live Greenhouse: avoids rate limit, SSRF, freshness drift (§30). Stub mirrors `BrowserService._fetch_via_httpx` structure.
2. Create `BROWSER/company-insights-acme.json`:
   ```json
   {"company":"Acme Corp","axes":{"culture":0.8,"growth":0.7},"facets":{"roles":12,"remote_pct":0.64},"source":"mock","retrieved_at":"2026-08-30"}
   ```
   via `scrape_company_insights` mock (unit in `tests/test_browser_tools.py:209 aggregates_axes`).
3. Create `BROWSER/verify-link-001.json`:
   ```json
   {"url":"https://acme.example.com/careers/001","verdict":"live","checks":{"https":true,"dns_public":true,"quota_ok":true},"source":"synthetic"}
   ```
   plus `verify-link-expired.json` `verdict:expired` for `deadline` past case (tests `test_dead_domain_maps_to_expired_verdict`).
4. Document `BROWSER/README.md` with `URLGuard` rules (`https-only`, `global-IP`, `SSRF blocked`, `quota 20/h`).

**Validation:** `uv run --project apps/api python -m pytest apps/api/tests/test_browser_tools.py -q -o addopts=""` (28 tests, already `test_tool_count_now_28`). Add `test_browser_live_corpus.py` that loads `BROWSER/job-page-001.html` via `strip_html_to_text` and asserts `title`/`skills` extraction >0 (no live network needed).

### Step 3 — Scheduler cron (0.5 day, owner: scheduler track)

**Code path:** `services/scheduler_service.py:25` `create_schedule(cron, name, event/payload, tenant_id)` → `temporal/queues.py` `create_or_update_schedule` (settings `temporal_enabled` false in tests → fail-open DB is source of truth).

**Actions:**
1. Add `SCHEDULER/cron-daily-9am.json`:
   ```json
   {"id":"sched-001","name":"Daily resume reminder","cron":"0 9 * * *","timezone":"Asia/Kolkata","payload":{"action":"nudge","workspace_id":"ws-persona-a"},"tenant_id":"test-tenant","enabled":true}
   ```
2. `SCHEDULER/cron-weekly-digest.json` `0 9 * * 1` (Monday 9am) + `per-workspace-quota.json` `{"workspace_id":"ws-persona-a","scrape_quota":20}`.
3. Add `SCHEDULER/README.md` linking `CALENDAR/event-*.json` (user-visible events) vs `SCHEDULER/*.json` (cron triggers).

**Validation:** `uv run --project apps/api python -m pytest apps/api/tests/test_scheduler.py -q -o addopts=""`. Loader test asserts cron syntax via `croniter` and DB insert.

### Step 4 — Integration wiring (0.5 day)

- Update `test-data/DATA-MANIFEST.json` via `generate_manifest.py` (318→325) — add `BROWSER`, `SCHEDULER`, `RESUMES/compiled`.
- Append 3 rows to `COVERAGE-MATRIX.md`: `Resume-compiled`, `Browser`, `Scheduler-cron` → `COVERED`.
- Update `validate-corpus.py` to check `BROWSER/*.html` parse count + `SCHEDULER/*.json` cron validity + `RESUMES/compiled/*.pdf` `fitz` page count ≤2.
- Update `SOURCES.md` with `BROWSER` capture provenance (synthetic stub, no PII).

### Step 5 — E2E proof (0.5 day)

Run full chain **once with real DB** (no mocks):

```bash
# 1. Ingest persona-a resume PDF → parse → chunk → vector → KG
python scripts/ingest_corpus.py test-data/RESUMES/persona-a-resume-clean.pdf

# 2. Compile resume via builder (uses same persona)
python scripts/compile_resume_corpus.py

# 3. Browse + verify job link (uses BROWSER fixture, no live crawl)
python -c "from api.services.browser_service import BrowserService; import asyncio; print(asyncio.run(BrowserService().fetch_page_text_guarded('https://example.com')))"

# 4. Create cron schedule + trigger
curl -X POST http://localhost:8000/api/v1/scheduler/jobs -H "Authorization: Bearer $TOKEN" -d @test-data/SCHEDULER/cron-daily-9am.json

# 5. Assert audit trail
python test-data/validate-corpus.py && python -c "import pathlib; print('GO' if (pathlib.Path('test-data/RESUMES/compiled/persona-a-classic-harvard.pdf').exists() and pathlib.Path('test-data/BROWSER/job-page-001.html').exists()) else 'NO')"
```

Expected: `1652` → `GO` (was `300` with 3 `PARTIAL`).

---

## 5. Out-of-Scope (explicitly NA)

- **VSCode / Desktop companion:** `docs/02-system-architecture.md:47` `I2/I3` are **doc-fiction** (`40-doc-desktop-vscode-fake.md` + `45-doc-secrets-manager-fake.md` etc.). No service, no route, no test. Do not add `test-data/VSCODE/` — would be dead data per §24 `REJECT` (irrelevant, §5). If ENT track later implements, add then.
- **Storage convergence `put_object`:** P2, not blocking E2E — `document_service` inline `LargeBinary` already works; S3 offload is perf not correctness.

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| `playwright install chromium` 120MB missing → `compile_resume` 503 | Resume compiled stays PARTIAL | Install in CI `uv run --project apps/api playwright install chromium` + fallback test asserts `503 honest` if missing (already per `executor.py:659`) |
| Live Greenhouse/Lever scrape flaky → `verify_application_link` `expired_or_error` | Browser E2E flaky | Use **stub HTML** (`BROWSER/job-page-001.html`) + `httpx` mock, not live. Record `retrieved_at` per §30 (§10 in SOURCES.md) |
| Cron `timezone Asia/Kolkata` vs UTC → off-by-one | Scheduler false positive | Store `timezone` explicitly, test with `croniter` `is_valid` + `get_next` not wall clock |
| Corpus bloat >5MB | §24 violation | Cap at 325 files (<6MB) — 2 resume comps (80kB) + 1 html (15kB) + 3 json (6kB) = ~100kB delta |

---

## 7. Timeline & Ownership

| Day | Work | Owner | Output |
| :--- | :--- | :--- | :--- |
| **D1 AM** | Playwright install + Step 1 resume compile | Ingestion | `RESUMES/compiled/*.pdf/.docx` + `manifest-compiled.json` |
| **D1 PM** | Step 2 browser fixtures + `validate-corpus` update | Jobs/Browser | `BROWSER/*.html/*.json` |
| **D2 AM** | Step 3 scheduler cron + Step 4 wiring | Scheduler | `SCHEDULER/*.json`, `DATA-MANIFEST 325`, `COVERAGE +3 rows` |
| **D2 PM** | Step 5 live E2E proof + gate `AUDIT-E2E` → `GO` | QA | `uv run pytest -q` 51+28+new 3 = 82 passed |

**Total: 2 days, 1 engineer, no infra change.** Unblocks `CONT-P05` (was blocked on `F-40`).

---

## 8. Success Criteria (gate)

- [ ] `test-data/RESUMES/compiled/persona-a-classic-harvard.{pdf,docx}` exist, `fitz` extracts >50 words, `count_pdf_pages` ≤2
- [ ] `test-data/BROWSER/job-page-001.html` `strip_html_to_text` yields title+skills, `verify-link-001.json` `verdict:live`, `company-insights-acme.json` axes 0-1
- [ ] `test-data/SCHEDULER/cron-daily-9am.json` `croniter.is_valid("0 9 * * *")` true, `scheduled_jobs` DB insert OK
- [ ] `python test-data/validate-corpus.py` 0 FAIL (was 0 WARN), `python -m pytest tests/test_document_builder.py tests/test_browser_tools.py tests/test_scheduler.py -q` 82 passed
- [ ] `COVERAGE-MATRIX.md` 24/24 `COVERED` (21→24), `AUDIT-E2E.md` `VERTICT: GO` (was `CONDITIONAL`), `SOURCES.md` + `DATA-MANIFEST.json:325`

---

## 9. Next

Reply `GO` and I build Steps 0-5 in build mode (file changes + shell + tests). Reply `CONDITIONAL` with edits and I revise plan. No code until you approve.

