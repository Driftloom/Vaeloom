import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func

from ..models.schema import Document, DocumentAction

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
    "png": "image",
    "jpg": "image",
    "jpeg": "image",
    "gif": "image",
    "svg": "image",
    "webp": "image",
}

ACTION_RENAME = "document_rename"
ACTION_ARCHIVE = "document_archive"
ACTION_RESTORE = "document_restore"


class DocumentNotFound(Exception):
    pass


class DocumentActionNotFound(Exception):
    pass


class DocumentActionAlreadyUndone(Exception):
    pass


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
            content=content,
            metadata_={"original_name": filename, "size": len(content)},
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)
        return doc

    async def list_for_workspace(
        self, workspace_id: str, page: int = 1, page_size: int = 20, include_archived: bool = False, db=None,
    ):
        w_id = uuid.UUID(workspace_id)
        filters = [Document.workspace_id == w_id]
        if not include_archived:
            filters.append(Document.deleted_at.is_(None))
        count_result = await db.execute(select(func.count()).where(*filters))
        total = count_result.scalar_one()
        offset = (page - 1) * page_size
        result = await db.execute(
            select(Document)
            .where(*filters)
            .order_by(Document.deleted_at.asc(), Document.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        return result.scalars().all(), total

    async def get_document(self, document_id: str, workspace_id: str, db=None) -> Document:
        try:
            doc_id = uuid.UUID(document_id)
            w_id = uuid.UUID(workspace_id)
        except (ValueError, TypeError):
            raise DocumentNotFound()
        result = await db.execute(
            select(Document).where(Document.id == doc_id, Document.workspace_id == w_id)
        )
        doc = result.scalar_one_or_none()
        if not doc:
            raise DocumentNotFound()
        return doc

    async def get_content(self, document_id: str, workspace_id: str, db=None):
        doc = await self.get_document(document_id, workspace_id, db)
        return doc.content, doc.type, doc.path

    async def rename(self, document_id: str, workspace_id: str, new_path: str, db=None):
        doc = await self.get_document(document_id, workspace_id, db)
        old_path = doc.path
        if old_path == new_path:
            return doc
        doc.path = new_path
        await self._record_action(db, doc, ACTION_RENAME, old_path, new_path)
        return doc

    async def archive(self, document_id: str, workspace_id: str, db=None):
        doc = await self.get_document(document_id, workspace_id, db)
        if doc.deleted_at is None:
            doc.deleted_at = datetime.now(timezone.utc)
            await self._record_action(db, doc, ACTION_ARCHIVE, None, None)
        return doc

    async def restore(self, document_id: str, workspace_id: str, db=None):
        doc = await self.get_document(document_id, workspace_id, db)
        if doc.deleted_at is not None:
            doc.deleted_at = None
            await self._record_action(db, doc, ACTION_RESTORE, None, None)
        return doc

    async def _record_action(
        self, db, doc: Document, action_type: str, old_path: str | None, new_path: str | None,
    ) -> None:
        now = datetime.now(timezone.utc)
        action = DocumentAction(
            id=uuid.uuid4(),
            document_id=doc.id,
            workspace_id=doc.workspace_id,
            action_type=action_type,
            old_path=old_path,
            new_path=new_path,
            old_deleted_at=doc.deleted_at if action_type == ACTION_ARCHIVE else None,
            new_deleted_at=doc.deleted_at if action_type == ACTION_RESTORE else None,
            created_at=now,
        )
        db.add(action)
        await db.flush()
        await db.refresh(action)
        return action

    async def list_actions(self, document_id: str, workspace_id: str, db=None):
        doc = await self.get_document(document_id, workspace_id, db)
        result = await db.execute(
            select(DocumentAction)
            .where(DocumentAction.document_id == doc.id)
            .order_by(DocumentAction.created_at.desc())
            .limit(50)
        )
        return result.scalars().all()

    async def undo_action(self, action_id: str, workspace_id: str, db=None):
        try:
            a_id = uuid.UUID(action_id)
            w_id = uuid.UUID(workspace_id)
        except (ValueError, TypeError):
            raise DocumentActionNotFound()
        result = await db.execute(
            select(DocumentAction).where(DocumentAction.id == a_id, DocumentAction.workspace_id == w_id)
        )
        action = result.scalar_one_or_none()
        if not action:
            raise DocumentActionNotFound()
        if action.undone_at is not None:
            raise DocumentActionAlreadyUndone()

        doc_result = await db.execute(select(Document).where(Document.id == action.document_id))
        doc = doc_result.scalar_one_or_none()
        if not doc:
            raise DocumentNotFound()

        if action.action_type == ACTION_RENAME:
            doc.path = action.old_path or doc.path
        elif action.action_type == ACTION_ARCHIVE:
            doc.deleted_at = None
        elif action.action_type == ACTION_RESTORE:
            doc.deleted_at = action.old_deleted_at
        action.undone_at = datetime.now(timezone.utc)
        return action, doc


document_service = DocumentService()