import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_memory_agent import MemoryAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_memory_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "memory-agent"
    assert manifest.category.value == "memory"
    assert manifest.autonomy_level.value == "approval_gated"


@pytest.mark.asyncio
async def test_memory_agent_initialization():
    agent = MemoryAgent()
    assert agent.manifest.agent_id == "memory-agent"
