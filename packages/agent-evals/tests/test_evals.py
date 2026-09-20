import pytest
from vaeloom_agent_evals import EvalScenario, TrajectoryScorer


def test_trajectory_scorer_pass():
    scenario = EvalScenario(
        scenario_id="scen-01",
        target_agent="career-agent",
        user_prompt="Find backend jobs and evaluate fit",
        expected_tools=["search_jobs", "calculate_ats_score"],
        forbidden_tools=["execute_code_sandbox"],
        expected_substrings=["recommended jobs", "90% match"],
        max_allowed_steps=5,
    )

    invoked = ["search_jobs", "calculate_ats_score"]
    answer = "Here are your recommended jobs with a 90% match score."
    steps = 3

    result = TrajectoryScorer.score_trajectory(scenario, invoked, answer, steps)
    assert result.passed is True
    assert result.goal_achieved is True
    assert result.tool_precision == 1.0
    assert result.score > 80.0
    assert len(result.failure_reasons) == 0


def test_trajectory_scorer_forbidden_tool_failure():
    scenario = EvalScenario(
        scenario_id="scen-02",
        target_agent="career-agent",
        user_prompt="Test prompt",
        forbidden_tools=["delete_account"],
        expected_substrings=["Done"],
    )

    invoked = ["delete_account"]
    answer = "Done"
    result = TrajectoryScorer.score_trajectory(scenario, invoked, answer, 1)
    assert result.passed is False
    assert any("Forbidden tool" in r for r in result.failure_reasons)
