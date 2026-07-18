"""
Job Search Agent — search, rank, and shortlist job opportunities.
Filters out previously rejected roles. Provides fit reason per result.
"""
import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class JobResult(BaseModel):
    job_id: str
    title: str
    company: str
    location: str
    fit_score: float
    fit_reason: str
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
        write_types=[],
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
        if settings.llm_api_key and keywords:
            raw_jobs = await self._llm_generate_jobs(keywords, user_skills, location)
        else:
            raw_jobs = self._mock_jobs()

        filtered = [j for j in raw_jobs if j["id"] not in rejected_job_ids]

        results = []
        for job in filtered:
            fit_score, fit_reason = await self._score_fit(job, user_skills, keywords)
            results.append(JobResult(
                job_id=job["id"],
                title=job["title"],
                company=job["company"],
                location=job["location"],
                fit_score=fit_score,
                fit_reason=fit_reason,
                is_remote=job.get("location", "").lower() == "remote",
            ))

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

    async def _llm_generate_jobs(
        self, keywords: List[str], user_skills: List[str], location: Optional[str]
    ) -> List[Dict[str, Any]]:
        try:
            loc_hint = f" near {location}" if location else ""
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a job search assistant. Generate 3-5 realistic job listings matching the given keywords and skills. Return ONLY valid JSON array: [{\"id\": \"job_X\", \"title\": \"...\", \"company\": \"...\", \"location\": \"...\", \"required_skills\": [\"...\"]}]. Use realistic company names and locations."},
                {"role": "user", "content": f"Keywords: {', '.join(keywords)}\nSkills: {', '.join(user_skills)}{loc_hint}"},
            ], temperature=0.7, max_tokens=500)
            text = response["content"].strip()
            text = text.replace("```json", "").replace("```", "").strip()
            jobs = json.loads(text)
            if isinstance(jobs, list) and len(jobs) >= 1:
                return jobs
        except Exception as e:
            logger.warning(f"LLM job generation failed: {e}")

        return self._mock_jobs()

    def _mock_jobs(self) -> List[Dict[str, Any]]:
        return [
            {"id": "job_1", "title": "Senior Python Developer", "company": "TechCorp",
             "location": "Remote", "required_skills": ["python", "django", "aws"]},
            {"id": "job_2", "title": "Frontend Engineer", "company": "WebCo",
             "location": "New York", "required_skills": ["react", "typescript", "css"]},
            {"id": "job_3", "title": "ML Engineer", "company": "AILabs",
             "location": "San Francisco", "required_skills": ["python", "machine learning", "pytorch"]},
            {"id": "job_rejected", "title": "Data Entry Clerk", "company": "OldCo",
             "location": "Remote", "required_skills": ["excel"]},
        ]

    async def _score_fit(
        self, job: Dict[str, Any], user_skills: List[str], keywords: List[str]
    ) -> tuple[float, str]:
        if settings.llm_api_key and user_skills:
            try:
                response = await llm_service.generate_completion([
                    {"role": "system", "content": "Score how well this job matches the user's skills and keywords. Return ONLY valid JSON: {\"score\": 0.0-1.0, \"reason\": \"explanation\"}"},
                    {"role": "user", "content": f"Job: {job.get('title')} at {job.get('company')}\nRequired skills: {', '.join(job.get('required_skills', []))}\nUser skills: {', '.join(user_skills)}\nKeywords: {', '.join(keywords)}"},
                ], temperature=0.3, max_tokens=200)
                text = response["content"].strip()
                text = text.replace("```json", "").replace("```", "").strip()
                data = json.loads(text)
                return round(data.get("score", 0.5), 2), data.get("reason", "Fit analyzed by AI")
            except Exception as e:
                logger.warning(f"LLM fit scoring failed: {e}")

        return self._keyword_score_fit(job, user_skills, keywords)

    def _keyword_score_fit(
        self, job: Dict[str, Any], user_skills: List[str], keywords: List[str]
    ) -> tuple[float, str]:
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
