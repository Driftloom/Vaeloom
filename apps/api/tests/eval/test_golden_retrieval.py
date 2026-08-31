"""P1c: nightly eval gate — golden retrieval + intent routing fixtures."""
import json
import pathlib


def test_golden_retrieval_routing():
    """Deterministic routing check from golden fixtures (no LLM, no DB)."""
    # Classify intent must match expected_agent for golden queries
    import asyncio

    from api.orchestrator.router import classify_intent

    golden = json.loads(pathlib.Path(__file__).with_name("golden_retrieval.json").read_text())

    async def _check():
        for item in golden:
            if "expected_agent" not in item:
                continue
            agent, conf = await classify_intent(item["query"])
            assert agent == item["expected_agent"], f"golden {item['id']}: {agent} != {item['expected_agent']} (q={item['query']!r})"
            assert conf >= 0.7, f"golden {item['id']} low conf {conf}"

    asyncio.run(_check())


def test_golden_tool_and_approval():
    """Check tool / approval flags in golden set are consistent with definitions."""
    from api.tools.definitions import ALL_TOOLS
    from api.tools.executor import approval_gated_tools

    golden = json.loads(pathlib.Path(__file__).with_name("golden_retrieval.json").read_text())
    for item in golden:
        tool = item.get("expected_tool")
        if tool:
            assert tool in ALL_TOOLS, f"golden {item['id']}: unknown tool {tool}"
        if item.get("approval_gated"):
            # approval_gated items should route to an agent that has approval-gated tools
            assert item["expected_agent"] in ("application", "gmail", "organization", "scheduler")
