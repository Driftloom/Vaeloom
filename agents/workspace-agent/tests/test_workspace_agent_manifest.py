import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_workspace_agent import WorkspaceAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_workspace_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "workspace-agent"
    assert manifest.category.value == "system"
    assert manifest.autonomy_level.value == "full"


@pytest.mark.asyncio
async def test_workspace_agent_initialization():
    agent = WorkspaceAgent()
    assert agent.manifest.agent_id == "workspace-agent"
