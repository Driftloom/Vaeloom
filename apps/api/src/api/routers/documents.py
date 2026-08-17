from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.schema import Workspace
from ..schemas.document import DocumentResponse, DocumentListResponse
from ..services.document_service import document_service

router = APIRouter()


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


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    workspace_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    doc = await document_service.upload(file=file, workspace_id=workspace_id, user_id=user_id, db=db)
    return DocumentResponse.model_validate(doc)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    workspace_id: str | None = Query(None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    docs, total = await document_service.list_for_workspace(workspace_id=workspace_id, page=page, page_size=page_size, db=db)
    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
        page=page,
        page_size=page_size,
    )
