"""
Greenhouse Boards API client — public, no auth required.

Endpoint: GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
Docs: https://developers.greenhouse.io/job-board

Falls back gracefully (returns None) when board not found / network unavailable,
so executor can emit deterministic mock data for offline tests.
"""
import logging
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

BOARDS_API = "https://boards-api.greenhouse.io/v1/boards"


class GreenhouseClient:
    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True,
    )
    async def list_jobs(self, board_token: str) -> list[dict[str, Any]] | None:
        if not board_token or not board_token.strip():
            logger.info("Greenhouse board_token empty — skipping")
            return None
        url = f"{BOARDS_API}/{board_token.strip().lower()}/jobs"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params={"content": "true"})
                if resp.status_code == 404:
                    logger.info(f"Greenhouse board not found: {board_token}")
                    return None
                if resp.status_code >= 400:
                    logger.warning(f"Greenhouse API {resp.status_code}: {resp.text[:200]}")
                    return None
                data = resp.json()
                jobs = data.get("jobs", []) if isinstance(data, dict) else []
                return [self._normalize(j) for j in jobs]
        except Exception as e:
            logger.warning(f"Greenhouse list_jobs failed for {board_token}: {e}")
            return None

    async def search_jobs(
        self,
        board_token: str,
        keywords: list[str] | None = None,
        location: str | None = None,
    ) -> list[dict[str, Any]] | None:
        jobs = await self.list_jobs(board_token)
        if jobs is None:
            return None
        kw_lower = [k.lower() for k in (keywords or [])]
        out = []
        for j in jobs:
            hay = f"{j.get('title','')} {j.get('company','')} {j.get('location','')} {' '.join(j.get('required_skills',[]))}".lower()
            if kw_lower and not any(kw in hay for kw in kw_lower):
                continue
            if location and location.lower() not in j.get("location", "").lower():
                continue
            out.append(j)
        return out

    def _normalize(self, raw: dict[str, Any]) -> dict[str, Any]:
        loc = raw.get("location") or {}
        if isinstance(loc, dict):
            loc_str = loc.get("name", "")
        else:
            loc_str = str(loc)
        return {
            "id": str(raw.get("id", "")),
            "title": raw.get("title", "Unknown Role"),
            "company": raw.get("company", {}).get("name", "") if isinstance(raw.get("company"), dict) else raw.get("company", ""),
            "location": loc_str,
            "absolute_url": raw.get("absolute_url", ""),
            "apply_url": raw.get("absolute_url", ""),
            "content": (raw.get("content") or "")[:4000],
            "updated_at": raw.get("updated_at", ""),
            "required_skills": [],
            "board_token": raw.get("board_token", ""),
        }

    async def check_health(self) -> bool:
        # Use a known public board as probe (greenhouse itself)
        jobs = await self.list_jobs("greenhouse")
        return jobs is not None
