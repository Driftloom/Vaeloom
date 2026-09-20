import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_plugin_agent import PluginAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_plugin_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "plugin-agent"
    assert manifest.category.value == "developer"
    assert manifest.autonomy_level.value == "approval_gated"


@pytest.mark.asyncio
async def test_plugin_agent_initialization():
    agent = PluginAgent()
    assert agent.manifest.agent_id == "plugin-agent"
