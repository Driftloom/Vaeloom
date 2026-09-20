import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_reflection_agent import ReflectionAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_reflection_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "reflection-agent"
    assert manifest.category.value == "memory"
    assert manifest.autonomy_level.value == "full"


@pytest.mark.asyncio
async def test_reflection_agent_initialization():
    agent = ReflectionAgent()
    assert agent.manifest.agent_id == "reflection-agent"
