from datetime import timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.schema import Workspace
from ..schemas.document import (
    DocumentActionListResponse,
    DocumentActionResponse,
    DocumentListResponse,
    DocumentRenameRequest,
    DocumentResponse,
)
from ..services.document_service import (
    DocumentActionAlreadyUndone,
    DocumentActionNotFound,
    DocumentNotFound,
    document_service,
)

router = APIRouter()

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "markdown": "text/markdown; charset=utf-8",
    "text": "text/plain; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "json": "application/json; charset=utf-8",
    "html": "text/html; charset=utf-8",
    "xml": "application/xml; charset=utf-8",
    "yaml": "text/yaml; charset=utf-8",
    "image": "image/png",
    "unknown": "application/octet-stream",
}


async def _verify_workspace_access(workspace_id: str, user_id: str, db: AsyncSession) -> None:
    """Verify user has access to this workspace. Raises 404 if not found/owned."""
    try:
        from uuid import UUID
        wid = UUID(workspace_id)
        uid = UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    result = await db.execute(select(Workspace).where(Workspace.id == wid, Workspace.user_id == uid))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workspace not found")


def _user_id(current_user: dict) -> str:
    return current_user.get("sub") or current_user.get("user_id")


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    workspace_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    doc = await document_service.upload(file=file, workspace_id=workspace_id, user_id=_user_id(current_user), db=db)
    await db.commit()
    await db.refresh(doc)
    # Auto-start Temporal ingest workflow (fail-open — DB row is source of truth)
    try:
        from ..config import settings as _settings
        if getattr(_settings, "temporal_enabled", False):
            import asyncio as _aio
            import hashlib as _hash

            content_hash = _hash.sha256(doc.content or b"").hexdigest()[:16] if getattr(doc, "content", None) else doc.id.hex[:12]

            async def _start() -> None:
                try:
                    from ..temporal.client import get_temporal_client
                    from ..temporal.queues import queue_name
                    from ..temporal.workflows import IngestInput
                    from ..temporal.metrics import _inc_workflow_started

                    # T-001/T-008: validate no secrets / size before history
                    try:
                        from ..temporal.validation import validate_no_secrets, validate_payload_size

                        validate_no_secrets({"workspace_id": workspace_id, "document_id": str(doc.id), "content_hash": content_hash})
                        validate_payload_size({"workspace_id": workspace_id, "document_id": str(doc.id)}, label="ingest payload")
                    except ValueError:
                        return
                    client = await get_temporal_client()
                    if client is None:
                        return
                    wid = f"ingest:{workspace_id}:{content_hash}:{doc.id}"
                    from temporalio.common import WorkflowIDReusePolicy as _WIDP3  # type: ignore

                    await client.start_workflow(
                        "IngestDocumentWorkflow",
                        IngestInput(workspace_id=workspace_id, document_id=str(doc.id), content_hash=content_hash, requested_by=_user_id(current_user), correlation_id=str(doc.id)),
                        id=wid,
                        task_queue=queue_name("ingest"),
                        id_reuse_policy=_WIDP3.REJECT_DUPLICATE,
                        execution_timeout=timedelta(hours=2),
                    )
                    _inc_workflow_started("IngestDocumentWorkflow", queue_name("ingest"))
                except Exception:
                    pass

            _aio.create_task(_start())
    except Exception:
        pass
    return DocumentResponse.model_validate(doc)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    workspace_id: str | None = Query(None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    include_archived: bool = Query(default=False),
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
        page=page,
        page_size=page_size,
        include_archived=include_archived,
        db=db,
    )
    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
        page=page,
        page_size=page_size,
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
    return Response(
        content=content,
        media_type=CONTENT_TYPES.get(doc_type, "application/octet-stream"),
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
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
    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        doc = await document_service.rename(document_id, workspace_id, dto.path.strip(), db)
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
    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        doc = await document_service.archive(document_id, workspace_id, db)
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
    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
    try:
        doc = await document_service.restore(document_id, workspace_id, db)
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
    await _verify_workspace_access(workspace_id, _user_id(current_user), db)
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
