import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_scheduler_agent import SchedulerAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_scheduler_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "scheduler-agent"
    assert manifest.category.value == "productivity"
    assert manifest.autonomy_level.value == "approval_gated"


@pytest.mark.asyncio
async def test_scheduler_agent_initialization():
    agent = SchedulerAgent()
    assert agent.manifest.agent_id == "scheduler-agent"
