import pytest
import asyncio
from app.ingestion.pipeline import run_pipeline
from app.ingestion.parsers import parse_document, UnsupportedFormatError

@pytest.mark.asyncio
async def test_parse_unsupported_format():
    with pytest.raises(UnsupportedFormatError):
        await parse_document("test.xyz", b"")

@pytest.mark.asyncio
async def test_parse_pdf():
    doc = await parse_document("test.pdf", b"pdf data")
    assert doc.metadata["format"] == "pdf"

@pytest.mark.asyncio
async def test_pipeline_new_document():
    result = await run_pipeline("ws1", "new_file.pdf", b"new content")
    assert result["status"] == "success"
    assert result["version_id"] == "version_1"

@pytest.mark.asyncio
async def test_pipeline_duplicate_document():
    result = await run_pipeline("ws1", "duplicate_file.pdf", b"duplicate content")
    assert result["status"] == "success"
    assert result["version_id"] == "version_2"
    assert result["document_id"] == "existing_doc_id_123"
