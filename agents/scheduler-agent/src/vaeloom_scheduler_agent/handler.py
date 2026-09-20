from vaeloom_agent_common import BaseAgent, AgentTurnContext, ReActStep, CancellationToken
from vaeloom_agent_policy import load_manifest_from_yaml
from pathlib import Path

MANIFEST_PATH = Path(__file__).parent.parent.parent / "agent.yaml"


class SchedulerAgent(BaseAgent):
    """Scheduler Agent - Periodic background agent schedule coordination and cron management."""

    def __init__(self):
        manifest = load_manifest_from_yaml(MANIFEST_PATH)
        super().__init__(manifest)

    async def run_step(self, context: AgentTurnContext, token: CancellationToken) -> ReActStep:
        token.check()
        return ReActStep(
            step_index=context.step_count,
            thought=f"Executing Scheduler Agent plan for input: {context.user_prompt}",
            is_final=True,
            final_answer=f"Result from Scheduler Agent",
        )
