# 03 — Ingestion Pipeline (MVP)

> **Purpose:** Build a queue-driven ingestion pipeline that turns uploaded or synced files into parsed, structured document records ready for memory extraction.
> **Status:** âœ… Upgraded to enterprise quality
> **Owner:** Engineering Team
> **Last Updated:** 2026-07-13

## Overview

The Ingestion Pipeline is the entry point for all external data into the Vaeloom knowledge system. It accepts files from user uploads and connector syncs, processes them through a Redis + BullMQ job queue, and produces parsed `documents` rows without blocking the interactive application. The pipeline supports six parser modules (PDF, DOCX, PPTX, XLSX/CSV, Markdown, Code Repos), OCR with confidence scoring for images and scans, and content-based deduplication with version chaining.

Each file traverses a sequence of stages: source → format detection → parser dispatch → OCR (if needed) → structure extraction → dedup/version check → document row written → `ingest.completed` event published. Parsing runs in a separate worker process from the API request handler, ensuring that large files or batch uploads don't impact interactive response times. All parsers include timeout handling, sandboxed execution, and structured output format versioning.

The pipeline stops at "parsed and stored" — entity extraction, embedding generation, and knowledge graph writes are the responsibility of the Memory Agent (Phase 04). This clean boundary keeps each phase focused and independently testable.

## Goals

1. Implement a non-blocking, queue-driven ingestion pipeline using Redis and BullMQ
2. Build six parser modules that extract structure and content from common document formats
3. Implement OCR with configurable confidence thresholds for scanned images
4. Provide content-based deduplication that creates version chains rather than duplicate records
5. Create test fixtures and golden-file tests for every supported format

```mermaid
graph TD
    classDef primary fill:#e3f2fd,stroke:#1565c0,color:#000
    classDef secondary fill:#e8f5e9,stroke:#2e7d32,color:#000

    SOURCE["File Upload / Connector Sync"]:::primary
    QUEUE["Redis + BullMQ Queue"]:::secondary
    DETECT["Format Detection"]:::secondary
    PARSE["Parser Dispatch"]:::primary
    OCR["OCR (images/scans)"]:::secondary
    STRUCT["Structure Extraction"]:::secondary
    DEDUP["Dedup & Version Check"]:::primary
    WRITE["documents row written"]:::secondary
    EVENT["ingest.completed event published"]:::primary

    SOURCE --> QUEUE
    QUEUE --> DETECT
    DETECT --> PARSE
    PARSE --> OCR
    OCR --> STRUCT
    STRUCT --> DEDUP
    DEDUP --> WRITE
    WRITE --> EVENT

    subgraph Parsers["Parser Modules"]
        P1["PDF Parser"]
        P2["DOCX Parser"]
        P3["PPTX Parser"]
        P4["XLSX/CSV Parser"]
        P5["Markdown Parser"]
        P6["Code Repo Parser"]
    end

    PARSE --> P1
    PARSE --> P2
    PARSE --> P3
    PARSE --> P4
    PARSE --> P5
    PARSE --> P6
```text

## Context

Read `02-database-schema.md` first. This phase turns an uploaded or synced file into a parsed, structured record ready for the Memory Agent (file 04) to extract from. It does not do entity extraction itself — it stops at "parsed and stored," file 04 picks up from there.

## Objective

Build a queue-driven ingestion pipeline: a file goes in (upload or connector sync), a parsed `documents` row comes out, without blocking the interactive app.

## Requirements

**Queue:** Redis + BullMQ. File uploads and connector syncs enqueue an `ingest` job; a worker process (separate from the API's request-handling process) consumes it.

**Parsers (one module per type, in `apps/ai-service/ingestion/parsers/`):**

- PDF, DOCX, PPTX, XLSX/CSV, Markdown, plain text — extract both structure (headings, tables) and text content.
- Images/scans — OCR with a confidence score attached to the extraction; anything below a defined threshold (e.g. 0.75) is stored but flagged `needs_review: true` in the document's metadata rather than trusted silently.
- Code repositories (from the GitHub connector, file 07) — extract structure (languages, dependency graph, README, commit history shape) into a semantic summary; do not store full source verbatim in `documents.summary`.
- Spreadsheets — infer what the sheet *is* (grade tracker, budget, project plan) from headers/structure before summarizing, don't just dump cell contents.

**Dedup & versioning:** before creating a new `documents` row, check for an existing document at a similar path/content (content-hash + filename similarity). If found, create a `document_versions` row linking to the prior version instead of a wholly new document.

**Pipeline stages** (implement as a sequence, each stage's output feeding the next):

```text
Source → format detection → parser dispatch → OCR (if needed) → structure extraction
   → dedup/version check → documents row written → ingest.completed event published
```text

**Test fixtures:** create `apps/ai-service/ingestion/fixtures/` with at least one real sample of each supported type (a sample resume PDF, a scanned certificate image, a small code repo, a spreadsheet) and golden-output JSON for each, used in the test suite below.

## Out of scope

Entity/relationship extraction, embeddings, knowledge graph writes (all file 04). Organization Agent naming/foldering proposals (file 08). Any UI for uploading (file 14).

## Acceptance criteria

- [ ] Each parser has a golden-file test against its fixture, asserting correct structure extraction.
- [ ] A large batch upload does not block a concurrent, unrelated API request (verified with a load test enqueuing 50 jobs while hitting `/health`).
- [ ] OCR confidence scoring works — a deliberately blurry test image is flagged `needs_review: true`.
- [ ] Uploading a near-duplicate of an already-ingested file creates a `document_versions` row, not a duplicate `documents` row.
- [ ] `ingest.completed` events are published and observable (even if nothing subscribes yet — file 04 is the first real subscriber).

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Blocking the API request thread during document parsing | UI freezes for all users while a single large file processes |
| Not setting parser timeouts | A malformed PDF or infinite-scan image hangs the worker indefinitely |
| Ignoring OCR confidence threshold | Garbage text from a blurry scan silently populates the knowledge graph |

## Best Practices

| Practice | Why |
|----------|-----|
| Always queue ingestion jobs, never process inline | Keeps API response times predictable regardless of file size |
| Store golden fixtures and expected outputs alongside parsers | Makes regression detection automatic when parser logic changes |
| Version parser output format in document metadata | Allows smooth migration when parser improvements change output shape |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Maliciously crafted PDFs could exploit parser libraries | Run parsers in a sandboxed subprocess with restricted filesystem access |
| Uploaded files may contain hidden macros or scripts | Scan for executable content in Office documents; strip macros before parsing |
| Queue job payloads could leak content | Never include full document body in job payloads — reference by storage key instead |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Large OCR jobs consume CPU for extended periods | Limit concurrent OCR workers to 1–2 per instance; scale horizontally |
| Dedup content-hash comparison on every upload is expensive | Cache recent hashes in Redis; batch-compute only for new (uncached) documents |
| BullMQ job backlog can grow during connector bulk sync | Implement priority queuing: user uploads > scheduled syncs |

## Scope

### In Scope

- Redis + BullMQ queue-driven ingestion pipeline with separate worker process
- Six parser modules: PDF, DOCX, PPTX, XLSX/CSV, Markdown, Code Repos
- OCR with configurable confidence thresholds for images and scanned documents
- Content-based deduplication with version chaining via document_versions
- Pipeline stages: source → format detection → parser dispatch → OCR → structure extraction → dedup/version check → documents row → ingest.completed event
- Test fixtures and golden-file tests for every supported format
- Parser timeout handling and sandboxed execution

### Out of Scope

- Entity/relationship extraction, embeddings, or knowledge graph writes (Phase 04)
- Organization Agent naming or foldering proposals (Phase 08)
- Upload UI (Phase 14)
- Streaming parsing for very large files (planned Q2 2027)
- Malformed-file fuzz testing (planned Q4 2026)

---

## Examples

```python
# Enqueue an ingestion job from the API layer
from bullmq import Queue

ingestion_queue = Queue("ingestion", {"connection": redis_connection})

async def upload_document(workspace_id: str, file: UploadedFile) -> dict:
    storage_key = await object_store.put(file)
    job = await ingestion_queue.add("ingest", {
        "workspace_id": workspace_id,
        "storage_key": storage_key,
        "original_filename": file.filename,
        "content_type": file.content_type,
    })
    return {"job_id": job.id, "status": "queued"}
```text

```python
# Parser dispatch with format detection
from pathlib import Path

PARSERS = {
    ".pdf": PDFParser,
    ".docx": DOCXParser,
    ".pptx": PPTXParser,
    ".xlsx": XLSXParser,
    ".csv": XLSXParser,
    ".md": MarkdownParser,
}

async def parse_document(storage_key: str, filename: str) -> ParsedDocument:
    ext = Path(filename).suffix.lower()
    parser_cls = PARSERS.get(ext)
    if not parser_cls:
        raise UnsupportedFormatError(f"No parser for {ext}")
    content = await object_store.get(storage_key)
    parser = parser_cls(timeout=30)
    return await parser.parse(content)
```text

```python
# OCR with confidence thresholding
async def process_image(storage_key: str) -> ParsedDocument:
    image = await object_store.get(storage_key)
    result = await ocr_engine.extract(image)
    needs_review = result.confidence < 0.75
    return ParsedDocument(
        content=result.text,
        metadata={
            "ocr_confidence": result.confidence,
            "needs_review": needs_review,
        }
    )
```text

---

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Streaming parsing for very large files (>100MB) | Medium | High | Q2 2027 |
| Additional parser modules (audio, video, archive formats) | Low | Medium | Q2 2027 |
| Parser performance benchmarking and optimization suite | Medium | Low | Q1 2027 |
| Malformed-file fuzz testing for parser security hardening | High | Medium | Q4 2026 |
| Dead-letter queue with manual retry UI for failed ingestions | Medium | Medium | Q1 2027 |

## Related Documents

- [02 — Database Schema](02-database-schema.md) — Documents and document_versions table definitions
- [04 — Memory System](04-memory-system.md) — Next phase: entity extraction from parsed documents
- [07 — MCP Tool Ecosystem](07-mcp-tool-ecosystem.md) — Connector syncs that feed the ingestion pipeline
- [14 — Frontend Workspace](14-frontend-workspace.md) — Upload UI and file browser
