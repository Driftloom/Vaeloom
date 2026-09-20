from uuid import UUID
from typing import Optional
from vaeloom_agent_contracts import AgentRequest, AgentResponse


class VaeloomClient:
    """Official developer SDK client for invoking Vaeloom agents."""

    def __init__(self, base_url: str = "http://localhost:8000", api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def create_request(
        self,
        workspace_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        agent_name: str,
        prompt: str,
    ) -> AgentRequest:
        from uuid import uuid4
        return AgentRequest(
            workspace_id=workspace_id,
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=uuid4(),
            agent_name=agent_name,
            input_text=prompt,
        )
