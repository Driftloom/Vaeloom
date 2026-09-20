import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_reminder_agent import ReminderAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_reminder_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "reminder-agent"
    assert manifest.category.value == "productivity"
    assert manifest.autonomy_level.value == "full"


@pytest.mark.asyncio
async def test_reminder_agent_initialization():
    agent = ReminderAgent()
    assert agent.manifest.agent_id == "reminder-agent"
