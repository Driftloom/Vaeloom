import os
import tempfile
from pathlib import Path

import pytest

from api.prompts.prompt_manager import PromptManager, PROMPT_FILES

pytestmark = pytest.mark.asyncio


class TestPromptManager:
    @pytest.fixture
    def manager(self):
        return PromptManager()

    def test_initializes_with_default_dir(self, manager):
        assert manager._prompt_dir.exists()

    def test_list_available_prompts(self, manager):
        prompts = manager.list_available_prompts()
        assert "base" in prompts
        assert "memory" in prompts
        assert "resume" in prompts
        assert "planner" in prompts

    def test_get_base_prompt(self, manager):
        prompt = manager.get_prompt("base")
        assert "{{agent_name}}" in prompt
        assert "{{mission}}" in prompt

    def test_get_memory_prompt(self, manager):
        prompt = manager.get_prompt("memory")
        assert "Memory Agent" in prompt or "{{agent_name}}" in prompt
        assert "knowledge graph" in prompt.lower()

    def test_get_resume_prompt(self, manager):
        prompt = manager.get_prompt("resume")
        assert "Resume" in prompt

    def test_get_planner_prompt(self, manager):
        prompt = manager.get_prompt("planner")
        assert "roadmap" in prompt.lower() or "Planning" in prompt

    def test_render_with_variables(self, manager):
        prompt = manager.get_prompt("base", {"agent_name": "TestBot", "mission": "Test mission"})
        assert "TestBot" in prompt
        assert "Test mission" in prompt
        assert "{{agent_name}}" not in prompt
        assert "{{mission}}" not in prompt

    def test_fallback_to_base_for_unknown_agent(self, manager):
        prompt = manager.get_prompt("unknown_agent")
        assert "{{agent_name}}" in prompt

    def test_reload_clears_cache(self, manager):
        prompt1 = manager.get_prompt("base")
        manager.reload()
        prompt2 = manager.get_prompt("base")
        assert prompt1 == prompt2

    def test_custom_prompt_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prompt_path = Path(tmpdir) / "base_agent_prompt.md"
            prompt_path.write_text("Custom base prompt for {{agent_name}}")
            manager = PromptManager(prompt_dir=tmpdir)
            prompt = manager.get_prompt("base", {"agent_name": "CustomBot"})
            assert prompt == "Custom base prompt for CustomBot"

    def test_env_var_overrides_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            prompt_path = Path(tmpdir) / "base_agent_prompt.md"
            prompt_path.write_text("ENV prompt for {{agent_name}}")
            os.environ["PROMPT_DIR"] = tmpdir
            try:
                manager = PromptManager()
                prompt = manager.get_prompt("base", {"agent_name": "EnvBot"})
                assert prompt == "ENV prompt for EnvBot"
            finally:
                del os.environ["PROMPT_DIR"]

    def test_set_prompt_dir(self, manager):
        with tempfile.TemporaryDirectory() as tmpdir:
            prompt_path = Path(tmpdir) / "base_agent_prompt.md"
            prompt_path.write_text("Updated prompt")
            manager.set_prompt_dir(tmpdir)
            prompt = manager.get_prompt("base")
            assert prompt == "Updated prompt"

    def test_missing_file_falls_back(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            base_path = Path(tmpdir) / "base_agent_prompt.md"
            base_path.write_text("fallback prompt for {{agent_name}}")
            manager = PromptManager(prompt_dir=tmpdir)
            prompt = manager.get_prompt("memory")
            assert "fallback prompt" in prompt

    def test_multiple_variables(self, manager):
        prompt = manager.get_prompt("base", {
            "agent_name": "MultiBot",
            "mission": "Handle multiple tasks",
        })
        assert "MultiBot" in prompt
        assert "Handle multiple tasks" in prompt

    def test_partial_variables_preserves_unset(self, manager):
        prompt = manager.get_prompt("base", {"agent_name": "PartialBot"})
        assert "PartialBot" in prompt
        assert "{{mission}}" in prompt

    def test_cache_hit(self, manager):
        prompt1 = manager.get_prompt("base")
        prompt2 = manager.get_prompt("base")
        assert prompt1 is prompt2

    def test_cache_miss_after_reload(self, manager):
        prompt1 = manager.get_prompt("base")
        manager.reload()
        prompt2 = manager.get_prompt("base")
        assert prompt1 is not prompt2
