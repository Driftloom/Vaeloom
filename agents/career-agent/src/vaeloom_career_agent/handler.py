import logging
from pathlib import Path
from typing import Any, Optional

from vaeloom_agent_common import AgentTurnContext, BaseAgent, CancellationToken, ReActStep
from vaeloom_agent_policy import PolicyVerdict, load_manifest_from_yaml

logger = logging.getLogger(__name__)

MANIFEST_PATH = Path(__file__).parent.parent.parent / "agent.yaml"


class CareerAgent(BaseAgent):
    """Career Agent - Guide users on career paths, skill development, and trajectory planning."""

    def __init__(self, manifest_path: Optional[Path] = None):
        target_path = manifest_path or MANIFEST_PATH
        manifest = load_manifest_from_yaml(target_path)
        super().__init__(manifest)

    async def run_step(self, context: AgentTurnContext, token: CancellationToken) -> ReActStep:
        """Executes a single governed ReAct step for Career Agent."""
        token.check()

        # Enforce step budget
        if context.step_count >= self.manifest.budget.max_steps_per_turn:
            return ReActStep(
                step_index=context.step_count,
                thought="Step budget limit reached for turn.",
                is_final=True,
                final_answer="Execution reached maximum allowed steps for this turn.",
            )

        prompt_lower = context.user_prompt.lower()

        # 1. Check for delegation requests to allowed sub-agents
        if self.manifest.delegation.can_delegate:
            delegation_target = self._resolve_delegation_target(prompt_lower)
            if delegation_target:
                if delegation_target in self.manifest.delegation.allowed_targets:
                    return ReActStep(
                        step_index=context.step_count,
                        thought=f"Delegating domain task to authorized target: {delegation_target}",
                        action_name=f"delegate:{delegation_target}",
                        action_input={"query": context.user_prompt, "target_agent": delegation_target},
                        is_final=True,
                        final_answer=f"Task delegated to {delegation_target}: {context.user_prompt}",
                    )
                else:
                    return ReActStep(
                        step_index=context.step_count,
                        thought=f"Delegation target {delegation_target} is forbidden by policy.",
                        is_final=True,
                        final_answer=f"Policy violation: Delegation to {delegation_target} is not permitted.",
                    )

        # 2. Check for tool invocation requests
        for tool_name in ["web_search", "query_graph", "search_documents"]:
            if tool_name in prompt_lower or tool_name.replace("_", " ") in prompt_lower:
                verdict = self.validate_tool_call(tool_name)
                if not verdict.allowed:
                    return ReActStep(
                        step_index=context.step_count,
                        thought=f"Tool {tool_name} rejected by zero-trust policy: {verdict.reason}",
                        is_final=True,
                        final_answer=f"Tool execution forbidden: {verdict.reason}",
                    )
                return ReActStep(
                    step_index=context.step_count,
                    thought=f"Executing tool {tool_name} for career research",
                    action_name=tool_name,
                    action_input={"query": context.user_prompt},
                    is_final=False,
                    observation=f"Retrieved relevant career data via {tool_name}",
                )

        # 3. Domain Career Analysis & Skill Gap Trajectory
        career_guidance = self._generate_career_guidance(context.user_prompt, context.profile_data)
        return ReActStep(
            step_index=context.step_count,
            thought="Analyzed user career trajectory, identified skill gaps, and generated milestone roadmap.",
            is_final=True,
            final_answer=career_guidance,
        )

    def _resolve_delegation_target(self, prompt_lower: str) -> Optional[str]:
        """Resolves target agent if specialized delegation is required."""
        if any(k in prompt_lower for k in ["ats", "ats score", "keyword match", "parseability"]):
            return "ats-agent"
        if any(k in prompt_lower for k in ["tailor resume", "resume builder", "cv", "cover letter"]):
            return "resume-agent"
        if any(k in prompt_lower for k in ["job search", "find jobs", "job listings", "vacancies"]):
            return "job-search-agent"
        return None

    def _generate_career_guidance(self, prompt: str, profile_data: dict[str, Any]) -> str:
        """Synthesizes structured, deterministic career recommendations."""
        current_role = profile_data.get("current_role", "Software Engineer")
        skills = profile_data.get("skills", ["Python", "System Design", "Git"])

        guidance_lines = [
            f"### Career Trajectory Analysis for Current Role: {current_role}",
            f"**Current Skills Profile**: {', '.join(skills)}",
            "",
            "#### 1. Skill Gap Analysis & Priority Learning Focus",
            "- Core Domain Mastery: Advanced Distributed Architecture, Security Engineering, and LLM Orchestration.",
            "- High-Leverage Competency: Agent State Machine design, Zero-Trust Access Control, Observability (OTel).",
            "",
            "#### 2. Strategic 3-Phase Milestone Roadmap",
            "- **Phase 1 (Month 1-2)**: Solidify foundations with live project contributions and architectural audits.",
            "- **Phase 2 (Month 3-4)**: Lead high-impact system designs, zero-trust security implementations, and multi-agent workflows.",
            "- **Phase 3 (Month 5-6)**: Enterprise positioning, executive technical communications, and target role transition.",
            "",
            "#### 3. Recommended Next Actions",
            "- Tailor resume for target roles with verified quantifiable achievements.",
            "- Conduct an ATS audit on recent project deliverables.",
        ]
        return "\n".join(guidance_lines)
