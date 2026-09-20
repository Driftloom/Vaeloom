"""
In-Memory Mock Career Portal Backend for Vaeloom Agent Demos.
"""
from __future__ import annotations

from typing import Any, Optional
from .data import VAELOOM_JOB_POSTINGS


class MockCareerPortalBackend:
    def __init__(self):
        self.jobs = list(VAELOOM_JOB_POSTINGS)
        self.applications: list[dict[str, Any]] = []

    def search_jobs(self, query: str) -> list[dict[str, Any]]:
        q = query.lower()
        return [
            j for j in self.jobs
            if q in j["title"].lower()
            or q in j["company"].lower()
            or any(q in r.lower() for r in j.get("required_skills", j.get("requirements", [])))
            or q in j.get("description", "").lower()
        ]

    def submit_application(self, job_id: str, candidate_name: str, tailored_resume: str) -> dict[str, Any]:
        app = {
            "application_id": f"app_{len(self.applications) + 1}",
            "job_id": job_id,
            "candidate_name": candidate_name,
            "resume_snippet": tailored_resume[:100] + "...",
            "status": "submitted",
        }
        self.applications.append(app)
        return app
