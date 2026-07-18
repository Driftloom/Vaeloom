import pytest
from app.orchestrator.router import handle, UserRequest, classify_intent
from app.orchestrator.base import BaseAgent
from app.orchestrator.loop import run_agent_loop, AgentRequest

@pytest.mark.asyncio
async def test_intent_classification():
    agent1, conf1 = await classify_intent("organize my files")
    assert agent1 == "organization"
    
    agent2, conf2 = await classify_intent("extract memory")
    assert agent2 == "memory"

@pytest.mark.asyncio
async def test_agent_loop():
    request = UserRequest(request_id="req1", message="organize my file folder categorize", workspace_id="ws1")
    response = await handle(request)
    assert isinstance(response, dict)
    assert response["agent_name"] == "organization"
    assert "action" in response
    assert "confidence" in response
    assert "result" in response
    assert "summary" in response["result"]
