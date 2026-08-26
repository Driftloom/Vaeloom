"""
Resume Agent — build, maintain, and optimize the master resume.
Never fabricates; every claim traces to a source. Asks when uncertain.
"""
import logging
from copy import deepcopy
from typing import Any

from pydantic import BaseModel

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class ResumeBullet(BaseModel):
    text: str
    source_document_id: str | None = None
    is_inferred: bool = False
    format: str = "xyz"


class ResumeVariant(BaseModel):
    variant_type: str
    sections: dict[str, list[ResumeBullet]]


class ResumeAgent(BaseAgent):
    mission = "Build, maintain, and optimize the master resume"
    tools = [
        Tool(name="search_documents", description="Search user documents for achievements"),
        Tool(name="query_graph", description="Query knowledge graph for career data"),
        Tool(name="calculate_semantic_ats_score", description="Semantic ATS scoring for tailoring"),
        Tool(name="audit_ats_formatting", description="ATS formatting audit before export"),
        Tool(name="compile_resume_pdf", description="Compile resume to PDF via template engine"),
        Tool(name="compile_resume_docx", description="Compile resume to editable DOCX"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["career", "skills", "achievements", "education", "timeline"],
        write_types=["career", "skills"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "resume",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more information to complete this resume section.",
                "details": None,
                "proposals": [],
                "questions": ["Could you provide more details about this experience?"],
            },
        }

    async def execute(
        self,
        profile: dict[str, Any],
        variant_type: str = "master",
        target_jd: str | None = None,
    ) -> dict[str, Any]:
        missing_fields = self._check_missing_fields(profile)

        if missing_fields:
            return {
                "agent_name": "resume",
                "action": "ask_clarification",
                "confidence": 0.6,
                "result": {
                    "summary": f"Your profile is missing {len(missing_fields)} field(s) needed for the resume.",
                    "details": None,
                    "proposals": [],
                    "questions": [
                        f"What is your {field}?" for field in missing_fields
                    ],
                },
            }

        sections = await self._build_sections(profile, variant_type, target_jd)

        return {
            "agent_name": "resume",
            "action": "suggest",
            "confidence": 0.9,
            "result": {
                "summary": f"Generated {variant_type} resume with {sum(len(v) for v in sections.values())} bullet points.",
                "details": {
                    "variant_type": variant_type,
                    "sections": {
                        k: [b.model_dump() for b in v] for k, v in sections.items()
                    },
                },
                "proposals": [],
                "questions": [],
            },
        }

    def _check_missing_fields(self, profile: dict[str, Any]) -> list[str]:
        expected = ["name", "email", "education", "experience"]
        return [f for f in expected if f not in profile]

    async def _build_sections(
        self,
        profile: dict[str, Any],
        variant_type: str,
        target_jd: str | None,
    ) -> dict[str, list[ResumeBullet]]:
        sections: dict[str, list[ResumeBullet]] = {}

        education = profile.get("education", [])
        if isinstance(education, list):
            sections["education"] = [
                ResumeBullet(
                    text=f"{e.get('degree', 'Degree')} at {e.get('institution', 'University')}",
                    source_document_id=e.get("source_doc_id"),
                    is_inferred=False,
                )
                for e in education
            ]

        experience = profile.get("experience", [])
        if isinstance(experience, list):
            bullets = []
            for exp in experience:
                role = exp.get("role", "Role")
                company = exp.get("company", "Company")
                achievements = exp.get("achievements", [])
                for ach in achievements:
                    text = await self._llm_generate_bullet(ach, role, company)
                    bullet = ResumeBullet(
                        text=text,
                        source_document_id=exp.get("source_doc_id"),
                        is_inferred="[inferred]" in str(ach),
                    )
                    bullets.append(bullet)
            sections["experience"] = bullets

        skills = profile.get("skills", [])
        if isinstance(skills, list):
            sections["skills"] = [
                ResumeBullet(text=s, is_inferred=False) for s in skills
            ]

        return sections

    async def _llm_generate_bullet(self, achievement: str, role: str, company: str) -> str:
        if not settings.llm_api_key:
            return f"{achievement} at {company} as {role}"
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a resume writing expert. Generate a concise, professional XYZ-format resume bullet point (Accomplished X by doing Y, resulting in Z). Return ONLY the bullet text, no explanations or labels."},
                {"role": "user", "content": f"Achievement: {achievement}\nRole: {role}\nCompany: {company}"},
            ], temperature=0.7, max_tokens=150)
            return response["content"].strip()
        except Exception as e:
            logger.warning(f"LLM bullet generation failed: {e}")
            return f"{achievement} at {company} as {role}"

    async def tailor_content(self, content: dict[str, Any], target_jd: str) -> tuple[dict[str, Any], dict[str, Any]]:
        """
        Rewrite experience bullets of a canonical resume-content dict to align
        with a target job description. Never fabricates: rewrites existing
        claims only; falls back to original bullets when the LLM is unavailable.
        Returns (tailored_content, meta).
        """
        from api.services.resume_templates import resume_templates

        tailored = deepcopy(content or {})
        rewritten = 0
        for entry in tailored.get("experience") or []:
            if not isinstance(entry, dict):
                continue
            new_bullets: list[str] = []
            for b in entry.get("bullets") or []:
                text = b if isinstance(b, str) else (b.get("text") or "")
                if not text:
                    continue
                new_text = await self._llm_tailor_bullet(text, target_jd)
                if new_text != text:
                    rewritten += 1
                new_bullets.append(new_text)
            if new_bullets:
                entry["bullets"] = new_bullets

        suggested_template = resume_templates.suggest_template(
            target_role="", industry=target_jd[:600]
        )
        meta = {
            "bullets_rewritten": rewritten,
            "suggested_template": suggested_template,
            "mode": "llm" if settings.llm_api_key else "passthrough",
        }
        return tailored, meta

    async def _llm_tailor_bullet(self, bullet: str, target_jd: str) -> str:
        if not settings.llm_api_key:
            return bullet
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": (
                    "You are an expert resume writer. Rewrite the given resume bullet "
                    "so its wording aligns with the target job description vocabulary. "
                    "STRICT RULES: never invent metrics, tools, or achievements not "
                    "present in the original bullet; keep it one sentence; keep XYZ "
                    "format (Accomplished X by doing Y, resulting in Z). Return ONLY "
                    "the rewritten bullet text."
                )},
                {"role": "user", "content": f"Target job description:\n{target_jd[:2500]}\n\nResume bullet:\n{bullet}"},
            ], temperature=0.4, max_tokens=120)
            rewritten = response["content"].strip().strip('"')
            return rewritten or bullet
        except Exception as e:
            logger.warning(f"LLM bullet tailoring failed: {e}")
            return bullet
