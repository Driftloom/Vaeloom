"""Test script verifying the zero-trust RoutingEngine in real-time."""

import asyncio
import pytest
from api.orchestrator.routing import routing_engine


@pytest.mark.asyncio
async def test_live_routing_suite():
    test_cases = [
        ("hlo", "conversation", "executive.companion.scaffold"),
        ("i feel so overwhelmed and burnt out with my job hunt", "conversation", "executive.companion.scaffold"),
        ("find staff python jobs and tailor my resume", "job_search", "career.job.search"),
        ("scan documents for pii and leaked keys", "security", "workspace.security.audit"),
        ("schedule mock interview for tomorrow", "calendar", "workspace.calendar.plan"),
    ]

    for query, expected_agent, expected_cap in test_cases:
        env, plan = await routing_engine.route(
            query=query,
            workspace_id="00000000-0000-0000-0000-000000000001",
        )
        print(f"QUERY: '{query}' -> AGENT: {env.selected_agent}, CAP: {env.normalized_intent}, METHOD: {env.routing_method}")
        assert env.selected_agent == expected_agent, f"Expected {expected_agent}, got {env.selected_agent} for '{query}'"
        assert env.normalized_intent == expected_cap, f"Expected {expected_cap}, got {env.normalized_intent} for '{query}'"
        assert len(plan.subtasks) >= 1
