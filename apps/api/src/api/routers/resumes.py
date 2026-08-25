from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..middleware.rate_limit import rate_limit
from ..models.schema import Workspace
from ..schemas.resume import (
    CompileResumeRequest,
    CoverLetterRequest,
    GenerateResumeRequest,
    ResumeArtifactResponse,
    ResumeResponse,
    ResumeTemplateResponse,
    TailorResumeRequest,
)
from ..services.document_builder import (
    DocumentBuilderError,
    PlaywrightUnavailableError,
    document_builder,
    safe_filename,
)
from ..services.resume_service import resume_service
from ..services.resume_templates import resume_templates

router = APIRouter()


async def _verify_workspace_access(workspace_id: str, user_id: str, db: AsyncSession) -> None:
    """Verify user owns this workspace. Raises 404 if not."""
    from uuid import UUID as _UUID

    try:
        wid = _UUID(workspace_id)
        uid = _UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    result = await db.execute(select(Workspace).where(Workspace.id == wid, Workspace.user_id == uid))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workspace not found")


@router.get("", response_model=list[ResumeResponse])
async def list_resumes(
    workspace_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    resumes = await resume_service.list_for_workspace(workspace_id=workspace_id, db=db)
    return [ResumeResponse.model_validate(r) for r in resumes]


@router.get("/master", response_model=ResumeResponse)
async def get_master_resume(
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    resume = await resume_service.get_master(workspace_id=workspace_id, db=db)
    if not resume:
        raise HTTPException(status_code=404, detail="Master resume not found")
    return ResumeResponse.model_validate(resume)


@router.post("/{resume_id}/generate", response_model=ResumeResponse)
async def generate_resume(
    resume_id: str,
    dto: GenerateResumeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    resume = await resume_service.generate_variant(resume_id=resume_id, dto=dto, user_id=user_id, db=db)
    return ResumeResponse.model_validate(resume)


# ── Templates ────────────────────────────────────────────────────────


@router.get("/templates", response_model=list[ResumeTemplateResponse])
async def list_templates(current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return [ResumeTemplateResponse(**t.model_dump()) for t in resume_templates.list_templates()]


# ── AI tailoring ─────────────────────────────────────────────────────


@router.post("/{resume_id}/tailor", response_model=ResumeResponse)
@rate_limit(max_requests=10, window_seconds=60)
async def tailor_resume(
    resume_id: str,
    dto: TailorResumeRequest,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)

    from ..agents.resume_agent.handler import ResumeAgent

    base = await resume_service.get_by_id(resume_id, workspace_id, db=db)
    agent = ResumeAgent()
    tailored_content, _meta = await agent.tailor_content(base.content or {}, dto.job_description)
    variant = await resume_service.create_tailored_variant(
        resume_id=resume_id,
        tailored_content=tailored_content,
        meta=_meta,
        user_id=user_id,
        db=db,
    )
    return ResumeResponse.model_validate(variant)


# ── Document compilation ─────────────────────────────────────────────


def _document_error_status(exc: Exception) -> tuple[int, str]:
    if isinstance(exc, PlaywrightUnavailableError):
        return 503, str(exc)
    if isinstance(exc, DocumentBuilderError):
        return 502, str(exc)
    return 400, str(exc)


@router.post("/{resume_id}/compile", response_model=ResumeArtifactResponse)
@rate_limit(max_requests=6, window_seconds=60)
async def compile_resume(
    resume_id: str,
    dto: CompileResumeRequest,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    resume = await resume_service.get_by_id(resume_id, workspace_id, db=db)

    try:
        compiled = await document_builder.compile_resume(
            resume.content or {}, dto.template_slug, dto.format, max_pages=dto.max_pages
        )
    except (PlaywrightUnavailableError, DocumentBuilderError) as e:
        status, detail = _document_error_status(e)
        raise HTTPException(status_code=status, detail=detail)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    artifact = await resume_service.create_artifact(
        resume.workspace_id,
        resume.id,
        artifact_kind="resume",
        template_slug=dto.template_slug,
        fmt=compiled.extension,
        filename=f"{safe_filename(resume.variant_type + '-resume', 'resume')}-{dto.template_slug}.{compiled.extension}",
        media_type=compiled.media_type,
        data=compiled.data,
        db=db,
    )
    return ResumeArtifactResponse.model_validate(artifact)


@router.post("/{resume_id}/cover-letter", response_model=ResumeArtifactResponse)
@rate_limit(max_requests=6, window_seconds=60)
async def compile_cover_letter(
    resume_id: str,
    dto: CoverLetterRequest,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    resume = await resume_service.get_by_id(resume_id, workspace_id, db=db)

    try:
        compiled = await document_builder.compile_cover_letter(
            resume.content or {},
            body=dto.body,
            template_slug=dto.template_slug,
            recipient=dto.recipient,
            company=dto.company,
            role=dto.role,
            fmt=dto.format,
        )
    except (PlaywrightUnavailableError, DocumentBuilderError) as e:
        status, detail = _document_error_status(e)
        raise HTTPException(status_code=status, detail=detail)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    artifact = await resume_service.create_artifact(
        resume.workspace_id,
        resume.id,
        artifact_kind="cover_letter",
        template_slug=dto.template_slug,
        fmt=compiled.extension,
        filename=f"{safe_filename(resume.variant_type + '-cover-letter', 'cover-letter')}-{dto.template_slug}.{compiled.extension}",
        media_type=compiled.media_type,
        data=compiled.data,
        db=db,
    )
    return ResumeArtifactResponse.model_validate(artifact)


@router.get("/{resume_id}/artifacts", response_model=list[ResumeArtifactResponse])
async def list_resume_artifacts(
    resume_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    artifacts = await resume_service.list_artifacts(resume_id, workspace_id, db=db)
    return [ResumeArtifactResponse.model_validate(a) for a in artifacts]


@router.get("/artifacts/{artifact_id}/download")
async def download_artifact(
    artifact_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    artifact = await resume_service.get_artifact(artifact_id, workspace_id, db=db)

    import io

    buf = io.BytesIO(artifact.content)
    return StreamingResponse(
        buf,
        media_type=artifact.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{artifact.filename}"',
            "Content-Length": str(len(artifact.content)),
        },
    )


@router.post("/{resume_id}/cheatsheet", response_model=ResumeArtifactResponse)
@rate_limit(max_requests=4, window_seconds=60)
async def compile_cheatsheet(
    resume_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """One-page interview prep sheet derived from the resume content."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    resume = await resume_service.get_by_id(resume_id, workspace_id, db=db)

    try:
        compiled = await document_builder.compile_cheatsheet(resume.content or {})
    except (PlaywrightUnavailableError, DocumentBuilderError) as e:
        status, detail = _document_error_status(e)
        raise HTTPException(status_code=status, detail=detail)

    artifact = await resume_service.create_artifact(
        resume.workspace_id,
        resume.id,
        artifact_kind="cheatsheet",
        template_slug=None,
        fmt=compiled.extension,
        filename=f"{safe_filename(resume.variant_type + '-interview-cheatsheet', 'cheatsheet')}.pdf",
        media_type=compiled.media_type,
        data=compiled.data,
        db=db,
    )
    return ResumeArtifactResponse.model_validate(artifact)
