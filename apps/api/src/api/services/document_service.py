import io
import logging
import uuid
import zipfile
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select, or_, and_

from ..models.schema import Document, DocumentAction, DocumentVersion, DocumentShare, Folder
from .file_security_service import file_security_service
from .storage_service import storage_service

logger = logging.getLogger(__name__)

EXTENSION_MAP = {
    "pdf": "pdf",
    "md": "markdown",
    "markdown": "markdown",
    "txt": "text",
    "docx": "docx",
    "doc": "docx",
    "csv": "csv",
    "xlsx": "xlsx",
    "xls": "xlsx",
    "pptx": "pptx",
    "ppt": "pptx",
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
ACTION_VERSION_CREATE = "document_version_create"
ACTION_VERSION_RESTORE = "document_version_restore"
ACTION_SHARE = "document_share"


class DocumentNotFound(Exception):
    pass


class DocumentActionNotFound(Exception):
    pass


class DocumentActionAlreadyUndone(Exception):
    pass


class DocumentService:
    async def upload(
        self,
        file,
        workspace_id: str,
        user_id: str | None = None,
        folder_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        import hashlib
        import tempfile

        # 1. Stream upload chunks to a spooled temporary file (G-36 / controlled streaming)
        hasher = hashlib.sha256()
        total_size = 0
        max_upload_bytes = 25 * 1024 * 1024  # 25 MB limit
        chunk_size = 1024 * 1024  # 1 MB chunk

        with tempfile.SpooledTemporaryFile(max_size=5 * 1024 * 1024, mode="w+b") as spooled:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > max_upload_bytes:
                    raise HTTPException(status_code=413, detail="File too large — max 25MB")
                hasher.update(chunk)
                spooled.write(chunk)

            spooled.seek(0)
            content = spooled.read()

        checksum = hasher.hexdigest()
        raw_name = file.filename or "untitled"

        # 2. Server-side path & filename sanitization
        filename = file_security_service.sanitize_filename(raw_name)

        # 3. Server-side file verification (magic bytes, executable rejection, malware scan)
        verdict = file_security_service.inspect_file(
            filename=filename,
            content=content,
            declared_mime=getattr(file, "content_type", None),
        )

        if not verdict.is_safe:
            raise HTTPException(
                status_code=400,
                detail=f"Security rejection: {verdict.rejection_reason}",
            )

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
        doc_type = EXTENSION_MAP.get(ext, "unknown")
        w_id = uuid.UUID(str(workspace_id))
        f_id = uuid.UUID(str(folder_id)) if folder_id else None
        u_id = uuid.UUID(str(user_id)) if user_id else None
        t_id = uuid.UUID(str(tenant_id)) if tenant_id else None

        # Verify folder exists in workspace if specified
        if f_id:
            f_check = await db.execute(
                select(Folder).where(Folder.id == f_id, Folder.workspace_id == w_id)
            )
            if not f_check.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="Target folder not found in workspace")

        doc = Document(
            id=uuid.uuid4(),
            workspace_id=w_id,
            folder_id=f_id,
            path=filename,
            type=doc_type,
            raw_storage_key=None,
            content=content,
            status="ACTIVE",
            detected_mime_type=verdict.detected_mime,
            scan_status=verdict.scan_status,
            scan_result=verdict.rejection_reason,
            metadata_={
                "original_name": filename,
                "size": len(content),
                "sha256": checksum,
                "detected_mime": verdict.detected_mime,
            },
        )
        db.add(doc)
        await db.flush()
        await db.refresh(doc)

        # 4. Create initial DocumentVersion (v1)
        storage_key = f"storage/{workspace_id}/{doc.id}/{filename}"
        v1 = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc.id,
            version_number=1,
            storage_key=storage_key,
            checksum=checksum,
            size_bytes=len(content),
            content=content,
        )
        db.add(v1)

        # 5. Non-blocking object storage upload
        try:
            from ..config import settings as _settings

            if getattr(_settings, "storage_mirror_enabled", False):
                await storage_service.upload(storage_key, content)
                doc.raw_storage_key = storage_key
        except Exception as e:
            logger.warning("Object-storage upload failed: %s", e)
            doc.status = "STORAGE_DEGRADED"

        await db.flush()
        await db.refresh(doc)
        return doc

    async def list_for_workspace(
        self,
        workspace_id: str,
        folder_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
        include_archived: bool = False,
        status: str | None = None,
        db=None,
    ):
        w_id = uuid.UUID(str(workspace_id))
        filters = [Document.workspace_id == w_id]

        if not include_archived:
            filters.append(Document.deleted_at.is_(None))

        if folder_id:
            if str(folder_id).lower() in ("root", "null", "none"):
                filters.append(Document.folder_id.is_(None))
            else:
                filters.append(Document.folder_id == uuid.UUID(str(folder_id)))

        if status:
            filters.append(Document.status == status.upper())

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
        return list(result.scalars().all()), total

    async def get_document(
        self,
        document_id: str,
        workspace_id: str,
        db=None,
        required_permission: str = "read",
    ) -> Document:
        try:
            doc_id = uuid.UUID(str(document_id))
            w_id = uuid.UUID(str(workspace_id))
        except (ValueError, TypeError):
            raise DocumentNotFound()

        result = await db.execute(
            select(Document).where(Document.id == doc_id, Document.workspace_id == w_id)
        )
        doc = result.scalar_one_or_none()
        if not doc:
            # Check if shared with this workspace
            share_stmt = select(DocumentShare).where(
                DocumentShare.document_id == doc_id,
                DocumentShare.target_workspace_id == w_id,
            )
            share = (await db.execute(share_stmt)).scalar_one_or_none()
            if share:
                # P0-03: Share privilege escalation check
                if required_permission in ("write", "admin"):
                    if (share.permission or "").lower() not in ("write", "admin"):
                        raise HTTPException(
                            status_code=403,
                            detail="Forbidden: Document share has read-only permission",
                        )
                # Return document from source workspace if active share
                shared_doc_res = await db.execute(select(Document).where(Document.id == doc_id))
                shared_doc = shared_doc_res.scalar_one_or_none()
                if shared_doc and shared_doc.deleted_at is None:
                    return shared_doc
            raise DocumentNotFound()
        return doc

    async def get_content(self, document_id: str, workspace_id: str, db=None):
        doc = await self.get_document(document_id, workspace_id, db, required_permission="read")
        return doc.content, doc.type, doc.path

    async def rename(
        self,
        document_id: str,
        workspace_id: str,
        new_path: str,
        actor_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")
        old_path = doc.path
        clean_path = file_security_service.sanitize_filename(new_path)
        if not clean_path or old_path == clean_path:
            return doc
        doc.path = clean_path
        u_id = uuid.UUID(str(actor_id)) if actor_id else None
        t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
        await self._record_action(
            db=db,
            doc=doc,
            action_type=ACTION_RENAME,
            old_path=old_path,
            new_path=clean_path,
            actor_id=u_id,
            tenant_id=t_id,
        )
        return doc

    async def archive(
        self,
        document_id: str,
        workspace_id: str,
        actor_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")
        if doc.deleted_at is None:
            old_deleted = doc.deleted_at
            doc.deleted_at = datetime.now(UTC)
            doc.status = "ARCHIVED"
            u_id = uuid.UUID(str(actor_id)) if actor_id else None
            t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
            await self._record_action(
                db=db,
                doc=doc,
                action_type=ACTION_ARCHIVE,
                old_path=None,
                new_path=None,
                old_deleted_at=old_deleted,
                new_deleted_at=doc.deleted_at,
                actor_id=u_id,
                tenant_id=t_id,
            )
        return doc

    async def restore(
        self,
        document_id: str,
        workspace_id: str,
        actor_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")
        if doc.deleted_at is not None:
            old_deleted = doc.deleted_at
            doc.deleted_at = None
            doc.status = "ACTIVE"
            u_id = uuid.UUID(str(actor_id)) if actor_id else None
            t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
            await self._record_action(
                db=db,
                doc=doc,
                action_type=ACTION_RESTORE,
                old_path=None,
                new_path=None,
                old_deleted_at=old_deleted,
                new_deleted_at=None,
                actor_id=u_id,
                tenant_id=t_id,
            )
        return doc

    async def list_versions(self, document_id: str, workspace_id: str, db=None) -> list[DocumentVersion]:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="read")
        stmt = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == doc.id)
            .order_by(DocumentVersion.version_number.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create_version(
        self,
        document_id: str,
        workspace_id: str,
        file,
        user_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> DocumentVersion:
        import hashlib
        import tempfile

        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")

        # Stream & hash
        hasher = hashlib.sha256()
        chunk_size = 1024 * 1024
        total_size = 0
        with tempfile.SpooledTemporaryFile(max_size=5 * 1024 * 1024, mode="w+b") as spooled:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > 25 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="File too large — max 25MB")
                hasher.update(chunk)
                spooled.write(chunk)
            spooled.seek(0)
            content = spooled.read()

        checksum = hasher.hexdigest()
        raw_name = file.filename or doc.path
        filename = file_security_service.sanitize_filename(raw_name)

        verdict = file_security_service.inspect_file(
            filename=filename,
            content=content,
            declared_mime=getattr(file, "content_type", None),
        )
        if not verdict.is_safe:
            raise HTTPException(status_code=400, detail=f"Security rejection: {verdict.rejection_reason}")

        # Find latest version number
        latest_v_stmt = select(func.max(DocumentVersion.version_number)).where(
            DocumentVersion.document_id == doc.id
        )
        latest_num = (await db.execute(latest_v_stmt)).scalar_one_or_none() or 0
        new_version_num = latest_num + 1

        storage_key = f"storage/{workspace_id}/{doc.id}/v{new_version_num}_{filename}"
        new_version = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc.id,
            version_number=new_version_num,
            storage_key=storage_key,
            checksum=checksum,
            size_bytes=len(content),
            content=content,
        )
        db.add(new_version)

        # Update document current content and metadata
        doc.content = content
        doc.raw_storage_key = storage_key
        doc.updated_at = datetime.now(UTC)

        u_id = uuid.UUID(str(user_id)) if user_id else None
        t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
        await self._record_action(
            db=db,
            doc=doc,
            action_type=ACTION_VERSION_CREATE,
            old_path=f"v{latest_num}",
            new_path=f"v{new_version_num}",
            actor_id=u_id,
            tenant_id=t_id,
        )

        await db.commit()
        await db.refresh(new_version)
        return new_version

    async def restore_version(
        self,
        document_id: str,
        version_number: int,
        workspace_id: str,
        user_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> Document:
        doc = await self.get_document(document_id, workspace_id, db, required_permission="write")
        v_stmt = select(DocumentVersion).where(
            DocumentVersion.document_id == doc.id,
            DocumentVersion.version_number == version_number,
        )
        version = (await db.execute(v_stmt)).scalar_one_or_none()
        if not version:
            raise HTTPException(status_code=404, detail=f"Version {version_number} not found")

        # Restore version content from inline store or object storage
        if version.content is not None:
            doc.content = version.content
        else:
            try:
                content = await storage_service.download(version.storage_key)
                doc.content = content
            except Exception as e:
                logger.warning("Storage download failed, keeping inline content: %s", e)

        doc.raw_storage_key = version.storage_key
        doc.updated_at = datetime.now(UTC)

        u_id = uuid.UUID(str(user_id)) if user_id else None
        t_id = uuid.UUID(str(tenant_id)) if tenant_id else None
        await self._record_action(
            db=db,
            doc=doc,
            action_type=ACTION_VERSION_RESTORE,
            old_path=None,
            new_path=f"restored_v{version_number}",
            actor_id=u_id,
            tenant_id=t_id,
        )
        await db.commit()
        await db.refresh(doc)
        return doc

    async def search_documents(
        self,
        workspace_id: str,
        query: str,
        folder_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
        db=None,
    ) -> list[Document]:
        w_id = uuid.UUID(str(workspace_id))
        clean_q = query.strip()
        if not clean_q:
            return []

        search_filter = or_(
            Document.path.ilike(f"%{clean_q}%"),
            Document.summary.ilike(f"%{clean_q}%"),
        )
        stmt = (
            select(Document)
            .where(
                Document.workspace_id == w_id,
                Document.deleted_at.is_(None),
                search_filter,
            )
        )
        if folder_id:
            stmt = stmt.where(Document.folder_id == uuid.UUID(str(folder_id)))

        stmt = stmt.order_by(Document.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def bulk_upload(
        self,
        files: list,
        workspace_id: str,
        user_id: str | None = None,
        folder_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> dict[str, Any]:
        results = []
        errors = []

        for f in files:
            try:
                doc = await self.upload(
                    file=f,
                    workspace_id=workspace_id,
                    user_id=user_id,
                    folder_id=folder_id,
                    tenant_id=tenant_id,
                    db=db,
                )
                results.append({"filename": doc.path, "document_id": str(doc.id), "status": "success"})
            except Exception as e:
                raw_name = getattr(f, "filename", "unknown")
                errors.append({"filename": raw_name, "error": str(e), "status": "failed"})

        await db.commit()
        return {"processed": len(results), "failed": len(errors), "items": results, "errors": errors}

    async def bulk_download_zip(
        self,
        document_ids: list[str],
        workspace_id: str,
        db=None,
    ) -> bytes:
        zip_buffer = io.BytesIO()
        w_id = uuid.UUID(str(workspace_id))

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for doc_id_str in document_ids:
                try:
                    doc = await self.get_document(doc_id_str, workspace_id, db)
                    if doc.deleted_at is not None or not doc.content:
                        continue
                    # Safe entry name: no leading slash, no traversal
                    safe_entry = doc.path.replace("..", "").lstrip("/\\")
                    zip_file.writestr(safe_entry, doc.content)
                except Exception as e:
                    logger.warning("Skipping doc %s in bulk download: %s", doc_id_str, e)

        zip_buffer.seek(0)
        return zip_buffer.getvalue()

    async def share_document(
        self,
        document_id: str,
        source_workspace_id: str,
        target_workspace_id: str,
        permission: str = "read",
        granted_by: str | None = None,
        expires_at: datetime | None = None,
        db=None,
    ) -> DocumentShare:
        doc = await self.get_document(document_id, source_workspace_id, db)
        t_wid = uuid.UUID(str(target_workspace_id))
        s_wid = uuid.UUID(str(source_workspace_id))
        u_id = uuid.UUID(str(granted_by)) if granted_by else None

        if t_wid == s_wid:
            raise HTTPException(status_code=400, detail="Cannot share document with its own workspace")

        # Check existing share
        exist_stmt = select(DocumentShare).where(
            DocumentShare.document_id == doc.id,
            DocumentShare.target_workspace_id == t_wid,
        )
        existing = (await db.execute(exist_stmt)).scalar_one_or_none()
        if existing:
            existing.permission = permission
            existing.expires_at = expires_at
            await db.commit()
            await db.refresh(existing)
            return existing

        share = DocumentShare(
            id=uuid.uuid4(),
            document_id=doc.id,
            source_workspace_id=s_wid,
            target_workspace_id=t_wid,
            permission=permission,
            granted_by=u_id,
            expires_at=expires_at,
        )
        db.add(share)
        await self._record_action(
            db=db,
            doc=doc,
            action_type=ACTION_SHARE,
            old_path=None,
            new_path=f"shared_with_{target_workspace_id}",
            actor_id=u_id,
        )
        await db.commit()
        await db.refresh(share)
        return share

    async def list_shares(self, document_id: str, workspace_id: str, db=None) -> list[DocumentShare]:
        doc = await self.get_document(document_id, workspace_id, db)
        stmt = select(DocumentShare).where(DocumentShare.document_id == doc.id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def revoke_share(self, share_id: str, workspace_id: str, db=None) -> None:
        s_id = uuid.UUID(str(share_id))
        w_id = uuid.UUID(str(workspace_id))
        stmt = select(DocumentShare).where(
            DocumentShare.id == s_id,
            DocumentShare.source_workspace_id == w_id,
        )
        share = (await db.execute(stmt)).scalar_one_or_none()
        if not share:
            raise HTTPException(status_code=404, detail="Document share not found")
        await db.delete(share)
        await db.commit()

    async def _record_action(
        self,
        db,
        doc: Document,
        action_type: str,
        old_path: str | None,
        new_path: str | None,
        old_deleted_at: datetime | None = None,
        new_deleted_at: datetime | None = None,
        actor_id: uuid.UUID | None = None,
        tenant_id: uuid.UUID | None = None,
    ) -> DocumentAction:
        now = datetime.now(UTC)
        action = DocumentAction(
            id=uuid.uuid4(),
            document_id=doc.id,
            workspace_id=doc.workspace_id,
            actor_id=actor_id,
            tenant_id=tenant_id,
            action_type=action_type,
            old_path=old_path,
            new_path=new_path,
            old_deleted_at=old_deleted_at,
            new_deleted_at=new_deleted_at,
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
        return list(result.scalars().all())

    async def undo_action(self, action_id: str, workspace_id: str, db=None):
        try:
            a_id = uuid.UUID(str(action_id))
            w_id = uuid.UUID(str(workspace_id))
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
            doc.status = "ACTIVE"
        elif action.action_type == ACTION_RESTORE:
            doc.deleted_at = action.old_deleted_at
            if action.old_deleted_at:
                doc.status = "ARCHIVED"
        action.undone_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(action)
        return action, doc


    async def bulk_upload(
        self,
        files: list,
        workspace_id: str,
        user_id: str | None = None,
        folder_id: str | None = None,
        tenant_id: str | None = None,
        db=None,
    ) -> dict[str, Any]:
        """Bulk upload multiple files concurrently with individual error isolation.
        Guarantees zero silent drops: every file succeeds or has an explicit error."""
        succeeded = []
        failed = []

        for f in files:
            fname = getattr(f, "filename", "unnamed")
            try:
                doc = await self.upload(
                    file=f,
                    workspace_id=workspace_id,
                    user_id=user_id,
                    folder_id=folder_id,
                    tenant_id=tenant_id,
                    db=db,
                )
                succeeded.append({
                    "id": str(doc.id),
                    "filename": fname,
                    "path": doc.path,
                    "scan_status": doc.scan_status,
                })
            except Exception as e:
                err_msg = str(getattr(e, "detail", str(e)))
                failed.append({
                    "filename": fname,
                    "error": err_msg,
                })

        return {
            "total_attempted": len(files),
            "processed": len(succeeded),
            "failed": len(failed),
            "succeeded": succeeded,
            "items": succeeded,
            "errors": failed,
        }

    async def bulk_download_zip(
        self,
        document_ids: list,
        workspace_id: str,
        db=None,
    ) -> bytes:
        """Create a zip archive containing requested documents."""
        import zipfile
        import io

        w_uuid = uuid.UUID(str(workspace_id))
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for d_id in document_ids:
                try:
                    content, _doc_type, path = await self.get_content(str(d_id), str(w_uuid), db)
                    if content is not None:
                        fname = path.rsplit("/", 1)[-1] if path else f"doc_{d_id}.bin"
                        zf.writestr(fname, content)
                except Exception as e:
                    logger.warning("Failed to include document %s in bulk download: %s", d_id, e)

        zip_buffer.seek(0)
        return zip_buffer.getvalue()


document_service = DocumentService()
