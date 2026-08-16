from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.document import DocumentResponse, DocumentListResponse
from ..services.document_service import document_service

router = APIRouter()


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
    docs, total = await document_service.list_for_workspace(workspace_id=workspace_id, page=page, page_size=page_size, db=db)
    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(d) for d in docs],
        total=total,
        page=page,
        page_size=page_size,
    )
