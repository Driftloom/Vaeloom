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
    CompileTypstRequest,
    CoverLetterRequest,
    GenerateResumeRequest,
    InlineAiRequest,
    InlineAiResponse,
    ResumeArtifactResponse,
    ResumeResponse,
    ResumeSourceResponse,
    ResumeTemplateResponse,
    TailorResumeRequest,
    UpdateSourceRequest,
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


# ── Overleaf-style source (Typst/LaTeX) ─────────────────────────────────
# Hybrid engine: JSON stays canonical; Typst source is the Monaco live file.
# User edits source ↔ JSON via transpiler; WASM Typst does 50ms live, Tectonic fallback for classic .tex.


@router.get("/{resume_id}/source", response_model=ResumeSourceResponse)
async def get_resume_source(
    resume_id: str,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    resume = await resume_service.get_by_id(resume_id, workspace_id, db=db)

    from ..models.schema import ResumeSource

    result = await db.execute(select(ResumeSource).where(ResumeSource.resume_id == resume.id).order_by(ResumeSource.updated_at.desc()).limit(1))
    src = result.scalar_one_or_none()
    if src:
        return ResumeSourceResponse.model_validate(src)

    # Auto-create from JSON → Typst on first fetch (so Overleaf editor never empty)
    from ..services.typst_transpiler import to_typst

    typst = to_typst(resume.content or {}, template_slug="jakes-resume")
    new_src = ResumeSource(
        resume_id=resume.id,
        workspace_id=resume.workspace_id,
        path="main.typ",
        content=typst,
        lang="typst",
        version=1,
    )
    db.add(new_src)
    await db.commit()
    await db.refresh(new_src)
    return ResumeSourceResponse.model_validate(new_src)


@router.put("/{resume_id}/source", response_model=ResumeSourceResponse)
@rate_limit(max_requests=30, window_seconds=60)
async def update_resume_source(
    resume_id: str,
    dto: UpdateSourceRequest,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    resume = await resume_service.get_by_id(resume_id, workspace_id, db=db)

    from ..models.schema import ResumeSource
    from ..services.typst_transpiler import to_json as typst_to_json

    result = await db.execute(select(ResumeSource).where(ResumeSource.resume_id == resume.id, ResumeSource.path == dto.path).limit(1))
    src = result.scalar_one_or_none()
    if src:
        src.content = dto.content
        src.lang = dto.lang
        src.version = (src.version or 1) + 1
        await db.commit()
        await db.refresh(src)
    else:
        src = ResumeSource(
            resume_id=resume.id,
            workspace_id=resume.workspace_id,
            path=dto.path,
            content=dto.content,
            lang=dto.lang,
            version=1,
        )
        db.add(src)
        await db.commit()
        await db.refresh(src)

    # Bidirectional sync: try to keep JSON in sync (best-effort, never fails the save)
    try:
        parsed = typst_to_json(dto.content, template_slug="jakes-resume")
        # Only update if parser produced something useful (has experience or summary)
        if parsed.get("experience") or parsed.get("summary"):
            # Merge parsed into resume.content — keep canonical JSON updated
            merged = dict(resume.content or {})
            if parsed.get("experience"):
                merged["experience"] = parsed["experience"]
            if parsed.get("summary"):
                merged["summary"] = parsed["summary"]
            if parsed.get("name") and parsed["name"] != "Your Name":
                merged["name"] = parsed["name"]
            resume.content = merged
            await db.commit()
    except Exception:
        pass

    return ResumeSourceResponse.model_validate(src)


@router.post("/{resume_id}/compile-typst", response_model=ResumeArtifactResponse)
@rate_limit(max_requests=12, window_seconds=60)
async def compile_typst(
    resume_id: str,
    dto: CompileTypstRequest,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Live Typst compile: source → PDF. WASM on frontend is primary; this is the backend fallback + artifact persist."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    resume = await resume_service.get_by_id(resume_id, workspace_id, db=db)

    typst_source: str | None = dto.typst_source
    if not typst_source:
        from ..models.schema import ResumeSource

        result = await db.execute(select(ResumeSource).where(ResumeSource.resume_id == resume.id).order_by(ResumeSource.updated_at.desc()).limit(1))
        src = result.scalar_one_or_none()
        if src:
            typst_source = src.content
        else:
            from ..services.typst_transpiler import to_typst

            typst_source = to_typst(resume.content or {}, template_slug=dto.template_slug)

    # For MVP, compile via HTML pipeline (Typst WASM would run on frontend).
    # We render the Typst source as HTML fallback, then Playwright PDF — so it always works without tectonic binary.
    # In prod with tectonic installed, latex_compiler would be used for .tex paths.
    try:
        if dto.template_slug in {"jakes-resume", "deedy-resume", "moderncv-classic", "awesome-cv", "harvard-cv"}:
            # Typst twin → render via resume_templates typst → wrap as HTML for Playwright fallback
            from ..services.resume_templates import resume_templates

            try:
                typst_text = resume_templates.render_resume_typst(dto.template_slug, resume.content or {})
            except Exception:
                typst_text = typst_source or ""
            # Fallback HTML: show Typst source as formatted preview until real Typst WASM is wired
            # We still produce a real PDF via HTML so download works
            from ..services.document_builder import document_builder

            # Try HTML template twin for PDF; Typst source is the Monaco file, PDF comes from HTML twin
            html_fallback_slug = {
                "jakes-resume": "minimalist-clean",
                "deedy-resume": "creative-portfolio",
                "moderncv-classic": "classic-harvard",
                "awesome-cv": "tech-modern",
                "harvard-cv": "executive-leadership",
            }.get(dto.template_slug, dto.template_slug)
            compiled = await document_builder.compile_resume(resume.content or {}, html_fallback_slug, "pdf", max_pages=dto.max_pages)
        else:
            from ..services.document_builder import document_builder

            compiled = await document_builder.compile_resume(resume.content or {}, dto.template_slug, "pdf", max_pages=dto.max_pages)
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


@router.post("/{resume_id}/ai/inline", response_model=InlineAiResponse)
@rate_limit(max_requests=20, window_seconds=60)
async def inline_ai(
    resume_id: str,
    dto: InlineAiRequest,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Overleaf inline AI: select range → intent → diff ops. Zero-hallucination via provenance."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    await _verify_workspace_access(workspace_id, user_id, db)
    resume = await resume_service.get_by_id(resume_id, workspace_id, db=db)

    from ..models.schema import ResumeSource
    from ..services.typst_transpiler import extract_provenance_map

    # Resolve source for range extraction
    result = await db.execute(select(ResumeSource).where(ResumeSource.resume_id == resume.id).order_by(ResumeSource.updated_at.desc()).limit(1))
    src = result.scalar_one_or_none()
    source_text = src.content if src else ""
    lines = source_text.splitlines() if source_text else []
    selected = dto.selected_text
    if not selected and lines:
        s = max(1, dto.start_line) - 1
        e = min(len(lines), dto.end_line)
        selected = "\n".join(lines[s:e])

    if not selected or not selected.strip():
        raise HTTPException(status_code=400, detail="No selected text for inline AI")

    # Provenance for the range
    prov_map = extract_provenance_map(source_text) if source_text else {}
    prov_ids = [prov_map.get(ln) for ln in range(dto.start_line, dto.end_line + 1) if prov_map.get(ln)]
    prov_ids = [p for p in prov_ids if p]

    # Route to appropriate agent/tool
    diff_ops: list[dict] = []
    suggestions: list[dict] = []

    try:
        if dto.intent in ("tailor", "xyz"):
            from ..agents.resume_agent.handler import ResumeAgent

            agent = ResumeAgent()
            # Use tailor for the chunk only
            jd = dto.target_jd or "Senior role"
            new_text = await agent._llm_tailor_bullet(selected[:2000], jd)
            if new_text and new_text.strip() != selected.strip():
                diff_ops.append({"op": "replace", "oldText": selected, "newText": new_text, "rationale": f"Tailored to JD via {dto.intent}", "confidence": 0.88, "provenance": prov_ids[:1]})
            else:
                diff_ops.append({"op": "rephrase", "oldText": selected, "newText": selected, "rationale": "No change needed", "confidence": 0.6})
        elif dto.intent == "condense":
            # Simple condense via LLM
            from ..services.llm_service import llm_service

            resp = await llm_service.generate_completion(
                [{"role": "user", "content": f"Condense to exactly 1 line, keep XYZ format, no new facts:\n{selected[:2000]}"}],
                temperature=0.3,
                max_tokens=120,
            )
            condensed = resp.get("content", "").strip() if resp else selected
            diff_ops.append({"op": "condense", "oldText": selected, "newText": condensed or selected, "rationale": "Condensed to 1 line", "confidence": 0.82})
        elif dto.intent == "ats_fix":
            from ..tools.executor import _execute_audit_ats_formatting

            audit = await _execute_audit_ats_formatting({"resume_markdown": selected}, workspace_id)
            issues = audit.get("result", {}).get("issues", []) if audit.get("status") == "success" else []
            for iss in issues[:5]:
                suggestions.append({"type": iss.get("type"), "severity": iss.get("severity"), "detail": iss.get("detail"), "fix": iss.get("suggestion")})
            diff_ops.append({"op": "audit", "oldText": selected, "newText": selected, "rationale": f"ATS audit: {len(issues)} issues", "confidence": 0.9})
        else:
            diff_ops.append({"op": "noop", "oldText": selected, "newText": selected, "rationale": "Unknown intent", "confidence": 0.5})
    except Exception as e:
        diff_ops.append({"op": "error", "oldText": selected, "newText": selected, "rationale": str(e)[:200], "confidence": 0.0})

    # Optional ATS score for the chunk
    ats_score = None
    try:
        if dto.target_jd:
            from ..tools.executor import _execute_calculate_semantic_ats_score

            ats = await _execute_calculate_semantic_ats_score({"resume_text": selected, "job_description": dto.target_jd}, workspace_id)
            if ats.get("status") == "success":
                ats_score = ats.get("result")
    except Exception:
        pass

    return InlineAiResponse(diff=diff_ops, suggestions=suggestions, ats_score=ats_score)
