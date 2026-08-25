"""Integration tests for resume templates, tailor, compile, artifacts endpoints."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


class TestResumeDocumentRoutes:
    """signup → create workspace → seed master resume → exercise new endpoints."""

    async def _setup(self, client: AsyncClient, db_session: AsyncSession):
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": f"doc-user-{uuid.uuid4().hex[:8]}@test.com", "password": "DocTest1234!"},
        )
        assert res.status_code == 201
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/workspaces",
            json={"name": "DocTest Workspace"},
            headers=headers,
        )
        assert res.status_code == 201, res.text
        workspace_id = res.json()["id"]

        from api.models.schema import Resume

        resume = Resume(
            id=uuid.uuid4(),
            workspace_id=uuid.UUID(workspace_id),
            variant_type="master",
            content={
                "name": "Jane Doe",
                "title": "Senior Backend Engineer",
                "email": "jane@example.com",
                "experience": [
                    {"role": "Senior Engineer", "company": "Acme", "start": "Jan 2021",
                     "bullets": ["Cut latency by X via Y"]}
                ],
                "skills": [{"category": "Languages", "items": ["Python"]}],
            },
            version=1,
        )
        db_session.add(resume)
        await db_session.commit()
        return headers, workspace_id, resume.id

    @staticmethod
    def _mock_compile(monkeypatch, ext="pdf", media="application/pdf"):
        from api.services.document_builder import CompiledDocument, document_builder

        async def fake_compile(content, slug, fmt="pdf", max_pages=2):
            return CompiledDocument(b"%PDF-mock-bytes", media, fmt)

        monkeypatch.setattr(document_builder, "compile_resume", fake_compile)

        async def fake_cover(content, body, template_slug, recipient=None,
                            company=None, role=None, fmt="pdf"):
            return CompiledDocument(b"%PDF-cover-mock", media, ext)

        monkeypatch.setattr(document_builder, "compile_cover_letter", fake_cover)

        async def fake_cheat(content):
            return CompiledDocument(b"%PDF-cheatsheet-mock", media, ext)

        monkeypatch.setattr(document_builder, "compile_cheatsheet", fake_cheat)
        return document_builder

    # ── Templates ─────────────────────────────────────────────────────

    async def test_list_templates_returns_five(self, client, auth_headers):
        res = await client.get("/api/v1/resumes/templates", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 5
        slugs = {t["slug"] for t in data}
        assert "classic-harvard" in slugs and "tech-modern" in slugs
        for t in data:
            assert {"slug", "name", "category", "best_for", "ats_compatibility"} <= set(t.keys())

    async def test_list_templates_requires_auth(self, client):
        res = await client.get("/api/v1/resumes/templates")
        assert res.status_code == 401

    # ── Tailor ────────────────────────────────────────────────────────

    async def test_tailor_creates_variant(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        headers, workspace_id, resume_id = await self._setup(client, db_session)
        self._mock_compile(monkeypatch)

        from api.agents.resume_agent.handler import ResumeAgent

        async def fake_tailor(self, content, target_jd):
            tailored = dict(content)
            tailored.setdefault("experience", [{}])[0]["bullets"] = ["Tailored bullet"]
            return tailored, {"bullets_rewritten": 1}

        monkeypatch.setattr(ResumeAgent, "tailor_content", fake_tailor)

        res = await client.post(
            f"/api/v1/resumes/{resume_id}/tailor?workspace_id={workspace_id}",
            json={"job_description": "Backend engineer at Stripe", "target_role": "Senior Engineer"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["variant_type"] == "tailored"
        assert data["version"] == 2
        assert data["content"]["experience"][0]["bullets"] == ["Tailored bullet"]

    async def test_tailor_requires_job_description(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        headers, workspace_id, resume_id = await self._setup(client, db_session)
        res = await client.post(
            f"/api/v1/resumes/{resume_id}/tailor?workspace_id={workspace_id}",
            json={"job_description": ""},
            headers=headers,
        )
        assert res.status_code == 422

    async def test_tailor_rejects_foreign_workspace_resume(
        self, client: AsyncClient, auth_headers: dict, secondary_auth_headers: dict,
        db_session: AsyncSession,
    ):
        headers, workspace_id, resume_id = await self._setup(client, db_session)
        # second user creates own workspace; tries tailoring first user's resume
        res = await client.post(
            "/api/v1/workspaces", json={"name": "Other WS"}, headers=secondary_auth_headers
        )
        other_ws = res.json()["id"]
        res = await client.post(
            f"/api/v1/resumes/{resume_id}/tailor?workspace_id={other_ws}",
            json={"job_description": "x"},
            headers=secondary_auth_headers,
        )
        assert res.status_code == 403

    # ── Compile ───────────────────────────────────────────────────────

    async def test_compile_pdf_creates_artifact(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        self._mock_compile(monkeypatch)
        headers, workspace_id, resume_id = await self._setup(client, db_session)

        res = await client.post(
            f"/api/v1/resumes/{resume_id}/compile?workspace_id={workspace_id}",
            json={"template_slug": "tech-modern", "format": "pdf"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        artifact = res.json()
        assert artifact["artifact_kind"] == "resume"
        assert artifact["template_slug"] == "tech-modern"
        assert artifact["format"] == "pdf"
        assert artifact["file_size"] > 0
        assert artifact["filename"].endswith(".pdf")

    async def test_compile_unknown_template_400(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        headers, workspace_id, resume_id = await self._setup(client, db_session)
        res = await client.post(
            f"/api/v1/resumes/{resume_id}/compile?workspace_id={workspace_id}",
            json={"template_slug": "does-not-exist", "format": "html"},
            headers=headers,
        )
        assert res.status_code == 400

    async def test_compile_invalid_format_422(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession
    ):
        headers, workspace_id, resume_id = await self._setup(client, db_session)
        res = await client.post(
            f"/api/v1/resumes/{resume_id}/compile?workspace_id={workspace_id}",
            json={"template_slug": "tech-modern", "format": "rtf"},
            headers=headers,
        )
        assert res.status_code == 422

    async def test_compile_playwright_unavailable_503(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        from api.services.document_builder import PlaywrightUnavailableError
        from api.services.document_builder import document_builder as real_builder

        async def unavailable(*a, **k):
            raise PlaywrightUnavailableError("run playwright install chromium")

        monkeypatch.setattr(real_builder, "compile_resume", unavailable)
        headers, workspace_id, resume_id = await self._setup(client, db_session)

        res = await client.post(
            f"/api/v1/resumes/{resume_id}/compile?workspace_id={workspace_id}",
            json={"template_slug": "tech-modern", "format": "pdf"},
            headers=headers,
        )
        assert res.status_code == 503
        assert "playwright install" in res.json()["error"]["message"]

    # ── Cover letter & cheatsheet & download ─────────────────────────

    async def test_cover_letter_artifact_and_download_roundtrip(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        self._mock_compile(monkeypatch)
        headers, workspace_id, resume_id = await self._setup(client, db_session)

        res = await client.post(
            f"/api/v1/resumes/{resume_id}/cover-letter?workspace_id={workspace_id}",
            json={
                "body": "I am excited to apply.\n\nSecond paragraph.",
                "template_slug": "classic-harvard",
                "format": "pdf",
                "company": "Stripe",
                "role": "Backend Engineer",
            },
            headers=headers,
        )
        assert res.status_code == 200, res.text
        artifact = res.json()
        assert artifact["artifact_kind"] == "cover_letter"

        dl = await client.get(
            f"/api/v1/resumes/artifacts/{artifact['id']}/download?workspace_id={workspace_id}",
            headers=headers,
        )
        assert dl.status_code == 200
        assert dl.content.startswith(b"%PDF-")
        assert "attachment" in dl.headers["content-disposition"]

    async def test_cheatsheet_endpoint(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        self._mock_compile(monkeypatch)
        headers, workspace_id, resume_id = await self._setup(client, db_session)

        res = await client.post(
            f"/api/v1/resumes/{resume_id}/cheatsheet?workspace_id={workspace_id}",
            headers=headers,
        )
        assert res.status_code == 200
        assert res.json()["artifact_kind"] == "cheatsheet"

    async def test_list_artifacts(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession, monkeypatch
    ):
        self._mock_compile(monkeypatch)
        headers, workspace_id, resume_id = await self._setup(client, db_session)

        await client.post(
            f"/api/v1/resumes/{resume_id}/compile?workspace_id={workspace_id}",
            json={"template_slug": "tech-modern"},
            headers=headers,
        )
        await client.post(
            f"/api/v1/resumes/{resume_id}/compile?workspace_id={workspace_id}",
            json={"template_slug": "minimalist-clean", "format": "docx"},
            headers=headers,
        )

        res = await client.get(
            f"/api/v1/resumes/{resume_id}/artifacts?workspace_id={workspace_id}",
            headers=headers,
        )
        assert res.status_code == 200
        arts = res.json()
        assert len(arts) == 2
        formats = {a["format"] for a in arts}
        assert formats == {"pdf", "docx"}

    async def test_download_requires_workspace_membership(
        self, client: AsyncClient, auth_headers: dict, secondary_auth_headers: dict,
        db_session: AsyncSession, monkeypatch,
    ):
        self._mock_compile(monkeypatch)
        headers, workspace_id, resume_id = await self._setup(client, db_session)

        res = await client.post(
            f"/api/v1/resumes/{resume_id}/compile?workspace_id={workspace_id}",
            json={"template_slug": "tech-modern"},
            headers=headers,
        )
        artifact_id = res.json()["id"]

        res = await client.post(
            "/api/v1/workspaces", json={"name": "Intruder WS"}, headers=secondary_auth_headers
        )
        other_ws = res.json()["id"]

        dl = await client.get(
            f"/api/v1/resumes/artifacts/{artifact_id}/download?workspace_id={other_ws}",
            headers=secondary_auth_headers,
        )
        assert dl.status_code == 404
