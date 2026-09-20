"""
Skill Injector - Dynamically injects target-compiled skills into runtime prompts.
"""
from __future__ import annotations

from typing import Any, List
from .loader import SkillPlaybook
from .compilers.claude import ClaudeSkillCompiler
from .compilers.codex import CodexSkillCompiler
from .compilers.qwen import QwenSkillCompiler


class SkillInjector:
    def __init__(self):
        self.claude_compiler = ClaudeSkillCompiler()
        self.codex_compiler = CodexSkillCompiler()
        self.qwen_compiler = QwenSkillCompiler()

    def inject_for_model(self, model_family: str, skills: list[SkillPlaybook]) -> list[Any]:
        """Compile and assemble skills according to the target model family."""
        family = model_family.lower()
        if "claude" in family or "anthropic" in family:
            return [self.claude_compiler.compile_prompt(s) for s in skills]
        elif "codex" in family or "gpt" in family or "openai" in family:
            combined_text = "\n\n".join(self.codex_compiler.compile_prompt(s) for s in skills)
            return [{"type": "text", "text": combined_text}]
        elif "qwen" in family or "ollama" in family or "vllm" in family:
            combined_text = "\n\n".join(self.qwen_compiler.compile_prompt(s) for s in skills)
            return [{"type": "text", "text": combined_text}]
        else:
            # Generic markdown fallback
            combined_text = "\n\n".join(f"## {s.name}\n{s.instructions}" for s in skills)
            return [{"type": "text", "text": combined_text}]
