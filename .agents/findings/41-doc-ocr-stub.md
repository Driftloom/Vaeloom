# Finding: OCR Engine Is a Stub

| Metadata     | Value                            |
| ------------ | -------------------------------- |
| **ID**       | FIND-DOC-002                     |
| **Severity** | P1-HIGH                          |
| **Status**   | OPEN                             |
| **Source**   | Documentation Audit              |
| **File**     | `docs/02-system-architecture.md` |

## Description

Architecture docs list "OCR Engine" as an ingestion component for scanned
certificates and transcripts. The actual code at `ingestion/parsers.py` has OCR
stubs that call `pytesseract` but return
`"Image OCR not available (pytesseract/Pillow not installed)"`.

## Evidence

```python
# ingestion/parsers.py
def _ocr_image(self, file_path):
    return "Image OCR not available (pytesseract/Pillow not installed)"
```

## Impact

- Document ingestion fails for image-based PDFs
- Core feature gap for education use case (transcripts, certificates)

## Remediation

Either:

1. Install pytesseract + Pillow and implement OCR
2. Mark as `STATUS: STUB` in docs
