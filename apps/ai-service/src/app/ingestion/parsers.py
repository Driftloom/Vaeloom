import asyncio
import logging
from typing import Dict, Any, Type
from pathlib import Path

logger = logging.getLogger(__name__)

class ParsedDocument:
    def __init__(self, content: str, metadata: Dict[str, Any]):
        self.content = content
        self.metadata = metadata

class BaseParser:
    def __init__(self, timeout: int = 30):
        self.timeout = timeout

    async def parse(self, content: bytes) -> ParsedDocument:
        raise NotImplementedError

class PDFParser(BaseParser):
    async def parse(self, content: bytes) -> ParsedDocument:
        # Mock PDF parsing
        return ParsedDocument("Mock PDF Content", {"format": "pdf", "pages": 1})

class MarkdownParser(BaseParser):
    async def parse(self, content: bytes) -> ParsedDocument:
        # Mock Markdown parsing
        return ParsedDocument(content.decode('utf-8', errors='ignore'), {"format": "markdown"})

class DOCXParser(BaseParser):
    async def parse(self, content: bytes) -> ParsedDocument:
        return ParsedDocument("Mock DOCX Content", {"format": "docx"})

class ImageParser(BaseParser):
    async def parse(self, content: bytes) -> ParsedDocument:
        # Mock OCR
        confidence = 0.6  # Below 0.75 threshold
        return ParsedDocument(
            content="Mock OCR text (maybe blurry)",
            metadata={
                "format": "image",
                "ocr_confidence": confidence,
                "needs_review": confidence < 0.75
            }
        )

PARSERS: Dict[str, Type[BaseParser]] = {
    ".pdf": PDFParser,
    ".md": MarkdownParser,
    ".docx": DOCXParser,
    ".jpg": ImageParser,
    ".png": ImageParser,
}

class UnsupportedFormatError(Exception):
    pass

async def parse_document(filename: str, content: bytes) -> ParsedDocument:
    ext = Path(filename).suffix.lower()
    parser_cls = PARSERS.get(ext)
    if not parser_cls:
        raise UnsupportedFormatError(f"No parser for {ext}")
    
    parser = parser_cls(timeout=30)
    try:
        # Simulate async parsing with timeout
        return await asyncio.wait_for(parser.parse(content), timeout=parser.timeout)
    except asyncio.TimeoutError:
        logger.error(f"Parsing timed out for {filename}")
        raise
