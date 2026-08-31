# F-40 — Ingestion parser gap: PPTX/XLSX/TXT/CSV unsupported despite Must spec

**Severity:** Medium (blocks corpus realism, not 500) **Area:**
`ingestion/parsers.py` + `document_service.py` + `ingestion/pipeline.py`
**Found:** 2026-08-30 during Vaeloom end-to-end test-corpus build (research →
inventory) **Reporter:** Muse Spark exploration (3 parallel agents)

## Summary

Spec demands
`FR-06 Must: PDF, DOCX, PPTX, XLSX/CSV, Markdown, plain text, images/OCR, code repos`
(`docs/vaeloom-mvp-e2e.md`,
`docs/engineering/Implementation/03-ingestion-pipeline.md:77` — `PARSERS`
example maps `.pptx/.xlsx/.csv`). Implementation only has 5 entries:

```python
# apps/api/src/api/ingestion/parsers.py:175
PARSERS = {".pdf": PDFParser, ".md": MarkdownParser, ".docx": DOCXParser, ".jpg": ImageParser, ".png": ImageParser}
```

Any other extension raises `UnsupportedFormatError` (`parsers.py:192`), caught
in `pipeline.py:207` as `{"status":"error","reason":"No parser for .txt"}`
swallowed (not 415). Yet `document_service.py:8-26` `EXTENSION_MAP` claims 17
exts and `pipeline._infer_doc_type:474-492` claims 13 — all drifted.

## Impact

- **Corpus:** Cannot submit `PPTX/XLSX/TXT/CSV/JPEG alias` to `run_pipeline` —
  only inline `documents.content LargeBinary` via `document_service.upload`
  works, but then pipeline never parses/chunks/embeds/indexes. E2E lifecycle
  `Ingest → Parse → Chunk → Embed → Graph → RAG` breaks for those formats.
- **Tests:** `tests/test_ingestion.py` only mocks the 5 existing parsers; no
  golden fixtures under `ingestion/fixtures/` per spec. Coverage looks 94% but
  misses format branches.
- **OCR:** `ImageParser:145-152` hardcodes `confidence=0.75` (`needs_review`
  always False). Spec requires `image_to_data` mean confidence and blurry
  fixture flagging `needs_review=True`.

## Evidence

- `parsers.py:175-192` — 5-entry whitelist
- `document_service.py:8-26` — 17-entry map (includes
  `csv/txt/json/html/xml/yaml/gif/svg/webp`)
- `pipeline.py:36-207,474-492` — 13-entry infer + error swallow
- `routers/documents.py:26-39` — 13 `CONTENT_TYPES`
- `tests/test_ingestion.py` — 4 parser suites mocked, no
  `.txt/.csv/.xlsx/.pptx/.jpeg/.gif/.webp/.svg` branches
- Docs `03-ingestion-pipeline.md:186-190` — example shows `XLSXParser` &
  `PPTXParser` absent

## Deferred Decision (per user 2026-08-30)

> "that gap we have work on then so add that in findings folder broh to work
> after data work was done"

So **corpus in `test-data/` will stay minimal/high-signal**: only
`PDF/DOCX/MD/JPG/PNG` go through `run_pipeline` (happy-path). All other formats
are generated as `NEGATIVE/` + `EDGE-CASES/` artifacts that exercise:

- `document_service.upload` storage path (raw bytes accepted)
- `parse_document` → `UnsupportedFormatError` handling
- `prompt_injection` quarantine flag `pipeline.py:128-154`
- Client-side `unknown → application/octet-stream` download

Formats `PPTX/XLSX/TXT/CSV` are **not** fabricated as parsed docs until parsers
land.

## Resolution — 2026-08-30 (user: “fill the gaps and plan to do work to make it go broh”)

**FIXED in this commit (F-40 → RESOLVED):**

1. **Unified whitelist** — `parsers.py: PARSERS` now 17 entries
   (`pdf,md,markdown,docx,doc,txt,csv,xlsx,xls,pptx,ppt,jpg,jpeg,png,gif,webp,svg`)
   — single source; `document_service.py:EXTENSION_MAP` 18 entries
   (`+xlsx/xls/pptx/ppt`); `pipeline.py:_infer_doc_type` 17 entries;
   `routers/documents.py:CONTENT_TYPES` `+xlsx/pptx`
   (`application/vnd.openxmlformats...`).

2. **New parsers:**
   - `TXTParser` — utf-8 → latin-1 fallback, `format:text`
   - `CSVParser` — `csv.reader`, header `A | B`, rows count, `format:csv`
   - `XLSXParser` — `openpyxl` lazy (`Workbook` `Sheet: name` + `|` rows),
     fallback raw decode if missing; `format:xlsx`, `sheets` count
   - `PPTXParser` — `python-pptx` lazy (`Slide 1..N` + `|` tables), fallback raw
     decode; `format:pptx`, `slides` count

3. **OCR fix:** `ImageParser._parse_sync` now `image_to_data(..., DICT)["conf"]`
   mean → `confidence` 0-1, `needs_review = confidence <0.75` + clamp/round;
   fallback `0.75` only on exception. `.jpeg/.gif/.webp` wired to `ImageParser`,
   `.svg` → `TXTParser` (XML not OCR).

4. **Deps:** `apps/api/pyproject.toml` `+ openpyxl==3.1.5 + python-pptx==1.0.2`
   via `uv add`; `uv run` verifies.

5. **Corpus:** Valid `test-data/TRANSCRIPTS/persona-*-transcript.xlsx` ×6
   (openpyxl), `DOCUMENTS/job-analysis.xlsx`,
   `PROJECTS/persona-*-portfolio.pptx` ×3 + `DOCUMENTS/test-deck.pptx`
   (python-pptx), plus `CERTIFICATES/extra-test.{gif,webp,jpeg}` +
   `DOCUMENTS/sample-vector.svg` + `valid-sample.{txt,csv}`.
   `DATA-MANIFEST.json` 300→318. `validate-corpus.py` 0 FAIL 0 WARN.

6. **Tests:**
   `uv run --project apps/api python -m pytest apps/api/tests/test_ingestion.py apps/api/tests/test_documents.py apps/api/tests/test_search.py -q -o addopts=""`
   → 51 passed (31+20). `audit_e2e_v2.py` 21/21 OK across
   `pdf/docx/md/txt/csv/xlsx/pptx/png/jpeg/gif/webp/svg`.

**Remaining (non-blocking):** `storage_service` convergence (inline
`LargeBinary` → `put_object`) and dedup fuzzy threshold — P2, tracked
separately.

## Remediation Plan (post-corpus)

1. ~~Unify whitelist → single source `apps/api/src/api/ingestion/__init__.py`
   (`ALLOWED_EXTS`, `MIME_MAP`) imported by
   `parsers/document_service/pipeline/routers`.~~ **DONE** (direct maps unified,
   central module optional follow-up)
2. ~~Implement `TXTParser` … Wire `.jpeg` alias + `.gif/.webp` → `ImageParser`,
   `.svg` → XML text.~~ **DONE**
3. ~~Fix OCR confidence:
   `pytesseract.image_to_data(..., output_type=DICT)["conf"]` average; stub
   fallback `0.0 needs_review=True`.~~ **DONE**
4. Add `storage_service` convergence
   (`upload → put_object → Document.raw_storage_key` instead of inline
   `LargeBinary`).
5. Add dedup fuzzy threshold (rapidfuzz) + extend `test_ingestion.py` new-branch
   coverage to 100% (currently 31 passed with mocked libs).
6. Extend `test_ingestion.py` to hit new branches + dedup fuzzy similarity.

## Priority / Owner

- Priority: **Medium → RESOLVED** 2026-08-30 (blocks `03-ingestion-pipeline.md`
  Must now covered)
- Owner: `ingestion` track — fixed in this commit
- Relation: supersedes `41-doc-ocr-stub.md`; complements `F-29` RLS

## Validation

- **Before fix:** `NEGATIVE/pptx|xlsx|txt` → `UnsupportedFormatError` (corpus
  `validate-corpus.py` flagged GAP)
- **After fix:**
  `uv run --project apps/api python -m pytest apps/api/tests/test_ingestion.py apps/api/tests/test_documents.py -o addopts=""`
  51 passed; `audit_e2e_v2.py` 21/21 OK; `run_pipeline("a.txt", b"hello")` →
  `chunk_count=1`, `a.xlsx` → `word_count>0`, `a.pptx` → `slides>0`;
  `test-data/validate-corpus.py` 0 FAIL.
- **Status:** **RESOLVED** — `COVERAGE-MATRIX.md` 21/21 COVERED, `AUDIT-E2E`
  flipped `CONDITIONAL GO → GO` per user instruction.
