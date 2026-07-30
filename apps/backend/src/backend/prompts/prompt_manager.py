"""
Prompt Manager — loads and renders system prompts from markdown files.
Supports environment variable override for prompt directory.
"""
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_PROMPT_DIR = Path(__file__).parent

PROMPT_FILES: dict[str, str] = {
    "base": "base_agent_prompt.md",
    "memory": "memory_agent_prompt.md",
    "resume": "resume_agent_prompt.md",
    "planner": "planner_agent_prompt.md",
}


class PromptManager:
    """
    Loads system prompts from markdown files and renders them with variables.
    Supports PROMPT_DIR env var for custom prompt directory.
    """

    def __init__(self, prompt_dir: Optional[str] = None):
        env_dir = os.environ.get("PROMPT_DIR")
        if env_dir:
            self._prompt_dir = Path(env_dir)
        elif prompt_dir:
            self._prompt_dir = Path(prompt_dir)
        else:
            self._prompt_dir = DEFAULT_PROMPT_DIR
        self._cache: dict[str, str] = {}
        logger.info("PromptManager initialized with directory: %s", self._prompt_dir)

    def get_prompt(self, agent_name: str, variables: Optional[dict[str, str]] = None) -> str:
        """
        Load and render a prompt template for the given agent.
        Falls back to the base prompt if no agent-specific prompt exists.
        """
        template = self._load_prompt(agent_name)
        rendered = self._render(template, variables or {})
        return rendered

    def _load_prompt(self, agent_name: str) -> str:
        if agent_name in self._cache:
            return self._cache[agent_name]

        prompt_file = PROMPT_FILES.get(agent_name)
        if prompt_file is None:
            prompt_file = PROMPT_FILES["base"]

        filepath = self._prompt_dir / prompt_file
        if not filepath.exists():
            logger.warning("Prompt file not found: %s, falling back to base prompt", filepath)
            filepath = self._prompt_dir / PROMPT_FILES["base"]

        try:
            template = filepath.read_text(encoding="utf-8")
            self._cache[agent_name] = template
            return template
        except OSError as e:
            logger.error("Failed to read prompt file %s: %s", filepath, e)
            raise RuntimeError(f"Failed to load prompt for agent '{agent_name}': {e}")

    def _render(self, template: str, variables: dict[str, str]) -> str:
        for key, value in variables.items():
            placeholder = "{{" + key + "}}"
            template = template.replace(placeholder, value)
        return template

    def reload(self) -> None:
        """Clear the cache and reload prompts from disk."""
        self._cache.clear()
        logger.info("Prompt cache cleared")

    def list_available_prompts(self) -> list[str]:
        return list(PROMPT_FILES.keys())

    def set_prompt_dir(self, prompt_dir: str) -> None:
        self._prompt_dir = Path(prompt_dir)
        self.reload()
        logger.info("Prompt directory changed to: %s", prompt_dir)


prompt_manager = PromptManager()
