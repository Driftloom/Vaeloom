"""Tests for the document builder engine (HTML/DOCX/markdown paths + PDF fit loop mocked)."""
import pytest

from api.services.document_builder import (
    DocumentBuilderError,
    PlaywrightUnavailableError,
    document_builder,
    safe_filename,
)
from api.services.resume_templates import resume_templates

pytestmark = pytest.mark.asyncio

SAMPLE = {
    "name": "Jane Doe",
    "title": "Senior Backend Engineer",
    "email": "jane@example.com",
    "summary": "Engineer.",
    "experience": [
        {"role": "Senior Engineer", "company": "Acme", "start": "Jan 2021", "bullets": ["Did X via Y"]}
    ],
    "education": [{"degree": "BSc CS", "institution": "TU Berlin"}],
    "skills": [{"category": "Languages", "items": ["Python"]}],
    "projects": [{"name": "Tool", "description": "D", "highlights": ["a"]}],
    "certifications": ["AWS SA"],
}


class TestHtmlCompile:
    async def test_compile_html_returns_html(self):
        d = await document_builder.compile_resume(SAMPLE, "tech-modern", fmt="html")
        assert d.media_type == "text/html"
        assert d.extension == "html"
        assert b"Jane Doe" in d.data


class TestDocxCompile:
    async def test_docx_is_valid_zip_container(self):
        d = await document_builder.compile_resume(SAMPLE, "classic-harvard", fmt="docx")
        assert d.extension == "docx"
        assert d.data[:2] == b"PK"  # OOXML zip magic
        assert len(d.data) > 5000

    async def test_cover_letter_docx(self):
        d = await document_builder.compile_cover_letter(
            SAMPLE, body="Hello.\n\nSecond para.", template_slug="minimalist-clean", fmt="docx"
        )
        assert d.data[:2] == b"PK"

    async def test_docx_content_sections_present(self):
        from io import BytesIO

        from docx import Document

        d = await document_builder.compile_resume(SAMPLE, "classic-harvard", fmt="docx")
        doc = Document(BytesIO(d.data))
        text = "\n".join(p.text for p in doc.paragraphs)
        for expected in ("JANE DOE", "Professional Experience", "Senior Engineer", "Skills"):
            assert expected in text


class TestPortfolioMarkdown:
    def test_markdown_structure(self):
        md = document_builder.export_portfolio_markdown(SAMPLE)
        assert md.startswith("# Jane Doe")
        assert "**Senior Backend Engineer**" in md
        assert "## Projects" in md
        assert "### Tool" in md
        assert "- a" in md
        assert "**Languages:** Python" in md
        assert "### Senior Engineer @ Acme" in md

    def test_markdown_minimal_content(self):
        md = document_builder.export_portfolio_markdown({"name": "Solo"})
        assert md.startswith("# Solo")


class TestPdfFitLoop:
    async def test_pdf_fit_loop_shrinks_until_within_target(self, monkeypatch):
        """Simulate chromium returning 3 pages at scale 1.0 and 2 pages after first shrink."""
        from api.services.document_builder import _pw_manager

        scales_seen: list[float] = []

        async def fake_render(html: str) -> bytes:
            # _with_scale is mocked to append "#<scale>"; echo the marker back
            return html.split("#")[-1].encode()

        async def fake_count(pdf_bytes: bytes) -> int:
            scale = float(pdf_bytes.decode())
            scales_seen.append(scale)
            return 3 if scale >= 0.99 else 2

        monkeypatch.setattr(
            document_builder, "_with_scale", staticmethod(lambda html, s: f"{html}#{s}")
        )
        monkeypatch.setattr(_pw_manager, "render_pdf", fake_render)
        monkeypatch.setattr(_pw_manager, "count_pdf_pages", fake_count)

        d = await document_builder.compile_resume(SAMPLE, "tech-modern", fmt="pdf", max_pages=2)
        assert d.extension == "pdf"
        assert len(scales_seen) == 2  # initial render + one shrink pass
        assert scales_seen[1] < scales_seen[0]
        assert d.data == b"0.9"

    async def test_unknown_template_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown resume template"):
            await document_builder.compile_resume(SAMPLE, "bogus-slug", fmt="html")

    async def test_unsupported_format_raises(self):
        with pytest.raises(ValueError, match="Unsupported format"):
            await document_builder.compile_resume(SAMPLE, "tech-modern", fmt="rtf")


class TestPlaywrightUnavailable:
    async def test_manager_raises_playwright_unavailable_after_flag(self, monkeypatch):
        from api.services.document_builder import _pw_manager

        monkeypatch.setattr(_pw_manager, "_unavailable", True)
        with pytest.raises(PlaywrightUnavailableError, match="playwright install"):
            await _pw_manager.render_pdf("<html></html>")


class TestHelpers:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("Tailored resume: Q3/2026!", "Tailored-resume-Q3-2026"),
            ("", "document"),
            ("   ", "document"),
            ("master-resume", "master-resume"),
        ],
    )
    def test_safe_filename(self, raw, expected):
        assert safe_filename(raw) == expected

    def test_with_scale_injects_css(self):
        html = "<html><head><title>t</title></head><body>x</body></html>"
        scaled = document_builder._with_scale(html, 0.8)
        assert "</head>" in scaled
        assert "font-size: 8.4pt" in scaled

    async def test_document_builder_error_hierarchy(self):
        assert issubclass(PlaywrightUnavailableError, DocumentBuilderError)


class TestCoverLetterAndCheatsheetHtml:
    async def test_cover_letter_html(self):
        d = await document_builder.compile_cover_letter(
            SAMPLE, body="I want to join.\n\nSecond.", template_slug="executive-leadership", fmt="html"
        )
        assert b"I want to join." in d.data

    async def test_cheatsheet_html_contains_star(self):
        content = {**SAMPLE, "star_stories": [{"situation": "s", "task": "t", "action": "a", "result": "r"}]}
        html = resume_templates.render_cheatsheet_html(content)
        assert "Situation:" in html
