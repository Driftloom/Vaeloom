"""
Configurable job board API client adapter.
Can be pointed at any REST job board API. Falls back to mock data when unavailable.
Supports Greenhouse, Lever, and generic API formats.
"""
import logging
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from api.config import settings

logger = logging.getLogger(__name__)


class JobBoardError(Exception):
    pass


class JobBoardClient:
    def __init__(
        self,
        api_url: str = "",
        api_key: str = "",
        workspace_id: str | None = None,
    ):
        self.workspace_id = workspace_id
        self.api_url = api_url or settings.job_board_api_url
        self.api_key = api_key or settings.job_board_api_key
        self._configured = bool(self.api_url and self.api_key)

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    )
    async def search_jobs(
        self,
        keywords: list[str],
        location: str | None = None,
    ) -> list[dict[str, Any]] | None:
        if not self._configured:
            logger.info("Job board API not configured — returning None for mock fallback")
            return None
        try:
            params: dict[str, Any] = {"query": " ".join(keywords)}
            if location:
                params["location"] = location

            is_rapidapi = "rapidapi.com" in self.api_url
            if is_rapidapi:
                headers = {
                    "X-RapidAPI-Key": self.api_key,
                    "X-RapidAPI-Host": self.api_url.replace("https://", "").replace("http://", "").split("/")[0],
                }
                endpoint = f"{self.api_url.rstrip('/')}/search"
            else:
                headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
                endpoint = f"{self.api_url.rstrip('/')}/jobs"

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    endpoint,
                    params=params,
                    headers=headers,
                )
                if resp.status_code >= 400:
                    logger.warning(f"Job board API error: {resp.status_code} {resp.text}")
                    return None
                data = resp.json()
                return self._normalize_response(data)
        except Exception as e:
            logger.warning(f"Job board search failed: {e}")
            return None

    def _normalize_response(self, raw: Any) -> list[dict[str, Any]]:
        if isinstance(raw, list):
            return [self._normalize_job(j) for j in raw]
        if isinstance(raw, dict):
            jobs = raw.get("data", raw.get("jobs", raw.get("results", [])))
            if isinstance(jobs, list):
                return [self._normalize_job(j) for j in jobs]
        return []

    def _normalize_job(self, raw: dict[str, Any]) -> dict[str, Any]:
        # Formulate location for both JSearch and standard models
        loc = raw.get("location") or raw.get("locations")
        if isinstance(loc, list) and loc:
            loc = loc[0].get("name", "") if isinstance(loc[0], dict) else str(loc[0])
        elif not loc and (raw.get("job_city") or raw.get("job_country")):
            parts = [raw.get("job_city"), raw.get("job_state"), raw.get("job_country")]
            loc = ", ".join([p for p in parts if p])
        elif not isinstance(loc, str):
            loc = ""

        return {
            "id": raw.get("job_id", raw.get("id", raw.get("external_id", f"job_{hash(str(raw)) % 10000}"))),
            "title": raw.get("job_title", raw.get("title", raw.get("name", raw.get("position", "Unknown Role")))),
            "company": raw.get("employer_name", raw.get("company", raw.get("organization", raw.get("company_name", "Unknown Company")))),
            "location": loc,
            "required_skills": raw.get("job_required_skills", raw.get("skills", raw.get("required_skills", []))),
            "apply_url": raw.get("job_apply_link", raw.get("apply_url", raw.get("applyUrl", raw.get("hostedUrl", "")))),
            "is_remote": raw.get("job_is_remote", False),
            "description": raw.get("job_description", ""),
            "min_salary": raw.get("job_min_salary"),
            "max_salary": raw.get("job_max_salary"),
            "salary_currency": raw.get("job_salary_currency"),
        }

    async def check_health(self) -> bool:
        if not self._configured:
            return False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.api_url.rstrip('/')}/health", timeout=10.0)
                return resp.status_code == 200
        except Exception:
            return False
