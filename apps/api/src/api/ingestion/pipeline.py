import hashlib
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select

from api.database import async_session_factory
from api.models.schema import Document, DocumentVersion

from .chunking import TextChunk, chunk_text
from .dedup import check_dedup
from .parsers import UnsupportedFormatError, parse_document

logger = logging.getLogger(__name__)


async def run_pipeline(
    workspace_id: str,
    filename: str,
    content: bytes,
    user_id: str | None = None,
    connector_id: str | None = None,
) -> dict[str, Any]:
    """Run the ingestion pipeline.

    Source -> format detection -> parser dispatch -> structure extraction ->
    dedup -> write to DB -> publish event.

    This is the real pipeline implementation. Writes actual rows to the
    documents and document_versions tables.
    """
    try:
        # 1. Parse document (format detection + extraction)
        parsed_doc = await parse_document(filename, content)

        # 2. Compute content hash for dedup
        content_hash = hashlib.sha256(content).hexdigest()

        # 3. Check for duplicates
        existing_doc_id = await check_dedup(workspace_id, content_hash, filename)

        # 4. Write to database
        async with async_session_factory() as session:
            async with session.begin():
                if existing_doc_id:
                    # Existing document — add new version
                    document_id = uuid.UUID(existing_doc_id)
                    doc_result = await session.execute(
                        select(Document).where(Document.id == document_id)
                    )
                    existing_doc = doc_result.scalar_one_or_none()

                    if existing_doc:
                        # Get next version number
                        version_result = await session.execute(
                            select(func.max(DocumentVersion.version_number))
                            .where(DocumentVersion.document_id == document_id)
                        )
                        max_version = version_result.scalar() or 0
                        next_version = max_version + 1

                        # Create new version
                        new_version = DocumentVersion(
                            document_id=document_id,
                            version_number=next_version,
                            storage_key=f"storage/{workspace_id}/{document_id}/v{next_version}_{filename}",
                            checksum=content_hash,
                            size_bytes=len(content),
                        )
                        session.add(new_version)

                        # Update document metadata
                        existing_doc.updated_at = datetime.now(UTC)
                        if parsed_doc.metadata:
                            existing_doc.metadata_ = {**existing_doc.metadata_, **parsed_doc.metadata}

                        logger.info(f"Added version {next_version} to doc {document_id}")
                        version_id = str(new_version.id)
                    else:
                        # Document was deleted but version exists — create fresh
                        existing_doc_id = None

                if not existing_doc_id:
                    # New document
                    document_id = uuid.uuid4()
                    doc_type = _infer_doc_type(filename)

                    new_doc = Document(
                        id=document_id,
                        workspace_id=uuid.UUID(workspace_id),
                        source_connector_id=uuid.UUID(connector_id) if connector_id else None,
                        path=filename,
                        type=doc_type,
                        summary=parsed_doc.metadata.get("summary") if parsed_doc.metadata else None,
                        retention_policy="user_driven",
                        metadata_=parsed_doc.metadata or {},
                    )
                    session.add(new_doc)

                    # Create first version
                    first_version = DocumentVersion(
                        document_id=document_id,
                        version_number=1,
                        storage_key=f"storage/{workspace_id}/{document_id}/v1_{filename}",
                        checksum=content_hash,
                        size_bytes=len(content),
                    )
                    session.add(first_version)

                    logger.info(f"Created new document {document_id} with version 1")
                    version_id = str(first_version.id)

        # 5. Chunk document text for embedding/retrieval
        chunks: list[TextChunk] = []
        if parsed_doc.content:
            chunks = chunk_text(
                text=parsed_doc.content,
                source_document_id=str(document_id),
                source_version_id=version_id,
            )
            logger.info("Chunked document into %d chunks", len(chunks))

        # 6. Publish event (placeholder — real event bus at P12)
        logger.info(f"Published event: ingest.completed for {document_id}")

        return {
            "status": "success",
            "document_id": str(document_id),
            "version_id": version_id,
            "metadata": parsed_doc.metadata,
        }

    except UnsupportedFormatError as e:
        logger.error(f"Unsupported format: {e}")
        return {"status": "error", "reason": str(e)}
    except Exception as e:
        logger.error(f"Ingestion pipeline failed: {e}", exc_info=True)
        return {"status": "error", "reason": str(e)}


def _infer_doc_type(filename: str) -> str:
    """Infer document type from filename extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    type_map = {
        "pdf": "pdf",
        "docx": "docx",
        "doc": "docx",
        "md": "markdown",
        "markdown": "markdown",
        "txt": "text",
        "csv": "text",
        "json": "text",
        "png": "image",
        "jpg": "image",
        "jpeg": "image",
        "gif": "image",
        "webp": "image",
    }
    return type_map.get(ext, "unknown")
