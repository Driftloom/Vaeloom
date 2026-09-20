from typing import Any
from pydantic import BaseModel, Field
from .dataset import EvalScenario


class TrajectoryScore(BaseModel):
    scenario_id: str
    passed: bool
    goal_achieved: bool
    tool_precision: float = Field(..., ge=0.0, le=1.0)
    step_efficiency: float = Field(..., ge=0.0, le=1.0)
    score: float = Field(..., ge=0.0, le=100.0)
    failure_reasons: list[str] = Field(default_factory=list)


class TrajectoryScorer:
    """Evaluates agent execution trajectories against scenario expectations."""

    @staticmethod
    def score_trajectory(
        scenario: EvalScenario,
        invoked_tools: list[str],
        final_answer: str,
        total_steps: int,
    ) -> TrajectoryScore:
        reasons = []

        # 1. Check forbidden tools
        for ft in scenario.forbidden_tools:
            if ft in invoked_tools:
                reasons.append(f"Forbidden tool '{ft}' was invoked")

        # 2. Check expected tools
        matched_expected = 0
        for et in scenario.expected_tools:
            if et in invoked_tools:
                matched_expected += 1
            else:
                reasons.append(f"Expected tool '{et}' was not invoked")

        tool_prec = (matched_expected / len(scenario.expected_tools)) if scenario.expected_tools else 1.0

        # 3. Check expected answer substrings
        goal_ok = True
        for sub in scenario.expected_substrings:
            if sub.lower() not in final_answer.lower():
                goal_ok = False
                reasons.append(f"Final answer missing expected substring: '{sub}'")

        # 4. Step efficiency
        step_eff = max(0.0, min(1.0, 1.0 - (total_steps / (scenario.max_allowed_steps * 2))))

        passed = len(reasons) == 0 and goal_ok and total_steps <= scenario.max_allowed_steps
        overall_score = (tool_prec * 40.0) + (40.0 if goal_ok else 0.0) + (step_eff * 20.0)

        return TrajectoryScore(
            scenario_id=scenario.scenario_id,
            passed=passed,
            goal_achieved=goal_ok,
            tool_precision=tool_prec,
            step_efficiency=step_eff,
            score=round(overall_score, 1),
            failure_reasons=reasons,
        )
