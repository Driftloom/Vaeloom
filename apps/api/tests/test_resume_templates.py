"""Tests for the resume template registry (5 industry templates)."""
import pytest

from api.services.resume_templates import (
    ResumeTemplateRegistry,
    normalize_resume_content,
    resume_templates,
)

pytestmark = pytest.mark.asyncio

SAMPLE_CONTENT = {
    "name": "Jane Doe",
    "title": "Senior Backend Engineer",
    "email": "jane@example.com",
    "phone": "+1 555 0100",
    "location": "Berlin",
    "links": {"github": "github.com/jane", "linkedin": None},
    "summary": "Engineer with 8 years of experience.",
    "experience": [
        {
            "role": "Senior Engineer",
            "company": "Acme",
            "location": "Berlin",
            "start": "Jan 2021",
            "bullets": ["Cut latency by X via Y, resulting in Z"],
        }
    ],
    "education": [{"degree": "BSc CS", "institution": "TU Berlin", "start": "2012", "end": "2015"}],
    "skills": [
        {"category": "Languages", "items": ["Python", {"name": "Go", "level": 85}]},
        "Docker",
    ],
    "projects": [{"name": "OSS Tool", "description": "A tool.", "link": "github.com/jane/tool"}],
    "certifications": ["AWS SA"],
}


class TestTemplateRegistry:
    def test_exactly_five_templates(self):
        templates = resume_templates.list_templates()
        # Overleaf twins added (ADR-034 + Overleaf Studio): 5 HTML + 5 Typst = 10
        assert len(templates) == 10

    def test_expected_slugs(self):
        slugs = {t.slug for t in resume_templates.list_templates()}
        assert slugs == {
            "classic-harvard",
            "tech-modern",
            "executive-leadership",
            "minimalist-clean",
            "creative-portfolio",
            "jakes-resume",
            "deedy-resume",
            "moderncv-classic",
            "awesome-cv",
            "harvard-cv",
        }

    def test_all_metadata_complete(self):
        for t in resume_templates.list_templates():
            assert t.name and t.category and t.description
            assert t.best_for, f"{t.slug} missing best_for"
            assert 0 < t.ats_compatibility <= 100

    def test_get_template_found(self):
        tpl = ResumeTemplateRegistry.get_template("tech-modern")
        assert tpl is not None
        assert tpl.category == "Tech / Silicon Valley"

    def test_get_template_unknown_returns_none(self):
        assert ResumeTemplateRegistry.get_template("nope") is None

    @pytest.mark.parametrize(
        "role,expected",
        [
            ("VP of Engineering", "executive-leadership"),
            ("UX designer", "creative-portfolio"),
            ("senior software engineer", "tech-modern"),
            ("DevOps engineer", "tech-modern"),
            ("financial analyst", "classic-harvard"),
            ("consulting analyst", "classic-harvard"),
            ("engineering manager", "executive-leadership"),
            ("product manager", "minimalist-clean"),
            ("data analyst", "minimalist-clean"),
        ],
    )
    def test_suggest_template_heuristics(self, role, expected):
        assert ResumeTemplateRegistry.suggest_template(target_role=role) == expected

    def test_suggest_template_default(self):
        assert ResumeTemplateRegistry.suggest_template() == "minimalist-clean"


class TestRendering:
    @pytest.mark.parametrize(
        "slug",
        [
            "classic-harvard",
            "tech-modern",
            "executive-leadership",
            "minimalist-clean",
            "creative-portfolio",
        ],
    )
    async def test_render_resume_html_all_templates(self, slug):
        html = resume_templates.render_resume_html(slug, SAMPLE_CONTENT)
        assert "Jane Doe" in html
        assert "Acme" in html
        assert len(html) > 2000

    @pytest.mark.parametrize(
        "slug",
        ["jakes-resume", "deedy-resume", "moderncv-classic", "awesome-cv", "harvard-cv"],
    )
    async def test_render_resume_typst_all_templates(self, slug):
        typst = resume_templates.render_resume_typst(slug, SAMPLE_CONTENT)
        # Some twins split or upper-case the name (awesome-cv: "Jane" + " Doe", harvard: "JANE DOE")
        assert "Jane" in typst or "JANE" in typst
        assert "Doe" in typst or "DOE" in typst
        assert "Acme" in typst
        assert len(typst) > 500

    async def test_render_escapes_html_injection(self):
        malicious = dict(SAMPLE_CONTENT)
        malicious["name"] = '<script>alert(1)</script>'
        html = resume_templates.render_resume_html("tech-modern", malicious)
        assert "<script>alert" not in html
        assert "&lt;script&gt;" in html

    async def test_render_unknown_template_raises(self):
        with pytest.raises(ValueError, match="Unknown resume template"):
            resume_templates.render_resume_html("nope", SAMPLE_CONTENT)

    async def test_render_cover_letter(self):
        html = resume_templates.render_cover_letter_html(
            "classic-harvard", SAMPLE_CONTENT, "Para one.\n\nPara two.",
            company="Stripe", role="Backend Eng",
        )
        assert "Hiring Team at Stripe" in html
        assert "Para one." in html

    async def test_render_cheatsheet(self):
        content = {
            **SAMPLE_CONTENT,
            "star_stories": [{"situation": "s", "task": "t", "action": "a", "result": "r"}],
            "company_intel": {"company": "Stripe", "funding": "IPO"},
            "questions_to_ask": ["What does success look like?"],
        }
        html = resume_templates.render_cheatsheet_html(content)
        assert "Interview Cheat-Sheet" in html and "STAR Stories" in html


class TestNormalizeResumeContent:
    def test_full_content_passes_through(self):
        d = normalize_resume_content(SAMPLE_CONTENT)
        assert d["name"] == "Jane Doe"
        assert d["experience"][0]["bullets"] == ["Cut latency by X via Y, resulting in Z"]
        assert d["skills"][0]["category"] == "Languages"
        assert len(d["skills"][0]["items"]) == 2

    def test_string_skills_wrapped(self):
        d = normalize_resume_content({"skills": ["Docker", "K8s"]})
        assert d["skills"][0]["items"] == [{"name": "Docker", "level": None}]

    def test_agent_section_output_shape(self):
        """ResumeAgent returns sections as [{text, source_document_id}] dicts."""
        content = {
            "experience": [
                {"role": "R", "company": "C", "achievements": [{"text": "did x", "is_inferred": False}]}
            ]
        }
        d = normalize_resume_content(content)
        assert d["experience"][0]["bullets"] == ["did x"]

    def test_empty_and_none_safe(self):
        d = normalize_resume_content(None)
        assert d["name"] == "Your Name"
        assert d["experience"] == []
        assert d["education"] == []

    def test_legacy_keys_mapped(self):
        d = normalize_resume_content({
            "headline": "CTO",
            "website": "j.dev",
            "professional_summary": "Sum",
            "experience": [{"title": "Eng", "employer": "Co", "start_date": "2020", "current": True}],
        })
        assert d["title"] == "CTO"
        assert d["links"]["portfolio"] == "j.dev"
        assert d["summary"] == "Sum"
        assert d["experience"][0]["role"] == "Eng"
        assert d["experience"][0]["end"] == "Present"
