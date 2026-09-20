import asyncio
from uuid import UUID
from typing import Optional, Callable
from vaeloom_agent_contracts import AgentRequest, AgentResponse


class MessagesWorker:
    """Asynchronous worker consuming agent execution turns from queues."""

    def __init__(self, handler: Optional[Callable] = None):
        self.handler = handler
        self._running = False

    async def process_turn(self, request: AgentRequest) -> AgentResponse:
        if self.handler:
            return await self.handler(request)
        return AgentResponse(
            session_id=request.session_id,
            agent_name=request.agent_name,
            result=f"Processed: {request.input_text}",
            is_success=True,
        )
