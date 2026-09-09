"""
Tests for PIOS Agent Council Quality Gate.
Verifies the 5-agent deliberation protocol, triage classifier, and deterministic verdict compilation.
"""
import pytest
from httpx import AsyncClient

from api.services.agent_council import (
    agent_council,
    CouncilVerdictType,
    DeliberatorRole,
)

pytestmark = pytest.mark.asyncio


class TestAgentCouncilUnit:
    async def test_triage_classifier_bypasses_trivial(self):
        """Short commands, greetings, or trivial pings bypass the full council."""
        assert agent_council.triage("hello") is False
        assert agent_council.triage("status") is False
        assert agent_council.triage("ok") is False
        assert agent_council.triage("short text") is False

    async def test_triage_classifier_triggers_on_substantial_artifact(self):
        """Substantial text, code, or proposals must convene the council."""
        artifact = (
            "Architecting sovereign AI agent systems with local-first context, "
            "deterministic policy kernels, and multiscale temporal memory."
        )
        assert agent_council.triage(artifact) is True

    async def test_council_bypasses_trivial_artifact_directly(self):
        verdict = await agent_council.deliberate("hi")
        assert verdict.bypassed_triage is True
        assert verdict.verdict == CouncilVerdictType.SHIP
        assert verdict.overall_score == 95.0

    async def test_council_ship_verdict_clean_artifact(self):
        """A well-formed, calibrated artifact without fatal flaws or buzzwords passes as SHIP."""
        artifact = (
            "Implemented an asynchronous event-driven worker pool with bounded concurrency "
            "of 8 workers, utilizing SQLite transactions and exponential backoff retry logic."
        )
        verdict = await agent_council.deliberate(artifact)
        assert verdict.bypassed_triage is False
        assert verdict.verdict == CouncilVerdictType.SHIP
        assert verdict.overall_score >= 90.0
        assert len(verdict.round_1_critiques) == 4
        assert len(verdict.round_2_rebuttals) >= 1

    async def test_council_revise_verdict_on_reducible_flaws(self):
        """Buzzword inflation and TODO placeholders trigger a REVISE verdict with an actionable brief."""
        artifact = (
            "This cutting-edge, game-changing architecture provides a disruptive synergy "
            "for enterprise workflows. TODO: complete error handling and benchmark figures."
        )
        verdict = await agent_council.deliberate(artifact)
        assert verdict.verdict == CouncilVerdictType.REVISE
        assert len(verdict.reducible_flaws) >= 2
        assert len(verdict.revision_brief) >= 2
        assert any("Fix:" in b for b in verdict.revision_brief)

    async def test_council_hold_verdict_on_fatal_flaws_adversarial(self):
        """Critical fatal exceptions or blockers in adversarial mode trigger a HOLD verdict."""
        artifact = (
            "The critical service encountered an unhandled Fatal error and NullPointer exception "
            "leading to catastrophic database corruptions and process termination across nodes."
        )
        verdict = await agent_council.deliberate(artifact, mode="adversarial")
        assert verdict.verdict == CouncilVerdictType.HOLD
        assert len(verdict.irreducible_flaws) > 0
        assert "HOLD" in verdict.summary


class TestAgentCouncilApi:
    async def test_council_api_unauthenticated(self, client: AsyncClient):
        resp = await client.post("/api/v1/council/review", json={"artifact": "Sample text"})
        assert resp.status_code in (401, 403)

    async def test_council_triage_api(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/council/triage",
            json={"artifact": "hello"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["requires_council"] is False

        resp2 = await client.post(
            "/api/v1/council/triage",
            json={
                "artifact": "Implement sovereign digital twin synchronization with local vector indices."
            },
            headers=auth_headers,
        )
        assert resp2.status_code == 200
        assert resp2.json()["requires_council"] is True

    async def test_council_review_api_authenticated(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/council/review",
            json={
                "artifact": "Developed a distributed task queue handling 5,000 tasks/second with p99 latency of 12ms.",
                "artifact_type": "resume",
                "mode": "collaborative",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] in ("SHIP", "REVISE", "HOLD")
        assert "overall_score" in data
        assert "round_1_critiques" in data
        assert "round_2_rebuttals" in data
