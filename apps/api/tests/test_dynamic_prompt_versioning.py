"""Enterprise Prompt Versioning & Rollback Test Suite.

Verifies:
- Prompt registration, checksum generation, and version bumping
- Workspace-specific prompt override resolution
- Rollback functionality deactivating newer versions
- DB synchronization into PromptRegistry
"""
import uuid
import pytest

from api.models.registries import PromptVersionEntry
from api.services.prompt_registry import PromptRegistry

pytestmark = pytest.mark.asyncio


async def test_prompt_registration_and_bumping():
    """Verify version bumping and checksum generation."""
    reg = PromptRegistry()
    p1 = reg.register_prompt("interview_coach", "System prompt v1: You are a coach.")
    assert p1.version == "v1.0"
    assert p1.checksum
    assert p1.is_active is True

    p2 = reg.register_prompt("interview_coach", "System prompt v2: Advanced coach with STAR.")
    assert p2.version == "v2.0"
    assert p2.checksum != p1.checksum

    latest = reg.get_latest("interview_coach")
    assert latest.version == "v2.0"
    assert latest.content == "System prompt v2: Advanced coach with STAR."


async def test_workspace_prompt_override():
    """Verify workspace override takes precedence over global prompt."""
    reg = PromptRegistry()
    reg.register_prompt("career_advice", "Global advice template.")

    ws_id = "ws-engineering-corp"
    reg.register_prompt(
        "career_advice",
        "Engineering specific advice template.",
        workspace_id=ws_id,
    )

    # General call gets global template
    global_p = reg.get_latest("career_advice")
    assert global_p.content == "Global advice template."

    # Workspace call gets override
    ws_p = reg.get_latest("career_advice", workspace_id=ws_id)
    assert ws_p.content == "Engineering specific advice template."


async def test_prompt_rollback():
    """Verify rolling back to earlier version deactivates subsequent versions."""
    reg = PromptRegistry()
    p1 = reg.register_prompt("resume_summary", "Version 1 content")
    p2 = reg.register_prompt("resume_summary", "Version 2 content (with regression)")

    assert reg.get_latest("resume_summary").version == "v2.0"

    # Roll back to v1.0
    rolled = reg.rollback("resume_summary", "v1.0")
    assert rolled is not None
    assert rolled.version == "v1.0"

    # Now get_latest should return v1.0
    active_latest = reg.get_latest("resume_summary")
    assert active_latest.version == "v1.0"
    assert active_latest.content == "Version 1 content"


async def test_prompt_db_sync(db_session):
    """Verify synchronizing prompt versions from PostgreSQL."""
    db_entry = PromptVersionEntry(
        prompt_id="ats_tailor_db",
        version="v1.0",
        agent_scope="ats",
        template="DB Template for ATS",
        content_hash="abc12345",
        variables=["resume", "job_desc"],
        is_active=True,
    )
    db_session.add(db_entry)
    await db_session.commit()

    reg = PromptRegistry()
    synced = await reg.sync_from_db(session=db_session)
    assert synced > 0
    synced_prompt = reg.get_latest("ats_tailor_db")
    assert synced_prompt is not None
    assert synced_prompt.content == "DB Template for ATS"
    assert synced_prompt.template == "DB Template for ATS"
    assert reg.get_prompt("ats_tailor_db").template == "DB Template for ATS"


async def test_get_prompt_alias_and_template_property():
    """Verify get_prompt alias and template property."""
    reg = PromptRegistry()
    reg.register_prompt("researcher", "Research instructions v1")
    p = reg.get_prompt("researcher")
    assert p is not None
    assert p.template == "Research instructions v1"
    assert p.content == "Research instructions v1"

