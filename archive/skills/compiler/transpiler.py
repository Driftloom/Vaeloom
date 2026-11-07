#!/usr/bin/env python3
"""
Universal Skill Transpiler - Compiles standard SKILL.md playbooks into model-specific formats:
1. Anthropic Claude: XML boundary tags (<skill>) + ephemeral prompt cache breakpoints.
2. OpenAI Codex / GPT: Strict Pydantic JSON function schemas + REPL instructions.
3. Qwen / Open-Weights: ReAct scratchpad prompts + regex/XML fallback parsers.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILLS_PKG_SRC = ROOT / "packages" / "agent-skills" / "src"
if str(SKILLS_PKG_SRC) not in sys.path:
    sys.path.insert(0, str(SKILLS_PKG_SRC))

from vaeloom_agent_skills import (
    load_skill_playbook,
    ClaudeSkillCompiler,
    CodexSkillCompiler,
    QwenSkillCompiler,
)


def transpile_all_skills():
    skills_root = ROOT / "skills"
    claude_compiler = ClaudeSkillCompiler()
    codex_compiler = CodexSkillCompiler()
    qwen_compiler = QwenSkillCompiler()

    count = 0
    print("=" * 70)
    print("  VAELOOM UNIVERSAL SKILL TRANSPILER")
    print("=" * 70)

    for skill_path in skills_root.rglob("SKILL.md"):
        try:
            skill = load_skill_playbook(skill_path)
            count += 1
            print(f"Transpiling [{skill.name}] from {skill_path.relative_to(ROOT)}...")

            claude_output = claude_compiler.compile_prompt(skill, enable_caching=True)
            codex_prompt = codex_compiler.compile_prompt(skill)
            codex_tool = codex_compiler.compile_tool_schema(skill)
            qwen_prompt = qwen_compiler.compile_prompt(skill)

            preview_dir = skill_path.parent / ".compiled"
            preview_dir.mkdir(exist_ok=True)
            (preview_dir / "claude.json").write_text(json.dumps(claude_output, indent=2), encoding="utf-8")
            (preview_dir / "codex_tool.json").write_text(json.dumps(codex_tool, indent=2), encoding="utf-8")
            (preview_dir / "codex_prompt.md").write_text(codex_prompt, encoding="utf-8")
            (preview_dir / "qwen_prompt.md").write_text(qwen_prompt, encoding="utf-8")

        except Exception as exc:
            print(f"Error transpiling {skill_path}: {exc}")

    print("=" * 70)
    print(f"Successfully transpiled {count} skills across Claude, Codex, and Qwen targets.")
    print("=" * 70)


if __name__ == "__main__":
    transpile_all_skills()
