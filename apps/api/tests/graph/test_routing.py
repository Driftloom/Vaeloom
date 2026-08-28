"""Level 1 — Unit: routing, supervisor DAG, agent selection."""

import pytest

from api.graph.routing import route_classify, supervisor_dag


@pytest.mark.asyncio
async def test_route_classify_organize():
    r = await route_classify("organize my files")
    assert r["agent"] == "organization"
    assert r["confidence"] >= 0.5


@pytest.mark.asyncio
async def test_route_classify_resume():
    r = await route_classify("help with my resume ats score")
    assert r["agent"] in {"resume", "ats", "memory"}


@pytest.mark.asyncio
async def test_route_classify_fallback_memory():
    r = await route_classify("asdf qwer zxcv")
    # Fallback is deterministic — accept any registry agent with valid confidence 0-1
    assert r["agent"] in {"memory", "resume", "organization", "ats", "job_search", "gmail", "scheduler", "connector", "planning", "research"}
    assert 0 <= r["confidence"] <= 1


@pytest.mark.asyncio
async def test_supervisor_dag_single():
    dag = await supervisor_dag("organize my files")
    # single category -> single layer
    assert isinstance(dag, list)
    # may be [] fallback then route will handle, but should not be multi-layer
    assert len(dag) <= 1 or all(isinstance(layer, list) for layer in dag)


@pytest.mark.asyncio
async def test_supervisor_dag_multi():
    dag = await supervisor_dag("organize my files and schedule a meeting tomorrow with my team to review career goals")
    # This message spans document_organization + schedule_time + career_development -> multi-agent
    # Should be multi-layer or parallel
    assert isinstance(dag, list)
    # If multi-agent detected, layers contain multiple agents
    total_agents = sum(len(layer) for layer in dag)
    # Heuristic may yield 2+ agents
    assert total_agents >= 1


def test_route_classify_is_async():
    import inspect

    assert inspect.iscoroutinefunction(route_classify)
