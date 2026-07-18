"""
ATS Agent — read-only resume-vs-JD scoring with keyword gap analysis.
Never writes to memory. Never edits the resume.
"""
import logging
from typing import Any, Dict, List
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ATSResult(BaseModel):
    overall_score: float
    keyword_match_pct: float
    format_compliance_pct: float
    matched_keywords: List[str]
    missing_keywords: List[str]
    recommendations: List[str]


class ATSAgent(BaseAgent):
    mission = "Score resumes against job descriptions (read-only analysis)"
    tools = [
        Tool(name="search_documents", description="Search for resume data"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["career", "skills"],
        write_types=[],
    )
    default_autonomy = "read_only"

    async def fallback(self) -> Any:
        return {
            "agent_name": "ats",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need both a resume and a job description to perform scoring.",
                "details": None,
                "proposals": [],
                "questions": ["Could you provide the job description to score against?"],
            },
        }

    async def score(
        self, resume_text: str, job_description: str
    ) -> Dict[str, Any]:
        if not resume_text or not job_description:
            return await self.fallback()

        if settings.llm_api_key:
            return await self._llm_score(resume_text, job_description)

        return self._keyword_score(resume_text, job_description)

    async def _llm_score(self, resume_text: str, job_description: str) -> Dict[str, Any]:
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are an ATS (Applicant Tracking System) scoring expert. Analyze the resume against the job description. Return ONLY valid JSON with these exact keys: overall_score (0.0-1.0), keyword_match_pct (0-100), format_compliance_pct (0-100), matched_keywords (list), missing_keywords (list), recommendations (list of strings). Be thorough and accurate."},
                {"role": "user", "content": f"RESUME:\n{resume_text}\n\nJOB DESCRIPTION:\n{job_description}"},
            ], temperature=0.3, max_tokens=500)
            text = response["content"].strip()
            text = text.replace("```json", "").replace("```", "").strip()
            import json
            data = json.loads(text)

            result = ATSResult(
                overall_score=round(data.get("overall_score", 0.5), 2),
                keyword_match_pct=round(data.get("keyword_match_pct", 50.0), 1),
                format_compliance_pct=round(data.get("format_compliance_pct", 50.0), 1),
                matched_keywords=data.get("matched_keywords", []),
                missing_keywords=data.get("missing_keywords", []),
                recommendations=data.get("recommendations", []),
            )

            return {
                "agent_name": "ats",
                "action": "suggest",
                "confidence": 0.9,
                "result": {
                    "summary": f"ATS Score: {result.overall_score * 100:.0f}% — {len(result.matched_keywords)}/{len(result.matched_keywords) + len(result.missing_keywords)} keywords matched." if result.matched_keywords or result.missing_keywords else f"ATS Score: {result.overall_score * 100:.0f}%",
                    "details": result.model_dump(),
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"LLM scoring failed, falling back to keyword scoring: {e}")
            return self._keyword_score(resume_text, job_description)

    def _keyword_score(self, resume_text: str, job_description: str) -> Dict[str, Any]:
        jd_keywords = self._extract_keywords_keyword(job_description)
        resume_keywords = self._extract_keywords_keyword(resume_text)

        matched = [k for k in jd_keywords if k in resume_keywords]
        missing = [k for k in jd_keywords if k not in resume_keywords]

        keyword_pct = len(matched) / max(len(jd_keywords), 1)
        format_pct = self._check_format_compliance(resume_text)
        overall = (keyword_pct * 0.7) + (format_pct * 0.3)

        recommendations = []
        if missing:
            recommendations.append(f"Add missing keywords: {', '.join(missing[:5])}")
        if format_pct < 0.8:
            recommendations.append("Improve ATS format compliance (use standard section headers)")

        result = ATSResult(
            overall_score=round(overall, 2),
            keyword_match_pct=round(keyword_pct * 100, 1),
            format_compliance_pct=round(format_pct * 100, 1),
            matched_keywords=matched,
            missing_keywords=missing,
            recommendations=recommendations,
        )

        return {
            "agent_name": "ats",
            "action": "suggest",
            "confidence": 0.9,
            "result": {
                "summary": f"ATS Score: {result.overall_score * 100:.0f}% — {len(matched)}/{len(jd_keywords)} keywords matched.",
                "details": result.model_dump(),
                "proposals": [],
                "questions": [],
            },
        }

    def _extract_keywords_keyword(self, text: str) -> List[str]:
        common_skills = [
            "python", "javascript", "typescript", "react", "node",
            "sql", "aws", "docker", "kubernetes", "git",
            "machine learning", "data analysis", "agile", "scrum",
            "leadership", "communication", "teamwork",
        ]
        text_lower = text.lower()
        return [k for k in common_skills if k in text_lower]

    def _check_format_compliance(self, resume_text: str) -> float:
        score = 1.0
        text_lower = resume_text.lower()
        standard_headers = ["experience", "education", "skills"]
        found = sum(1 for h in standard_headers if h in text_lower)
        score = found / len(standard_headers)
        return score
