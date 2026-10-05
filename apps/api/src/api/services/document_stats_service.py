"""Workspace-wide aggregates for the documents list.

Every figure is produced by SQL over the whole workspace. Deriving them from the
rows of the current page is what produced the mixed denominators this replaces:
a page of 50 rows cannot report a workspace total, and a "3 quarantined" badge
computed from one page of a 40,000-row workspace is not a count of anything.
"""
import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Document, DocumentShare, Folder
from .document_service import _live_share_predicate, json_int_key

logger = logging.getLogger(__name__)


async def workspace_document_stats(workspace_id: str, db: AsyncSession) -> dict[str, int]:
    """Aggregate document, folder and share counts for one workspace.

    ``deleted_at`` rows are counted separately as archived rather than being
    folded into the live total, which is what the documents list calls "archived".
    """
    w_id = uuid.UUID(str(workspace_id))

    doc_row = (
        await db.execute(
            select(
                func.count().filter(Document.deleted_at.is_(None)),
                func.count().filter(Document.deleted_at.is_not(None)),
                func.coalesce(func.sum(json_int_key(Document.metadata_, "size")), 0),
                func.count().filter(func.lower(Document.scan_status) == "clean"),
                func.count().filter(func.lower(Document.scan_status) == "quarantined"),
                func.count().filter(func.lower(Document.scan_status) == "scanning"),
            ).where(Document.workspace_id == w_id)
        )
    ).one()

    folder_count = (
        await db.execute(select(func.count()).where(Folder.workspace_id == w_id))
    ).scalar_one()

    # Shares this workspace GRANTED and that have not lapsed. Shares pointing INTO
    # the workspace are deliberately excluded: the card reports what this
    # workspace exposes, not what it was given.
    active_share_count = (
        await db.execute(
            select(func.count())
            .where(
                DocumentShare.source_workspace_id == w_id,
                _live_share_predicate(db),
            )
        )
    ).scalar_one()

    return {
        "total_documents": int(doc_row[0] or 0),
        "archived_documents": int(doc_row[1] or 0),
        "total_bytes": int(doc_row[2] or 0),
        "clean_count": int(doc_row[3] or 0),
        "quarantined_count": int(doc_row[4] or 0),
        "scanning_count": int(doc_row[5] or 0),
        "folder_count": int(folder_count or 0),
        "active_share_count": int(active_share_count or 0),
    }
