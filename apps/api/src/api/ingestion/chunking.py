"""Document chunking for the ingestion pipeline.

Splits documents into overlapping chunks for embedding and retrieval.
Each chunk carries source document provenance for citation.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

# Defaults — tunable via settings or env
DEFAULT_CHUNK_SIZE = 1000  # characters
DEFAULT_CHUNK_OVERLAP = 200  # characters
MAX_CHUNK_SIZE = 2000
MIN_CHUNK_SIZE = 100


@dataclass
class TextChunk:
    content: str
    index: int
    start_offset: int
    end_offset: int
    source_document_id: Optional[str] = None
    source_version_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    @property
    def char_count(self) -> int:
        return len(self.content)


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
    source_document_id: Optional[str] = None,
    source_version_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> List[TextChunk]:
    """Split text into overlapping chunks with provenance.

    Uses paragraph boundaries when possible, falls back to sentence,
    then character-level splitting.
    """
    if not text or not text.strip():
        return []

    chunk_size = min(max(chunk_size, MIN_CHUNK_SIZE), MAX_CHUNK_SIZE)
    chunk_overlap = min(chunk_overlap, chunk_size // 2)

    # Try paragraph-based chunking first
    chunks = _chunk_by_paragraphs(text, chunk_size, chunk_overlap)
    if not chunks:
        # Fallback to sentence-based
        chunks = _chunk_by_sentences(text, chunk_size, chunk_overlap)
    if not chunks:
        # Final fallback: character-based
        chunks = _chunk_by_characters(text, chunk_size, chunk_overlap)

    # Assign provenance and metadata
    result = []
    for i, (content, start, end) in enumerate(chunks):
        result.append(TextChunk(
            content=content.strip(),
            index=i,
            start_offset=start,
            end_offset=end,
            source_document_id=source_document_id,
            source_version_id=source_version_id,
            metadata=metadata or {},
        ))

    logger.info(
        "Chunked document into %d chunks (avg %d chars)",
        len(result),
        sum(c.char_count for c in result) // max(len(result), 1),
    )
    return result


def _chunk_by_paragraphs(
    text: str, chunk_size: int, overlap: int
) -> List[tuple[str, int, int]]:
    """Split on paragraph boundaries, merging small paragraphs."""
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current = ""
    current_start = 0
    pos = 0

    for para in paragraphs:
        para_start = text.find(para, pos)
        if para_start == -1:
            para_start = pos
        para_end = para_start + len(para)

        if len(current) + len(para) + 2 <= chunk_size:
            if current:
                current += "\n\n" + para
            else:
                current = para
                current_start = para_start
        else:
            if current:
                chunks.append((current, current_start, pos))
            # If single paragraph exceeds chunk_size, split further
            if len(para) > chunk_size:
                sub_chunks = _chunk_by_characters(para, chunk_size, overlap)
                for sc_content, sc_start_offset, sc_end_offset in sub_chunks:
                    chunks.append((sc_content, para_start + sc_start_offset, para_start + sc_end_offset))
                current = ""
                current_start = para_end
            else:
                # Start new chunk with overlap from end of previous
                if current and overlap > 0:
                    overlap_text = current[-overlap:]
                    current = overlap_text + "\n\n" + para
                    current_start = pos - overlap
                else:
                    current = para
                    current_start = para_start
        pos = para_end

    if current:
        chunks.append((current, current_start, pos))
    return chunks


def _chunk_by_sentences(
    text: str, chunk_size: int, overlap: int
) -> List[tuple[str, int, int]]:
    """Split on sentence boundaries."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""
    current_start = 0
    pos = 0

    for sent in sentences:
        sent_start = text.find(sent, pos)
        if sent_start == -1:
            sent_start = pos
        sent_end = sent_start + len(sent)

        if len(current) + len(sent) + 1 <= chunk_size:
            if current:
                current += " " + sent
            else:
                current = sent
                current_start = sent_start
        else:
            if current:
                chunks.append((current, current_start, pos))
            if current and overlap > 0:
                overlap_text = current[-overlap:]
                current = overlap_text + " " + sent
                current_start = pos - overlap
            else:
                current = sent
                current_start = sent_start
        pos = sent_end

    if current:
        chunks.append((current, current_start, pos))
    return chunks


def _chunk_by_characters(
    text: str, chunk_size: int, overlap: int
) -> List[tuple[str, int, int]]:
    """Character-level splitting with overlap."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end]
        chunks.append((chunk, start, end))
        start = end - overlap if end < len(text) else end
    return chunks


def estimate_tokens(text: str) -> int:
    """Rough token estimate (4 chars per token for English)."""
    return len(text) // 4


def fits_context_window(
    chunks: List[TextChunk],
    max_tokens: int = 8000,
    system_prompt_tokens: int = 500,
    response_tokens: int = 1000,
) -> List[TextChunk]:
    """Filter chunks to fit within an LLM context window.

    Keeps highest-relevance chunks first, ordered by index for coherence.
    """
    available_tokens = max_tokens - system_prompt_tokens - response_tokens
    if available_tokens <= 0:
        return []

    # Sort by relevance, keep best
    by_relevance = sorted(chunks, key=lambda c: c.metadata.get("relevance_score", 0.5), reverse=True)
    selected = []
    used_tokens = 0

    for chunk in by_relevance:
        chunk_tokens = estimate_tokens(chunk.content)
        if used_tokens + chunk_tokens <= available_tokens:
            selected.append(chunk)
            used_tokens += chunk_tokens

    # Re-sort by document position for coherence
    selected.sort(key=lambda c: c.index)
    return selected
