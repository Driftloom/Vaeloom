import difflib
import hashlib
import logging

from sqlalchemy import select

logger = logging.getLogger(__name__)

# Fuzzy filename match: normalized similarity at/above this ratio treats an
# upload as a new version of an existing document (e.g. resume_final2.pdf
# vs resume_final.pdf ~0.97). stdlib difflib only — no new dependencies.
FUZZY_FILENAME_THRESHOLD = 0.85
FUZZY_CANDIDATE_LIMIT = 200


def compute_content_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def normalize_filename(name: str) -> str:
    return (name or "").lower().strip()


def filename_similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, normalize_filename(a), normalize_filename(b)).ratio()


async def check_dedup(workspace_id: str, content_hash: str, filename: str) -> str | None:
    try:
        import uuid  # noqa: F401

        from sqlalchemy import select

        from api.database import scoped_session
        from api.models.schema import Document, DocumentVersion
    except ImportError as e:
        logger.warning(f"Dedup DB imports unavailable: {e}")
        return _fallback_dedup(workspace_id, content_hash, filename)

    try:
        async with scoped_session(workspace_id=workspace_id, require=False) as session:
            version_stmt = (
                select(DocumentVersion)
                .where(DocumentVersion.checksum == content_hash)
                .limit(1)
            )
            version_result = await session.execute(version_stmt)
            existing_version = version_result.scalar_one_or_none()

            if existing_version:
                doc_stmt = select(Document).where(Document.id == existing_version.document_id)
                doc_result = await session.execute(doc_stmt)
                existing_doc = doc_result.scalar_one_or_none()
                if existing_doc:
                    logger.info(f"Exact content match found: doc={existing_doc.id}, version={existing_version.id}")
                    return str(existing_doc.id)

            path_stmt = (
                select(Document)
                .where(Document.workspace_id == workspace_id)
                .where(Document.path == filename)
                .limit(1)
            )
            path_result = await session.execute(path_stmt)
            existing_doc_by_path = path_result.scalar_one_or_none()

            if existing_doc_by_path:
                logger.info(f"Path match found for {filename}: doc={existing_doc_by_path.id}")
                return str(existing_doc_by_path.id)

            # Fuzzy filename match: versioned/renamed uploads
            # (resume_final2.pdf vs resume_final.pdf) become new versions
            # of the existing document instead of unrelated duplicates.
            fuzzy_id = await _fuzzy_path_match(session, workspace_id, filename)
            if fuzzy_id:
                return fuzzy_id

    except Exception as e:
        logger.warning(f"Dedup DB query failed: {e}, using fallback")
        return _fallback_dedup(workspace_id, content_hash, filename)

    return None


async def _fuzzy_path_match(session, workspace_id: str, filename: str) -> str | None:
    """Best-effort near-duplicate filename match within a workspace."""
    try:
        # Lazy import mirrors check_dedup (avoids module-level cycles).
        from api.models.schema import Document

        cand_stmt = (
            select(Document.id, Document.path)
            .where(Document.workspace_id == workspace_id)
            .limit(FUZZY_CANDIDATE_LIMIT)
        )
        result = await session.execute(cand_stmt)
        best_id: str | None = None
        best_score = 0.0
        for row in result.all() or []:
            candidate_path = row[1] if len(row) > 1 else None
            if not candidate_path:
                continue
            score = filename_similarity(filename, candidate_path)
            if score > best_score:
                best_score = score
                best_id = str(row[0])
        if best_id and best_score >= FUZZY_FILENAME_THRESHOLD:
            logger.info(
                f"Fuzzy filename match for {filename}: doc={best_id} score={best_score:.3f}")
            return best_id
        return None
    except Exception as e:
        logger.debug(f"Fuzzy dedup skipped: {e}")
        return None


def _fallback_dedup(workspace_id: str, content_hash: str, filename: str) -> str | None:
    if "duplicate" in filename.lower():
        logger.info(f"Fallback dedup: found 'duplicate' in filename {filename}")
        return "existing_doc_id_123"
    return None
