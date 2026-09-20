"""
Skill Playbook Loader - Parses standard Markdown skill definitions with YAML frontmatter.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, List, Optional
from pydantic import BaseModel, Field
import yaml


class SkillPlaybook(BaseModel):
    name: str = Field(..., description="Unique skill identifier")
    description: str = Field(..., description="High-level skill overview")
    target_models: list[str] = Field(default_factory=lambda: ["claude", "codex", "qwen"])
    tools_required: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    instructions: str = Field(..., description="Operational markdown instructions")
    examples: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


def load_skill_playbook(file_path: Path | str) -> SkillPlaybook:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Skill playbook not found: {path}")

    content = path.read_text(encoding="utf-8")
    frontmatter = {}
    instructions = content

    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            raw_yaml = parts[1]
            instructions = parts[2].strip()
            frontmatter = yaml.safe_load(raw_yaml) or {}

    name = frontmatter.get("name", path.parent.name if path.name == "SKILL.md" else path.stem)
    description = frontmatter.get("description", instructions.split("\n\n")[0] if instructions else "")
    target_models = frontmatter.get("target_models", ["claude", "codex", "qwen"])
    tools_required = frontmatter.get("tools_required", [])
    tags = frontmatter.get("tags", [])
    examples = frontmatter.get("examples", [])

    return SkillPlaybook(
        name=name,
        description=description,
        target_models=target_models,
        tools_required=tools_required,
        tags=tags,
        instructions=instructions,
        examples=examples,
        metadata=frontmatter,
    )
