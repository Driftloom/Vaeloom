import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_drive_agent import DriveAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_drive_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "drive-agent"
    assert manifest.category.value == "productivity"
    assert manifest.autonomy_level.value == "approval_gated"


@pytest.mark.asyncio
async def test_drive_agent_initialization():
    agent = DriveAgent()
    assert agent.manifest.agent_id == "drive-agent"
