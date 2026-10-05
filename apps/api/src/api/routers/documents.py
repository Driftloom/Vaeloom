import uuid

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..middleware.rate_limit import rate_limit
from ..models.schema import Workspace, WorkspaceUser
from ..schemas.document import (
    BulkDownloadRequest,
    BulkSyncMemoryRequest,
    BulkSyncMemoryResponse,
    BulkUploadResponse,
    DocumentActionListResponse,
    DocumentActionResponse,
    DocumentAuditResponse,
    DocumentCompareRequest,
    DocumentCompareResponse,
    DocumentListResponse,
    DocumentMoveRequest,
    DocumentProcessResponse,
    DocumentRenameRequest,
    DocumentResponse,
    DocumentSearchResponse,
    DocumentShareCreate,
    DocumentShareResponse,
    DocumentStatsResponse,
    DocumentSyncMemoryResponse,
    DocumentTagsRequest,
    DocumentVersionResponse,
    FolderCreate,
    FolderResponse,
    FolderTreeItem,
    FolderUpdate,
)
from ..services.document_service import (
    DocumentActionAlreadyUndone,
    DocumentActionNotFound,
    DocumentNotFound,
    document_service,
)
from ..services.document_stats_service import workspace_document_stats
from ..services.folder_service import folder_service

router = APIRouter()

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "markdown": "text/markdown; charset=utf-8",
    "text": "text/plain; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "json": "application/json; charset=utf-8",
    "html": "text/html; charset=utf-8",
    "xml": "application/xml; charset=utf-8",
    "yaml": "text/yaml; charset=utf-8",
    "yml": "text/yaml; charset=utf-8",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
    "svg": "image/svg+xml",
    "bmp": "image/bmp",
    "ico": "image/x-icon",
    "image": "image/png",
    "py": "text/plain; charset=utf-8",
    "js": "text/plain; charset=utf-8",
    "ts": "text/plain; charset=utf-8",
    "tsx": "text/plain; charset=utf-8",
    "unknown": "application/octet-stream",
}


async def _verify_workspace_access(
    workspace_id: str,
    user_id: str,
    db: AsyncSession,
    required_roles: tuple[str, ...] | None = None,
) -> Workspace:
    """Verify user has access to this workspace.

    Checks if user is workspace owner OR a member in WorkspaceUser.
    Raises 404 if workspace does not exist.
    Raises 403 if workspace exists but user is not a member or lacks required role.
    """
    try:
        wid = uuid.UUID(str(workspace_id))
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    ws_result = await db.execute(select(Workspace).where(Workspace.id == wid))
    ws = ws_result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Owner has all permissions
    if ws.user_id == uid:
        return ws

    # Check WorkspaceUser membership table
    member_stmt = select(WorkspaceUser).where(
        WorkspaceUser.workspace_id == wid,
        WorkspaceUser.user_id == uid,
    )
    member = (await db.execute(member_stmt)).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Forbidden: Access to workspace denied")

    if required_roles and member.role.upper() not in [r.upper() for r in required_roles]:
        raise HTTPException(status_code=403, detail=f"Forbidden: Insufficient role {member.role}")

    return ws


def _user_id(current_user: dict) -> str:
    return current_user.get("sub") or current_user.get("user_id")


# ---------------------------------------------------------------------------
# P0-02: Role permission tiers — passed to _verify_workspace_access
# WRITE: upload, share (any workspace member may contribute)
# MUTATE: rename, archive, restore (editor-level and above)
# ADMIN: delete, bulk-delete (owner/admin only)
# ---------------------------------------------------------------------------
_ROLES_WRITE = ("owner", "admin", "editor", "member")
_ROLES_MUTATE = ("owner", "admin", "editor")
_ROLES_ADMIN = ("owner", "admin")

# P0-05: Maximum upload size enforced at router level before service streaming begins
_MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB

# P0-10: Cap on files accepted by a single bulk-upload request. FastAPI buffers
# every UploadFile before the handler runs, so an unbounded list is a memory
# exhaustion vector even when each individual file passes the size guard.
_MAX_BULOAD_FILES = 50


# ============================================================================
# Core Document Endpoints
# ============================================================================

@router.post("", response_model=DocumentResponse, status_code=201)
# 30/minute is half the platform default of 60/minute. Every upload streams the
# body through a spooled file, hashes it, and runs magic-byte inspection before
# the row is written, so the cost is far above a metadata read and an unbounded
# member could otherwise fill object storage at the default allowance.
@rate_limit(max_requests=30, window_seconds=60)
async def upload_document(
    file: UploadFile = File(...),
    workspace_id: str | None = Query(None),
    folder_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-05: Router-level size guard — prevents memory exhaustion before service streaming
    if file.size is not None and file.size > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large — max 100MB")

    # P0-02: Require member-level role or above to upload
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_WRITE)

    doc = await document_service.upload(
        file=file,
        workspace_id=workspace_id,
        user_id=_user_id(current_user),
        folder_id=folder_id,
        tenant_id=current_user.get("tenant_id"),
        db=db,
    )
    # Outbox (Loop 4): mirror the ingest intent in the SAME transaction as the
    # document row. If upload() already committed, this commits separately (no
    # worse than the old fire-and-forget); otherwise crash-atomicity holds and
    # the relay delivers via publish_document_from_outbox().
    try:
        from ..services.outbox import record_outbox_event

        record_outbox_event(
            db,
            event_type="document.ingest",
            payload={
                "document_id": str(doc.id),
                "workspace_id": workspace_id,
                "filename": getattr(doc, "path", "untitled"),
                "requested_by": _user_id(current_user),
            },
            workspace_id=workspace_id,
            tenant_id=current_user.get("tenant_id"),
        )
    except Exception:
        pass
    await db.commit()
    await db.refresh(doc)

    # Optional background ingest workflow (Trigger.dev / BullMQ / Temporal — fail-open)
    try:
        from ..services.document_service import dispatch_document_ingest
        from ..trigger.client import is_trigger_enabled

        if is_trigger_enabled():
            import asyncio as _aio

            async def _start_trigger() -> None:
                await dispatch_document_ingest(
                    str(doc.id), workspace_id,
                    getattr(doc, "path", "untitled"), _user_id(current_user),
                )

            _aio.create_task(_start_trigger())
    except Exception:
        pass

    return DocumentResponse.model_validate(doc)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    workspace_id: str | None = Query(None),
    folder_id: str | None = Query(None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    limit: int | None = Query(default=None, ge=1, le=100, description="Standard pagination page size (wins over page/page_size)"),
    offset: int | None = Query(default=None, ge=0, description="Standard pagination rows to skip"),
    include_archived: bool = Query(default=False),
    status: str | None = Query(default=None),
    category: str | None = Query(
        default=None,
        description="Filter on the JSONB metadata.category key (written by the categorize_document tool)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from ..utils.pagination import resolve_page_params
    page, page_size = resolve_page_params(page, page_size, limit, offset)
    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    docs, total = await document_service.list_for_workspace(
        workspace_id=workspace_id,
        folder_id=folder_id,
        page=page,
        page_size=page_size,
        include_archived=include_archived,
        status=status,
        category=category,
        db=db,
    )
    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/search", response_model=DocumentSearchResponse)
async def search_documents(
    q: str = Query(..., min_length=1),
    workspace_id: str = Query(...),
    folder_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    docs, total = await document_service.search_documents(
        workspace_id=workspace_id,
        query=q,
        folder_id=folder_id,
        limit=limit,
        offset=offset,
        db=db,
    )
    return DocumentSearchResponse(
        documents=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/stats", response_model=DocumentStatsResponse)
async def get_document_stats(
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Workspace-wide document aggregates for the list header.

    Read-only, so plain membership is the bar — no mutation role. Declared
    before the `/{document_id}` routes so "stats" can never be captured as a
    document id.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    return DocumentStatsResponse(**await workspace_document_stats(workspace_id, db))


# ============================================================================
# Bulk Operations Endpoints (registered before /{document_id} to avoid collision)
# ============================================================================

@router.post("/bulk/upload", response_model=BulkUploadResponse, status_code=200)
@router.post("/bulk", response_model=BulkUploadResponse, status_code=200, operation_id="bulk_upload_documents_alias")
# One request may carry up to _MAX_BULOAD_FILES (50) files, each up to 100MB, so a
# single call can move 5GB through the process. 5 per 5 minutes caps that at
# ~5GB/5min per member while still letting a real import finish; the per-file
# ceiling is a size guard, not a throughput guard.
@rate_limit(max_requests=5, window_seconds=300)
async def bulk_upload_documents(
    files: list[UploadFile] = File(...),
    workspace_id: str = Query(...),
    folder_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > _MAX_BULOAD_FILES:
        raise HTTPException(
            status_code=413,
            detail=f"Too many files — max {_MAX_BULOAD_FILES} per bulk upload",
        )

    # P0-02: member-level role required to upload
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_WRITE)
    res = await document_service.bulk_upload(
        files=files,
        workspace_id=workspace_id,
        user_id=_user_id(current_user),
        folder_id=folder_id,
        tenant_id=current_user.get("tenant_id"),
        db=db,
    )
    return BulkUploadResponse(**res)


@router.post("/bulk/download")
@router.post("/bulk-download", operation_id="bulk_download_documents_alias")
async def bulk_download_documents(
    payload: BulkDownloadRequest | dict = Body(...),
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Download is read-level (any member)
    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    doc_ids = payload.document_ids if hasattr(payload, "document_ids") else payload.get("document_ids", [])
    zip_bytes = await document_service.bulk_download_zip(
        document_ids=doc_ids,
        workspace_id=workspace_id,
        db=db,
    )
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="documents_export.zip"'},
    )


@router.post("/bulk/delete", status_code=200)
@router.post("/bulk-delete", status_code=200, operation_id="bulk_delete_documents_alias")
async def bulk_delete_documents(
    payload: BulkDownloadRequest | dict = Body(...),
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: permanent bulk delete is owner/admin only (irreversible)
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_ADMIN)
    doc_ids = payload.document_ids if hasattr(payload, "document_ids") else payload.get("document_ids", [])
    res = await document_service.bulk_delete(
        document_ids=doc_ids,
        workspace_id=workspace_id,
        actor_id=_user_id(current_user),
        tenant_id=current_user.get("tenant_id"),
        db=db,
    )
    return res


@router.post("/bulk/sync-memory", response_model=BulkSyncMemoryResponse)
@router.post("/bulk-sync-memory", response_model=BulkSyncMemoryResponse, operation_id="bulk_sync_documents_to_memory_alias")
async def bulk_sync_documents_to_memory(
    payload: BulkSyncMemoryRequest | dict = Body(...),
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: member-level role or above to sync into the memory store
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_WRITE)
    doc_ids = payload.document_ids if hasattr(payload, "document_ids") else payload.get("document_ids", [])
    res = await document_service.bulk_sync_documents_to_memory(
        document_ids=[str(i) for i in doc_ids],
        workspace_id=workspace_id,
        user_id=_user_id(current_user),
        tenant_id=current_user.get("tenant_id"),
        db=db,
    )
    return BulkSyncMemoryResponse.model_validate(res)


@router.post("/auto-organize")
async def auto_organize_documents(
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Auto-organize root/unorganized documents into categorized smart folders."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    return await document_service.auto_organize(
        workspace_id=workspace_id,
        user_id=_user_id(current_user),
        db=db,
    )


# ============================================================================
# Folder Endpoints
# ============================================================================

@router.post("/folders", response_model=FolderResponse, status_code=201)
async def create_folder(
    dto: FolderCreate,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: member-level role or above to create a folder
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_WRITE)
    folder = await folder_service.create_folder(
        workspace_id=workspace_id,
        name=dto.name,
        parent_id=dto.parent_id,
        user_id=_user_id(current_user),
        db=db,
    )
    return FolderResponse.model_validate(folder)


@router.get("/folders", response_model=list[FolderResponse])
async def list_folders(
    workspace_id: str = Query(...),
    parent_id: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    folders = await folder_service.list_folders(
        workspace_id=workspace_id,
        parent_id=parent_id,
        db=db,
        limit=limit,
        offset=offset,
    )
    return [FolderResponse.model_validate(f) for f in folders]


@router.get("/folders/tree", response_model=list[FolderTreeItem])
async def get_folder_tree(
    workspace_id: str = Query(...),
    limit: int = Query(default=200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    return await folder_service.get_folder_tree(workspace_id=workspace_id, db=db, limit=limit)


@router.patch("/folders/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: str,
    dto: FolderUpdate,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: folder update requires editor-level role or above
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    folder = await folder_service.update_folder(
        folder_id=folder_id,
        workspace_id=workspace_id,
        name=dto.name,
        parent_id=dto.parent_id,
        db=db,
    )
    return FolderResponse.model_validate(folder)


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: folder delete requires editor-level role or above
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    await folder_service.delete_folder(folder_id=folder_id, workspace_id=workspace_id, db=db)
    return Response(status_code=204)


# ============================================================================
# Individual Document Endpoints
# ============================================================================

@router.get("/{document_id}/content")
async def get_document_content(
    document_id: str,
    workspace_id: str = Query(...),
    inline: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        content, doc_type, path = await document_service.get_content(document_id, workspace_id, db)
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    if content is None:
        raise HTTPException(status_code=404, detail="Document has no stored content")

    filename = path.rsplit("/", 1)[-1] or path
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mime_type = CONTENT_TYPES.get(doc_type) or CONTENT_TYPES.get(ext) or "application/octet-stream"

    # Security: Inline preview for in-browser rendering (images, pdfs, text)
    # vs attachment for explicit file downloads
    disposition = "inline" if inline else "attachment"
    csp = (
        "default-src 'self' blob: data:; style-src 'unsafe-inline'; sandbox allow-scripts allow-same-origin"
        if inline
        else "default-src 'none'; sandbox"
    )
    frame_options = "SAMEORIGIN" if inline else "DENY"
    headers = {
        "Content-Disposition": f'{disposition}; filename="{filename}"',
        "Content-Security-Policy": csp,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": frame_options,
    }
    return Response(
        content=content,
        media_type=mime_type,
        headers=headers,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        doc = await document_service.get_document(
            document_id=document_id,
            workspace_id=workspace_id,
            db=db,
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse.model_validate(doc)


@router.patch("/{document_id}", response_model=DocumentResponse)
async def rename_document(
    document_id: str,
    dto: DocumentRenameRequest,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: rename requires editor-level role or above
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    try:
        doc = await document_service.rename(
            document_id=document_id,
            workspace_id=workspace_id,
            new_path=dto.path.strip(),
            actor_id=_user_id(current_user),
            tenant_id=current_user.get("tenant_id"),
            db=db,
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.commit()
    await db.refresh(doc)
    return DocumentResponse.model_validate(doc)


@router.post("/{document_id}/move", response_model=DocumentResponse)
async def move_document(
    document_id: str,
    dto: DocumentMoveRequest,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Move document to a different folder or to workspace root."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    try:
        doc = await document_service.move_document(
            document_id=document_id,
            workspace_id=workspace_id,
            target_folder_id=dto.folder_id,
            actor_id=_user_id(current_user),
            tenant_id=current_user.get("tenant_id"),
            db=db,
        )
    except DocumentNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))

    await db.commit()
    await db.refresh(doc)
    return DocumentResponse.model_validate(doc)


@router.patch("/{document_id}/tags", response_model=DocumentResponse)
async def update_document_tags(
    document_id: str,
    dto: DocumentTagsRequest,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update semantic tags on a document."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    try:
        doc = await document_service.update_tags(
            document_id=document_id,
            workspace_id=workspace_id,
            tags=dto.tags,
            actor_id=_user_id(current_user),
            tenant_id=current_user.get("tenant_id"),
            db=db,
        )
    except DocumentNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))

    await db.commit()
    await db.refresh(doc)
    return DocumentResponse.model_validate(doc)


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Permanently delete a document and clean up associated storage and memory."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: permanent delete is owner/admin only (hard delete, not reversible)
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_ADMIN)
    try:
        await document_service.delete(
            document_id=document_id,
            workspace_id=workspace_id,
            actor_id=_user_id(current_user),
            tenant_id=current_user.get("tenant_id"),
            db=db,
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")
    return Response(status_code=204)


@router.post("/{document_id}/archive", response_model=DocumentResponse)
async def archive_document(
    document_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: archive requires editor-level role or above
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    try:
        doc = await document_service.archive(
            document_id=document_id,
            workspace_id=workspace_id,
            actor_id=_user_id(current_user),
            tenant_id=current_user.get("tenant_id"),
            db=db,
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.commit()
    await db.refresh(doc)
    return DocumentResponse.model_validate(doc)


@router.post("/{document_id}/restore", response_model=DocumentResponse)
async def restore_document(
    document_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: restore requires editor-level role or above
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    try:
        doc = await document_service.restore(
            document_id=document_id,
            workspace_id=workspace_id,
            actor_id=_user_id(current_user),
            tenant_id=current_user.get("tenant_id"),
            db=db,
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.commit()
    await db.refresh(doc)
    return DocumentResponse.model_validate(doc)


@router.get("/{document_id}/actions", response_model=DocumentActionListResponse)
async def list_document_actions(
    document_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        actions, total_actions = await document_service.list_actions(document_id, workspace_id, db)
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentActionListResponse(
        actions=[DocumentActionResponse.model_validate(a) for a in actions],
        total=total_actions,
    )


@router.post("/actions/{action_id}/undo", response_model=DocumentResponse)
async def undo_document_action(
    action_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: undo is a mutating operation
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    try:
        _action, doc = await document_service.undo_action(action_id, workspace_id, db)
    except DocumentActionNotFound:
        raise HTTPException(status_code=404, detail="Action not found")
    except DocumentActionAlreadyUndone:
        raise HTTPException(status_code=409, detail="Action already undone")
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.commit()
    await db.refresh(doc)
    return DocumentResponse.model_validate(doc)


# ============================================================================
# Document Version Endpoints
# ============================================================================

@router.get("/{document_id}/versions", response_model=list[DocumentVersionResponse])
async def list_document_versions(
    document_id: str,
    workspace_id: str = Query(...),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        versions = await document_service.list_versions(
            document_id, workspace_id, db, limit=limit, offset=offset
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return [DocumentVersionResponse.model_validate(v) for v in versions]


@router.post("/{document_id}/versions", response_model=DocumentVersionResponse, status_code=201)
async def create_document_version(
    document_id: str,
    file: UploadFile = File(...),
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: member-level role or above to contribute a new version
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_WRITE)
    try:
        version = await document_service.create_version(
            document_id=document_id,
            workspace_id=workspace_id,
            file=file,
            user_id=_user_id(current_user),
            tenant_id=current_user.get("tenant_id"),
            db=db,
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentVersionResponse.model_validate(version)


@router.post("/{document_id}/versions/{version_number}/restore", response_model=DocumentResponse)
async def restore_document_version(
    document_id: str,
    version_number: int,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: version restore overwrites the live document, so editor-level and above
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    try:
        doc = await document_service.restore_version(
            document_id=document_id,
            version_number=version_number,
            workspace_id=workspace_id,
            user_id=_user_id(current_user),
            tenant_id=current_user.get("tenant_id"),
            db=db,
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse.model_validate(doc)


# ============================================================================
# Document Quality Audit & Version Comparison Endpoints
# ============================================================================

@router.post("/{document_id}/audit", response_model=DocumentAuditResponse)
async def audit_document(
    document_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        audit_res = await document_service.audit_document_quality(document_id, workspace_id, db)
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentAuditResponse(**audit_res)


@router.post("/{document_id}/compare", response_model=DocumentCompareResponse)
async def compare_document(
    document_id: str,
    dto: DocumentCompareRequest = Body(...),
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        compare_res = await document_service.compare_document_versions(
            document_id=document_id,
            version_a=dto.version_a,
            version_b=dto.version_b,
            workspace_id=workspace_id,
            db=db,
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentCompareResponse(**compare_res)


# ============================================================================
# Document Sharing Endpoints
# ============================================================================

@router.post("/{document_id}/shares", response_model=DocumentShareResponse, status_code=201)
@router.post("/{document_id}/share", response_model=DocumentShareResponse, status_code=201)
async def share_document(
    document_id: str,
    dto: DocumentShareCreate,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: granting another workspace access requires editor-level role or above
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    try:
        share = await document_service.share_document(
            document_id=document_id,
            source_workspace_id=workspace_id,
            target_workspace_id=str(dto.target_workspace_id),
            permission=dto.permission,
            granted_by=_user_id(current_user),
            expires_at=dto.expires_at,
            db=db,
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentShareResponse.model_validate(share)


@router.get("/{document_id}/shares", response_model=list[DocumentShareResponse])
async def list_document_shares(
    document_id: str,
    workspace_id: str = Query(...),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        shares = await document_service.list_shares(
            document_id, workspace_id, db, limit=limit, offset=offset
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return [DocumentShareResponse.model_validate(s) for s in shares]


@router.delete("/{document_id}/shares/{share_id}", status_code=204)
@router.delete("/shares/{share_id}", status_code=204)
async def revoke_document_share(
    share_id: str,
    document_id: str | None = None,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: revoking another workspace's access requires editor-level role or above
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_MUTATE)
    await document_service.revoke_share(share_id, workspace_id, db)
    return Response(status_code=204)


@router.post("/{document_id}/sync-memory", response_model=DocumentSyncMemoryResponse)
async def sync_document_to_memory(
    document_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Synchronize document content into the workspace memory store."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: member-level role or above to sync into the memory store
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_WRITE)
    try:
        res = await document_service.sync_document_to_memory(
            document_id=document_id,
            workspace_id=workspace_id,
            user_id=_user_id(current_user),
            tenant_id=current_user.get("tenant_id"),
            db=db,
        )
        return DocumentSyncMemoryResponse.model_validate(res)
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")


# ============================================================================
# Document Ingestion Endpoints
# ============================================================================

@router.post("/{document_id}/process", response_model=DocumentProcessResponse)
# Parsing is CPU-bound (a PDF page render or an OCR pass per page) and every
# chunk is embedded, so one call can occupy a worker for seconds. 10 per 5
# minutes keeps a member from turning a retry loop into a queue of its own.
@rate_limit(max_requests=10, window_seconds=300)
async def process_document(
    document_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Run the ingestion pipeline over an already-uploaded document.

    The caller pointed at `/workspaces/{workspace_id}/documents/{document_id}/process`,
    a path that has never existed; the ingest trigger swallowed the 404 and
    reported success, so ingestion silently no-opped.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # P0-02: ingestion writes chunks, embeddings and (via dedup) new versions, so
    # member-level role or above is the floor.
    await _verify_workspace_access(workspace_id, _user_id(current_user), db, required_roles=_ROLES_WRITE)
    try:
        # required_permission="write" so a holder of a READ share on this document
        # cannot ingest it — get_document falls back to the share when the document
        # lives in another workspace, and that fallback has to be permission-checked.
        # get_content below resolves read-level only, so this call is what enforces
        # the write requirement.
        await document_service.get_document(
            document_id=document_id,
            workspace_id=workspace_id,
            db=db,
            required_permission="write",
        )
        content, _doc_type, path = await document_service.get_content(
            document_id, workspace_id, db
        )
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    if not content:
        raise HTTPException(status_code=404, detail="Document has no stored content")

    from ..ingestion.parsers import PARSERS
    from ..ingestion.pipeline import run_pipeline

    filename = path.rsplit("/", 1)[-1] or path
    # Idempotency is inherited from the pipeline's own content-hash dedup
    # (ingestion/dedup.check_dedup), not reimplemented here: a repeat call resolves
    # to the existing document and adds a version to it instead of a second
    # document row.
    result = await run_pipeline(
        workspace_id=workspace_id,
        filename=filename,
        content=content,
        user_id=_user_id(current_user),
    )

    if result.get("status") == "success":
        return DocumentProcessResponse(
            document_id=document_id,
            status="processed",
            # run_pipeline reports the real chunk count; anything else would be a
            # number this endpoint invented.
            chunks_indexed=int(result.get("chunk_count") or 0),
        )

    reason = str(result.get("reason") or "ingestion failed")
    # run_pipeline is total: it converts UnsupportedFormatError AND infrastructure
    # failures alike into {"status": "error"}. The parsers themselves swallow their
    # own per-file errors (PDFParser returns an error document instead of raising),
    # so an error on a format that HAS a registered parser means the failure was
    # after parsing — a real 5xx. An unregistered format is a normal outcome and
    # must not read as a server error to the caller.
    ext = f".{filename.rsplit('.', 1)[-1].lower()}" if "." in filename else ""
    if ext in PARSERS:
        raise HTTPException(status_code=500, detail=f"Document ingestion failed: {reason}")

    return DocumentProcessResponse(
        document_id=document_id,
        status="skipped",
        detail=reason,
    )

