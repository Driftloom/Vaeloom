import pytest
from pathlib import Path
from vaeloom_agent_policy import load_manifest_from_yaml
from vaeloom_job_search_agent import JobSearchAgent

MANIFEST_PATH = Path(__file__).parent.parent / "agent.yaml"


def test_job_search_agent_manifest():
    manifest = load_manifest_from_yaml(MANIFEST_PATH)
    assert manifest.agent_id == "job-search-agent"
    assert manifest.category.value == "career"
    assert manifest.autonomy_level.value == "full"


@pytest.mark.asyncio
async def test_job_search_agent_initialization():
    agent = JobSearchAgent()
    assert agent.manifest.agent_id == "job-search-agent"
