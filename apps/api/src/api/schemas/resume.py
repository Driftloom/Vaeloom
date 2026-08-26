import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ResumeResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    variant_type: str
    content: dict[str, Any]
    version: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GenerateResumeRequest(BaseModel):
    variant_type: str = Field(default="tailored", min_length=1)
    job_description: str | None = None
    target_role: str | None = None
    company: str | None = None


class TailorResumeRequest(BaseModel):
    job_description: str = Field(min_length=1)
    target_role: str | None = None
    company: str | None = None


class CompileResumeRequest(BaseModel):
    template_slug: str = Field(min_length=1)
    format: str = Field(default="pdf", pattern="^(pdf|docx|html)$")
    max_pages: int = Field(default=2, ge=1, le=3)


class CoverLetterRequest(BaseModel):
    body: str = Field(min_length=1, description="Cover letter text (paragraphs separated by blank lines)")
    template_slug: str = Field(min_length=1)
    format: str = Field(default="pdf", pattern="^(pdf|docx|html)$")
    recipient: str | None = None
    company: str | None = None
    role: str | None = None


class ResumeTemplateResponse(BaseModel):
    slug: str
    name: str
    category: str
    description: str
    best_for: list[str] = []
    ats_compatibility: int = 100
    accent_color: str = "#111111"
    font_stack: str = "serif"
    layout: str = "single-column"


class ResumeArtifactResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    resume_id: uuid.UUID
    artifact_kind: str
    template_slug: str | None = None
    format: str
    filename: str
    media_type: str
    file_size: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Overleaf-style source (Typst/LaTeX) ───────────────────────────────
class ResumeSourceResponse(BaseModel):
    id: uuid.UUID
    resume_id: uuid.UUID
    workspace_id: uuid.UUID
    path: str = "main.typ"
    content: str
    lang: str = "typst"
    version: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpdateSourceRequest(BaseModel):
    content: str = Field(min_length=1, description="Raw Typst/LaTeX source text")
    path: str = Field(default="main.typ", min_length=1)
    lang: str = Field(default="typst", pattern="^(typst|latex|html)$")


class CompileTypstRequest(BaseModel):
    template_slug: str = Field(default="jakes-resume", min_length=1)
    typst_source: str | None = Field(default=None, description="Raw Typst source; if omitted uses stored source or transpiles from JSON")
    format: str = Field(default="pdf", pattern="^(pdf|html)$")
    max_pages: int = Field(default=2, ge=1, le=3)


class InlineAiRequest(BaseModel):
    start_line: int = Field(ge=1, description="1-indexed start line of selection")
    end_line: int = Field(ge=1, description="1-indexed end line of selection")
    intent: str = Field(default="tailor", description="tailor|condense|xyz|ats_fix")
    target_jd: str | None = Field(default=None, description="Target job description for tailoring")
    selected_text: str | None = Field(default=None, description="Explicit selected text; if omitted extracted from source lines")


class InlineAiResponse(BaseModel):
    diff: list[dict]
    suggestions: list[dict] = []
    ats_score: dict | None = None
