"""
Application Agent — tailor documents, manage submissions.
APPROVAL-GATED: Never submits without explicit per-application user approval.
"""
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ApplicationPackage(BaseModel):
    job_id: str
    tailored_resume_id: Optional[str] = None
    cover_letter: str
    deep_link: Optional[str] = None
    status: str = "drafted"


class ApplicationAgent(BaseAgent):
    mission = "Tailor documents and submit/hand-off applications"
    tools = [
        Tool(name="search_documents", description="Search career documents"),
        Tool(name="query_graph", description="Query career knowledge graph"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["career", "timeline"],
        write_types=["timeline"],
    )
    default_autonomy = "approval_gated"

    async def fallback(self) -> Any:
        return {
            "agent_name": "application",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more information to prepare this application.",
                "details": None,
                "proposals": [],
                "questions": ["Which job would you like to apply to?"],
            },
        }

    async def prepare(
        self,
        job: Dict[str, Any],
        resume_text: str,
        user_profile: Dict[str, Any],
        has_approval: bool = False,
    ) -> Dict[str, Any]:
        cover_letter = await self._generate_cover_letter(job, user_profile)
        deep_link = job.get("apply_url", f"https://example.com/apply/{job.get('id', '')}")

        package = ApplicationPackage(
            job_id=job.get("id", "unknown"),
            cover_letter=cover_letter,
            deep_link=deep_link,
            status="drafted",
        )

        if has_approval:
            package.status = "submitted"
            logger.info(f"Application SUBMITTED for job {package.job_id}")
            return {
                "agent_name": "application",
                "action": "execute",
                "confidence": 0.95,
                "result": {
                    "summary": f"Application submitted for {job.get('title', 'role')} at {job.get('company', 'company')}.",
                    "details": package.model_dump(),
                    "proposals": [],
                    "questions": [],
                },
            }

        return {
            "agent_name": "application",
            "action": "request_approval",
            "confidence": 0.9,
            "result": {
                "summary": f"Application package ready for {job.get('title', 'role')} at {job.get('company', 'company')}. Please review and approve.",
                "details": package.model_dump(),
                "proposals": [package.model_dump()],
                "questions": [],
            },
        }

    async def _generate_cover_letter(
        self, job: Dict[str, Any], profile: Dict[str, Any]
    ) -> str:
        name = profile.get("name", "the applicant")
        title = job.get("title", "the role")
        company = job.get("company", "the company")
        skills = profile.get("skills", [])

        if not settings.llm_api_key:
            return self._template_cover_letter(name, title, company, skills)

        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a professional cover letter writer. Write a concise, tailored cover letter (2-3 paragraphs) for a job application. Be specific and professional. Sign with the applicant's name."},
                {"role": "user", "content": f"Applicant: {name}\nJob Title: {title}\nCompany: {company}\nKey Skills: {', '.join(skills)}\n\nWrite a tailored cover letter:"},
            ], temperature=0.7, max_tokens=500)
            text = response["content"].strip()
            if text:
                return text
        except Exception as e:
            logger.warning(f"LLM cover letter generation failed: {e}")

        return self._template_cover_letter(name, title, company, skills)

    def _template_cover_letter(self, name: str, title: str, company: str, skills: List[str]) -> str:
        skill_text = ", ".join(skills[:3]) if skills else "relevant skills"
        return (
            f"Dear Hiring Manager,\n\n"
            f"I am writing to express my interest in the {title} position at {company}. "
            f"With my background in {skill_text}, I am confident I can contribute "
            f"meaningfully to your team.\n\n"
            f"Best regards,\n{name}"
        )
