import pytest
from uuid import uuid4
from vaeloom_agent_contracts import AgentRequest
from vaeloom_messages_worker import MessagesWorker


@pytest.mark.asyncio
async def test_messages_worker_process_turn():
    worker = MessagesWorker()
    req = AgentRequest(
        workspace_id=uuid4(),
        tenant_id=uuid4(),
        user_id=uuid4(),
        session_id=uuid4(),
        agent_name="career-agent",
        input_text="Plan my trajectory",
    )
    res = await worker.process_turn(req)
    assert res.is_success is True
    assert "Plan my trajectory" in res.result
