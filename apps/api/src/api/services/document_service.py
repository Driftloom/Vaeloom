import uuid

from sqlalchemy import select, func

from ..models.schema import Document

EXTENSION_MAP = {
    "pdf": "pdf",
    "md": "markdown",
    "txt": "text",
    "docx": "docx",
    "doc": "doc",
    "csv": "csv",
    "json": "json",
    "html": "html",
    "xml": "xml",
    "yaml": "yaml",
    "yml": "yaml",
}


class DocumentService:
    async def upload(self, file, workspace_id: str, user_id: str, db=None):
        content = await file.read()
        filename = file.filename or "untitled"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
        doc_type = EXTENSION_MAP.get(ext, "unknown")
        doc = Document(
            workspace_id=uuid.UUID(workspace_id),
            path=filename,
            type=doc_type,
            raw_storage_key=None,
            metadata_={"original_name": filename, "size": len(content)},
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)
        return doc

    async def list_for_workspace(self, workspace_id: str, page: int = 1, page_size: int = 20, db=None):
        w_id = uuid.UUID(workspace_id)
        count_result = await db.execute(
            select(func.count()).where(Document.workspace_id == w_id)
        )
        total = count_result.scalar_one()
        offset = (page - 1) * page_size
        result = await db.execute(
            select(Document)
            .where(Document.workspace_id == w_id)
            .order_by(Document.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return result.scalars().all(), total


document_service = DocumentService()
