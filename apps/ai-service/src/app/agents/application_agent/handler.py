"""
Application Agent — tailor documents, manage submissions.
APPROVAL-GATED: Never submits without explicit per-application user approval.
"""
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool

logger = logging.getLogger(__name__)


class ApplicationPackage(BaseModel):
    job_id: str
    tailored_resume_id: Optional[str] = None
    cover_letter: str
    deep_link: Optional[str] = None  # When no API exists
    status: str = "drafted"  # drafted -> approved -> submitted -> tracking


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
        """
        Prepare an application package. NEVER submits without approval.
        """
        # Generate tailored cover letter from profile + job
        cover_letter = self._generate_cover_letter(job, user_profile)
        deep_link = job.get("apply_url", f"https://example.com/apply/{job.get('id', '')}")

        package = ApplicationPackage(
            job_id=job.get("id", "unknown"),
            cover_letter=cover_letter,
            deep_link=deep_link,
            status="drafted",
        )

        if has_approval:
            # User has explicitly approved — mark as submitted
            package.status = "submitted"
            logger.info(f"Application SUBMITTED for job {package.job_id} (user approved)")
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

        # No approval — request it (never auto-submit)
        logger.info(f"Application DRAFTED for job {package.job_id} — awaiting approval")
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

    def _generate_cover_letter(
        self, job: Dict[str, Any], profile: Dict[str, Any]
    ) -> str:
        """Generate a tailored cover letter. Real impl uses LLM."""
        name = profile.get("name", "the applicant")
        title = job.get("title", "the role")
        company = job.get("company", "the company")
        skills = profile.get("skills", [])

        skill_text = ", ".join(skills[:3]) if skills else "relevant skills"
        return (
            f"Dear Hiring Manager,\n\n"
            f"I am writing to express my interest in the {title} position at {company}. "
            f"With my background in {skill_text}, I am confident I can contribute "
            f"meaningfully to your team.\n\n"
            f"Best regards,\n{name}"
        )
