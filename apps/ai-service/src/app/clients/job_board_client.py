"""
Configurable job board API client adapter.
Can be pointed at any REST job board API. Falls back to mock data when unavailable.
Supports Greenhouse, Lever, and generic API formats.
"""
import logging
from typing import Any, Dict, List, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import settings

logger = logging.getLogger(__name__)


class JobBoardError(Exception):
    pass


class JobBoardClient:
    def __init__(
        self,
        api_url: str = "",
        api_key: str = "",
    ):
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
        keywords: List[str],
        location: Optional[str] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        if not self._configured:
            logger.info("Job board API not configured — returning None for mock fallback")
            return None
        try:
            params: Dict[str, Any] = {"query": " ".join(keywords)}
            if location:
                params["location"] = location

            headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{self.api_url.rstrip('/')}/jobs",
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

    def _normalize_response(self, raw: Any) -> List[Dict[str, Any]]:
        if isinstance(raw, list):
            return [self._normalize_job(j) for j in raw]
        if isinstance(raw, dict):
            jobs = raw.get("jobs", raw.get("results", raw.get("data", [])))
            if isinstance(jobs, list):
                return [self._normalize_job(j) for j in jobs]
        return []

    def _normalize_job(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": raw.get("id", raw.get("external_id", f"job_{hash(str(raw)) % 10000}")),
            "title": raw.get("title", raw.get("name", raw.get("position", "Unknown Role"))),
            "company": raw.get("company", raw.get("organization", raw.get("company_name", "Unknown Company"))),
            "location": raw.get("location", raw.get("locations", [{}])[0].get("name", "")) if isinstance(raw.get("location"), str) else (raw.get("locations", [{}])[0].get("name", "") if isinstance(raw.get("locations"), list) else ""),
            "required_skills": raw.get("skills", raw.get("required_skills", [])),
            "apply_url": raw.get("apply_url", raw.get("applyUrl", raw.get("hostedUrl", ""))),
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
