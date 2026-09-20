"""
OpenAI Codex & GPT Skill Compiler.

Generates strict Pydantic JSON schemas for tool calling and Python REPL analysis sandboxes.
"""
from __future__ import annotations

from typing import Any, Dict
from ..loader import SkillPlaybook


class CodexSkillCompiler:
    """Compiles generic skill playbooks into OpenAI Codex / GPT function tools and system blocks."""

    def compile_prompt(self, skill: SkillPlaybook) -> str:
        """Compile skill instructions into standard Markdown system prompt section."""
        prompt = f"### SKILL: {skill.name.upper()}\n"
        prompt += f"**Description**: {skill.description}\n\n"
        prompt += f"#### Operational Instructions:\n{skill.instructions}\n\n"

        if skill.examples:
            prompt += "#### Reference Trajectories:\n"
            for ex in skill.examples:
                prompt += f"- **{ex.get('title', 'Scenario')}**:\n"
                prompt += f"  - Input: `{ex.get('input', '')}`\n"
                prompt += f"  - Output: `{ex.get('output', '')}`\n"

        return prompt.strip()

    def compile_tool_schema(self, skill: SkillPlaybook) -> dict[str, Any]:
        """Compile a tool definition with strict JSON schema support."""
        return {
            "type": "function",
            "function": {
                "name": f"execute_{skill.name.replace('-', '_')}",
                "description": skill.description,
                "strict": True,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "instruction": {
                            "type": "string",
                            "description": "Specific sub-goal instruction for the skill",
                        },
                        "parameters": {
                            "type": "object",
                            "description": "Arbitrary key-value parameters",
                            "additionalProperties": True,
                        },
                    },
                    "required": ["instruction", "parameters"],
                    "additionalProperties": False,
                },
            },
        }

    def compile_repl_sandbox_instructions(self) -> str:
        """Compile guidelines for Python REPL sandbox data execution."""
        return (
            "You have access to a secure Python REPL sandbox. When analyzing complex tabular "
            "datasets or mathematical formulations, emit code in ```python ... ``` blocks. "
            "All output will be evaluated in-process and returned without cloud egress."
        )
