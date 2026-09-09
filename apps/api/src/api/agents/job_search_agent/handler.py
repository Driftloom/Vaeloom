"""
Job Search Agent — search, rank, and shortlist job opportunities.
Filters out previously rejected roles. Provides fit reason per result.
Integrates with configurable job board API via JobBoardClient, falls back to mock data.
"""
import json
import logging
from typing import Any

from pydantic import BaseModel

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class JobResult(BaseModel):
    job_id: str
    title: str
    company: str
    location: str
    fit_score: float
    fit_reason: str
    is_remote: bool = False
    why_you: str | None = None
    match_score: float | None = None


class JobSearchAgent(BaseAgent):
    mission = "Search connected platforms, rank against memory, return shortlist"
    tools = [
        Tool(name="search_jobs", description="Search job boards (generic)"),
        Tool(name="search_greenhouse_jobs", description="Search Greenhouse boards (public, no auth)"),
        Tool(name="search_lever_jobs", description="Search Lever postings (public, no auth)"),
        Tool(name="search_jobs_board", description="Unified job board aggregator (Greenhouse+Lever+generic)"),
        Tool(name="browse_job_page", description="Open a job posting URL and extract structured requirements"),
        Tool(name="verify_application_link", description="Check an application URL is live before applying"),
        Tool(name="scrape_company_insights", description="Company culture, news, interview questions, tech stack"),
        Tool(name="search_documents", description="Search career memory"),
        Tool(name="query_graph", description="Query career knowledge graph"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["career", "preferences"],
        write_types=[],
    )
    default_autonomy = "suggest"

    def __init__(self, workspace_id: str | None = None):
        super().__init__()
        self.workspace_id = workspace_id
        self._client = None

    async def _get_client(self, workspace_id: str | None = None):
        if self._client is None:
            from api.clients.job_board_client import JobBoardClient
            self._client = JobBoardClient(workspace_id=workspace_id or self.workspace_id)
        return self._client

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
        keywords: list[str],
        user_skills: list[str],
        rejected_job_ids: list[str],
        location: str | None = None,
        workspace_id: str | None = None,
        preferences: dict[str, Any] | list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        raw_jobs = None

        client = await self._get_client(workspace_id=workspace_id)
        if client._configured:
            api_jobs = await client.search_jobs(keywords, location)
            if api_jobs:
                raw_jobs = api_jobs

        if raw_jobs is None:
            if settings.llm_api_key and keywords:
                raw_jobs = await self._llm_generate_jobs(keywords, user_skills, location)
            else:
                raw_jobs = self._mock_jobs()

        filtered = [j for j in raw_jobs if j["id"] not in rejected_job_ids]

        # Parse and apply user profile preferences
        prefs_dict: dict[str, Any] = {}
        if isinstance(preferences, dict):
            prefs_dict = preferences
        elif isinstance(preferences, list):
            for item in preferences:
                if isinstance(item, dict) and "name" in item:
                    prefs_dict[item["name"]] = item.get("value") or item.get("metadata")

        dealbreakers = prefs_dict.get("dealbreakers") or []
        remote_pref = str(prefs_dict.get("remote_preference") or prefs_dict.get("remotePreference") or "").lower()
        preferred_industries = [str(ind).lower() for ind in (prefs_dict.get("preferred_industries") or prefs_dict.get("preferredIndustries") or []) if ind]

        # Filter out roles containing dealbreaker terms
        if dealbreakers:
            clean_db = [str(d).strip().lower() for d in dealbreakers if str(d).strip()]
            def violates_dealbreaker(job_item: dict[str, Any]) -> bool:
                combined = f"{job_item.get('title', '')} {job_item.get('company', '')} {' '.join(job_item.get('required_skills', []))}".lower()
                return any(db_word in combined for db_word in clean_db)
            filtered = [j for j in filtered if not violates_dealbreaker(j)]

        results = []
        for job in filtered:
            fit_score, fit_reason = await self._score_fit(job, user_skills, keywords)
            is_job_remote = job.get("location", "").lower() == "remote"

            # Profile preference boosts
            if remote_pref in ("remote", "remote_only", "fully_remote") and is_job_remote:
                fit_score = min(1.0, round(fit_score + 0.15, 2))
                fit_reason = f"{fit_reason} • Matches remote preference"
            elif remote_pref in ("onsite", "in_person") and is_job_remote:
                fit_score = max(0.1, round(fit_score - 0.1, 2))

            if preferred_industries:
                job_desc = f"{job.get('title', '')} {job.get('company', '')}".lower()
                if any(ind in job_desc for ind in preferred_industries):
                    fit_score = min(1.0, round(fit_score + 0.1, 2))
                    fit_reason = f"{fit_reason} • Target industry match"

            results.append(JobResult(
                job_id=job["id"],
                title=job["title"],
                company=job["company"],
                location=job.get("location", ""),
                fit_score=fit_score,
                fit_reason=fit_reason,
                is_remote=is_job_remote,
                why_you=fit_reason,
                match_score=fit_score,
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
        self, keywords: list[str], user_skills: list[str], location: str | None
    ) -> list[dict[str, Any]]:
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

    def _mock_jobs(self) -> list[dict[str, Any]]:
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
        self, job: dict[str, Any], user_skills: list[str], keywords: list[str]
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

        # PIOS Opportunity Matcher (matcher_core formula)
        try:
            from api.services.opportunity_matcher import opportunity_matcher
            skills_payload = [
                {"name": s, "confidence": 0.85, "validation_tier": "V1", "decay_factor": 1.0}
                if isinstance(s, str) else s
                for s in user_skills
            ]
            match_res = opportunity_matcher.calculate_match(job, user_skills=skills_payload)
            if match_res.matched_skills or match_res.missing_skills:
                return round(match_res.match_score, 2), match_res.why_you
        except Exception as exc:
            logger.debug("PIOS opportunity matcher fallback: %s", exc)

        return self._keyword_score_fit(job, user_skills, keywords)

    def _keyword_score_fit(
        self, job: dict[str, Any], user_skills: list[str], keywords: list[str]
    ) -> tuple[float, str]:
        required = {s.lower() for s in job.get("required_skills", [])}
        user = {s.lower() for s in user_skills}
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
