"""
Lever Postings API client — public, no auth required.

Endpoint: GET https://api.lever.co/v0/postings/{company}?mode=json&limit=...
Docs: https://github.com/lever/postings-api

Returns None when company not found / network unavailable so executor can mock.
"""
import logging
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

LEVER_API = "https://api.lever.co/v0/postings"


class LeverClient:
    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True,
    )
    async def list_jobs(self, company: str) -> list[dict[str, Any]] | None:
        if not company or not company.strip():
            logger.info("Lever company slug empty — skipping")
            return None
        slug = company.strip().lower()
        url = f"{LEVER_API}/{slug}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params={"mode": "json"})
                if resp.status_code == 404:
                    logger.info(f"Lever company not found: {company}")
                    return None
                if resp.status_code >= 400:
                    logger.warning(f"Lever API {resp.status_code}: {resp.text[:200]}")
                    return None
                data = resp.json()
                if not isinstance(data, list):
                    return None
                return [self._normalize(j) for j in data]
        except Exception as e:
            logger.warning(f"Lever list_jobs failed for {company}: {e}")
            return None

    async def search_jobs(
        self,
        company: str,
        keywords: list[str] | None = None,
        location: str | None = None,
    ) -> list[dict[str, Any]] | None:
        jobs = await self.list_jobs(company)
        if jobs is None:
            return None
        kw_lower = [k.lower() for k in (keywords or [])]
        out = []
        for j in jobs:
            hay = f"{j.get('title','')} {j.get('company','')} {j.get('location','')} {j.get('content','')} {' '.join(j.get('required_skills',[]))}".lower()
            if kw_lower and not any(kw in hay for kw in kw_lower):
                continue
            if location and location.lower() not in j.get("location", "").lower():
                continue
            out.append(j)
        return out

    def _normalize(self, raw: dict[str, Any]) -> dict[str, Any]:
        cats = raw.get("categories") or {}
        loc = cats.get("location") or raw.get("workplaceType") or ""
        return {
            "id": str(raw.get("id", raw.get("postingId", ""))),
            "title": raw.get("text", raw.get("title", "Unknown Role")),
            "company": raw.get("company", ""),
            "location": loc,
            "apply_url": raw.get("hostedUrl", raw.get("applyUrl", "")),
            "hostedUrl": raw.get("hostedUrl", ""),
            "content": (raw.get("descriptionPlain") or raw.get("description") or "")[:4000],
            "updated_at": raw.get("createdAt", ""),
            "required_skills": [],
        }

    async def check_health(self) -> bool:
        # Probe with a known public Lever company (lever itself)
        jobs = await self.list_jobs("lever")
        return jobs is not None
