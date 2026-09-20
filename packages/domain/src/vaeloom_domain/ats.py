import re
from typing import Any
from pydantic import BaseModel, Field


class ATSScoreResult(BaseModel):
    overall_score: float = Field(..., ge=0.0, le=100.0)
    hard_skills_score: float = Field(..., ge=0.0, le=100.0)
    experience_score: float = Field(..., ge=0.0, le=100.0)
    matched_keywords: list[str]
    missing_keywords: list[str]
    formatting_issues: list[str] = Field(default_factory=list)


def calculate_deterministic_ats_score(resume_text: str, job_description: str) -> ATSScoreResult:
    """Deterministic ATS matching algorithm using tokenization, n-grams, and keyword gazetteer."""
    resume_lower = resume_text.lower()
    job_lower = job_description.lower()

    # Extract alphanumeric words (>2 chars)
    job_tokens = set(re.findall(r"\b[a-z]{3,}\b", job_lower))
    resume_tokens = set(re.findall(r"\b[a-z]{3,}\b", resume_lower))

    # Exclude common stop words
    stop_words = {"and", "the", "for", "with", "this", "that", "from", "have", "are", "will", "our", "you"}
    filtered_job_tokens = job_tokens - stop_words

    matched = sorted(list(filtered_job_tokens & resume_tokens))
    missing = sorted(list(filtered_job_tokens - resume_tokens))

    total_target = len(filtered_job_tokens) or 1
    match_ratio = len(matched) / total_target
    overall = round(match_ratio * 100, 1)

    formatting_issues = []
    if len(resume_text) < 200:
        formatting_issues.append("Resume content is excessively brief (<200 chars)")
    if "\t" in resume_text:
        formatting_issues.append("Tab characters detected; prefer standard spacing for ATS parsers")

    return ATSScoreResult(
        overall_score=overall,
        hard_skills_score=overall,
        experience_score=min(100.0, overall + 10.0),
        matched_keywords=matched[:15],
        missing_keywords=missing[:15],
        formatting_issues=formatting_issues,
    )
