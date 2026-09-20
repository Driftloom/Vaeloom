from vaeloom_agent_common import BaseAgent, AgentTurnContext, ReActStep, CancellationToken
from vaeloom_agent_policy import load_manifest_from_yaml
from pathlib import Path

MANIFEST_PATH = Path(__file__).parent.parent.parent / "agent.yaml"


class CareerAgent(BaseAgent):
    """Career Agent - Guide users on career paths, skill development, and trajectory planning."""

    def __init__(self):
        manifest = load_manifest_from_yaml(MANIFEST_PATH)
        super().__init__(manifest)

    async def run_step(self, context: AgentTurnContext, token: CancellationToken) -> ReActStep:
        token.check()
        return ReActStep(
            step_index=context.step_count,
            thought=f"Executing Career Agent plan for input: {context.user_prompt}",
            is_final=True,
            final_answer=f"Result from Career Agent",
        )
