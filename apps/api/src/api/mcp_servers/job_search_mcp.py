"""Vaeloom Job Search & ATS Model Context Protocol (MCP) Server.

Provides tools to query public ATS job boards (Greenhouse, Lever, Ashby)
with zero authentication, extracting structured job postings, requirements,
and direct application links for Vaeloom agents.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

import httpx
from mcp.server import MCPServer

from api.utils.url_guard import UrlBlockedError, assert_public_http_url

logger = logging.getLogger("mcp.job_search")

server = MCPServer("vaeloom-job-search-mcp")


async def _search_greenhouse(company: str) -> list[dict[str, Any]]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            return []
        data = resp.json()
        jobs = []
        for j in data.get("jobs", []):
            jobs.append({
                "id": str(j.get("id")),
                "title": j.get("title"),
                "location": (j.get("location") or {}).get("name", "Remote / Unspecified"),
                "url": j.get("absolute_url"),
                "updated_at": j.get("updated_at"),
                "provider": "greenhouse",
            })
        return jobs


async def _search_lever(company: str) -> list[dict[str, Any]]:
    url = f"https://api.lever.co/v0/postings/{company}?mode=json"
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            return []
        data = resp.json()
        jobs = []
        for j in data if isinstance(data, list) else []:
            jobs.append({
                "id": str(j.get("id")),
                "title": j.get("text"),
                "location": (j.get("categories") or {}).get("location", "Remote / Unspecified"),
                "team": (j.get("categories") or {}).get("team", "General"),
                "url": j.get("hostedUrl"),
                "provider": "lever",
            })
        return jobs


async def _search_ashby(company: str) -> list[dict[str, Any]]:
    url = f"https://api.ashbyhq.com/posting-api/job-board/{company}"
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            return []
        data = resp.json()
        jobs = []
        for j in data.get("jobs", []):
            jobs.append({
                "id": str(j.get("id")),
                "title": j.get("title"),
                "location": j.get("locationName", "Remote / Unspecified"),
                "department": j.get("departmentName", "General"),
                "url": j.get("jobUrl"),
                "provider": "ashby",
            })
        return jobs


@server.tool(
    name="search_public_ats_jobs",
    description=(
        "Search live job openings directly from company public ATS boards (Greenhouse, Lever, Ashby). "
        "Requires no API keys or login."
    ),
)
async def search_public_ats_jobs(
    company: str,
    ats_provider: str = "greenhouse",
) -> str:
    """Search public ATS jobs for a company.

    Args:
        company: Company slug or identifier (e.g. 'figma', 'stripe', 'coinbase', 'linear').
        ats_provider: 'greenhouse', 'lever', 'ashby', or 'auto'.
    """
    company = company.strip().lower()
    provider = ats_provider.strip().lower()

    if not company:
        return json.dumps({"error": "Company name is required"})

    results = []
    if provider == "greenhouse":
        results = await _search_greenhouse(company)
    elif provider == "lever":
        results = await _search_lever(company)
    elif provider == "ashby":
        results = await _search_ashby(company)
    elif provider == "auto":
        results = await _search_greenhouse(company)
        if not results:
            results = await _search_lever(company)
        if not results:
            results = await _search_ashby(company)

    return json.dumps(
        {
            "company": company,
            "provider": provider,
            "count": len(results),
            "jobs": results[:25],
        },
        indent=2,
    )


@server.tool(
    name="fetch_job_details",
    description="Fetches full job description, requirements, and responsibilities for a given posting URL.",
)
async def fetch_job_details(url: str) -> str:
    """Fetches and cleans job posting text from a URL."""
    url = url.strip()
    if not url:
        return json.dumps({"error": "URL is required"})

    try:
        url = await assert_public_http_url(url)
    except UrlBlockedError as e:
        return json.dumps({"error": f"SSRF policy blocked URL: {e}"})

    async def _safe_redirect_hook(response: httpx.Response):
        if response.is_redirect and "location" in response.headers:
            loc = response.headers["location"]
            abs_url = str(response.url.join(loc))
            await assert_public_http_url(abs_url)

    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            event_hooks={"response": [_safe_redirect_hook]},
        ) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            if resp.status_code != 200:
                return json.dumps({"error": f"HTTP {resp.status_code}"})

            text = resp.text
            clean_text = re.sub(r"<[^>]+>", " ", text)
            clean_text = re.sub(r"\s+", " ", clean_text).strip()

            return json.dumps(
                {
                    "url": url,
                    "snippet": clean_text[:4000],
                },
                indent=2,
            )
    except Exception as e:
        return json.dumps({"error": str(e)})


async def run_server() -> None:
    await server.run_stdio_async()


if __name__ == "__main__":
    asyncio.run(run_server())
