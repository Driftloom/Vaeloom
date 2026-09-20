import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_internship_agent import InternshipAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_internship_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "internship-agent"
    assert manifest.category.value == "career"
    assert manifest.autonomy_level.value == "full"


@pytest.mark.asyncio
async def test_internship_agent_initialization():
    agent = InternshipAgent()
    assert agent.manifest.agent_id == "internship-agent"
