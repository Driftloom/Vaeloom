"""
Resume template registry — industry-standard templates agents can select
autonomously or the user can pick explicitly.

Each template is a self-contained Jinja2 document rendered to:
- HTML live preview (iframe in web UI) — 5 classic HTML templates
- Typst live preview (WASM 50ms) — 5 Overleaf-grade Typst twins (Jake's, Deedy, ModernCV, Awesome-CV, Harvard)
- PDF via Playwright Chromium (services/document_builder.py) or Typst WASM / Tectonic fallback
- matching DOCX structure (python-docx)

HTML templates: classic-harvard, tech-modern, minimalist-clean, executive-leadership, creative-portfolio
Typst twins:    jakes-resume, deedy-resume, moderncv-classic, awesome-cv, harvard-cv

Normalized resume data contract (see normalize_resume_content):
    name/email/phone/location/links/summary
    experience: [{role, company, location, start, end, bullets[]}]
    education:  [{degree, institution, start, end, details}]
    skills:     [{category, items[]}]
    projects:   [{name, description, link, highlights[]}]
    certifications: [str]
"""
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel, Field

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


class ResumeTemplate(BaseModel):
    slug: str
    name: str
    category: str
    description: str
    best_for: list[str] = Field(default_factory=list)
    ats_compatibility: int = 100
    accent_color: str = "#111111"
    font_stack: str = "Georgia, 'Times New Roman', serif"
    layout: str = "single-column"


class ResumeTemplateRegistry:
    def __init__(self) -> None:
        self._env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=select_autoescape(["html", "j2"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    # ── Registry ──────────────────────────────────────────────────────
    @staticmethod
    def list_templates() -> list[ResumeTemplate]:
        return [
            ResumeTemplate(
                slug="classic-harvard",
                name="Classic Harvard",
                category="Traditional / Corporate",
                description="Timeless black-and-white layout with top rule lines and centered header.",
                best_for=["Finance", "Consulting", "Law", "Government", "Academia"],
                ats_compatibility=100,
                accent_color="#1a1a1a",
                font_stack="Garamond, Georgia, 'Times New Roman', serif",
            ),
            ResumeTemplate(
                slug="tech-modern",
                name="Tech Modern",
                category="Tech / Silicon Valley",
                description="Clean technical layout with categorized skill badges and profile links.",
                best_for=["Software Engineering", "Cloud / DevOps", "Data Science"],
                ats_compatibility=98,
                accent_color="#2563eb",
                font_stack="'Inter', Roboto, 'Segoe UI', Arial, sans-serif",
            ),
            ResumeTemplate(
                slug="executive-leadership",
                name="Executive Leadership",
                category="Leadership / C-Suite",
                description="Subtle navy accents with a leadership summary highlight box.",
                best_for=["VP", "Director", "Engineering Manager", "Founder"],
                ats_compatibility=95,
                accent_color="#1e3a5f",
                font_stack="Merriweather, Georgia, serif",
            ),
            ResumeTemplate(
                slug="minimalist-clean",
                name="Minimalist Clean",
                category="Modern Minimal",
                description="High whitespace, thin dividers, sleek bullet hierarchy.",
                best_for=["Product Management", "Startup Roles", "Strategy", "Data Analysis"],
                ats_compatibility=99,
                accent_color="#0f766e",
                font_stack="'Helvetica Neue', Helvetica, Arial, sans-serif",
            ),
            ResumeTemplate(
                slug="creative-portfolio",
                name="Creative Portfolio",
                category="Creative / Design",
                description="Two-column layout with sidebar for competencies and project links.",
                best_for=["UI/UX Design", "Frontend Development", "Brand Strategy", "Marketing"],
                ats_compatibility=90,
                accent_color="#7c3aed",
                font_stack="'DM Sans', 'Outfit', 'Segoe UI', sans-serif",
                layout="two-column",
            ),
            # — Overleaf-grade Typst twins (WASM live, 50ms) —
            ResumeTemplate(
                slug="jakes-resume",
                name="Jake's Resume",
                category="Overleaf Classic — Single Column",
                description="Gold-standard single-column with horizontal rules and bullet hierarchy. Most forked resume on Overleaf.",
                best_for=["Software Engineering", "DevOps", "Product Management", "Data Science"],
                ats_compatibility=100,
                accent_color="#0f172a",
                font_stack="Linux Libertine, Georgia, serif",
                layout="single-column",
            ),
            ResumeTemplate(
                slug="deedy-resume",
                name="Deedy Resume",
                category="Overleaf Two-Column",
                description="High-density two-column: sidebar skills/coursework, main experience. For research & CS students.",
                best_for=["Research", "CS Students", "Multi-Disciplinary", "Academia"],
                ats_compatibility=96,
                accent_color="#2563eb",
                font_stack="Helvetica, Arial, sans-serif",
                layout="two-column",
            ),
            ResumeTemplate(
                slug="moderncv-classic",
                name="ModernCV Classic",
                category="Overleaf Corporate — Banking",
                description="Elegant tabular alignment with subtle accent bars. Corporate & finance ready.",
                best_for=["Finance", "Consulting", "Corporate", "Management"],
                ats_compatibility=99,
                accent_color="#0f766e",
                font_stack="Source Sans Pro, Helvetica, sans-serif",
                layout="single-column",
            ),
            ResumeTemplate(
                slug="awesome-cv",
                name="Awesome-CV",
                category="Overleaf Modern — Color Accent",
                description="Modern typography with FontAwesome icons and Emerald/Ruby/Slate accents.",
                best_for=["Senior Engineers", "Tech Leads", "Modern Startups", "Design"],
                ats_compatibility=95,
                accent_color="#7c3aed",
                font_stack="Roboto, Inter, sans-serif",
                layout="single-column",
            ),
            ResumeTemplate(
                slug="harvard-cv",
                name="Harvard CV",
                category="Overleaf Academic — Serif",
                description="Classic serif, conservative single-spaced academic formatting.",
                best_for=["Law", "Academia", "Government", "Executive"],
                ats_compatibility=100,
                accent_color="#1a1a1a",
                font_stack="Garamond, Georgia, serif",
                layout="single-column",
            ),
        ]

    @classmethod
    def get_template(cls, slug: str) -> ResumeTemplate | None:
        return next((t for t in cls.list_templates() if t.slug == slug), None)

    @classmethod
    def suggest_template(cls, target_role: str = "", industry: str = "") -> str:
        """Autonomous template selection heuristic used by ResumeAgent."""
        text = f"{target_role} {industry}".lower()
        leadership = ["vp ", "vice president", "director", "head of", "chief", "cto", "ceo",
                      "coo", "founder", "engineering manager", "general manager"]
        creative = ["design", "ux", "ui ", "brand", "marketing", "creative", "art director"]
        tech = ["engineer", "developer", "devops", "data scien", "software", "cloud", "sre", "architect"]
        finance = ["financ", "banking", "consult", "legal", "attorney", "law", "account", "auditor", "professor", "research"]
        if any(k in text for k in leadership):
            return "executive-leadership"
        if any(k in text for k in creative):
            return "creative-portfolio"
        if any(k in text for k in tech):
            return "tech-modern"
        if any(k in text for k in finance):
            return "classic-harvard"
        return "minimalist-clean"

    # ── Rendering ─────────────────────────────────────────────────────
    def render_resume_html(self, slug: str, content: dict) -> str:
        tpl = self.get_template(slug)
        if tpl is None:
            raise ValueError(f"Unknown resume template: {slug}")
        data = normalize_resume_content(content)
        # HTML templates have .html.j2, Typst twins have .typ.j2 — route accordingly
        ext = "typ.j2" if slug in {"jakes-resume", "deedy-resume", "moderncv-classic", "awesome-cv", "harvard-cv"} and (TEMPLATES_DIR / f"resumes/{slug}.typ.j2").exists() else "html.j2"
        # Use same env; Typst is not HTML so disable autoescape for .typ
        jinja = self._env.get_template(f"resumes/{slug}.{ext}")
        return jinja.render(**data, template=tpl.model_dump())

    def render_resume_typst(self, slug: str, content: dict) -> str:
        """Render Typst source (for WASM live or Tectonic fallback). Never HTML-escapes."""
        tpl = self.get_template(slug)
        if tpl is None:
            raise ValueError(f"Unknown resume template: {slug}")
        data = normalize_resume_content(content)
        # Typst templates are .typ.j2 — use a non-autoescaping env to preserve Typst syntax
        typ_env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        # Fallback to HTML template if Typst twin missing (graceful)
        typ_path = f"resumes/{slug}.typ.j2"
        html_path = f"resumes/{slug}.html.j2"
        chosen = typ_path if (TEMPLATES_DIR / typ_path).exists() else html_path
        jinja = typ_env.get_template(chosen)
        return jinja.render(**data, template=tpl.model_dump())

    def render_cover_letter_html(self, slug: str, content: dict, body: str,
                                 recipient: str | None = None,
                                 company: str | None = None,
                                 role: str | None = None) -> str:
        tpl = self.get_template(slug)
        if tpl is None:
            raise ValueError(f"Unknown resume template: {slug}")
        data = normalize_resume_content(content)
        paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
        jinja = self._env.get_template("resumes/_cover_letter.html.j2")
        return jinja.render(**data, paragraphs=paragraphs, recipient=recipient,
                            company=company, role=role, template=tpl.model_dump())

    def render_cheatsheet_html(self, content: dict) -> str:
        """One-page interview cheat-sheet: company intel, STAR stories, questions to ask."""
        jinja = self._env.get_template("resumes/_cheatsheet.html.j2")
        return jinja.render(**normalize_resume_content(content))


resume_templates = ResumeTemplateRegistry()


def normalize_resume_content(content: dict) -> dict:
    """Coerce free-form resumes.content JSON (or agent section output) into the
    canonical rendering contract. Never raises — fills gaps with empty values."""
    c = dict(content or {})
    links_in = c.get("links") or {}
    links = {
        "linkedin": links_in.get("linkedin") or c.get("linkedin"),
        "github": links_in.get("github") or c.get("github"),
        "portfolio": links_in.get("portfolio") or c.get("portfolio") or c.get("website"),
    }

    skills_in = c.get("skills") or []
    skill_groups: list[dict] = []
    if isinstance(skills_in, list):
        for s in skills_in:
            if isinstance(s, dict):
                items = s.get("items") or ([s.get("name")] if s.get("name") else [])
                level = s.get("level")
                entry_items = [{"name": str(i), "level": level} if isinstance(i, str) else i for i in items]
                skill_groups.append({"category": s.get("category") or s.get("name") or "Skills",
                                     "items": entry_items})
            elif isinstance(s, str):
                skill_groups.append({"category": "Skills", "items": [{"name": s, "level": None}]})

    experience: list[dict] = []
    for e in c.get("experience") or []:
        if isinstance(e, dict):
            bullets = [
                b.get("text") if isinstance(b, dict) and b.get("text") else (b if isinstance(b, str) else "")
                for b in (e.get("bullets") or e.get("achievements") or [])
            ]
            experience.append({
                "role": e.get("role") or e.get("title") or "",
                "company": e.get("company") or e.get("employer") or "",
                "location": e.get("location") or "",
                "start": e.get("start") or e.get("start_date") or "",
                "end": e.get("end") or e.get("end_date") or ("Present" if e.get("current") else ""),
                "bullets": [b for b in bullets if b],
            })

    education: list[dict] = []
    for e in c.get("education") or []:
        if isinstance(e, dict):
            education.append({
                "degree": e.get("degree") or e.get("text") or "",
                "institution": e.get("institution") or e.get("school") or "",
                "start": e.get("start") or "",
                "end": e.get("end") or "",
                "details": e.get("details") or e.get("field") or "",
            })
        elif isinstance(e, str):
            education.append({"degree": e, "institution": "", "start": "", "end": "", "details": ""})

    projects: list[dict] = []
    for p in c.get("projects") or []:
        if isinstance(p, dict):
            projects.append({
                "name": p.get("name") or "",
                "description": p.get("description") or "",
                "link": p.get("link") or p.get("url") or "",
                "highlights": [h for h in (p.get("highlights") or []) if h],
            })

    certifications = [
        (cert if isinstance(cert, str) else cert.get("name", ""))
        for cert in (c.get("certifications") or [])
        if cert
    ]

    return {
        "name": c.get("name") or "Your Name",
        "title": c.get("title") or c.get("headline") or "",
        "email": c.get("email") or "",
        "phone": c.get("phone") or "",
        "location": c.get("location") or "",
        "links": links,
        "summary": c.get("summary") or c.get("professional_summary") or "",
        "experience": experience,
        "education": education,
        "skills": skill_groups,
        "projects": projects,
        "certifications": certifications,
        "star_stories": _extract_star_stories(c),
        "company_intel": c.get("company_intel") or {},
        "questions_to_ask": c.get("questions_to_ask") or [],
    }


def _extract_star_stories(content: dict) -> list[dict]:
    raw = content.get("star_stories") or []
    out: list[dict] = []
    for s in raw:
        if isinstance(s, dict):
            out.append({
                "situation": s.get("situation") or "",
                "task": s.get("task") or "",
                "action": s.get("action") or "",
                "result": s.get("result") or "",
                "competency": s.get("competency") or "",
            })
    return out
