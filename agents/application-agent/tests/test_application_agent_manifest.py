import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_application_agent import ApplicationAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_application_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "application-agent"
    assert manifest.category.value == "career"
    assert manifest.autonomy_level.value == "approval_gated"


@pytest.mark.asyncio
async def test_application_agent_initialization():
    agent = ApplicationAgent()
    assert agent.manifest.agent_id == "application-agent"
