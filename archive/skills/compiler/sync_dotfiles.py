#!/usr/bin/env python3
"""
Developer Environment Dotfile Skill Synchronizer.

Synchronizes canonical skill playbooks into developer tool config directories:
- .claude/skills/   (Anthropic Claude Code)
- .codex/skills/    (OpenAI Codex CLI)
- .qwen/skills/     (Qwen-Agent & Open-Weights)
- .agents/skills/   (Antigravity Platform)
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def sync_skills():
    skills_src = ROOT / "skills"
    targets = {
        "claude": ROOT / ".claude" / "skills",
        "codex": ROOT / ".codex" / "skills",
        "qwen": ROOT / ".qwen" / "skills",
        "agents": ROOT / ".agents" / "skills",
    }

    print("=" * 70)
    print("  VAELOOM SKILL DOTFILE SYNCHRONIZER")
    print("=" * 70)

    for name, target_dir in targets.items():
        target_dir.mkdir(parents=True, exist_ok=True)
        print(f"Syncing target: {target_dir.relative_to(ROOT)}...")

    claude_src = skills_src / "claude"
    if claude_src.exists():
        for skill_dir in claude_src.iterdir():
            if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                dest = targets["claude"] / skill_dir.name
                dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(skill_dir / "SKILL.md", dest / "SKILL.md")
                agent_dest = targets["agents"] / skill_dir.name
                agent_dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(skill_dir / "SKILL.md", agent_dest / "SKILL.md")

    codex_src = skills_src / "codex"
    if codex_src.exists():
        for skill_dir in codex_src.iterdir():
            if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                dest = targets["codex"] / skill_dir.name
                dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(skill_dir / "SKILL.md", dest / "SKILL.md")

    qwen_src = skills_src / "qwen"
    if qwen_src.exists():
        for skill_dir in qwen_src.iterdir():
            if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                dest = targets["qwen"] / skill_dir.name
                dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(skill_dir / "SKILL.md", dest / "SKILL.md")

    print("=" * 70)
    print("Successfully synchronized all skills to .claude, .codex, .qwen, and .agents!")
    print("=" * 70)


if __name__ == "__main__":
    sync_skills()
