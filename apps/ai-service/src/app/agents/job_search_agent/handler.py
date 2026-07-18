"""
Job Search Agent — search, rank, and shortlist job opportunities.
Filters out previously rejected roles. Provides fit reason per result.
"""
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool

logger = logging.getLogger(__name__)


class JobResult(BaseModel):
    job_id: str
    title: str
    company: str
    location: str
    fit_score: float  # 0.0 - 1.0
    fit_reason: str  # Never unexplained
    is_remote: bool = False


class JobSearchAgent(BaseAgent):
    mission = "Search connected platforms, rank against memory, return shortlist"
    tools = [
        Tool(name="search_jobs", description="Search job boards"),
        Tool(name="search_documents", description="Search career memory"),
        Tool(name="query_graph", description="Query career knowledge graph"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["career", "preferences"],
        write_types=[],  # Read-only — no memory writes
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "job_search",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more information about your job preferences.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What type of role are you looking for?",
                    "Do you have a location preference?",
                ],
            },
        }

    async def search(
        self,
        keywords: List[str],
        user_skills: List[str],
        rejected_job_ids: List[str],
        location: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search for jobs, rank by fit, filter rejected, explain scores."""
        # Mock job results
        raw_jobs = [
            {"id": "job_1", "title": "Senior Python Developer", "company": "TechCorp",
             "location": "Remote", "required_skills": ["python", "django", "aws"]},
            {"id": "job_2", "title": "Frontend Engineer", "company": "WebCo",
             "location": "New York", "required_skills": ["react", "typescript", "css"]},
            {"id": "job_3", "title": "ML Engineer", "company": "AILabs",
             "location": "San Francisco", "required_skills": ["python", "machine learning", "pytorch"]},
            {"id": "job_rejected", "title": "Data Entry Clerk", "company": "OldCo",
             "location": "Remote", "required_skills": ["excel"]},
        ]

        # Filter out rejected jobs
        filtered = [j for j in raw_jobs if j["id"] not in rejected_job_ids]

        # Score and rank
        results = []
        for job in filtered:
            fit_score, fit_reason = self._score_fit(job, user_skills, keywords)
            results.append(JobResult(
                job_id=job["id"],
                title=job["title"],
                company=job["company"],
                location=job["location"],
                fit_score=fit_score,
                fit_reason=fit_reason,
                is_remote=job["location"].lower() == "remote",
            ))

        # Sort by fit score descending
        results.sort(key=lambda r: r.fit_score, reverse=True)

        return {
            "agent_name": "job_search",
            "action": "suggest",
            "confidence": 0.85,
            "result": {
                "summary": f"Found {len(results)} matching roles, ranked by fit.",
                "details": [r.model_dump() for r in results],
                "proposals": [],
                "questions": [],
            },
        }

    def _score_fit(
        self, job: Dict[str, Any], user_skills: List[str], keywords: List[str]
    ) -> tuple[float, str]:
        """Score job fit and provide explanation."""
        required = set(s.lower() for s in job.get("required_skills", []))
        user = set(s.lower() for s in user_skills)
        matched = required & user
        missing = required - user

        score = len(matched) / max(len(required), 1)

        if score >= 0.8:
            reason = f"Strong match: you have {len(matched)}/{len(required)} required skills ({', '.join(matched)})"
        elif score >= 0.5:
            reason = f"Partial match: {len(matched)}/{len(required)} skills. Missing: {', '.join(missing)}"
        else:
            reason = f"Weak match: only {len(matched)}/{len(required)} skills. Missing: {', '.join(missing)}"

        return round(score, 2), reason
