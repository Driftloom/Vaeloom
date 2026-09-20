from vaeloom_agent_common import BaseAgent, AgentTurnContext, ReActStep, CancellationToken
from vaeloom_agent_policy import load_manifest_from_yaml
from pathlib import Path

MANIFEST_PATH = Path(__file__).parent.parent.parent / "agent.yaml"


class InternshipAgent(BaseAgent):
    """Internship Agent - Early-career and university internship search, timeline tracking."""

    def __init__(self):
        manifest = load_manifest_from_yaml(MANIFEST_PATH)
        super().__init__(manifest)

    async def run_step(self, context: AgentTurnContext, token: CancellationToken) -> ReActStep:
        token.check()
        return ReActStep(
            step_index=context.step_count,
            thought=f"Executing Internship Agent plan for input: {context.user_prompt}",
            is_final=True,
            final_answer=f"Result from Internship Agent",
        )
