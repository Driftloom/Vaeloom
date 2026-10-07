"""GitHub Remote Skill Validation Engine.

Fetches open-standard SKILL.md playbooks from a GitHub repository (e.g.
Driftloom/vaeloom-skills or a verified community registry) and validates each
one against strict invariants: scope containment, canonical section structure,
and domain-exclusion policy.

This module is VALIDATE-ONLY. It reads nothing but the remote repository and
writes nothing to any database -- there is no ``AsyncSession``, no
``WorkspaceCapability`` insert, and no ``db`` parameter anywhere in this file.
Callers receive the candidate skills in the response and must persist them
explicitly via ``POST /capabilities`` if they want them installed. The
``persisted`` field on the result is hard-coded ``False`` to make that contract
impossible to misread.

Persisting remote markdown is a deliberate security decision, not an oversight:
that text is later injected into an agent's prompt, so it needs a sanitisation
review before it is ever written. See ``POST /capabilities/sync-github`` in
``routers/capabilities.py``.
"""
from __future__ import annotations

import logging
from typing import Any, Optional
import httpx
import yaml
from pydantic import BaseModel, Field

from .skill_catalog_service import (
    PROHIBITED_EXTERNAL_DOMAINS,
    tool_scope_vocabulary,
    validate_skill_document,
)

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"
RAW_GITHUB_BASE = "https://raw.githubusercontent.com"

# Bounded-work limits. GitHub's ``?recursive=1`` tree walk has no depth cap of
# its own, so a repository with a few thousand files can otherwise turn a single
# authenticated request into thousands of outbound fetches. The walk is
# truncated rather than rejected so the caller still gets a usable (partial)
# result, and the truncation is reported in ``errors`` instead of being silent.
MAX_SKILLS_PER_SYNC = 200
MAX_DOC_BYTES = 256 * 1024


class RemoteSkillSummary(BaseModel):
    slug: str
    name: str
    description: str
    tags: list[str] = Field(default_factory=list)
    required_scope: str
    autonomy: str = "suggest"
    trust_class: str = "community"
    triggers: list[str] = Field(default_factory=list)
    version: str = "1.0.0"
    author: str = "GitHub Community"
    markdown_doc: str
    valid: bool = True
    validation_status: str = "success"
    violations: list[str] = Field(default_factory=list)


class GitHubSkillSyncResult(BaseModel):
    repository: str
    ref: str
    skills_discovered: int = 0
    skills_valid: int = 0
    skills_rejected: int = 0
    skills: list[RemoteSkillSummary] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    # Always False. See the module docstring: this engine never persists.
    persisted: bool = False
    skills_truncated: bool = False


def parse_remote_skill_md(
    raw_content: str, default_slug: str = "custom-skill"
) -> RemoteSkillSummary:
    """Parse a remote SKILL.md file with YAML frontmatter into a validated summary."""
    frontmatter: dict[str, Any] = {}
    doc_body = raw_content.strip()

    if raw_content.startswith("---"):
        parts = raw_content.split("---", 2)
        if len(parts) >= 3:
            try:
                frontmatter = yaml.safe_load(parts[1]) or {}
                doc_body = parts[2].strip()
            except Exception as e:
                logger.warning("Failed to parse YAML frontmatter: %s", e)

    slug = str(frontmatter.get("name") or default_slug).strip().lower().replace("_", "-")
    name = str(frontmatter.get("name") or slug).strip()
    description = str(frontmatter.get("description") or "").strip()
    tags = [str(t).strip() for t in frontmatter.get("tags", [])] or ["Community"]
    required_scope = str(frontmatter.get("required_scope") or "memory.read").strip()
    autonomy = str(frontmatter.get("autonomy") or "suggest").strip()
    trust_class = str(frontmatter.get("trust_class") or "community").strip()
    triggers = [str(tr).strip() for tr in frontmatter.get("triggers", [])]
    version = str(frontmatter.get("version") or "1.0.0").strip()
    author = str(frontmatter.get("author") or "Community").strip()

    # Invariant validations
    violations: list[str] = []

    # 1. Prohibited domain check
    if slug in PROHIBITED_EXTERNAL_DOMAINS:
        violations.append(f"Domain exclusion: '{slug}' is a prohibited external domain")

    # 2. Scope vocabulary check
    vocab = tool_scope_vocabulary()
    if required_scope not in vocab:
        violations.append(f"Scope vocabulary: '{required_scope}' is not in authorized tool scopes")

    # 3. 8-rule document validation
    val_res = validate_skill_document(
        markdown_doc=doc_body,
        required_scope=required_scope,
        tags=tags,
    )
    for v in val_res.violations:
        if v.severity == "hard":
            violations.append(f"{v.rule}: {v.message}")

    is_valid = len(violations) == 0

    return RemoteSkillSummary(
        slug=slug,
        name=name,
        description=description,
        tags=tags,
        required_scope=required_scope,
        autonomy=autonomy,
        trust_class=trust_class,
        triggers=triggers,
        version=version,
        author=author,
        markdown_doc=doc_body,
        valid=is_valid,
        validation_status="success" if is_valid else "error",
        violations=violations,
    )


async def sync_skills_from_github(
    repo: str = "Driftloom/vaeloom-skills",
    ref: str = "master",
    auth_token: Optional[str] = None,
    timeout_sec: float = 15.0,
) -> GitHubSkillSyncResult:
    """Fetch, parse, and validate skills from a remote GitHub repository tree."""
    clean_repo = repo.strip().removeprefix("https://github.com/").removesuffix(".git")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if auth_token:
        headers["Authorization"] = f"token {auth_token}"

    tree_url = f"{GITHUB_API_BASE}/repos/{clean_repo}/git/trees/{ref}?recursive=1"
    result = GitHubSkillSyncResult(repository=clean_repo, ref=ref)

    try:
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            resp = await client.get(tree_url, headers=headers)
            if resp.status_code != 200:
                result.errors.append(
                    f"GitHub API returned HTTP {resp.status_code}: {resp.text[:200]}"
                )
                return result

            tree_data = resp.json().get("tree", [])
            skill_paths = [
                item["path"]
                for item in tree_data
                if item.get("type") == "blob"
                and item.get("path", "").endswith("SKILL.md")
            ]

            if len(skill_paths) > MAX_SKILLS_PER_SYNC:
                result.errors.append(
                    f"Repository exposes {len(skill_paths)} SKILL.md files; "
                    f"processing the first {MAX_SKILLS_PER_SYNC} "
                    f"(set-skipped={len(skill_paths) - MAX_SKILLS_PER_SYNC})."
                )
                skill_paths = skill_paths[:MAX_SKILLS_PER_SYNC]
                result.skills_truncated = True

            result.skills_discovered = len(skill_paths)

            for path in skill_paths:
                raw_url = f"{RAW_GITHUB_BASE}/{clean_repo}/{ref}/{path}"
                file_resp = await client.get(raw_url)
                if file_resp.status_code == 200:
                    raw_bytes = file_resp.content
                    if len(raw_bytes) > MAX_DOC_BYTES:
                        result.errors.append(
                            f"Skipped {path}: {len(raw_bytes)} bytes exceeds "
                            f"the {MAX_DOC_BYTES}-byte per-document limit."
                        )
                        result.skills_rejected += 1
                        continue
                    slug_hint = path.split("/")[-2] if "/" in path else "skill"
                    parsed = parse_remote_skill_md(
                        file_resp.text, default_slug=slug_hint
                    )
                    result.skills.append(parsed)
                    if parsed.valid:
                        result.skills_valid += 1
                    else:
                        result.skills_rejected += 1
                else:
                    result.errors.append(f"Failed to fetch {path}: HTTP {file_resp.status_code}")

    except Exception as exc:
        logger.exception("Error syncing skills from GitHub repo %s: %s", clean_repo, exc)
        result.errors.append(f"Sync failed: {str(exc)}")

    return result
