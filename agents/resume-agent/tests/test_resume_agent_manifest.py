import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_resume_agent import ResumeAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_resume_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "resume-agent"
    assert manifest.category.value == "career"
    assert manifest.autonomy_level.value == "approval_gated"


@pytest.mark.asyncio
async def test_resume_agent_initialization():
    agent = ResumeAgent()
    assert agent.manifest.agent_id == "resume-agent"
