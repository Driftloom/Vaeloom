import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_qa_agent import QaAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_qa_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "qa-agent"
    assert manifest.category.value == "system"
    assert manifest.autonomy_level.value == "full"


@pytest.mark.asyncio
async def test_qa_agent_initialization():
    agent = QaAgent()
    assert agent.manifest.agent_id == "qa-agent"
