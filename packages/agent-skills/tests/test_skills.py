import tempfile
from pathlib import Path
import pytest

from vaeloom_agent_skills import (
    SkillPlaybook,
    load_skill_playbook,
    ClaudeSkillCompiler,
    CodexSkillCompiler,
    QwenSkillCompiler,
    SkillInjector,
    SandboxedPlaybookRunner,
)


class TestAgentSkillsEngine:
    @pytest.fixture
    def sample_playbook_path(self, tmp_path):
        content = """---
name: sample-skill
description: Automated candidate evaluation and skill extraction
target_models: [claude, codex, qwen]
tools_required: [extract_skills, calculate_score]
examples:
  - title: Standard Resume
    input: Experienced Software Engineer with Python and AWS
    output: Score 92/100
---
### Operational Protocol
1. Extract hard and soft skills.
2. Cross-reference against job requirements.
3. Return deterministic score.
"""
        file_path = tmp_path / "SKILL.md"
        file_path.write_text(content, encoding="utf-8")
        return file_path

    def test_load_skill_playbook(self, sample_playbook_path):
        skill = load_skill_playbook(sample_playbook_path)
        assert skill.name == "sample-skill"
        assert "Automated candidate evaluation" in skill.description
        assert "extract_skills" in skill.tools_required
        assert len(skill.examples) == 1
        assert "Operational Protocol" in skill.instructions

    def test_claude_compiler(self, sample_playbook_path):
        skill = load_skill_playbook(sample_playbook_path)
        compiler = ClaudeSkillCompiler()
        block = compiler.compile_prompt(skill, enable_caching=True)
        assert block["type"] == "text"
        assert block["cache_control"] == {"type": "ephemeral"}
        assert '<skill name="sample-skill"' in block["text"]
        assert "</skill>" in block["text"]
        assert "<example title=\"Standard Resume\">" in block["text"]

    def test_codex_compiler(self, sample_playbook_path):
        skill = load_skill_playbook(sample_playbook_path)
        compiler = CodexSkillCompiler()
        prompt = compiler.compile_prompt(skill)
        assert "### SKILL: SAMPLE-SKILL" in prompt
        assert "Operational Protocol" in prompt

        tool_schema = compiler.compile_tool_schema(skill)
        assert tool_schema["type"] == "function"
        assert tool_schema["function"]["name"] == "execute_sample_skill"
        assert tool_schema["function"]["strict"] is True

    def test_qwen_compiler(self, sample_playbook_path):
        skill = load_skill_playbook(sample_playbook_path)
        compiler = QwenSkillCompiler()
        prompt = compiler.compile_prompt(skill)
        assert "SOVEREIGN PLAYBOOK: SAMPLE-SKILL" in prompt
        assert "ZERO CLOUD EGRESS" in prompt
        assert "Thought: <your step-by-step reasoning>" in prompt

        # Test regex parser
        scratchpad = "Thought: Need to calculate score\nAction: calculate_score\nAction Input: {\"score\": 90}\nObservation: done"
        action, action_input = compiler.parse_action_scratchpad(scratchpad)
        assert action == "calculate_score"
        assert "90" in action_input

    def test_injector(self, sample_playbook_path):
        skill = load_skill_playbook(sample_playbook_path)
        injector = SkillInjector()

        claude_res = injector.inject_for_model("claude-3-7-sonnet", [skill])
        assert len(claude_res) == 1
        assert '<skill name="sample-skill"' in claude_res[0]["text"]

        codex_res = injector.inject_for_model("gpt-4o", [skill])
        assert "SAMPLE-SKILL" in codex_res[0]["text"]

        qwen_res = injector.inject_for_model("qwen-2.5-72b", [skill])
        assert "SOVEREIGN PLAYBOOK" in qwen_res[0]["text"]

    def test_sandboxed_runner(self):
        runner = SandboxedPlaybookRunner(timeout_seconds=5)
        res = runner.execute_snippet("print('hello skill runner')")
        assert res["success"] is True
        assert "hello skill runner" in res["stdout"]
