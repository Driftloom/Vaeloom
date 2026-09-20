"""
Anthropic Claude Skill Compiler.

Generates Claude-native system prompt blocks with XML boundary tags (<skill>),
ephemeral prompt caching breakpoints, and progressive UI streaming cards.
"""
from __future__ import annotations

from typing import Any, Dict
from ..loader import SkillPlaybook


class ClaudeSkillCompiler:
    """Compiles generic skill playbooks into Anthropic Claude prompt and tool blocks."""

    def compile_prompt(self, skill: SkillPlaybook, enable_caching: bool = True) -> dict[str, Any]:
        """Compile skill instructions into XML delimited block with optional ephemeral cache control."""
        xml_block = (
            f'<skill name="{skill.name}" description="{skill.description}">\n'
            f"  <guidelines>\n"
            f"    {skill.instructions}\n"
            f"  </guidelines>\n"
        )

        if skill.examples:
            xml_block += "  <examples>\n"
            for ex in skill.examples:
                xml_block += f"    <example title=\"{ex.get('title', 'Scenario')}\">\n"
                xml_block += f"      <input>{ex.get('input', '')}</input>\n"
                xml_block += f"      <expected_output>{ex.get('output', '')}</expected_output>\n"
                xml_block += "    </example>\n"
            xml_block += "  </examples>\n"

        xml_block += "</skill>"

        block: dict[str, Any] = {
            "type": "text",
            "text": xml_block,
        }

        if enable_caching:
            block["cache_control"] = {"type": "ephemeral"}

        return block

    def compile_ui_cards(self, card_name: str, payload_schema: dict[str, Any]) -> dict[str, Any]:
        """Compile progressive UI streaming presentation card schema."""
        return {
            "name": f"ui_card_{card_name}",
            "description": f"Progressive streaming presentation card for {card_name}",
            "input_schema": {
                "type": "object",
                "properties": {
                    "card_id": {"type": "string"},
                    "data": payload_schema,
                    "is_partial": {"type": "boolean", "default": False},
                },
                "required": ["card_id", "data"],
            },
        }
