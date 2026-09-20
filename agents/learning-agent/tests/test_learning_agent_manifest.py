import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_learning_agent import LearningAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_learning_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "learning-agent"
    assert manifest.category.value == "career"
    assert manifest.autonomy_level.value == "full"


@pytest.mark.asyncio
async def test_learning_agent_initialization():
    agent = LearningAgent()
    assert agent.manifest.agent_id == "learning-agent"
