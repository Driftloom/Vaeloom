"""
Integration tests for Opportunities Router.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestOpportunitiesApi:
    async def test_opportunities_unauthenticated(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/opportunities/match",
            json={
                "opportunity": {
                    "title": "Backend AI Engineer",
                    "company": "Driftloom",
                    "required_skills": ["Python", "FastAPI"],
                }
            },
        )
        assert resp.status_code in (401, 403)

    async def test_opportunities_match_authenticated(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/opportunities/match",
            json={
                "opportunity": {
                    "title": "Backend AI Engineer",
                    "company": "Driftloom",
                    "type": "job",
                    "required_skills": ["Python", "FastAPI", "PostgreSQL"],
                }
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Backend AI Engineer"
        assert "match_score" in data
        assert "why_you" in data
        assert "metrics" in data

    async def test_opportunities_rank_authenticated(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/opportunities/rank",
            json={
                "opportunities": [
                    {
                        "title": "Backend AI Engineer",
                        "company": "Driftloom",
                        "required_skills": ["Python", "FastAPI"],
                    },
                    {
                        "title": "Frontend React Dev",
                        "company": "Acme",
                        "required_skills": ["React", "CSS"],
                    },
                ],
                "top_k": 2,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert "match_score" in data[0]
