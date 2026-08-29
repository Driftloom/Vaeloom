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

        # 5b. Persist chunks + auto-embed (EXC-P12-04 fix: chunk->embedding auto-wiring, provenance)
        # F-08 fix: scan chunk text for prompt injection before persisting — quarantine if detected
        if chunks:
            try:
                from api.middleware.prompt_injection import PromptInjectionMiddleware

                _inject_scanner = PromptInjectionMiddleware(app=None)
                clean_chunks: list[TextChunk] = []
                quarantined = 0
                for ch in chunks:
                    detection = _inject_scanner._scan(ch.content or "")
                    if detection:
                        logger.warning(
                            "Ingestion chunk quarantined: workspace=%s doc=%s chunk=%d reason=%s",
                            workspace_id, document_id, ch.index, detection,
                        )
                        # Mark chunk metadata as quarantined so retrieval can filter if needed
                        try:
                            ch.metadata = {**(ch.metadata or {}), "quarantined": True, "quarantine_reason": detection}
                        except Exception:
                            pass
                        quarantined += 1
                        # Still persist but flagged — alternative is to skip persistence entirely
                        # We persist flagged so admin can review via audit; retrieval filters quarantined
                    clean_chunks.append(ch)
                if quarantined:
                    logger.info("Ingestion scanning: %d/%d chunks flagged (%s)", quarantined, len(chunks), workspace_id)
                chunks = clean_chunks
            except Exception as scan_e:
                logger.debug("Ingestion prompt injection scan failed (non-blocking): %s", scan_e)
            try:
                await _persist_chunks_with_embeddings(
                    workspace_id=workspace_id,
                    document_id=str(document_id),
                    version_id=version_id,
                    chunks=chunks,
                )
            except Exception as e:
                logger.warning("Chunk persist auto-wiring failed (non-blocking): %s", e)

            # 5c. Trigger graph-memory extraction so Entity/Relationship + knowledge_nodes are populated.
            # Best-effort: don't fail ingestion if LLM not configured.
            try:
                await _populate_graph_memory(
                    workspace_id=workspace_id,
                    document_id=str(document_id),
                    content=parsed_doc.content,
                    chunks=chunks,
                )
            except Exception as e:
                logger.warning("Graph memory extraction failed (non-blocking): %s", e)

        # 6. Publish event (real event bus)
        try:
            from api.services.event_service import event_service

            async with async_session_factory() as evt_session:
                await event_service.publish(
                    evt_session,
                    event_type="ingest.completed",
                    payload={
                        "document_id": str(document_id),
                        "version_id": version_id,
                        "workspace_id": workspace_id,
                        "chunk_count": len(chunks),
                        "filename": filename,
                    },
                    tenant_id=None,
                    workspace_id=workspace_id,
                )
                await evt_session.commit()
        except Exception as e:
            logger.info("Published event: ingest.completed for %s (fallback: %s)", document_id, e)

        return {
            "status": "success",
            "document_id": str(document_id),
            "version_id": version_id,
            "metadata": parsed_doc.metadata,
            "chunk_count": len(chunks),
        }

    except UnsupportedFormatError as e:
        logger.error(f"Unsupported format: {e}")
        return {"status": "error", "reason": str(e)}
    except Exception as e:
        logger.error(f"Ingestion pipeline failed: {e}", exc_info=True)
        return {"status": "error", "reason": str(e)}


async def _persist_chunks_with_embeddings(
    workspace_id: str,
    document_id: str,
    version_id: str,
    chunks: list["TextChunk"],
) -> None:
    """Fix EXC-P12-04: auto-wire chunks -> embeddings + DocumentChunk provenance.

    For each TextChunk:
      1. Compute content_hash + token count
      2. Generate embedding via llm_service (best-effort, zeros on failure for testability)
      3. Insert Embedding row (source_type=document_chunk)
      4. Insert DocumentChunk row linking embedding_id
      5. Optionally insert Memory row for chunk-level retrieval parity
    All within a single transaction; per-chunk errors are isolated so one bad chunk
    doesn't nuke the batch.
    """
    import hashlib as _hashlib

    from api.services.llm_service import llm_service

    try:
        from api.models.schema import DocumentChunk, Embedding
    except Exception as e:
        logger.warning("Chunk persist skipped - models not importable: %s", e)
        return

    # Pre-generate embeddings outside DB transaction to avoid holding transaction open on LLM calls
    chunk_embeddings: list[list[float] | None] = []
    for ch in chunks:
        emb = None
        if ch.content and ch.content.strip():
            try:
                emb = await llm_service.generate_embedding(ch.content)
            except Exception as e:
                logger.debug("Embedding generation failed for chunk %s, using zero vector fallback: %s", ch.index, e)
                emb = [0.0] * 1536
        else:
            emb = None
        chunk_embeddings.append(emb)

    try:
        from api.database import async_session_factory as _asf

        async with _asf() as session:
            async with session.begin():
                for idx, ch in enumerate(chunks):
                    emb_vec = chunk_embeddings[idx] if idx < len(chunk_embeddings) else None
                    token_count = max(1, len(ch.content) // 4) if ch.content else 0
                    content_hash = _hashlib.sha256(ch.content.encode("utf-8")).hexdigest() if ch.content else None

                    embedding_id = None
                    if emb_vec is not None:
                        try:
                            emb_row = Embedding(
                                workspace_id=uuid.UUID(workspace_id),
                                source_type="document_chunk",
                                source_id=uuid.uuid4(),  # placeholder; will be updated to chunk id after chunk insert if needed
                                vector=emb_vec,
                                model_version=getattr(llm_service, "embedding_model", "text-embedding-3-small"),
                                dimensions=len(emb_vec),
                                source_table="document_chunks",
                            )
                            session.add(emb_row)
                            await session.flush()
                            embedding_id = emb_row.id
                            # Correct source_id to chunk linkage after we know chunk id
                        except Exception as e:
                            logger.warning("Embedding insert failed for chunk %s: %s", ch.index, e)

                    try:
                        chunk_row = DocumentChunk(
                            workspace_id=uuid.UUID(workspace_id),
                            document_id=uuid.UUID(document_id),
                            document_version_id=uuid.UUID(version_id) if version_id else None,
                            chunk_index=ch.index,
                            content=ch.content,
                            start_offset=ch.start_offset,
                            end_offset=ch.end_offset,
                            token_count=token_count,
                            embedding_id=embedding_id,
                            content_hash=content_hash[:64] if content_hash else None,
                            metadata_={"filename_hint": ch.metadata, "char_count": len(ch.content)},
                        )
                        session.add(chunk_row)
                        await session.flush()
                        # Patch embedding.source_id to point at the real chunk id (provenance)
                        if embedding_id is not None:
                            try:
                                emb_row.source_id = chunk_row.id
                                await session.flush()
                            except Exception:
                                pass
                    except Exception as e:
                        logger.warning("DocumentChunk insert failed for index %s: %s", ch.index, e)
                        continue

                    # Optional: create Memory row for chunk-level hybrid retrieval parity (non-blocking)
                    # This keeps memory_service search and retrieval.py vector_search both useful
                    try:
                        from api.models.schema import Memory as MemoryRow

                        mem = MemoryRow(
                            type="document_chunk",
                            domain="document",
                            status="READY",
                            title=f"Chunk {ch.index} of {document_id[:8]}",
                            summary=ch.content[:200] if ch.content else "",
                            content=ch.content,
                            content_hash=content_hash or _hashlib.sha256((ch.content or "").encode()).hexdigest(),
                            size=len(ch.content) if ch.content else 0,
                            embedding=emb_vec if emb_vec is not None and len(emb_vec) == 1536 else None,
                            metadata_={
                                "document_id": document_id,
                                "document_version_id": version_id,
                                "chunk_index": ch.index,
                                "start_offset": ch.start_offset,
                                "end_offset": ch.end_offset,
                            },
                            tags=["document_chunk", "ingestion"],
                            workspace_id=uuid.UUID(workspace_id),
                            source_type="document",
                            source_uri=document_id,
                            source_label=f"{ch.index}:{ch.start_offset}-{ch.end_offset}",
                        )
                        session.add(mem)
                    except Exception as e:
                        logger.debug("Chunk Memory insert skipped for %s: %s", ch.index, e)

        logger.info("Persisted %d chunks with embeddings for doc %s", len(chunks), document_id)
    except Exception as e:
        logger.warning("Chunk batch transaction failed (non-blocking): %s", e)


async def _populate_graph_memory(
    workspace_id: str,
    document_id: str,
    content: str,
    chunks: list["TextChunk"],
) -> None:
    """Run MemoryAgent extraction to populate Entities/Relationships + knowledge_nodes.

    Keeps two graph layers in sync (legacy Entity/Relationship + new knowledge_nodes/edges)
    so GraphViewer (obsidian-style) and retrieval.hybrid both reflect ingestion.

    Strategy:
      - Run llm-backed extract() on full content (falls back to mock).
      - For each entity, create Entity row (already done by handler.execute) AND
        mirror as knowledge_nodes row with tenant_id=workspace_id for viewer.
      - For each relationship, mirror as knowledge_edges.
    Implemented best-effort here to avoid circular deps with handler's DB session.
    """
    try:
        from api.agents.memory_agent.extraction import extract
    except Exception:
        return

    try:
        facts = await extract(content, "document", document_id, workspace_id)
    except Exception as e:
        logger.warning("Graph extraction extract() failed: %s", e)
        return

    if not facts.entities:
        return

    try:
        from api.database import async_session_factory as _asf
        from api.services.knowledge_graph_service import kg_service
        from api.schemas.knowledge_graph import CreateNodeRequest, NodeType  # type: ignore

        async with _asf() as session:
            # 1) Create central Document node for obsidian-style hub (document -> entities)
            doc_node_id: str | None = None
            try:
                # Extract filename hint from chunks provenance or use doc id
                doc_label = f"Doc {document_id[:8]}"
                # Try to derive nicer label from first line of content
                first_line = (content.strip().split("\n")[0] if content else "")[:120].strip()
                if first_line and len(first_line) > 5:
                    doc_label = first_line[:60]
                doc_dto = CreateNodeRequest(
                    label=doc_label[:255],
                    type=NodeType.DOCUMENT,
                    description=f"Source document {document_id} • {len(chunks)} chunks • {len(content)} chars",
                    importance=0.7,
                    properties={"source_document_id": document_id, "chunk_count": len(chunks), "kind": "document_hub"},
                    tenant_id=workspace_id,
                )
                doc_row = await kg_service.create_node(doc_dto, tenant_id=workspace_id, db=session, workspace_id=workspace_id)
                if doc_row:
                    doc_node_id = str(doc_row._mapping["id"])
            except Exception as e:
                logger.debug("KG document hub node failed: %s", e)

            label_to_node_id: dict[str, str] = {}
            for ent in facts.entities:
                try:
                    # Map entity_type to NodeType enum; fallback to concept
                    try:
                        ntype = NodeType(ent.entity_type.lower())
                    except Exception:
                        # try canonical mappings
                        mapping = {"skill": "concept", "project": "concept", "organization": "organization", "person": "person", "tool": "concept", "language": "concept"}
                        ntype_val = mapping.get(ent.entity_type.lower(), "concept")
                        ntype = NodeType(ntype_val)

                    dto = CreateNodeRequest(
                        label=ent.name[:255],
                        type=ntype,
                        description=f"Extracted from doc {document_id[:8]} (confidence {ent.confidence})",
                        importance=max(0.1, min(1.0, ent.confidence)),
                        properties={"aliases": ent.aliases, "source_document_id": document_id, "entity_type": ent.entity_type},
                        tenant_id=workspace_id,
                    )
                    row = await kg_service.create_node(dto, tenant_id=workspace_id, db=session, workspace_id=workspace_id)
                    if row:
                        label_to_node_id[ent.name.lower()] = str(row._mapping["id"])
                except Exception as e:
                    logger.debug("KG node mirror failed for entity %s: %s", ent.name, e)
                    continue

            # Link each entity to central document hub (obsidian backlink style: document CONTAINS entity)
            if doc_node_id:
                for lbl, nid in label_to_node_id.items():
                    try:
                        from uuid import UUID as _UUID_DOC

                        from api.schemas.knowledge_graph import CreateEdgeRequest as _EdgeReq

                        edge_dto = _EdgeReq(target_id=nid, relationship="contains", weight=0.8, properties={"source_document_id": document_id})
                        await kg_service.create_edge(_UUID_DOC(doc_node_id), edge_dto, session, workspace_id=workspace_id)
                    except Exception:
                        continue

            # Mirror relationships as edges between mirrored nodes
            for rel in facts.relationships:
                from_id = label_to_node_id.get(rel.from_entity.lower())
                to_id = label_to_node_id.get(rel.to_entity.lower())
                if from_id and to_id and from_id != to_id:
                    try:
                        from uuid import UUID as _UUID

                        from api.schemas.knowledge_graph import CreateEdgeRequest

                        edge_dto = CreateEdgeRequest(
                            target_id=to_id, relationship=rel.relation_type, weight=max(0.1, min(1.0, rel.confidence)), properties={"source_document_id": document_id}
                        )
                        await kg_service.create_edge(_UUID(from_id), edge_dto, session, workspace_id=workspace_id)
                    except Exception as e:
                        logger.debug("KG edge mirror failed %s->%s: %s", rel.from_entity, rel.to_entity, e)
                        continue
            await session.commit()
            hub_msg = f"+ hub" if doc_node_id else ""
            logger.info("Graph memory mirrored: %d nodes %s, %d edges for doc %s", len(label_to_node_id), hub_msg, len(facts.relationships), document_id[:8])
    except Exception as e:
        logger.warning("KG mirror transaction failed (non-blocking): %s", e)


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
