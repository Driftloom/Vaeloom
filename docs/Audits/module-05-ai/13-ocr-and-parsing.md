# Module 05: Document Parsing & Optical Character Recognition (OCR)
**Audit Identifier**: `AUD-M05-AI-13`
**Scope**: Multi-format text extraction (PDF, DOCX, TXT, MD, HTML), Tesseract OCR fallback, and bounding box retention.

---

## 1. Parser Architecture

Implemented in `api/ingestion/parsers.py`:
- **PDF Parser (`PyMuPDF / fitz`)**: Fast vector extraction from digital PDFs; preserves text flow, page numbers, and document structure.
- **OCR Engine (`pytesseract / Tesseract`)**: Invoked when extracted PDF text density falls below 20 characters per page (scanned documents or images).
- **Word Parser (`python-docx`)**: Extracts headings, paragraphs, and tables from `.docx` files.
- **Markdown / Plain Text**: Standard UTF-8 decoding with surrogate-pass encoding fallbacks.

---

## 2. Resource & Memory Bounds

- OCR execution runs inside worker processes or bounded thread pools.
- Image resolution is clamped to maximum 300 DPI to avoid memory exhaustion during large batch processing.

---

## 3. Verification Evidence

- `test_module05_rag.py`:
  - `test_multi_format_parsing_and_ocr`: Confirms parser correctly processes text bytes, assigns appropriate mime types, and handles plain text without corruption.
