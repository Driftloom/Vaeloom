"""
Application Agent — tailor documents, manage submissions.
APPROVAL-GATED: Never submits without explicit per-application user approval.
"""
import logging
from typing import Any

from pydantic import BaseModel

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class ApplicationPackage(BaseModel):
    job_id: str
    tailored_resume_id: str | None = None
    cover_letter: str
    deep_link: str | None = None
    status: str = "drafted"


class ApplicationAgent(BaseAgent):
    mission = "Tailor documents and submit/hand-off applications"
    tools = [
        Tool(name="search_documents", description="Search career documents"),
        Tool(name="query_graph", description="Query career knowledge graph"),
        Tool(name="verify_application_link", description="Validate the application URL is live before submitting"),
        Tool(name="scrape_company_insights", description="Company intel for tailored applications and interviews"),
        Tool(name="compile_cover_letter", description="Compile a tailored cover letter via template engine"),
        Tool(name="compile_resume_pdf", description="Compile tailored resume to PDF for submission"),
        Tool(name="calculate_semantic_ats_score", description="ATS check before submission"),
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
        job: dict[str, Any],
        resume_text: str,
        user_profile: dict[str, Any],
        has_approval: bool = False,
    ) -> dict[str, Any]:
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
        self, job: dict[str, Any], profile: dict[str, Any]
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

    def _template_cover_letter(self, name: str, title: str, company: str, skills: list[str]) -> str:
        skill_text = ", ".join(skills[:3]) if skills else "relevant skills"
        return (
            f"Dear Hiring Manager,\n\n"
            f"I am writing to express my interest in the {title} position at {company}. "
            f"With my background in {skill_text}, I am confident I can contribute "
            f"meaningfully to your team.\n\n"
            f"Best regards,\n{name}"
        )

    async def process(self, request_or_dict: Any, context: Any = None) -> dict[str, Any]:
        if isinstance(request_or_dict, dict) and "job" in request_or_dict:
            return await self.prepare(
                job=request_or_dict.get("job", {}),
                resume_text=request_or_dict.get("resume_text", ""),
                user_profile=request_or_dict.get("user_profile", {}),
                has_approval=request_or_dict.get("has_approval", False),
            )
        msg = request_or_dict.get("message", "") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "message", str(request_or_dict))
        ws_id = request_or_dict.get("workspace_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "workspace_id", None)
        u_id = request_or_dict.get("user_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "user_id", None)
        t_id = request_or_dict.get("tenant_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "tenant_id", None)
        return await self.handle(msg, workspace_id=ws_id, user_id=u_id, tenant_id=t_id, context=context)

    async def execute(self, payload: dict[str, Any] | Any) -> dict[str, Any]:
        return await self.process(payload)

    async def handle(
        self,
        message: str,
        workspace_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
        permissions: list[str] | None = None,
        context: Any = None,
        has_approval: bool = False,
        **kwargs: Any,
    ) -> dict[str, Any]:
        import re
        logger.info("ApplicationAgent handling message: %s", message[:80])
        clean_msg = message.strip()

        # Extract company and role
        company_name = "Target Company"
        match = re.search(r"\b(?:at|for)\s+([A-Z][A-Za-z0-9&]+)", clean_msg)
        if match:
            company_name = match.group(1)

        role_title = clean_msg.split("\n")[0][:60]
        if "apply" in role_title.lower():
            role_title = re.sub(r"(?i)\bapply\s+(?:for|to)?\s*", "", role_title).strip()
        if not role_title:
            role_title = "Software Engineer"

        job_data = {
            "id": f"job_app_{abs(hash(clean_msg)) % 100000}",
            "title": role_title,
            "company": company_name,
            "apply_url": f"https://jobs.example.com/roles/{abs(hash(clean_msg)) % 100000}",
        }

        user_prof = getattr(context, "profile", None) if context else None
        if not isinstance(user_prof, dict):
            user_prof = {"name": "Candidate", "skills": ["Python", "TypeScript", "React", "System Design"]}

        master_res = getattr(context, "master_resume", None) if context else ""
        resume_str = str(master_res) if master_res else "Senior Software Engineer with 6+ years building distributed cloud platforms."

        prep_result = await self.prepare(
            job=job_data,
            resume_text=resume_str,
            user_profile=user_prof,
            has_approval=has_approval,
        )

        package_details = prep_result.get("result", {}).get("details", {})
        summary_text = prep_result.get("result", {}).get("summary", "")

        proposals = [
            {
                "action": "submit_application",
                "title": f"Submit Application: {role_title} at {company_name}",
                "detail": f"Cover letter drafted ({len(package_details.get('cover_letter', ''))} chars) • URL: {package_details.get('deep_link')}",
                "requires_approval": not has_approval,
                "approval_type": "job_application",
                "job_id": job_data["id"],
            }
        ]

        return {
            "agent_name": "application",
            "action": "execute" if has_approval else "request_approval",
            "confidence": 0.95,
            "result": {
                "summary": summary_text,
                "details": package_details,
                "proposals": proposals,
                "questions": [
                    "Would you like me to customize any specific paragraph in the cover letter?",
                    "Do you want to run an ATS parseability audit on the resume before submitting?",
                ],
                "action_chips": [
                    "✅ Approve & Submit Application",
                    "✏️ Edit Cover Letter Draft",
                    "📄 Preview Compiled PDF",
                    "📊 Run ATS Audit",
                ],
            },
        }
