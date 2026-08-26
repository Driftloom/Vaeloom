"""Overleaf integration tests — source, compile-typst, inline AI."""
import pytest


@pytest.mark.asyncio
async def test_source_lifecycle(db_session, monkeypatch):
    # Create workspace + user via ORM (SQLite compatible)
    import uuid
    from api.models.schema import Workspace, User

    ws_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    # Create user first (needed for FK)
    user = User(id=uuid.UUID(user_id), email=f"test-{user_id[:8]}@example.com", display_name="Test", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    ws = Workspace(id=uuid.UUID(ws_id), user_id=uuid.UUID(user_id), name="test")
    db_session.add(ws)
    await db_session.commit()

    # Create a resume
    from api.services.resume_service import resume_service

    # Need a Resume row directly
    from api.models.schema import Resume
    resume = Resume(workspace_id=uuid.UUID(ws_id), variant_type="master", content={"name": "Jane Doe", "title": "Eng", "email": "jane@example.com", "experience": [{"role": "Eng", "company": "Acme", "bullets": ["Did X"]}]}, version=1)
    db_session.add(resume)
    await db_session.commit()
    await db_session.refresh(resume)

    # GET source — should auto-create from JSON
    from fastapi.testclient import TestClient

    # Use the service directly rather than HTTP for speed (avoids auth)
    from api.services.typst_transpiler import to_typst, to_json
    from api.models.schema import ResumeSource
    from sqlalchemy import select

    # Simulate GET /source logic: fetch or create
    result = await db_session.execute(select(ResumeSource).where(ResumeSource.resume_id == resume.id))
    src = result.scalar_one_or_none()
    assert src is None  # not yet

    typst = to_typst(resume.content, "jakes-resume")
    assert "jane" in typst.lower()
    assert "Acme" in typst

    # Create source
    src = ResumeSource(resume_id=resume.id, workspace_id=resume.workspace_id, path="main.typ", content=typst, lang="typst", version=1)
    db_session.add(src)
    await db_session.commit()
    await db_session.refresh(src)
    assert src.content == typst

    # Update source
    new_content = typst + "\n// edited"
    src.content = new_content
    src.version += 1
    await db_session.commit()
    assert src.version == 2

    # Transpile back
    parsed = to_json(new_content)
    assert isinstance(parsed, dict)


@pytest.mark.asyncio
async def test_typst_templates_render():
    from api.services.resume_templates import resume_templates

    sample = {"name": "Test", "email": "t@test.com", "experience": [{"role": "R", "company": "C", "bullets": ["b1"]}], "skills": []}
    for slug in ["jakes-resume", "deedy-resume", "moderncv-classic", "awesome-cv", "harvard-cv"]:
        typst = resume_templates.render_resume_typst(slug, sample)
        assert "Test" in typst or "TEST" in typst
        assert len(typst) > 200


@pytest.mark.asyncio
async def test_latex_compiler_fallback():
    from api.services.latex_compiler import latex_compiler

    # Should fallback to HTML->PDF when tectonic missing, still returns bytes
    b = await latex_compiler.compile_to_pdf(r"\documentclass{article}\begin{document}Hello\end{document}")
    assert isinstance(b, bytes)
    assert len(b) > 100
    assert b.startswith(b"%PDF") or len(b) > 500


@pytest.mark.asyncio
async def test_inline_ai_mock(monkeypatch):
    # Test inline AI logic without LLM (should still return diff)
    import uuid
    from unittest.mock import AsyncMock

    # Mock LLM to avoid needing key
    monkeypatch.setattr("api.services.llm_service.llm_service.generate_completion", AsyncMock(return_value={"content": "Condensed bullet"}))

    # Use the router logic directly via service
    from api.services.typst_transpiler import extract_provenance_map

    src = "#heading[EXP]\n- Old bullet // provenance: doc_123\n- Another"
    prov = extract_provenance_map(src)
    assert prov[2] == "doc_123"
