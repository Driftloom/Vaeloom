import io
import uuid
from datetime import timedelta
from typing import Any

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
from ..models.schema import Workspace, WorkspaceUser
from ..schemas.document import (
    BulkDownloadRequest,
    BulkUploadResponse,
    DocumentActionListResponse,
    DocumentActionResponse,
    DocumentListResponse,
    DocumentRenameRequest,
    DocumentResponse,
    DocumentShareCreate,
    DocumentShareResponse,
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
from ..services.folder_service import folder_service

router = APIRouter()

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "markdown": "text/markdown; charset=utf-8",
    "text": "text/plain; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "json": "application/json; charset=utf-8",
    "html": "text/html; charset=utf-8",
    "xml": "application/xml; charset=utf-8",
    "yaml": "text/yaml; charset=utf-8",
    "image": "image/png",
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
_MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


# ============================================================================
# Core Document Endpoints
# ============================================================================

@router.post("", response_model=DocumentResponse, status_code=201)
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
        raise HTTPException(status_code=413, detail="File too large — max 25MB")

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
    await db.commit()
    await db.refresh(doc)

    # Optional background ingest workflow (Trigger.dev / BullMQ / Temporal — fail-open)
    try:
        from ..config import settings as _settings
        from ..trigger.client import TASK_INGEST_DOCUMENT, get_trigger_client, is_trigger_enabled

        if is_trigger_enabled():
            import asyncio as _aio

            async def _start_trigger() -> None:
                try:
                    tclient = get_trigger_client()
                    await tclient.trigger(
                        task_name=TASK_INGEST_DOCUMENT,
                        payload={
                            "workspace_id": workspace_id,
                            "document_id": str(doc.id),
                            "filename": getattr(doc, "path", "untitled"),
                            "requested_by": _user_id(current_user),
                        },
                        options={"idempotencyKey": f"ingest:{doc.id}"},
                    )
                except Exception as ex:
                    logger.warning(f"Trigger.dev document ingest dispatch failed: {ex}")

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
    include_archived: bool = Query(default=False),
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    docs, total = await document_service.list_for_workspace(
        workspace_id=workspace_id,
        folder_id=folder_id,
        page=page,
        page_size=page_size,
        include_archived=include_archived,
        status=status,
        db=db,
    )
    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/search", response_model=list[DocumentResponse])
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
    docs = await document_service.search_documents(
        workspace_id=workspace_id,
        query=q,
        folder_id=folder_id,
        limit=limit,
        offset=offset,
        db=db,
    )
    return [DocumentResponse.model_validate(d) for d in docs]


# ============================================================================
# Bulk Operations Endpoints (registered before /{document_id} to avoid collision)
# ============================================================================

@router.post("/bulk/upload", response_model=BulkUploadResponse, status_code=200)
@router.post("/bulk", response_model=BulkUploadResponse, status_code=200)
async def bulk_upload_documents(
    files: list[UploadFile] = File(...),
    workspace_id: str = Query(...),
    folder_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

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
@router.post("/bulk-download")
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


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: str,
    workspace_id: str = Query(...),
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

    # Security: Serve as attachment with CSP sandbox headers to prevent Stored XSS
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
    }
    return Response(
        content=content,
        media_type=CONTENT_TYPES.get(doc_type, "application/octet-stream"),
        headers=headers,
    )


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
        actions = await document_service.list_actions(document_id, workspace_id, db)
    except DocumentNotFound:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentActionListResponse(
        actions=[DocumentActionResponse.model_validate(a) for a in actions],
        total=len(actions),
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

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
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
    )
    return [FolderResponse.model_validate(f) for f in folders]


@router.get("/folders/tree", response_model=list[FolderTreeItem])
async def get_folder_tree(
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    return await folder_service.get_folder_tree(workspace_id=workspace_id, db=db)


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

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
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

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    await folder_service.delete_folder(folder_id=folder_id, workspace_id=workspace_id, db=db)
    return Response(status_code=204)


# ============================================================================
# Document Version Endpoints
# ============================================================================

@router.get("/{document_id}/versions", response_model=list[DocumentVersionResponse])
async def list_document_versions(
    document_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        versions = await document_service.list_versions(document_id, workspace_id, db)
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

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
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

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
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

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
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
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        shares = await document_service.list_shares(document_id, workspace_id, db)
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

    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    await document_service.revoke_share(share_id, workspace_id, db)
    return Response(status_code=204)
