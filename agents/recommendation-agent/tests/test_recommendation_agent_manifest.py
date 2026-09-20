import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_recommendation_agent import RecommendationAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_recommendation_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "recommendation-agent"
    assert manifest.category.value == "career"
    assert manifest.autonomy_level.value == "full"


@pytest.mark.asyncio
async def test_recommendation_agent_initialization():
    agent = RecommendationAgent()
    assert agent.manifest.agent_id == "recommendation-agent"
