import logging
from typing import Any
from .state import LoopState, load_or_create_state, save_checkpoint
from .base import BaseAgent

logger = logging.getLogger(__name__)

class AgentRequest:
    def __init__(self, agent: BaseAgent, request_id: str, message: str, workspace_id: str):
        self.agent = agent
        self.id = request_id
        self.message = message
        self.workspace_id = workspace_id

class AgentResponse:
    def __init__(self, status: str, final_result: Any):
        self.status = status
        self.final_result = final_result

class ReflectResult:
    def __init__(self, is_satisfied: bool, reason: str = ""):
        self.is_satisfied = is_satisfied
        self.reason = reason

# 1. Plan
async def plan_phase(request: AgentRequest, state: LoopState) -> Any:
    logger.info("Executing PLAN phase")
    return {"plan": "execute mocked tool"}

# 2. Act
async def act_phase(plan: Any) -> Any:
    logger.info("Executing ACT phase")
    return {"action_result": "mocked success"}

# 3. Observe
async def observe_phase(act_result: Any) -> Any:
    logger.info("Executing OBSERVE phase")
    return {"observation": "tool worked correctly"}

# 4. Reflect
async def reflect_phase(request: AgentRequest, observe_result: Any, attempt: int) -> ReflectResult:
    logger.info("Executing REFLECT phase")
    if attempt >= 2:
        return ReflectResult(is_satisfied=True)
    return ReflectResult(is_satisfied=False, reason="need more info")

# 5. Improve
async def improve_phase(state: LoopState) -> AgentResponse:
    logger.info("Executing IMPROVE phase")
    return AgentResponse(status="success", final_result="task completed")

async def escalate_to_user(state: LoopState) -> AgentResponse:
    logger.warning("Escalating to user after max retries")
    return AgentResponse(status="escalated", final_result="max retries exceeded")

async def run_agent_loop(request: AgentRequest) -> AgentResponse:
    logger.info(f"Starting agent loop for request {request.id}")
    state = await load_or_create_state(request.id)
    
    for iteration in range(3):  # Bounded loop
        logger.info(f"--- Loop Iteration {iteration + 1} ---")
        
        plan = await plan_phase(request, state)
        state.add_phase(f"plan_{iteration}", plan)
        await save_checkpoint(state)
        
        act_result = await act_phase(plan)
        state.add_phase(f"act_{iteration}", act_result)
        await save_checkpoint(state)
        
        observe_result = await observe_phase(act_result)
        state.add_phase(f"observe_{iteration}", observe_result)
        await save_checkpoint(state)
        
        reflect_result = await reflect_phase(request, observe_result, iteration)
        state.add_phase(f"reflect_{iteration}", reflect_result)
        if reflect_result.is_satisfied:
            return await improve_phase(state)
            
    return await escalate_to_user(state)
