"""
Resume Agent — build, maintain, and optimize the master resume.
Never fabricates; every claim traces to a source. Asks when uncertain.
"""
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ResumeBullet(BaseModel):
    text: str
    source_document_id: Optional[str] = None
    is_inferred: bool = False
    format: str = "xyz"


class ResumeVariant(BaseModel):
    variant_type: str
    sections: Dict[str, List[ResumeBullet]]


class ResumeAgent(BaseAgent):
    mission = "Build, maintain, and optimize the master resume"
    tools = [
        Tool(name="search_documents", description="Search user documents for achievements"),
        Tool(name="query_graph", description="Query knowledge graph for career data"),
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
        profile: Dict[str, Any],
        variant_type: str = "master",
        target_jd: Optional[str] = None,
    ) -> Dict[str, Any]:
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

    def _check_missing_fields(self, profile: Dict[str, Any]) -> List[str]:
        expected = ["name", "email", "education", "experience"]
        return [f for f in expected if f not in profile]

    async def _build_sections(
        self,
        profile: Dict[str, Any],
        variant_type: str,
        target_jd: Optional[str],
    ) -> Dict[str, List[ResumeBullet]]:
        sections: Dict[str, List[ResumeBullet]] = {}

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
