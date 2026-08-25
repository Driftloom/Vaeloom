# ADR-034: Resume Document Pipeline — Templates, Playwright Compilation, Semantic ATS

Date: 2026-08-23 Status: Accepted

## Context

Vaeloom's resume system stored unstructured JSON (`resumes.content`) with no
rendering path: nothing in the stack generated PDFs or DOCX files, there was no
template concept, and ATS scoring was keyword-level only. The blueprint for
career tooling requires industry-standard templates, pixel-perfect document
compilation (PDF/DOCX/HTML), matching cover letters, interview cheat-sheets,
portfolio markdown export, and semantic resume-to-JD scoring.

## Decision

### 1. Rendering engine: Playwright Chromium (not WeasyPrint/ReportLab)

One dependency powers **both** the browser/scraping tools (Phase 2) and HTML→PDF
via `page.pdf()`:

- Pixel-perfect CSS (flexbox, print `@page` rules) vs ReportLab's manual canvas.
- No GTK/Pango native dependency on Windows dev machines (WeasyPrint's pain
  point).
- Chromium is a large (~300MB) install; the API degrades gracefully:
  `PlaywrightUnavailableError` → HTTP 503 with a `playwright install chromium`
  hint. Tests mock compilation; CI does not need browsers.

The `_PlaywrightManager` singleton lazily launches one headless browser, reuses
it across compiles under an asyncio lock, and flags permanent unavailability.

### 2. Page-fit guarantee

`compile_resume` renders, counts pages with PyMuPDF, and shrinks base typography
~10% per pass until the document fits `max_pages` (default 2, max 3). Bounded at
scale ≥ 0.6 to preserve legibility.

### 3. Template registry as data + self-contained Jinja2 HTML

Five industry templates (`classic-harvard`, `tech-modern`,
`executive-leadership`, `minimalist-clean`, `creative-portfolio`) live in
`services/resume_templates.py` (metadata: category, best_for, ats_compatibility)
with inline-CSS Jinja2 documents under `api/templates/resumes/`. A normalizer
coerces free-form `resumes.content` and ResumeAgent section output into one
rendering contract, so any historical resume row renders without migration.
`suggest_template()` gives agents an industry→template heuristic (leadership >
creative > tech > finance > minimalist).

Jinja2 autoescape is on; user content cannot inject markup into compiled PDFs.

### 4. Artifacts stored inline in Postgres

`resume_artifacts` (migration 0023) stores compiled bytes inline with workspace
RLS. Resume documents are small (<2MB); inline storage keeps downloads working
without object storage in dev/test. `storage_key` is reserved for S3 offload if
artifacts grow.

### 5. Semantic ATS = embeddings cosine + deterministic keyword fallback

`calculate_semantic_ats_score` blends embedding cosine similarity (60%) with JD
keyword coverage (40%) when an LLM key exists; otherwise it degrades to a
pure-keyword score (gazetteer of ~120 hard skills + frequency tokens). All three
new tools (`calculate_semantic_ats_score`, `extract_missing_hard_skills`,
`audit_ats_formatting`) follow the executor's mock-fallback pattern so the suite
stays green offline. Formatting audit is pure heuristics (tables, graphics,
whitespace alignment, section headers, date formats, contact line).

### 6. Tailoring never fabricates

`ResumeAgent.tailor_content` rewrites existing experience bullets only,
prompt-constrained against inventing metrics/tools, falling back to original
bullets when the LLM is unavailable. The tailored variant is a new row linked
via `generated_from_snapshot`.

## Consequences

- New deps: `jinja2`, `playwright` (apps/api).
- Compile endpoints are rate-limited (6/min compile+cover-letter, 4/min
  cheatsheet) because chromium renders are expensive.
- Frontend consumes camelCase-transformed responses; `ResumeBuilder` field
  accesses were corrected to match the actual runtime shape (latent bug fixed).
- Phase 2 (browser tools) and Phase 3 (native Python MCP client) build on the
  same Playwright manager and connector patterns established here.

## Test evidence

- 47 unit tests (templates, builder incl. mocked fit-loop, helpers)
- 13 integration tests (routes: templates/tailor/compile/cover-letter/
  cheatsheet/artifacts/download + authz isolation)
- 16 executor-tool tests (semantic score modes, gazetteer extraction, formatting
  audit, registry wiring)
- Real-chromium verification: page-fit loop shrinks an 8-entry resume from 3+
  pages to ≤2.
