import pytest
from uuid import uuid4
from vaeloom_sdk import VaeloomClient


def test_sdk_create_request():
    client = VaeloomClient(base_url="https://api.vaeloom.com", api_key="test-key")
    ws_id = uuid4()
    t_id = uuid4()
    u_id = uuid4()
    req = client.create_request(ws_id, t_id, u_id, "career-agent", "Optimize resume")
    assert req.agent_name == "career-agent"
    assert req.user_id == u_id
