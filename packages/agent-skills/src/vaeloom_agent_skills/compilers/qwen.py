"""
Qwen-Agent & Open-Weights Skill Compiler.

Generates ReAct scratchpad prompts, robust regex/XML fallback parsers,
and air-gapped sovereign execution playbooks with zero cloud egress.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple
from ..loader import SkillPlaybook


class QwenSkillCompiler:
    """Compiles generic skill playbooks into Qwen-Agent / Open-Weights ReAct playbooks."""

    def compile_prompt(self, skill: SkillPlaybook) -> str:
        """Compile skill instructions into ReAct scratchpad guidelines."""
        prompt = (
            f"=== SOVEREIGN PLAYBOOK: {skill.name.upper()} ===\n"
            f"Description: {skill.description}\n"
            f"Security: ZERO CLOUD EGRESS (Local Air-Gapped Inference)\n\n"
            f"Guidelines:\n{skill.instructions}\n\n"
            f"Format your decision steps using ReAct scratchpad syntax:\n"
            f"Thought: <your step-by-step reasoning>\n"
            f"Action: <tool_name>\n"
            f"Action Input: <json_formatted_input>\n"
            f"Observation: <wait for environment response>\n"
            f"Final Answer: <your final conclusion>\n"
        )
        return prompt.strip()

    @staticmethod
    def parse_action_scratchpad(text: str) -> Optional[Tuple[str, str]]:
        """Robust regex parser extracting tool name and JSON input from ReAct text."""
        action_match = re.search(r"Action:\s*([a-zA-Z0-9_\-]+)", text)
        input_match = re.search(r"Action Input:\s*(\{.*?\}|\[.*?\]|.+)", text, re.DOTALL)

        if action_match and input_match:
            action = action_match.group(1).strip()
            action_input = input_match.group(1).strip()
            return action, action_input

        # Fallback XML parsing (<tool>...</tool><input>...</input>)
        xml_match = re.search(r"<tool>([a-zA-Z0-9_\-]+)</tool>\s*<input>(.*?)</input>", text, re.DOTALL)
        if xml_match:
            return xml_match.group(1).strip(), xml_match.group(2).strip()

        return None
